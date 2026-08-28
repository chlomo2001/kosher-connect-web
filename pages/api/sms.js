// On-demand status SMS (staff-triggered) — the send half of the draft modal,
// and the reply half of the inbound message log.
//
//   POST { customerId, text }   — text the customer on file
//   POST { replyTo, text }      — answer one inbound SMS, named by its log id
//   POST { toNumber, text }     — text a UK mobile typed at the counter
//
// Mirrors /api/email: the Twilio gate in lib/sms.js decides HOLD / TEST / LIVE,
// so with no SMS_LIVE set, pressing Send builds and logs the message but sends
// nothing.
//
// The first two paths resolve the recipient entirely server-side — the client
// names a customer or a log row, never a number. The reply path keeps that rule
// rather than bending it: a text can arrive from a number matching no customer,
// but the number is already in email_log, written by the webhook, so the
// destination still comes out of our own database.
//
// The THIRD path is a deliberate, bounded exception, added 28 Aug because the
// owner asked for it: "a simple option of just sending an SMS to a customer.
// e.g., compose, to (customer dropdown or free typed uk number), send". The
// shop's real case is somebody at the counter whose number is not on file yet,
// and no amount of server-side resolution can produce a number the database has
// never seen. So the rule that replaces it is a narrower one:
//
//   · UK mobiles only — normalised to +447xxxxxxxxx, everything else refused,
//     so this cannot dial a premium line, a foreign number or a landline;
//   · staff session required, same as every other path here;
//   · the send is logged in email_log like all the rest, so who texted what to
//     which number is answerable afterwards.
//
// That is a smaller surface than "any number the browser sends", which is the
// property the original rule was protecting.

import { withStaff, tabAllowedFor } from '../../lib/auth.js'
import { db, tablesMode } from '../../lib/db.js'
import { smsEnabled, sendSms } from '../../lib/sms.js'
import { replyTarget } from '../../lib/inboundSms.mjs'
import { normalisePhoneE164, phoneProblem } from '../../lib/phoneNumber.mjs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Fetch the row being answered; lib/inboundSms.mjs decides whether it may be. */
async function inboundToReplyTo(id) {
  if (!UUID.test(String(id || ''))) return { error: 'That message id is not one of ours.' }
  const rows = await db.select('email_log',
    `select=id,provider,kind,status,to_email,subject,customer_id&id=eq.${encodeURIComponent(String(id))}&limit=1`)
  return replyTarget(rows[0])
}

/**
 * A number typed at the counter, or the reason it cannot be texted.
 *
 * UK mobiles only. phoneProblem catches what cannot be a phone number at all;
 * this is the tighter bound the free-typed path trades for — a landline, a
 * premium 09, a foreign number and a half-typed one are all refused here, and
 * the message says which so the operator can fix it rather than guess.
 */
function typedUkMobile(raw) {
  const bad = phoneProblem(raw)
  if (bad) return { error: bad.message }
  const e164 = normalisePhoneE164(raw)
  if (!/^\+447\d{9}$/.test(e164)) {
    return { error: 'Texts typed in here go to UK mobiles only \u2014 07\u2026 or +447\u2026. For any other number, open the customer and text them from their card.' }
  }
  return { phone: e164 }
}

async function customerPhone(customerId) {
  if (!customerId || customerId === 'walkin') return null
  const rows = await db.select(
    'customers',
    `select=id,first_name,last_name,phone_country_code,phone_number&legacy_id=eq.${encodeURIComponent(String(customerId))}`
  )
  const c = rows[0]
  if (!c) return null
  const phone = c.phone_country_code && c.phone_number
    ? `${c.phone_country_code}${c.phone_number}`.replace(/[^\d+]/g, '')
    : null
  return {
    id: c.id,
    phone,
    name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
  }
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!tablesMode) {
    return res.status(503).json({ success: false, error: 'SMS needs the relational data layer.' })
  }
  if (!smsEnabled) {
    return res.status(503).json({
      success: false,
      error: 'SMS isn’t configured yet. Add TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM to send messages.',
    })
  }
  const b = req.body || {}
  const replying = !!b.replyTo
  const typed = !replying && !!b.toNumber
  // The reply control lives on the Settings message log, so it follows the
  // Settings permission; the draft modal keeps the one it always had. Composing
  // to a typed number is the Messages screen's own control and follows Messages
  // \u2014 the tab a helper is given precisely when texting customers is their job.
  const need = replying ? 'settings' : typed ? 'messages' : 'rentals'
  if (!(await tabAllowedFor(req.staff, need))) {
    return res.status(403).json({ success: false, error: 'Not permitted.' })
  }

  const text = String(b.text || '').trim().slice(0, 640)
  if (!text) return res.status(400).json({ success: false, error: 'Nothing to send.' })

  try {
    let to, customerId, repliesTo = null
    if (replying) {
      const src = await inboundToReplyTo(b.replyTo)
      if (src.error) return res.status(400).json({ success: false, error: src.error })
      to = src.phone
      customerId = src.customerId
      // The id the lookup verified, not the one the browser sent.
      repliesTo = src.id
    } else if (typed) {
      const num = typedUkMobile(b.toNumber)
      if (num.error) return res.status(400).json({ success: false, error: num.error })
      to = num.phone
      // No customer is claimed for a number nobody has matched to one. Guessing
      // would file a stranger's text on somebody's card; the thread still forms,
      // because msgBuildThreads groups on the number.
      customerId = null
    } else {
      const who = await customerPhone(b.customerId)
      if (!who) return res.status(400).json({ success: false, error: 'Customer not found.' })
      if (!who.phone) {
        return res.status(400).json({ success: false, error: `No mobile number on file for ${who.name || 'this customer'}.` })
      }
      to = who.phone
      customerId = who.id
    }

    const r = await sendSms({ to, body: text, customerId, repliesTo })
    if (r.held) {
      return res.json({ success: true, held: true, note: 'SMS is on HOLD — the message was built but not sent. Set SMS_LIVE=true when you’re ready to text real customers.' })
    }
    if (r.redirectedTo) {
      return res.json({ success: true, redirected: true, sentTo: r.redirectedTo, note: `Test mode — sent to ${r.redirectedTo} instead of the customer.` })
    }
    return res.json({ success: true, sentTo: r.sentTo })
  } catch (e) {
    console.error('[api/sms]', e)
    const detail = /^\[twilio\] /.test(String(e?.message || '')) ? ` (${String(e.message).slice(0, 200)})` : ''
    return res.status(502).json({ success: false, error: `The SMS provider rejected the message${detail || ' — check the Twilio settings'}.` })
  }
}

export default withStaff(handler)
