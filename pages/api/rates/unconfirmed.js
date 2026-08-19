// Figures nobody has checked — the to-do list behind the refusal.
//
// Port item C1c, 19 August 2026. Built from the written brief; the source repo
// (earothbart-ai/pixel-perfect-peek) cannot be reached from this session.
//
// The brief is emphatic about this half: their own clarity scan found a
// `confirm_rate` column with no caller anywhere in the app, so the panel headed
// "figures nobody has checked" was a list with nothing to press, and every
// figure stayed provisional for ever. A refusal without a way to satisfy it
// becomes permanent. This endpoint is the list; ./confirm.js is the way out.
import { withStaff } from '../../../lib/auth.js'
import { db, tablesMode } from '../../../lib/db.js'
import { RATE_TABLES } from '../../../lib/moneyWords.mjs'

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Needs the relational data layer.' })
  if (req.staff?.role !== 'owner') return res.status(403).json({ success: false, error: 'Owner only.' })

  const out = []
  for (const [table, meta] of Object.entries(RATE_TABLES)) {
    const cols = [meta.key, 'confirmed_at', 'confirmed_by', 'confirmed_source', ...meta.fields]
    // A name where the table has one, so a row reads as a thing rather than
    // as an id.
    if (table === 'rental_rates') cols.push('display_name', 'active')
    if (table === 'service_prices') cols.push('name', 'active')
    if (table === 'vn_bundle_prices') cols.push('label')
    const rows = await db.select(table, `select=${cols.join(',')}&limit=500`).catch(() => [])
    for (const r of rows) {
      // An inactive row is quoted nowhere, so chasing a tick for it is busywork
      // that makes the real list look longer than it is.
      if (r.active === false) continue
      out.push({
        table,
        tableLabel: meta.label,
        id: String(r[meta.key]),
        name: r.display_name || r.name || r.label || String(r[meta.key]),
        confirmed: !!r.confirmed_at,
        confirmedAt: r.confirmed_at || null,
        confirmedBy: r.confirmed_by || null,
        source: r.confirmed_source || null,
        figures: meta.fields
          .filter((f) => r[f] !== null && r[f] !== undefined)
          .map((f) => ({ field: f, value: Number(r[f]) })),
      })
    }
  }
  const unchecked = out.filter((r) => !r.confirmed)
  return res.json({
    success: true,
    total: out.length,
    unchecked: unchecked.length,
    rows: out.sort((a, b) => Number(a.confirmed) - Number(b.confirmed) ||
      a.tableLabel.localeCompare(b.tableLabel) || a.name.localeCompare(b.name)),
  })
}

export default withStaff(handler)
