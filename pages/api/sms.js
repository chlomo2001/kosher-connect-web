// On-demand status SMS (staff-triggered) — the send half of the draft modal.
//
//   POST { customerId, text }
//
// Mirrors /api/email exactly: the recipient is ALWAYS resolved server-side
// from the customer on file (the client never supplies a number), and the
// Twilio gate in lib/sms.js decides HOLD / TEST / LIVE — so with no SMS_LIVE
// set, pressing Send builds and logs the message but sends nothing.

import { withStaff, tabAllowedFor } from '../../lib/auth.js'
import { db, tablesMode } from '../../lib/db.js'
import { smsEnabled, sendSms } from '../../lib/sms.js'

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
  if (!(await tabAllowedFor(req.staff, 'rentals'))) {
    return res.status(403).json({ success: false, error: 'Not permitted.' })
  }

  const b = req.body || {}
  const text = String(b.text || '').trim().slice(0, 640)
  if (!text) return res.status(400).json({ success: false, error: 'Nothing to send.' })

  try {
    const who = await customerPhone(b.customerId)
    if (!who) return res.status(400).json({ success: false, error: 'Customer not found.' })
    if (!who.phone) {
      return res.status(400).json({ success: false, error: `No mobile number on file for ${who.name || 'this customer'}.` })
    }

    const r = await sendSms({ to: who.phone, body: text, customerId: who.id })
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
