// Online-services charging — one row per charged service, money in the
// append-only ledger:
//   - creation posts ONE charge: entry_type 'online_service',
//     charge_reference 'SVC-<uuid>' (idempotent), amount -(total)
//   - optional immediate payment posts alongside: 'PAY-SVC-<uuid>'
//   - repeat-application pricing (price list): units below the threshold at
//     price, units from the Nth at repeat_price. The threshold is the
//     online_repeat_from setting (current list: "4 or more"; the old list
//     said 2). Services without a repeat price charge every unit at price.

import { withStaff } from '../../lib/auth.js'
import { db, tablesMode } from '../../lib/db.js'
import { postAutoCharges } from '../../lib/customCharges.js'

const EMBED = 'customers(legacy_id,first_name,last_name),service_prices(name,category)'
const METHODS = ['cash', 'card', 'bank_transfer', 'voucher', 'other']

// Same tier maths as public/main.js onlineServiceTotal — keep in sync.
function orderTotal(svc, qty, repeatFrom) {
  const n = Math.max(1, Math.floor(Number(qty)) || 1)
  const single = Number(svc.price) || 0
  const rep = svc.repeat_price === null || svc.repeat_price === undefined
    ? single : Number(svc.repeat_price)
  const from = Math.max(2, Number(repeatFrom) || 4)
  const atSingle = Math.min(n, from - 1)
  return { qty: n, total: atSingle * single + (n - atSingle) * rep }
}

function toApp(row) {
  return {
    id: row.id,
    customerId: row.customers?.legacy_id ?? null,
    customerName: row.customers
      ? `${row.customers.first_name || ''} ${row.customers.last_name || ''}`.trim()
      : '',
    serviceName: row.service_prices?.name || '(retired service)',
    qty: row.qty,
    unitPrice: Number(row.unit_price),
    total: Number(row.total),
    notes: row.notes || '',
    createdAt: row.created_at,
  }
}

async function handler(req, res) {
  if (!tablesMode) {
    return res.status(503).json({ success: false, error: 'Services need the relational data layer.' })
  }

  try {
    if (req.method === 'GET') {
      const rows = await db.select('service_orders', `select=*,${EMBED}&order=created_at.desc&limit=200`)
      return res.json(rows.map(toApp))
    }

    if (req.method === 'POST') {
      const b = req.body || {}
      if (!b.customerId) return res.status(400).json({ success: false, error: 'Customer is required.' })
      if (!b.serviceId) return res.status(400).json({ success: false, error: 'Service is required.' })

      const [custRows, svcRows, setRows] = await Promise.all([
        db.select('customers', `select=id&legacy_id=eq.${encodeURIComponent(String(b.customerId))}`),
        db.select('service_prices', `id=eq.${encodeURIComponent(String(b.serviceId))}&active=is.true`),
        db.select('settings', 'select=num_value&key=eq.online_repeat_from'),
      ])
      if (!custRows.length) return res.status(400).json({ success: false, error: `Customer ${b.customerId} not found.` })
      if (!svcRows.length) return res.status(400).json({ success: false, error: 'Service is unknown or retired.' })
      const customerUuid = custRows[0].id
      const svc = svcRows[0]

      const { qty, total: tierTotal } = orderTotal(svc, b.qty, setRows[0]?.num_value)
      // Staff may override the computed total (e.g. hourly work, goodwill).
      const overridden = Number(b.total)
      const total = Number.isFinite(overridden) && overridden >= 0 ? overridden : tierTotal
      if (total <= 0) return res.status(400).json({ success: false, error: 'Total must be greater than £0.' })

      const [order] = await db.insert('service_orders', [{
        customer_id: customerUuid,
        service_price_id: svc.id,
        qty,
        unit_price: Number(svc.price),
        total,
        notes: b.notes || null,
      }])

      // No related_* FK column for service orders — the SVC-<uuid> reference
      // carries the link.
      await db.insertIgnoreDup('ledger', [{
        customer_id: customerUuid,
        charge_reference: `SVC-${order.id}`,
        entry_type: 'online_service',
        amount: -total,
        description: `${svc.name}${qty > 1 ? ` × ${qty}` : ''}`,
      }], 'charge_reference')

      // Optional immediate payment (most services are paid on the spot).
      const method = METHODS.includes(b.method) ? b.method : 'cash'
      if (b.paidNow) {
        await db.insertIgnoreDup('ledger', [{
          customer_id: customerUuid,
          charge_reference: `PAY-SVC-${order.id}`,
          entry_type: 'payment',
          amount: total,
          method,
          description: `Paid — ${svc.name}`,
        }], 'charge_reference')
      }

      // Owner-defined auto extras for services.
      const extras = await postAutoCharges({
        customerUuid, appliesTo: 'service', refBase: order.id,
        paidNow: !!b.paidNow, method,
      })

      const balRows = await db.select('customer_balances', `customer_id=eq.${customerUuid}`)
      const balance = balRows.length ? Number(balRows[0].balance) : 0

      const [full] = await db.select('service_orders', `select=*,${EMBED}&id=eq.${order.id}`)
      return res.json({ success: true, order: toApp(full), extras: extras.lines, balance })
    }

    return res.status(405).end()
  } catch (e) {
    console.error('[api/service-orders]', e)
    return res.status(500).json({ success: false, error: 'Storage error' })
  }
}

export default withStaff(handler)
