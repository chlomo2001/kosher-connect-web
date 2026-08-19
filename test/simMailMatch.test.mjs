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

test('THE FORWARDING MAILBOX MUST NOT DROWN THE ANSWER', () => {
  // The real shape since the mailboxes started forwarding into one inbox: the
  // message carries the address that names ONE SIM and the postbox it passed
  // through, which 253 SIMs are also registered at. Unioning them made this
  // 'ambiguous' — three live messages were stuck like that on 18 Aug.
  const m = matchSimForMail({
    to: 'gitt.bilig+moshe@gmail.com',
    deliveredTo: 'shevabruches111@gmail.com',   // the postbox: two SIMs below
    subject: 'Your plan renews',
  }, index)
  assert.equal(m.simId, 's1')
  assert.equal(m.confidence, 'address')
  // …and the queue must name the address that did the work, not the postbox.
  assert.equal(m.matchedOn, 'gitt.bilig+moshe@gmail.com')
})

test('two addresses naming two DIFFERENT single SIMs stay ambiguous', () => {
  // The tie the narrowest-wins rule must not resolve by header order: picking
  // one would write a customer's line onto another customer's account.
  const m = matchSimForMail({
    to: 'gitt.bilig+moshe@gmail.com, gittbilig+rivky@gmail.com',
    subject: 'Your plan renews',
  }, index)
  assert.equal(m.simId, null)
  assert.equal(m.confidence, 'ambiguous')
  assert.deepEqual(m.candidates.sort(), ['s1', 's2'])
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

// ── Two hops, one business-only inbox ────────────────────────────────────
//
// Owner, 17 Aug, relaying the shop's own reasoning: gitt.bilig has all the
// carrier mail but is a mixed personal/business mailbox, while 5311386k is
// business-only and already receives everything forwarded from it — so point
// the app at the business-only one and let it read the lot, forwarded
// included, instead of maintaining a filter in seven mailboxes.
//
// That works only if the ORIGINAL recipient survives the forward and is the
// one used. A forwarded message carries the hub in Delivered-To and the real
// per-SIM address in To.
test('a message forwarded through the shop hub still pairs on the address it was sent to', () => {
  const index = buildSimIndex([
    { id: 'sim-moshe', email: 'gitt.bilig+moshe@gmail.com', simNumber: '07700900111' },
    { id: 'sim-other', email: 'gitt.bilig+other@gmail.com', simNumber: '07700900222' },
  ])
  const m = matchSimForMail({
    deliveredTo: '5311386k@gmail.com',
    to: 'gitt.bilig+moshe@gmail.com',
    subject: 'Your Lebara plan has renewed',
  }, index)
  assert.equal(m.simId, 'sim-moshe')
  assert.equal(m.confidence, 'address')
  // And the queue must show the address that did the work, not the hub —
  // "sent to 5311386k@gmail.com" on every row helps nobody settle anything.
  assert.equal(m.matchedOn, 'gitt.bilig+moshe@gmail.com')
})

test('a hub address no SIM is registered at contributes nothing either way', () => {
  const index = buildSimIndex([
    { id: 'sim-a', email: 'shevabruches111+14@gmail.com', simNumber: '07700900333' },
  ])
  // Two hops and a Cc, none of which name a SIM except the real one.
  const m = matchSimForMail({
    deliveredTo: '5311386k@gmail.com',
    to: 'shevabruches111+14@gmail.com',
    cc: 'gitt.bilig@gmail.com',
    subject: 'renewal',
  }, index)
  assert.equal(m.simId, 'sim-a')
  assert.equal(m.matchedOn, 'shevabruches111+14@gmail.com')

  // And when nothing matches, matchedOn stays null rather than naming a hop.
  const none = matchSimForMail({ deliveredTo: '5311386k@gmail.com', to: 'someone@else.com' }, index)
  assert.equal(none.simId, null)
  assert.equal(none.confidence, 'unknown')
  assert.equal(none.matchedOn, null)
})

// ── the real Lebara shape (18 Aug 2026) ──────────────────────────────────────
// Fourteen messages were sitting in the queue asking a person to pick between
// up to thirteen SIMs, and every one of them named its own number in the body:
//
//   "Mobile Number: 07776659703 … Your 5GB Monthly Plan for mobile number
//    07776659703 is scheduled to renew"
//
// The matcher read the subject and the snippet only, and for an HTML-only email
// the snippet is the <style> block. So the answer was in the message and nobody
// looked. giffgaff worked the whole time because it puts the number in the
// SUBJECT.
test('a carrier email that names its number in the BODY is filed, not queued', () => {
  const index = buildSimIndex([
    { id: 'sim-a', email: 'gitt.bilig@gmail.com', simNumber: '07776659703' },
    { id: 'sim-b', email: 'gitt.bilig@gmail.com', simNumber: '07423423516' },
    { id: 'sim-c', email: 'gitt.bilig@gmail.com', simNumber: '07392319095' },
  ])
  const mail = {
    to: 'gitt.bilig@gmail.com',
    subject: 'Your Lebara Mobile UK Auto Renew reminder',
    // What the app actually stored for these: the stylesheet.
    snippet: '96 * { box-sizing: border-box; } body { margin: 0; padding: 0; } p { line-height: inherit }',
    text: 'Please ensure you have sufficient funds and your payment details are up to date. '
      + 'Mobile Number: 07776659703 Hello, Your 5GB Monthly Plan for mobile number 07776659703 is scheduled to renew.',
  }
  const out = matchSimForMail(mail, index)
  assert.equal(out.simId, 'sim-a', 'the message names one of the three SIMs — it should be filed on it')
  assert.equal(out.confidence, 'address+number')
  assert.deepEqual(out.numbers, ['7776659703'])
})

test('without the body it is still ambiguous — which is the bug this replaces', () => {
  // Pins the CAUSE, so a future refactor that stops passing the body fails here
  // with a message that says why rather than merely going quiet.
  const index = buildSimIndex([
    { id: 'sim-a', email: 'gitt.bilig@gmail.com', simNumber: '07776659703' },
    { id: 'sim-b', email: 'gitt.bilig@gmail.com', simNumber: '07423423516' },
  ])
  const out = matchSimForMail({
    to: 'gitt.bilig@gmail.com',
    subject: 'Your Lebara Mobile UK Auto Renew reminder',
    snippet: '* { box-sizing: border-box; }',
  }, index)
  assert.equal(out.simId, null)
  assert.equal(out.confidence, 'ambiguous')
})

test('a shared mailbox with the number in the body beats the pool', () => {
  // The pool address carries hundreds; naming the number settles it outright.
  const sims = [{ id: 'target', email: 'pool@gmail.com', simNumber: '07999888777' }]
  for (let i = 0; i < 40; i++) sims.push({ id: `other-${i}`, email: 'pool@gmail.com', simNumber: `0790000${String(i).padStart(4, '0')}` })
  const out = matchSimForMail({
    to: 'pool@gmail.com', subject: 'Your plan renews soon',
    text: 'Mobile Number: +44 7999 888 777 — your plan renews on 2 September.',
  }, buildSimIndex(sims))
  assert.equal(out.simId, 'target')
  assert.equal(out.confidence, 'address+number')
})

// ── a line with more than one address (owner, 19 Aug) ────────────────────
test('a SIM can claim several addresses, and any of them pairs to it', () => {
  // The shop gives a SIM a tagged address per carrier account, so mail for one
  // phone arrives at gitt.bilig+a12@ from one carrier and gitt.bilig+sidner@
  // from another. Until this, a SIM could claim only the first, and ten
  // messages sat unpairable in the queue with nothing to match.
  const index = buildSimIndex([
    { id: 'sim-1', simNumber: '07553853941', email: 'gitt.bilig+a12@gmail.com',
      altEmails: ['gitt.bilig+sidner@gmail.com'] },
    { id: 'sim-2', simNumber: '07845665867', email: 'gitt.bilig+a2@gmail.com' },
  ])
  for (const to of ['gitt.bilig+a12@gmail.com', 'gitt.bilig+sidner@gmail.com']) {
    const m = matchSimForMail({ to }, index)
    assert.equal(m.simId, 'sim-1', `${to} did not reach the SIM that claims it`)
    assert.equal(m.confidence, 'address')
  }
  // …and it does not become a candidate for a line that never claimed it.
  assert.equal(matchSimForMail({ to: 'gitt.bilig+a2@gmail.com' }, index).simId, 'sim-2')
})

test('the extra addresses obey the same Gmail dot rule as the primary', () => {
  const index = buildSimIndex([
    { id: 'sim-1', email: 'a@b.com', altEmails: ['ha.sho.m.rim.mcr+gtf@gmail.com'] },
  ])
  assert.equal(matchSimForMail({ to: 'hashomrimmcr+gtf@gmail.com' }, index).simId, 'sim-1')
})

test('two SIMs claiming the same extra address is still ambiguous', () => {
  // Adding an address must not become a way to make the matcher guess.
  const index = buildSimIndex([
    { id: 'sim-1', email: 'one@x.com', altEmails: ['shared+tag@gmail.com'] },
    { id: 'sim-2', email: 'two@x.com', altEmails: ['shared+tag@gmail.com'] },
  ])
  const m = matchSimForMail({ to: 'shared+tag@gmail.com' }, index)
  assert.equal(m.simId, null)
  assert.equal(m.confidence, 'ambiguous')
})

test('a SIM with no extra addresses behaves exactly as before', () => {
  const before = buildSimIndex([{ id: 's', email: 'a@b.com', simNumber: '07700900123' }])
  const after = buildSimIndex([{ id: 's', email: 'a@b.com', simNumber: '07700900123', altEmails: [] }])
  assert.deepEqual([...after.byAddress.entries()], [...before.byAddress.entries()])
  // Rubbish in the field must not throw or index nonsense.
  for (const bad of [null, undefined, 'not-an-array', 0, {}]) {
    const idx = buildSimIndex([{ id: 's', email: 'a@b.com', altEmails: bad }])
    assert.equal(idx.byAddress.size, 1)
  }
})
