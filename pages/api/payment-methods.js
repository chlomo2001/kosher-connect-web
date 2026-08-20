// Who can the shop actually collect from? Booleans only, in bulk.
//
// The app already answers this one customer at a time — /api/customers/save-card
// returns `hadCard` for the person whose card is being saved — and there was no
// way to ask it of everybody at once. So the SIMs tab could show which plans
// the shop pays for and not which of those it can ever get paid for.
//
// WHAT THIS DOES NOT RETURN: the Stripe payment-method ids, the customer's
// Stripe id, the last four, or anything else that identifies an instrument.
// A screen only ever needs to know whether there IS one — `card: true` and
// `dd: 'active'` answer every question the SIMs tab asks — and an id that is
// never sent is an id that cannot leak into a log, a screenshot or a support
// thread. Same reasoning as pages/api/portal/me.js, which sends `cardOnFile`
// rather than the id it derives it from.
//
// Keyed by legacy_id, because that is what the app's own records point at:
// a SIM carries `customerId: 'pl-yeshaye-tager'`, not a uuid.
import { withStaff } from '../../lib/auth.js'
import { selectAllPaged, tablesMode } from '../../lib/db.js'

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Needs the relational data layer.' })

  // Paged: 788 customers today, and a truncated read here would report
  // "nothing to collect from" for everybody past the cap — a false alarm on
  // real plans, which is worse than no filter at all.
  const rows = await selectAllPaged(
    'customers',
    'legacy_id,stripe_pm_id,stripe_dd_pm_id,dd_mandate_status',
    'legacy_id=not.is.null&order=legacy_id.asc'
  )

  const methods = {}
  for (const r of rows) {
    const card = !!r.stripe_pm_id
    // A mandate id with no status is not a mandate anybody may collect on —
    // the webhook sets both together, so one without the other means the
    // status update has not landed yet.
    const dd = r.stripe_dd_pm_id ? String(r.dd_mandate_status || 'pending') : ''
    if (!card && !dd) continue          // the common case; sending it is noise
    methods[String(r.legacy_id)] = { card, dd }
  }

  return res.json({ success: true, methods })
}

export default withStaff(handler)
