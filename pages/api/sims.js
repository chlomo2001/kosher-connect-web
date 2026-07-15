import { loadData, saveData } from '../../lib/data'
import { withTab } from '../../lib/auth.js'
import { db, tablesMode } from '../../lib/db'
import { listSims, syncSims } from '../../lib/tableStore'

const money = (v) => Math.round((Number(v) || 0) * 100) / 100

// Post ONE SIM charge to the wallet ledger. SIM money used to live only in the
// client-side history blob (invisible to balances/arrears/cash-up); this puts
// it on the append-only ledger like every other charge. Idempotent via a
// deterministic reference SIM-<simLegacyId>-<historyId>, so retries and the
// later history backfill can never double-charge. SIM charges are debits
// (settled later by a wallet payment) — no payment posted here.
async function chargeSim(req, res, b) {
  const amt = money(b.amount)
  if (!(amt > 0)) return res.status(400).json({ success: false, error: 'Amount must be greater than £0.' })
  if (!b.simId || !b.customerId || !b.historyId) {
    return res.status(400).json({ success: false, error: 'simId, customerId and historyId are required.' })
  }
  const [simRows, custRows] = await Promise.all([
    db.select('sims', `select=id&legacy_id=eq.${encodeURIComponent(String(b.simId))}`),
    db.select('customers', `select=id&legacy_id=eq.${encodeURIComponent(String(b.customerId))}`),
  ])
  if (!custRows.length) return res.status(400).json({ success: false, error: `Customer ${b.customerId} not found.` })
  const customerUuid = custRows[0].id
  await db.insertIgnoreDup('ledger', [{
    customer_id: customerUuid,
    charge_reference: `SIM-${b.simId}-${b.historyId}`,
    entry_type: 'sim_charge',
    amount: -amt,
    description: String(b.description || 'SIM charge').slice(0, 200),
    related_sim_id: simRows[0]?.id || null, // best-effort FK; the reference carries the link
  }], 'charge_reference')
  const balRows = await db.select('customer_balances', `customer_id=eq.${customerUuid}`)
  return res.json({ success: true, balance: balRows.length ? Number(balRows[0].balance) : 0 })
}

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      return res.json(tablesMode ? await listSims() : await loadData('sims'))
    }
    if (req.method === 'POST') {
      const b = req.body
      // A single SIM charge (object with op:'charge') vs the whole-array sync.
      if (b && !Array.isArray(b) && b.op === 'charge') {
        if (!tablesMode) return res.status(503).json({ success: false, error: 'SIM charges need the relational data layer.' })
        return chargeSim(req, res, b)
      }
      if (tablesMode) {
        const result = await syncSims(b || [])
        return res.json({ success: true, ...result })
      }
      await saveData('sims', b)
      return res.json({ success: true })
    }
    res.status(405).end()
  } catch (e) {
    console.error('[api/sims]', e)
    return res.status(500).json({ success: false, error: 'Storage error' })
  }
}

export default withTab('sim', handler)
