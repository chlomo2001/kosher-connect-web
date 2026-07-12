// Virtual numbers — standalone VN management (rental add-on VNs stay on the
// rental; these are the independently-provisioned numbers).

import { withStaff } from '../../lib/auth.js'
import { db, tablesMode } from '../../lib/db.js'

const EMBED = 'customers(legacy_id,first_name,last_name)'
const PLATFORMS = ['elid', 'FreePBX', 'Other']
const STATUSES = ['Active', 'Inactive']

function toApp(row) {
  return {
    id: row.id,
    number: row.number || '',
    customerId: row.customers?.legacy_id ?? null,
    customerName: row.customers
      ? `${row.customers.first_name || ''} ${row.customers.last_name || ''}`.trim()
      : '',
    platform: row.platform || '',
    status: row.status || 'Active',
    shortcutUrl: row.shortcut_url || '',
    notes: row.notes || '',
    createdAt: row.created_at,
  }
}

async function handler(req, res) {
  if (!tablesMode) {
    return res.status(503).json({ success: false, error: 'Virtual numbers need the relational data layer.' })
  }

  try {
    if (req.method === 'GET') {
      const rows = await db.select('virtual_numbers', `select=*,${EMBED}&order=created_at.desc`)
      return res.json(rows.map(toApp))
    }

    if (req.method === 'POST') {
      const b = req.body || {}
      if (!b.number || !String(b.number).trim()) {
        return res.status(400).json({ success: false, error: 'Number is required.' })
      }
      let customerUuid = null
      if (b.customerId) {
        const rows = await db.select(
          'customers',
          `select=id&legacy_id=eq.${encodeURIComponent(String(b.customerId))}`
        )
        if (!rows.length) return res.status(400).json({ success: false, error: `Customer ${b.customerId} not found.` })
        customerUuid = rows[0].id
      }
      const [row] = await db.insert('virtual_numbers', [{
        number: String(b.number).trim(),
        customer_id: customerUuid,
        platform: PLATFORMS.includes(b.platform) ? b.platform : 'Other',
        status: STATUSES.includes(b.status) ? b.status : 'Active',
        shortcut_url: b.shortcutUrl || null,
        notes: b.notes || null,
      }])
      const [full] = await db.select('virtual_numbers', `select=*,${EMBED}&id=eq.${row.id}`)
      return res.json({ success: true, vn: toApp(full) })
    }

    if (req.method === 'PUT') {
      const { id, status, notes, shortcutUrl, platform } = req.body || {}
      if (!id) return res.status(400).json({ success: false, error: 'id is required.' })
      const patch = {}
      if (status !== undefined) {
        if (!STATUSES.includes(status)) return res.status(400).json({ success: false, error: 'Status must be Active or Inactive.' })
        patch.status = status
      }
      if (platform !== undefined) {
        if (!PLATFORMS.includes(platform)) return res.status(400).json({ success: false, error: `Platform must be one of: ${PLATFORMS.join(', ')}.` })
        patch.platform = platform
      }
      if (notes !== undefined) patch.notes = notes || null
      if (shortcutUrl !== undefined) patch.shortcut_url = shortcutUrl || null
      if (!Object.keys(patch).length) return res.status(400).json({ success: false, error: 'Nothing to update.' })
      const updated = await db.update('virtual_numbers', `id=eq.${encodeURIComponent(String(id))}`, patch)
      if (!updated.length) return res.status(404).json({ success: false, error: 'Virtual number not found.' })
      const [full] = await db.select('virtual_numbers', `select=*,${EMBED}&id=eq.${updated[0].id}`)
      return res.json({ success: true, vn: toApp(full) })
    }

    if (req.method === 'DELETE') {
      const { id } = req.query
      if (!id) return res.status(400).json({ success: false, error: 'id is required.' })
      await db.delete('virtual_numbers', `id=eq.${encodeURIComponent(String(id))}`)
      return res.json({ success: true })
    }

    return res.status(405).end()
  } catch (e) {
    console.error('[api/virtual-numbers]', e)
    return res.status(500).json({ success: false, error: 'Storage error' })
  }
}

export default withStaff(handler)
