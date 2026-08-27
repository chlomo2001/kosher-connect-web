// The five stages a hire passes through, and the browser copy of the rule.
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
  READY_LEAD_DAYS, ON_CUSTOMER_CARD,
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
    assert.equal(B.rentalStage(r, TODAY), rentalStage(r, TODAY), JSON.stringify(r))
    assert.equal(B.readinessDue(r, TODAY), readinessDue(r, TODAY), JSON.stringify(r))
  }
})

test('the mirror agrees on the labels, the tone and the lead time', () => {
  const B = lift()
  for (const st of ['reserved', 'fetched', 'active', 'overdue', 'returned', 'returned_incomplete']) {
    assert.equal(B.stageLabel(st), stageLabel(st))
    assert.equal(B.stageTone(st, false), stageTone(st, false))
    assert.equal(B.stageTone(st, true), stageTone(st, true))
  }
  assert.equal(B.READY_LEAD_DAYS, READY_LEAD_DAYS, 'both copies must agree what 24 hours means')
  assert.deepEqual(B.ON_CUSTOMER_CARD, ON_CUSTOMER_CARD)
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
  assert.ok(readinessDue({ status: 'active', fromDate: '2026-07-01', toDate: '2026-08-25' }, TODAY))
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
