// Duplicate-customer scan — owner-only, READ-ONLY. Fuzzy-matches customers by
// name (transliteration-aware) and returns likely-duplicate pairs for a human
// to review. Defaults to EVERY customer against every other: the sheet import
// made a row per line, so the same man is in the book two and three times with
// SIMs on each — the ELID imports were only the freshest slice of the problem
// (?elid=1 narrows back to those). Nothing is merged or written here.
//
// Each side carries what the decision actually turns on — how many SIMs,
// rentals, bookings, repairs, virtual numbers and money lines it holds — so
// the reviewer can tell a duplicate from a relative with the same name
// without opening both records.
import { withStaff } from '../../../lib/auth.js'
import { listCustomers } from '../../../lib/tableStore.js'
import { namesSimilar } from '../../../lib/nameMatch.mjs'
import { db } from '../../../lib/db.js'

const elidLines = (c) => {
  const seen = new Set(), out = []
  for (const u of [c.elidUsername, ...(Array.isArray(c.elidUsernames) ? c.elidUsernames : [])]) {
    const v = String(u || '').trim(); if (!v) continue
    const k = v.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(v) }
  }
  return out
}
const isImported = (c) => /^Imported from ELID/i.test(String(c.notes || ''))
const brief = (c, counts) => ({
  id: String(c.id),
  name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || '(no name)',
  elid: elidLines(c),
  imported: isImported(c),
  phone: c.phone || '',
  email: c.email || '',
  counts: counts.get(String(c.id)) || {},
})

// One grouped count per table, rather than a query per customer per pair.
async function activityCounts() {
  const counts = new Map()
  const bump = (id, key, n) => {
    const k = String(id)
    if (!counts.has(k)) counts.set(k, {})
    counts.get(k)[key] = (counts.get(k)[key] || 0) + n
  }
  const tables = [['sims', 'sims'], ['rentals', 'rentals'], ['bookings', 'bookings'],
    ['repairs', 'repairs'], ['virtual_numbers', 'vns'], ['ledger', 'money']]
  for (const [table, key] of tables) {
    // customer_id only: cheap, and nothing here needs the rows themselves.
    const rows = await db.select(table, 'select=customer_id&limit=100000').catch(() => [])
    for (const r of rows) if (r.customer_id) bump(r.customer_id, key, 1)
  }
  return counts
}

async function handler(req, res) {
  if (req.staff?.role !== 'owner') return res.status(403).json({ success: false, error: 'Owner only.' })
  const all = await listCustomers()
  const elidOnly = req.query.elid === '1'
  const seeds = elidOnly ? all.filter(isImported) : all
  const counts = await activityCounts()

  // Pairs a human has already judged "not the same person" never come back.
  // Keyed on uuids in the table, on legacy ids in the app — map once.
  const idRows = await db.select('customers', 'select=id,legacy_id&limit=100000').catch(() => [])
  const uuidByLegacy = new Map(idRows.map((r) => [String(r.legacy_id), String(r.id)]))
  const dismissedRows = await db.select('customer_dupe_dismissals',
    'select=customer_a,customer_b&limit=100000').catch(() => [])
  const dismissed = new Set(dismissedRows.map((r) => `${r.customer_a}|${r.customer_b}`))
  const isDismissed = (x, y) => {
    const ux = uuidByLegacy.get(String(x)) || String(x)
    const uy = uuidByLegacy.get(String(y)) || String(y)
    const [lo, hi] = ux < uy ? [ux, uy] : [uy, ux]
    return dismissed.has(`${lo}|${hi}`)
  }

  const seen = new Set()
  const pairs = []
  for (const a of seeds) {
    for (const b of all) {
      if (String(b.id) === String(a.id)) continue
      const key = [String(a.id), String(b.id)].sort().join('|')
      if (seen.has(key)) continue
      const s = namesSimilar(`${a.firstName} ${a.lastName}`, `${b.firstName} ${b.lastName}`)
      if (s.match) {
        seen.add(key)
        if (isDismissed(a.id, b.id)) continue
        pairs.push({ key, a: brief(a, counts), b: brief(b, counts), score: s.score })
      }
    }
  }
  pairs.sort((x, y) => y.score - x.score)
  return res.json({
    success: true,
    mode: elidOnly ? 'elid-imported' : 'all',
    seeds: seeds.length,
    count: pairs.length,
    dismissed: dismissed.size,
    pairs: pairs.slice(0, 200),
  })
}

export default withStaff(handler)
