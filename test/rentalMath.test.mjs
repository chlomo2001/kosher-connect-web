// #47 — unit net for the carved-out rental money formulas. Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  round2, capPeriods, priceFromPeriods, countDays,
  lateFeeAmount, ddSurcharge, discountApplies, ticketFeeFor, poolScore,
} from '../lib/rentalMath.mjs'

const USA = { ratePerDay: 3, minCharge: 20, cap: 50, capPeriodDays: 30, afterCapPerDay: 2 }
// The same row as it was before the 08-17 migration — no after-cap rate at all.
const USA_LEGACY = { ratePerDay: 3, minCharge: 20, cap: 50, capPeriodDays: 30 }

test('priceFromPeriods — days × rate above the minimum', () => {
  assert.equal(priceFromPeriods([10], USA), 30) // 10 × £3
})

test('priceFromPeriods — lifts to the minimum', () => {
  assert.equal(priceFromPeriods([3], USA), 20) // 3 × £3 = 9 → min £20
})

test('priceFromPeriods — never below minimum but zero days = £0', () => {
  assert.equal(priceFromPeriods([0], USA), 0)
})

test('priceFromPeriods — clamps to the monthly cap', () => {
  assert.equal(priceFromPeriods([30], USA), 50) // 30 × £3 = 90 → cap £50
})

test('priceFromPeriods — a second window is charged at the after-cap rate, not a second cap', () => {
  // Owner's rule, 08-17. 60 calendar days, 40 chargeable, split 25/15:
  // window 1 = 25 × £3 = £75 → cap £50; window 2 = 15 × £2 = £30. £80, not £100.
  assert.equal(priceFromPeriods([25, 15], USA), 80)
})

test('priceFromPeriods — uncapped when cap is null', () => {
  assert.equal(priceFromPeriods([40], { ratePerDay: 3, minCharge: 20, cap: null }), 120)
})

test('priceFromPeriods — a cap below the minimum wins (cap clamps AFTER the min lift)', () => {
  // Misconfigured rate: cap £15 < minCharge £20. One chargeable day lifts to £20,
  // then the cap clamps it down to £15 — the cap is the hard ceiling.
  const rate = { ratePerDay: 3, minCharge: 20, cap: 15, capPeriodDays: 30 }
  assert.equal(priceFromPeriods([1], rate), 15)
  assert.equal(priceFromPeriods([10], rate), 15) // 10×3=30 → cap 15
})

test('priceFromPeriods — an all-free rental (every day Shabbos/Yom Tov) is £0', () => {
  // 0 chargeable days: the min lift is skipped (guarded on cd>0) and the cap
  // never raises a price, so a fully-free span charges nothing.
  assert.equal(priceFromPeriods([0], USA), 0)
  assert.equal(priceFromPeriods([0], { ratePerDay: 3, minCharge: 20, cap: null }), 0)
})

test('capPeriods — ceil over the window', () => {
  assert.equal(capPeriods(30), 1)
  assert.equal(capPeriods(31), 2)
  assert.equal(capPeriods(0), 1)
})

test('countDays — inclusive span, free-day predicate', () => {
  const r = countDays('2026-07-01', '2026-07-05', (iso) => iso === '2026-07-04')
  assert.deepEqual(r, { chargeableDays: 4, totalDays: 5, periods: [4] })
})

test('countDays — no free days', () => {
  assert.deepEqual(countDays('2026-07-01', '2026-07-01'), { chargeableDays: 1, totalDays: 1, periods: [1] })
})

test('countDays — bad range = zero', () => {
  assert.deepEqual(countDays('2026-07-05', '2026-07-01'), { chargeableDays: 0, totalDays: 0, periods: [] })
})

test('countDays — feeds the LOCAL calendar day to the free-day predicate (audit C10)', () => {
  // Passing the day through toISOString() (UTC) shifted it back one in UK/Israel,
  // so a Shabbos at the range edge was missed and charged. Assert the exact days
  // handed to the predicate — this holds in every timezone now that the loop
  // formats local components (it would fail under TZ=Asia/Jerusalem before the fix).
  const seen = []
  const r = countDays('2026-07-01', '2026-07-04', (iso) => { seen.push(iso); return iso === '2026-07-04' })
  assert.deepEqual(seen, ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04'])
  assert.deepEqual(r, { chargeableDays: 3, totalDays: 4, periods: [3] }) // the Shabbos on the 4th is free
})

test('priceFromPeriods — the owner\'s three worked examples (08-17)', () => {
  // USA · £3/day · min £20 · cap £50/30d · after-cap £2, no free days.
  assert.equal(priceFromPeriods([30], USA), 50)            // 30 × £3 = 90 → cap
  assert.equal(priceFromPeriods([30, 5], USA), 60)         // £50 + 5 × £2
  assert.equal(priceFromPeriods([30, 30, 5], USA), 110)    // £50 + (30×£2=60 → cap £50) + £10
})

test('priceFromPeriods — a long hire can never cost less than a shorter one', () => {
  let last = 0
  for (let d = 1; d <= 95; d++) {
    const periods = []
    for (let i = 0; i < d; i++) {
      const w = Math.floor(i / 30)
      periods[w] = (periods[w] || 0) + 1
    }
    const p = priceFromPeriods(periods, USA)
    assert.ok(p >= last, `${d} days (${p}) came out cheaper than ${d - 1} days (${last})`)
    last = p
  }
})

test('priceFromPeriods — the minimum charge is a first-window idea only', () => {
  // Two days into a second window must not be lifted to the £20 minimum: the
  // customer already paid a full first window.
  assert.equal(priceFromPeriods([30, 2], USA), 54)         // £50 + 2 × £2
})

test('priceFromPeriods — a rate row with no after-cap rate keeps the old behaviour', () => {
  // An unconfigured rate must not silently become cheaper: every window prices
  // at the full day rate, which is what the cap × periods rule used to give.
  assert.equal(priceFromPeriods([30, 30], USA_LEGACY), 100)  // £50 + (30×£3 → cap £50)
  assert.equal(priceFromPeriods([25, 15], USA_LEGACY), 95)   // £50 + 15 × £3
})

test('countDays — splits chargeable days into cap windows, calendar-counted', () => {
  // 35 days from 1 Jul, Saturdays free. Window 1 = calendar days 1–30,
  // window 2 = 31–35, and a free day still uses up its place in its window.
  const isSat = (iso) => new Date(`${iso}T00:00:00`).getDay() === 6
  const r = countDays('2026-07-01', '2026-08-04', isSat)
  assert.equal(r.totalDays, 35)
  assert.equal(r.periods.length, 2)
  assert.equal(r.periods.reduce((a, b) => a + b, 0), r.chargeableDays)
  assert.ok(r.periods[1] <= 5, 'the second window holds at most the 5 days left')
})

test('countDays — a window boundary lands where the calendar says, not the charge', () => {
  const r = countDays('2026-07-01', '2026-07-30', () => false)
  assert.deepEqual(r.periods, [30])                        // exactly one window
  const r2 = countDays('2026-07-01', '2026-07-31', () => false)
  assert.deepEqual(r2.periods, [30, 1])                    // day 31 opens the next
})

test('lateFeeAmount', () => {
  assert.equal(lateFeeAmount(3, 1), 3)
  assert.equal(lateFeeAmount(0, 5), 0)
})

test('ddSurcharge — percentage wins over the floor', () => {
  assert.equal(ddSurcharge(100, 0.1, 2), 110) // 100 + max(10, 2)
})

test('ddSurcharge — floor wins on a cheap plan', () => {
  assert.equal(ddSurcharge(5, 0.1, 2), 7) // 5 + max(0.5, 2)
})

test('discountApplies — the Nth concurrent item', () => {
  assert.equal(discountApplies(3, 3), true)
  assert.equal(discountApplies(2, 3), false)
})

test('ticketFeeFor — tiers 1 / 2-5 / 6+', () => {
  const svc = { price: 20, repeatPrice: 10, bulkPrice: 5 }
  assert.equal(ticketFeeFor(svc, 1), 20)
  assert.equal(ticketFeeFor(svc, 3), 40) // 20 + 2×10
  assert.equal(ticketFeeFor(svc, 7), 70) // 20 + 4×10 + 2×5
})

test('ticketFeeFor — flat service ignores N', () => {
  assert.equal(ticketFeeFor({ price: 15, repeatPrice: null }, 4), 15)
})

test('poolScore — near-perfect beats early-expiry and idle', () => {
  assert.ok(poolScore(1, false) > poolScore(20, false))
  assert.ok(poolScore(-2, false) < 0)
  assert.ok(poolScore(1, true) > poolScore(1, false)) // active-line bonus
})

test('round2', () => {
  assert.equal(round2(1.006), 1.01)
  assert.equal(round2(1.004), 1)
  assert.equal(round2(2.5), 2.5)
  // Exact half-penny must round up despite float representation (mirrors money()).
  assert.equal(round2(1.005), 1.01)
  assert.equal(round2(2.675), 2.68)
  assert.equal(round2(-1.005), -1.01)
})
