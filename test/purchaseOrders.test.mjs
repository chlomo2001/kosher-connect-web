import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PO_STATUSES, canMove, lineTotal, orderTotal, validateOrder, stockDelta, orderSummary, isOverdue,
} from '../lib/purchaseOrders.mjs'

test('a line and an order come to what they should, to the penny', () => {
  assert.equal(lineTotal({ qty: 3, unitCost: 2.45 }), 7.35)
  assert.equal(lineTotal({ qty: 0, unitCost: 9 }), 0)
  assert.equal(lineTotal({}), 0)
  assert.equal(orderTotal([{ qty: 3, unitCost: 2.45 }, { qty: 10, unitCost: 1.005 }]), 17.4)
  assert.equal(orderTotal([]), 0)
  assert.equal(orderTotal(null), 0)
})

test('an order that has arrived cannot arrive again', () => {
  // The whole point: re-receiving would add the quantities to the shelf twice.
  assert.equal(canMove('received', 'received'), false)
  assert.equal(canMove('received', 'ordered'), false)
  assert.equal(canMove('cancelled', 'ordered'), false)
  assert.equal(canMove('draft', 'received'), false)   // it has to be ordered first
})

test('the moves that are allowed', () => {
  assert.equal(canMove('draft', 'ordered'), true)
  assert.equal(canMove('draft', 'cancelled'), true)
  assert.equal(canMove('ordered', 'received'), true)
  assert.equal(canMove('ordered', 'cancelled'), true)
  for (const s of PO_STATUSES) assert.equal(canMove(s, 'nonsense'), false)
  assert.equal(canMove('nonsense', 'ordered'), false)
})

test('an order needs a supplier, a line, and a real quantity on every line', () => {
  assert.match(validateOrder({}), /supplier/i)
  assert.match(validateOrder({ supplierId: 's1' }), /at least one line/i)
  assert.match(validateOrder({ supplierId: 's1', lines: [{ qty: 1 }] }), /item or a description/i)
  assert.match(validateOrder({ supplierId: 's1', lines: [{ description: 'Cables', qty: 0 }] }), /quantity/i)
  assert.match(validateOrder({ supplierId: 's1', lines: [{ description: 'Cables' }] }), /quantity/i)
  assert.match(validateOrder({ supplierId: 's1', lines: [{ description: 'Cables', qty: 2.5 }] }), /whole numbers/i)
  assert.match(validateOrder({ supplierId: 's1', lines: [{ description: 'x', qty: 1, unitCost: -3 }] }), /negative/i)
})

test('a missing cost is allowed — the invoice often comes later', () => {
  assert.equal(validateOrder({ supplierId: 's1', lines: [{ description: 'Cables', qty: 6 }] }), null)
  assert.equal(validateOrder({ supplierId: 's1', lines: [{ stockItemId: 'i1', qty: 2, unitCost: '' }] }), null)
  assert.equal(validateOrder({ supplierId: 's1', lines: [{ stockItemId: 'i1', qty: 2, unitCost: 0 }] }), null)
})

test('receiving adds each item once, summing repeated lines', () => {
  const d = stockDelta([
    { stockItemId: 'i1', qty: 3 },
    { stockItemId: 'i2', qty: 5 },
    { stockItemId: 'i1', qty: 2 },
  ])
  assert.equal(d.get('i1'), 5)
  assert.equal(d.get('i2'), 5)
  assert.equal(d.size, 2)
})

test('a free-text line touches no shelf', () => {
  // "Box of assorted cables" is a note to a human. Inventing a stock row for it
  // would be worse than leaving it to be added properly.
  const d = stockDelta([{ description: 'Box of assorted cables', qty: 20 }, { stockItemId: 'i1', qty: 1 }])
  assert.equal(d.size, 1)
  assert.equal(d.get('i1'), 1)
})

test('nonsense quantities never reach the shelf', () => {
  const d = stockDelta([
    { stockItemId: 'i1', qty: -5 },
    { stockItemId: 'i2', qty: 0 },
    { stockItemId: 'i3', qty: 'x' },
    { stockItemId: 'i4', qty: 2.9 },   // truncated, never rounded up
  ])
  assert.equal(d.has('i1'), false)
  assert.equal(d.has('i2'), false)
  assert.equal(d.has('i3'), false)
  assert.equal(d.get('i4'), 2)
})

test('the one-line summary counts lines and items', () => {
  assert.equal(orderSummary({ lines: [{ qty: 3 }, { qty: 1 }] }), '2 lines · 4 items')
  assert.equal(orderSummary({ lines: [{ qty: 1 }] }), '1 line · 1 item')
  assert.equal(orderSummary({}), '0 lines · 0 items')
})

test('overdue means ordered, promised, past — never a draft or an arrival', () => {
  assert.equal(isOverdue({ status: 'ordered', expectedAt: '2026-08-01' }, '2026-08-17'), true)
  assert.equal(isOverdue({ status: 'ordered', expectedAt: '2026-08-20' }, '2026-08-17'), false)
  assert.equal(isOverdue({ status: 'draft', expectedAt: '2026-08-01' }, '2026-08-17'), false)
  assert.equal(isOverdue({ status: 'received', expectedAt: '2026-08-01' }, '2026-08-17'), false)
  assert.equal(isOverdue({ status: 'ordered' }, '2026-08-17'), false)
})
