import { loadData } from '../../lib/data'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const customers = await loadData('customers')
  const rows = [
    ['First Name', 'Last Name', 'Phone', 'Email', 'Address', 'WhatsApp', 'Total Paid', 'Created At'],
    ...customers.map(c => [
      c.firstName || '',
      c.lastName || '',
      c.phone || '',
      c.email || '',
      c.address || '',
      c.hasWhatsapp ? 'Yes' : 'No',
      c.totalPaid || 0,
      c.createdAt || '',
    ]),
  ]
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename="customers.csv"')
  res.send(csv)
}
