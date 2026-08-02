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
  // Canonical digits in the typed columns, owner's 4-3-3 grouping on the way
  // back out (sweep #17) — not the input's own spacing.
  assert.equal(back.phone, '+44 7911 123 456')
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

// One person, one (code, number) pair — the unique index only works if every
// way of writing a number splits identically (sweep #17).
test('splitPhone collapses every format of one number to one key', async () => {
  const { splitPhone } = await import('../lib/mappers.js')
  const expected = { code: '+44', number: '7911123456' }
  assert.deepEqual(splitPhone('+44 7911 123456'), expected)
  assert.deepEqual(splitPhone('+447911123456'), expected)
  assert.deepEqual(splitPhone('07911 123456'), expected)
  assert.deepEqual(splitPhone('0044 7911-123-456'), expected)
  assert.deepEqual(splitPhone('0525115445'), { code: '+972', number: '525115445' })
  assert.deepEqual(splitPhone('+1 718 123 4567'), { code: '+1', number: '7181234567' })
  assert.deepEqual(splitPhone(''), { code: null, number: null })
  assert.deepEqual(splitPhone('LEBARA'), { code: null, number: 'LEBARA' })
})

// Gmail-aware sign-in email matching (staff Google login).
test('emailsMatchLoose: gmail dots and +tags are one mailbox', async () => {
  const { emailsMatchLoose } = await import('../lib/mappers.js')
  assert.equal(emailsMatchLoose('e.a.rothbart@gmail.com', 'earothbart@gmail.com'), true)
  assert.equal(emailsMatchLoose('EAROTHBART@GMAIL.COM', 'e.a.rothbart+kc@gmail.com'), true)
  assert.equal(emailsMatchLoose('earothbart@googlemail.com', 'e.a.rothbart@gmail.com'), true)
  assert.equal(emailsMatchLoose('same@example.com', 'same@example.com'), true)
  // Non-gmail domains: dots may be significant — exact match only.
  assert.equal(emailsMatchLoose('e.a@example.com', 'ea@example.com'), false)
  assert.equal(emailsMatchLoose('a@gmail.com', 'b@gmail.com'), false)
  assert.equal(emailsMatchLoose('', 'a@gmail.com'), false)
})
