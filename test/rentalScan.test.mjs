// Scan-to-check-out / scan-to-return. Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveRentalScan } from '../lib/rentalScan.mjs'

const PHONES = [
  { id: 'p1', imei: '353918080123456', number: '07700900001', model: 'Nokia 105', status: 'available' },
  { id: 'p2', imei: '353918080999999', number: '07700900002', model: 'Nokia 110', status: 'rented' },
  { id: 'p3', imei: '353918080777777', number: '07700900003', model: 'Alcatel', status: 'available', maintenance: true, maintenanceReason: 'cracked screen' },
  { id: 'p4', imei: '', number: '00447700900004', model: 'No-IMEI unit', status: 'available' },
  { id: 'p5', imei: '353918080555555', number: '07700900005', model: 'Retired unit', status: 'lost' },
]
const RENTALS = [
  { id: 'r1', phoneId: 'p2', status: 'active', customerName: 'A. Customer' },
  { id: 'r2', phoneId: 'p1', status: 'returned', customerName: 'Old Customer' },
]

test('a phone that is out comes back', () => {
  const r = resolveRentalScan('353918080999999', PHONES, RENTALS)
  assert.equal(r.action, 'return')
  assert.equal(r.rentalId, 'r1')
  assert.equal(r.phoneId, 'p2')
  assert.match(r.message, /A\. Customer/)
})

test('a free phone goes out — a settled past rental does not count as open', () => {
  const r = resolveRentalScan('353918080123456', PHONES, RENTALS)
  assert.equal(r.action, 'checkout')
  assert.equal(r.phoneId, 'p1')
})

test('an overdue rental is still an open one', () => {
  const overdue = [{ id: 'r9', phoneId: 'p1', status: 'overdue', customerName: 'Late Customer' }]
  assert.equal(resolveRentalScan('353918080123456', PHONES, overdue).action, 'return')
})

test('maintenance hold blocks the check-out and says why', () => {
  const r = resolveRentalScan('353918080777777', PHONES, RENTALS)
  assert.equal(r.action, 'blocked')
  assert.match(r.message, /cracked screen/)
})

test('a phone out on rental returns even if it is also on maintenance hold', () => {
  // The customer is at the counter holding it — taking it back must not be
  // blocked by an inventory flag someone set while it was away.
  const phones = [{ ...PHONES[2], id: 'p3' }]
  const rentals = [{ id: 'r3', phoneId: 'p3', status: 'active', customerName: 'B. Customer' }]
  assert.equal(resolveRentalScan('353918080777777', phones, rentals).action, 'return')
})

test('a non-available phone with no open rental is blocked, not checked out', () => {
  const r = resolveRentalScan('353918080555555', PHONES, RENTALS)
  assert.equal(r.action, 'blocked')
  assert.match(r.message, /lost/)
})

test('number fallback matches on the last 10 digits, any prefix shape', () => {
  for (const q of ['07700900004', '447700900004', '00447700900004', '+44 7700 900004']) {
    const r = resolveRentalScan(q, PHONES, RENTALS)
    assert.equal(r.action, 'checkout', `failed for ${q}`)
    assert.equal(r.phoneId, 'p4')
  }
})

test('IMEI is preferred over the number when both could match', () => {
  const phones = [
    { id: 'a', imei: '', number: '07700900123', model: 'By number', status: 'available' },
    { id: 'b', imei: '07700900123', number: '07700900999', model: 'By IMEI', status: 'available' },
  ]
  assert.equal(resolveRentalScan('07700900123', phones, []).phoneId, 'b')
})

test('empty scan is silent, not an error', () => {
  const r = resolveRentalScan('   ', PHONES, RENTALS)
  assert.equal(r.action, 'none')
  assert.equal(r.message, '')
})

test('an unknown scan explains itself and quotes what was scanned', () => {
  const r = resolveRentalScan('123456789012345', PHONES, RENTALS)
  assert.equal(r.action, 'none')
  assert.match(r.message, /123456789012345/)
})

test('a short stray scan cannot match a longer IMEI by tail', () => {
  // '123456' tails to '123456'; p1's IMEI tails to '8080123456'. Different.
  assert.equal(resolveRentalScan('123456', PHONES, RENTALS).action, 'none')
})

test('missing collections do not throw', () => {
  assert.equal(resolveRentalScan('353918080123456').action, 'none')
  assert.equal(resolveRentalScan('353918080123456', PHONES).action, 'checkout')
})

test('a phone with no IMEI recorded is never matched by an empty IMEI', () => {
  // p4 has imei:'' — scanning another phone's IMEI must not fall onto it.
  const r = resolveRentalScan('353918080123456', PHONES, RENTALS)
  assert.equal(r.phoneId, 'p1')
})
