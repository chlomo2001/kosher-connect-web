// On-demand email receipts (staff-triggered).
//
//   POST { kind:'sale',    customerId, lines:[{name,qty,total}], total, method, paidNow }
//   POST { kind:'payment', customerId, amount, method, note, balance }
//   POST { kind:'rental',  customerId, number, from, to, days, total, method,
//                          paidAmount, reservation }
//
// The recipient is ALWAYS resolved server-side from the customer on file —
// the client never supplies a destination address, so a receipt can only
// ever go to the address KosherConnect already holds for that customer.
// Returns 400 when the customer has no email on file, and 503 when SMTP
// isn't configured, so the UI can show a precise message.

import { withStaff, tabAllowedFor } from '../../lib/auth.js'
import { db, tablesMode } from '../../lib/db.js'
import { emailEnabled, sendEmail, esc, brandShell } from '../../lib/email.js'
import { rentalPayBy, rentalPayState, calendarWeeks } from '../../lib/rentalReceipt.mjs'
import { hebrewFromGregorian, hebrewNumeral, hebrewMonthName } from '../../lib/hebrewDate.mjs'
import { stripeEnabled, webhookConfigured } from '../../lib/stripe.js'
import { mintPayLink } from '../../lib/payLink.js'
import { londonDate } from '../../lib/localDay.mjs'

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
  email_rental_subject: 'Your Kosher Connect phone rental — {from} to {to}',
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
// How many days' grace a rental receipt gives at minimum. The due date itself
// is the RETURN date (lib/rentalReceipt.mjs) — this is only the floor, so a
// two-day rental does not demand payment the day after tomorrow.
async function rentalPayFloor() {
  try {
    const rows = await db.select('settings', 'select=num_value&key=eq.rental_pay_days')
    const v = Number(rows?.[0]?.num_value)
    if (Number.isFinite(v) && v >= 0) return v
  } catch { /* fall through */ }
  return 7
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

// ── The rental receipt ──────────────────────────────────────────────────────
//
// A rental is not a shop sale. `kind: 'sale'` takes POS lines — name, qty,
// total — and a rental is a service with a number, a start, an end and a
// return; cramming those into one line's description is how the old receipt
// came to say "Phone rental 07… · 20 Aug 2026 → 26 Aug 2026 £20" and nothing
// else. Owner, 20 Aug: full name, longer language, the number they rented, the
// dates each on its own line, how they paid or by when they must, and a link.
//
// `extras` carries what the handler worked out and a builder may not: the
// pay-by date (policy, from settings) and the pay link (Stripe, and optional).

const fmtDay = (iso) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return ''
  const [y, m, d] = String(iso).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB',
    { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

const fmtShortDay = (iso) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return ''
  const [y, m, d] = String(iso).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB',
    { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

const factRow = (label, value) => `<tr>
  <td style="padding:7px 0;border-bottom:1px solid #eef1f4;color:#64748b;white-space:nowrap">${esc(label)}</td>
  <td style="padding:7px 0;border-bottom:1px solid #eef1f4;text-align:right;font-weight:600">${value}</td>
</tr>`

// The rental window as a calendar, with the Hebrew date small under each day.
//
// It exists to explain the price. "Chargeable days 6" over a seven-day window
// is a number the customer cannot check; shaded Shabbos and Yom Tov cells are
// the same fact, shown. The Hebrew date is what makes it self-explanatory to
// this readership — the free days ARE Hebrew-calendar days.
//
// Table-based with inline styles, like the rest of the shell: it is the only
// layout language every mail client still respects. Nothing here is clickable
// and nothing depends on CSS a client might strip.
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Shabbos']

function hebrewDayNumeral(iso) {
  const [y, m, d] = String(iso).split('-').map(Number)
  return hebrewNumeral(hebrewFromGregorian(y, m, d).day)
}

// Which Hebrew month(s) the window falls in, named once above the grid rather
// than repeated in thirty cells.
function hebrewMonthCaption(days) {
  const seen = new Map()
  for (const d of days) {
    const [y, m, dd] = String(d.iso).split('-').map(Number)
    const h = hebrewFromGregorian(y, m, dd)
    const key = `${h.year}-${h.month}`
    if (!seen.has(key)) seen.set(key, `${hebrewMonthName(h.year, h.month, 'he')} ${hebrewNumeral(h.year % 1000)}`)
  }
  return [...seen.values()].join(' · ')
}

function rentalCalendar(days) {
  const weeks = calendarWeeks(days)
  // A long hire would be thirteen rows of table in somebody's inbox. The FACT
  // still has to be told — it is the reason the count is lower than the number
  // of nights — so a window too long to draw says it in a sentence instead of
  // silently dropping the explanation, which is what an early version did.
  if (!weeks.length) {
    const free = (days || []).filter((d) => d && d.free)
    if (!free.length) return ''
    const why = [...new Set(free.map((d) => d.reason).filter(Boolean))].join(' and ')
    return `<tr><td colspan="2" style="padding:12px 0 0;font-size:12px;color:#64748b">
      ${free.length} day${free.length === 1 ? '' : 's'} in this hire ${free.length === 1 ? 'is' : 'are'} not charged${why ? ` — ${esc(why)}` : ''}.</td></tr>`
  }
  const head = DOW.map((n) => `<th style="padding:4px 0;font-size:11px;font-weight:600;color:#94a3b8;text-align:center;width:14.28%">${esc(n)}</th>`).join('')
  const body = weeks.map((w) => `<tr>${w.map((c) => {
    if (!c) return '<td style="padding:2px"></td>'
    const bg = c.free ? 'background:#f4efe7;border:1px solid #e4d6c2;' : 'background:#ffffff;border:1px solid #eef1f4;'
    const ink = c.free ? '#8a6a3f' : '#1f2430'
    return `<td style="padding:2px" align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${bg}border-radius:6px">
        <tr><td align="center" style="padding:5px 0 1px;font-size:14px;font-weight:600;color:${ink};line-height:1.1">${c.day}</td></tr>
        <tr><td align="center" style="padding:0 0 5px;font-size:10px;color:${c.free ? '#a98b62' : '#94a3b8'};line-height:1.1" dir="rtl">${esc(hebrewDayNumeral(c.iso))}</td></tr>
      </table></td>`
  }).join('')}</tr>`).join('')
  const named = days.filter((d) => d.free)
  const legend = named.length
    ? `Shaded days are not charged — ${esc([...new Set(named.map((d) => d.reason).filter(Boolean))].join(', '))}.`
    : 'Every day in this hire is chargeable.'
  return `<tr><td colspan="2" style="padding:16px 0 0">
    <div style="font-size:11px;color:#94a3b8;padding-bottom:6px" dir="rtl">${esc(hebrewMonthCaption(days))}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed">
      <tr>${head}</tr>${body}
    </table>
    <div style="font-size:12px;color:#64748b;padding-top:8px">${legend}</div>
  </td></tr>`
}

function buildRental(copy, who, b, extras = {}) {
  const total = money(b.total)
  const { state, owed } = rentalPayState(total, b.paidAmount)
  const method = b.method ? (METHOD_LABEL[b.method] || b.method) : null
  const number = String(b.number || '').trim()
  const reservation = !!b.reservation
  const payBy = extras.payBy || null
  const payUrl = extras.payUrl || null

  // The prose. The customer is about to go abroad with the shop's phone and
  // this email is what they will scroll back to at the airport, so it says
  // what they have and what happens next in sentences rather than in a table.
  // NOT a second "here is…". The greeting above already says "here are your
  // details for your records" (it is the owner's wording, in Settings, shared
  // with every receipt), so opening this line the same way read as a stutter:
  // "…here are your details for your records. Here is your phone rental in
  // full." Owner, 20 Aug: "wording a bit awkward". This sentence earns its
  // place by saying what to DO with the email, not by announcing itself again.
  const said = reservation
    ? `Your phone is reserved and waiting for you — please collect it before you travel.`
    : `Keep this email safe: it has the number you are travelling with and the day the phone is due back.`

  const rows = [
    factRow('Name', esc(who.name || '')),
    number ? factRow('Number you are renting', `<span dir="ltr">${esc(number)}</span>`) : '',
    factRow('From', esc(fmtDay(b.from))),
    factRow('To', esc(fmtDay(b.to))),
    b.days ? factRow('Chargeable days', esc(String(b.days))) : '',
    `<tr><td style="padding:12px 0 0;font-weight:700">Total</td>
        <td style="padding:12px 0 0;text-align:right;font-weight:700">${gbp(total)}</td></tr>`,
  ].join('')

  // The money paragraph — the half that did not exist. On account, the old
  // receipt said nothing at all: no balance, no date, no way to pay.
  let moneyBlock
  if (state === 'paid') {
    // "on this rental", NOT "there is nothing further to pay". The total here
    // is the RENTAL's price; it is not the customer's balance. Owner-defined
    // extras (applyExtraCharges → /api/custom-charges) post to the same wallet
    // moments after this receipt is built and are NOT in this figure — the
    // done-panel toast says "Incl. …" about them and the email never did. No
    // rental extra is configured today (custom_charges is empty), so nothing
    // has gone out wrong; the sentence was one settings row away from being a
    // lie, and an absolute claim about somebody's account is not the place to
    // rely on a table staying empty. Putting the extras INTO the total is the
    // real fix and it changes what a customer is billed-as-shown, so it is
    // owner-held — see docs/claims-audit.md.
    moneyBlock = `<tr><td colspan="2" style="padding:10px 0 0;color:#334155">
      Paid in full${method ? ` by ${esc(method)}` : ''} — thank you. Nothing further to pay on this rental.</td></tr>`
  } else {
    const took = state === 'part'
      ? `We took ${gbp(money(b.paidAmount))}${method ? ` by ${esc(method)}` : ''}, so `
      : ''
    // "That is the day the phone is due back" is only TRUE when the due date
    // IS the return date. It is not always: a short rental gets the floor
    // instead (rental_pay_days), so a phone back on the 26th can be payable by
    // the 27th — and a receipt that explains a date by naming a different day
    // is a receipt the customer stops believing. Rendered once and read, which
    // is how this was caught; no regex over the template would have seen it.
    const dueIsReturn = payBy && b.to && String(payBy) === String(b.to)
    // Where they can pay. Three things have to agree with reality here, and
    // rendering the five states side by side is what caught all three:
    //   • a reservation's phone has not been collected yet, so "when you bring
    //     it in" is the wrong end of the story;
    //   • the counter sentence must not promise "or online now:" and then be
    //     followed by nothing when Stripe is off — a dangling colon;
    //   • see dueIsReturn above.
    const counter = reservation
      ? 'You can settle it when you collect the phone'
      : dueIsReturn
        ? 'That is the day the phone is due back, so you can settle it at the counter when you bring it in'
        : 'You can settle it at the counter'
    const how = payUrl ? `${counter} — or online now:` : `${counter}.`
    moneyBlock = `<tr><td colspan="2" style="padding:10px 0 0;color:#334155">${took}<strong>${gbp(owed)}</strong> is still to pay${payBy ? `, by <strong>${esc(fmtDay(payBy))}</strong>` : ''}. ${how}</td></tr>`
    if (payUrl) {
      moneyBlock += `<tr><td colspan="2" style="padding:14px 0 4px">
        <a href="${esc(payUrl)}" style="display:inline-block;background:#0a2540;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:11px 22px;border-radius:8px">Pay ${gbp(owed)} online</a>
      </td></tr>`
    }
  }

  return {
    // SHORT dates in the subject, long ones in the body. "Thu, 20 August 2026
    // to Wed, 26 August 2026" is 45 characters of subject line that every
    // phone truncates before it reaches the word "rental".
    subject: fill(copy.email_rental_subject, {
      from: esc(fmtShortDay(b.from)), to: esc(fmtShortDay(b.to)),
      name: esc(who.name || ''), first: esc((who.name || '').split(' ')[0]),
      total: gbp(total),
    }),
    html: shell(reservation ? 'Your phone is reserved' : 'Your phone rental', `
      ${greeting(copy, who)}
      <tr><td colspan="2" style="padding:0 0 14px;color:#334155">${esc(said)}</td></tr>
      ${rows}
      ${rentalCalendar(Array.isArray(b.dayList) ? b.dayList : [])}
      ${moneyBlock}
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

// The two things buildRental cannot work out for itself: when the money is due
// (policy, from settings) and the pay button (Stripe, and optional).
//
// THE LINK IS BEST-EFFORT AND THE RECEIPT IS NOT. If Stripe is off, or the
// webhook is not configured, or minting throws, the receipt still goes — it
// just says "settle it at the counter" instead of carrying a button. Failing
// the whole send because a payment button could not be made would withhold the
// dates and the number, which are the parts the customer actually needs.
//
// No link is minted when there is nothing to pay: an idle Checkout session for
// £0 is noise in the Stripe dashboard and a button that insults the customer
// who has just paid.
async function rentalExtras(req, who, b) {
  const payBy = rentalPayBy(b.to, londonDate(), await rentalPayFloor())
  const { state, owed } = rentalPayState(b.total, b.paidAmount)
  if (state === 'paid' || !(owed > 0)) return { payBy: null }
  // Same refusal as payment-link.js: without the webhook a paid link captures
  // money that never reaches the wallet.
  if (!stripeEnabled || !webhookConfigured) return { payBy }
  try {
    const rows = await db.select('customers',
      `select=id,stripe_customer_id,email_raw,email_normalized,first_name,last_name&id=eq.${who.id}`)
    const c = rows[0]
    if (!c) return { payBy }
    // Keyed on the rental's own dates and the customer, so re-sending the same
    // receipt reuses one Checkout session instead of minting a new one each
    // time — Stripe's idempotency key is this reference.
    const ref = `RENTAL-PAY-${c.id}-${String(b.from || '')}-${String(b.to || '')}`.replace(/[^\w-]/g, '')
    const session = await mintPayLink(c, {
      amount: owed,
      description: `Phone rental ${b.number || ''} ${b.from || ''} to ${b.to || ''}`.trim(),
      reference: ref,
      base: `https://${req.headers.host}`,
    })
    return { payBy, payUrl: session?.url || null }
  } catch (e) {
    console.warn('[api/email] rental pay link not minted:', String(e?.message || e).slice(0, 200))
    return { payBy }
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
        : b.kind === 'rental'
        ? buildRental(copy, sample, {
            number: '+1 518 555 0101', from: '2026-08-20', to: '2026-08-27',
            days: 6, total: 35, method: 'cash', paidAmount: 10,
            dayList: ['20', '21', '22', '23', '24', '25', '26', '27'].map((d) => ({
              iso: `2026-08-${d}`, free: d === '22', reason: d === '22' ? 'Shabbos' : '',
            })),
          }, { payBy: '2026-08-27', payUrl: 'https://checkout.stripe.com/preview' })
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
      : b.kind === 'rental' ? buildRental(copy, who, b, await rentalExtras(req, who, b))
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
