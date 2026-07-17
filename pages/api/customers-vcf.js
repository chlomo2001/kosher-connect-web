import { withStaff, requireOwner } from '../../lib/auth.js'
import { tablesMode } from '../../lib/db'
import { listCustomers } from '../../lib/tableStore'
import { buildCard } from '../../lib/vcard.mjs'
import { normalizeUkNumber } from '../../lib/ukPhone.mjs'

// Export the customer base as a vCard 3.0 file with canonically-normalised
// phone numbers (+44…) — absorption of the owner's Excel→VCF workflow, fed
// straight from KC's own data instead of a spreadsheet. Same access rule as
// the CSV export: bulk PII is an OWNER action, not a helper one.
async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  if (requireOwner(req, res)) return
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Server misconfigured: the relational data layer is required.' })

  const customers = await listCustomers()
  const cards = customers
    .filter((c) => (c.firstName || c.lastName) && c.phone)
    .map((c) => buildCard({
      first: c.firstName || '',
      last: c.lastName || '',
      phones: [normalizeUkNumber(c.phone)].filter(Boolean),
      email: c.email || '',
      address: c.address || '',
    }))

  res.setHeader('Content-Type', 'text/vcard; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="kosherconnect-customers.vcf"')
  res.send(cards.join('\r\n') + '\r\n')
}

export default withStaff(handler)
