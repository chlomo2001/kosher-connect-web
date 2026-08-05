// Owner-defined extra charges — CRUD for the Settings builder.
//   GET                                         → { charges: [...] }
//   POST  {label, amount, appliesTo, mode}      → add
//   PUT   {id, ...same, active?}                → edit
//   DELETE ?id=<id>                             → remove
// Reads open to any signed-in staff (the charge flows need them); writes
// admin-only. Applied automatically by lib/customCharges.js.

import { withStaff, tabAllowedFor } from '../../lib/auth.js'
import { db, tablesMode, STORAGE_ERROR } from '../../lib/db.js'
import { postAutoCharges } from '../../lib/customCharges.js'

const TARGETS = ['booking', 'service', 'sim', 'repair', 'rental', 'any']
const MODES = ['auto', 'optional']
const money = (v) => Math.round((Number(v) || 0) * 100) / 100

const toApp = (r) => ({
  id: r.id,
  label: r.label,
  amount: Number(r.amount),
  appliesTo: r.applies_to,
  mode: r.mode,
  active: r.active !== false,
})

async function handler(req, res) {
  if (!tablesMode) {
    return res.status(503).json({ success: false, error: 'Extra charges need the relational data layer.' })
  }
  try {
    if (req.method === 'GET') {
      const rows = await db.select('custom_charges', 'order=applies_to.asc,label.asc')
      return res.json({ success: true, charges: rows.map(toApp) })
    }

    const b = req.body || {}

    // Apply auto-extras for a just-created record whose money doesn't flow
    // through a single server charge (rentals, SIMs). It's the charging action,
    // not an admin config change — but it still posts payment rows with a
    // caller-chosen tender, so it requires the tab whose record it charges
    // (sweep 2026-08-02 #4): a helper who may not write rentals must not be
    // able to inflate the Z-report's expected cash through this side door.
    if (req.method === 'POST' && b.op === 'apply') {
      const APPLY_TABS = { rental: 'rentals', sim: 'sim' }
      if (!APPLY_TABS[b.appliesTo]) {
        return res.status(400).json({ success: false, error: 'apply supports rental and sim.' })
      }
      if (!(await tabAllowedFor(req.staff, APPLY_TABS[b.appliesTo]))) {
        return res.status(403).json({ success: false, error: 'Not permitted to charge extras here.' })
      }
      if (!b.customerId || !b.refBase) return res.status(400).json({ success: false, error: 'customerId and refBase are required.' })
      const custRows = await db.select('customers', `select=id&legacy_id=eq.${encodeURIComponent(String(b.customerId))}`)
      if (!custRows.length) return res.status(400).json({ success: false, error: 'Customer not found.' })
      const extras = await postAutoCharges({
        customerUuid: custRows[0].id, appliesTo: b.appliesTo, refBase: String(b.refBase),
        paidNow: !!b.paidNow, method: b.method,
      })
      return res.json({ success: true, extras: extras.lines, total: extras.total })
    }

    if (req.staff && req.staff.role !== 'owner') {
      return res.status(403).json({ success: false, error: 'Extra charges are admin-only.' })
    }

    if (req.method === 'POST') {
      const label = String(b.label || '').trim()
      if (!label) return res.status(400).json({ success: false, error: 'Give the charge a name.' })
      const amount = money(b.amount)
      if (!(amount > 0)) return res.status(400).json({ success: false, error: 'Amount must be greater than £0.' })
      if (!TARGETS.includes(b.appliesTo)) return res.status(400).json({ success: false, error: 'Pick where it applies.' })
      const mode = MODES.includes(b.mode) ? b.mode : 'auto'
      const [row] = await db.insert('custom_charges', [{
        label, amount, applies_to: b.appliesTo, mode, active: true,
      }])
      return res.json({ success: true, charge: toApp(row) })
    }

    if (req.method === 'PUT') {
      if (!b.id) return res.status(400).json({ success: false, error: 'Charge id is required.' })
      const patch = { updated_at: new Date().toISOString() }
      if (b.label !== undefined) {
        const label = String(b.label).trim()
        if (!label) return res.status(400).json({ success: false, error: 'Name cannot be empty.' })
        patch.label = label
      }
      if (b.amount !== undefined) {
        const amount = money(b.amount)
        if (!(amount > 0)) return res.status(400).json({ success: false, error: 'Amount must be greater than £0.' })
        patch.amount = amount
      }
      if (b.appliesTo !== undefined) {
        if (!TARGETS.includes(b.appliesTo)) return res.status(400).json({ success: false, error: 'Unknown target.' })
        patch.applies_to = b.appliesTo
      }
      if (b.mode !== undefined && MODES.includes(b.mode)) patch.mode = b.mode
      if (b.active !== undefined) patch.active = !!b.active
      const updated = await db.update('custom_charges', `id=eq.${encodeURIComponent(String(b.id))}`, patch)
      if (!updated.length) return res.status(404).json({ success: false, error: 'Charge not found.' })
      return res.json({ success: true, charge: toApp(updated[0]) })
    }

    if (req.method === 'DELETE') {
      const id = String(req.query.id || '')
      if (!id) return res.status(400).json({ success: false, error: 'Charge id is required.' })
      await db.delete('custom_charges', `id=eq.${encodeURIComponent(id)}`)
      return res.json({ success: true })
    }

    return res.status(405).end()
  } catch (e) {
    console.error('[api/custom-charges]', e)
    return res.status(500).json({ success: false, error: STORAGE_ERROR })
  }
}

export default withStaff(handler)
