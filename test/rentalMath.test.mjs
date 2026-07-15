// #47 — unit net for the carved-out rental money formulas. Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  round2, capPeriods, priceFromDays, countDays,
  lateFeeAmount, ddSurcharge, discountApplies, ticketFeeFor, poolScore,
} from '../lib/rentalMath.mjs'

const USA = { ratePerDay: 3, minCharge: 20, cap: 50, capPeriodDays: 30 }

test('priceFromDays — days × rate above the minimum', () => {
  assert.equal(priceFromDays(10, 10, USA), 30) // 10 × £3
})

test('priceFromDays — lifts to the minimum', () => {
  assert.equal(priceFromDays(3, 3, USA), 20) // 3 × £3 = 9 → min £20
})

test('priceFromDays — never below minimum but zero days = £0', () => {
  assert.equal(priceFromDays(0, 5, USA), 0)
})

test('priceFromDays — clamps to the monthly cap', () => {
  assert.equal(priceFromDays(30, 30, USA), 50) // 30 × £3 = 90 → cap £50
})

test('priceFromDays — cap scales per 30-day window', () => {
  // 60 calendar days → 2 cap periods → cap £100; 40 chargeable × £3 = 120 → 100
  assert.equal(priceFromDays(40, 60, USA), 100)
})

test('priceFromDays — uncapped when cap is null', () => {
  assert.equal(priceFromDays(40, 40, { ratePerDay: 3, minCharge: 20, cap: null }), 120)
})

test('capPeriods — ceil over the window', () => {
  assert.equal(capPeriods(30), 1)
  assert.equal(capPeriods(31), 2)
  assert.equal(capPeriods(0), 1)
})

test('countDays — inclusive span, free-day predicate', () => {
  const r = countDays('2026-07-01', '2026-07-05', (iso) => iso === '2026-07-04')
  assert.deepEqual(r, { chargeableDays: 4, totalDays: 5 })
})

test('countDays — no free days', () => {
  assert.deepEqual(countDays('2026-07-01', '2026-07-01'), { chargeableDays: 1, totalDays: 1 })
})

test('countDays — bad range = zero', () => {
  assert.deepEqual(countDays('2026-07-05', '2026-07-01'), { chargeableDays: 0, totalDays: 0 })
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
})
