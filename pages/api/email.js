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
import { emailEnabled, sendEmail, esc } from '../../lib/email.js'

const money = (v) => (Math.round((Number(v) || 0) * 100) / 100)
const gbp = (v) => `£${money(v).toFixed(2)}`
const METHOD_LABEL = {
  cash: 'Cash', card: 'Card', bank_transfer: 'Bank transfer',
  voucher: 'Voucher', other: 'Other',
}

function shell(title, bodyRows, footNote) {
  return `<!doctype html><html><body style="margin:0;background:#f4f5f7;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2430">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
      <tr><td style="background:#0f172a;color:#fff;padding:20px 28px;font-size:18px;font-weight:600">KosherConnect</td></tr>
      <tr><td style="padding:24px 28px 8px;font-size:15px;color:#64748b">${esc(title)}</td></tr>
      <tr><td style="padding:0 28px 8px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${bodyRows}</table>
      </td></tr>
      <tr><td style="padding:16px 28px 26px;font-size:12px;color:#94a3b8;line-height:1.5">${footNote || ''}
        This is a courtesy receipt from KosherConnect. Please keep it for your records.</td></tr>
    </table>
  </td></tr></table></body></html>`
}

async function customerEmail(customerId) {
  if (!customerId || customerId === 'walkin') return null
  const rows = await db.select(
    'customers',
    `select=first_name,last_name,email_raw,email_normalized&legacy_id=eq.${encodeURIComponent(String(customerId))}`
  )
  const c = rows[0]
  if (!c) return null
  const email = (c.email_raw || c.email_normalized || '').trim()
  return {
    email: email || null,
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
      error: 'Email isn’t configured yet. Add SMTP_HOST, SMTP_USER and SMTP_PASS to send receipts.',
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

    let subject, html
    const hi = who.name ? `<tr><td style="padding:2px 0 12px;color:#334155">Hi ${esc(who.name.split(' ')[0])},</td></tr>` : ''
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
      subject = `Your KosherConnect receipt — ${gbp(total)}`
      html = shell('Receipt for your purchase', `
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
      html = shell('Payment received, thank you', `
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

    await sendEmail({ to: who.email, subject, html })
    return res.json({ success: true, sentTo: who.email })
  } catch (e) {
    console.error('[api/email]', e)
    return res.status(502).json({ success: false, error: 'The email server rejected the message. Check the SMTP credentials.' })
  }
}

export default withStaff(handler)
