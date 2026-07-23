// ELID import — owner-only. Creates KC customers for the selected ELID
// usernames, using the REAL name pulled live from ELID (not a guess), and links
// each new customer to its ELID account. Skips any username that already belongs
// to a customer (by elidUsername) so a re-run can't duplicate. Read of ELID is
// live; the only writes are new customers the owner explicitly ticked.
import { withStaff } from '../../../lib/auth.js'
import { tablesMode } from '../../../lib/db.js'
import { listCustomers, upsertCustomer } from '../../../lib/tableStore.js'
import { elidEnabled, elidUserDetails } from '../../../lib/elid.js'

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (req.staff?.role !== 'owner') return res.status(403).json({ success: false, error: 'Owner only.' })
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Needs the relational data layer.' })
  if (!elidEnabled) return res.status(503).json({ success: false, error: 'ELID isn’t configured.' })

  const usernames = Array.isArray(req.body?.usernames) ? req.body.usernames.slice(0, 25) : []
  if (!usernames.length) return res.status(400).json({ success: false, error: 'No accounts selected.' })

  const existing = await listCustomers()
  const linked = new Set(existing.map((c) => String(c.elidUsername || '').toLowerCase()).filter(Boolean))

  const created = []
  const skipped = []
  const base = Date.now()
  let i = 0
  for (const raw of usernames) {
    const username = String(raw || '').trim()
    if (!username) continue
    if (linked.has(username.toLowerCase())) { skipped.push({ username, reason: 'already linked' }); continue }

    let d
    try { d = await elidUserDetails(username) } catch { d = { ok: false } }
    if (!d.ok) { skipped.push({ username, reason: d.error || 'ELID lookup failed' }); continue }

    const firstName = (d.firstName || '').trim()
    const lastName = (d.lastName || '').trim()
    if (!firstName && !lastName) { skipped.push({ username, reason: 'no name on ELID' }); continue }

    const customer = {
      id: String(base + i), // unique + monotonic within the batch (avoids ms collision)
      firstName, lastName,
      elidUsername: username,
      notes: `Imported from ELID (${username})`,
      createdAt: new Date().toISOString(),
      totalPaid: 0,
      services: [],
    }
    try {
      await upsertCustomer(customer)
      created.push({ id: customer.id, name: `${firstName} ${lastName}`.trim(), username, balance: d.balance })
      linked.add(username.toLowerCase())
      i++
    } catch (e) {
      console.error('[api/elid/import] create failed', username, e?.message)
      skipped.push({ username, reason: 'could not create' })
    }
  }

  return res.json({ success: true, created, skipped })
}

export default withStaff(handler)
