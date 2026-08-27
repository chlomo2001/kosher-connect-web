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
import { rentalPayBy, rentalPayState, calendarWeeks, freeDayLegend } from '../../lib/rentalReceipt.mjs'
import { hebrewFromGregorian, hebrewNumeral, hebrewMonthName } from '../../lib/hebrewDate.mjs'
import { stripeEnabled, webhookConfigured } from '../../lib/stripe.js'
import { mintPayLink } from '../../lib/payLink.js'
import { guideUrl } from '../../lib/serviceGuides.mjs'
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
  email_sim_subject: 'Your Kosher Connect SIM plan — {number}',
  email_booking_subject: 'Your Kosher Connect flight booking — {route}',
  email_repair_subject: 'Your repair is booked in — {device}',
  email_repair_ready_subject: 'Your {device} is ready to collect',
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

function buildSale(copy, who, b, extras = {}) {
  const lines = Array.isArray(b.lines) ? b.lines : []
  if (!lines.length) return { error: 'Nothing to receipt.' }
  const rowsHtml = lines.map((l) => {
    const qty = Math.max(1, parseInt(l.qty, 10) || 1)
    return `<tr>
      <td style="padding:7px 0;border-bottom:1px solid #eef1f4">${esc(l.name || 'Item')}${qty > 1 ? ` <span style="color:#94a3b8">× ${qty}</span>` : ''}</td>
      <td style="padding:7px 0;border-bottom:1px solid #eef1f4;text-align:right;white-space:nowrap">${gbp(l.total)}</td>
    </tr>`
  }).join('')
  const total = money(b.total != null ? b.total : lines.reduce((s2, l) => s2 + money(l.total), 0))
  // paidNow is the old boolean contract and stays supported: true means the lot
  // was taken. paidAmount, when the caller knows it, says how much — which is
  // what lets a part-paid shop sale carry a button like everything else.
  const paid = b.paidAmount != null ? b.paidAmount : (b.paidNow ? total : 0)
  return {
    subject: fill(copy.email_receipt_subject, {
      total: gbp(total), name: who.name || '', first: (who.name || '').split(' ')[0],
    }),
    html: shell('Your receipt', `
      ${greeting(copy, who)}
      ${factRow('Name', esc(who.name || ''))}
      ${rowsHtml}
      <tr><td style="padding:12px 0 0;font-weight:700">Total</td>
          <td style="padding:12px 0 0;text-align:right;font-weight:700">${gbp(total)}</td></tr>
      ${moneyRows({ total, paidAmount: paid, method: b.method, payBy: extras.payBy,
        payUrl: extras.payUrl, settle: 'You can settle it at the counter', thing: 'this' })}
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
    const why = freeDayLegend(days)
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
  const why = freeDayLegend(days)
  const legend = why
    ? `Shaded days are not charged — ${esc(why)}.`
    : 'Every day in this hire is chargeable.'
  return `<tr><td colspan="2" style="padding:16px 0 0">
    <div style="font-size:11px;color:#94a3b8;padding-bottom:6px" dir="rtl">${esc(hebrewMonthCaption(days))}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed">
      <tr>${head}</tr>${body}
    </table>
    <div style="font-size:12px;color:#64748b;padding-top:8px">${legend}</div>
  </td></tr>`
}

// ── The money paragraph, shared by every kind ───────────────────────────────
//
// Written once because the customer must not have to learn a new way of being
// told what they owe depending on what they bought. Owner, 21 Aug: the other
// receipt kinds "need redoing in the same level than the rest".
//
// Three states, and the middle one is the one the old receipts could not
// express at all: some money taken, a balance left. That is also the one that
// most needs the button — owner, same day: "why when its partly paid there's no
// link to settle rest if he preffers?"
//
// `settle` is the only service-specific part: where they can pay it if they do
// not want to pay online. A rental is settled when the phone comes back; a
// repair when the handset is collected; a booking or a shop sale, at the
// counter.
function moneyRows({ total, paidAmount, method, payBy, payUrl, settle, thing }) {
  const { state, owed } = rentalPayState(total, paidAmount)
  const how = method ? (METHOD_LABEL[method] || method) : null
  const what = thing || 'this'
  if (state === 'paid') {
    return `<tr><td colspan="2" style="padding:10px 0 0;color:#334155">
      Paid in full${how ? ` by ${esc(how)}` : ''} — thank you. Nothing further to pay on ${esc(what)}.</td></tr>`
  }
  // "Received", not "we took". Owner, 27 Aug. The shop did not take anything
  // off anybody — the customer handed it over, and the receipt is the shop
  // acknowledging that, which is a different sentence.
  const took = state === 'part' ? `Received ${gbp(money(paidAmount))}${how ? ` by ${esc(how)}` : ''}, so ` : ''
  // The colon is only earned by a button actually following it.
  const tail = payUrl ? `${settle} — or online now:` : `${settle}.`
  let out = `<tr><td colspan="2" style="padding:10px 0 0;color:#334155">${took}<strong>${gbp(owed)}</strong> is still to pay${payBy ? `, by <strong>${esc(fmtDay(payBy))}</strong>` : ''}. ${tail}</td></tr>`
  if (payUrl) {
    out += `<tr><td colspan="2" style="padding:14px 0 4px">
      <a href="${esc(payUrl)}" style="display:inline-block;background:#0a2540;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:11px 22px;border-radius:8px">Pay ${gbp(owed)} online</a>
    </td></tr>`
  }
  return out
}

// The how-to line. Same shape on every kind, so it reads as the same offer.
function guideRow(url, lead, label, blurb) {
  if (!url) return ''
  return `<tr><td colspan="2" style="padding:14px 0 0;font-size:13px;color:#64748b">
    ${esc(lead)} <a href="${esc(url)}" style="color:#0a2540;font-weight:600">${esc(label)}</a> — ${esc(blurb)}
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

  // The money paragraph is shared with every other kind (moneyRows) — the only
  // service-specific part is where they can settle it if not online. A rental
  // is settled when the phone comes back, and saying so is only honest when the
  // due date IS the return date: a short hire gets the floor instead, so a
  // phone back on the 26th can be payable by the 27th, and a receipt that
  // explains a date by naming a different day is one the customer stops
  // believing. A reserved phone has not been collected at all.
  const dueIsReturn = extras.payBy && b.to && String(extras.payBy) === String(b.to)
  const settle = reservation
    ? 'You can settle it when you collect the phone'
    : dueIsReturn
      ? 'That is the day the phone is due back, so you can settle it at the counter when you bring it in'
      : 'You can settle it at the counter'
  const moneyBlock = moneyRows({
    total, paidAmount: b.paidAmount, method: b.method,
    payBy: extras.payBy, payUrl: extras.payUrl, settle, thing: 'this rental',
  })

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
      ${guideRow(extras.guideUrl, 'New to travelling with one of our phones?',
        'How to use your rented phone', 'getting it working when you land, and what to do if it stops.')}
    `, null, copy.email_closing),
  }
}

function buildPayment(copy, who, b, extras = {}) {
  const amount = money(b.amount)
  if (!(amount > 0)) return { error: 'Payment amount must be greater than £0.' }
  const method = b.method ? (METHOD_LABEL[b.method] || b.method) : null
  // balance is the wallet AFTER this payment: negative means still owing.
  const owing = b.balance != null && money(b.balance) < 0 ? Math.abs(money(b.balance)) : 0
  return {
    subject: fill(copy.email_payment_subject, {
      amount: gbp(amount), name: who.name || '', first: (who.name || '').split(' ')[0],
    }),
    html: shell('Payment received — thank you', `
      ${greeting(copy, who)}
      <tr><td colspan="2" style="padding:0 0 14px;color:#334155">Thank you — this is confirmation that we have received your payment and put it on your account.</td></tr>
      ${factRow('Name', esc(who.name || ''))}
      ${factRow('Amount received', gbp(amount))}
      ${method ? factRow('How you paid', esc(method)) : ''}
      ${b.note ? factRow('For', esc(b.note)) : ''}
      ${b.balance != null ? factRow(owing ? 'Still owing after this' : 'Your balance',
        owing ? gbp(owing) : `${gbp(Math.abs(money(b.balance)))} in credit`) : ''}
      ${owing ? `<tr><td colspan="2" style="padding:10px 0 0;color:#334155">
          There is <strong>${gbp(owing)}</strong> left on your account. No rush — it can wait until you are next in${extras.payUrl ? ', or you can clear it now:' : '.'}</td></tr>
        ${extras.payUrl ? `<tr><td colspan="2" style="padding:14px 0 4px">
          <a href="${esc(extras.payUrl)}" style="display:inline-block;background:#0a2540;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:11px 22px;border-radius:8px">Pay ${gbp(owing)} online</a>
        </td></tr>` : ''}` : ''}
    `, null, copy.email_closing),
  }
}

// ── SIM plan, flight booking, repair ────────────────────────────────────────
//
// Owner, 21 Aug: "make sure there is one for every situation its useful
// throughout the site". Four of the five confirmation cards were emailing
// `kind: 'sale'` — a POS receipt with one line reading "SIM plan 07… · 5GB",
// which tells a customer nothing they did not already know and nothing they
// might need later. Each is a service with its own facts, so each gets them.

function buildSim(copy, who, b, extras = {}) {
  const total = money(b.total)
  return {
    subject: fill(copy.email_sim_subject, {
      number: esc(b.number || ''), name: esc(who.name || ''), first: esc((who.name || '').split(' ')[0]),
    }),
    html: shell('Your SIM plan', `
      ${greeting(copy, who)}
      <tr><td colspan="2" style="padding:0 0 14px;color:#334155">Your plan is set up and ready to use. Keep this email — it has the number and the day the plan renews.</td></tr>
      ${factRow('Name', esc(who.name || ''))}
      ${b.number ? factRow('Your number', `<span dir="ltr">${esc(b.number)}</span>`) : ''}
      ${b.provider ? factRow('Network', esc(b.provider)) : ''}
      ${b.plan ? factRow('Plan', esc(b.plan)) : ''}
      ${b.renewalDate ? factRow('Renews', esc(fmtDay(b.renewalDate))) : ''}
      ${total > 0 ? `<tr><td style="padding:12px 0 0;font-weight:700">Setup</td>
          <td style="padding:12px 0 0;text-align:right;font-weight:700">${gbp(total)}</td></tr>` : ''}
      ${total > 0 ? moneyRows({ total, paidAmount: b.paidAmount, method: b.method, payBy: extras.payBy,
        payUrl: extras.payUrl, settle: 'You can settle it at the counter', thing: 'the setup' }) : ''}
      ${guideRow(extras.guideUrl, 'First plan with us?', 'How your SIM plan works',
        'renewals, what to do when the line stops, and how to sign in to the network.')}
    `, null, copy.email_closing),
  }
}

function buildBooking(copy, who, b, extras = {}) {
  const total = money(b.total)
  return {
    subject: fill(copy.email_booking_subject, {
      route: esc(b.route || 'your flight'), name: esc(who.name || ''), first: esc((who.name || '').split(' ')[0]),
    }),
    html: shell('Your flight booking', `
      ${greeting(copy, who)}
      <tr><td colspan="2" style="padding:0 0 14px;color:#334155">Your flight is booked. Please check the names and dates below against the passports you are travelling on — an airline charges to change a name, and some will not change one at all.</td></tr>
      ${factRow('Booked for', esc(b.passenger || who.name || ''))}
      ${b.route ? factRow('Route', esc(b.route)) : ''}
      ${b.airline ? factRow('Airline', esc(b.airline)) : ''}
      ${b.travelDate ? factRow('Travelling', esc(fmtDay(b.travelDate))) : ''}
      ${b.returnDate ? factRow('Returning', esc(fmtDay(b.returnDate))) : ''}
      ${b.bookingRef ? factRow('Booking reference', `<span dir="ltr">${esc(b.bookingRef)}</span>`) : ''}
      ${total > 0 ? `<tr><td style="padding:12px 0 0;font-weight:700">Total</td>
          <td style="padding:12px 0 0;text-align:right;font-weight:700">${gbp(total)}</td></tr>` : ''}
      ${total > 0 ? moneyRows({ total, paidAmount: b.paidAmount, method: b.method, payBy: extras.payBy,
        payUrl: extras.payUrl, settle: 'You can settle it at the counter', thing: 'this booking' }) : ''}
      ${guideRow(extras.guideUrl, 'Before you travel:', 'What you need at the airport',
        'passports, visas, check-in, and who to ring if the airline changes something.')}
    `, null, copy.email_closing),
  }
}

function buildRepair(copy, who, b, extras = {}) {
  const total = money(b.total)
  const ready = !!b.ready
  return {
    subject: fill(ready ? copy.email_repair_ready_subject : copy.email_repair_subject, {
      device: esc(b.device || 'your phone'), name: esc(who.name || ''), first: esc((who.name || '').split(' ')[0]),
    }),
    html: shell(ready ? 'Your repair is ready' : 'Your repair', `
      ${greeting(copy, who)}
      <tr><td colspan="2" style="padding:0 0 14px;color:#334155">${ready
        ? 'Your phone is repaired and waiting for you. Bring this email or tell us the name it is under.'
        : 'We have booked your phone in. We will ring or message you as soon as it is ready — nothing is charged that you have not agreed to first.'}</td></tr>
      ${factRow('Name', esc(who.name || ''))}
      ${b.device ? factRow('Handset', esc(b.device)) : ''}
      ${b.services ? factRow('Work', esc(b.services)) : ''}
      ${total > 0 ? `<tr><td style="padding:12px 0 0;font-weight:700">${ready ? 'Total' : 'Estimate'}</td>
          <td style="padding:12px 0 0;text-align:right;font-weight:700">${gbp(total)}</td></tr>` : ''}
      ${total > 0 ? moneyRows({ total, paidAmount: b.paidAmount, method: b.method, payBy: extras.payBy,
        payUrl: extras.payUrl, settle: 'You can settle it when you collect the phone', thing: 'this repair' }) : ''}
      ${guideRow(extras.guideUrl, 'What happens next:', 'How a repair works with us',
        'what we do before charging anything, and what the work is covered for.')}
    `, null, copy.email_closing),
  }
}

// What a builder cannot work out for itself: when the money is due (policy,
// from settings), the pay button (Stripe, and optional) and the how-to link.
//
// ONE function for every kind, because the reasons are the same every time.
//
// THE LINK IS BEST-EFFORT AND THE RECEIPT IS NOT. Stripe off, webhook missing,
// minting threw — the receipt still goes, saying "settle it at the counter".
// Failing the whole send because a payment button could not be made would
// withhold the dates, the number and the booking reference, which are the parts
// the customer actually needs.
//
// No link is minted when there is nothing to pay: an idle £0 Checkout session
// is noise in the Stripe dashboard and a button that insults somebody who has
// just paid.
const KIND_SERVICE = { rental: 'rental', sim: 'sim', booking: 'booking', repair: 'repair' }

async function receiptExtras(kind, req, who, b) {
  const base = `https://${req.headers.host}`
  // A LINK, not an attachment (#18). A PDF stapled to a receipt gets stripped
  // by filters and cannot be corrected once it has gone; the page is fixable
  // the day something changes, and every receipt ever sent is right again.
  // Absolute, because a mail client has no base URL to resolve against.
  const guide = guideUrl(KIND_SERVICE[kind] || '', base)
  // Only a rental has a return date to hang a deadline on. Everything else is
  // owed now, and says so without naming a day it cannot justify.
  const payBy = kind === 'rental'
    ? rentalPayBy(b.to, londonDate(), await rentalPayFloor())
    : null

  const total = kind === 'payment'
    ? (b.balance != null && money(b.balance) < 0 ? Math.abs(money(b.balance)) : 0)
    : money(b.total)
  const paid = kind === 'payment' ? 0
    : (b.paidAmount != null ? b.paidAmount : (b.paidNow ? total : 0))
  const { state, owed } = rentalPayState(total, paid)
  if (state === 'paid' || !(owed > 0)) return { payBy: null, guideUrl: guide }
  // Same refusal as payment-link.js: without the webhook a paid link captures
  // money that never reaches the wallet.
  if (!stripeEnabled || !webhookConfigured) return { payBy, guideUrl: guide }
  try {
    const rows = await db.select('customers',
      `select=id,stripe_customer_id,email_raw,email_normalized,first_name,last_name&id=eq.${who.id}`)
    const c = rows[0]
    if (!c) return { payBy, guideUrl: guide }
    // Keyed on the thing being paid for, so re-sending the same receipt reuses
    // one Checkout session instead of minting a new one each time — Stripe's
    // idempotency key is this reference. `ref` is what makes it stable, so a
    // caller that can identify its job should pass one.
    const stem = b.ref || (kind === 'rental' ? `${b.from || ''}-${b.to || ''}` : String(owed))
    const reference = `PAY-${kind.toUpperCase()}-${c.id}-${stem}`.replace(/[^\w-]/g, '')
    const session = await mintPayLink(c, {
      amount: owed,
      description: receiptPayDescription(kind, b),
      reference,
      base,
    })
    return { payBy, payUrl: session?.url || null, guideUrl: guide }
  } catch (e) {
    console.warn('[api/email] pay link not minted:', kind, String(e?.message || e).slice(0, 200))
    return { payBy, guideUrl: guide }
  }
}

// What the customer sees on the Stripe page, so a card statement makes sense.
function receiptPayDescription(kind, b) {
  if (kind === 'rental') return `Phone rental ${b.number || ''} ${b.from || ''} to ${b.to || ''}`.trim()
  if (kind === 'sim') return `SIM plan ${b.number || ''}`.trim()
  if (kind === 'booking') return `Flight ${b.route || ''} ${b.bookingRef ? `(${b.bookingRef})` : ''}`.trim()
  if (kind === 'repair') return `Repair — ${b.device || 'phone'}`
  if (kind === 'payment') return 'Kosher Connect — account balance'
  return 'Kosher Connect'
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
      const X = { payBy: '2026-08-27', payUrl: 'https://checkout.stripe.com/preview', guideUrl: '/help/phone-rental' }
      const SAMPLES = {
        payment: () => buildPayment(copy, sample, { amount: 45, method: 'card', note: 'Rental balance', balance: -20 },
          { payUrl: X.payUrl }),
        rental: () => buildRental(copy, sample, {
          number: '+1 518 555 0101', from: '2026-08-20', to: '2026-08-27',
          days: 6, total: 35, method: 'cash', paidAmount: 10,
          dayList: ['20', '21', '22', '23', '24', '25', '26', '27'].map((d) => ({
            iso: `2026-08-${d}`, free: d === '22', reason: d === '22' ? 'Shabbos' : '',
          })),
        }, X),
        sim: () => buildSim(copy, sample, {
          number: '07349 969084', provider: 'Lebara', plan: '5GB Monthly',
          renewalDate: '2026-09-19', total: 20, paidAmount: 0,
        }, { ...X, payBy: null, guideUrl: '/help/sim-plan' }),
        booking: () => buildBooking(copy, sample, {
          route: 'MAN–TLV', airline: 'Eurowings', travelDate: '2026-11-12',
          bookingRef: '8DGFF9', total: 410, paidAmount: 200, method: 'bank_transfer',
        }, { ...X, payBy: null, guideUrl: '/help/flight-booking' }),
        repair: () => buildRepair(copy, sample, {
          device: 'iPhone 12', services: 'Screen replacement', total: 45, paidAmount: 0,
        }, { ...X, payBy: null, guideUrl: '/help/repair' }),
        sale: () => buildSale(copy, sample, {
          lines: [
            { name: 'Screen protector', qty: 2, total: 12 },
            { name: 'USB-C cable', qty: 1, total: 8 },
          ],
          total: 20, method: 'cash', paidNow: true,
        }, X),
      }
      const make = SAMPLES[b.kind] || SAMPLES.sale
      const built = make()
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

    // One table, so a new kind is one row rather than another `? :` in a chain
    // nobody can read. Every kind gets the same extras — the due date, the pay
    // button and the how-to link — worked out the same way.
    const BUILDERS = {
      sale: buildSale, payment: buildPayment, rental: buildRental,
      sim: buildSim, booking: buildBooking, repair: buildRepair,
    }
    const build = BUILDERS[b.kind] || null
    const built = build ? build(copy, who, b, await receiptExtras(b.kind, req, who, b)) : null
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
