// Duplicate-customer scan — owner-only, READ-ONLY. Fuzzy-matches customers by
// name (transliteration-aware) and returns likely-duplicate pairs for a human
// to review. Focus is the ELID-imported customers (each compared against the
// whole book), since those are the freshest risk; ?all=1 widens to every
// customer against every other. Nothing is merged or written — this only
// surfaces a list.
import { withStaff } from '../../../lib/auth.js'
import { listCustomers } from '../../../lib/tableStore.js'
import { namesSimilar } from '../../../lib/nameMatch.mjs'

const elidLines = (c) => {
  const seen = new Set(), out = []
  for (const u of [c.elidUsername, ...(Array.isArray(c.elidUsernames) ? c.elidUsernames : [])]) {
    const v = String(u || '').trim(); if (!v) continue
    const k = v.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(v) }
  }
  return out
}
const isImported = (c) => /^Imported from ELID/i.test(String(c.notes || ''))
const brief = (c) => ({
  id: String(c.id),
  name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || '(no name)',
  elid: elidLines(c),
  imported: isImported(c),
  phone: c.phone || '',
})

async function handler(req, res) {
  if (req.staff?.role !== 'owner') return res.status(403).json({ success: false, error: 'Owner only.' })
  const all = await listCustomers()
  const wantAll = req.query.all === '1'
  const seeds = wantAll ? all : all.filter(isImported)

  const seen = new Set()
  const pairs = []
  for (const a of seeds) {
    for (const b of all) {
      if (String(b.id) === String(a.id)) continue
      const key = [String(a.id), String(b.id)].sort().join('|')
      if (seen.has(key)) continue
      const s = namesSimilar(`${a.firstName} ${a.lastName}`, `${b.firstName} ${b.lastName}`)
      if (s.match) { seen.add(key); pairs.push({ a: brief(a), b: brief(b), score: s.score }) }
    }
  }
  pairs.sort((x, y) => y.score - x.score)
  return res.json({ success: true, mode: wantAll ? 'all' : 'elid-imported', seeds: seeds.length, count: pairs.length, pairs: pairs.slice(0, 100) })
}

export default withStaff(handler)
