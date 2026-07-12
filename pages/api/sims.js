import { loadData, saveData } from '../../lib/data'
import { tablesMode } from '../../lib/db'
import { listSims, syncSims } from '../../lib/tableStore'

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      return res.json(tablesMode ? await listSims() : await loadData('sims'))
    }
    if (req.method === 'POST') {
      if (tablesMode) {
        const result = await syncSims(req.body || [])
        return res.json({ success: true, ...result })
      }
      await saveData('sims', req.body)
      return res.json({ success: true })
    }
    res.status(405).end()
  } catch (e) {
    console.error('[api/sims]', e)
    return res.status(500).json({ success: false, error: 'Storage error' })
  }
}
