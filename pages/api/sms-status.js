// Twilio tells us what actually happened to a message.
//
// WHY THIS EXISTS. lib/sms.js logged 'sent' the moment Twilio's API returned a
// message SID, and a message SID means only "Twilio accepted this", never "a
// handset received it". Between 24 July and 16 August every SMS this app sent
// was rejected by Twilio with error 21267 (alphanumeric sender IDs are not
// permitted on trial accounts) — including two real rental reminders — and the
// audit trail recorded all of them as fine. The error sat in Twilio's debugger
// for three weeks with nothing to carry it back here.
//
// Twilio POSTs here as the message moves: queued → sent → delivered, or
// → undelivered / failed with an ErrorCode. The row keeps its own status (what
// WE did) and gains the delivery result (what the carrier did).
//
// Auth is Twilio's own signature, verified with the account auth token we
// already hold — no new shared secret, and it binds the signature to this exact
// URL so one cannot be replayed against another endpoint.

import { db, tablesMode } from '../../lib/db.js'
import { verifyTwilioSignature, requestUrl } from '../../lib/twilioSignature.mjs'

const enc = encodeURIComponent
const AUTH_TOKEN = (process.env.TWILIO_AUTH_TOKEN || '').trim()

// Twilio sends the code, not the sentence. These are the ones a UK shop
// actually meets; anything else is stored as its bare code, which is still
// searchable in Twilio's docs.
const CODES = {
  21267: 'Alphanumeric Sender ID cannot be used on a trial account — upgrade the account.',
  21606: 'The From number is not a valid, SMS-capable Twilio number.',
  21608: 'Unverified number — a trial account can only text verified numbers.',
  21610: 'That number has replied STOP and is unsubscribed.',
  21612: 'Twilio cannot route to that number from this sender.',
  30003: 'Handset unreachable — switched off or out of coverage.',
  30004: 'Message blocked by the carrier.',
  30005: 'Unknown number — it may no longer exist.',
  30006: 'Landline, or a number that cannot receive SMS.',
  30007: 'Carrier filtered the message — usually an unregistered sender ID.',
  30008: 'Unknown delivery failure at the carrier.',
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!AUTH_TOKEN) {
    console.error('[sms-status] TWILIO_AUTH_TOKEN missing — cannot verify the signature')
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
    // Never say WHY: a caller learning "url mismatch" vs "bad digest" is being
    // helped to forge the next attempt.
    console.warn('[sms-status] rejected an unsigned or badly signed callback')
    return res.status(403).end()
  }

  const sid = String(params.MessageSid || params.SmsSid || '').trim()
  const status = String(params.MessageStatus || params.SmsStatus || '').trim().toLowerCase()
  if (!sid || !status) return res.status(400).end()

  // Twilio retries on a non-2xx, so a storage failure must be honest (5xx) and
  // everything else must be a 200 even when there is nothing to update.
  if (!tablesMode) return res.status(503).end()

  try {
    const code = String(params.ErrorCode || '').trim()
    const patch = {
      delivery_status: status,
      delivery_error: code ? `${code} — ${CODES[code] || 'see Twilio error code documentation'}` : null,
      ...(status === 'delivered' ? { delivered_at: new Date().toISOString() } : {}),
    }
    const rows = await db.update('email_log', `provider_id=eq.${enc(sid)}`, patch)
    if (!rows.length) {
      // A callback for a message this app did not send — a leftover from a
      // deleted row, or another system on the same Twilio account. Not an
      // error, but worth seeing rather than swallowing.
      console.warn(`[sms-status] no log row for ${sid} (${status})`)
    }
    if (status === 'undelivered' || status === 'failed') {
      console.error(`[sms-status] ${sid} ${status}${code ? ` code=${code}` : ''}`)
    }
    return res.status(204).end()
  } catch (e) {
    console.error('[sms-status]', e)
    return res.status(500).end()   // let Twilio retry
  }
}
