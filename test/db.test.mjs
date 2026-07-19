// uniformRows — the PGRST102 guard. PostgREST rejects a bulk insert whose
// rows carry different key sets ("All object keys must match"); this bit the
// till in production when a basket's charge rows (no `method`) were posted in
// one batch with the settlement payment row (`method: 'cash'`). Every batch
// leaving lib/db.js must be key-uniform.
import test from 'node:test'
import assert from 'node:assert/strict'
import { uniformRows } from '../lib/db.js'

test('levels the exact shop-sale shape: charge rows + payment row with method', () => {
  const rows = uniformRows([
    { customer_id: 'c1', charge_reference: 'SALE-x-0', entry_type: 'phone_sale', amount: -115, description: 'Croscall' },
    { customer_id: 'c1', charge_reference: 'PAY-SALE-x-now', entry_type: 'payment', amount: 115, method: 'cash', description: 'Paid — shop sale' },
  ])
  const keySets = rows.map((r) => Object.keys(r).sort().join(','))
  assert.equal(keySets[0], keySets[1], 'all rows must expose identical keys')
  assert.equal(rows[0].method, null, 'missing key filled with explicit null')
  assert.equal(rows[1].method, 'cash', 'present values untouched')
  assert.equal(rows[0].amount, -115)
})

test('kol-torah settlement shape (sold line + received line) is leveled too', () => {
  const rows = uniformRows([
    { customer_id: 's1', charge_reference: 'KT-SETTLE-1', entry_type: 'stock_sale', amount: -40, description: 'CDs sold' },
    { customer_id: 's1', charge_reference: 'PAY-KT-SETTLE-1', entry_type: 'payment', amount: 40, method: 'cash', description: 'Settlement' },
  ])
  assert.deepEqual(Object.keys(rows[0]).sort(), Object.keys(rows[1]).sort())
})

test('already-uniform batches and single rows pass through unchanged', () => {
  const uniform = [{ a: 1, b: 2 }, { a: 3, b: 4 }]
  assert.deepEqual(uniformRows(uniform), uniform)

  const single = [{ a: 1 }]
  assert.equal(uniformRows(single), single, 'single-row arrays returned as-is (defaults preserved)')
  const notArray = { a: 1 }
  assert.equal(uniformRows(notArray), notArray)
})

test('union covers keys from any row position, values including falsy survive', () => {
  const rows = uniformRows([
    { a: 0 },
    { b: false },
    { c: '' },
  ])
  for (const r of rows) assert.deepEqual(Object.keys(r).sort(), ['a', 'b', 'c'])
  assert.equal(rows[0].a, 0)
  assert.equal(rows[1].b, false)
  assert.equal(rows[2].c, '')
  assert.equal(rows[0].b, null)
})
