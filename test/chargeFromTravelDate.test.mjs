// Collecting a phone early does not start the meter.
//
// A reversal, and worth recording as one. The rule used to be owner item #11 —
// "the charge window starts when the phone is PHYSICALLY taken, not on the
// reserved from-date" — and startReservation repriced the hire from the day it
// was collected. Shloime, 27 Aug 2026, after running it in the shop: "charge
// should only start from travel date, not pickup".
//
// He is describing what the customer thinks they are buying. Somebody who
// collects on the Sunday for a Thursday flight has not had four days of
// anything. It also penalised the shop's own convenience — handing phones out
// early is how a Friday rush is avoided.
//
// The pickup date is still recorded: it is when the handset left the shop,
// which decides stock, possession and the stage the hire reads at. It just no
// longer decides the money.
import test from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const SRC = readFileSync(path.join(import.meta.dirname, '..', 'public/main.js'), 'utf8')
const CODE = SRC.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
const start = CODE.slice(CODE.indexOf('async function startReservation'),
                         CODE.indexOf('async function startReservation') + 2600)

test('handing a phone over does not reprice it', () => {
  assert.doesNotMatch(start, /r\.price\s*=/,
    'startReservation must not rewrite the price')
  assert.doesNotMatch(start, /r\.chargeableDays\s*=/,
    'nor the chargeable days — both are settled at the reserved window')
})

test('nothing recalculates a rate from the pickup date', () => {
  assert.doesNotMatch(CODE, /calcRentalPrice\(\s*pickup/,
    'pricing from the collection day is the rule that was reversed')
})

test('the pickup date is still recorded', () => {
  // It decides stock, possession, and whether the stage reads fetched.
  assert.match(start, /r\.pickupDate\s*=\s*pickup/)
})

test('the confirm shows the travel window, not today', () => {
  assert.match(start, /Charged window[\s\S]{0,120}r\.fromDate/,
    'the window somebody is agreeing to is fromDate → toDate')
  assert.doesNotMatch(start, /Charged window[\s\S]{0,60}fmtDate\(pickup\)/)
})

test('an early collection is named as free rather than left to be noticed', () => {
  assert.match(start, /earlyDays/, 'it should work out how early they came')
  assert.match(start, /not charged for/,
    'and say so — a courtesy the customer cannot see is not a courtesy')
})

test('the row no longer claims the charge runs from the pickup', () => {
  assert.doesNotMatch(SRC, /the charge runs from here/,
    'that tooltip stated the reversed rule')
})
