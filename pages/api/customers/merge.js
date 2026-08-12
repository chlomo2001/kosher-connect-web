// Merge two REAL customer records — owner-only.
//
// merge-elid.js next door only ever deletes an empty ELID import. Nearly every
// duplicate left in the book is two real records, each carrying SIMs, bookings
// and money (the sheet import made a row per line, and the same man was typed
// three ways), so those need a merge that moves history rather than refusing.
//
// The work is done by the merge_customers() database function in one
// transaction: it re-parents every dependent row and deletes the duplicate.
// Amounts are never touched — the append-only ledger guard allows the owner
// change and nothing else, and only while that function runs.
import { withStaff } from '../../../lib/auth.js'
import { db, tablesMode } from '../../../lib/db.js'

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Server misconfigured.' })
  if (req.staff?.role !== 'owner') return res.status(403).json({ success: false, error: 'Owner only.' })

  const dupId = String(req.body?.dupId || '')
  const survivorId = String(req.body?.survivorId || '')
  if (!dupId || !survivorId) return res.status(400).json({ success: false, error: 'Need both records.' })
  if (dupId === survivorId) return res.status(400).json({ success: false, error: 'Those are the same record.' })

  // The app addresses customers by their LEGACY id ("pl-yitschock-chaim-laifer")
  // — that is what listCustomers hands the browser — while the tables key on a
  // uuid. Accept either, and resolve before touching anything: passing a legacy
  // id straight to a uuid column is a 400 from Postgres, which is exactly how
  // this failed the first time it met real data.
  const COLS = 'id,legacy_id,first_name,last_name,phone_country_code,phone_number,notes,legacy_extras'
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const lookup = async (ref) => {
    const filter = UUID_RE.test(ref)
      ? `id=eq.${ref}`
      : `legacy_id=eq.${encodeURIComponent(ref)}`
    const rows = await db.select('customers', `select=${COLS}&${filter}&limit=1`).catch(() => [])
    return rows[0] || null
  }
  const [dup, keep] = await Promise.all([lookup(dupId), lookup(survivorId)])
  if (!dup || !keep) return res.status(404).json({ success: false, error: 'Customer not found.' })
  if (String(dup.id) === String(keep.id)) {
    return res.status(400).json({ success: false, error: 'Those are the same record.' })
  }

  const nameOf = (c) => `${c.first_name || ''} ${c.last_name || ''}`.trim() || '(no name)'
  const dupPhone = `${dup.phone_country_code || ''}${dup.phone_number || ''}`.trim()

  let result
  try {
    result = await db.rpc('merge_customers', { p_dup: dup.id, p_survivor: keep.id })
  } catch (e) {
    // The function raises a plain-English reason for every refusal it makes.
    return res.status(400).json({ success: false, error: String(e?.message || 'Merge failed.').replace(/^.*?:\s*/, '') })
  }

  // Say on the surviving record what was folded into it, so the history of the
  // merge survives the merge — including the number the duplicate carried,
  // which is otherwise lost with the row.
  const stamp = new Date().toLocaleDateString('en-GB')
  const line = `${stamp}: merged duplicate record — ${nameOf(dup)}${dupPhone ? ` (${dupPhone})` : ''}.`

  // The ELID switch login lives in legacy_extras, not in a table of its own,
  // so the database merge cannot carry it: without this the deleted record's
  // ELID account would be orphaned (99 customers hold one).
  const elidOf = (c) => {
    const x = c.legacy_extras || {}
    const all = [x.elidUsername, ...(Array.isArray(x.elidUsernames) ? x.elidUsernames : [])]
    const seen = new Set(), out = []
    for (const u of all) {
      const v = String(u || '').trim()
      if (!v || seen.has(v.toLowerCase())) continue
      seen.add(v.toLowerCase()); out.push(v)
    }
    return out
  }
  const elid = [...elidOf(keep)]
  for (const u of elidOf(dup)) if (!elid.some((x) => x.toLowerCase() === u.toLowerCase())) elid.push(u)

  const extras = { ...(keep.legacy_extras || {}) }
  if (elid.length) { extras.elidUsernames = elid; extras.elidUsername = elid[0] }

  await db.update('customers', `id=eq.${keep.id}`, {
    notes: keep.notes ? `${keep.notes}\n${line}` : line,
    legacy_extras: extras,
    updated_at: new Date().toISOString(),
  }).catch(() => {})

  const moved = (Array.isArray(result) ? result[0] : result)?.moved || {}
  return res.json({
    success: true,
    deletedId: dupId,
    kept: { id: survivorId, name: nameOf(keep), elid },

    removed: { name: nameOf(dup), phone: dupPhone },
    moved,
  })
}

export default withStaff(handler)
