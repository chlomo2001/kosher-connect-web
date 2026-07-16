// #66 — customer portal, read-only slice. Behind PORTAL_ENABLED=1, so it is
// dark in production until the owner turns the portal on.
//
// GET with an Authorization: Bearer <supabase access token> (obtained from the
// magic-link / OAuth redirect). Verifies the token, matches the signed-in
// email to a customer, and returns ONLY that customer's own balance, rentals
// and bookings. Deliberately narrow: no passport numbers, no card details, no
// passenger data, no other customers — the low-ROI catalog/booking surfaces
// from the review are intentionally skipped.

import { db, tablesMode } from '../../../lib/db.js'
import { verifyPortalToken } from '../../../lib/auth.js'
import { normalizeEmail } from '../../../lib/mappers.js'

export default async function handler(req, res) {
  if (process.env.PORTAL_ENABLED !== '1') {
    return res.status(404).json({ success: false, error: 'Not found.' })
  }
  if (req.method !== 'GET') return res.status(405).end()
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Portal unavailable.' })

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
  const user = await verifyPortalToken(token)
  if (!user) return res.status(401).json({ success: false, error: 'Please sign in again.' })

  const norm = normalizeEmail(user.email)
  const custRows = norm
    ? await db.select('customers', `select=id,legacy_extras,stripe_pm_id,email_raw&email_normalized=eq.${encodeURIComponent(norm)}`)
    : []
  // Exact-match guard: when several customers collapse to one normalized email
  // (dots/+ significant outside Gmail), require the verified raw email to match so
  // distinct mailboxes can't read each other's data. audit C8 / U1.
  let cust = custRows[0] || null
  if (custRows.length > 1) {
    const wanted = String(user.email || '').trim().toLowerCase()
    cust = custRows.find((r) => String(r.email_raw || '').trim().toLowerCase() === wanted) || null
  }
  if (!cust) {
    // No unambiguous match for this signed-in email: succeed, but show nothing.
    return res.json({ success: true, customer: null, balance: 0, rentals: [], bookings: [] })
  }
  const extras = cust.legacy_extras || {}

  const [balRows, rentalRows, bookingRows] = await Promise.all([
    db.select('customer_balances', `customer_id=eq.${cust.id}`),
    db.select('rentals', `select=legacy_extras&customer_id=eq.${cust.id}&order=created_at.desc`),
    db.select('bookings', `select=route,airline,booking_reference,travel_date,status&customer_id=eq.${cust.id}&order=travel_date.desc`),
  ])

  const balance = balRows.length ? Number(balRows[0].balance) : 0
  const rentals = rentalRows
    .map((r) => r.legacy_extras || {})
    .map((x) => ({
      phoneNumber: x.phoneNumber || '',
      country: x.country || '',
      fromDate: x.fromDate || '',
      toDate: x.toDate || '',
      status: x.status || '',
    }))
  const bookings = bookingRows.map((b) => ({
    route: b.route || '',
    airline: b.airline || '',
    bookingReference: b.booking_reference || '',
    travelDate: b.travel_date || '',
    status: b.status || '',
  }))

  return res.json({
    success: true,
    customer: { firstName: extras.firstName || '', lastName: extras.lastName || '' },
    balance,
    rentals,
    bookings,
    cardOnFile: !!cust.stripe_pm_id,
  })
}
