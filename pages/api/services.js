// Service price menu (repairs / online / tickets / phones) — read-only.
// Prices are maintained in the service_prices table (seeded from the shop's
// live price list); the app never hardcodes them.

import { db, tablesMode } from '../../lib/db.js'

async function handler(req, res) {
  if (!tablesMode) {
    return res.status(503).json({ success: false, error: 'Service menu needs the relational data layer.' })
  }
  try {
    if (req.method !== 'GET') return res.status(405).end()
    const { category } = req.query
    let q = 'active=is.true&order=service_id.asc'
    if (category) q += `&category=eq.${encodeURIComponent(category)}`
    const rows = await db.select('service_prices', q)
    return res.json(rows.map(r => ({
      id: r.id,
      serviceId: r.service_id,
      name: r.name,
      category: r.category,
      price: Number(r.price),
    })))
  } catch (e) {
    console.error('[api/services]', e)
    return res.status(500).json({ success: false, error: 'Storage error' })
  }
}

export default withStaff(handler)
