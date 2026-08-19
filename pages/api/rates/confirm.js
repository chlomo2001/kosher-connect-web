// Confirm one rate — the exit from the refusal.
//
//   POST { table, id, source }
//
// Owner-only, and the source note is MANDATORY. That is the whole difference
// between evidence and a click: "checked against the Lebara price list, 19 Aug"
// is a fact somebody can go back to in six months; a bare tick is not.
//
// Confirming does not change the figure. It records that a named person looked
// at it and stands behind it — and a database trigger drops the confirmation
// the moment anybody edits the row, so a tick can never come to mean "somebody
// looked at an earlier number" (see 20260819030000_rate_confirmation.sql).
import { withStaff } from '../../../lib/auth.js'
import { db, tablesMode } from '../../../lib/db.js'
import { RATE_TABLES } from '../../../lib/moneyWords.mjs'

// Short enough not to be a nuisance, long enough that "ok" and "yes" do not
// pass for a source.
const MIN_SOURCE = 6

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Needs the relational data layer.' })
  if (req.staff?.role !== 'owner') {
    return res.status(403).json({ success: false, error: 'Only the owner can confirm a price.' })
  }

  const b = req.body || {}
  const meta = RATE_TABLES[b.table]
  // Whitelisted by name: the table is chosen from a fixed map, never taken as
  // a string and put into a query.
  if (!meta) return res.status(400).json({ success: false, error: 'Not a rate table.' })
  const id = String(b.id ?? '').trim()
  if (!id) return res.status(400).json({ success: false, error: 'Which row?' })

  const source = String(b.source || '').trim().slice(0, 300)
  if (source.length < MIN_SOURCE) {
    return res.status(400).json({
      success: false,
      error: 'Say where you checked it — "against the Lebara price list", "agreed with Moshe on the phone". ' +
        'A tick with no source is not evidence of anything.',
    })
  }

  const who = req.staff?.fullName || req.staff?.email || 'owner'
  try {
    const rows = await db.update(b.table, `${meta.key}=eq.${encodeURIComponent(id)}`, {
      confirmed_at: new Date().toISOString(),
      confirmed_by: who,
      confirmed_source: source,
    })
    if (!rows || (Array.isArray(rows) && !rows.length)) {
      return res.status(404).json({ success: false, error: 'That row is no longer there.' })
    }
    return res.json({ success: true, confirmedBy: who })
  } catch (e) {
    console.error('[api/rates/confirm]', e)
    return res.status(502).json({ success: false, error: 'Could not record that.' })
  }
}

export default withStaff(handler)
