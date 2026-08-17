// Purchase orders — what was ordered from a supplier, and what arrived.
//
// Ordering is not a financial event: nothing is charged, nothing is posted,
// and the stock on hand does not move. RECEIVING is the only step that changes
// anything, and it changes stock — through one database function, so the
// quantities landing on the shelf and the order closing happen together or not
// at all. A half-applied receive is a stock count nobody can trust afterwards.
//
// The same function is guarded on the current status, so two people pressing
// Receive at the same moment cannot add one delivery twice.

import { withStaff, tabAllowedFor } from '../../lib/auth.js'
import { db, tablesMode } from '../../lib/db.js'
import { validateOrder, canMove } from '../../lib/purchaseOrders.mjs'

const enc = encodeURIComponent
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const toApp = (row) => ({
  id: row.id,
  supplierId: row.supplier_id,
  supplierName: row.suppliers?.name || '',
  reference: row.reference || '',
  status: row.status,
  orderedAt: row.ordered_at,
  expectedAt: row.expected_at,
  receivedAt: row.received_at,
  notes: row.notes || '',
  createdAt: row.created_at,
  lines: (row.purchase_order_lines || []).map(l => ({
    id: l.id,
    stockItemId: l.stock_item_id,
    description: l.description || '',
    qty: l.qty,
    unitCost: l.unit_cost === null ? null : Number(l.unit_cost),
  })),
})

async function handler(req, res) {
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Needs the relational data layer.' })
  // The buy side lives on the Shop tab, so that is the permission it takes.
  if (!(await tabAllowedFor(req.staff, 'shop'))) {
    return res.status(403).json({ success: false, error: 'Not permitted.' })
  }

  if (req.method === 'GET') {
    const rows = await db.select('purchase_orders',
      'select=*,suppliers(name),purchase_order_lines(*)&order=created_at.desc&limit=200')
    return res.json({ success: true, orders: rows.map(toApp) })
  }

  if (req.method === 'POST') {
    const b = req.body || {}
    const problem = validateOrder({ supplierId: b.supplierId, lines: b.lines })
    if (problem) return res.status(400).json({ success: false, error: problem })
    if (!UUID_RE.test(String(b.supplierId))) {
      return res.status(400).json({ success: false, error: 'That supplier is not on file.' })
    }
    const status = b.status === 'ordered' ? 'ordered' : 'draft'
    const inserted = await db.insert('purchase_orders', [{
      supplier_id: b.supplierId,
      reference: String(b.reference || '').slice(0, 120) || null,
      status,
      ordered_at: status === 'ordered' ? (DATE_RE.test(b.orderedAt) ? b.orderedAt : new Date().toISOString().slice(0, 10)) : null,
      expected_at: DATE_RE.test(b.expectedAt) ? b.expectedAt : null,
      notes: String(b.notes || '').slice(0, 500) || null,
    }])
    const po = inserted[0]
    if (!po) return res.status(502).json({ success: false, error: 'Could not save that order.' })

    const lines = (b.lines || []).map(l => ({
      po_id: po.id,
      stock_item_id: UUID_RE.test(String(l.stockItemId || '')) ? l.stockItemId : null,
      description: String(l.description || '').slice(0, 200) || null,
      qty: Math.trunc(Number(l.qty)),
      unit_cost: l.unitCost === '' || l.unitCost == null ? null : Number(l.unitCost),
    }))
    try {
      await db.insert('purchase_order_lines', lines)
    } catch (e) {
      // An order with no lines is not an order. Take it back out rather than
      // leaving a headless row for someone to puzzle over later.
      await db.delete('purchase_orders', `id=eq.${enc(po.id)}`).catch(() => {})
      console.error('[purchase-orders] lines failed:', e.message)
      return res.status(502).json({ success: false, error: 'Could not save the order lines.' })
    }
    return res.json({ success: true, id: po.id })
  }

  if (req.method === 'PUT') {
    const { id, status } = req.body || {}
    if (!UUID_RE.test(String(id || ''))) return res.status(400).json({ success: false, error: 'Which order?' })
    const rows = await db.select('purchase_orders', `select=id,status&id=eq.${enc(id)}&limit=1`)
    const po = rows[0]
    if (!po) return res.status(404).json({ success: false, error: 'That order is not on file.' })
    if (!canMove(po.status, status)) {
      return res.status(400).json({ success: false, error: `An order that is ${po.status} cannot become ${status}.` })
    }

    if (status === 'received') {
      try {
        // One statement: stock up, order closed, or neither.
        const out = await db.rpc('receive_purchase_order', { p_po_id: id })
        const touched = Array.isArray(out) ? (out[0]?.received ?? 0) : 0
        return res.json({ success: true, status, itemsUpdated: touched })
      } catch (e) {
        console.error('[purchase-orders] receive failed:', e.message)
        return res.status(409).json({ success: false, error: 'That order could not be received — reload and check its status.' })
      }
    }

    await db.update('purchase_orders', `id=eq.${enc(id)}`, {
      status,
      ...(status === 'ordered' ? { ordered_at: new Date().toISOString().slice(0, 10) } : {}),
      updated_at: new Date().toISOString(),
    })
    return res.json({ success: true, status })
  }

  return res.status(405).end()
}

export default withStaff(handler)
