// Forwarding carrier mail to the customer (owner item 20, 19 Aug 2026).
//
// The owner chose "HOLD-gated, with an approval queue": the app prepares each
// forward and shows exactly what would go and to whom, and nothing sends until
// the gate is flipped. These tests are about the two decisions behind that, and
// they matter very unequally.
//
// Getting "is this interesting" wrong sends somebody a dull email.
// Getting "is this theirs" wrong sends one customer another customer's
// business. Every certainty test below exists for the second.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { forwardKind, forwardReason, forwardTarget, forwardPlan, forwardable, FORWARD_KINDS } from '../lib/mailForward.mjs'
import { ACTIONABLE } from '../lib/carrierMail.mjs'

const sim = (extra = {}) => ({
  customerId: 'c1', customerName: 'Menachem Adler', customerEmail: 'm.adler@example.com',
  number: '447911123456', ...extra,
})
const msg = (extra = {}) => ({ id: 1, kind: 'renewed', subject: 'Your plan renewed', sim: sim(), numbers: ['447911123456'], ...extra })

// ── what is worth forwarding ──────────────────────────────────────────────
test('the forwarded kinds are not the same as the staff-actionable ones', () => {
  // Two different questions. ACTIONABLE asks "does a member of staff have
  // something to do"; this asks "would the person whose line it is want to
  // know". Collapsing them would be the easy mistake.
  assert.notDeepEqual([...FORWARD_KINDS.keys()].sort(), [...ACTIONABLE].sort())
  // renewed is not staff-actionable and IS forwarded — nothing to do, but it
  // is their money and the receipt is the news.
  assert.ok(!ACTIONABLE.has('renewed'))
  assert.ok(forwardKind('renewed'))
  // pac_issued is staff-actionable and is NOT forwarded: a PAC means the
  // customer is leaving, and they asked for it.
  assert.ok(ACTIONABLE.has('pac_issued'))
  assert.ok(!forwardKind('pac_issued'))
})

test('every forwarded kind carries a reason a person can argue with', () => {
  for (const kind of FORWARD_KINDS.keys()) {
    assert.ok(forwardReason(kind).length > 20, `${kind} has no reason`)
  }
  assert.equal(forwardReason('marketing'), '')
  assert.equal(forwardReason(undefined), '')
})

test('adverts and noise are never forwarded', () => {
  for (const kind of ['marketing', 'other', 'port_requested', 'renewal_reminder', '', null, undefined]) {
    assert.equal(forwardKind(kind), false, `${kind} would have been forwarded`)
  }
})

// ── who it may go to: the half that must never be wrong ──────────────────
test('a message nobody has filed goes to nobody', () => {
  // The carrier-mail screen has a matching step with a human in it. A forward
  // rides on that decision rather than making a second, weaker one behind
  // their back.
  assert.match(forwardTarget(msg({ sim: null })).error, /Not filed on a SIM yet/)
  assert.match(forwardTarget(msg({ sim: sim({ customerId: null }) })).error, /not linked to a customer/)
  assert.match(forwardTarget(null).error, /No message/)
})

test('no email on record means no forward, named so it can be fixed', () => {
  const t = forwardTarget(msg({ sim: sim({ customerEmail: '' }) }))
  assert.match(t.error, /No email on record for Menachem Adler/)
  assert.match(forwardTarget(msg({ sim: sim({ customerEmail: 'not-an-address' }) })).error, /No email on record/)
  assert.equal(forwardTarget(msg({ sim: sim({ customerEmail: '  ' }) })).email, undefined)
})

test('a message covering several numbers goes to NOBODY', () => {
  // A carrier can put several lines in one email. Forwarding that to one
  // customer hands them another customer's business, which is the one failure
  // this feature must not have — so it refuses rather than picking the
  // best-matching line.
  const many = msg({ numbers: ['447911123456', '447700900123'] })
  assert.match(forwardTarget(many).error, /covers 2 numbers/)
  assert.equal(forwardPlan(many).ready, false)
  // One number, or none named at all, is fine — the SIM it is filed on is the
  // answer either way.
  assert.equal(forwardTarget(msg({ numbers: ['447911123456'] })).error, undefined)
  assert.equal(forwardTarget(msg({ numbers: [] })).error, undefined)
})

test('a good message resolves to one named person', () => {
  const t = forwardTarget(msg())
  assert.equal(t.email, 'm.adler@example.com')
  assert.equal(t.name, 'Menachem Adler')
  assert.equal(t.customerId, 'c1')
  assert.equal(t.error, undefined)
})

// ── the queue ────────────────────────────────────────────────────────────
test('the queue explains itself, including what it will NOT send', () => {
  // A message silently absent from the queue teaches nobody anything, so every
  // message gets a row and the ones that will not go say why.
  const rows = [
    msg(),
    msg({ id: 2, kind: 'marketing' }),
    msg({ id: 3, kind: 'renewed', sim: null }),
    msg({ id: 4, kind: 'payment_failed', sim: sim({ customerEmail: '' }) }),
  ].map(forwardPlan)
  assert.equal(rows.length, 4)
  assert.deepEqual(rows.map(r => r.ready), [true, false, false, false])
  assert.equal(rows[1].blockedBy, 'Not a kind worth forwarding.')
  assert.match(rows[2].blockedBy, /Not filed on a SIM/)
  assert.match(rows[3].blockedBy, /No email on record/)
  // Only the ready ones can be approved.
  const ready = forwardable([msg(), msg({ id: 2, kind: 'marketing' })])
  assert.equal(ready.length, 1)
  assert.equal(ready[0].id, 1)
})

test('a plan never leaks an address for a message that will not be sent', () => {
  for (const m of [msg({ kind: 'marketing' }), msg({ sim: null }), msg({ numbers: ['1', '2'] })]) {
    const plan = forwardPlan(m)
    assert.equal(plan.ready, false)
    assert.equal(plan.to, null, 'a blocked plan carried a recipient')
  }
})

test('rubbish in does not throw — the queue must render whatever it is given', () => {
  for (const bad of [null, undefined, {}, { kind: 'renewed' }, { sim: {} }]) {
    const plan = forwardPlan(bad)
    assert.equal(typeof plan.ready, 'boolean')
    assert.ok(plan.subject)
  }
  assert.deepEqual(forwardable([]), [])
  assert.deepEqual(forwardable([null]), [])
})
