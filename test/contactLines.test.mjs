// Contact number vs the SIMs we run for them. Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tail10, classifyContact, isContactSim, contactLabel } from '../lib/contactLines.mjs'

const SIMS = [
  { id: 's1', simNumber: '+447396843022', provider: 'Lebara', status: 'active' },
  { id: 's2', simNumber: '07423 287185', provider: 'Lebara', status: 'active' },
]

test('every way of writing a number compares equal', () => {
  assert.equal(tail10('+447396843022'), '7396843022')
  assert.equal(tail10('07396 843022'), '7396843022')
  assert.equal(tail10('00447396843022'), '7396843022')
  assert.equal(tail10('447396843022'), '7396843022')
  assert.equal(tail10('123'), '')
  assert.equal(tail10(null), '')
})

test('the contact number is one of our SIMs — the common case (440 customers)', () => {
  const r = classifyContact('07396 843022', SIMS)
  assert.equal(r.kind, 'ours')
  assert.equal(r.simId, 's1')
  assert.equal(r.provider, 'Lebara')
  assert.equal(contactLabel(r), 'Also their Lebara SIM with us')
})

test('the contact number is a line we do not provide (4 customers)', () => {
  const r = classifyContact('+447911123456', SIMS)
  assert.equal(r.kind, 'outside')
  assert.equal(contactLabel(r), 'Their own line — not a SIM we provide')
})

test('THE PILE THAT MATTERS — SIMs on file but no contact number (143 customers)', () => {
  // Lebrecht's shape: three active SIMs, nothing to ring. The record looks full
  // of numbers and none of them is known to be a handset he answers.
  const r = classifyContact('', SIMS)
  assert.equal(r.kind, 'none')
  assert.equal(contactLabel(r), 'No contact number on record')
  assert.equal(classifyContact(null, SIMS).kind, 'none')
  assert.equal(classifyContact('   ', SIMS).kind, 'none')
})

test('a customer with no SIMs at all still classifies', () => {
  assert.equal(classifyContact('07911123456', []).kind, 'outside')
  assert.equal(classifyContact('07911123456', undefined).kind, 'outside')
  assert.equal(classifyContact('', []).kind, 'none')
})

test('isContactSim marks the one line they actually answer', () => {
  assert.equal(isContactSim(SIMS[0], '07396843022'), true)
  assert.equal(isContactSim(SIMS[1], '07396843022'), false)
  assert.equal(isContactSim(SIMS[0], ''), false)      // no contact = no match
  assert.equal(isContactSim({}, '07396843022'), false)
})

test('it reads a `number` field too, for virtual numbers', () => {
  assert.equal(isContactSim({ number: '+447396843022' }, '07396843022'), true)
})
