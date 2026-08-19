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
/**
 * The price band the welcome page may quote — from CONFIRMED rates only.
 *
 * Port item C1c. Out here nobody is present to catch a wrong number, and a
 * price a customer read is a price they will expect to pay. On 19 August this
 * page was found quoting £3/day, £20 minimum and £45 cap while the live list
 * said £2, £15 and £30 — three numbers that had simply drifted, with no screen
 * able to tell. So the public band is built only from rates a named person has
 * confirmed against something, and when none has been the clause disappears
 * rather than quoting figures nobody has checked.
 *
 * Inside the app the behaviour is deliberately different: a member of staff is
 * standing in front of the rate list and can see it, so an unchecked figure is
 * MARKED there rather than withheld. Refusing at the counter would stop the
 * shop trading over a tick nobody has had the chance to give yet.
 */
async function rentalRange() {
  const rows = await db.select('rental_rates',
    'select=rate_per_day,min_charge,cap,confirmed_at&active=is.true&confirmed_at=not.is.null')
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
  // Not sent to the browser — it exists so a 'why are there no prices?' question
  // has an answer in the server log rather than a shrug.
  let unpricedReason = null
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
    // Same rule, said once for the page: an unconfirmed rate is not a price.
    if (!rental) unpricedReason = 'no confirmed rental rates'
  }
  if (unpricedReason) console.log(`[public/info] price clause withheld — ${unpricedReason}`)
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600')
  return res.json({ success: true, openingHours, rental })
}
