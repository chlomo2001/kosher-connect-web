// On-demand email receipts (staff-triggered).
//
//   POST { kind:'sale',    customerId, lines:[{name,qty,total}], total, method, paidNow }
//   POST { kind:'payment', customerId, amount, method, note, balance }
//
// The recipient is ALWAYS resolved server-side from the customer on file —
// the client never supplies a destination address, so a receipt can only
// ever go to the address KosherConnect already holds for that customer.
// Returns 400 when the customer has no email on file, and 503 when SMTP
// isn't configured, so the UI can show a precise message.

import { withStaff, tabAllowedFor } from '../../lib/auth.js'
import { db, tablesMode } from '../../lib/db.js'
import { emailEnabled, sendEmail, esc, brandShell } from '../../lib/email.js'

const money = (v) => (Math.round((Number(v) || 0) * 100) / 100)
const gbp = (v) => `£${money(v).toFixed(2)}`
const METHOD_LABEL = {
  cash: 'Cash', card: 'Card', bank_transfer: 'Bank transfer',
  voucher: 'Voucher', other: 'Other',
}

// The branded shell (logo, gold keyline, business footer) lives in lib/email —
// every customer-facing email goes through it so they all read as one house.
const shell = (title, bodyRows, footNote) => brandShell({ title, bodyRows, footNote })

import { isOwnAccountEmail } from '../../lib/ownEmails.mjs'

async function customerEmail(customerId) {
  if (!customerId || customerId === 'walkin') return null
  const rows = await db.select(
    'customers',
    `select=id,first_name,last_name,email_raw,email_normalized&legacy_id=eq.${encodeURIComponent(String(customerId))}`
  )
  const c = rows[0]
  if (!c) return null
  const email = (c.email_raw || c.email_normalized || '').trim()
  return {
    id: c.id,
    email: email || null,
    isAccountEmail: isOwnAccountEmail(email),
    name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
  }
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!tablesMode) {
    return res.status(503).json({ success: false, error: 'Email receipts need the relational data layer.' })
  }
  if (!emailEnabled) {
    return res.status(503).json({
      success: false,
      error: 'Email isn’t configured yet. Add RESEND_API_KEY + MAIL_FROM (or the SMTP_* trio) to send receipts.',
    })
  }
  if (!(await tabAllowedFor(req.staff, 'wallet'))) {
    return res.status(403).json({ success: false, error: 'Not permitted.' })
  }

  const b = req.body || {}
  try {
    const who = await customerEmail(b.customerId)
    if (!who) return res.status(400).json({ success: false, error: 'Customer not found.' })
    if (!who.email) {
      return res.status(400).json({ success: false, error: `No email on file for ${who.name || 'this customer'}.` })
    }
    if (who.isAccountEmail) {
      return res.status(400).json({
        success: false,
        error: `${who.name || 'This customer'}'s email on file is an account/login address, not a real contact email — receipt not sent.`,
      })
    }

    let subject, html
    const hi = who.name
      ? `<tr><td colspan="2" style="padding:4px 0 14px;color:#334155">Dear ${esc(who.name.split(' ')[0])}, thank you for coming in — here are your details for your records.</td></tr>`
      : `<tr><td colspan="2" style="padding:4px 0 14px;color:#334155">Thank you for coming in — here are your details for your records.</td></tr>`
    const method = b.method ? (METHOD_LABEL[b.method] || b.method) : null

    if (b.kind === 'sale') {
      const lines = Array.isArray(b.lines) ? b.lines : []
      if (!lines.length) return res.status(400).json({ success: false, error: 'Nothing to receipt.' })
      const rowsHtml = lines.map((l) => {
        const qty = Math.max(1, parseInt(l.qty, 10) || 1)
        return `<tr>
          <td style="padding:6px 0;border-bottom:1px solid #eef1f4">${esc(l.name || 'Item')}${qty > 1 ? ` <span style="color:#94a3b8">× ${qty}</span>` : ''}</td>
          <td style="padding:6px 0;border-bottom:1px solid #eef1f4;text-align:right;white-space:nowrap">${gbp(l.total)}</td>
        </tr>`
      }).join('')
      const total = money(b.total != null ? b.total : lines.reduce((s, l) => s + money(l.total), 0))
      subject = `Your Kosher Connect receipt — ${gbp(total)}`
      html = shell('Receipt', `
        ${hi}
        ${rowsHtml}
        <tr><td style="padding:12px 0 0;font-weight:700">Total</td>
            <td style="padding:12px 0 0;text-align:right;font-weight:700">${gbp(total)}</td></tr>
        ${method ? `<tr><td style="padding:4px 0;color:#64748b">${b.paidNow ? 'Paid' : 'Payment'}</td><td style="padding:4px 0;text-align:right;color:#64748b">${esc(method)}</td></tr>` : ''}
      `)
    } else if (b.kind === 'payment') {
      const amount = money(b.amount)
      if (!(amount > 0)) return res.status(400).json({ success: false, error: 'Payment amount must be greater than £0.' })
      subject = `Payment received — ${gbp(amount)}`
      html = shell('Payment received — thank you', `
        ${hi}
        <tr><td style="padding:6px 0;border-bottom:1px solid #eef1f4">Amount received</td>
            <td style="padding:6px 0;border-bottom:1px solid #eef1f4;text-align:right;font-weight:700">${gbp(amount)}</td></tr>
        ${method ? `<tr><td style="padding:6px 0;color:#64748b">Method</td><td style="padding:6px 0;text-align:right;color:#64748b">${esc(method)}</td></tr>` : ''}
        ${b.note ? `<tr><td style="padding:6px 0;color:#64748b">Note</td><td style="padding:6px 0;text-align:right;color:#64748b">${esc(b.note)}</td></tr>` : ''}
        ${b.balance != null ? `<tr><td style="padding:10px 0 0;color:#334155">${money(b.balance) < 0 ? 'Balance still owing' : 'Balance / credit'}</td><td style="padding:10px 0 0;text-align:right;color:#334155">${gbp(Math.abs(money(b.balance)))}${money(b.balance) < 0 ? '' : ' in credit'}</td></tr>` : ''}
      `)
    } else {
      return res.status(400).json({ success: false, error: 'Unknown receipt kind.' })
    }

    const r = await sendEmail({ to: who.email, subject, html, kind: b.kind, customerId: who.id })
    if (r.suppressed) {
      return res.status(400).json({
        success: false,
        error: `${who.name || 'This customer'}'s address previously ${r.reason === 'complaint' ? 'marked our mail as spam' : 'bounced'} — send suppressed. Update their email on file first.`,
      })
    }
    if (r.held) {
      return res.json({ success: true, held: true, note: 'Email is on HOLD — the receipt was built but not sent. Set MAIL_LIVE=true when you’re ready to email real customers.' })
    }
    if (r.redirectedTo) {
      return res.json({ success: true, redirected: true, sentTo: r.redirectedTo, note: `Test mode — sent to ${r.redirectedTo} instead of the customer.` })
    }
    return res.json({ success: true, sentTo: r.sentTo || who.email })
  } catch (e) {
    console.error('[api/email]', e)
    // Surface the provider's own reason to staff — "domain is not verified"
    // beats a generic credentials guess. This is a staff-only route and the
    // provider errors carry config hints, not secrets.
    const detail = /^\[(resend|smtp)\] /.test(String(e?.message || '')) ? ` (${String(e.message).slice(0, 200)})` : ''
    return res.status(502).json({ success: false, error: `The email provider rejected the message${detail || ' — check the mail settings'}.` })
  }
}

export default withStaff(handler)
