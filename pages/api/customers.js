import { loadData, saveData } from '../../lib/data'
import { withStaff } from '../../lib/auth.js'
import { tablesMode } from '../../lib/db'
import { listCustomers, upsertCustomer, deleteCustomer } from '../../lib/tableStore'

async function handler(req, res) {
  if (tablesMode) return tablesHandler(req, res)
  return legacyHandler(req, res)
}

// ---------- relational tables (transitional data layer) ----------

async function tablesHandler(req, res) {
  try {
    if (req.method === 'GET') {
      return res.json(await listCustomers())
    }

    if (req.method === 'POST') {
      const customer = { ...req.body }
      customer.id = Date.now().toString()
      customer.createdAt = new Date().toISOString()
      customer.totalPaid = 0
      customer.services = []
      await upsertCustomer(customer)
      return res.json({ success: true, customer })
    }

    if (req.method === 'PUT') {
      const updated = req.body
      const customers = await listCustomers()
      const existing = customers.find((c) => c.id === updated.id)
      if (!existing) return res.status(404).json({ success: false, error: 'Not found' })
      const merged = { ...existing, ...updated }
      await upsertCustomer(merged)
      return res.json({ success: true, customer: merged })
    }

    if (req.method === 'DELETE') {
      await deleteCustomer(req.query.id)
      return res.json({ success: true })
    }

    return res.status(405).end()
  } catch (e) {
    if (e.code === 'MONEY_HISTORY') {
      return res.status(409).json({ success: false, error: e.message })
    }
    console.error('[api/customers]', e)
    return res.status(500).json({ success: false, error: 'Storage error' })
  }
}

// ---------- previous behaviour (key-value store / local files) ----------

async function legacyHandler(req, res) {
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

export default withStaff(handler)
