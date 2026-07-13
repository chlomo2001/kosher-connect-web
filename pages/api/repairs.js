// Repairs — tables-native, wallet-charging.
//
// Lifecycle (from the .gs Repairs design):
//   - opening a ticket freezes the chosen service prices into repair_services
//     (menu price changes never reprice an open ticket)
//   - the wallet charge posts ONCE, when the repair is marked Collected:
//     entry_type 'repair', charge_reference 'REPAIR-<uuid>' (idempotent),
//     amount -(total)
//   - Cancelled tickets never charge

import { withStaff } from '../../lib/auth.js'
import { db, tablesMode } from '../../lib/db.js'

const REPAIR_STATUSES = ['Open', 'In Progress', 'Ready', 'Collected', 'Cancelled']
const EMBED = 'customers(legacy_id,first_name,last_name),repair_services(id,price,service_prices(name))'

function toApp(row) {
  return {
    id: row.id,
    customerId: row.customers?.legacy_id ?? null,
    customerName: row.customers
      ? `${row.customers.first_name || ''} ${row.customers.last_name || ''}`.trim()
      : '',
    device: row.device_description || '',
    services: (row.repair_services || []).map(s => ({
      name: s.service_prices?.name || '(custom)',
      price: Number(s.price),
    })),
    total: row.total === null ? 0 : Number(row.total),
    kcPurchase: !!row.kc_purchase,
    status: row.status || 'Open',
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    notes: row.notes || '',
  }
}

async function handler(req, res) {
  if (!tablesMode) {
    return res.status(503).json({ success: false, error: 'Repairs need the relational data layer.' })
  }

  try {
    if (req.method === 'GET') {
      const rows = await db.select('repairs', `select=*,${EMBED}&order=opened_at.desc`)
      return res.json(rows.map(toApp))
    }

    if (req.method === 'POST') {
      const b = req.body || {}
      if (!b.customerId) return res.status(400).json({ success: false, error: 'Customer is required.' })
      const serviceIds = Array.isArray(b.serviceIds) ? b.serviceIds.filter(Boolean) : []
      if (!serviceIds.length) return res.status(400).json({ success: false, error: 'Pick at least one service.' })

      const custRows = await db.select(
        'customers',
        `select=id&legacy_id=eq.${encodeURIComponent(String(b.customerId))}`
      )
      if (!custRows.length) return res.status(400).json({ success: false, error: `Customer ${b.customerId} not found.` })

      const menu = await db.select(
        'service_prices',
        `id=in.(${serviceIds.map(encodeURIComponent).join(',')})&active=is.true`
      )
      if (menu.length !== serviceIds.length) {
        return res.status(400).json({ success: false, error: 'One of the chosen services is unknown or retired.' })
      }
      // "Purchased at KC" tier: use kc_price where the menu has one; jobs
      // without a KC price (kc_price NULL) charge the regular price.
      const kcPurchase = !!b.kcPurchase
      const priceOf = (m) =>
        kcPurchase && m.kc_price !== null && m.kc_price !== undefined ? Number(m.kc_price) : Number(m.price)
      const total = menu.reduce((s, m) => s + priceOf(m), 0)

      const [repair] = await db.insert('repairs', [{
        customer_id: custRows[0].id,
        device_description: b.device || null,
        total,
        status: 'Open',
        opened_at: new Date().toISOString(),
        notes: b.notes || null,
        kc_purchase: kcPurchase,
      }])
      await db.insert('repair_services', menu.map(m => ({
        repair_id: repair.id,
        service_price_id: m.id,
        price: priceOf(m),  // frozen at open time
      })))

      const [full] = await db.select('repairs', `select=*,${EMBED}&id=eq.${repair.id}`)
      return res.json({ success: true, repair: toApp(full) })
    }

    if (req.method === 'PUT') {
      const { id, status, notes, payment } = req.body || {}
      if (!id) return res.status(400).json({ success: false, error: 'Repair id is required.' })
      const patch = {}
      if (status !== undefined) {
        if (!REPAIR_STATUSES.includes(status)) {
          return res.status(400).json({ success: false, error: `Status must be one of: ${REPAIR_STATUSES.join(', ')}.` })
        }
        patch.status = status
        if (status === 'Collected') patch.closed_at = new Date().toISOString()
      }
      if (notes !== undefined) patch.notes = notes || null
      if (!Object.keys(patch).length) return res.status(400).json({ success: false, error: 'Nothing to update.' })

      const updated = await db.update('repairs', `id=eq.${encodeURIComponent(String(id))}`, patch)
      if (!updated.length) return res.status(404).json({ success: false, error: 'Repair not found.' })
      const repair = updated[0]

      // Charge on collection — once, idempotently, never for £0. If paid on
      // collection (cash/card/…), post an equal payment so the wallet nets
      // to zero — a repair paid at the counter never leaves a debt.
      const PAY_METHODS = { cash: 'cash', card: 'card', card_on_file: 'card', bank_transfer: 'bank_transfer' }
      const payMethod = PAY_METHODS[payment] || null
      let chargePosted = false
      let paidNow = false
      let balance = null
      if (patch.status === 'Collected' && Number(repair.total) > 0) {
        const memo = `Repair — ${repair.device_description || 'device'}`
        await db.insertIgnoreDup('ledger', [{
          customer_id: repair.customer_id,
          charge_reference: `REPAIR-${repair.id}`,
          entry_type: 'repair',
          amount: -Number(repair.total),
          description: memo,
          related_repair_id: repair.id,
        }], 'charge_reference')
        chargePosted = true
        if (payMethod) {
          await db.insertIgnoreDup('ledger', [{
            customer_id: repair.customer_id,
            charge_reference: `PAY-REPAIR-${repair.id}`,
            entry_type: 'payment',
            amount: Number(repair.total),
            method: payMethod,
            description: `Paid (${payment === 'card_on_file' ? 'card on file' : payMethod}) — ${memo}`,
            related_repair_id: repair.id,
          }], 'charge_reference')
          paidNow = true
        }
        const balRows = await db.select('customer_balances', `customer_id=eq.${repair.customer_id}`)
        balance = balRows.length ? Number(balRows[0].balance) : 0
      }

      const [full] = await db.select('repairs', `select=*,${EMBED}&id=eq.${repair.id}`)
      return res.json({ success: true, repair: toApp(full), chargePosted, paidNow, balance })
    }

    return res.status(405).end()
  } catch (e) {
    console.error('[api/repairs]', e)
    return res.status(500).json({ success: false, error: 'Storage error' })
  }
}

export default withStaff(handler)
