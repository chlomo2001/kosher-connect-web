// Public business info for the welcome page — deliberately no auth and no
// customer data: only what's already printed on the shop door. The welcome
// page fetches this so the owner can change the hours from Settings and the
// public site follows, without a deploy.

import { db, tablesMode } from '../../../lib/db.js'

const DEFAULT_OPENING_HOURS = 'Sunday–Thursday, 2:00–6:30pm'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  let openingHours = DEFAULT_OPENING_HOURS
  if (tablesMode) {
    try {
      const rows = await db.select('settings', 'select=text_value&key=eq.opening_hours')
      if (rows.length && rows[0].text_value) openingHours = rows[0].text_value
    } catch {
      // fall through to the default — public page must never 500 over this
    }
  }
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600')
  return res.json({ success: true, openingHours })
}
