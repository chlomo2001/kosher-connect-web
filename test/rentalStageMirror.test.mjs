// The stages a hire passes through, and the browser copy of the rule.
//
// Shloime, 27 Aug: "at each rental there should be … 'reserved'/booked state,
// fetched, and then active, non active and returned. and at each stage - even
// only reserved - shall be recorded on customers card. so that even when
// fetched from shop, it shouldnt raise a task or flag that the customer is
// stuck cuz its not activated in a pool etc., as theyre not yet flown. only
// when the date for that reservation comes, 24hr before it should be raised."
//
// The missing state was FETCHED. getComputedStatus had no room for it —
// `if (r.status !== 'returned') return r.toDate < today ? 'overdue' : 'active'`
// — so a phone collected a fortnight early read Active, and everything
// watching active rentals started asking why its line was not live.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  rentalStage, readinessDue, readyFrom, stageLabel, stageTone,
  READY_LEAD_DAYS, RETURN_GRACE_DAYS, ON_CUSTOMER_CARD, OUT_WITH_CUSTOMER,
  dueBackDate, lateFeeFrom,
} from '../lib/rentalStage.mjs'

const SRC = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')
const lift = () => {
  const m = SRC.match(/\/\/ ── KC_STAGE mirror start ──\n([\s\S]*?)\n\/\/ ── KC_STAGE mirror end ──/)
  assert.ok(m, 'KC_STAGE mirror region not found in public/main.js')
  return new Function(`${m[1]}; return KC_STAGE;`)()
}

const CASES = []
for (const status of ['booked', 'active', 'overdue', 'returned']) {
  for (const from of ['2026-08-20', '2026-09-01', '2026-09-02', '2026-09-10', null]) {
    for (const to of ['2026-08-25', '2026-09-01', '2026-10-10', null]) {
      for (const pickup of [null, '2026-08-19', '2026-09-01']) {
        CASES.push({ status, fromDate: from, toDate: to, pickupDate: pickup })
      }
    }
  }
}
const TODAY = '2026-09-01'

test('the browser mirror stages exactly what the lib stages', () => {
  const B = lift()
  for (const r of CASES) {
    // Every grace the owner could plausibly set, including 0 (chase from day
    // one, the behaviour before the ended stage existed) and a value nothing
    // will reach.
    for (const grace of [undefined, 0, 1, 3, 7, 90]) {
      assert.equal(B.rentalStage(r, TODAY, false, grace), rentalStage(r, TODAY, false, grace),
        `${JSON.stringify(r)} @ grace ${grace}`)
      assert.equal(B.readinessDue(r, TODAY, grace), readinessDue(r, TODAY, grace),
        `${JSON.stringify(r)} @ grace ${grace}`)
    }
  }
})

test('the mirror agrees on the labels, the tone and the lead time', () => {
  const B = lift()
  for (const st of ['reserved', 'fetched', 'active', 'ended', 'overdue', 'returned', 'returned_incomplete']) {
    assert.equal(B.stageLabel(st), stageLabel(st))
    assert.equal(B.stageTone(st, false), stageTone(st, false))
    assert.equal(B.stageTone(st, true), stageTone(st, true))
  }
  assert.equal(B.READY_LEAD_DAYS, READY_LEAD_DAYS, 'both copies must agree what 24 hours means')
  assert.equal(B.RETURN_GRACE_DAYS, RETURN_GRACE_DAYS, 'both copies must fall back to the same grace')
  assert.deepEqual(B.ON_CUSTOMER_CARD, ON_CUSTOMER_CARD)
  assert.deepEqual(B.OUT_WITH_CUSTOMER, OUT_WITH_CUSTOMER)
})

test('a phone in the shop is reserved; collected early it is fetched', () => {
  const base = { status: 'booked', fromDate: '2026-09-20', toDate: '2026-10-10' }
  assert.equal(rentalStage(base, TODAY), 'reserved')
  assert.equal(rentalStage({ ...base, status: 'active', pickupDate: '2026-09-01' }, TODAY), 'fetched')
})

test('nothing is asked of a phone that is not travelling yet', () => {
  // The flag Shloime asked to have taken off his back.
  const early = { status: 'active', fromDate: '2026-09-20', toDate: '2026-10-10', pickupDate: '2026-09-01' }
  assert.equal(readinessDue(early, TODAY), false)
})

test('…and it is asked exactly 24 hours before, not sooner', () => {
  const r = { status: 'active', fromDate: '2026-09-02', toDate: '2026-10-10', pickupDate: '2026-08-30' }
  assert.equal(readyFrom(r), '2026-09-01')
  assert.equal(readinessDue(r, '2026-08-31'), false, 'two days out — still quiet')
  assert.equal(readinessDue(r, '2026-09-01'), true, 'the day before — now it matters')
  assert.equal(readinessDue(r, '2026-09-02'), true, 'and on the day')
})

test('a running or overdue hire is always the shop’s problem', () => {
  assert.ok(readinessDue({ status: 'active', fromDate: '2026-08-20', toDate: '2026-10-10' }, TODAY))
  // 2026-08-25 against TODAY 2026-09-01 is seven days past — inside the fee
  // window is 'ended' and quiet on readiness, so this pins the OVERDUE side.
  assert.ok(readinessDue({ status: 'active', fromDate: '2026-07-01', toDate: '2026-08-20' }, TODAY))
})

test('a returned hire asks for nothing', () => {
  assert.equal(rentalStage({ status: 'returned', fromDate: '2026-07-01', toDate: '2026-08-25' }, TODAY), 'returned')
  assert.equal(readinessDue({ status: 'returned', fromDate: '2026-07-01', toDate: '2026-08-25' }, TODAY), false)
})

test('every stage a customer could care about is on their card', () => {
  // "at each stage - even only reserved - shall be recorded on customers card"
  for (const st of ['reserved', 'fetched', 'active', 'overdue']) {
    assert.ok(ON_CUSTOMER_CARD.includes(st), `${st} must show on the card`)
  }
  assert.ok(!ON_CUSTOMER_CARD.includes('returned'), 'a closed hire is history, not a holding')
})

test('the customer card actually uses the list', () => {
  assert.match(SRC, /ON_CUSTOMER_CARD\.includes\(KC_STAGE\.rentalStage\(/,
    'the card must filter by stage, not by stored status')
})

test('the pool badge waits for readiness too', () => {
  assert.match(SRC, /poolCoverBadge[\s\S]{0,600}?readinessDue/,
    'a pool warning on a phone nobody is travelling with is noise')
})


// ── "non active": home, and the phone has not come back ────────────────────
//
// Shloime, asked what he meant by it: "the person is back, but hasnt retuned
// the phone/sim, so the line doesnt have to be actively running, but still its
// not available yet until physically back".
//
// Three separate claims, and each one is a test below: it is not active, it is
// not chased, and it is not available.

const HIRE = { status: 'active', fromDate: '2026-08-01', toDate: '2026-08-20' }

test('the day after the dates end the hire is home, not overdue', () => {
  assert.equal(rentalStage(HIRE, '2026-08-20'), 'active', 'the last day is still the trip')
  assert.equal(rentalStage(HIRE, '2026-08-21'), 'ended', 'due back the day AFTER the hire ends')
  assert.equal(rentalStage(HIRE, '2026-08-27'), 'ended', 'still inside the seven-day window')
  assert.equal(rentalStage(HIRE, '2026-08-28'), 'overdue', 'past it — chased, and now charged')
})

test('the grace is the owner\'s to set, and zero restores the old behaviour', () => {
  assert.equal(rentalStage(HIRE, '2026-08-21', false, 0), 'overdue')
  assert.equal(rentalStage(HIRE, '2026-08-23', false, 3), 'ended')
  assert.equal(rentalStage(HIRE, '2026-08-24', false, 3), 'overdue')
  // Rubbish in settings must not silently mean "never chase anyone" — it falls
  // back to the default rather than to infinity.
  assert.equal(rentalStage(HIRE, '2026-08-28', false, NaN), 'overdue')
  assert.equal(rentalStage(HIRE, '2026-08-28', false, -5), 'overdue')
})

test('nobody is asked whether the line is live once the customer is home', () => {
  assert.equal(readinessDue(HIRE, '2026-08-20'), true, 'mid-trip the line matters')
  assert.equal(readinessDue(HIRE, '2026-08-21'), false, 'he has landed — the pool is nobody\'s problem')
  assert.equal(readinessDue(HIRE, '2026-08-27'), false)
})

test('the phone is still with the customer, so it is not available to hire out', () => {
  for (const today of ['2026-08-20', '2026-08-21', '2026-08-27', '2026-08-28']) {
    assert.ok(OUT_WITH_CUSTOMER.includes(rentalStage(HIRE, today)),
      `${today}: the handset has not come back, so it cannot be free stock`)
  }
  assert.ok(!OUT_WITH_CUSTOMER.includes('returned'))
  assert.ok(!OUT_WITH_CUSTOMER.includes('reserved'), 'a reservation blocks dates, not the shelf')
})

test('every stage of a hire shows on the customer card, ended included', () => {
  for (const today of ['2026-07-25', '2026-08-05', '2026-08-21', '2026-08-30']) {
    assert.ok(ON_CUSTOMER_CARD.includes(rentalStage(HIRE, today)), today)
  }
})

test('due back is amber — a job for the shop, not a fault of the customer', () => {
  // Owner, 28 Aug: "(and come up as task, amber bla bla)". Amber because
  // somebody has to go and get the phone, not because anybody has done wrong —
  // and it still costs the customer nothing until the fee window opens.
  assert.equal(stageTone('ended'), 'warning')
  assert.equal(stageTone('overdue'), 'danger')
  assert.notEqual(stageLabel('ended'), stageLabel('overdue'))
})

// ── Due back, and the seven days that are not billed ──────────────────────
//
// Owner, 28 Aug: "change rental returns rule - due date is always a day after
// arrival - end of rental, (and come up as task, amber bla bla) but late fees
// only once past 7 days."

test('a hire is due back the day after it ends, not on the day it ends', () => {
  assert.equal(dueBackDate('2026-08-20'), '2026-08-21')
  assert.equal(dueBackDate('2026-12-31'), '2027-01-01', 'and over a year end')
  assert.equal(dueBackDate(null), null)
})

test('the late fee does not start until the window has passed', () => {
  // toDate 20th → due back 21st → first chargeable day the 28th.
  assert.equal(lateFeeFrom('2026-08-20'), '2026-08-28')
  assert.equal(lateFeeFrom('2026-08-20', 0), '2026-08-21', 'zero = charge from due back')
  assert.equal(lateFeeFrom('2026-08-20', 14), '2026-09-04')
  assert.equal(lateFeeFrom(null), null)
})

test('due back and the first chargeable day are not the same day', () => {
  // The whole point of the change: a phone can be late and free at once.
  const due = dueBackDate('2026-08-20')
  const billed = lateFeeFrom('2026-08-20')
  assert.ok(due < billed, `${due} must come before ${billed}`)
  assert.equal(rentalStage(HIRE, due), 'ended', 'due back, chased, not charged')
  assert.equal(rentalStage(HIRE, billed), 'overdue', 'and now charged')
})
