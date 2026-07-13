// Virtual numbers — standalone VN management (rental add-on VNs stay on the
// rental; these are the independently-provisioned numbers).

import { withStaff } from '../../lib/auth.js'
import { db, tablesMode } from '../../lib/db.js'

const EMBED = 'customers(legacy_id,first_name,last_name)'
const PLATFORMS = ['elid', 'FreePBX', 'Other']
const STATUSES = ['Active', 'Inactive']

const PLANS = ['incoming_only', 'outgoing_100', 'unlimited', 'payg']

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
    bundleLabel: row.bundle_label || '',
    plan: row.plan || '',
    monthlyPrice: row.monthly_price === null || row.monthly_price === undefined ? null : Number(row.monthly_price),
    billingEnabled: !!row.billing_enabled,
    nextBillingDate: row.next_billing_date || '',
    createdAt: row.created_at,
  }
}

// Billing fields shared by POST and PUT. Enabling billing requires a
// customer, a positive monthly price, and a start date.
function billingPatch(b) {
  const patch = {}
  if (b.bundleLabel !== undefined) patch.bundle_label = b.bundleLabel || null
  if (b.plan !== undefined) patch.plan = PLANS.includes(b.plan) ? b.plan : null
  if (b.monthlyPrice !== undefined) {
    const n = Number(b.monthlyPrice)
    patch.monthly_price = Number.isFinite(n) && n > 0 ? n : null
  }
  if (b.billingEnabled !== undefined) patch.billing_enabled = !!b.billingEnabled
  if (b.nextBillingDate !== undefined) {
    patch.next_billing_date = /^\d{4}-\d{2}-\d{2}$/.test(String(b.nextBillingDate || ''))
      ? b.nextBillingDate : null
  }
  return patch
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
      const billing = billingPatch(b)
      if (billing.billing_enabled && (!customerUuid || !billing.monthly_price || !billing.next_billing_date)) {
        return res.status(400).json({ success: false, error: 'Monthly billing needs a customer, a monthly price and a first billing date.' })
      }
      const [row] = await db.insert('virtual_numbers', [{
        number: String(b.number).trim(),
        customer_id: customerUuid,
        platform: PLATFORMS.includes(b.platform) ? b.platform : 'Other',
        status: STATUSES.includes(b.status) ? b.status : 'Active',
        shortcut_url: b.shortcutUrl || null,
        notes: b.notes || null,
        ...billing,
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
      Object.assign(patch, billingPatch(req.body || {}))
      if (!Object.keys(patch).length) return res.status(400).json({ success: false, error: 'Nothing to update.' })
      const updated = await db.update('virtual_numbers', `id=eq.${encodeURIComponent(String(id))}`, patch)
      if (!updated.length) return res.status(404).json({ success: false, error: 'Virtual number not found.' })
      const row = updated[0]
      if (row.billing_enabled && (!row.customer_id || !Number(row.monthly_price) || !row.next_billing_date)) {
        await db.update('virtual_numbers', `id=eq.${row.id}`, { billing_enabled: false })
        return res.status(400).json({ success: false, error: 'Monthly billing needs a customer, a monthly price and a next billing date — billing left off.' })
      }
      const [full] = await db.select('virtual_numbers', `select=*,${EMBED}&id=eq.${row.id}`)
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
