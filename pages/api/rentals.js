import { loadData, saveData } from '../../lib/data'
import { withTab } from '../../lib/auth.js'
import { tablesMode } from '../../lib/db'
import { listRentals, syncRentals } from '../../lib/tableStore'
import { parseSyncBody } from '../../lib/syncBody'

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      return res.json(tablesMode ? await listRentals() : await loadData('rentals'))
    }
    if (req.method === 'POST') {
      const { items, deletedIds } = parseSyncBody(req.body)
      if (tablesMode) {
        const result = await syncRentals(items, deletedIds)
        return res.json({ success: true, ...result })
      }
      await saveData('rentals', items)
      return res.json({ success: true })
    }
    res.status(405).end()
  } catch (e) {
    console.error('[api/rentals]', e)
    return res.status(500).json({ success: false, error: 'Storage error' })
  }
}

export default withTab('rentals', handler)
