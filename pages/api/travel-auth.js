// Travel authorisations — a per-traveller record of an ESTA / eTA / ETA-IL /
// visa with its "valid until" date (feature: travel requirements, 2026-07-21).
//
// These live with the passport (reused across trips for ~2 years), so they are
// keyed to the CUSTOMER + traveller name, not to a booking. No passport number
// is stored here — only the authorisation reference. Same tab gate as bookings.

import { withTab } from '../../lib/auth.js'
import { db, tablesMode, STORAGE_ERROR } from '../../lib/db.js'
import { requirementFor, passportCheck, coverageStatus } from '../../lib/travelRules.mjs'
import { loadTravelRules } from '../../lib/travelRulesDb.js'

const VALID_TYPES = new Set(['ESTA', 'ETA_CA', 'ETA_IL', 'ETIAS', 'ETA_UK', 'VISA'])

function toApp(r) {
  return {
    id: r.id,
    travellerName: r.traveller_name || '',
    type: r.type || '',
    country: r.country || '',
    reference: r.reference || '',
    validFrom: r.valid_from || '',
    validUntil: r.valid_until || '',
    notes: r.notes || '',
    updatedAt: r.updated_at,
  }
}

async function customerUuid(legacyId) {
  const rows = await db.select('customers', `select=id&legacy_id=eq.${encodeURIComponent(String(legacyId))}`)
  return rows[0]?.id || null
}

async function handler(req, res) {
  if (!tablesMode) {
    return res.status(503).json({ success: false, error: 'Travel records need the relational data layer.' })
  }

  try {
    if (req.method === 'GET') {
      // Full computed view for one booking: per-passenger requirement +
      // passport readiness + recorded-authorisation coverage. The rules run
      // server-side (single source of truth in lib/travelRules.mjs), and the
      // passport CHECK is returned as ok/note only — the expiry value itself
      // stays owner-only, so helpers get the readiness signal without the date.
      if (req.query.bookingId) {
        const bid = encodeURIComponent(String(req.query.bookingId))
        const [bk] = await db.select('bookings',
          `select=id,route,travel_date,destination_country,customers(legacy_id),booking_passengers(full_name,nationality,passport_expiry)&id=eq.${bid}`)
        if (!bk) return res.status(404).json({ success: false, error: 'Booking not found.' })
        const destination = bk.destination_country || ''
        const travelDate = bk.travel_date || ''
        const legacyId = bk.customers?.legacy_id ?? null
        const auths = legacyId
          ? await db.select('travel_authorisations',
              `select=*&customer_id=eq.${(await customerUuid(legacyId)) || '00000000-0000-0000-0000-000000000000'}&order=updated_at.desc`)
          : []
        const rules = await loadTravelRules()
        const passengers = (bk.booking_passengers || []).map(p => {
          const name = p.full_name || ''
          const requirement = requirementFor({ destination, nationality: p.nationality, rules })
          const pass = passportCheck({ passportExpiry: p.passport_expiry, travelDate })
          const mine = auths.filter(a => (a.traveller_name || '').trim().toLowerCase() === name.trim().toLowerCase())
          const coverage = coverageStatus({ requirement, travelDate, auths: mine })
          return {
            name,
            nationality: p.nationality || '',
            requirement: {
              code: requirement.code, label: requirement.label, url: requirement.url,
              validityMonths: requirement.validityMonths, note: requirement.note || '',
            },
            passport: { ok: pass.ok, note: pass.note || '' },
            coverage,
          }
        })
        return res.json({
          success: true, view: true,
          customerId: legacyId, destination, travelDate, route: bk.route || '',
          passengers,
          authorisations: auths.map(toApp),
        })
      }

      const legacy = String(req.query.customerId || '')
      if (!legacy) return res.status(400).json({ success: false, error: 'customerId required.' })
      const uuid = await customerUuid(legacy)
      if (!uuid) return res.json({ success: true, authorisations: [] })
      const rows = await db.select('travel_authorisations',
        `select=*&customer_id=eq.${uuid}&order=updated_at.desc`)
      return res.json({ success: true, authorisations: rows.map(toApp) })
    }

    if (req.method === 'POST') {
      const b = req.body || {}
      const name = String(b.travellerName || '').trim()
      const type = String(b.type || '').trim().toUpperCase()
      if (!b.customerId) return res.status(400).json({ success: false, error: 'customerId required.' })
      if (!name) return res.status(400).json({ success: false, error: 'Traveller name is required.' })
      if (!VALID_TYPES.has(type)) return res.status(400).json({ success: false, error: 'Unknown authorisation type.' })
      const uuid = await customerUuid(b.customerId)
      if (!uuid) return res.status(404).json({ success: false, error: 'Customer not found.' })

      const patch = {
        customer_id: uuid,
        traveller_name: name,
        type,
        country: String(b.country || '').trim() || null,
        reference: String(b.reference || '').trim() || null,
        valid_from: b.validFrom || null,
        valid_until: b.validUntil || null,
        notes: String(b.notes || '').trim() || null,
        updated_at: new Date().toISOString(),
      }

      // Upsert by (customer, traveller name case-insensitive, type). The DB has
      // a matching unique index as a backstop, but the match is done here in JS
      // because the index is on lower(traveller_name) — an expression PostgREST
      // can't target with on_conflict.
      const existing = await db.select('travel_authorisations',
        `select=id,traveller_name&customer_id=eq.${uuid}&type=eq.${encodeURIComponent(type)}`)
      const hit = existing.find(r => (r.traveller_name || '').trim().toLowerCase() === name.toLowerCase())
      let row
      if (hit) {
        const [updated] = await db.update('travel_authorisations', `id=eq.${hit.id}`, patch)
        row = updated
      } else {
        const [inserted] = await db.insert('travel_authorisations', [patch])
        row = inserted
      }
      return res.json({ success: true, authorisation: toApp(row) })
    }

    if (req.method === 'DELETE') {
      const id = String(req.query.id || '')
      if (!id) return res.status(400).json({ success: false, error: 'id required.' })
      await db.delete('travel_authorisations', `id=eq.${encodeURIComponent(id)}`)
      return res.json({ success: true })
    }

    return res.status(405).end()
  } catch (e) {
    console.error('[api/travel-auth]', e)
    return res.status(500).json({ success: false, error: STORAGE_ERROR })
  }
}

export default withTab('bookings', handler)
