// Service price menu (repairs / online / tickets / phones / sim).
// Reads are open to any signed-in staff (the app never hardcodes prices);
// writes are ADMIN-ONLY so the price list is controlled from Settings:
//   GET  ?category=          → active items (what the charging screens use)
//   GET  ?all=1              → every item incl. retired (Settings editor)
//   POST {name, category, price, kcPrice?, repeatPrice?, bulkPrice?}
//   PUT  {id, ...same fields..., active?}
// Items are never deleted — retire them (active=false) so old charges keep
// their label.

import { withStaff } from '../../lib/auth.js'
import { db, tablesMode, STORAGE_ERROR } from '../../lib/db.js'

const CATEGORIES = ['repair', 'online', 'tickets', 'phone', 'sim', 'other']
const money = (v) => Math.round((Number(v) || 0) * 100) / 100
const opt = (v) => (v === undefined || v === null || v === '' ? null : money(v))

const toApp = (r) => ({
  id: r.id,
  serviceId: r.service_id,
  name: r.name,
  category: r.category,
  price: Number(r.price),
  // "Purchased at KC" tier; null = no KC price for this job
  kcPrice: r.kc_price === null || r.kc_price === undefined ? null : Number(r.kc_price),
  // Quantity tiers: repeat = per unit from the 2nd (to 5th for tickets;
  // "two or more" for online); bulk = per unit from the 6th (tickets).
  repeatPrice: r.repeat_price === null || r.repeat_price === undefined ? null : Number(r.repeat_price),
  bulkPrice: r.bulk_price === null || r.bulk_price === undefined ? null : Number(r.bulk_price),
  active: r.active !== false,
})

// Unicode-aware (sweep 2026-08-02 #23): the ASCII-only version collapsed
// every Hebrew service name to the bare category prefix, so the second one
// collided on the unique service_id and died as "Storage error".
const slug = (s) => String(s).toLowerCase().trim()
  .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60)

async function handler(req, res) {
  if (!tablesMode) {
    return res.status(503).json({ success: false, error: 'Service menu needs the relational data layer.' })
  }
  try {
    if (req.method === 'GET') {
      const { category, all } = req.query
      let q = 'order=category.asc,service_id.asc'
      if (all !== '1') q = 'active=is.true&' + q
      if (category) q += `&category=eq.${encodeURIComponent(category)}`
      const rows = await db.select('service_prices', q)
      const mapped = rows.map(toApp)
      // Historical shape: bare array for the charging screens.
      return all === '1' ? res.json({ success: true, items: mapped }) : res.json(mapped)
    }

    if (req.staff && req.staff.role !== 'owner') {
      return res.status(403).json({ success: false, error: 'Editing the price menu is admin-only.' })
    }
    const b = req.body || {}

    if (req.method === 'POST') {
      const name = String(b.name || '').trim()
      if (!name) return res.status(400).json({ success: false, error: 'Service name is required.' })
      if (!CATEGORIES.includes(b.category)) {
        return res.status(400).json({ success: false, error: `Category must be one of: ${CATEGORIES.join(', ')}.` })
      }
      const price = Number(b.price)
      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({ success: false, error: 'Price must be £0 or more.' })
      }
      // A same-name collision surfaces as a usable message, not "Storage error".
      const serviceId = `${b.category}-${slug(name)}`
      const clash = await db.select('service_prices', `select=id&service_id=eq.${encodeURIComponent(serviceId)}&limit=1`)
      if (clash.length) {
        return res.status(409).json({ success: false, error: 'A service with that name already exists in this category.' })
      }
      const [row] = await db.insert('service_prices', [{
        service_id: serviceId,
        name,
        category: b.category,
        price: money(price),
        kc_price: opt(b.kcPrice),
        repeat_price: opt(b.repeatPrice),
        bulk_price: opt(b.bulkPrice),
        active: true,
      }])
      return res.json({ success: true, item: toApp(row) })
    }

    if (req.method === 'PUT') {
      if (!b.id) return res.status(400).json({ success: false, error: 'Item id is required.' })
      const patch = {}
      if (b.name !== undefined) {
        const name = String(b.name).trim()
        if (!name) return res.status(400).json({ success: false, error: 'Name cannot be empty.' })
        patch.name = name
      }
      if (b.price !== undefined) {
        const price = Number(b.price)
        if (!Number.isFinite(price) || price < 0) {
          return res.status(400).json({ success: false, error: 'Price must be £0 or more.' })
        }
        patch.price = money(price)
      }
      if (b.kcPrice !== undefined) patch.kc_price = opt(b.kcPrice)
      if (b.repeatPrice !== undefined) patch.repeat_price = opt(b.repeatPrice)
      if (b.bulkPrice !== undefined) patch.bulk_price = opt(b.bulkPrice)
      if (b.active !== undefined) patch.active = !!b.active
      const updated = await db.update('service_prices', `id=eq.${encodeURIComponent(String(b.id))}`, patch)
      if (!updated.length) return res.status(404).json({ success: false, error: 'Item not found.' })
      return res.json({ success: true, item: toApp(updated[0]) })
    }

    return res.status(405).end()
  } catch (e) {
    console.error('[api/services]', e)
    return res.status(500).json({ success: false, error: STORAGE_ERROR })
  }
}

export default withStaff(handler)
