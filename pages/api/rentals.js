import { withTab } from '../../lib/auth.js'
import { tablesMode, STORAGE_ERROR } from '../../lib/db'
import { listRentals, syncRentals } from '../../lib/tableStore'
import { parseSyncBody } from '../../lib/syncBody'

// #80 — relational layer only; the file-store fallback is gone.
async function handler(req, res) {
  if (!tablesMode) {
    return res.status(503).json({ success: false, error: 'Server misconfigured: the relational data layer is required.' })
  }
  try {
    if (req.method === 'GET') {
      return res.json(await listRentals())
    }
    if (req.method === 'POST') {
      const { items, deletedIds } = parseSyncBody(req.body)
      const result = await syncRentals(items, deletedIds)
      return res.json({ success: true, ...result })
    }
    res.status(405).end()
  } catch (e) {
    console.error('[api/rentals]', e)
    return res.status(500).json({ success: false, error: STORAGE_ERROR })
  }
}

export default withTab('rentals', handler)
