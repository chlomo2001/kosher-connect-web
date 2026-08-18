// public/main.js carries its own copy of refKey/bookingForReference, because it
// is a classic browser script and cannot import lib/ticketMail.mjs. Two copies
// of a rule is how a rule starts being two different rules, so this holds them
// to the same answers — the same arrangement as pricingMirror and
// bookingGateMirror.
//
// What the rule decides: whether a ticket email is offering to make a booking
// that already exists. Get it wrong in one copy and the counter either books
// the same journey twice or cannot book a real one at all.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { bookingForReference, refKey } from '../lib/ticketMail.mjs'

const SRC = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')

function lift(name) {
  const re = new RegExp('function ' + name + '\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n\\}')
  const m = SRC.match(re)
  assert.ok(m, `${name} not found in public/main.js`)
  return m[0]
}
const browser = new Function(
  `${lift('refKey')}\n${lift('bookingForReference')}\nreturn { refKey, bookingForReference }`)()

const BOOKINGS = [
  { id: 1, bookingReference: 'BNKYRW', status: 'Booked' },
  { id: 2, bookingReference: 'XU2WWH', status: 'Cancelled' },
  { id: 3, bookingReference: 'AAAAAA', status: 'Ticketed', legs: [{ bookingReference: 'ZZ9ZZ9' }] },
  { id: 4, booking_reference: 'QK4T2M', status: 'Booked' },
  { id: 5, bookingReference: 'BA', status: 'Booked' },
]

const CASES = ['BNKYRW', 'bnkyrw', 'bnk-yrw', ' BNK YRW ', 'XU2WWH', 'ZZ9ZZ9', 'zz9zz9',
  'QK4T2M', 'BA', 'OK', '', '   ', 'NOTAREF', 'AAAAA', 'AAAAAA', null, undefined]

test('both copies pick the same booking for every reference', () => {
  for (const ref of CASES) {
    const mine = bookingForReference(ref, BOOKINGS)
    const theirs = browser.bookingForReference(ref, BOOKINGS)
    assert.equal(theirs?.id ?? null, mine?.id ?? null,
      `"${ref}": the module says ${mine?.id ?? 'no match'}, the browser says ${theirs?.id ?? 'no match'}`)
  }
})

test('both copies normalise a reference the same way', () => {
  for (const ref of CASES) {
    assert.equal(browser.refKey(ref), refKey(ref), `refKey("${ref}") differs`)
  }
})

test('the browser copy is really being exercised (a bad lift must fail loudly)', () => {
  assert.equal(browser.refKey('bnk-yrw'), 'BNKYRW')
  assert.equal(browser.bookingForReference('BNKYRW', BOOKINGS)?.id, 1)
})
