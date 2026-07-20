// Phone guide editor — staff read, owner-only writes over phone_models.
//
//   GET               → { success, models: [...] }   (includes inactive + notes)
//   POST { op:'save', id?, name, price, sortOrder, dualSim, yiddishText,
//          touchScreen, texting, pros, cons, notes }
//   POST { op:'retire', id }    → hide from the guide (kept for history)
//   POST { op:'restore', id }   → bring a retired model back
//
// The public page reads the separate cached endpoint /api/public/phone-guide,
// which only ever sees active rows and never the internal notes.

import { withStaff } from '../../lib/auth.js'
import { db, tablesMode } from '../../lib/db.js'

const shape = (r) => ({
  id: r.id,
  name: r.name,
  price: r.price === null ? null : Number(r.price),
  sortOrder: r.sort_order,
  dualSim: r.dual_sim || '',
  yiddishText: r.yiddish_text || '',
  touchScreen: r.touch_screen || '',
  texting: r.texting || '',
  pros: r.pros || '',
  cons: r.cons || '',
  notes: r.notes || '',
  active: r.active,
})

async function handler(req, res) {
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Needs the relational data layer.' })

  if (req.method === 'GET') {
    const rows = await db.select('phone_models', 'select=*&order=sort_order.asc,name.asc')
    return res.json({ success: true, models: rows.map(shape) })
  }

  if (req.method !== 'POST') return res.status(405).end()
  if (req.staff && req.staff.role !== 'owner') {
    return res.status(403).json({ success: false, error: 'Admin only.' })
  }
  const b = req.body || {}

  try {
    if (b.op === 'retire' || b.op === 'restore') {
      await db.update('phone_models', `id=eq.${encodeURIComponent(String(b.id))}`, {
        active: b.op === 'restore', updated_at: new Date().toISOString(),
      })
      return res.json({ success: true })
    }

    if (b.op === 'save') {
      const name = String(b.name || '').trim().slice(0, 80)
      if (!name) return res.status(400).json({ success: false, error: 'Give the phone a name.' })
      const price = b.price === '' || b.price == null ? null : Number(b.price)
      if (price !== null && !(Number.isFinite(price) && price >= 0)) {
        return res.status(400).json({ success: false, error: 'Price must be a number (or empty).' })
      }
      const order = Number(b.sortOrder)
      const row = {
        name,
        price,
        sort_order: Number.isFinite(order) ? Math.round(order) : 100,
        dual_sim: String(b.dualSim || '').trim().slice(0, 120) || null,
        yiddish_text: String(b.yiddishText || '').trim().slice(0, 120) || null,
        touch_screen: String(b.touchScreen || '').trim().slice(0, 120) || null,
        texting: String(b.texting || '').trim().slice(0, 120) || null,
        pros: String(b.pros || '').trim().slice(0, 2000) || null,
        cons: String(b.cons || '').trim().slice(0, 2000) || null,
        notes: String(b.notes || '').trim().slice(0, 2000) || null,
        updated_at: new Date().toISOString(),
      }
      if (b.id) {
        await db.update('phone_models', `id=eq.${encodeURIComponent(String(b.id))}`, row)
        return res.json({ success: true, id: b.id })
      }
      const inserted = await db.insert('phone_models', [{ ...row, active: true }])
      return res.json({ success: true, id: inserted[0]?.id })
    }

    return res.status(400).json({ success: false, error: 'Unknown op.' })
  } catch (e) {
    console.error('[api/phone-guide]', e)
    const dup = String(e?.message || '').includes('phone_models_name_key')
    return res.status(dup ? 400 : 500).json({ success: false, error: dup ? 'A model with that name already exists.' : 'Could not save.' })
  }
}

export default withStaff(handler)
