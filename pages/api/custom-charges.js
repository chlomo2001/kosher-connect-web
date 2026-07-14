// Owner-defined extra charges — CRUD for the Settings builder.
//   GET                                         → { charges: [...] }
//   POST  {label, amount, appliesTo, mode}      → add
//   PUT   {id, ...same, active?}                → edit
//   DELETE ?id=<id>                             → remove
// Reads open to any signed-in staff (the charge flows need them); writes
// admin-only. Applied automatically by lib/customCharges.js.

import { withStaff } from '../../lib/auth.js'
import { db, tablesMode } from '../../lib/db.js'

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

    if (req.staff && req.staff.role !== 'owner') {
      return res.status(403).json({ success: false, error: 'Extra charges are admin-only.' })
    }
    const b = req.body || {}

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
    return res.status(500).json({ success: false, error: 'Storage error' })
  }
}

export default withStaff(handler)
