// Outbound SMS — Textlocal (UK, preferred) or Twilio, mirroring lib/email.js:
// having credentials is separate from being ARMED to send. The same three-state
// gate protects real numbers whichever provider is active:
//   • (default) HOLD — nothing is sent. Messages are built and logged only.
//   • TEST           — set SMS_TEST_TO=+447700900000; EVERY message goes to
//                      that one number (never the customer).
//   • LIVE           — set SMS_LIVE=true; messages go to the customer's
//                      real number on file.
//
// Provider selection (same idea as email's Resend-over-SMTP):
//   Textlocal is used when TEXTLOCAL_API_KEY is set; otherwise Twilio when its
//   credentials are present. Textlocal is the better fit for a UK-only shop —
//   cheaper, and it can show an alphanumeric sender name ("KosherCnct") instead
//   of a number (one-way: customers can't reply to an alphanumeric sender).
//
// Env vars (the owner creates the account and pastes these in Vercel):
//   Textlocal —
//     TEXTLOCAL_API_KEY    the API key from Textlocal → Settings → API keys
//     TEXTLOCAL_SENDER     optional sender ID, ≤11 chars (default "KosherCnct")
//   Twilio —
//     TWILIO_ACCOUNT_SID   AC…
//     TWILIO_AUTH_TOKEN    the account's auth token
//     TWILIO_FROM          the purchased Twilio number (+44…) — or instead:
//     TWILIO_MESSAGING_SERVICE_SID  MG… (takes precedence over TWILIO_FROM)
//   Shared —
//     SMS_TEST_TO          optional — redirect ALL SMS here (test mode)
//     SMS_LIVE             set to true/1/yes to send to real customers
//
// Every attempt lands in email_log (provider 'textlocal'|'twilio', kind 'sms',
// the phone number in to_email) — one audit trail for every message the
// business sends, whatever the channel.

import { db, tablesMode } from './db.js'

// ---- Textlocal ----
const TL_KEY = (process.env.TEXTLOCAL_API_KEY || '').trim()
const TL_SENDER = ((process.env.TEXTLOCAL_SENDER || 'KosherCnct').trim()).slice(0, 11)

// ---- Twilio ----
const SID = (process.env.TWILIO_ACCOUNT_SID || '').trim()
const TOKEN = (process.env.TWILIO_AUTH_TOKEN || '').trim()
const FROM = (process.env.TWILIO_FROM || '').trim()
const MSG_SERVICE = (process.env.TWILIO_MESSAGING_SERVICE_SID || '').trim()

const textlocalReady = !!TL_KEY
const twilioReady = !!(SID && TOKEN && (FROM || MSG_SERVICE))

// Textlocal wins when configured, matching email's provider precedence.
const PROVIDER = textlocalReady ? 'textlocal' : twilioReady ? 'twilio' : null

export const smsEnabled = !!PROVIDER

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
    provider: PROVIDER,
    mode: smsEnabled ? smsGate().mode : 'unconfigured',
  }
}

// Textlocal expects bare international digits (no '+'), a message, and a sender.
async function deliverTextlocal({ to, body }) {
  const numbers = String(to || '').replace(/\D/g, '') // digits only, no '+'
  const params = new URLSearchParams({
    apikey: TL_KEY,
    numbers,
    message: body,
    sender: TL_SENDER,
  })
  const res = await fetch('https://api.txtlocal.com/send/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
    signal: AbortSignal.timeout(15000),
  })
  // Textlocal always returns 200 with a JSON status field; a failure is
  // status:'failure' + an errors[] array, not an HTTP error.
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.status !== 'success') {
    const msg = data?.errors?.[0]?.message || data?.status || `HTTP ${res.status}`
    throw new Error(`[textlocal] ${msg}`)
  }
  return data?.messages?.[0]?.id != null ? String(data.messages[0].id) : null
}

async function deliverTwilio({ to, body }) {
  const params = new URLSearchParams({ To: to, Body: body })
  if (MSG_SERVICE) params.set('MessagingServiceSid', MSG_SERVICE)
  else params.set('From', FROM)
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

// Dispatch to whichever provider is active.
async function deliver(msg) {
  return PROVIDER === 'textlocal' ? deliverTextlocal(msg) : deliverTwilio(msg)
}

// Audit trail — same table as email so there is ONE place to see every
// message the business sent. Never allowed to break the send itself.
async function logSend(row) {
  if (!tablesMode) return
  try {
    await db.insert('email_log', [{ provider: PROVIDER || 'sms', kind: 'sms', ...row }])
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
