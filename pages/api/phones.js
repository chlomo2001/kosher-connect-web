import { withTab } from '../../lib/auth.js'
import { tablesMode } from '../../lib/db'
import { listPhones, syncPhones } from '../../lib/tableStore'
import { parseSyncBody } from '../../lib/syncBody'

// #80 — relational layer only; the file-store fallback is gone.
async function handler(req, res) {
  if (!tablesMode) {
    return res.status(503).json({ success: false, error: 'Server misconfigured: the relational data layer is required.' })
  }
  try {
    if (req.method === 'GET') {
      return res.json(await listPhones())
    }
    if (req.method === 'POST') {
      const { items, deletedIds } = parseSyncBody(req.body)
      const result = await syncPhones(items, deletedIds)
      return res.json({ success: true, ...result })
    }
    res.status(405).end()
  } catch (e) {
    console.error('[api/phones]', e)
    return res.status(500).json({ success: false, error: 'Storage error' })
  }
}

export default withTab('rentals', handler)
