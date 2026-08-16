// The confirmation queue: imported records, one customer at a time.
//
// 1,865 of the shop's 1,877 records came out of spreadsheets and nobody has
// ever checked them against reality. This route serves them for a human to
// vouch for, and records who did it and when.
//
// ONE CUSTOMER PER SCREEN (owner's call, 08-16), not one record per screen: the
// same person owns a customer row, three SIMs and a booking, and asking about
// each separately means meeting them four times over. A bundle is also how the
// shop thinks — "is everything right for Adler?" — so the 1,865 records become
// ~604 questions.
//
//   GET  /api/review?limit=10 → { remaining, done, total, bundles: [...] }
//   POST { customerId }       → confirm the customer AND everything attached
//
// Confirming is deliberately not undoable through the UI: it is a person saying
// "I checked this". Getting it wrong means editing the record, which is the
// point. (verified_at can be nulled in SQL if a whole session needs redoing.)

import { withStaff } from '../../lib/auth.js'
import { db, tablesMode, selectAllPaged } from '../../lib/db.js'
import { classifyContact, contactLabel } from '../../lib/contactLines.mjs'

const enc = encodeURIComponent
const UNVERIFIED = 'data_source=eq.import&verified_at=is.null'

// Everything hanging off a customer that carries its own provenance.
const ATTACHED = [
  ['sims', 'legacy_extras'],
  ['bookings', 'legacy_extras'],
  ['virtual_numbers', 'legacy_extras'],
]

async function handler(req, res) {
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Storage unavailable.' })

  if (req.method === 'GET') {
    const limit = Math.min(25, Math.max(1, parseInt(req.query.limit, 10) || 10))
    // The queue itself: oldest imported customers nobody has confirmed.
    const customers = await db.select(
      'customers',
      `select=id,legacy_id,first_name,last_name,phone_country_code,phone_number,` +
        `email_raw,address,notes,created_at&${UNVERIFIED}&order=created_at.asc&limit=${limit}`
    )
    const ids = customers.map((c) => c.id)
    const bundles = customers.map((c) => ({
      id: c.id,
      legacyId: c.legacy_id,
      name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
      phone: [c.phone_country_code, c.phone_number].filter(Boolean).join(' '),
      email: c.email_raw || '',
      address: c.address || '',
      notes: c.notes || '',
      sims: [], bookings: [], virtualNumbers: [],
    }))

    if (ids.length) {
      const inList = `in.(${ids.map(enc).join(',')})`
      // Bookings and virtual_numbers are FULLY TYPED — no legacy_extras blob at
      // all, unlike customers and sims. Asking for one is a 400 from PostgREST,
      // which is what made this route 500 on its first run in production.
      const [sims, bookings, vns] = await Promise.all([
        db.select('sims', `select=id,customer_id,legacy_extras,status,next_renewal_date,provider&customer_id=${inList}&${UNVERIFIED}`),
        db.select('bookings', `select=id,customer_id,booking_reference,route,airline,travel_date,passenger&customer_id=${inList}&${UNVERIFIED}`),
        db.select('virtual_numbers', `select=id,customer_id,number,platform,plan&customer_id=${inList}&${UNVERIFIED}`),
      ])
      const byId = new Map(bundles.map((b) => [b.id, b]))
      for (const s of sims) {
        byId.get(s.customer_id)?.sims.push({
          id: s.id,
          number: s.legacy_extras?.simNumber || '',
          provider: s.provider || s.legacy_extras?.provider || '',
          status: s.status || '',
          renewal: s.next_renewal_date || '',
        })
      }
      for (const b of bookings) {
        byId.get(b.customer_id)?.bookings.push({
          id: b.id,
          ref: b.booking_reference || '',
          route: [b.route, b.airline].filter(Boolean).join(' · '),
          date: b.travel_date || '',
          passenger: b.passenger || '',
        })
      }
      for (const v of vns) {
        byId.get(v.customer_id)?.virtualNumbers.push({
          id: v.id,
          number: v.number || '',
          platform: [v.platform, v.plan].filter(Boolean).join(' · '),
        })
      }

      // Contact number vs the lines we run for them — the distinction the card
      // could not previously show. Done here, where both are already loaded.
      for (const bundle of bundles) {
        const c = classifyContact(bundle.phone, bundle.sims.map((s) => ({
          id: s.id, simNumber: s.number, provider: s.provider, status: s.status,
        })))
        bundle.contact = { kind: c.kind, simId: c.simId || null, label: contactLabel(c) }
      }
    }

    // Progress, counted directly — four small COUNT queries beat maintaining a
    // tally that can drift from the thing it counts.
    const progress = {}
    for (const table of ['customers', 'sims', 'bookings', 'virtual_numbers']) {
      const [imported, left] = await Promise.all([
        selectAllPaged(table, 'id', 'data_source=eq.import&order=id.asc'),
        selectAllPaged(table, 'id', `${UNVERIFIED}&order=id.asc`),
      ])
      progress[table] = { imported: imported.length, remaining: left.length }
    }
    const total = Object.values(progress).reduce((n, p) => n + p.imported, 0)
    const remaining = Object.values(progress).reduce((n, p) => n + p.remaining, 0)

    return res.json({ success: true, total, remaining, done: total - remaining, progress, bundles })
  }

  if (req.method === 'POST') {
    const { customerId } = req.body || {}
    if (!customerId) return res.status(400).json({ success: false, error: 'customerId is required.' })

    const stamp = { verified_at: new Date().toISOString(), verified_by: req.staff?.id || null }
    const rows = await db.update('customers', `id=eq.${enc(customerId)}&${UNVERIFIED}`, stamp)
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'That customer is not waiting to be confirmed.' })
    }
    // Everything attached goes with it — that is what the screen showed.
    let attached = 0
    for (const [table] of ATTACHED) {
      const done = await db.update(table, `customer_id=eq.${enc(customerId)}&${UNVERIFIED}`, stamp)
      attached += done.length
    }
    return res.json({ success: true, confirmed: 1 + attached, attached })
  }

  res.status(405).end()
}

export default withStaff(handler)
