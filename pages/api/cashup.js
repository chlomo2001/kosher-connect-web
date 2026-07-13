// End-of-day cash-up — the Z-report.
// GET  ?date=YYYY-MM-DD → the day's money-in broken down by method, charges
//                         out, and any till count already saved for the day
// POST { date, counted, notes } → save the count; EXPECTED is computed
//                         server-side from the ledger (cash payments only)

import { withStaff, tabAllowedFor } from '../../lib/auth.js'
import { db, tablesMode } from '../../lib/db.js'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function nextDay(date) {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

async function dayLedger(date) {
  return db.select(
    'ledger',
    `select=amount,method&created_at=gte.${date}&created_at=lt.${nextDay(date)}`
  )
}

function summarize(rows) {
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
  return { methods, totalIn, totalOut, expectedCash: methods.cash || 0 }
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
      const date = DATE_RE.test(String(req.query.date || '')) ? req.query.date : new Date().toISOString().slice(0, 10)
      const [rows, counts] = await Promise.all([
        dayLedger(date),
        db.select('till_counts', `count_date=eq.${date}`),
      ])
      const s = summarize(rows)
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

      const s = summarize(await dayLedger(date))
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
