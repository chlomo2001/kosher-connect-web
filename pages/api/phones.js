import { loadData, saveData } from '../../lib/data'

export default async function handler(req, res) {
  if (req.method === 'GET') return res.json(await loadData('phones'))
  if (req.method === 'POST') {
    await saveData('phones', req.body)
    return res.json({ success: true })
  }
  res.status(405).end()
}
