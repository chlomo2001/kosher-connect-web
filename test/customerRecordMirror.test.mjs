// The browser copy of the customer record, held to lib/customerRecord.mjs.
//
// The record decides what a person still has running, what is finished, and in
// what order both read. Drift between the two copies would show one answer on
// the page and a different one anywhere else that asks — so they are compared
// on the same awkward data rather than trusted to look similar.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  KINDS, serviceUnits, groupUnits, recordSummary, recordHeadline,
} from '../lib/customerRecord.mjs'

const SRC = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')
function liftMirror() {
  const m = SRC.match(/\/\/ ── KC_RECORD mirror start ──\n([\s\S]*?)\n\/\/ ── KC_RECORD mirror end ──/)
  assert.ok(m, 'KC_RECORD mirror region not found in public/main.js')
  return new Function(`${m[1]}; return KC_RECORD;`)()
}

const TODAY = '2026-08-20'

// Deliberately awkward: every kind, both sides of every ended() rule, mixed
// casing on the statuses, missing dates, and a flight either side of today.
const LISTS = {
  sim: [
    { id: 's1', provider: 'Lebara', simNumber: '+447400555001', status: 'active', renewalDate: '2026-08-25' },
    { id: 's2', provider: 'Smarty', simNumber: '+447400555002', status: 'cancelled', renewalDate: '2026-05-01' },
    { id: 's3', provider: 'spusu', status: 'suspended', expiryDate: '2026-09-30' },
    { id: 's4', status: '' },
  ],
  rental: [
    { id: 'r1', country: 'USA', phoneNumber: '+15185550101', status: 'active', toDate: '2026-08-22' },
    { id: 'r2', country: 'Israel', status: 'Returned', toDate: '2026-07-02' },
    { id: 'r3', status: 'overdue', toDate: '2026-08-01' },
    { id: 'r4', status: 'VOID', toDate: '2026-06-01' },
  ],
  vn: [
    { id: 'v1', number: '+17325550123', status: 'Active' },
    { id: 'v2', number: '+17325550124', status: 'Cancelled' },
    { id: 'v3', number: '+17325550125', status: 'active' },
  ],
  booking: [
    { id: 'b1', route: 'MAN → TLV', travelDate: '2026-07-01', status: 'confirmed' },
    { id: 'b2', route: 'LTN → TLV', travelDate: '2026-09-10', status: 'confirmed', bookingRef: 'ABC123' },
    { id: 'b3', route: 'STN → TLV', travelDate: '2026-09-20', status: 'Cancelled' },
    { id: 'b4', route: 'no date' },
  ],
  repair: [
    { id: 'rp1', device: 'Nokia 105', status: 'Collected', openedAt: '2026-06-01' },
    { id: 'rp2', device: 'Nokia 110', status: 'Open', openedAt: '2026-08-10' },
    { id: 'rp3', status: 'cancelled' },
  ],
  service: [{ id: 'o1', serviceName: 'Passport photos', createdAt: '2026-08-05' }],
}

test('the browser mirror splits and orders the record exactly as the lib does', () => {
  const B = liftMirror()
  assert.deepEqual(Object.keys(B.KINDS), Object.keys(KINDS),
    'the two disagree about which kinds of thing a customer can have')

  const mine = serviceUnits(LISTS, TODAY)
  const theirs = B.serviceUnits(LISTS, TODAY)
  assert.deepEqual(theirs, mine, 'the two build different units from the same data')

  const g1 = groupUnits(mine)
  const g2 = B.groupUnits(theirs)
  assert.deepEqual(g2.running.map((u) => u.id), g1.running.map((u) => u.id),
    'running things come out in a different order')
  assert.deepEqual(g2.finished.map((u) => u.id), g1.finished.map((u) => u.id),
    'finished things come out in a different order')

  assert.deepEqual(B.recordSummary(theirs), recordSummary(mine))
  assert.equal(B.recordHeadline(B.recordSummary(theirs)), recordHeadline(recordSummary(mine)))
})

test('the mirror agrees on the empty and the lapsed customer too', () => {
  const B = liftMirror()
  for (const lists of [{}, { sim: [] }, { sim: [{ id: 'x', status: 'cancelled' }] }, { sim: [null] }]) {
    const mine = serviceUnits(lists, TODAY)
    const theirs = B.serviceUnits(lists, TODAY)
    assert.deepEqual(theirs, mine)
    assert.equal(B.recordHeadline(B.recordSummary(theirs)), recordHeadline(recordSummary(mine)),
      `headline differs for ${JSON.stringify(lists)}`)
  }
})

test('both copies agree that a flown flight is over', () => {
  // The rule most likely to be "simplified" back out by someone who reads
  // ended() as meaning cancelled. Flown flights sat under Active Services for
  // as long as the badges existed.
  const B = liftMirror()
  const flown = { booking: [{ id: 'f', route: 'MAN → TLV', travelDate: '2026-08-19', status: 'confirmed' }] }
  const soon = { booking: [{ id: 'f', route: 'MAN → TLV', travelDate: '2026-08-21', status: 'confirmed' }] }
  assert.equal(serviceUnits(flown, TODAY)[0].ended, true)
  assert.equal(B.serviceUnits(flown, TODAY)[0].ended, true)
  assert.equal(serviceUnits(soon, TODAY)[0].ended, false)
  assert.equal(B.serviceUnits(soon, TODAY)[0].ended, false)
})
