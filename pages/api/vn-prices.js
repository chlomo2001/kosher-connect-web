// Standalone virtual-number bundle price matrix (customer price list) —
// read-only reference for the Virtual Numbers tab. Rows change via
// migrations only.

import { withStaff } from '../../lib/auth.js'
import { db, tablesMode } from '../../lib/db.js'

async function handler(req, res) {
  if (!tablesMode) {
    return res.status(503).json({ success: false, error: 'VN prices need the relational data layer.' })
  }
  try {
    if (req.method !== 'GET') return res.status(405).end()
    const rows = await db.select('vn_bundle_prices', 'order=sort.asc')
    const num = (v) => (v === null || v === undefined ? null : Number(v))
    return res.json(rows.map(r => ({
      label: r.label,
      incomingOnly: num(r.incoming_only),
      outgoing100: num(r.outgoing_100),
      unlimited: num(r.unlimited_price),
      paygBase: num(r.payg_base),
    })))
  } catch (e) {
    console.error('[api/vn-prices]', e)
    return res.status(500).json({ success: false, error: 'Storage error' })
  }
}

export default withStaff(handler)
