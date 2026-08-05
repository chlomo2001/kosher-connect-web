// Suppliers & returns (RMA) — the buy side's v1 (see the migration of the
// same name for why this exists and why it is not ledger money).
//
//   GET                  → { suppliers, returns } (returns newest-first, 200)
//   POST {op:'supplier'} → add a supplier (name required, unique)
//   POST {op:'return'}   → record a return going back to a supplier
//   PUT  {op:'return'}   → edit / advance a return. Status moves stamp their
//                          own dates server-side (sent_at on 'sent',
//                          resolved_at on a terminal status) so the DB
//                          constraints can't be tripped from a screen.
//
// Same gate as the Shop tab: this is stock, whoever runs the shop runs it.

import { withStaff, tabAllowedFor } from '../../lib/auth.js'
import { db, tablesMode, STORAGE_ERROR } from '../../lib/db.js'
import { londonDate } from '../../lib/localDay.mjs'

const STATUSES = ['awaiting_send', 'sent', 'credited', 'replaced', 'written_off']
const TERMINAL = ['credited', 'replaced', 'written_off']

const supplierToApp = (r) => ({
  id: r.id,
  name: r.name,
  contact: r.contact || '',
  notes: r.notes || '',
  active: !!r.active,
})

const returnToApp = (r) => ({
  id: r.id,
  supplierId: r.supplier_id,
  supplierName: r.suppliers?.name || '',
  items: r.items,
  imeis: r.imeis || '',
  claimedValue: r.claimed_value === null ? null : Number(r.claimed_value),
  status: r.status,
  sentAt: r.sent_at,
  resolvedAt: r.resolved_at,
  notes: r.notes || '',
  createdAt: r.created_at,
})

const cleanMoney = (v) => {
  if (v === undefined || v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : undefined // undefined = invalid
}

async function handler(req, res) {
  if (!tablesMode) {
    return res.status(503).json({ success: false, error: 'Supplier returns need the relational data layer.' })
  }
  if (!(await tabAllowedFor(req.staff, 'shop'))) {
    return res.status(403).json({ success: false, error: 'The shop is not enabled for your account.' })
  }

  try {
    if (req.method === 'GET') {
      const [sup, rets] = await Promise.all([
        db.select('suppliers', 'order=name.asc'),
        db.select('supplier_returns', 'select=*,suppliers(name)&order=created_at.desc&limit=200'),
      ])
      return res.json({ success: true, suppliers: sup.map(supplierToApp), returns: rets.map(returnToApp) })
    }

    if (req.method === 'POST') {
      const b = req.body || {}

      if (b.op === 'supplier') {
        const name = String(b.name || '').trim()
        if (!name) return res.status(400).json({ success: false, error: 'Supplier name is required.' })
        // Re-adding an existing name returns the existing row (idempotent via
        // the unique) instead of a raw constraint error.
        const dup = await db.select('suppliers', `name=eq.${encodeURIComponent(name)}&limit=1`)
        if (dup.length) return res.json({ success: true, supplier: supplierToApp(dup[0]), existed: true })
        const [row] = await db.insert('suppliers', [{
          name,
          contact: String(b.contact || '').trim() || null,
          notes: String(b.notes || '').trim() || null,
        }])
        return res.json({ success: true, supplier: supplierToApp(row) })
      }

      if (b.op === 'return') {
        const items = String(b.items || '').trim()
        if (!b.supplierId) return res.status(400).json({ success: false, error: 'Pick a supplier.' })
        if (!items) return res.status(400).json({ success: false, error: 'Say what is going back.' })
        const claimed = cleanMoney(b.claimedValue)
        if (claimed === undefined) return res.status(400).json({ success: false, error: 'Claimed value must be a positive amount.' })
        const [row] = await db.insert('supplier_returns', [{
          supplier_id: b.supplierId,
          items,
          imeis: String(b.imeis || '').trim() || null,
          claimed_value: claimed,
          notes: String(b.notes || '').trim() || null,
          created_by: req.staff?.id || null,
        }])
        const [withName] = await db.select('supplier_returns', `select=*,suppliers(name)&id=eq.${row.id}`)
        return res.json({ success: true, ret: returnToApp(withName || row) })
      }

      return res.status(400).json({ success: false, error: "op must be 'supplier' or 'return'." })
    }

    if (req.method === 'PUT') {
      const b = req.body || {}
      if (b.op !== 'return' || !b.id) return res.status(400).json({ success: false, error: 'PUT wants {op:"return", id}.' })
      const existing = await db.select('supplier_returns', `id=eq.${encodeURIComponent(String(b.id))}&limit=1`)
      if (!existing.length) return res.status(404).json({ success: false, error: 'Return not found.' })

      const patch = {}
      if (b.items !== undefined) {
        const items = String(b.items || '').trim()
        if (!items) return res.status(400).json({ success: false, error: 'Say what is going back.' })
        patch.items = items
      }
      if (b.imeis !== undefined) patch.imeis = String(b.imeis || '').trim() || null
      if (b.notes !== undefined) patch.notes = String(b.notes || '').trim() || null
      if (b.claimedValue !== undefined) {
        const claimed = cleanMoney(b.claimedValue)
        if (claimed === undefined) return res.status(400).json({ success: false, error: 'Claimed value must be a positive amount.' })
        patch.claimed_value = claimed
      }
      if (b.status !== undefined) {
        if (!STATUSES.includes(b.status)) {
          return res.status(400).json({ success: false, error: `Status must be one of: ${STATUSES.join(', ')}.` })
        }
        patch.status = b.status
        // The DB insists a sent/terminal row is dated and an open one isn't —
        // stamp/clear both here so no screen has to know the rule.
        patch.sent_at = b.status === 'awaiting_send' ? null : (existing[0].sent_at || londonDate())
        patch.resolved_at = TERMINAL.includes(b.status) ? (existing[0].resolved_at || londonDate()) : null
      }
      if (!Object.keys(patch).length) return res.status(400).json({ success: false, error: 'Nothing to update.' })

      await db.update('supplier_returns', `id=eq.${encodeURIComponent(String(b.id))}`, patch)
      const [row] = await db.select('supplier_returns', `select=*,suppliers(name)&id=eq.${encodeURIComponent(String(b.id))}`)
      return res.json({ success: true, ret: returnToApp(row) })
    }

    return res.status(405).end()
  } catch (e) {
    console.error('[api/supplier-returns]', e)
    return res.status(500).json({ success: false, error: STORAGE_ERROR })
  }
}

export default withStaff(handler)
