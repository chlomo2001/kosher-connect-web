// Duplicate-customer scan — owner-only, READ-ONLY. Matches customers on three
// signals — name (fuzzy, transliteration-aware), the person behind an email
// address, and the phone line — and returns likely-duplicate pairs for a human
// to review.
//
// It was name-only until 19 Aug, which is why the owner could say "all Abish
// friends same person - different lines" and the scan had nothing to show: two
// records for one man, each carrying a different number, share no name spelling
// worth matching but do share a mailbox. lib/identity.mjs states which key
// means "the same" (person key ignores the +tag that names a SIM, so one
// customer with nine SIM tags is one person, not nine) and grades how much a
// signal is worth. Defaults to EVERY customer against every other: the sheet import
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
import { findDuplicates, sharedContacts, duplicateConfidence } from '../../../lib/identity.mjs'
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

  const byId = new Map(all.map((c) => [String(c.id), c]))
  const inSeeds = new Set(seeds.map((c) => String(c.id)))

  // Every signal for a pair, gathered in one place so confidence is decided
  // once rather than guessed twice — the screen used to re-derive its own
  // reasons in the browser from name and phone alone, and could not see email.
  const signals = new Map()   // "a|b" (sorted) → { kinds:Set, score }
  const note = (x, y, kind, score) => {
    const [lo, hi] = [String(x), String(y)].sort()
    // One side must be a seed, or ?elid=1 stops narrowing anything.
    if (!inSeeds.has(lo) && !inSeeds.has(hi)) return
    const cur = signals.get(`${lo}|${hi}`) || { kinds: new Set(), score: 0 }
    cur.kinds.add(kind)
    if (score != null) cur.score = Math.max(cur.score, score)
    signals.set(`${lo}|${hi}`, cur)
  }

  // 1. The fuzzy name match KC already had. It catches what a key cannot —
  //    Mordche against Mordechai — so it stays exactly as it was.
  for (const a of seeds) {
    for (const b of all) {
      if (String(b.id) === String(a.id)) continue
      const s = namesSimilar(`${a.firstName} ${a.lastName}`, `${b.firstName} ${b.lastName}`)
      if (s.match) note(a.id, b.id, 'name', s.score)
    }
  }

  // 2. The identity keys: same person behind an email, same line, same written
  //    name whatever order it was typed in.
  const KIND = {
    'same phone number': 'phone',
    'same email (person key — tag and Gmail dots ignored)': 'email',
    'same name (word order ignored)': 'name',
  }
  for (const d of findDuplicates(all)) {
    for (const r of d.reasons) note(d.aId, d.bId, KIND[r] || 'name', null)
  }

  // A contact detail dozens of people share is the shop's own number or a hall
  // phone — dropped as a signal, and said out loud rather than left to look
  // like the scan simply missed them.
  const shared = sharedContacts(all).map((s) => ({
    kind: s.kind, count: s.count,
    // Never the address or number itself: this is a report, not a directory.
    example: (byId.get(String(s.ids[0])) || {}).firstName || '',
  }))

  const REASON_TEXT = {
    phone: 'same phone number',
    email: 'same email — one person, whatever tag the address carried',
    name: 'name matches',
  }
  const pairs = []
  for (const [key, sig] of signals) {
    const [aId, bId] = key.split('|')
    const a = byId.get(aId), b = byId.get(bId)
    if (!a || !b) continue
    if (isDismissed(aId, bId)) continue
    // The rule lives in lib/identity.mjs — two copies of a judgement like this
    // drift, and the one on the screen would be the one nobody tested.
    const confidence = duplicateConfidence(sig.kinds)
    pairs.push({
      key, a: brief(a, counts), b: brief(b, counts), score: sig.score,
      confidence,
      reasons: [...sig.kinds].sort().map((k) => REASON_TEXT[k]),
    })
  }
  // Strongest first, and inside a band the closest name match first.
  const rank = { high: 0, medium: 1, low: 2 }
  pairs.sort((x, y) => rank[x.confidence] - rank[y.confidence] || y.score - x.score)
  const CAP = 200
  return res.json({
    success: true,
    mode: elidOnly ? 'elid-imported' : 'all',
    seeds: seeds.length,
    count: pairs.length,
    dismissed: dismissed.size,
    // Said plainly rather than left to be inferred from a short list.
    truncated: Math.max(0, pairs.length - CAP),
    shared,
    pairs: pairs.slice(0, CAP),
  })
}

export default withStaff(handler)
