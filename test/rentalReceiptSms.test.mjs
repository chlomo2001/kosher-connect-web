// The receipt a customer gets by text, and the browser copy of it.
//
// Owner, 27 Aug, on what the rental SMS should carry: the "rented number",
// "the Kosher Connect team", and the "standard rates". None of the three
// existed — the only rental SMS was buildRentalSms, which drafts a STATUS
// text (reserved / due back / overdue) for a hire already running. It names
// no money, no rate and, in the reserved case, not even the number.
//
// So the receipt is its own composition, and this holds three things about it:
// the browser mirror says exactly what the lib says, the owner's three asks
// are actually in the words, and every character stays inside GSM-7 — one
// curly quote or em dash cuts a segment from 160 characters to 70 and the shop
// pays twice to say the same thing (the rule lib/autoSms.mjs already keeps).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { rentalReceiptSms, rentalPayBy, rentalPayState } from '../lib/rentalReceipt.mjs'

const SRC = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')
const lift = () => {
  const m = SRC.match(/\/\/ ── KC_RSMS mirror start ──\n([\s\S]*?)\n\/\/ ── KC_RSMS mirror end ──/)
  assert.ok(m, 'KC_RSMS mirror region not found in public/main.js')
  return new Function(`${m[1]}; return KC_RSMS;`)()
}

// The same formatters on both sides, so any difference is composition and not
// locale. Deliberately not the app's: what is under test is which sentences
// get written, not how a date is spelled.
const FMT = {
  date: (v) => `D(${v})`,
  gbp: (v) => `£${(Number(v) || 0).toFixed(2)}`,
  phone: (v) => `P(${v})`,
}

const BASE = {
  firstName: 'Menachem Adler',
  number: '+15185550101',
  from: '2026-08-12', to: '2026-08-26',
  chargeableDays: 12, totalDays: 15,
  total: 140, paid: 60, method: 'cash',
  payBy: '2026-08-27', dueBack: '2026-08-27',
  shopPhone: '0161 531 1386',
  rate: { perDay: 3, min: 20, cap: 50, capDays: 30 },
}

// Every shape a real hire reaches this with: settled, part-paid, on account,
// free of charge, reserved, a one-day hire, and a record with almost nothing
// on it — a receipt must never print "Phone:" with nothing after it.
const CASES = [
  BASE,
  { ...BASE, paid: 140 },
  { ...BASE, paid: 0, method: null },
  { ...BASE, total: 0, paid: 0 },
  { ...BASE, reserved: true },
  { ...BASE, chargeableDays: 1, totalDays: 1, to: '2026-08-12' },
  { ...BASE, totalDays: 12 },              // nothing free — no bracket
  { ...BASE, payBy: null, dueBack: null },
  { ...BASE, rate: null },
  { ...BASE, rate: { perDay: 3, min: 0, cap: 0, capDays: 30 } },
  { ...BASE, number: '', from: null, to: null, shopPhone: '' },
  {},
  { firstName: '   ' },
  { ...BASE, freeLabel: 'Shabbos' },
]

test('the browser mirror writes exactly what the lib writes', () => {
  const B = lift()
  for (const f of CASES) {
    assert.equal(B.rentalReceiptSms(f, FMT), rentalReceiptSms(f, FMT), JSON.stringify(f))
  }
})

test('the mirror also carries the two rules the receipt leans on', () => {
  const B = lift()
  for (const ret of ['2026-08-26', '2026-08-01', '', null]) {
    for (const today of ['2026-08-12', '2026-08-30', 'nonsense']) {
      for (const floor of [0, 7, 14, 200]) {
        assert.equal(B.rentalPayBy(ret, today, floor), rentalPayBy(ret, today, floor),
          `${ret} @ ${today} / ${floor}`)
      }
    }
  }
  for (const [t, p] of [[140, 0], [140, 60], [140, 140], [140, 200], [0, 0], [0, 10]]) {
    assert.deepEqual(B.rentalPayState(t, p), rentalPayState(t, p), `${t}/${p}`)
  }
})

test("the owner's three asks are in the words", () => {
  const out = rentalReceiptSms(BASE, FMT)
  assert.match(out, /Phone: P\(\+15185550101\)/, 'the rented number is not named')
  assert.match(out, /Standard rate £3\.00\/day, minimum £20\.00, capped £50\.00 per 30 days\./,
    'the standard rates are not stated')
  assert.ok(out.endsWith('- the Kosher Connect team'), 'the sign-off is not the team')
})

test('it says received, never "you paid"', () => {
  for (const f of [BASE, { ...BASE, paid: 140 }, { ...BASE, paid: 0 }]) {
    const out = rentalReceiptSms(f, FMT)
    assert.doesNotMatch(out, /you paid/i, out)
  }
  assert.match(rentalReceiptSms(BASE, FMT), /£60\.00 received by cash/)
})

test('a settled receipt does not also demand money by a date', () => {
  const out = rentalReceiptSms({ ...BASE, paid: 140, payBy: null }, FMT)
  assert.doesNotMatch(out, /to pay/)
})

test('a line with nothing to say is left out, not printed empty', () => {
  const out = rentalReceiptSms({ firstName: 'Yossi' }, FMT)
  assert.doesNotMatch(out, /Phone:/)
  assert.doesNotMatch(out, /Standard rate/)
  assert.doesNotMatch(out, /Questions:/)
  assert.doesNotMatch(out, /Total/)
  assert.equal(out, 'Hi Yossi, your Kosher Connect phone hire is confirmed.\n- the Kosher Connect team')
})

test('the free-day bracket appears only when a day actually went free', () => {
  assert.match(rentalReceiptSms(BASE, FMT), /\(Shabbos and Yom Tov are not charged\)/)
  assert.doesNotMatch(rentalReceiptSms({ ...BASE, totalDays: 12 }, FMT), /not charged/)
})

// The billing rule. GSM-7's basic set plus its extension table — £ is in the
// basic set, an em dash and a curly quote are in neither, and one of those
// anywhere in the body puts the WHOLE message into UCS-2 at 70 characters a
// segment.
const GSM7 = '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?'
  + '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'
  + '^{}\\[~]|€'
test('every character the receipt can write is billable as GSM-7', () => {
  for (const f of CASES) {
    for (const ch of rentalReceiptSms(f, { ...FMT, date: (v) => '12 Aug 2026', phone: (v) => '+1 518 555 0101' })) {
      assert.ok(GSM7.includes(ch), `${JSON.stringify(ch)} is not GSM-7 — it would double the bill`)
    }
  }
})

// The counter's own composers, checked as text: they are the callers that
// decide which facts reach the composition above.
test('the app builds the receipt from the rental, not from a template', () => {
  assert.match(SRC, /function buildRentalReceiptSms\(r\)/)
  assert.match(SRC, /smsText: buildRentalReceiptSms\(rental\)/,
    'the rental done-panel still drafts the status text as its receipt')
  assert.match(SRC, /smsText: buildBatchRentalReceiptSms\(/)
  // The rate must come from Settings through rateFor. A literal price here
  // would be a second price list, which BUSINESS_RULES.md is supposed to end.
  const fn = SRC.match(/function buildRentalReceiptSms\(r\)[\s\S]*?\n}/)[0]
  assert.match(fn, /rateFor\(/)
  assert.doesNotMatch(fn, /perDay:\s*\d/)
})
