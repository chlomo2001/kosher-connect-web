import { withStaff, requireOwner } from '../../lib/auth.js'
import { tablesMode } from '../../lib/db'
import { listCustomers } from '../../lib/tableStore'

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  // Bulk PII export is an admin action — previously any signed-in helper
  // could download the entire customer base.
  if (requireOwner(req, res)) return
  // #80 — relational layer only.
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Server misconfigured: the relational data layer is required.' })

  const customers = await listCustomers()
  const rows = [
    ['First Name', 'Last Name', 'Phone', 'Email', 'Address', 'Total Paid', 'Created At'],
    ...customers.map(c => [
      c.firstName || '',
      c.lastName || '',
      c.phone || '',
      c.email || '',
      c.address || '',
      c.totalPaid || 0,
      c.createdAt || '',
    ]),
  ]
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename="customers.csv"')
  res.send(csv)
}

export default withStaff(handler)
