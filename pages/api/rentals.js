import { loadData, saveData } from '../../lib/data'
import { withStaff } from '../../lib/auth.js'
import { tablesMode } from '../../lib/db'
import { listRentals, syncRentals } from '../../lib/tableStore'

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      return res.json(tablesMode ? await listRentals() : await loadData('rentals'))
    }
    if (req.method === 'POST') {
      if (tablesMode) {
        const result = await syncRentals(req.body || [])
        return res.json({ success: true, ...result })
      }
      await saveData('rentals', req.body)
      return res.json({ success: true })
    }
    res.status(405).end()
  } catch (e) {
    console.error('[api/rentals]', e)
    return res.status(500).json({ success: false, error: 'Storage error' })
  }
}

export default withStaff(handler)
