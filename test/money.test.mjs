// Regression net for the pure money primitives. Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  serviceOrderTotal, phoneDiscountApplies, simDiscountApplies,
  advanceOneMonth, cashExpected, ledgerSignFor, money,
} from '../lib/money.mjs'

test('serviceOrderTotal — tiered "first / N or more"', () => {
  // Passport application £25, repeat £20, discount from the 4th.
  assert.deepEqual(serviceOrderTotal(25, 20, 1, 4), { qty: 1, total: 25 })
  assert.deepEqual(serviceOrderTotal(25, 20, 3, 4), { qty: 3, total: 75 })   // all single
  assert.deepEqual(serviceOrderTotal(25, 20, 4, 4), { qty: 4, total: 95 })   // 3×25 + 1×20
  assert.deepEqual(serviceOrderTotal(25, 20, 6, 4), { qty: 6, total: 135 })  // 3×25 + 3×20
  // No repeat price → every unit at single.
  assert.deepEqual(serviceOrderTotal(30, null, 3, 4), { qty: 3, total: 90 })
  // Old list "2 or more".
  assert.deepEqual(serviceOrderTotal(25, 20, 2, 2), { qty: 2, total: 45 })
  // Garbage qty floors to 1.
  assert.equal(serviceOrderTotal(25, 20, 0, 4).qty, 1)
  assert.equal(serviceOrderTotal(25, 20, -5, 4).qty, 1)
})

test('phone discount starts at the Nth concurrent phone', () => {
  // fromN=3 → applies once the customer has 2 other concurrent rentals (=3rd).
  assert.equal(phoneDiscountApplies(1, 3), false) // this is the 2nd phone
  assert.equal(phoneDiscountApplies(2, 3), true)  // this is the 3rd
  // fromN=4 → not until the 4th.
  assert.equal(phoneDiscountApplies(2, 4), false)
  assert.equal(phoneDiscountApplies(3, 4), true)
})

test('sim discount starts at the Nth active plan', () => {
  assert.equal(simDiscountApplies(2, 3), false)
  assert.equal(simDiscountApplies(3, 3), true)
  assert.equal(simDiscountApplies(4, 4), true)
})

test('advanceOneMonth — clamps to month end, never overflows', () => {
  assert.equal(advanceOneMonth('2026-01-31'), '2026-02-28') // 2026 not leap
  assert.equal(advanceOneMonth('2028-01-31'), '2028-02-29') // leap year
  assert.equal(advanceOneMonth('2026-01-15'), '2026-02-15') // normal day
  assert.equal(advanceOneMonth('2026-03-31'), '2026-04-30') // 31 → 30
  assert.equal(advanceOneMonth('2026-12-31'), '2027-01-31') // year rollover
  assert.equal(advanceOneMonth('2026-02-28'), '2026-03-28')
})

test('cashExpected — nets by sign, adds float (a cash refund lowers it)', () => {
  const entries = [
    { method: 'cash', amount: 100 },   // payment in
    { method: 'card', amount: 50 },    // not cash — ignored
    { method: 'cash', amount: -20 },   // cash refund out
  ]
  assert.equal(cashExpected(entries, 0), 80)    // 100 - 20
  assert.equal(cashExpected(entries, 50), 130)  // + opening float
  assert.equal(cashExpected([], 0), 0)
})

test('ledgerSignFor — mirrors the DB sign CHECK', () => {
  assert.equal(ledgerSignFor('booking'), 'debit')
  assert.equal(ledgerSignFor('sim_service'), 'debit')
  assert.equal(ledgerSignFor('virtual_number'), 'debit')
  assert.equal(ledgerSignFor('sim_charge'), 'debit')
  assert.equal(ledgerSignFor('payment'), 'credit')
  assert.equal(ledgerSignFor('refund'), 'credit')
  assert.equal(ledgerSignFor('extra_charge'), 'debit')  // DB CHECK: auto extras are always charges
  assert.equal(ledgerSignFor('manual_adjustment'), 'either')
})

test('money — rounds to pennies', () => {
  assert.equal(money(2.676), 2.68)  // rounds up
  assert.equal(money(2.671), 2.67)  // rounds down
  assert.equal(money('3.14159'), 3.14)
  assert.equal(money(10), 10)
  assert.equal(money(null), 0)
})
