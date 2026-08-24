// A receipt for every situation it is useful, all built to the same standard.
//
// Owner, 21 Aug: "the 2 other reciept kinds need redoing in the same level than
// the rest, and also make sure there is one for every situation its useful
// throughout the site."
//
// Four of the five confirmation cards were emailing `kind: 'sale'` — a POS
// receipt with one line reading "SIM plan 07… · 5GB" or "Flight MAN-TLV". That
// tells a customer nothing they did not already know and nothing they might
// need later: not the network, not the renewal day, not the booking reference,
// not what the estimate covers.
//
// These tests are about the SHAPE being shared. The wording of the money
// paragraph is tested once, in rentalReceipt.test.mjs, because there is only
// one of it.
import test from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { esc, brandShell } from '../lib/email.js'
import { rentalPayState } from '../lib/rentalReceipt.mjs'

const ROOT = path.join(import.meta.dirname, '..')
const API = readFileSync(path.join(ROOT, 'pages/api/email.js'), 'utf8')
const SRC = readFileSync(path.join(ROOT, 'public/main.js'), 'utf8')

const KINDS = ['sale', 'payment', 'rental', 'sim', 'booking', 'repair']
const SERVICE_KINDS = ['rental', 'sim', 'booking', 'repair']

function lift() {
  const grab = (start) => {
    const i = API.indexOf(start)
    assert.ok(i > 0, `${start} not found`)
    const rest = API.slice(i)
    return rest.slice(0, rest.indexOf('\n}\n') + 3)
  }
  const code = [
    grab('const fmtDay = (iso)'), grab('const fmtShortDay = (iso)'), grab('const factRow = (label'),
    grab('function moneyRows('), grab('function guideRow('),
    grab('function buildSale('), grab('function buildPayment('),
    grab('function buildSim('), grab('function buildBooking('), grab('function buildRepair('),
  ].join('\n')
  const money = (v) => Math.round((Number(v) || 0) * 100) / 100
  const gbp = (v) => `£${money(v).toFixed(2)}`
  const METHOD_LABEL = { cash: 'Cash', card: 'Card', bank_transfer: 'Bank transfer' }
  const fill = (t, v) => String(t).replace(/\{(\w+)\}/g, (m, k) => (v[k] === undefined ? m : v[k]))
  const shell = (title, rows, fn, cl) => brandShell({ title, bodyRows: rows, footNote: fn, closing: cl })
  const greeting = (c, w) => `<tr><td colspan="2">Dear ${esc((w.name || '').split(' ')[0])},</td></tr>`
  return new Function('esc', 'brandShell', 'rentalPayState', 'money', 'gbp', 'METHOD_LABEL',
    'fill', 'shell', 'greeting',
    `${code}; return { buildSale, buildPayment, buildSim, buildBooking, buildRepair };`)(
    esc, brandShell, rentalPayState, money, gbp, METHOD_LABEL, fill, shell, greeting)
}

const B = lift()
const COPY = {
  email_receipt_subject: 'Your Kosher Connect receipt — {total}',
  email_payment_subject: 'Payment received — {amount}',
  email_sim_subject: 'Your Kosher Connect SIM plan — {number}',
  email_booking_subject: 'Your Kosher Connect flight booking — {route}',
  email_repair_subject: 'Your repair is booked in — {device}',
  email_repair_ready_subject: 'Your {device} is ready to collect',
  email_closing: 'Thank you for choosing Kosher Connect.',
}
const WHO = { name: 'Mordche Luftig' }
const PAY = 'https://checkout.stripe.com/x'
const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

// ── the SIM plan ───────────────────────────────────────────────────────────

test('a SIM receipt carries the things a customer needs months later', () => {
  const t = text(B.buildSim(COPY, WHO, {
    number: '07349 969084', provider: 'Lebara', plan: '5GB Monthly',
    renewalDate: '2026-09-19', total: 20, paidAmount: 0,
  }, { payUrl: PAY, guideUrl: '/help/sim-plan' }).html)
  assert.match(t, /Mordche Luftig/)
  assert.match(t, /Your number 07349 969084/)
  assert.match(t, /Network Lebara/)
  assert.match(t, /Plan 5GB Monthly/)
  assert.match(t, /Renews Sat, 19 September 2026/, 'the renewal day spelled out, not an ISO string')
  assert.match(t, /£20\.00 is still to pay/)
  assert.match(t, /How your SIM plan works/)
})

test('a SIM with no setup fee is not given a money paragraph at all', () => {
  const t = text(B.buildSim(COPY, WHO, { number: '07349 969084', total: 0 }, {}).html)
  assert.doesNotMatch(t, /still to pay|Paid in full|Setup/)
  assert.match(t, /Your number/)
})

// ── the flight booking ─────────────────────────────────────────────────────

test('a booking leads with the two things worth checking on the day', () => {
  const out = B.buildBooking(COPY, WHO, {
    passenger: 'Menachem Elimelech Glausiusz', route: 'MAN–TLV', airline: 'Eurowings',
    travelDate: '2026-11-12', returnDate: '2026-11-26', bookingRef: '8DGFF9',
    total: 410, paidAmount: 200, method: 'bank_transfer',
  }, { payUrl: PAY, guideUrl: '/help/flight-booking' })
  const t = text(out.html)
  assert.match(out.subject, /MAN–TLV/)
  assert.match(t, /check the names and dates below against the passports/)
  assert.match(t, /Booked for Menachem Elimelech Glausiusz/,
    'the passenger, not the account holder — they are often different people')
  assert.match(t, /Booking reference 8DGFF9/)
  assert.match(t, /Travelling Thu, 12 November 2026/)
  assert.match(t, /Returning Thu, 26 November 2026/)
  assert.match(t, /We took £200\.00 by Bank transfer, so £210\.00 is still to pay/)
  assert.match(t, /Pay £210\.00 online/)
})

// ── the repair ─────────────────────────────────────────────────────────────

test('a repair booked in says ESTIMATE, because nobody has started work', () => {
  const out = B.buildRepair(COPY, WHO, {
    device: 'iPhone 12', services: 'Screen replacement', total: 45, paidAmount: 0,
  }, { guideUrl: '/help/repair' })
  const t = text(out.html)
  assert.match(out.subject, /booked in/)
  assert.match(t, /Estimate £45\.00/)
  assert.doesNotMatch(t, /Total £45/, '"Total" on a job nobody has started is a promise the shop has not made')
  assert.match(t, /nothing is charged that you have not agreed to first/)
  assert.match(t, /settle it when you collect the phone/)
})

test('a finished repair is a different email, and says Total', () => {
  const out = B.buildRepair(COPY, WHO, { device: 'iPhone 12', total: 45, ready: true }, {})
  assert.match(out.subject, /ready to collect/)
  const t = text(out.html)
  assert.match(t, /repaired and waiting for you/)
  assert.match(t, /Total £45\.00/)
  assert.doesNotMatch(t, /Estimate/)
})

// ── the payment confirmation ───────────────────────────────────────────────

test('a payment that clears the balance says so and offers nothing', () => {
  const t = text(B.buildPayment(COPY, WHO, { amount: 45, method: 'card', balance: 0 }, { payUrl: PAY }).html)
  assert.match(t, /Amount received £45\.00/)
  assert.match(t, /How you paid Card/)
  assert.doesNotMatch(t, /left on your account|Pay £/)
})

// The owner's question in its other form: after a part payment, offer the rest.
test('a payment that leaves a balance offers the rest, without nagging', () => {
  const t = text(B.buildPayment(COPY, WHO,
    { amount: 45, method: 'card', note: 'Rental balance', balance: -20 }, { payUrl: PAY }).html)
  assert.match(t, /Still owing after this £20\.00/)
  assert.match(t, /There is £20\.00 left on your account/)
  assert.match(t, /No rush — it can wait until you are next in/,
    'a receipt for money they have just paid is not the place to chase them')
  assert.match(t, /Pay £20\.00 online/)
})

test('a customer in credit is told that, not asked for money', () => {
  const t = text(B.buildPayment(COPY, WHO, { amount: 100, balance: 30 }, { payUrl: PAY }).html)
  assert.match(t, /Your balance £30\.00 in credit/)
  assert.doesNotMatch(t, /still to pay|left on your account|Pay £/)
})

// ── the shop sale ──────────────────────────────────────────────────────────

test('the shop receipt keeps its lines and gains the money paragraph', () => {
  const t = text(B.buildSale(COPY, WHO, {
    lines: [{ name: 'Screen protector', qty: 2, total: 12 }, { name: 'USB-C cable', qty: 1, total: 8 }],
    total: 20, method: 'cash', paidNow: true,
  }, {}).html)
  assert.match(t, /Name Mordche Luftig/, 'the full name, like every other kind')
  assert.match(t, /Screen protector × 2/)
  assert.match(t, /Paid in full by Cash/)
})

test('an unpaid shop sale gets a button, which it never had', () => {
  const t = text(B.buildSale(COPY, WHO, {
    lines: [{ name: 'Charger', qty: 1, total: 15 }], total: 15, paidNow: false,
  }, { payUrl: PAY }).html)
  assert.match(t, /£15\.00 is still to pay/)
  assert.match(t, /Pay £15\.00 online/)
})

test('paidNow stays supported, and paidAmount wins when both are given', () => {
  const both = text(B.buildSale(COPY, WHO, {
    lines: [{ name: 'Charger', qty: 1, total: 15 }], total: 15, paidNow: true, paidAmount: 5,
  }, { payUrl: PAY }).html)
  assert.match(both, /We took £5\.00, so £10\.00 is still to pay/,
    'a caller that knows the amount is more informative than a boolean')
})

// ── the shape, held across all of them ─────────────────────────────────────

test('every kind is routed, previewed, and built by one table', () => {
  const tbl = API.slice(API.indexOf('const BUILDERS = {'))
  const body = tbl.slice(0, tbl.indexOf('}'))
  for (const k of KINDS) assert.match(body, new RegExp(`\\b${k}:`), `${k} is not routed`)
  assert.match(API, /const build = BUILDERS\[b\.kind\] \|\| null/,
    'an unknown kind must be a refusal, not a fallback to a receipt for something else')
})

test('every kind says money the same way — one paragraph, not six', () => {
  const count = (API.match(/moneyRows\(\{/g) || []).length
  assert.ok(count >= 5, `only ${count} builders use the shared paragraph`)
  // Nobody re-implements it.
  const strays = API.match(/is still to pay/g) || []
  assert.equal(strays.length, 1, 'the owing sentence must exist in exactly one place')
})

test('every service kind offers its own how-to page', () => {
  const map = API.slice(API.indexOf('const KIND_SERVICE = {'))
  const body = map.slice(0, map.indexOf('}'))
  for (const k of SERVICE_KINDS) assert.match(body, new RegExp(`${k}:`), `${k} has no guide`)
  for (const fn of ['buildRental', 'buildSim', 'buildBooking', 'buildRepair']) {
    const i = API.indexOf(`function ${fn}(`)
    const b = API.slice(i, API.indexOf('\n}\n', i))
    assert.match(b, /guideRow\(extras\.guideUrl/, `${fn} does not offer the guide`)
  }
})

test('the confirmation cards send their own kind, not a POS line', () => {
  // Anchored on the showDonePanel TITLE, not on the words: "SIM plan added"
  // also appears in a comment and a toast further up the same function, and
  // indexOf found the comment first.
  for (const [kind, near] of [['sim', "title: 'SIM plan added'"],
    ['booking', "title: 'Booking saved'"], ['repair', "title: 'Repair ticket opened'"]]) {
    const i = SRC.indexOf(near)
    assert.ok(i > 0, `${near} card not found`)
    const card = SRC.slice(i, i + 2200)
    assert.match(card, new RegExp(`kind: '${kind}'`), `${near} still emails a generic sale`)
    assert.match(card, /ref: String\(/, `${near} sends no ref, so a re-send mints a second Checkout session`)
  }
})

// ── how a booking was paid ─────────────────────────────────────────────────
//
// The booking receipt could not say HOW they paid: the card passed method:null.
// pages/api/bookings.js answers with `paidNow` as a boolean and no method, so
// the only thing that knows is the form that was just submitted.
//
// Worth being exact about the shape while here: a booking payment is
// ALL-OR-NOTHING — the API posts one payment row for the whole total, or none —
// so there is no part-paid booking at save time and paidAmount is settled by
// paidNow alone.
test('a paid booking says how, and "on account" is not a way of paying', () => {
  const i = SRC.indexOf("kind: 'booking'")
  const card = SRC.slice(i, i + 1800)   // the block gained comments; keep the window ahead of it
  assert.match(card, /method: res\.paidNow && bkPayment !== 'account' \? bkPayment : null/,
    'the receipt must name the method, and must not call "on account" a payment')
  // Read once, from the form, and used for both the payload and the receipt —
  // two getElementById reads could disagree if the select changed between them.
  assert.match(SRC, /const bkPayment = document\.getElementById\('bkPay'\)\.value;/)
  assert.equal((SRC.match(/getElementById\('bkPay'\)\.value/g) || []).length, 1,
    'bkPay is read in more than one place again')
  assert.match(SRC, /payment:\s+bkPayment,/, 'the payload must send the same value')
})

test('an unpaid booking carries no method at all', () => {
  // moneyRows only prints "by <method>" on a settled or part-settled receipt,
  // and an on-account booking has neither.
  const t = text(B.buildBooking(COPY, WHO, {
    route: 'MAN–TLV', travelDate: '2026-11-12', total: 410, paidAmount: 0, method: null,
  }, { payUrl: PAY }).html)
  assert.match(t, /£410\.00 is still to pay/)
  assert.doesNotMatch(t, / by /)
})

test('a paid booking reads like every other paid receipt', () => {
  const t = text(B.buildBooking(COPY, WHO, {
    route: 'MAN–TLV', travelDate: '2026-11-12', total: 410, paidAmount: 410, method: 'card',
  }, {}).html)
  assert.match(t, /Paid in full by Card — thank you\. Nothing further to pay on this booking\./)
})
