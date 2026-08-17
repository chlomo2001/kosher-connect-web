// A customer texts the shop back.
//
// WHY THIS EXISTS, AND WHY IT EXISTS FIRST. The shop is buying a Twilio number
// so customers can reply (owner, 17 Aug). An alphanumeric sender ID —
// "KosherCnct" — is a display name with no handset behind it, so today a reply
// is impossible rather than merely unread. A real number changes that, and the
// moment it does, every reply Twilio receives is POSTed here.
//
// Twilio does NOT retry an inbound webhook the way it retries a status
// callback. A reply that arrives before this endpoint exists is gone. So this
// ships BEFORE the number is bought, not after.
//
// It sends NOTHING. It answers Twilio with an empty TwiML document, which is
// the documented way to say "received, no auto-reply". That matters here: live
// sends are HOLD-gated until the owner turns them on (CLAUDE.md), and an
// auto-responder would be a send — one that nobody had approved, going out at
// whatever hour the customer texted.
//
// Auth is Twilio's own signature over this exact URL, the same scheme as
// pages/api/sms-status.js. No new shared secret.

import { db, tablesMode } from '../../lib/db.js'
import { verifyTwilioSignature, requestUrl } from '../../lib/twilioSignature.mjs'
import { inboundLogRow, inboundSummary, isStopKeyword, matchCustomerByPhone } from '../../lib/inboundSms.mjs'
import { phoneDigits } from '../../lib/phoneNumber.mjs'

const enc = encodeURIComponent
const AUTH_TOKEN = (process.env.TWILIO_AUTH_TOKEN || '').trim()

// Empty TwiML: "I have it, say nothing back."
const NO_REPLY = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'

/**
 * Find the sender among the customers, without dragging 1,800 rows across the
 * wire on every text. The stored number is canonical digits, so the last nine
 * — the part a UK number keeps whether it was written 07… or +447… — narrow it
 * to a handful, and lib/inboundSms decides among them (and refuses to choose
 * when two share a tail).
 */
async function findCustomer(from) {
  const tail = phoneDigits(from).slice(-9)
  if (tail.length < 9) return null
  try {
    const rows = await db.select(
      'customers',
      `select=legacy_id,first_name,last_name,phone_number,legacy_extras&phone_number=like.*${enc(tail)}*&limit=25`,
    )
    const shaped = rows.map(r => ({
      id: String(r.legacy_id ?? ''),
      firstName: r.first_name || '',
      lastName: r.last_name || '',
      phone: r.phone_number || '',
      altPhone: r.legacy_extras?.altPhone || '',
    }))
    return matchCustomerByPhone(from, shaped)
  } catch (e) {
    // A lookup failure must not lose the message — it is logged unmatched, and
    // a human can still read it and see who it came from.
    console.error('[sms-inbound] customer lookup failed:', e.message)
    return null
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!AUTH_TOKEN) {
    console.error('[sms-inbound] TWILIO_AUTH_TOKEN missing — cannot verify the signature')
    return res.status(503).end()
  }

  const params = req.body && typeof req.body === 'object' ? req.body : {}
  const ok = verifyTwilioSignature({
    authToken: AUTH_TOKEN,
    url: requestUrl(req),
    params,
    signature: req.headers['x-twilio-signature'],
  })
  if (!ok) {
    // Never say WHY — see sms-status.js. An unsigned POST here could otherwise
    // write anything it liked into the shop's message history.
    console.warn('[sms-inbound] rejected an unsigned or badly signed message')
    return res.status(403).end()
  }

  const from = String(params.From || '').trim()
  const to = String(params.To || '').trim()
  const body = String(params.Body ?? '')
  const sid = String(params.MessageSid || params.SmsSid || '').trim()
  if (!from || !sid) return res.status(400).end()

  if (!tablesMode) {
    // Nowhere to write it. Say so loudly rather than quietly accepting and
    // dropping a customer's message.
    console.error(`[sms-inbound] no database — LOST a reply from ${from}`)
    return res.status(503).end()
  }

  const customer = await findCustomer(from)
  const name = customer ? `${customer.firstName} ${customer.lastName}`.trim() : null

  try {
    await db.insert('email_log', [inboundLogRow({ from, to, body, messageSid: sid, customerId: customer?.id || null })])
  } catch (e) {
    // 500 on purpose. Twilio will not retry, but the failure then shows in its
    // error log instead of vanishing, and the message itself is still readable
    // in the Twilio console — so it is recoverable rather than lost silently.
    console.error('[sms-inbound] could not log a reply:', e.message, '| from', from)
    return res.status(500).end()
  }

  // Console line so the owner can see traffic in the Vercel log from day one,
  // before any screen for this exists.
  console.log(`[sms-inbound] ${inboundSummary({ from, body, customerName: name })}${customer ? '' : ' (unmatched)'}`)
  if (isStopKeyword(body)) {
    // Twilio's Messaging Service enforces the opt-out itself — it refuses
    // further sends to this number. This line is so a person knows why the
    // reminders stopped, and can ring them instead if it matters.
    console.warn(`[sms-inbound] OPT-OUT from ${from}${name ? ` (${name})` : ''}`)
  }

  res.setHeader('Content-Type', 'text/xml')
  return res.status(200).send(NO_REPLY)
}
