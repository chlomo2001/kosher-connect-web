import { loadData, saveData } from '../../lib/data'
import { tablesMode } from '../../lib/db'
import { listPhones, syncPhones } from '../../lib/tableStore'

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      return res.json(tablesMode ? await listPhones() : await loadData('phones'))
    }
    if (req.method === 'POST') {
      if (tablesMode) {
        const result = await syncPhones(req.body || [])
        return res.json({ success: true, ...result })
      }
      await saveData('phones', req.body)
      return res.json({ success: true })
    }
    res.status(405).end()
  } catch (e) {
    console.error('[api/phones]', e)
    return res.status(500).json({ success: false, error: 'Storage error' })
  }
}
