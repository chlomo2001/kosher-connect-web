// The stale-tab money guard, held to the bug that produced it.
//
// 27 Aug, in production: Teitelbaum's ledger read -£90 after the rental had
// been corrected to £61.20 received. It was fixed by hand. It came back. The
// second time was the tell — nothing was re-typing it, a tab was re-sending it.
// A rentals save posts the whole array, so a tab that loaded before the
// correction carries amountPaid=32.40 for that rental for as long as it stays
// open, and the ledger true-up honours whatever arrives: target minus posted,
// post the difference, £28.80 of received money reversed by a rental_adjustment
// nobody asked for.
//
// The cases below are that story and its neighbours. The one that must NOT be
// blocked is as important as the one that must: an operator correcting a
// payment at the counter is looking at the current figure, and a guard that
// refuses them has replaced a rare silent bug with a daily loud one.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { guardStaleMoney, MONEY_FIELDS } from '../lib/staleMoney.mjs'

const OLD = '2026-08-27T09:00:00+00:00'
const NEW = '2026-08-27T15:30:00+00:00'

/** The rental as the counter corrected it, and as the database now holds it. */
const storedRow = (over = {}) => ({
  updated_at: NEW,
  extras: {
    id: 'r1', customerId: 'c2', amountPaid: 61.2, price: 61.2,
    lateFee: 0, lostChargesTotal: 0, paymentMethod: 'cash', ...over,
  },
})
const store = (...rows) => new Map(rows)

/** The same rental as a tab that loaded before the correction still sees it. */
const staleTab = (over = {}) => ({
  id: 'r1', customerId: 'c2', _rev: OLD,
  amountPaid: 32.4, price: 32.4, lateFee: 0, lostChargesTotal: 0,
  paymentMethod: 'cash', ...over,
})

test('the £90 case: a behind tab does not reverse a recorded payment', () => {
  const { guarded, staleMoney } = guardStaleMoney([staleTab()], store(['r1', storedRow()]))
  assert.equal(guarded[0].amountPaid, 61.2, 'the stale payment was written through')
  assert.equal(guarded[0].price, 61.2)
  assert.equal(guarded[0].paymentMethod, 'cash')
  assert.deepEqual(staleMoney, [{ id: 'r1', sentPaid: 32.4, keptPaid: 61.2, sentPrice: 32.4, keptPrice: 61.2 }])
})

test('the correction itself still goes through', () => {
  // The counter is looking at the current rental, so its copy is current.
  const current = { ...staleTab(), _rev: NEW, amountPaid: 90, price: 61.2 }
  const { guarded, staleMoney } = guardStaleMoney([current], store(['r1', storedRow()]))
  assert.equal(guarded[0].amountPaid, 90, 'a deliberate correction was refused')
  assert.deepEqual(staleMoney, [])
})

test('a payment may still be corrected DOWNWARDS from a current copy', () => {
  // The asymmetry a blunter guard would have got wrong: £90 typed by mistake,
  // corrected to £60 by the person who typed it. Money going down is not by
  // itself the bug — going down from a copy that never saw the current figure
  // is.
  const current = { ...staleTab(), _rev: NEW, amountPaid: 60 }
  const { guarded, staleMoney } = guardStaleMoney([current], store(['r1', storedRow({ amountPaid: 90 })]))
  assert.equal(guarded[0].amountPaid, 60)
  assert.deepEqual(staleMoney, [])
})

test('a behind tab saving everything EXCEPT money is left alone', () => {
  // The ordinary case, and the commonest: this tab is behind on a rental it did
  // not touch, and is saving because something else in the array changed.
  const behind = { ...staleTab(), amountPaid: 61.2, price: 61.2, notes: 'left a charger' }
  const { guarded, staleMoney } = guardStaleMoney([behind], store(['r1', storedRow()]))
  assert.equal(guarded[0].notes, 'left a charger', 'an ordinary edit was dropped')
  assert.deepEqual(staleMoney, [])
})

test('a behind tab keeps its non-money edits even when its money is refused', () => {
  const behind = staleTab({ notes: 'phone back Sunday', status: 'returned' })
  const { guarded } = guardStaleMoney([behind], store(['r1', storedRow()]))
  assert.equal(guarded[0].notes, 'phone back Sunday')
  assert.equal(guarded[0].status, 'returned')
  assert.equal(guarded[0].amountPaid, 61.2)
})

test('every money field is guarded, not just the payment', () => {
  for (const field of MONEY_FIELDS) {
    const behind = staleTab({ amountPaid: 61.2, price: 61.2, [field]: 999 })
    const { guarded, staleMoney } = guardStaleMoney([behind], store(['r1', storedRow()]))
    assert.equal(guarded[0][field], storedRow().extras[field], `${field} was written through`)
    assert.equal(staleMoney.length, 1, `${field} was not reported`)
  }
})

test('a payment up and a price down by the same amount is still caught', () => {
  // Net zero across two buckets is two wrong ledger entries, not none — which
  // is why the comparison is field by field and not on a total.
  const behind = staleTab({ amountPaid: 71.2, price: 51.2 })
  const { staleMoney } = guardStaleMoney([behind], store(['r1', storedRow()]))
  assert.equal(staleMoney.length, 1)
})

test('the tender is kept with the payment it describes', () => {
  const behind = staleTab({ paymentMethod: 'card' })
  const { guarded } = guardStaleMoney([behind], store(['r1', storedRow({ paymentMethod: 'cash' })]))
  assert.equal(guarded[0].paymentMethod, 'cash',
    'the stored payment kept this tab’s tender — cash-up counts on that answer')
})

test('a stored row with no tender comes back as none, not undefined', () => {
  const behind = staleTab({ paymentMethod: 'card' })
  const stored = storedRow()
  delete stored.extras.paymentMethod
  const { guarded } = guardStaleMoney([behind], store(['r1', stored]))
  assert.equal(guarded[0].paymentMethod, null)
})

test('a rental being created here is never stale', () => {
  const fresh = { id: 'r-new', amountPaid: 40, price: 40 }
  const { guarded, staleMoney } = guardStaleMoney([fresh], store())
  assert.equal(guarded[0].amountPaid, 40)
  assert.deepEqual(staleMoney, [])
})

test('a payload with no version at all still saves', () => {
  // A client older than this change, or a rental made in the tab and never
  // reloaded. Refusing it would stop the shop saving, which is worse than the
  // failure being guarded.
  const noRev = staleTab()
  delete noRev._rev
  const { guarded, staleMoney } = guardStaleMoney([noRev], store(['r1', storedRow()]))
  assert.equal(guarded[0].amountPaid, 32.4)
  assert.deepEqual(staleMoney, [])
})

test('a stored row with no version is not treated as newer than everything', () => {
  const stored = storedRow()
  stored.updated_at = null
  const { guarded, staleMoney } = guardStaleMoney([staleTab()], store(['r1', stored]))
  assert.equal(guarded[0].amountPaid, 32.4)
  assert.deepEqual(staleMoney, [])
})

test('a copy saved at the same instant is current, not behind', () => {
  const same = { ...staleTab(), _rev: NEW }
  const { staleMoney } = guardStaleMoney([same], store(['r1', storedRow()]))
  assert.deepEqual(staleMoney, [])
})

test('nulls and rubbish in the payload do not throw', () => {
  const { guarded, staleMoney } = guardStaleMoney(
    [null, undefined, staleTab()], store(['r1', storedRow()]))
  assert.equal(guarded.length, 3)
  assert.equal(staleMoney.length, 1)
  assert.deepEqual(guardStaleMoney(null, store()), { guarded: [], staleMoney: [] })
  assert.deepEqual(guardStaleMoney([], null), { guarded: [], staleMoney: [] })
})

test('every rental in a payload is judged on its own copy', () => {
  const payload = [
    staleTab(),                                                   // behind, money moved
    { id: 'r2', _rev: NEW, amountPaid: 20, price: 20 },            // current
    { id: 'r3', _rev: OLD, amountPaid: 30, price: 30 },            // behind, money same
  ]
  const stored = store(
    ['r1', storedRow()],
    ['r2', { updated_at: NEW, extras: { amountPaid: 10, price: 20 } }],
    ['r3', { updated_at: NEW, extras: { amountPaid: 30, price: 30 } }],
  )
  const { guarded, staleMoney } = guardStaleMoney(payload, stored)
  assert.deepEqual(staleMoney.map((s) => s.id), ['r1'])
  assert.equal(guarded[1].amountPaid, 20, 'a current row was held back by its neighbour')
  assert.equal(guarded[2].amountPaid, 30)
})
