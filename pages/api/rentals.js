import { loadData, saveData } from '../../lib/data'

export default async function handler(req, res) {
  if (req.method === 'GET') return res.json(await loadData('rentals'))
  if (req.method === 'POST') {
    await saveData('rentals', req.body)
    return res.json({ success: true })
  }
  res.status(405).end()
}
