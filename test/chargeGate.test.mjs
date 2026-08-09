// The Charge Gate. Run: npm test
//
// This gate decides whether a rental may be closed and charged, so the tests
// are written from the counter's point of view: what is the operator holding,
// what did they say about it, and does the app now know enough to charge.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gateFor, gateSummary, BLOCK, VERIFY, PASS } from '../lib/chargeGate.mjs'

const TODAY = '2026-08-09'

// A rental that is ready to close: everything back, paid up, no deposit.
const clean = (over = {}) => ({
  fromDate: '2026-08-01',
  toDate: '2026-08-08',
  price: 40,
  lateFee: 0,
  lostChargesTotal: 0,
  amountPaid: 40,
  depositHeld: 0,
  equipmentGiven: { phone: true, sim: true, plug: true, cable: true },
  itemStatus: { phone: 'returned', sim: 'returned', plug: 'returned', cable: 'returned' },
  lostCharges: {},
  ...over,
})

const check = (gate, id) => gate.checks.find((c) => c.id === id)

test('a settled rental closes', () => {
  const gate = gateFor(clean(), { today: TODAY })
  assert.equal(gate.canClose, true)
  assert.deepEqual(gate.blockers, [])
  assert.equal(gateSummary(gate), 'Ready to close.')
  // Every check is reported, not only the failures — a gate that shows nothing
  // when it passes teaches nobody what it checked.
  assert.deepEqual(gate.checks.map((c) => c.id), ['equipment', 'dates', 'deposit', 'balance'])
  assert.ok(gate.checks.every((c) => c.state === PASS))
})

test('an undecided item blocks the close — the bug this exists for', () => {
  // The charger neither returned nor written off. The old code let this save
  // and painted a ⚠️ on a row nobody goes back to.
  const gate = gateFor(clean({ itemStatus: { phone: 'returned', sim: 'returned', plug: 'undecided', cable: 'undecided' } }),
    { today: TODAY })
  assert.equal(gate.canClose, false)
  assert.equal(check(gate, 'equipment').state, BLOCK)
  assert.match(check(gate, 'equipment').detail, /the charger/)
  assert.match(gateSummary(gate), /^Cannot close yet/)
})

test('half an answer on the charger is not an answer', () => {
  // plug returned, cable never decided. The operator sees ONE charger control,
  // so a gate that passed here would be blocking on a key they cannot reach —
  // or worse, letting it through.
  const gate = gateFor(clean({ itemStatus: { phone: 'returned', sim: 'returned', plug: 'returned', cable: 'undecided' } }),
    { today: TODAY })
  assert.equal(check(gate, 'equipment').state, BLOCK)
})

test('only what actually went out is asked about', () => {
  // No SIM handed over, and no SIM answer. That is not an open question.
  const gate = gateFor(clean({
    equipmentGiven: { phone: true, sim: false, plug: true, cable: true },
    itemStatus: { phone: 'returned', plug: 'returned', cable: 'returned' },
  }), { today: TODAY })
  assert.equal(gate.canClose, true)
})

test('a rental with no equipmentGiven record assumes everything went out', () => {
  // Older rentals predate the field. Assuming nothing went out would wave them
  // all through, which is the wrong way to be wrong about missing data.
  const gate = gateFor({ fromDate: '2026-08-01', toDate: '2026-08-08', price: 40, amountPaid: 40 },
    { today: TODAY })
  assert.equal(check(gate, 'equipment').state, BLOCK)
})

test('the legacy returnedItems shape still counts as an answer', () => {
  const gate = gateFor({
    fromDate: '2026-08-01', toDate: '2026-08-08', price: 40, amountPaid: 40,
    returnedItems: { phone: true, sim: true, plug: true, cable: true },
  }, { today: TODAY })
  assert.equal(check(gate, 'equipment').state, PASS)
})

test('lost with no figure on it blocks too', () => {
  // Written off but never priced: the charge never happens and the loss never
  // lands anywhere. Same hole as undecided, different shape.
  const gate = gateFor(clean({
    itemStatus: { phone: 'returned', sim: 'returned', plug: 'lost', cable: 'lost' },
    lostCharges: {},
  }), { today: TODAY })
  assert.equal(check(gate, 'equipment').state, BLOCK)
  assert.match(check(gate, 'equipment').detail, /no charge/)
})

test('a deliberate £0 write-off is an answer', () => {
  // Waiving the charge is a decision. The gate wants a figure, not a payment.
  const gate = gateFor(clean({
    itemStatus: { phone: 'returned', sim: 'returned', plug: 'lost', cable: 'lost' },
    lostCharges: { plug: 0.01 },
    price: 40, lostChargesTotal: 0.01, amountPaid: 40.01,
  }), { today: TODAY })
  assert.equal(check(gate, 'equipment').state, PASS)
})

test('a held deposit blocks until it is settled', () => {
  // Money belonging to somebody else, against a rental that is about to stop
  // existing. Left held, it quietly becomes takings.
  const held = gateFor(clean({ depositHeld: 50 }), { today: TODAY })
  assert.equal(check(held, 'deposit').state, BLOCK)
  assert.match(check(held, 'deposit').detail, /50\.00/)

  const settled = gateFor(clean({ depositHeld: 50, depositSettled: true }), { today: TODAY })
  assert.equal(check(settled, 'deposit').state, PASS)
})

test('an outstanding balance is allowed, but somebody has to say so', () => {
  // This shop runs accounts; owing at close is normal. What is not normal is it
  // happening without anyone noticing — so it is a sign-off, not a block.
  const owing = gateFor(clean({ amountPaid: 10 }), { today: TODAY })
  assert.equal(check(owing, 'balance').state, VERIFY)
  assert.equal(owing.blockers.length, 0)
  assert.equal(owing.canClose, false)
  assert.match(check(owing, 'balance').detail, /£30\.00/)
  assert.match(gateSummary(owing), /^Needs a sign-off/)

  const signed = gateFor(clean({ amountPaid: 10 }), { today: TODAY, verifications: ['balance'] })
  assert.equal(check(signed, 'balance').state, PASS)
  assert.equal(signed.canClose, true)
})

test('an overpayment is flagged as credit, not silently kept', () => {
  const gate = gateFor(clean({ amountPaid: 60 }), { today: TODAY })
  assert.equal(check(gate, 'balance').state, VERIFY)
  assert.match(check(gate, 'balance').detail, /£20\.00 overpaid/)
})

test('the balance includes the late fee and the lost-item charges', () => {
  const gate = gateFor(clean({ price: 40, lateFee: 9, lostChargesTotal: 10, amountPaid: 40 }), { today: TODAY })
  assert.match(check(gate, 'balance').detail, /£19\.00/)
})

test('the balance is rounded like money, not like a float', () => {
  // 0.1 + 0.2 territory. A gate that reports a balance of £2.9999999999 is a
  // gate nobody trusts, and one that thinks £0.00 is outstanding blocks a
  // close that should sail through.
  const gate = gateFor(clean({ price: 0.1, lateFee: 0.2, amountPaid: 0.3 }), { today: TODAY })
  assert.equal(check(gate, 'balance').state, PASS)
})

test('a return date before the pickup blocks, and cannot be signed away', () => {
  const gate = gateFor(clean({ fromDate: '2026-08-08', toDate: '2026-08-01' }),
    { today: TODAY, verifications: ['dates', 'balance'] })
  assert.equal(check(gate, 'dates').state, BLOCK)
  assert.equal(gate.canClose, false)
})

test('closing a rental early is a sign-off, and is re-asked every time', () => {
  const early = gateFor(clean({ toDate: '2026-08-20' }), { today: TODAY })
  assert.equal(check(early, 'dates').state, VERIFY)
  assert.match(check(early, 'dates').detail, /2026-08-20/)

  // Signing it off clears it for this save — but the sign-off is about the
  // dates in front of you, so it has to be given against the dates you are
  // actually saving.
  const signed = gateFor(clean({ toDate: '2026-08-20' }), { today: TODAY, verifications: ['dates'] })
  assert.equal(check(signed, 'dates').state, PASS)
  assert.equal(signed.canClose, true)
})

test('several problems at once are all reported, not just the first', () => {
  // An operator who fixes one thing, saves, and is told about the next one is
  // an operator who stops reading the gate.
  const gate = gateFor(clean({
    itemStatus: { phone: 'returned', sim: 'undecided', plug: 'returned', cable: 'returned' },
    depositHeld: 25,
    amountPaid: 0,
  }), { today: TODAY })
  assert.deepEqual(gate.blockers.map((c) => c.id), ['equipment', 'deposit'])
  assert.deepEqual(gate.needsVerification.map((c) => c.id), ['balance'])
})

test('a missing rental does not throw', () => {
  // The client calls this on every keystroke in Manage Rental. It has to be
  // safe on a half-built object, or the modal dies mid-edit.
  assert.doesNotThrow(() => gateFor(null, { today: TODAY }))
  assert.doesNotThrow(() => gateFor({}, {}))
})
