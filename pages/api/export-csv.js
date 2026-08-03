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
  // CSV formula-injection guard: a cell starting with = + - @ (or a control char)
  // is executed by Excel/Sheets even inside quotes, and these cells carry customer-
  // controlled data. Prefix a quote on those — but phone-shaped values are exempt
  // (sweep 2026-08-02 #25): the old number-only exemption missed '+44 7911 …', so
  // the entire phone column shipped with a leading apostrophe. A + or - followed
  // by nothing but digits and phone punctuation cannot call anything.
  const csvCell = (v) => {
    const s = String(v == null ? '' : v)
    const phoneLike = /^[+-][\d\s().\-]+$/.test(s)
    const safe = /^[=+\-@\t\r]/.test(s) && !phoneLike && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s
    return `"${safe.replace(/"/g, '""')}"`
  }
  const csv = rows.map(r => r.map(csvCell).join(',')).join('\n')

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename="customers.csv"')
  res.send(csv)
}

export default withStaff(handler)
