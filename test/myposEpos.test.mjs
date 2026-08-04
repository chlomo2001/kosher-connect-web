// lib/mypos.mjs pure helpers — status mapping the till relies on, and the
// stateless mock's clock arithmetic (serverless instances answering different
// polls must agree without shared storage).
import test from 'node:test'
import assert from 'node:assert/strict'
import { mapEposStatus, mockPaymentId, mockStatusFor } from '../lib/mypos.mjs'

test('mapEposStatus: InProgress is not done', () => {
  assert.deepEqual(mapEposStatus('InProgress'), { done: false })
})

test('mapEposStatus: Success approves', () => {
  assert.deepEqual(mapEposStatus('Success'), { done: true, approved: true })
})

test('mapEposStatus: every terminal "no" is done, unapproved, with a reason', () => {
  for (const s of ['Canceled', 'Failed', 'Reversed', 'Rejected']) {
    const m = mapEposStatus(s)
    assert.equal(m.done, true, s)
    assert.equal(m.approved, false, s)
    assert.ok(m.error && m.error.length > 0, s)
  }
})

test('mapEposStatus: an unknown status keeps the till waiting, never approves', () => {
  const m = mapEposStatus('SomethingNew')
  assert.equal(m.done, false)
  assert.equal(m.unknown, true)
  assert.notEqual(m.approved, true)
})

test('mock: young payment is InProgress, settles to Success after 6s', () => {
  const t0 = 1_700_000_000_000
  const id = mockPaymentId('PAY-SALE-abc123-now', t0)
  assert.equal(mockStatusFor(id, t0 + 1000), 'InProgress')
  assert.equal(mockStatusFor(id, t0 + 6001), 'Success')
})

test('mock: DECLINE in the reference fails instead of succeeding', () => {
  const t0 = 1_700_000_000_000
  const id = mockPaymentId('PAY-SALE-DECLINE1-now', t0)
  assert.equal(mockStatusFor(id, t0 + 6001), 'Failed')
})

test('mock: a non-mock id is unknown (null), never a status', () => {
  assert.equal(mockStatusFor('68ff25a853659f6448da0eba'), null)
  assert.equal(mockStatusFor(''), null)
})
