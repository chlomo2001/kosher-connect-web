// The rental receipt — issue #17.
//
// Owner, 20 Aug, on what Mordche Luftig would have got for a US phone: "it
// should of been written their full name, longer language, sim number (i mean
// the phone number they rented), exact dates 'from' and 'to', if he paid; how
// they paid, if not, please pay till (7 days? or the due date of phone
// return?), and a generated link to pay."
//
// What it sent was one POS line — "Phone rental 07… · 20 Aug → 26 Aug" — and a
// total. Left on account it said nothing about owing anything at all.
import test from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { rentalPayBy, rentalPayState, calendarWeeks, freeDayLegend } from '../lib/rentalReceipt.mjs'

const ROOT = path.join(import.meta.dirname, '..')
const API = readFileSync(path.join(ROOT, 'pages/api/email.js'), 'utf8')
const SRC = readFileSync(path.join(ROOT, 'public/main.js'), 'utf8')

// ── when the money is due ──────────────────────────────────────────────────

test('the due date is the day the phone comes back', () => {
  // A three-week rental: they pay when they return it, not in a week.
  assert.equal(rentalPayBy('2026-09-10', '2026-08-20', 7), '2026-09-10')
})

test('a short rental still gets the floor', () => {
  // Back on Sunday, but nobody is asked for money in two days.
  assert.equal(rentalPayBy('2026-08-22', '2026-08-20', 7), '2026-08-27')
  // Exactly on the floor: the return date wins ties by being no earlier.
  assert.equal(rentalPayBy('2026-08-27', '2026-08-20', 7), '2026-08-27')
})

test('the floor is a setting, not a constant', () => {
  assert.equal(rentalPayBy('2026-08-21', '2026-08-20', 14), '2026-09-03')
  assert.equal(rentalPayBy('2026-08-21', '2026-08-20', 0), '2026-08-21')
  // Nonsense is clamped rather than trusted — a negative floor would put the
  // due date in the past and a huge one would give a year's credit.
  assert.equal(rentalPayBy('2026-08-21', '2026-08-20', -5), '2026-08-21')
  assert.equal(rentalPayBy('2026-08-21', '2026-08-20', 9999), rentalPayBy('2026-08-21', '2026-08-20', 90))
})

test('it crosses month and year ends by UTC, not by a local clock', () => {
  assert.equal(rentalPayBy('', '2026-08-28', 7), '2026-09-04')
  assert.equal(rentalPayBy('', '2026-12-28', 7), '2027-01-04')
  // A leap day is a real day.
  assert.equal(rentalPayBy('', '2028-02-26', 7), '2028-03-04')
})

test('no usable today means no date rather than a wrong one', () => {
  assert.equal(rentalPayBy('2026-08-26', '', 7), null)
  assert.equal(rentalPayBy('2026-08-26', 'tomorrow', 7), null)
  // A missing return date falls back to the floor — the rental is real either way.
  assert.equal(rentalPayBy('', '2026-08-20', 7), '2026-08-27')
  assert.equal(rentalPayBy(null, '2026-08-20', 7), '2026-08-27')
})

// ── what is still owed ─────────────────────────────────────────────────────

test('paid, part-paid and unpaid are three different receipts', () => {
  assert.deepEqual(rentalPayState(20, 20), { state: 'paid', owed: 0 })
  assert.deepEqual(rentalPayState(20, 25), { state: 'paid', owed: 0 })
  assert.deepEqual(rentalPayState(140, 60), { state: 'part', owed: 80 })
  assert.deepEqual(rentalPayState(20, 0), { state: 'unpaid', owed: 20 })
  assert.deepEqual(rentalPayState(20, null), { state: 'unpaid', owed: 20 })
})

test('the balance is money, not floating-point noise', () => {
  assert.equal(rentalPayState(35.1, 10.05).owed, 25.05)
  assert.equal(rentalPayState(0.3, 0.1).owed, 0.2)
})

test('a free rental owes nothing and is not chased', () => {
  assert.deepEqual(rentalPayState(0, 0), { state: 'paid', owed: 0 })
  // A negative "payment" cannot manufacture a debt.
  assert.deepEqual(rentalPayState(20, -50), { state: 'unpaid', owed: 20 })
})

// ── what the email actually carries ────────────────────────────────────────

const builder = API.slice(API.indexOf('function buildRental(copy, who, b, extras'))
const body = builder.slice(0, builder.indexOf('\n}\n'))
// The money paragraph is shared with every other receipt kind now, so the
// assertions about HOW money is worded read it there.
const mr = API.slice(API.indexOf('function moneyRows({'))
const money = mr.slice(0, mr.indexOf('\n}\n'))

test('every fact the owner asked for has its own line', () => {
  assert.match(body, /factRow\('Name'/)
  assert.match(body, /factRow\('Number you are renting'/)
  assert.match(body, /factRow\('From'/)
  assert.match(body, /factRow\('To'/)
  assert.match(body, /factRow\('Chargeable days'/)
})

test('the full name, not the first name', () => {
  // {name} is what the subject and the Name row use; {first} is the greeting's
  // business and comes from the settings copy.
  assert.match(body, /factRow\('Name', esc\(who\.name \|\| ''\)\)/)
})

test('anything owed says the amount, the date and how to pay', () => {
  assert.match(money, /is still to pay/)
  assert.match(money, /gbp\(owed\)/)
  assert.match(money, /payBy \? `, by/, 'the due date belongs in the sentence, not a footnote')
  assert.match(money, /Pay \$\{gbp\(owed\)\} online/)
  // The settled case must not chase them, and must not claim their whole
  // account is clear — the total here is one job's price, not their balance.
  const paid = money.slice(money.indexOf("if (state === 'paid')"), money.indexOf('const took'))
  assert.match(paid, /Nothing further to pay on \$\{esc\(what\)\}/)
  assert.doesNotMatch(paid, /still to pay/)
})

test('how they paid is said, and a part payment says how much', () => {
  assert.match(money, /Paid in full\$\{how \? ` by \$\{esc\(how\)\}`/)
  assert.match(money, /state === 'part'[\s\S]{0,120}?Received \$\{gbp\(money\(paidAmount\)\)\}/)
})

// The owner's question, 21 Aug: "why when its partly paid there's no link to
// settle rest if he preffers?" It always could — the demo I showed him had the
// link left out to illustrate Stripe being off. Pinned so it stays true.
test('a part payment is offered the button for the remainder', () => {
  assert.doesNotMatch(money, /state === 'part'[\s\S]{0,400}?return/,
    'the part case must fall through to the same button as the unpaid case')
  const ex = API.slice(API.indexOf('async function receiptExtras('))
  const exb = ex.slice(0, ex.indexOf('\n}\n'))
  assert.match(exb, /if \(state === 'paid' \|\| !\(owed > 0\)\) return/,
    'only PAID and nothing-owed skip the link — part-paid is neither')
})

// The dates are the thing the customer scrolls back to at the airport. "Thu 20
// August 2026" is unambiguous in a way 20/08/2026 is not to everyone.
test('the dates are spelled out, in UTC so none of them slips a day', () => {
  const f = API.slice(API.indexOf('const fmtDay = (iso)'))
  const fbody = f.slice(0, f.indexOf('\n}\n') > 0 ? f.indexOf('\n}\n') : 400)
  assert.match(fbody, /timeZone: 'UTC'/)
  assert.match(fbody, /weekday: 'short'/)
  assert.match(fbody, /month: 'long'/)
  // Anything that is not an ISO day renders as nothing rather than "Invalid Date".
  assert.match(fbody, /if \(!\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/\.test/)
})

// ── the pay link ───────────────────────────────────────────────────────────

const extras = API.slice(API.indexOf('async function receiptExtras(kind, req, who, b)'))
const ebody = extras.slice(0, extras.indexOf('\n}\n'))

test('the receipt still goes when the link cannot be made', () => {
  // Matched on the invariant, not the literal object: these exits gained a
  // guideUrl in #18 and will gain more. What must hold is that they carry the
  // due date and NOT a payUrl.
  const noLink = (re, why) => {
    const m = ebody.match(re)
    assert.ok(m, why)
    assert.doesNotMatch(m[0], /payUrl/, `${why} — but this exit still hands one over`)
    assert.match(m[0], /payBy/, `${why} — and the due date must survive it`)
  }
  noLink(/if \(!stripeEnabled \|\| !webhookConfigured\) return \{[^}]*\}/,
    'no webhook means no link — same refusal as payment-link.js')
  noLink(/catch \(e\)[\s\S]{0,260}?return \{[^}]*\}/,
    'a Stripe failure must cost the button, not the receipt')
  assert.doesNotMatch(ebody, /throw/, 'nothing here may abort the send')
})

test('nothing to pay means no link at all', () => {
  const m = ebody.match(/if \(state === 'paid' \|\| !\(owed > 0\)\) return \{[^}]*\}/)
  assert.ok(m, 'the settled case must return early')
  assert.match(m[0], /payBy: null/, 'nothing owed, no deadline to state')
  assert.doesNotMatch(m[0], /payUrl/,
    'an idle £0 Checkout session is noise, and a Pay button insults somebody who just paid')
})

test('re-sending the same receipt reuses one Checkout session', () => {
  assert.match(ebody, /const stem = b\.ref \|\|/,
    'a caller that can identify its job passes a ref, and that is what makes the key stable')
  assert.match(ebody, /kind === 'rental' \? `\$\{b\.from \|\| ''\}-\$\{b\.to \|\| ''\}`/,
    'a rental identifies itself by its dates')
  assert.match(ebody, /PAY-\$\{kind\.toUpperCase\(\)\}-\$\{c\.id\}-\$\{stem\}/,
    'the reference is Stripe’s idempotency key — stable per job, and distinct per kind')
  assert.match(ebody, /replace\(\/\[\^\\w-\]\/g, ''\)/, 'and safe to put in a key')
})

test('the due date is worked out on the server, from the setting', () => {
  assert.match(ebody, /kind === 'rental'\s*\n?\s*\? rentalPayBy\(b\.to, londonDate\(\), await rentalPayFloor\(\)\)/,
    'only a rental has a return date to hang a deadline on')
  assert.match(ebody, /: null/, 'every other kind is owed now and names no day it cannot justify')
  const floor = API.slice(API.indexOf('async function rentalPayFloor()'))
  assert.match(floor.slice(0, 500), /key=eq\.rental_pay_days/)
  assert.match(floor.slice(0, 500), /return 7/, 'a missing setting must not mean no deadline')
})

// One minting path, or the two drift on which Stripe customer a payment lands
// against — and that is the bug that shows the shop's own Gmail, locked, on a
// customer's pay page.
test('the staff button and the receipt mint links the same way', () => {
  const link = readFileSync(path.join(ROOT, 'pages/api/payment-link.js'), 'utf8')
  assert.match(link, /import \{ mintPayLink \} from '\.\.\/\.\.\/lib\/payLink\.js'/)
  assert.match(API, /import \{ mintPayLink \} from '\.\.\/\.\.\/lib\/payLink\.js'/)
  assert.doesNotMatch(link, /getOrCreateCustomer/, 'payment-link must not keep its own copy')
  const mint = readFileSync(path.join(ROOT, 'lib/payLink.js'), 'utf8')
  assert.match(mint, /isOwnAccountEmail/, 'the alias guard has to live in the shared path')
})

// ── the wiring ─────────────────────────────────────────────────────────────

test('the done panel passes a rental its own shape, and leaves sales alone', () => {
  const fn = SRC.slice(SRC.indexOf('async function kcDoneEmail(btn)'))
  const kbody = fn.slice(0, fn.indexOf('\n}\n'))
  assert.match(kbody, /d\.receipt[\s\S]{0,120}?kind: 'sale'/,
    'receipt when given, the old sale shape when not')
  assert.match(SRC, /receipt: \{\s*\n\s*kind: 'rental'/)
  assert.match(SRC, /paidAmount: paidNow \? payAmt : 0/,
    'a part payment must reach the receipt as an amount, not as a boolean')
})

test('the dates go as ISO days, not as what is on screen', () => {
  const i = SRC.indexOf("kind: 'rental'")
  const near = SRC.slice(i, i + 400)
  assert.match(near, /\bfrom, to,/, 'fmtDate output would be unparseable on the server')
  assert.doesNotMatch(near, /fmtDate\(from\)/)
})

test('the Settings preview renders the real email, for every kind', () => {
  const pv = API.slice(API.indexOf('const SAMPLES = {'))
  const pbody = pv.slice(0, pv.indexOf('\n      }\n'))
  for (const kind of ['payment', 'rental', 'sim', 'booking', 'repair', 'sale']) {
    assert.match(pbody, new RegExp(`${kind}: \\(\\) =>`), `no preview sample for ${kind}`)
  }
  // The preview must call the same builders the send does, or the shop approves
  // copy it does not send.
  for (const fn of ['buildPayment', 'buildRental', 'buildSim', 'buildBooking', 'buildRepair', 'buildSale']) {
    assert.match(pbody, new RegExp(`${fn}\\(copy, sample,`), `${fn} is not previewed`)
  }
})

// ── the email as it actually renders ───────────────────────────────────────
//
// Everything above reads the source. These BUILD it. Three faults got through
// the source-reading tests and were caught the first time the five states were
// rendered side by side and read: a subject carrying two full dates, a
// sentence claiming the due date was the return date when the floor had won,
// and a promise of "or online now:" followed by nothing when Stripe is off.
import { esc, brandShell } from '../lib/email.js'
import { hebrewFromGregorian, hebrewNumeral, hebrewMonthName } from '../lib/hebrewDate.mjs'

function liftBuildRental() {
  const grab = (start) => {
    const i = API.indexOf(start)
    assert.ok(i > 0, `${start} not found`)
    const rest = API.slice(i)
    return rest.slice(0, rest.indexOf('\n}\n') + 3)
  }
  // NOTE: grab() runs to the first line-start '}', so grabbing factRow also
  // swallows DOW and hebrewDayNumeral that follow it. That is fine — they are
  // needed anyway — but do not add them again or the Function body redeclares.
  const code = [
    grab('const fmtDay = (iso)'), grab('const fmtShortDay = (iso)'),
    grab('const factRow = (label'), grab('function hebrewMonthCaption('),
    grab('function rentalCalendar('), grab('function moneyRows('),
    grab('function guideRow('), grab('function buildRental('),
  ].join('\n')
  const money = (v) => Math.round((Number(v) || 0) * 100) / 100
  const gbp = (v) => `£${money(v).toFixed(2)}`
  const METHOD_LABEL = { cash: 'Cash', card: 'Card', bank_transfer: 'Bank transfer' }
  const fill = (t, v) => String(t).replace(/\{(\w+)\}/g, (m, k) => (v[k] === undefined ? m : v[k]))
  const shell = (title, rows, fn, cl) => brandShell({ title, bodyRows: rows, footNote: fn, closing: cl })
  const greeting = (c, w) => `<tr><td colspan="2">${fill(c.email_greeting, { first: esc((w.name || '').split(' ')[0]), name: esc(w.name) })}</td></tr>`
  return new Function('esc', 'brandShell', 'rentalPayState', 'calendarWeeks', 'freeDayLegend',
    'hebrewFromGregorian', 'hebrewNumeral', 'hebrewMonthName',
    'money', 'gbp', 'METHOD_LABEL', 'fill', 'shell', 'greeting',
    `${code}; return buildRental;`)(
    esc, brandShell, rentalPayState, calendarWeeks, freeDayLegend,
    hebrewFromGregorian, hebrewNumeral, hebrewMonthName,
    money, gbp, METHOD_LABEL, fill, shell, greeting)
}

const build = liftBuildRental()
const COPY = {
  email_rental_subject: 'Your Kosher Connect phone rental — {from} to {to}',
  email_greeting: 'Dear {first}, thank you for coming in.',
  email_closing: 'Thank you for choosing Kosher Connect.',
}
const WHO = { name: 'Mordche Luftig' }
const BASE = { number: '+1 518 555 0101', from: '2026-08-20', to: '2026-08-26', days: 6, total: 20 }
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

test('the subject stays short — a phone truncates two full dates', () => {
  const { subject } = build(COPY, WHO, BASE, {})
  assert.equal(subject, 'Your Kosher Connect phone rental — 20 Aug to 26 Aug')
  assert.ok(subject.length < 60, `subject is ${subject.length} chars: ${subject}`)
})

test('it does not call the due date the return date when it is not', () => {
  // Back on the 26th, but the floor pushes payment to the 27th.
  const out = build(COPY, WHO, { ...BASE, paidAmount: 0 }, { payBy: '2026-08-27', payUrl: 'https://x' })
  const t = text(out.html)
  assert.match(t, /£20\.00 is still to pay, by Thu, 27 August 2026/)
  // Scoped to the money sentence: the intro paragraph legitimately mentions
  // "the day the phone is due back" about the To row, which is true.
  assert.doesNotMatch(t, /That is the day the phone is due back/,
    'the 27th is not the day it comes back — saying so is a receipt the customer stops believing')
  // …and when they DO coincide, it says so, because that is the useful fact.
  const same = build(COPY, WHO, { ...BASE, to: '2026-09-30', paidAmount: 0 }, { payBy: '2026-09-30', payUrl: 'https://x' })
  assert.match(text(same.html), /That is the day the phone is due back/)
})

test('no pay link means no dangling promise of one', () => {
  const out = build(COPY, WHO, { ...BASE, to: '2026-09-30', paidAmount: 0 }, { payBy: '2026-09-30' })
  const t = text(out.html)
  assert.doesNotMatch(t, /online now:/, 'nothing follows the colon when Stripe is off')
  assert.match(t, /bring it in\./)
  assert.doesNotMatch(out.html, /Pay .* online<\/a>/)
})

test('a reserved phone has not been collected, so it is not "brought back"', () => {
  const out = build(COPY, WHO, { ...BASE, paidAmount: 0, reservation: true },
    { payBy: '2026-08-27', payUrl: 'https://x' })
  const t = text(out.html)
  assert.match(t, /reserved and waiting/)
  assert.match(t, /settle it when you collect the phone/)
  assert.doesNotMatch(t, /bring it in/)
})

test('a part payment reads as arithmetic the customer can follow', () => {
  const out = build(COPY, WHO, { ...BASE, total: 140, to: '2026-09-30', method: 'cash', paidAmount: 60 },
    { payBy: '2026-09-30', payUrl: 'https://x' })
  const t = text(out.html)
  assert.match(t, /Total £140\.00/)
  assert.match(t, /Received £60\.00 by Cash, so £80\.00 is still to pay/)
})

test('paid in full is not chased and carries no button', () => {
  const out = build(COPY, WHO, { ...BASE, method: 'card', paidAmount: 20 }, { payBy: null })
  const t = text(out.html)
  assert.match(t, /Paid in full by Card — thank you\. Nothing further to pay on this rental\./)
  // Not an absolute claim about their account: owner-defined extras post to the
  // same wallet just after this is built and are not in this total.
  assert.doesNotMatch(t, /nothing further to pay\.$/i)
  assert.doesNotMatch(t, /still to pay/)
  // The shell's footer has tel:/mailto: links of its own — it is the PAY
  // button that must be absent.
  assert.doesNotMatch(out.html, /checkout|Pay £/i)
})

test('a customer’s name cannot inject markup into their own receipt', () => {
  const out = build(COPY, { name: 'Mo <script>alert(1)</script> Luftig' }, { ...BASE, paidAmount: 0 }, {})
  assert.doesNotMatch(out.html, /<script>/)
  assert.match(out.html, /&lt;script&gt;/)
})

// ── the calendar that explains the price ───────────────────────────────────
//
// Owner, 20 Aug: "maybe a calender showing the chargable days? with hebrew? …
// i mean the hebrew date in small". "Chargeable days 6" over a seven-day
// window is a number the customer cannot check. The shaded cells are the same
// fact, shown — and the free days ARE Hebrew-calendar days, so the Hebrew date
// under each one is what makes it explain itself.

const week = (from, to, freeIsos = []) => {
  const out = []
  let cur = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)
  while (cur <= end) {
    const iso = new Date(cur).toISOString().slice(0, 10)
    out.push({ iso, free: freeIsos.includes(iso), reason: freeIsos.includes(iso) ? 'Shabbos' : '' })
    cur += 86400000
  }
  return out
}

test('the window lands on the right weekday columns', () => {
  // 20 Aug 2026 is a Thursday; 22 Aug is Shabbos.
  const weeks = calendarWeeks(week('2026-08-20', '2026-08-26', ['2026-08-22']))
  assert.equal(weeks.length, 2)
  assert.deepEqual(weeks[0].map((c) => (c ? c.day : null)), [null, null, null, null, 20, 21, 22])
  assert.deepEqual(weeks[1].map((c) => (c ? c.day : null)), [23, 24, 25, 26, null, null, null])
  assert.equal(weeks[0][6].free, true, 'Shabbos is the free one')
  assert.equal(weeks[1][0].free, false)
})

test('a window that starts on a Sunday does not emit an empty first week', () => {
  const weeks = calendarWeeks(week('2026-08-23', '2026-08-25'))
  assert.equal(weeks.length, 1)
  assert.equal(weeks[0][0].day, 23)
})

test('a window too long to draw returns nothing, so the caller can use prose', () => {
  assert.deepEqual(calendarWeeks(week('2026-08-20', '2026-09-30')), [])
  assert.deepEqual(calendarWeeks([]), [])
  assert.deepEqual(calendarWeeks(null), [])
  // Junk days are dropped rather than drawn as blank cells.
  assert.deepEqual(calendarWeeks([{ iso: 'soon' }, { iso: '' }]), [])
})

test('the calendar is built from the counter’s own day list, not re-derived', () => {
  // The server has no Yom Tov table; a second answer to "was that day free" is
  // exactly the thing worth not having.
  assert.match(SRC, /function rentalDayList\(fromDate, toDate\)/)
  assert.match(SRC, /dayList: rentalDayList\(from, to\)/)
  const fn = SRC.slice(SRC.indexOf('function rentalDayList(fromDate, toDate)'))
  const fbody = fn.slice(0, fn.indexOf('\n}\n'))
  assert.match(fbody, /freeDayReason\(cur\)/, 'the same reason function the price walk uses')
  assert.match(fbody, /cur\.setDate\(cur\.getDate\(\) \+ 1\)/, 'the same step')
})

test('the email draws the days, with the Hebrew date small under each', () => {
  const days = week('2026-08-20', '2026-08-26', ['2026-08-22'])
  const out = build(COPY, WHO, { ...BASE, paidAmount: 0, dayList: days }, { payBy: '2026-08-27' })
  const t = text(out.html)
  // 20 Aug 2026 is 7 Elul 5786 — the owner's own reference point is 18 Aug
  // 2026 = ה׳ אלול תשפ״ו, so the 20th is ז׳.
  assert.match(t, /20 ז׳/)
  assert.match(t, /22 ט׳/)
  assert.match(t, /אלול תשפ״ו/, 'the Hebrew month is named once, above the grid')
  assert.match(t, /Sun Mon Tue Wed Thu Fri Shabbos/)
  assert.match(t, /Shaded days are not charged — Shabbos\./)
  // The Hebrew is SMALL and it is right-to-left.
  assert.match(out.html, /font-size:10px[^"]*"\s*dir="rtl"/)
})

test('a hire too long to draw still says why the count is lower', () => {
  const days = week('2026-08-20', '2026-09-30', ['2026-08-22', '2026-08-29'])
  const out = build(COPY, WHO, { ...BASE, to: '2026-09-30', paidAmount: 0, dayList: days }, { payBy: '2026-09-30' })
  const t = text(out.html)
  assert.doesNotMatch(t, /Sun Mon Tue/, 'no thirteen-row table in somebody’s inbox')
  assert.match(t, /2 days in this hire are not charged — Shabbos\./,
    'the explanation must survive even when the picture cannot')
})

test('no free days and no day list are different, and neither invents a claim', () => {
  const none = build(COPY, WHO, { ...BASE, paidAmount: 0, dayList: week('2026-08-23', '2026-08-25') }, {})
  assert.match(text(none.html), /Every day in this hire is chargeable\./)
  const absent = build(COPY, WHO, { ...BASE, paidAmount: 0 }, {})
  assert.doesNotMatch(text(absent.html), /chargeable\.|not charged/)
})

test('the greeting is not echoed back at the reader', () => {
  // The settings greeting already says "here are your details for your
  // records"; opening the next sentence the same way read as a stutter.
  const out = build(COPY, WHO, { ...BASE, paidAmount: 0 }, {})
  assert.doesNotMatch(text(out.html), /Here is your phone rental in full/)
  assert.match(text(out.html), /Keep this email safe/)
})

// ── how the free days are NAMED ────────────────────────────────────────────
//
// Caught by rendering a Tishrei hire for the owner. A yom tov on a Shabbos
// carries both names in one reason string, so listing every distinct string
// printed "Shabbos" three times inside three different combinations:
//
//   "Rosh Hashanah — 2nd day, Shabbos, Yom Kippur, Shabbos · Succos — 1st day,
//    Succos — 2nd day, Shabbos · Shemini Atzeres, Simchas Torah."
//
// and the long-hire sentence joined the same list with " and ", which was worse.
const reasons = (...rs) => rs.map((r) => ({ iso: '2026-01-01', free: true, reason: r }))

test('one reason reads as itself; two or three are joined properly', () => {
  assert.equal(freeDayLegend(reasons('Shabbos')), 'Shabbos')
  assert.equal(freeDayLegend(reasons('Shabbos', 'Yom Kippur')), 'Shabbos and Yom Kippur')
  assert.equal(freeDayLegend(reasons('Shabbos', 'Yom Kippur', 'Simchas Torah')),
    'Shabbos, Yom Kippur and Simchas Torah')
})

test('a yom tov on Shabbos is two atoms, not a third combined name', () => {
  assert.equal(freeDayLegend(reasons('Shabbos', 'Shabbos · Succos — 1st day')),
    'Shabbos and Succos — 1st day')
})

test('a hire across Tishrei stops naming them and says how the shop says it', () => {
  const t = freeDayLegend(reasons(
    'Shabbos', 'Rosh Hashanah — 1st day', 'Rosh Hashanah — 2nd day', 'Yom Kippur',
    'Shabbos · Succos — 1st day', 'Succos — 2nd day', 'Shemini Atzeres', 'Simchas Torah'))
  assert.equal(t, 'Shabbos and Yom Tov')
  assert.ok(t.length < 30, 'nobody wants nine festivals listed on a receipt')
})

test('yom tov with no Shabbos, and nothing at all', () => {
  assert.equal(freeDayLegend(reasons('Pesach — 1st day', 'Pesach — 2nd day', 'Pesach — 7th day', 'Pesach — 8th day')),
    'Yom Tov')
  assert.equal(freeDayLegend([]), '')
  assert.equal(freeDayLegend(null), '')
  assert.equal(freeDayLegend([{ free: false, reason: 'Shabbos' }]), '',
    'a chargeable day contributes no reason')
})

test('both places that name the free days use the one function', () => {
  const cal = API.slice(API.indexOf('function rentalCalendar(days)'))
  const cbody = cal.slice(0, cal.indexOf('\n}\n'))
  assert.equal((cbody.match(/freeDayLegend\(days\)/g) || []).length, 2,
    'the grid legend and the too-long-to-draw sentence must not word it differently')
  assert.doesNotMatch(cbody, /new Set\([^)]*reason/, 'no second copy of the wording rule')
})
