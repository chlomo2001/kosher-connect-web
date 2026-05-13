import { loadData, saveData } from '../../lib/data'

export default function handler(req, res) {
  if (req.method === 'GET') return res.json(loadData('phones'))
  if (req.method === 'POST') {
    saveData('phones', req.body)
    return res.json({ success: true })
  }
  res.status(405).end()
}
