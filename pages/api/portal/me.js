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
    ? await db.select('customers', `select=id,legacy_extras,stripe_pm_id,stripe_dd_pm_id,dd_mandate_status,email_raw&email_normalized=eq.${encodeURIComponent(norm)}`)
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
    // 12, not 6: the balance hero sums the customer's WHOLE ledger, so with
    // only six lines showing, an older debt made "You owe £X" impossible to
    // reconcile from anything on screen.
    db.select('ledger', `select=created_at,description,amount,entry_type&customer_id=eq.${cust.id}&order=created_at.desc&limit=12`),
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

  // Running balance per line, so the hero figure can be followed down the
  // list. Rows arrive newest-first and the balance is the sum of ALL rows, so
  // walking down subtracts each line's amount to get the balance that stood
  // after the row below it. Rounded to pence at each step — the two reads run
  // in the same Promise.all, so an entry posted between them would skew this,
  // and float drift must not add a phantom penny on top of that.
  let running = balance
  const statement = ledgerRows.map((e) => {
    const amount = Number(e.amount) || 0
    const balanceAfter = Math.round(running * 100) / 100
    running = Math.round((running - amount) * 100) / 100
    return {
      at: e.created_at,
      description: e.description || '',
      amount,
      type: e.entry_type || '',
      balanceAfter,
    }
  })

  return res.json({
    success: true,
    customer: { firstName: extras.firstName || '', lastName: extras.lastName || '' },
    balance,
    rentals,
    bookings,
    sims,
    statement,
    cardOnFile: !!cust.stripe_pm_id,
    // DD phase 1 — a live Bacs mandate (docs/DD-PLAN-2026-08-12.md).
    ddOnFile: !!cust.stripe_dd_pm_id && cust.dd_mandate_status === 'active',
    // Bank-transfer matching reference (94% of payments arrive this way).
    payRef: extras.id ? `KC-${extras.id}` : '',
  })
}
