// The questions asked before a flight is booked. Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bookingGateFor, bookingGateSummary, BLOCK, VERIFY, PASS } from '../lib/bookingGate.mjs'

const TODAY = '2026-08-16'
const base = { travelDate: '2026-09-20', passportOnFile: true, passportExpiry: '2030-01-01' }

test('a complete booking passes cleanly', () => {
  const g = bookingGateFor(base, { today: TODAY })
  assert.equal(g.worst, PASS)
  assert.equal(g.canProceed, true)
  assert.deepEqual(g.checks, [])
  assert.equal(bookingGateSummary(g), 'Nothing outstanding')
})

test('THE ONE THAT BLOCKS — a passport that expires before the flight', () => {
  // Not a judgement call and not overridable: the trip cannot happen on this
  // document, and letting it through would sell someone a flight they cannot take.
  const g = bookingGateFor({ ...base, passportExpiry: '2026-09-01' }, { today: TODAY })
  assert.equal(g.worst, BLOCK)
  assert.equal(g.canProceed, false)
  assert.match(g.checks[0].title, /expires before the travel date/)
  assert.match(g.checks[0].detail, /19 days before/)
})

test('a passport with under six months left WARNS, it does not block', () => {
  // The six-month rule is a rule of thumb with real exceptions, so the person
  // who can see the document decides.
  const g = bookingGateFor({ ...base, passportExpiry: '2026-10-01' }, { today: TODAY })
  assert.equal(g.worst, VERIFY)
  assert.equal(g.canProceed, true)
  assert.match(g.checks[0].title, /valid only 11 days after travel/)
})

test('no passport copy on file is a question, not a refusal', () => {
  const g = bookingGateFor({ ...base, passportOnFile: false }, { today: TODAY })
  assert.equal(g.worst, VERIFY)
  assert.equal(g.canProceed, true)
  assert.equal(g.checks[0].key, 'passport-on-file')
})

test('a missing expiry date is its own question', () => {
  const g = bookingGateFor({ travelDate: '2026-09-20', passportOnFile: true }, { today: TODAY })
  assert.equal(g.checks[0].key, 'passport-expiry-unknown')
  assert.equal(g.worst, VERIFY)
})

test('a named member of staff clears a VERIFY, and only that one', () => {
  const booking = { ...base, passportOnFile: false, passportExpiry: '2026-10-01' }
  const g1 = bookingGateFor(booking, { today: TODAY })
  assert.equal(g1.checks.length, 2)
  const g2 = bookingGateFor(booking, { today: TODAY, verifications: ['passport-on-file'] })
  assert.equal(g2.checks.find(c => c.key === 'passport-on-file').level, PASS)
  assert.equal(g2.checks.find(c => c.key === 'passport-thin').level, VERIFY)
  assert.equal(g2.worst, VERIFY)
})

test('a BLOCK cannot be signed away', () => {
  const g = bookingGateFor({ ...base, passportExpiry: '2026-09-01' },
    { today: TODAY, verifications: ['passport-expired'] })
  assert.equal(g.worst, BLOCK)
  assert.equal(g.canProceed, false)
})

test('travel authorisation — missing asks, expired-before-travel blocks', () => {
  const req = { code: 'ETA_IL', note: 'Israel needs an ETA-IL.' }
  const missing = bookingGateFor(base, { today: TODAY, requirement: req, coverage: { status: 'missing' } })
  assert.equal(missing.worst, VERIFY)
  assert.match(missing.checks[0].title, /No ETA_IL on record/)

  const expired = bookingGateFor(base, {
    today: TODAY, requirement: req,
    coverage: { status: 'expiring', expiresBeforeTravel: true, validUntil: '2026-09-01' },
  })
  assert.equal(expired.worst, BLOCK)
  assert.equal(expired.canProceed, false)
})

test('"not needed" and "check" behave differently', () => {
  const none = bookingGateFor(base, {
    today: TODAY, requirement: { code: 'NONE' }, coverage: { status: 'not-needed' },
  })
  assert.equal(none.worst, PASS)

  const check = bookingGateFor(base, {
    today: TODAY, requirement: { code: 'CHECK', note: 'Rules unclear.' }, coverage: { status: 'check' },
  })
  assert.equal(check.worst, VERIFY)
  assert.equal(check.checks[0].detail, 'Rules unclear.')
})

test('no travel date means no passport-vs-travel arithmetic', () => {
  const g = bookingGateFor({ passportOnFile: true, passportExpiry: '2026-01-01' }, { today: TODAY })
  assert.deepEqual(g.checks, [])   // nothing to compare against yet
})

test('snake_case rows from the database read the same as app objects', () => {
  const g = bookingGateFor(
    { travel_date: '2026-09-20', passport_on_file: true, passport_expiry: '2026-09-01' },
    { today: TODAY })
  assert.equal(g.worst, BLOCK)
})

test('the summary names the blocker, or counts the questions', () => {
  const blocked = bookingGateFor({ ...base, passportExpiry: '2026-09-01' }, { today: TODAY })
  assert.match(bookingGateSummary(blocked), /expires before the travel date/)
  const asks = bookingGateFor({ ...base, passportOnFile: false }, { today: TODAY })
  assert.equal(bookingGateSummary(asks), '1 thing to confirm')
})
