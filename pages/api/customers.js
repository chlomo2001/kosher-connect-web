import { loadData, saveData } from '../../lib/data'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.json(await loadData('customers'))
  }

  if (req.method === 'POST') {
    const customers = await loadData('customers')
    const customer = { ...req.body }
    customer.id = Date.now().toString()
    customer.createdAt = new Date().toISOString()
    customer.totalPaid = 0
    customer.services = []
    customers.push(customer)
    await saveData('customers', customers)
    return res.json({ success: true, customer })
  }

  if (req.method === 'PUT') {
    const customers = await loadData('customers')
    const updated = req.body
    const idx = customers.findIndex(c => c.id === updated.id)
    if (idx === -1) return res.status(404).json({ success: false, error: 'Not found' })
    customers[idx] = { ...customers[idx], ...updated }
    await saveData('customers', customers)
    return res.json({ success: true, customer: customers[idx] })
  }

  if (req.method === 'DELETE') {
    const { id } = req.query
    const customers = await loadData('customers')
    await saveData('customers', customers.filter(c => c.id !== id))
    return res.json({ success: true })
  }

  res.status(405).end()
}
