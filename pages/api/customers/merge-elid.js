// Merge an EMPTY ELID-import duplicate into the customer you keep — owner-only.
// POST { fromId, toId }: moves `from`'s ELID line(s) onto `to`, backfills any
// name part `to` is missing, then deletes `from`.
//
// Two hard guards make this safe:
//   • `from` MUST be an ELID import (notes start "Imported from ELID"), so a
//     real customer can never be the one deleted; and
//   • deleteCustomer() itself refuses to delete anyone with ledger money
//     history — so even an import that has since taken money is protected.
// Nothing about the ELID switch is touched — only the KC customer record.
import { withStaff } from '../../../lib/auth.js'
import { listCustomers, upsertCustomer, deleteCustomer } from '../../../lib/tableStore.js'

const elidLines = (c) => {
  const seen = new Set(), out = []
  for (const u of [c.elidUsername, ...(Array.isArray(c.elidUsernames) ? c.elidUsernames : [])]) {
    const v = String(u || '').trim(); if (!v) continue
    const k = v.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(v) }
  }
  return out
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (req.staff?.role !== 'owner') return res.status(403).json({ success: false, error: 'Owner only.' })

  const fromId = String(req.body?.fromId || '')
  const toId = String(req.body?.toId || '')
  if (!fromId || !toId) return res.status(400).json({ success: false, error: 'Need both records.' })
  if (fromId === toId) return res.status(400).json({ success: false, error: 'Those are the same record.' })

  const all = await listCustomers()
  const from = all.find((c) => String(c.id) === fromId)
  const to = all.find((c) => String(c.id) === toId)
  if (!from || !to) return res.status(404).json({ success: false, error: 'Customer not found.' })

  if (!/^Imported from ELID/i.test(String(from.notes || ''))) {
    return res.status(400).json({ success: false, error: 'The record being removed must be an ELID import — merge real records by hand.' })
  }
  if (Array.isArray(from.services) && from.services.length) {
    return res.status(400).json({ success: false, error: 'That import already has services on it — please merge by hand.' })
  }

  // Move the ELID line(s) onto the record we keep.
  const lines = elidLines(to)
  for (const u of elidLines(from)) { if (!lines.some((x) => x.toLowerCase() === u.toLowerCase())) lines.push(u) }
  to.elidUsernames = lines
  if (!to.elidUsername) to.elidUsername = lines[0] || ''
  // Backfill a missing name part on the kept record (e.g. surname-only "Shvarts"
  // gains the first name "Naftaly" from the import). Never overwrite existing.
  if (!String(to.firstName || '').trim() && String(from.firstName || '').trim()) to.firstName = from.firstName
  if (!String(to.lastName || '').trim() && String(from.lastName || '').trim()) to.lastName = from.lastName

  await upsertCustomer(to)
  try {
    await deleteCustomer(from.id)
  } catch (e) {
    if (e?.code === 'MONEY_HISTORY') {
      return res.status(400).json({ success: false, error: 'That import has money history — it wasn’t deleted. The ELID line was still added to the customer you kept.' })
    }
    throw e
  }

  return res.json({
    success: true,
    deletedId: from.id,
    kept: { id: String(to.id), name: `${to.firstName || ''} ${to.lastName || ''}`.trim(), elid: elidLines(to) },
  })
}

export default withStaff(handler)
