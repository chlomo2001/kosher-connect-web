// Goods-in (deliveries from suppliers) + the lightweight AP balance.
//
//   GET  → { deliveries, balances }  deliveries newest-first (100), each with
//          its lines; balances is per-supplier: unpaid invoice £ minus
//          credited-return £ (credit notes owed to us). No aging, no bank
//          reconciliation — the business has no books yet, so this is the
//          primary record and stays deliberately simple.
//   POST → record a delivery: supplier, date, optional invoice ref/total,
//          lines. A line that links a stock item increments its quantity
//          (adjust_stock_qty, the same atomic path the till uses) and
//          refreshes its cost price; a free-text line touches nothing.
//   PUT  → mark an invoice paid/unpaid (stamps/clears paid_at server-side),
//          or edit ref/total/notes.
//
// Same gate as the Shop tab: this is stock, whoever runs the shop runs it.

import { withStaff, tabAllowedFor } from '../../lib/auth.js'
import { db, tablesMode, STORAGE_ERROR } from '../../lib/db.js'
import { londonDate } from '../../lib/localDay.mjs'

const lineToApp = (l) => ({
  id: l.id,
  itemId: l.item_id,
  description: l.description,
  qty: l.qty,
  unitCost: l.unit_cost === null ? null : Number(l.unit_cost),
})

const deliveryToApp = (d) => ({
  id: d.id,
  supplierId: d.supplier_id,
  supplierName: d.suppliers?.name || '',
  deliveryDate: d.delivery_date,
  invoiceRef: d.invoice_ref || '',
  invoiceTotal: d.invoice_total === null ? null : Number(d.invoice_total),
  paid: !!d.paid,
  paidAt: d.paid_at,
  notes: d.notes || '',
  createdAt: d.created_at,
  lines: (d.goods_in_lines || []).map(lineToApp),
})

const cleanMoney = (v) => {
  if (v === undefined || v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : undefined // undefined = invalid
}

// we owe = unpaid invoices − credits owed to us. Negative = they owe us.
async function supplierBalances() {
  const [unpaid, credits] = await Promise.all([
    db.select('goods_in', 'select=supplier_id,invoice_total&paid=is.false&invoice_total=not.is.null'),
    db.select('supplier_returns', 'select=supplier_id,claimed_value&status=eq.credited&claimed_value=not.is.null'),
  ])
  const bal = {}
  for (const r of unpaid) bal[r.supplier_id] = (bal[r.supplier_id] || 0) + Number(r.invoice_total)
  for (const r of credits) bal[r.supplier_id] = (bal[r.supplier_id] || 0) - Number(r.claimed_value)
  return bal
}

async function handler(req, res) {
  if (!tablesMode) {
    return res.status(503).json({ success: false, error: 'Goods-in needs the relational data layer.' })
  }
  if (!(await tabAllowedFor(req.staff, 'shop'))) {
    return res.status(403).json({ success: false, error: 'The shop is not enabled for your account.' })
  }

  try {
    if (req.method === 'GET') {
      const [deliveries, balances] = await Promise.all([
        db.select('goods_in', 'select=*,suppliers(name),goods_in_lines(*)&order=delivery_date.desc,created_at.desc&limit=100'),
        supplierBalances(),
      ])
      return res.json({ success: true, deliveries: deliveries.map(deliveryToApp), balances })
    }

    if (req.method === 'POST') {
      const b = req.body || {}
      if (!b.supplierId) return res.status(400).json({ success: false, error: 'Pick a supplier.' })
      const total = cleanMoney(b.invoiceTotal)
      if (total === undefined) return res.status(400).json({ success: false, error: 'Invoice total must be a positive amount.' })

      const rawLines = Array.isArray(b.lines) ? b.lines : []
      const lines = []
      for (const l of rawLines) {
        const description = String(l.description || '').trim()
        const qty = parseInt(l.qty, 10)
        if (!description) continue // blank rows in the form are fine to skip
        if (!Number.isFinite(qty) || qty < 1) {
          return res.status(400).json({ success: false, error: `"${description}" needs a quantity of at least 1.` })
        }
        const unitCost = cleanMoney(l.unitCost)
        if (unitCost === undefined) {
          return res.status(400).json({ success: false, error: `"${description}" has an invalid unit cost.` })
        }
        lines.push({ item_id: l.itemId || null, description, qty, unit_cost: unitCost })
      }
      if (!lines.length) return res.status(400).json({ success: false, error: 'Add at least one line — what arrived?' })

      const paid = !!b.paid
      const [row] = await db.insert('goods_in', [{
        supplier_id: b.supplierId,
        delivery_date: String(b.deliveryDate || '').trim() || londonDate(),
        invoice_ref: String(b.invoiceRef || '').trim() || null,
        invoice_total: total,
        paid,
        paid_at: paid ? londonDate() : null,
        notes: String(b.notes || '').trim() || null,
        created_by: req.staff?.id || null,
      }])
      await db.insert('goods_in_lines', lines.map(l => ({ ...l, goods_in_id: row.id })))

      // Stock effects after the record exists: an arrival bumps quantity and
      // refreshes cost. A failed bump is reported, not silently swallowed —
      // the delivery stays recorded either way (paper beats stock counts).
      const stockWarnings = []
      for (const l of lines) {
        if (!l.item_id) continue
        try {
          await db.rpc('adjust_stock_qty', { p_item: l.item_id, p_qty: l.qty })
          if (l.unit_cost !== null) {
            await db.update('stock_items', `id=eq.${l.item_id}`, { net_price: l.unit_cost })
          }
        } catch (e) {
          console.error('[api/goods-in] stock bump failed', l.item_id, e)
          stockWarnings.push(l.description)
        }
      }

      const [withAll] = await db.select('goods_in', `select=*,suppliers(name),goods_in_lines(*)&id=eq.${row.id}`)
      return res.json({
        success: true,
        delivery: deliveryToApp(withAll || row),
        ...(stockWarnings.length ? { warning: `Recorded, but stock didn’t update for: ${stockWarnings.join(', ')}. Adjust those quantities by hand.` } : {}),
      })
    }

    if (req.method === 'PUT') {
      const b = req.body || {}
      if (!b.id) return res.status(400).json({ success: false, error: 'PUT wants an id.' })
      const id = encodeURIComponent(String(b.id))
      const existing = await db.select('goods_in', `id=eq.${id}&limit=1`)
      if (!existing.length) return res.status(404).json({ success: false, error: 'Delivery not found.' })

      const patch = {}
      if (b.paid !== undefined) {
        patch.paid = !!b.paid
        patch.paid_at = b.paid ? (existing[0].paid_at || londonDate()) : null
      }
      if (b.invoiceRef !== undefined) patch.invoice_ref = String(b.invoiceRef || '').trim() || null
      if (b.notes !== undefined) patch.notes = String(b.notes || '').trim() || null
      if (b.invoiceTotal !== undefined) {
        const total = cleanMoney(b.invoiceTotal)
        if (total === undefined) return res.status(400).json({ success: false, error: 'Invoice total must be a positive amount.' })
        patch.invoice_total = total
      }
      if (!Object.keys(patch).length) return res.status(400).json({ success: false, error: 'Nothing to update.' })

      await db.update('goods_in', `id=eq.${id}`, patch)
      const [row] = await db.select('goods_in', `select=*,suppliers(name),goods_in_lines(*)&id=eq.${id}`)
      return res.json({ success: true, delivery: deliveryToApp(row) })
    }

    return res.status(405).end()
  } catch (e) {
    console.error('[api/goods-in]', e)
    return res.status(500).json({ success: false, error: STORAGE_ERROR })
  }
}

export default withStaff(handler)
