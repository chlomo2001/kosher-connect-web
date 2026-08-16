// Owner-added repair stages, and the five that carry meaning. Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SYSTEM_STATUSES, CLOSED_STATUSES, isOpenStatus, isSystemStatus,
  cleanStages, orderedStatuses, statusesFromCsv,
} from '../lib/repairStatuses.mjs'

test('THE SAFETY PROPERTY — an owner-added stage is an OPEN job', () => {
  // Everything in the app tests "not Collected and not Cancelled" to decide
  // whether a repair is still live. That is what lets the owner invent stages
  // without touching the money path or the open-repair counts.
  assert.equal(isOpenStatus('Waiting for part'), true)
  assert.equal(isOpenStatus('Quote sent'), true)
  assert.equal(isOpenStatus('Open'), true)
  assert.equal(isOpenStatus('Ready'), true)
  assert.equal(isOpenStatus('Collected'), false)
  assert.equal(isOpenStatus('Cancelled'), false)
})

test('the two closing statuses are exactly the two that must stay', () => {
  assert.deepEqual(CLOSED_STATUSES, ['Collected', 'Cancelled'])
  for (const s of CLOSED_STATUSES) assert.ok(SYSTEM_STATUSES.includes(s))
})

test('a custom stage may NOT impersonate a system one', () => {
  // Two "Collected"s in one dropdown, one of which does not charge, is the
  // worst outcome available here.
  const { list, warnings } = cleanStages('Waiting for part, Collected, collected , COLLECTED')
  assert.deepEqual(list, ['Waiting for part'])
  assert.equal(warnings.length, 3)
  assert.match(warnings[0], /built-in/)
})

test('system names are recognised however they are typed', () => {
  assert.equal(isSystemStatus('collected'), true)
  assert.equal(isSystemStatus('  In   Progress '), true)
  assert.equal(isSystemStatus('Waiting for part'), false)
  assert.equal(isSystemStatus(''), false)
})

test('stages are cleaned the same way as the other owner lists', () => {
  const { list } = cleanStages("Waiting for part, Quote sent, Customer approved, Waiting For Part")
  assert.deepEqual(list, ['Waiting for part', 'Quote sent', 'Customer approved'])  // deduped
  assert.deepEqual(cleanStages('  ,  , ').list, [])
  assert.equal(cleanStages('x'.repeat(80)).list[0].length, 40)                     // capped
  assert.deepEqual(cleanStages('Waiting <script>').list, ['Waiting script'])       // stripped
})

test('an apostrophe survives — "Customer hasn\'t replied" is a real stage', () => {
  assert.deepEqual(cleanStages("Customer hasn't replied").list, ["Customer hasn't replied"])
})

test('custom stages sit where a repair actually waits', () => {
  assert.deepEqual(orderedStatuses(['Waiting for part']),
    ['Open', 'In Progress', 'Waiting for part', 'Ready', 'Collected', 'Cancelled'])
})

test('with no custom stages the list is exactly what shipped before', () => {
  assert.deepEqual(orderedStatuses([]), SYSTEM_STATUSES)
  assert.deepEqual(orderedStatuses(), SYSTEM_STATUSES)
  assert.deepEqual(statusesFromCsv(''), SYSTEM_STATUSES)
  assert.deepEqual(statusesFromCsv(null), SYSTEM_STATUSES)
})

test('a stored list round-trips through the CSV', () => {
  assert.deepEqual(statusesFromCsv('Waiting for part,Quote sent'),
    ['Open', 'In Progress', 'Waiting for part', 'Quote sent', 'Ready', 'Collected', 'Cancelled'])
})

test('a system name smuggled into the stored CSV is ignored on read', () => {
  // Belt and braces: even if the row is edited in SQL, the dropdown cannot end
  // up with two Collecteds.
  assert.deepEqual(statusesFromCsv('Collected,Waiting for part'),
    ['Open', 'In Progress', 'Waiting for part', 'Ready', 'Collected', 'Cancelled'])
})
