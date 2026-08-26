// End-of-day cash-up — the Z-report.
// GET  ?date=YYYY-MM-DD → the day's money-in broken down by method, charges
//                         out, and any till count already saved for the day
// POST { date, counted, notes } → save the count; EXPECTED is computed
//                         server-side from the ledger (cash payments only)

import { withStaff, tabAllowedFor } from '../../lib/auth.js'
import { db, tablesMode, STORAGE_ERROR } from '../../lib/db.js'
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
//
// NOT set and UNREADABLE are different answers, and this used to give the same
// one to both. A failed read returned 0, which is a number the rest of this
// file believes: expectedCash comes out short by the float, the variance comes
// out wrong by the float, and the POST path WRITES that expected and that
// variance into till_counts. A silently wrong variance is the worst possible
// output of a cash-up — the whole screen exists to produce that one figure,
// and the owner is meant to act on it.
//
// So a read that fails now throws, and the handler's own catch turns it into
// the 500 it always should have been. No row is still a legitimate 0: the
// owner has simply never set a float. A row holding something that is not a
// non-negative number is a fault, not a zero, and says so rather than quietly
// costing the day's count that much cash.
async function openingFloat() {
  const rows = await db.select('settings', 'select=num_value&key=eq.till_opening_float')
  if (!rows.length) return 0
  const v = Number(rows[0].num_value)
  if (!Number.isFinite(v) || v < 0) {
    throw new Error(`till_opening_float is "${rows[0].num_value}" — set it to a number of pounds, 0 or more, in Settings`)
  }
  return v
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
      // Negative ledger amounts are TWO different things summed as one:
      // charges billed (no cash moved) and refund payouts (cash physically
      // handed back). The wallet screen labels the sum 'Charged & paid out
      // today' for exactly that reason (clarity-scan Tier 1 #6); only
      // expectedCash below cares which was which, via the method on cash rows.
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
    return res.status(500).json({ success: false, error: STORAGE_ERROR })
  }
}

export default withStaff(handler)
