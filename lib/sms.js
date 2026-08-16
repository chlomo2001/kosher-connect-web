// Outbound SMS — Twilio, mirroring lib/email.js exactly: having credentials
// is separate from being ARMED to send. The same three-state gate protects
// real numbers:
//   • (default) HOLD — nothing is sent. Messages are built and logged only.
//   • TEST           — set SMS_TEST_TO=+447700900000; EVERY message goes to
//                      that one number (never the customer).
//   • LIVE           — set SMS_LIVE=true; messages go to the customer's
//                      real number on file.
//
// Env vars (the owner creates the Twilio account and pastes these in Vercel):
//   TWILIO_ACCOUNT_SID   AC…
//   TWILIO_AUTH_TOKEN    the account's auth token
//   TWILIO_MESSAGING_SERVICE_SID  MG… — a Messaging Service (recommended: it
//                        holds the "KosherCnct" alphanumeric sender). Takes
//                        precedence over TWILIO_FROM.
//   TWILIO_FROM          a purchased Twilio number (+44…) — alternative to the
//                        Messaging Service SID.
//   PUBLIC_BASE_URL      https://app.kosher-connect.com — where Twilio posts
//                        delivery results (/api/sms-status). Falls back to
//                        VERCEL_URL; without either, delivery tracking is off.
//   SMS_TEST_TO          optional — redirect ALL SMS here (test mode)
//   SMS_LIVE             set to true/1/yes to send to real customers
//
// Every attempt lands in email_log (provider 'twilio', kind 'sms', the phone
// number in to_email) — one audit trail for every message the business sends,
// whatever the channel.

import { db, tablesMode } from './db.js'

const SID = (process.env.TWILIO_ACCOUNT_SID || '').trim()
const TOKEN = (process.env.TWILIO_AUTH_TOKEN || '').trim()
const FROM = (process.env.TWILIO_FROM || '').trim()
const MSG_SERVICE = (process.env.TWILIO_MESSAGING_SERVICE_SID || '').trim()

// Where Twilio should report delivery back to. PUBLIC_BASE_URL is explicit and
// stable (https://app.kosher-connect.com); VERCEL_URL is the per-deployment
// host and works, but changes every deploy. With neither set no callback is
// attached at all — status tracking goes dark, sending is untouched. A missing
// bit of observability must never be able to stop the shop texting anyone.
const BASE_URL = (process.env.PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '')
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.trim()}` : '')
const STATUS_CALLBACK = BASE_URL ? `${BASE_URL}/api/sms-status` : ''

export const smsEnabled = !!(SID && TOKEN && (FROM || MSG_SERVICE))

const truthy = (v) => /^(1|true|yes|on)$/i.test(String(v || '').trim())
function smsGate() {
  const testTo = (process.env.SMS_TEST_TO || '').trim()
  if (testTo) return { mode: 'test', testTo }
  if (truthy(process.env.SMS_LIVE)) return { mode: 'live' }
  return { mode: 'hold' }
}

// Reportable status for /api/health and the UI — no secrets.
export function smsStatus() {
  return {
    configured: smsEnabled,
    provider: smsEnabled ? 'twilio' : null,
    mode: smsEnabled ? smsGate().mode : 'unconfigured',
    // WHICH sender the deployed function will actually use. Without this,
    // "did the Messaging Service SID make it into Vercel?" can only be answered
    // from memory — and a service SID set months ago in one environment but not
    // another is exactly the kind of thing memory gets wrong. The last six
    // characters are enough to tell two SIDs apart and are not a credential:
    // an MG id identifies a Messaging Service, it does not authorise anything.
    sender: MSG_SERVICE ? 'messaging-service' : (FROM ? 'from-number' : 'none'),
    senderRef: MSG_SERVICE ? `MG…${MSG_SERVICE.slice(-6)}` : (FROM ? `…${FROM.slice(-4)}` : null),
    // Whether delivery results will come back at all. 'off' means the log will
    // keep saying only what WE did, never what the carrier did.
    deliveryTracking: STATUS_CALLBACK ? 'on' : 'off',
  }
}

async function deliver({ to, body }) {
  const params = new URLSearchParams({ To: to, Body: body })
  if (MSG_SERVICE) params.set('MessagingServiceSid', MSG_SERVICE)
  else params.set('From', FROM)
  // Ask Twilio to report what happens next. Without this the log records only
  // that Twilio ACCEPTED the message — which is what let 21267 hide for three
  // weeks (see pages/api/sms-status.js).
  if (STATUS_CALLBACK) params.set('StatusCallback', STATUS_CALLBACK)
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${SID}:${TOKEN}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
    signal: AbortSignal.timeout(15000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`[twilio] HTTP ${res.status} ${data?.message || ''}`)
  return data.sid || null
}

// Audit trail — same table as email so there is ONE place to see every
// message the business sent. Never allowed to break the send itself.
async function logSend(row) {
  if (!tablesMode) return
  try {
    await db.insert('email_log', [{ provider: 'twilio', kind: 'sms', ...row }])
  } catch (e) {
    console.error('[sms] log write failed:', e.message)
  }
}

// sendSms({to, body, customerId}) → one of:
//   { ok:true, held:true }             HOLD — nothing sent
//   { ok:true, redirectedTo }          TEST — sent to the test number
//   { ok:true, sentTo, providerId }    LIVE — sent to the customer
// Throws on provider errors (caller reports the reason to staff).
export async function sendSms({ to, body, customerId }) {
  if (!smsEnabled) throw new Error('SMS not configured')
  const toNorm = String(to || '').replace(/[^\d+]/g, '')
  const base = { to_email: toNorm, subject: String(body || '').slice(0, 160), customer_id: customerId || null }
  const gate = smsGate()

  if (gate.mode === 'hold') {
    await logSend({ ...base, status: 'held' })
    console.log(`[sms] HELD (not sent — SMS_LIVE not set) intended-to=${toNorm}`)
    return { ok: true, held: true }
  }

  const actualTo = gate.mode === 'test' ? gate.testTo : toNorm
  const bodyOut = gate.mode === 'test' ? `[TEST → ${toNorm}] ${body}` : body
  try {
    const id = await deliver({ to: actualTo, body: bodyOut })
    await logSend({
      ...base,
      status: gate.mode === 'test' ? 'redirected' : 'sent',
      actual_to: actualTo,
      provider_id: id,
    })
    return gate.mode === 'test'
      ? { ok: true, redirectedTo: actualTo }
      : { ok: true, sentTo: actualTo, providerId: id }
  } catch (e) {
    await logSend({ ...base, status: 'failed', actual_to: actualTo, error: String(e.message || e).slice(0, 500) })
    throw e
  }
}
