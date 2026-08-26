// Settings CRUD for the owner-editable travel requirement rules.
// GET returns the current matrix plus the pickers the UI needs; PUT upserts one
// cell (destination × nationality → auth_type + note + active). Owner-only.
import { withStaff } from '../../lib/auth.js'
import { db, tablesMode, STORAGE_ERROR } from '../../lib/db.js'
import { AUTH, KNOWN_DESTINATIONS, KNOWN_NATIONALITIES } from '../../lib/travelRules.mjs'
import { clearTravelRulesCache } from '../../lib/travelRulesDb.js'

const AUTH_TYPES = Object.values(AUTH).map((a) => ({ code: a.code, label: a.label }))
const VALID = new Set(AUTH_TYPES.map((a) => a.code))

async function handler(req, res) {
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Travel rules need the relational data layer.' })
  if (req.staff?.role !== 'owner') return res.status(403).json({ success: false, error: 'Owner only.' })

  if (req.method === 'GET') {
    // A failed read used to become `rules = []`, and an empty matrix on this
    // screen does not read as "could not load" — it reads as "no rules are
    // set", which is an invitation to type them all in again over rules that
    // are still there. The card already knows how to say it could not load;
    // it just was never told. (The booking passport gate does not come through
    // here — it reads lib/travelRulesDb.js — so this is the editor's honesty,
    // not the gate's.)
    let rules
    try {
      rules = await db.select('travel_requirement_rules',
        'select=id,destination,nationality,auth_type,note,active&order=destination.asc,nationality.asc')
    } catch (e) {
      console.error('[api/travel-rules] could not read the rules:', e)
      return res.status(503).json({ success: false, error: STORAGE_ERROR })
    }
    return res.json({
      success: true,
      rules: rules.map((r) => ({
        id: r.id, destination: r.destination, nationality: r.nationality,
        authType: r.auth_type, note: r.note || '', active: r.active !== false,
      })),
      authTypes: AUTH_TYPES,
      destinations: KNOWN_DESTINATIONS,
      nationalities: KNOWN_NATIONALITIES,
    })
  }

  if (req.method === 'PUT') {
    const b = req.body || {}
    const destination = String(b.destination || '').trim().toUpperCase()
    const nationality = String(b.nationality || '').trim().toUpperCase()
    const authType = String(b.authType || '').trim().toUpperCase()
    if (!destination || !nationality) return res.status(400).json({ success: false, error: 'destination and nationality required.' })
    if (!VALID.has(authType)) return res.status(400).json({ success: false, error: 'Unknown authorisation type.' })
    const row = {
      destination, nationality, auth_type: authType,
      note: String(b.note || '').trim() || null,
      active: b.active !== false,
      updated_at: new Date().toISOString(),
    }
    // Upsert by the (destination, nationality) unique cell.
    const existing = await db.select('travel_requirement_rules',
      `select=id&destination=eq.${encodeURIComponent(destination)}&nationality=eq.${encodeURIComponent(nationality)}`)
    let saved
    if (existing[0]) saved = (await db.update('travel_requirement_rules', `id=eq.${existing[0].id}`, row))[0]
    else saved = (await db.insert('travel_requirement_rules', [row]))[0]
    clearTravelRulesCache()
    return res.json({ success: true, rule: { id: saved.id, destination, nationality, authType, note: row.note || '', active: row.active } })
  }

  return res.status(405).end()
}

export default withStaff(handler)
