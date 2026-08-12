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

  const rows = await db.select('customers',
    `select=id,first_name,last_name,phone_country_code,phone_number,notes,legacy_extras&id=in.(${dupId},${survivorId})`)
  const dup = rows.find((r) => String(r.id) === dupId)
  const keep = rows.find((r) => String(r.id) === survivorId)
  if (!dup || !keep) return res.status(404).json({ success: false, error: 'Customer not found.' })

  const nameOf = (c) => `${c.first_name || ''} ${c.last_name || ''}`.trim() || '(no name)'
  const dupPhone = `${dup.phone_country_code || ''}${dup.phone_number || ''}`.trim()

  let result
  try {
    result = await db.rpc('merge_customers', { p_dup: dupId, p_survivor: survivorId })
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

  await db.update('customers', `id=eq.${survivorId}`, {
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
