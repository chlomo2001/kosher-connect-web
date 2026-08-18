// The booking gate exists twice, and the two copies have to reach the same
// verdict.
//
// lib/bookingGate.mjs is the canonical statement of the rules (see
// test/bookingGate.test.mjs). public/main.js keeps its own copy, because that
// file is a classic script served from /public and cannot import anything —
// the counter needs the answer the moment save is pressed, not after a round
// trip. Same arrangement as pricingMirror.test.mjs, and the same reason for
// this file: nothing else stops the two drifting apart.
//
// It was written the day the rules changed shape — a document now has to
// outlive the RETURN, not the departure — which is exactly the kind of edit
// that gets made in one copy and forgotten in the other.
//
// Only the passport checks are compared: the browser copy deliberately stops
// there (travel authorisations need the rules matrix and the customer's
// recorded ETAs, which the server holds). If the browser copy ever grows them,
// this table is where they get pinned down.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { bookingGateFor } from '../lib/bookingGate.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = readFileSync(path.join(ROOT, 'public/main.js'), 'utf8')

const m = SRC.match(/function bookingGateFor\s*\([^)]*\)\s*\{[\s\S]*?\n\}/)
assert.ok(m, 'public/main.js must still define bookingGateFor')
// fmtDate only ever reaches the DETAIL sentence, and the two copies word that
// differently on purpose (the browser says "20 Sep 2026", the module says
// "2026-09-20"). Keys, levels and titles are what must agree.
// eslint-disable-next-line no-new-func
const clientGate = new Function(`
  const BK_BLOCK = 'block', BK_VERIFY = 'verify', BK_PASS = 'pass';
  const BK_SIX_MONTHS = 183;
  const fmtDate = (d) => String(d || '');
  ${m[0]};
  return bookingGateFor;
`)()

const CASES = [
  ['clean one-way', { travelDate: '2026-09-20', passportOnFile: true, passportExpiry: '2030-01-01' }],
  ['expired before the flight', { travelDate: '2026-09-20', passportOnFile: true, passportExpiry: '2026-09-01' }],
  ['thin passport', { travelDate: '2026-09-20', passportOnFile: true, passportExpiry: '2026-10-01' }],
  ['round trip, dies while abroad', { travelDate: '2026-09-20', returnDate: '2026-10-15', passportOnFile: true, passportExpiry: '2026-10-01' }],
  ['round trip, thin after the return', { travelDate: '2026-09-20', returnDate: '2026-10-15', passportOnFile: true, passportExpiry: '2027-03-01' }],
  ['round trip, comfortably valid', { travelDate: '2026-09-20', returnDate: '2026-10-15', passportOnFile: true, passportExpiry: '2030-01-01' }],
  ['return typed before the outbound', { travelDate: '2026-09-20', returnDate: '2026-09-01', passportOnFile: true, passportExpiry: '2026-10-01' }],
  ['no expiry recorded', { travelDate: '2026-09-20', passportOnFile: true, passportExpiry: '' }],
  ['no date at all', { passportOnFile: true, passportExpiry: '' }],
]

const passportOnly = (g) => g.checks
  .filter((c) => c.key.startsWith('passport'))
  .map((c) => ({ key: c.key, level: c.level, title: c.title }))

for (const [what, booking] of CASES) {
  test(`the browser gate agrees with lib/bookingGate — ${what}`, () => {
    const canon = bookingGateFor(booking, { today: '2026-08-16' })
    const client = clientGate(booking)
    assert.deepEqual(passportOnly(client), passportOnly(canon))
    assert.equal(client.worst, canon.worst)
    assert.equal(client.canProceed, canon.canProceed)
  })
}

// One known, deliberate difference: with NO passport on file at all, the
// module also asks for the expiry and the browser copy does not — a second
// question about a document nobody has. Both reach VERIFY, so the verdict is
// the same; only the wording differs, which is why this case checks the
// verdict rather than the list.
test('a booking with no passport on file is asked for one in both copies', () => {
  const booking = { travelDate: '2026-09-20', passportOnFile: false }
  const canon = bookingGateFor(booking, { today: '2026-08-16' })
  const client = clientGate(booking)
  assert.equal(client.checks[0].key, 'passport-on-file')
  assert.equal(canon.checks[0].key, 'passport-on-file')
  assert.equal(client.worst, canon.worst)
})
