// #19 — the typed-column customer read path + drift detector. Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { customerToRow, customerRowFromTyped, customerDrift } from '../lib/mappers.js'

const APP = {
  id: '1720000000000',
  firstName: 'Rivka',
  lastName: 'Klein',
  phone: '+44 7911 123456',
  email: 'Rivka.Klein+news@Gmail.com',
  address: '12 Cazenove Rd',
  passportOnFile: true,
  hasWhatsapp: false,
  notes: 'Prefers evening pickups',
  createdAt: '2026-05-01T10:00:00.000Z',
  // app-only fields with no typed column — must survive the read:
  history: [{ type: 'rental', amount: 30 }],
  services: [{ type: 'sim' }],
  commLog: [{ type: 'call_in', text: 'called' }],
  totalPaid: 30,
}

test('typed row round-trips back to the app shape', () => {
  const row = customerToRow(APP)
  const back = customerRowFromTyped(row)
  assert.equal(back.firstName, 'Rivka')
  assert.equal(back.lastName, 'Klein')
  assert.equal(back.phone, '+44 7911 123456')
  assert.equal(back.email, 'Rivka.Klein+news@Gmail.com')
  assert.equal(back.address, '12 Cazenove Rd')
  assert.equal(back.passportOnFile, true)
  assert.equal(back.notes, 'Prefers evening pickups')
})

test('app-only fields survive the typed read (nothing lost)', () => {
  const back = customerRowFromTyped(customerToRow(APP))
  assert.deepEqual(back.history, APP.history)
  assert.deepEqual(back.services, APP.services)
  assert.deepEqual(back.commLog, APP.commLog)
  assert.equal(back.totalPaid, 30)
})

test('a consistent row shows no drift', () => {
  assert.deepEqual(customerDrift(customerToRow(APP)), [])
})

test('drift is detected when a typed column diverges from legacy_extras', () => {
  const row = customerToRow(APP)
  row.first_name = 'Rywka' // typed column edited out of band
  const diffs = customerDrift(row)
  assert.equal(diffs.length, 1)
  assert.equal(diffs[0].field, 'first_name')
  assert.equal(diffs[0].typed, 'Rywka')
  assert.equal(diffs[0].derived, 'Rivka')
})

test('typed columns win over stale extras on read', () => {
  const row = customerToRow(APP)
  row.address = '99 New Street' // authoritative typed value
  const back = customerRowFromTyped(row)
  assert.equal(back.address, '99 New Street')
})
