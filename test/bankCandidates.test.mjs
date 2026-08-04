// Candidate assembly for the bank matcher. Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildCandidates } from '../lib/bankCandidates.mjs'
import { proposeMatches } from '../lib/bankMatch.mjs'

const customers = [
  { id: 'u1', legacy_id: '101', first_name: 'Moshe', last_name: 'Kopilowitz' },
  { id: 'u2', legacy_id: '102', first_name: 'Rivka', last_name: 'Gross' },
  { id: 'u3', legacy_id: null, first_name: '', last_name: '' },   // nameless — unmatched anywhere
]
const balances = [
  { customer_id: 'u1', balance: -285 },   // owes £285
  { customer_id: 'u2', balance: 40 },     // in credit — expects nothing
]
const bookings = [
  { customer_id: 'u1', booking_reference: 'bnkyrw', travel_date: '2026-08-02' },
  { customer_id: 'u1', booking_reference: 'BNKYRW', travel_date: '2026-07-01' }, // dup, older
  { customer_id: 'u2', booking_reference: 'not-a-ref!', travel_date: null },
]

test('buildCandidates — arrears, refs and due dates land on the right people', () => {
  const cands = buildCandidates({ customers, balances, bookings })
  assert.equal(cands.length, 2)                       // the nameless row is dropped
  const moshe = cands.find((c) => c.customerUuid === 'u1')
  assert.equal(moshe.customerId, '101')
  assert.equal(moshe.expectedAmount, 285)             // owed → positive expected-in
  assert.deepEqual(moshe.references, ['BNKYRW'])      // uppercased, deduped
  assert.equal(moshe.dueAt, '2026-08-02')             // latest travel date wins
  const rivka = cands.find((c) => c.customerUuid === 'u2')
  assert.equal(rivka.expectedAmount, null)            // credit is not an expectation
  assert.deepEqual(rivka.references, [])              // junk ref shape rejected
})

test('buildCandidates output feeds proposeMatches end-to-end', () => {
  const cands = buildCandidates({ customers, balances, bookings })
  const txn = { amount: 285, bookedAt: '2026-07-30', description: 'BGC BNKYRW', counterpartyName: 'KOPILOWITZ M' }
  const { best, ambiguous } = proposeMatches(txn, cands)
  assert.equal(best.candidate.customerUuid, 'u1')
  assert.equal(best.confidence, 'strong')             // ref + amount + name agree
  assert.equal(ambiguous, false)
})
