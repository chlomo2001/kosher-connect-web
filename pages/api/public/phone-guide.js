// Public phone guide — active models only, internal notes stripped.
// Backs the customer-facing /phone-guide page; cached at the edge so the
// database sees at most one read every five minutes.

import { db, tablesMode } from '../../../lib/db.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
  try {
    if (!tablesMode) return res.json({ success: true, models: [] })
    const rows = await db.select('phone_models', 'select=name,price,sort_order,dual_sim,yiddish_text,touch_screen,texting,pros,cons&active=eq.true&order=sort_order.asc,name.asc')
    return res.json({
      success: true,
      models: rows.map((r) => ({
        name: r.name,
        price: r.price === null ? null : Number(r.price),
        dualSim: r.dual_sim || '',
        yiddishText: r.yiddish_text || '',
        touchScreen: r.touch_screen || '',
        texting: r.texting || '',
        pros: r.pros || '',
        cons: r.cons || '',
      })),
    })
  } catch (e) {
    console.error('[api/public/phone-guide]', e)
    return res.json({ success: true, models: [] })
  }
}
