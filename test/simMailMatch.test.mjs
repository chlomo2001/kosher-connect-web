// Pairing carrier email → SIM. Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mailboxKey, ukMobilesIn, buildSimIndex, matchSimForMail } from '../lib/simMailMatch.mjs'
import { normalizeEmail } from '../lib/mappers.js'

// A miniature of the real shape: one tagged address per SIM, plus a pool
// address shared by two customers (the real ones carry up to 37 SIMs).
const SIMS = [
  { id: 's1', email: 'gitt.bilig+moshe@gmail.com', simNumber: '07349967598' },
  { id: 's2', email: 'gittbilig+rivky@gmail.com', simNumber: '+447778421543' },
  { id: 's3', email: 'shevabruches111@gmail.com', simNumber: '07807065243' },
  { id: 's4', email: 'sheva.bruches111@gmail.com', simNumber: '00447810803903' },
  { id: 's5', email: '', simNumber: '07552655390' },
]
const index = buildSimIndex(SIMS)

test('the +tag is kept — it is what separates one SIM from the next', () => {
  assert.equal(mailboxKey('gitt.bilig+moshe@gmail.com'), 'gittbilig+moshe@gmail.com')
  assert.notEqual(mailboxKey('gitt.bilig+moshe@gmail.com'), mailboxKey('gitt.bilig+rivky@gmail.com'))
})

test('THE TRAP — normalizeEmail would collapse every SIM in a base account', () => {
  // Sign-in identity says these are the same person, and it is right to.
  assert.equal(normalizeEmail('gitt.bilig+moshe@gmail.com'), normalizeEmail('gitt.bilig+rivky@gmail.com'))
  // Mail routing must not agree: 253 live SIMs sit under this one base.
  assert.notEqual(mailboxKey('gitt.bilig+moshe@gmail.com'), mailboxKey('gitt.bilig+rivky@gmail.com'))
})

test('gmail dots are noise, other domains keep them', () => {
  assert.equal(mailboxKey('red.far.bilig@gmail.com'), mailboxKey('redfarbilig@gmail.com'))
  assert.equal(mailboxKey('a.b@googlemail.com'), 'ab@gmail.com')
  assert.notEqual(mailboxKey('a.b@hotmail.co.uk'), mailboxKey('ab@hotmail.co.uk'))
})

test('header forms, case and padding all land on the same key', () => {
  assert.equal(mailboxKey('  Gitt Bilig <Gitt.Bilig+Moshe@Gmail.com> '), 'gittbilig+moshe@gmail.com')
  assert.equal(mailboxKey('not an address'), null)
  assert.equal(mailboxKey(''), null)
  assert.equal(mailboxKey(null), null)
})

test('numbers are found in every shape a carrier writes them', () => {
  assert.deepEqual(ukMobilesIn('Your 07349 967598 plan renews'), ['7349967598'])
  assert.deepEqual(ukMobilesIn('+447349967598'), ['7349967598'])
  assert.deepEqual(ukMobilesIn('00447349967598 and 07778421543'), ['7349967598', '7778421543'])
  assert.deepEqual(ukMobilesIn('landline 01615311386'), [])
  assert.deepEqual(ukMobilesIn(''), [])
})

test('a tagged address alone pairs the SIM', () => {
  const m = matchSimForMail({ to: 'gitt.bilig+moshe@gmail.com', subject: 'Your plan' }, index)
  assert.equal(m.simId, 's1')
  assert.equal(m.confidence, 'address')
})

test('a pool address is narrowed by the number in the text', () => {
  const m = matchSimForMail({
    deliveredTo: 'shevabruches111@gmail.com',
    subject: 'Renewal for 07810 803903',
  }, index)
  assert.equal(m.simId, 's4')          // the dotted spelling of the same pool
  assert.equal(m.confidence, 'address+number')
})

test('a pool address with nothing to narrow it is AMBIGUOUS, never a guess', () => {
  const m = matchSimForMail({ to: 'shevabruches111@gmail.com', subject: 'Your bill' }, index)
  assert.equal(m.simId, null)
  assert.equal(m.confidence, 'ambiguous')
  assert.equal(m.candidates.length, 2)  // both, for a human to settle
})

test('no address match still pairs on a known number', () => {
  const m = matchSimForMail({ to: 'someone.else@gmail.com', snippet: 'about 07552655390' }, index)
  assert.equal(m.simId, 's5')           // the SIM with no address on record
  assert.equal(m.confidence, 'number')
})

test('an unrecorded number comes back as a LEAD, not a silent drop', () => {
  const m = matchSimForMail({ to: 'stranger@gmail.com', subject: 'Welcome 07911 123456' }, index)
  assert.equal(m.simId, null)
  assert.equal(m.confidence, 'unknown')
  assert.deepEqual(m.numbers, ['7911123456'])   // this is the 54-a-fortnight pile
})

test('multiple recipients are all considered', () => {
  const m = matchSimForMail({ to: 'noise@example.com, gittbilig+rivky@gmail.com' }, index)
  assert.equal(m.simId, 's2')
  assert.equal(m.confidence, 'address')
})

test('an empty message matches nothing and does not throw', () => {
  const m = matchSimForMail({}, index)
  assert.equal(m.simId, null)
  assert.equal(m.confidence, 'unknown')
  assert.deepEqual(m.numbers, [])
})

test('SIMs with no address never collide on an empty key', () => {
  assert.equal(index.byAddress.has(null), false)
  assert.equal(index.byAddress.get('@gmail.com'), undefined)
})
