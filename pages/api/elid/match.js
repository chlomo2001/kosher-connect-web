// ELID bulk match — owner-only. Walks a slice of KC customers and, for any not
// yet linked, guesses their ELID username from the name and links it ONLY when
// live ELID confirms the account exists AND its name matches. Verified links
// only — a wrong guess just fails to resolve, so nothing is mislinked and no new
// customers are created. Processed in slices (offset/limit) so the client can
// show progress and stop; it stays well under the function time limit.
import { withStaff } from '../../../lib/auth.js'
import { tablesMode } from '../../../lib/db.js'
import { listCustomers, upsertCustomer } from '../../../lib/tableStore.js'
import { elidEnabled, elidUserDetails } from '../../../lib/elid.js'

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

// ELID usernames seen in the wild are first+last, first-last or first.last.
function candidates(c) {
  const f = norm(c.firstName)
  const l = norm(c.lastName)
  if (!f || !l) return []
  return [`${f}${l}`, `${f}-${l}`, `${f}.${l}`]
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (req.staff?.role !== 'owner') return res.status(403).json({ success: false, error: 'Owner only.' })
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Needs the relational data layer.' })
  if (!elidEnabled) return res.status(503).json({ success: false, error: 'ELID isn’t configured.' })

  const offset = Math.max(0, parseInt(req.body?.offset, 10) || 0)
  const limit = Math.min(15, Math.max(1, parseInt(req.body?.limit, 10) || 10))

  const all = await listCustomers()
  const slice = all.slice(offset, offset + limit)

  const linked = []
  let checked = 0
  for (const c of slice) {
    if (c.elidUsername || (Array.isArray(c.elidUsernames) && c.elidUsernames.length)) continue // already linked — skip
    const cands = candidates(c)
    if (!cands.length) continue
    checked++
    const kcName = norm(`${c.firstName} ${c.lastName}`)
    for (const cand of cands) {
      let d
      try { d = await elidUserDetails(cand) } catch { d = { ok: false } }
      // Link only when the account exists AND the ELID name matches the KC name.
      if (d.ok && norm(d.name) === kcName) {
        await upsertCustomer({ ...c, elidUsername: cand })
        linked.push({ id: c.id, name: `${c.firstName || ''} ${c.lastName || ''}`.trim(), username: cand, balance: d.balance })
        break
      }
    }
  }

  const nextOffset = offset + limit
  return res.json({
    success: true,
    processed: slice.length, checked, matched: linked.length, linked,
    total: all.length, nextOffset, done: nextOffset >= all.length,
  })
}

export default withStaff(handler)
