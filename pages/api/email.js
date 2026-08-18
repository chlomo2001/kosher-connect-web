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
const shell = (title, bodyRows, footNote, closing) => brandShell({ title, bodyRows, footNote, closing })

// ── The wording, from Settings ───────────────────────────────────────────
// Subjects and the greeting/closing used to be literals here, so changing a
// comma was a deploy. They live in the settings table now (seeded by
// 20260813120000_email_copy_settings.sql) and these stay as the fallback: a
// missing row, an empty value or a database that never answered must never
// produce a receipt with a hole where the greeting was.
const COPY_FALLBACK = {
  email_receipt_subject: 'Your Kosher Connect receipt — {total}',
  email_payment_subject: 'Payment received — {amount}',
  email_greeting: 'Dear {first}, thank you for coming in — here are your details for your records.',
  email_closing: 'Thank you for choosing Kosher Connect. If anything on this receipt looks wrong, call us on 0161 531 1386 and we’ll put it right.',
}
export async function emailCopy() {
  const out = { ...COPY_FALLBACK }
  try {
    const keys = Object.keys(COPY_FALLBACK).join(',')
    const rows = await db.select('settings', `select=key,text_value&key=in.(${keys})`)
    for (const r of rows || []) {
      const v = (r.text_value || '').trim()
      if (v) out[r.key] = v
    }
  } catch { /* fallbacks stand */ }
  return out
}
// Placeholders are filled AFTER escaping the values, and the template itself is
// escaped where it lands in HTML — so neither a customer's name nor the owner's
// wording can inject markup into a receipt.
const fill = (tpl, vars) =>
  String(tpl).replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined ? m : vars[k]))

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

// Both emails, built from the settings copy. Shared by the send path and by
// the preview so the two can never disagree about what a receipt looks like.
function greeting(copy, who) {
  const first = (who.name || '').split(' ')[0]
  const line = fill(copy.email_greeting, {
    first: esc(first || 'there'),
    name: esc(who.name || ''),
  })
  return `<tr><td colspan="2" style="padding:4px 0 14px;color:#334155">${line}</td></tr>`
}

function buildSale(copy, who, b) {
  const lines = Array.isArray(b.lines) ? b.lines : []
  if (!lines.length) return { error: 'Nothing to receipt.' }
  const rowsHtml = lines.map((l) => {
    const qty = Math.max(1, parseInt(l.qty, 10) || 1)
    return `<tr>
      <td style="padding:6px 0;border-bottom:1px solid #eef1f4">${esc(l.name || 'Item')}${qty > 1 ? ` <span style="color:#94a3b8">× ${qty}</span>` : ''}</td>
      <td style="padding:6px 0;border-bottom:1px solid #eef1f4;text-align:right;white-space:nowrap">${gbp(l.total)}</td>
    </tr>`
  }).join('')
  const total = money(b.total != null ? b.total : lines.reduce((s, l) => s + money(l.total), 0))
  const method = b.method ? (METHOD_LABEL[b.method] || b.method) : null
  return {
    subject: fill(copy.email_receipt_subject, {
      total: gbp(total), name: who.name || '', first: (who.name || '').split(' ')[0],
    }),
    html: shell('Receipt', `
      ${greeting(copy, who)}
      ${rowsHtml}
      <tr><td style="padding:12px 0 0;font-weight:700">Total</td>
          <td style="padding:12px 0 0;text-align:right;font-weight:700">${gbp(total)}</td></tr>
      ${method ? `<tr><td style="padding:4px 0;color:#64748b">${b.paidNow ? 'Paid' : 'Payment'}</td><td style="padding:4px 0;text-align:right;color:#64748b">${esc(method)}</td></tr>` : ''}
    `, null, copy.email_closing),
  }
}

function buildPayment(copy, who, b) {
  const amount = money(b.amount)
  if (!(amount > 0)) return { error: 'Payment amount must be greater than £0.' }
  const method = b.method ? (METHOD_LABEL[b.method] || b.method) : null
  return {
    subject: fill(copy.email_payment_subject, {
      amount: gbp(amount), name: who.name || '', first: (who.name || '').split(' ')[0],
    }),
    html: shell('Payment received — thank you', `
      ${greeting(copy, who)}
      <tr><td style="padding:6px 0;border-bottom:1px solid #eef1f4">Amount received</td>
          <td style="padding:6px 0;border-bottom:1px solid #eef1f4;text-align:right;font-weight:700">${gbp(amount)}</td></tr>
      ${method ? `<tr><td style="padding:6px 0;color:#64748b">Method</td><td style="padding:6px 0;text-align:right;color:#64748b">${esc(method)}</td></tr>` : ''}
      ${b.note ? `<tr><td style="padding:6px 0;color:#64748b">Note</td><td style="padding:6px 0;text-align:right;color:#64748b">${esc(b.note)}</td></tr>` : ''}
      ${b.balance != null ? `<tr><td style="padding:10px 0 0;color:#334155">${money(b.balance) < 0 ? 'Balance still owing' : 'Balance / credit'}</td><td style="padding:10px 0 0;text-align:right;color:#334155">${gbp(Math.abs(money(b.balance)))}${money(b.balance) < 0 ? '' : ' in credit'}</td></tr>` : ''}
    `, null, copy.email_closing),
  }
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!tablesMode) {
    return res.status(503).json({ success: false, error: 'Email receipts need the relational data layer.' })
  }
  // A preview neither sends nor reads a customer, so it does not need a mail
  // provider — you must be able to see what the wording looks like while
  // editing it, whatever state the gate is in.
  if (!emailEnabled && !(req.body && req.body.preview)) {
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
    const copy = await emailCopy()

    // Preview: build exactly what would be sent, with a sample customer, and
    // return it instead of sending. The Settings preview is therefore the real
    // email — not a second rendering that can drift away from this one.
    if (b.preview) {
      const sample = { name: 'Menachem Adler', first: 'Menachem' }
      const built = b.kind === 'payment'
        ? buildPayment(copy, sample, { amount: 45, method: 'card', note: 'Rental balance', balance: -20 })
        : buildSale(copy, sample, {
            lines: [
              { name: 'Phone rental +1 518 555 0101 · 20 Aug 2026 → 27 Aug 2026', qty: 1, total: 35 },
              { name: 'Virtual number — weekly', qty: 1, total: 7 },
            ],
            total: 42, method: 'cash', paidNow: true,
          })
      if (!built) return res.status(400).json({ success: false, error: 'Unknown receipt kind.' })
      return res.json({ success: true, preview: true, subject: built.subject, html: built.html })
    }

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

    const built = b.kind === 'payment'
      ? buildPayment(copy, who, b)
      : b.kind === 'sale' ? buildSale(copy, who, b) : null
    if (!built) return res.status(400).json({ success: false, error: built === null && b.kind ? 'Unknown receipt kind.' : 'Unknown receipt kind.' })
    if (built.error) return res.status(400).json({ success: false, error: built.error })
    const { subject, html } = built

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
