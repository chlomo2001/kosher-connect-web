// End-of-day cash-up — the Z-report.
// GET  ?date=YYYY-MM-DD → the day's money-in broken down by method, charges
//                         out, and any till count already saved for the day
// POST { date, counted, notes } → save the count; EXPECTED is computed
//                         server-side from the ledger (cash payments only)

import { withStaff, tabAllowedFor } from '../../lib/auth.js'
import { db, tablesMode } from '../../lib/db.js'
import { cashExpected } from '../../lib/money.mjs'
import { londonDate, londonDayBoundsUtc } from '../../lib/localDay.mjs'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

async function dayLedger(date) {
  // The Z-report day is a Europe/London calendar day, not a UTC one: a till
  // movement at 00:30 local time is 23:30 UTC the previous day in summer, so a
  // bare-date UTC window would file it on yesterday's report. Anchor the bounds
  // to London instants.
  const { start, end } = londonDayBoundsUtc(date)
  return db.select(
    'ledger',
    `select=amount,method&created_at=gte.${encodeURIComponent(start)}&created_at=lt.${encodeURIComponent(end)}`
  )
}

// Cash the till started the day with (owner-set in Settings, defaults to 0).
async function openingFloat() {
  try {
    const rows = await db.select('settings', 'select=num_value&key=eq.till_opening_float')
    const v = rows.length ? Number(rows[0].num_value) : 0
    return Number.isFinite(v) && v >= 0 ? v : 0
  } catch {
    return 0
  }
}

function summarize(rows, float = 0) {
  const methods = {}
  let totalIn = 0
  let totalOut = 0
  for (const r of rows) {
    const amt = Number(r.amount)
    if (amt > 0) {
      totalIn += amt
      const m = r.method || 'unspecified'
      methods[m] = (methods[m] || 0) + amt
    } else {
      totalOut += amt
    }
  }
  // Expected cash NETS by sign (a cash refund/payout lowers it) and adds the
  // opening float — the old "positive cash only, no float" total could never
  // reconcile against a physical count.
  return { methods, totalIn, totalOut, openingFloat: float, expectedCash: cashExpected(rows, float) }
}

async function handler(req, res) {
  if (!tablesMode) {
    return res.status(503).json({ success: false, error: 'Cash-up needs the relational data layer.' })
  }
  if (!(await tabAllowedFor(req.staff, 'wallet'))) {
    return res.status(403).json({ success: false, error: 'The wallet is not enabled for your account.' })
  }

  try {
    if (req.method === 'GET') {
      const date = DATE_RE.test(String(req.query.date || '')) ? req.query.date : londonDate()
      const [rows, counts, float] = await Promise.all([
        dayLedger(date),
        db.select('till_counts', `count_date=eq.${date}`),
        openingFloat(),
      ])
      const s = summarize(rows, float)
      return res.json({
        success: true,
        date,
        ...s,
        count: counts.length ? {
          expected: Number(counts[0].expected),
          counted: Number(counts[0].counted),
          variance: Number(counts[0].variance),
          notes: counts[0].notes || '',
        } : null,
      })
    }

    if (req.method === 'POST') {
      const { date, counted, notes } = req.body || {}
      if (!DATE_RE.test(String(date || ''))) return res.status(400).json({ success: false, error: 'A valid date is required.' })
      const n = Number(counted)
      if (!Number.isFinite(n) || n < 0) return res.status(400).json({ success: false, error: 'Counted amount must be a number ≥ 0.' })

      const [rows, float] = await Promise.all([dayLedger(date), openingFloat()])
      const s = summarize(rows, float)
      await db.upsert('till_counts', [{
        count_date: date,
        expected: s.expectedCash,
        counted: n,
        notes: notes || null,
        created_by: req.staff?.id || null,
      }], 'count_date')
      return res.json({
        success: true,
        expected: s.expectedCash,
        counted: n,
        variance: +(n - s.expectedCash).toFixed(2),
      })
    }

    return res.status(405).end()
  } catch (e) {
    console.error('[api/cashup]', e)
    return res.status(500).json({ success: false, error: 'Storage error' })
  }
}

export default withStaff(handler)
