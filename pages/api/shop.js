// The SHOP — selling devices & accessories (a separate business line from
// the rental fleet, which lives in `lines`).
//
//   GET               → { items, sales } (inventory + last 100 sales)
//   POST {op:'item'}  → add a stock item
//   PUT  {op:'item'}  → edit a stock item (prices/qty/threshold/active)
//   POST {op:'sale'}  → record a sale: decrements stock, posts SALE-<uuid>
//                       to the ledger (phone_sale / stock_sale by category),
//                       optional immediate payment PAY-SALE-<uuid>.
//                       customerId 'walkin' books it on the built-in
//                       "Shop Walk-in" customer so cash sales still hit the
//                       ledger (and the cash-up).

import { withStaff, tabAllowedFor } from '../../lib/auth.js'
import { db, tablesMode } from '../../lib/db.js'

const CATEGORIES = ['phone', 'accessory', 'sim', 'other']
const METHODS = ['cash', 'card', 'bank_transfer', 'voucher', 'other']
const money = (v) => Math.round((Number(v) || 0) * 100) / 100

const itemToApp = (r) => ({
  id: r.id,
  code: r.item_code || '',
  barcode: r.barcode || '',
  category: r.category,
  company: r.company || '',
  model: r.model || '',
  description: r.description || '',
  netPrice: r.net_price === null ? null : Number(r.net_price),
  sellingPrice: r.selling_price === null ? null : Number(r.selling_price),
  profit: r.profit === null ? null : Number(r.profit),
  quantity: r.quantity ?? 0,
  lowStockAt: r.low_stock_at ?? 1,
  active: !!r.active,
})

const saleToApp = (r) => ({
  id: r.id,
  customerName: r.customers
    ? `${r.customers.first_name || ''} ${r.customers.last_name || ''}`.trim() : '',
  item: r.stock_items ? `${r.stock_items.company || ''} ${r.stock_items.model || ''}`.trim() : '?',
  qty: r.qty,
  total: Number(r.total),
  imei: r.imei || '',
  notes: r.notes || '',
  createdAt: r.created_at,
})

async function walkInCustomer() {
  const rows = await db.select('customers', `select=id&legacy_id=eq.walkin`)
  if (rows.length) return rows[0].id
  const [row] = await db.insert('customers', [{
    legacy_id: 'walkin',
    first_name: 'Shop',
    last_name: 'Walk-in',
    notes: 'Built-in customer for over-the-counter sales.',
    legacy_extras: { id: 'walkin', firstName: 'Shop', lastName: 'Walk-in', builtIn: true },
  }])
  return row.id
}

async function handler(req, res) {
  if (!tablesMode) {
    return res.status(503).json({ success: false, error: 'The shop needs the relational data layer.' })
  }
  if (!(await tabAllowedFor(req.staff, 'shop'))) {
    return res.status(403).json({ success: false, error: 'The shop is not enabled for your account.' })
  }

  try {
    if (req.method === 'GET') {
      const [items, sales] = await Promise.all([
        db.select('stock_items', 'order=category.asc,model.asc'),
        db.select('stock_sales', 'select=*,customers(first_name,last_name),stock_items(company,model)&order=created_at.desc&limit=100'),
      ])
      return res.json({ success: true, items: items.map(itemToApp), sales: sales.map(saleToApp) })
    }

    const b = req.body || {}

    if (req.method === 'POST' && b.op === 'item') {
      if (!b.model || !String(b.model).trim()) return res.status(400).json({ success: false, error: 'Model / name is required.' })
      if (!CATEGORIES.includes(b.category)) return res.status(400).json({ success: false, error: 'Pick a category.' })
      const sell = Number(b.sellingPrice)
      if (!Number.isFinite(sell) || sell < 0) return res.status(400).json({ success: false, error: 'Selling price must be ≥ 0.' })
      const [row] = await db.insert('stock_items', [{
        item_code: b.code || null,
        barcode: String(b.barcode || '').trim() || null,
        category: b.category,
        company: b.company || null,
        model: String(b.model).trim(),
        description: b.description || null,
        net_price: Number.isFinite(Number(b.netPrice)) ? money(b.netPrice) : null,
        selling_price: money(sell),
        quantity: Math.max(0, parseInt(b.quantity, 10) || 0),
        low_stock_at: Math.max(0, parseInt(b.lowStockAt, 10) || 1),
      }])
      return res.json({ success: true, item: itemToApp(row) })
    }

    if (req.method === 'PUT' && b.op === 'item') {
      if (!b.id) return res.status(400).json({ success: false, error: 'Item id is required.' })
      const patch = { updated_at: new Date().toISOString() }
      if (b.code !== undefined) patch.item_code = b.code || null
      if (b.barcode !== undefined) patch.barcode = String(b.barcode || '').trim() || null
      if (b.company !== undefined) patch.company = b.company || null
      if (b.model !== undefined) patch.model = String(b.model).trim()
      if (b.netPrice !== undefined) patch.net_price = Number.isFinite(Number(b.netPrice)) ? money(b.netPrice) : null
      if (b.sellingPrice !== undefined) {
        const s = Number(b.sellingPrice)
        if (!Number.isFinite(s) || s < 0) return res.status(400).json({ success: false, error: 'Selling price must be ≥ 0.' })
        patch.selling_price = money(s)
      }
      if (b.quantity !== undefined) patch.quantity = Math.max(0, parseInt(b.quantity, 10) || 0)
      if (b.lowStockAt !== undefined) patch.low_stock_at = Math.max(0, parseInt(b.lowStockAt, 10) || 0)
      if (b.active !== undefined) patch.active = !!b.active
      const updated = await db.update('stock_items', `id=eq.${encodeURIComponent(String(b.id))}`, patch)
      if (!updated.length) return res.status(404).json({ success: false, error: 'Item not found.' })
      return res.json({ success: true, item: itemToApp(updated[0]) })
    }

    if (req.method === 'POST' && b.op === 'sale') {
      // Single line ({itemId, qty}) or a POS basket ({lines: [{itemId, qty, imei}]}).
      const lines = Array.isArray(b.lines) && b.lines.length
        ? b.lines
        : (b.itemId ? [{ itemId: b.itemId, qty: b.qty, imei: b.imei, total: b.total }] : [])
      if (!lines.length) return res.status(400).json({ success: false, error: 'Pick at least one item.' })
      const clientRef = (typeof b.clientRef === 'string' && /^[\w-]{8,64}$/.test(b.clientRef)) ? b.clientRef : null

      const customerUuid = !b.customerId || b.customerId === 'walkin'
        ? await walkInCustomer()
        : (await db.select('customers', `select=id&legacy_id=eq.${encodeURIComponent(String(b.customerId))}`))[0]?.id
      if (!customerUuid) return res.status(400).json({ success: false, error: `Customer ${b.customerId} not found.` })

      // Validate ALL stock before selling anything (a basket is one handover).
      const wanted = new Map()
      for (const l of lines) {
        const q = Math.max(1, parseInt(l.qty, 10) || 1)
        wanted.set(String(l.itemId), (wanted.get(String(l.itemId)) || 0) + q)
      }
      const itemRows = await db.select(
        'stock_items',
        `id=in.(${[...wanted.keys()].map(encodeURIComponent).join(',')})&active=is.true`
      )
      const byId = new Map(itemRows.map(i => [String(i.id), i]))
      for (const [id, q] of wanted) {
        const item = byId.get(id)
        if (!item) return res.status(400).json({ success: false, error: 'An item is unknown or retired.' })
        if ((item.quantity ?? 0) < q) {
          return res.status(400).json({ success: false, error: `Only ${item.quantity ?? 0} × ${item.model} in stock.` })
        }
      }

      const method = METHODS.includes(b.method) ? b.method : 'cash'

      // Compute + validate EVERY line's total before committing anything, so a bad
      // (e.g. £0) line can't 400 mid-basket after earlier lines already posted to
      // the ledger — the partial-commit bug. audit U3.
      const computed = lines.map((l) => {
        const item = byId.get(String(l.itemId))
        const qty = Math.max(1, parseInt(l.qty, 10) || 1)
        const unit = Number(item.selling_price) || 0
        const overridden = lines.length === 1 ? Number(l.total) : NaN
        const total = Number.isFinite(overridden) && overridden >= 0 ? money(overridden) : money(unit * qty)
        return { l, item, qty, unit, total }
      })
      if (computed.some((c) => !(c.total > 0))) {
        return res.status(400).json({ success: false, error: 'Every line total must be greater than £0.' })
      }

      // Idempotency: a full replay (retry / double-click) must not re-post. If the
      // first line's ledger ref already exists, this basket already committed. audit U3.
      if (clientRef) {
        const dup = await db.select('ledger', `charge_reference=eq.${encodeURIComponent('SALE-' + clientRef + '-0')}&select=id&limit=1`)
        if (dup.length) {
          const balRows = await db.select('customer_balances', `customer_id=eq.${customerUuid}`)
          return res.json({ success: true, duplicate: true, balance: balRows.length ? Number(balRows[0].balance) : 0 })
        }
      }

      // Reserve stock atomically for every DISTINCT item BEFORE posting anything.
      // The JS pre-check above catches the common case, but two tills selling the
      // last unit can both pass it; the guarded DB decrement (quantity + delta >= 0)
      // is the real race-closer — only one can win. If any line loses the race we
      // give back everything already taken in this basket and charge nothing. audit A1.
      const reserved = []
      for (const [id, q] of wanted) {
        const left = await db.rpc('adjust_stock_qty', { p_item: id, p_qty: -q })
        if (left === null || left === undefined) {
          for (const r of reserved) await db.rpc('adjust_stock_qty', { p_item: r.id, p_qty: r.qty })
          const fresh = await db.select('stock_items', `select=quantity,model&id=eq.${encodeURIComponent(id)}`)
          const have = fresh.length ? (fresh[0].quantity ?? 0) : 0
          const name = fresh.length ? fresh[0].model : 'that item'
          return res.status(409).json({ success: false, error: `Only ${have} × ${name} left — the last of it just sold. Nothing was charged.` })
        }
        reserved.push({ id, qty: q })
      }

      let grandTotal = 0
      for (let i = 0; i < computed.length; i++) {
        const { l, item, qty, unit, total } = computed[i]
        const [sale] = await db.insert('stock_sales', [{
          customer_id: customerUuid,
          stock_item_id: item.id,
          qty,
          unit_price: unit,
          total,
          imei: l.imei || null,
          notes: b.notes || null,
          created_by: req.staff?.id || null,
        }])
        // Stock already decremented atomically above (audit A1) — don't PATCH here.

        // Idempotent per-line reference (client token + index) so a retry can't
        // double-charge the ledger; falls back to the sale id when no token is sent.
        const saleRef = clientRef ? `${clientRef}-${i}` : sale.id
        const label = `${item.company || ''} ${item.model || ''}`.trim()
        await db.insertIgnoreDup('ledger', [{
          customer_id: customerUuid,
          charge_reference: `SALE-${saleRef}`,
          entry_type: item.category === 'phone' ? 'phone_sale' : 'stock_sale',
          amount: -total,
          description: `${label}${qty > 1 ? ` × ${qty}` : ''}${l.imei ? ` — IMEI ${l.imei}` : ''}`,
        }], 'charge_reference')
        if (b.paidNow) {
          await db.insertIgnoreDup('ledger', [{
            customer_id: customerUuid,
            charge_reference: `PAY-SALE-${saleRef}`,
            entry_type: 'payment',
            amount: total,
            method,
            description: `Paid — ${label}`,
          }], 'charge_reference')
        }
        grandTotal = money(grandTotal + total)
      }

      const balRows = await db.select('customer_balances', `customer_id=eq.${customerUuid}`)
      return res.json({
        success: true,
        total: grandTotal,
        lines: lines.length,
        balance: balRows.length ? Number(balRows[0].balance) : 0,
      })
    }

    return res.status(405).end()
  } catch (e) {
    console.error('[api/shop]', e)
    return res.status(500).json({ success: false, error: 'Storage error' })
  }
}

export default withStaff(handler)
