import { loadData, saveData } from '../../lib/data'
import { withTab } from '../../lib/auth.js'
import { tablesMode } from '../../lib/db'
import { listPhones, syncPhones } from '../../lib/tableStore'
import { parseSyncBody } from '../../lib/syncBody'

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      return res.json(tablesMode ? await listPhones() : await loadData('phones'))
    }
    if (req.method === 'POST') {
      const { items, deletedIds } = parseSyncBody(req.body)
      if (tablesMode) {
        const result = await syncPhones(items, deletedIds)
        return res.json({ success: true, ...result })
      }
      await saveData('phones', items)
      return res.json({ success: true })
    }
    res.status(405).end()
  } catch (e) {
    console.error('[api/phones]', e)
    return res.status(500).json({ success: false, error: 'Storage error' })
  }
}

export default withTab('rentals', handler)
