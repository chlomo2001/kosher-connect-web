import { withTab } from '../../lib/auth.js'
import { tablesMode } from '../../lib/db'
import { listCustomers, getCustomer, upsertCustomer, deleteCustomer } from '../../lib/tableStore'
import { uid } from '../../lib/uid.mjs'

// #80 — the relational tables are the ONLY data layer now. The old
// loadData/saveData file-store fallback was a broken, never-exercised path
// (bookings/repairs/etc. never had it), so it's gone. A missing service key
// fails fast per request instead of silently degrading to a half-working app.
async function handler(req, res) {
  if (!tablesMode) {
    return res.status(503).json({
      success: false,
      error: 'Server misconfigured: the relational data layer (SUPABASE_SERVICE_ROLE_KEY) is required.',
    })
  }
  try {
    if (req.method === 'GET') {
      return res.json(await listCustomers())
    }

    if (req.method === 'POST') {
      const customer = { ...req.body }
      // Not Date.now() alone: legacy_id is unique, so two customers created in
      // the same millisecond (two tills, or an import) meant one save silently
      // lost the race. The client has minted collision-safe ids since #45 —
      // this path never did.
      customer.id = uid()
      customer.createdAt = new Date().toISOString()
      customer.totalPaid = 0
      customer.services = []
      await upsertCustomer(customer)
      return res.json({ success: true, customer })
    }

    if (req.method === 'PUT') {
      const updated = req.body
      // Single-row read: editing one customer must not pay a whole-table scan.
      const existing = await getCustomer(updated.id)
      if (!existing) return res.status(404).json({ success: false, error: 'Not found' })
      const merged = { ...existing, ...updated }
      await upsertCustomer(merged)
      return res.json({ success: true, customer: merged })
    }

    if (req.method === 'DELETE') {
      await deleteCustomer(req.query.id)
      return res.json({ success: true })
    }

    return res.status(405).end()
  } catch (e) {
    if (e.code === 'MONEY_HISTORY' || e.code === 'HAS_RECORDS') {
      return res.status(409).json({ success: false, error: e.message })
    }
    console.error('[api/customers]', e)
    return res.status(500).json({ success: false, error: 'Storage error' })
  }
}

export default withTab('customers', handler)
