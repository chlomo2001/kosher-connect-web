// Online-services charging — one row per charged service, money in the
// append-only ledger:
//   - creation posts ONE charge: entry_type 'online_service',
//     charge_reference 'SVC-<uuid>' (idempotent), amount -(total)
//   - optional immediate payment posts alongside: 'PAY-SVC-<uuid>'
//   - repeat-application pricing (price list): units below the threshold at
//     price, units from the Nth at repeat_price. The threshold is the
//     online_repeat_from setting (current list: "4 or more"; the old list
//     said 2). Services without a repeat price charge every unit at price.

import { withTab } from '../../lib/auth.js'
import { db, tablesMode } from '../../lib/db.js'
import { postAutoCharges } from '../../lib/customCharges.js'
import { serviceOrderTotal } from '../../lib/money.mjs'

const EMBED = 'customers(legacy_id,first_name,last_name),service_prices(name,category)'
const METHODS = ['cash', 'card', 'bank_transfer', 'voucher', 'other']
const validRef = (v) => (typeof v === 'string' && /^[\w-]{8,64}$/.test(v)) ? v : null

// Tier maths lives in lib/money.js (tested; keep public/main.js in sync).
const orderTotal = (svc, qty, repeatFrom) =>
  serviceOrderTotal(svc.price, svc.repeat_price, qty, repeatFrom)

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
      const clientRef = validRef(b.clientRef)
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

      // Idempotency: a repeat submit (retry / double-click / concurrent) must not
      // create a second order or a second charge. Two layers:
      //   1. Fast path — the SVC-<clientRef> charge already exists → completed
      //      replay: return the current balance, post nothing.
      //   2. claimKey — atomically claim the token BEFORE inserting the order row.
      //      The ledger dedupes the CHARGE, but not the order row; without the claim
      //      two parallel submits both pass the read-check and each insert an order
      //      (one left with no charge). The claim lets only one win.
      const svcDuplicate = async () => {
        const balRows = await db.select('customer_balances', `customer_id=eq.${customerUuid}`)
        return res.json({ success: true, duplicate: true, balance: balRows.length ? Number(balRows[0].balance) : 0 })
      }
      let keyClaimed = false
      if (clientRef) {
        const dup = await db.select('ledger', `charge_reference=eq.${encodeURIComponent('SVC-' + clientRef)}&select=id&limit=1`)
        if (dup.length) return svcDuplicate()
        keyClaimed = await db.claimKey(`SVC-${clientRef}`, { scope: 'service_order', customerId: customerUuid })
        if (!keyClaimed) {
          // Another submit holds the token: committed → duplicate; in flight → 409.
          const dup2 = await db.select('ledger', `charge_reference=eq.${encodeURIComponent('SVC-' + clientRef)}&select=id&limit=1`)
          if (dup2.length) return svcDuplicate()
          return res.status(409).json({ success: false, error: 'That charge is still being saved — give it a second and try again.' })
        }
      }

      try {
        const [order] = await db.insert('service_orders', [{
          customer_id: customerUuid,
          service_price_id: svc.id,
          qty,
          unit_price: Number(svc.price),
          total,
          notes: b.notes || null,
        }])

        // Reference base = the client idempotency token when present (so retries dedupe
        // even across two order rows a race could create), else the order id.
        const refBase = clientRef || order.id
        // No related_* FK column for service orders — the SVC-<ref> reference
        // carries the link.
        await db.insertIgnoreDup('ledger', [{
          customer_id: customerUuid,
          charge_reference: `SVC-${refBase}`,
          entry_type: 'online_service',
          amount: -total,
          description: `${svc.name}${qty > 1 ? ` × ${qty}` : ''}`,
        }], 'charge_reference')

        // Optional immediate payment (most services are paid on the spot).
        const method = METHODS.includes(b.method) ? b.method : 'cash'
        if (b.paidNow) {
          await db.insertIgnoreDup('ledger', [{
            customer_id: customerUuid,
            charge_reference: `PAY-SVC-${refBase}`,
            entry_type: 'payment',
            amount: total,
            method,
            description: `Paid — ${svc.name}`,
          }], 'charge_reference')
        }

        // Owner-defined auto extras for services.
        const extras = await postAutoCharges({
          customerUuid, appliesTo: 'service', refBase,
          paidNow: !!b.paidNow, method,
        })

        const balRows = await db.select('customer_balances', `customer_id=eq.${customerUuid}`)
        const balance = balRows.length ? Number(balRows[0].balance) : 0

        const [full] = await db.select('service_orders', `select=*,${EMBED}&id=eq.${order.id}`)
        return res.json({ success: true, order: toApp(full), extras: extras.lines, balance })
      } catch (e) {
        // Aborted after claiming but before the charge is durable: release the token
        // so a genuine retry isn't locked out (the ledger key no-ops any charge that
        // did land).
        if (keyClaimed) {
          try { await db.releaseKey(`SVC-${clientRef}`) }
          catch (e2) { console.error('[api/service-orders] token not released after error', clientRef, e2) }
        }
        throw e
      }
    }

    return res.status(405).end()
  } catch (e) {
    console.error('[api/service-orders]', e)
    return res.status(500).json({ success: false, error: 'Storage error' })
  }
}

export default withTab('services', handler)
