// What the AI features have cost — owner-only, read-only.
//
// Metered by us, not read from Google: the generateContent endpoint reports no
// spend or quota, so lib/gemini.js records each call's token counts as they
// come back (see the ai_usage migration for why). This turns those rows into
// the two numbers the owner actually asks for — this month and last month —
// broken down by which feature spent it.
//
// Money here is an ESTIMATE and says so in the payload: list prices recorded on
// a date, converted at a fixed FX rate. For a figure in the low pounds a daily
// currency round-trip would cost more than the precision is worth.
import { withStaff } from '../../lib/auth.js'
import { db, tablesMode } from '../../lib/db.js'
import { summarise, PRICED_ON, USD_TO_GBP_DEFAULT } from '../../lib/aiCost.mjs'
import { geminiEnabled } from '../../lib/gemini.js'
import { londonDate } from '../../lib/localDay.mjs'

// One month of calls is a few hundred rows at most; this is a ceiling against a
// runaway, not a paging strategy.
const ROW_CAP = 5000

const monthStart = (back = 0) => {
  const [y, m] = londonDate().split('-').map(Number)
  const d = new Date(Date.UTC(y, (m - 1) - back, 1))
  return d.toISOString().slice(0, 10)
}

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  if (req.staff?.role !== 'owner') return res.status(403).json({ success: false, error: 'Owner only.' })
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Needs the relational data layer.' })

  const thisMonth = monthStart(0)
  const lastMonth = monthStart(1)

  let rows = []
  try {
    rows = await db.select('ai_usage',
      `select=at,feature,model,prompt_tokens,output_tokens,total_tokens&at=gte.${lastMonth}&order=at.desc&limit=${ROW_CAP}`)
  } catch (e) {
    // The table is the newest thing here; say so plainly rather than as a
    // storage fault, the same way the bank route does.
    if (/relation "ai_usage" does not exist|42P01/.test(String(e.message))) {
      return res.status(503).json({ success: false, error: 'The ai_usage table is not set up yet — apply the 20260816090000_ai_usage migration.' })
    }
    console.error('[api/ai-usage]', e)
    return res.status(500).json({ success: false, error: 'Could not read AI usage.' })
  }

  const inMonth = (r, from, to) => {
    const day = String(r.at || '').slice(0, 10)
    return day >= from && (!to || day < to)
  }
  return res.json({
    success: true,
    enabled: geminiEnabled,
    pricedOn: PRICED_ON,
    fxRate: USD_TO_GBP_DEFAULT,
    // Deliberately named: nothing here came from a bill.
    estimated: true,
    thisMonth: summarise(rows.filter((r) => inMonth(r, thisMonth, null))),
    lastMonth: summarise(rows.filter((r) => inMonth(r, lastMonth, thisMonth))),
    since: lastMonth,
    capped: rows.length >= ROW_CAP,
  })
}

export default withStaff(handler)
