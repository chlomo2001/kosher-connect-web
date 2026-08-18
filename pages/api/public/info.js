// Public business info for the welcome page — deliberately no auth and no
// customer data: only what's already printed on the shop door. The welcome
// page fetches this so the owner can change the hours from Settings and the
// public site follows, without a deploy.

import { db, tablesMode } from '../../../lib/db.js'

const DEFAULT_OPENING_HOURS = 'Sunday–Thursday, 2:00–6:30pm'

// The rental price RANGE, read from the same rental_rates rows the till
// charges from. The welcome page used to carry these numbers as typed-in
// text, and by 19 Aug every one of them had drifted: it said £3 a day when
// the cheapest destination is £2, a £20 minimum when USA-no-SIM is £15, and
// a £45 cap when the lowest is £30. A price a customer reads must come from
// the price list the shop bills from, or it is just a memory of one.
async function rentalRange() {
  const rows = await db.select('rental_rates', 'select=rate_per_day,min_charge,cap&active=is.true')
  if (!rows.length) return null
  const span = (key) => {
    const ns = rows.map((r) => Number(r[key])).filter((n) => Number.isFinite(n))
    return ns.length ? { from: Math.min(...ns), to: Math.max(...ns) } : null
  }
  const day = span('rate_per_day'), min = span('min_charge'), cap = span('cap')
  return day && min && cap ? { day, min, cap } : null
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  let openingHours = DEFAULT_OPENING_HOURS
  let rental = null
  if (tablesMode) {
    try {
      const rows = await db.select('settings', 'select=text_value&key=eq.opening_hours')
      if (rows.length && rows[0].text_value) openingHours = rows[0].text_value
    } catch {
      // fall through to the default — public page must never 500 over this
    }
    try {
      rental = await rentalRange()
    } catch {
      // No prices rather than wrong prices: the page drops the clause.
    }
  }
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600')
  return res.json({ success: true, openingHours, rental })
}
