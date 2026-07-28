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
    return res.json({ success: true, customer: null, balance: 0, rentals: [], bookings: [], sims: [], statement: [] })
  }
  const extras = cust.legacy_extras || {}

  const [balRows, rentalRows, bookingRows, simRows, ledgerRows] = await Promise.all([
    db.select('customer_balances', `customer_id=eq.${cust.id}`),
    db.select('rentals', `select=legacy_extras&customer_id=eq.${cust.id}&order=created_at.desc`),
    db.select('bookings', `select=route,airline,booking_reference,travel_date,status&customer_id=eq.${cust.id}&order=travel_date.desc`),
    // SIM plans: 88% of customers have one — without this card the portal
    // looks empty/broken to the typical customer. Safe columns only: never
    // the alias email or anything credential-adjacent.
    db.select('sims', `select=provider,tier,status,next_renewal_date&customer_id=eq.${cust.id}&order=created_at.asc`),
    // Mini statement: the customer's own last few wallet lines — date,
    // description and amount only (no references, no staff ids).
    db.select('ledger', `select=created_at,description,amount,entry_type&customer_id=eq.${cust.id}&order=created_at.desc&limit=6`),
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

  const sims = simRows.map((s) => ({
    provider: s.provider || '',
    tier: s.tier || '',
    status: s.status || '',
    renewalDate: s.next_renewal_date || '',
  }))

  const statement = ledgerRows.map((e) => ({
    at: e.created_at,
    description: e.description || '',
    amount: Number(e.amount) || 0,
    type: e.entry_type || '',
  }))

  return res.json({
    success: true,
    customer: { firstName: extras.firstName || '', lastName: extras.lastName || '' },
    balance,
    rentals,
    bookings,
    sims,
    statement,
    cardOnFile: !!cust.stripe_pm_id,
    // Bank-transfer matching reference (94% of payments arrive this way).
    payRef: extras.id ? `KC-${extras.id}` : '',
  })
}
