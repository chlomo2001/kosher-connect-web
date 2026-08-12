// "These two are not the same person" — owner-only. Records the verdict so
// the duplicate review never raises that pair again.
//
// This first went to the settings table and failed every time: settings is
// deliberately edit-only over a whitelist of pricing keys, and rightly refuses
// to invent one. A judgement about two customers belongs beside the customers,
// where it also survives a browser change and is shared with whoever is at the
// counter — customer_dupe_dismissals.
import { withStaff } from '../../../lib/auth.js'
import { db, tablesMode } from '../../../lib/db.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// The browser addresses customers by legacy id; the tables key on uuid.
export async function toUuid(ref) {
  const v = String(ref || '')
  if (!v) return null
  if (UUID_RE.test(v)) return v
  const rows = await db.select('customers',
    `select=id&legacy_id=eq.${encodeURIComponent(v)}&limit=1`).catch(() => [])
  return rows[0]?.id || null
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Server misconfigured.' })
  if (req.staff?.role !== 'owner') return res.status(403).json({ success: false, error: 'Owner only.' })

  const [a, b] = await Promise.all([toUuid(req.body?.aId), toUuid(req.body?.bId)])
  if (!a || !b) return res.status(404).json({ success: false, error: 'Customer not found.' })
  if (a === b) return res.status(400).json({ success: false, error: 'Those are the same record.' })

  // Stored ordered so one row answers the pair whichever way round it is asked.
  const [lo, hi] = a < b ? [a, b] : [b, a]
  await db.insertIgnoreDup('customer_dupe_dismissals', [{
    customer_a: lo,
    customer_b: hi,
    dismissed_by: req.staff?.name || req.staff?.email || null,
  }], 'customer_a,customer_b')

  return res.json({ success: true })
}

export default withStaff(handler)
