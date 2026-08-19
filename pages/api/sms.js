// On-demand status SMS (staff-triggered) — the send half of the draft modal,
// and the reply half of the inbound message log.
//
//   POST { customerId, text }   — text the customer on file
//   POST { replyTo, text }      — answer one inbound SMS, named by its log id
//
// Mirrors /api/email exactly: the recipient is ALWAYS resolved server-side
// (the client never supplies a number), and the Twilio gate in lib/sms.js
// decides HOLD / TEST / LIVE — so with no SMS_LIVE set, pressing Send builds
// and logs the message but sends nothing.
//
// The reply path keeps that rule rather than bending it. A text can arrive from
// a number matching no customer, so there is no customer to resolve — but the
// number is already in email_log, written by the webhook. Naming the LOG ROW
// means the destination still comes out of our own database and never off the
// wire, which is the property that stops this endpoint being a way to text an
// arbitrary number from a browser.

import { withStaff, tabAllowedFor } from '../../lib/auth.js'
import { db, tablesMode } from '../../lib/db.js'
import { smsEnabled, sendSms } from '../../lib/sms.js'
import { replyTarget } from '../../lib/inboundSms.mjs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Fetch the row being answered; lib/inboundSms.mjs decides whether it may be. */
async function inboundToReplyTo(id) {
  if (!UUID.test(String(id || ''))) return { error: 'That message id is not one of ours.' }
  const rows = await db.select('email_log',
    `select=id,provider,kind,status,to_email,subject,customer_id&id=eq.${encodeURIComponent(String(id))}&limit=1`)
  return replyTarget(rows[0])
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
  // The reply control lives on the Settings message log, so it follows the
  // Settings permission; the draft modal keeps the one it always had.
  if (!(await tabAllowedFor(req.staff, replying ? 'settings' : 'rentals'))) {
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
