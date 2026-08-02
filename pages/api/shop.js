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
import { money, settleSale } from '../../lib/money.mjs'

const CATEGORIES = ['phone', 'accessory', 'sim', 'other']
const METHODS = ['cash', 'card', 'bank_transfer', 'voucher', 'other']
// money() and settleSale() are imported from lib/money.mjs (single source of
// truth for penny rounding — a local copy here silently diverged on half-pennies).

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
      // The basket token is REQUIRED (sweep 2026-08-02 #1): without it every
      // retry minted fresh SALE- references and a double-click charged twice.
      // The till always sends one; a request without it is not the till.
      const clientRef = (typeof b.clientRef === 'string' && /^[\w-]{8,64}$/.test(b.clientRef)) ? b.clientRef : null
      if (!clientRef) {
        return res.status(400).json({ success: false, error: 'Missing idempotency token — refresh and try again.' })
      }

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
      // A committed sale whose response was lost replays with the same token —
      // possibly after its own commit emptied the shelf. Check "did this exact
      // basket already commit?" against the ledger (the source of truth), so a
      // sold-out replay reports duplicate instead of a phantom stock error.
      const alreadyCommitted = async () => {
        if (!clientRef) return false
        const dup = await db.select('ledger',
          `charge_reference=eq.${encodeURIComponent('SALE-' + clientRef + '-0')}&select=id&limit=1`)
        return dup.length > 0
      }
      const duplicateResponse = async () => {
        const balRows = await db.select('customer_balances', `customer_id=eq.${customerUuid}`)
        return res.json({ success: true, duplicate: true, balance: balRows.length ? Number(balRows[0].balance) : 0 })
      }

      const byId = new Map(itemRows.map(i => [String(i.id), i]))
      for (const [id, q] of wanted) {
        const item = byId.get(id)
        if (!item) return res.status(400).json({ success: false, error: 'An item is unknown or retired.' })
        if ((item.quantity ?? 0) < q) {
          if (await alreadyCommitted()) return duplicateResponse()
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

      // Idempotency: claim the basket's key BEFORE any side effect. A retry,
      // double-click, or concurrent submit with the same token collides on the
      // key and short-circuits — closing the window where two parallel submits
      // both decrement stock before either ledger row exists (the ledger alone
      // dedupes the charge but not the stock move). audit A2/U3.
      if (clientRef) {
        const claimed = await db.claimKey(`SALE-${clientRef}`, { scope: 'shop_sale', customerId: customerUuid })
        if (!claimed) {
          // A held key only means "someone claimed it" — verify the sale actually
          // committed (ledger row exists) before telling the till it's recorded.
          // No ledger row = the first attempt is still in flight or died; 409 so
          // the operator retries rather than handing over unpaid goods.
          if (await alreadyCommitted()) return duplicateResponse()
          return res.status(409).json({ success: false, error: 'That sale is still being processed — give it a second and try again.' })
        }
      }

      // Reserve stock atomically for every DISTINCT item BEFORE posting anything.
      // The JS pre-check above catches the common case, but two tills selling the
      // last unit can both pass it; the guarded DB decrement (quantity + delta >= 0)
      // is the real race-closer — only one can win. If any line loses the race we
      // give back everything already taken in this basket and charge nothing. audit A1.
      // Give back everything this request took. Each step is individually
      // guarded — one failed give-back must not stop the others, and the key
      // release runs regardless so a genuine retry isn't locked out.
      const saleRowIds = []
      const unwind = async () => {
        for (const sid of saleRowIds) {
          try { await db.delete('stock_sales', `id=eq.${sid}`) }
          catch (e2) { console.error('[api/shop] unwind: stock_sales row stranded', sid, e2) }
        }
        for (const r of reserved) {
          try { await db.rpc('adjust_stock_qty', { p_item: r.id, p_qty: r.qty }) }
          catch (e2) { console.error('[api/shop] unwind: stock not returned', r.id, e2) }
        }
        if (clientRef) {
          try { await db.releaseKey(`SALE-${clientRef}`) }
          catch (e2) { console.error('[api/shop] unwind: key not released', clientRef, e2) }
        }
      }

      const reserved = []
      for (const [id, q] of wanted) {
        let left = null
        try { left = await db.rpc('adjust_stock_qty', { p_item: id, p_qty: -q }) }
        catch (e2) { await unwind(); throw e2 }
        if (left === null || left === undefined) {
          // Lost the last-unit race: nothing was charged, return what we took.
          await unwind()
          const fresh = await db.select('stock_items', `select=quantity,model&id=eq.${encodeURIComponent(id)}`)
          const have = fresh.length ? (fresh[0].quantity ?? 0) : 0
          const name = fresh.length ? fresh[0].model : 'that item'
          return res.status(409).json({ success: false, error: `Only ${have} × ${name} left — the last of it just sold. Nothing was charged.` })
        }
        reserved.push({ id, qty: q })
      }

      // Commit. Insert every stock_sales row and BUILD (don't yet post) the
      // ledger lines; then post ALL money — the line charges and the settlement
      // payment — in ONE atomic insert at the very end. The ledger is append-only
      // and can't be deleted, so posting charges mid-loop meant a failure on a
      // later line (or the balance read) stranded a charge the customer could
      // never get back. With the single terminal write, until it lands no charge
      // exists, so unwind only has to undo stock/keys. audit A2.
      let grandTotal = 0
      let basketRef = clientRef
      try {
        const ledgerRows = []
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
          saleRowIds.push(sale.id)
          if (!basketRef) basketRef = sale.id  // stable settlement ref when no client token
          // Stock already decremented atomically above (audit A1) — don't PATCH here.

          // Idempotent per-line charge reference (client token + index) so a retry
          // can't double-post; falls back to the sale id when no token is sent.
          const saleRef = clientRef ? `${clientRef}-${i}` : sale.id
          const label = `${item.company || ''} ${item.model || ''}`.trim()
          ledgerRows.push({
            customer_id: customerUuid,
            charge_reference: `SALE-${saleRef}`,
            entry_type: item.category === 'phone' ? 'phone_sale' : 'stock_sale',
            amount: -total,
            description: `${label}${qty > 1 ? ` × ${qty}` : ''}${l.imei ? ` — IMEI ${l.imei}` : ''}`,
          })
          grandTotal = money(grandTotal + total)
        }

        // Settlement. Post a PAYMENT only for money that physically moved NOW
        // (cash/card/…); the wallet portion posts NO payment — the charge draws it
        // straight from their credit, capped by the credit they ACTUALLY hold.
        // Because the charges aren't posted yet, the current balance IS the
        // pre-basket balance — read it directly instead of reconstructing it.
        const isWalkin = !b.customerId || b.customerId === 'walkin'
        let preBasketBalance = 0
        if (!isWalkin && money(b.walletAmount) > 0) {
          const credRows = await db.select('customer_balances', `customer_id=eq.${customerUuid}`)
          preBasketBalance = credRows.length ? Number(credRows[0].balance) : 0
        }
        const { walletApplied, walletShortfall, paidNowAmount } = settleSale({
          grandTotal, walletRequested: b.walletAmount, preBasketBalance,
          paidNow: b.paidNow, isWalkin,
        })
        if (paidNowAmount > 0) {
          ledgerRows.push({
            customer_id: customerUuid,
            charge_reference: `PAY-SALE-${basketRef}-now`,
            entry_type: 'payment',
            amount: paidNowAmount,
            method,
            description: walletApplied > 0 ? 'Paid — shop sale (part)' : 'Paid — shop sale',
          })
        }

        // The single, atomic money write: one PostgREST POST is one statement, so
        // the whole basket's charges and its settlement payment land together or
        // not at all. insertIgnoreDup makes an operator's retry (same refs) a no-op.
        await db.insertIgnoreDup('ledger', ledgerRows, 'charge_reference')

        // The sale is committed. A failed final balance read must NOT error the
        // sale (that would unwind stock while the charges stay posted) — default
        // the returned balance instead.
        let balance = null
        try {
          const balRows = await db.select('customer_balances', `customer_id=eq.${customerUuid}`)
          balance = balRows.length ? Number(balRows[0].balance) : 0
        } catch (e2) { console.error('[api/shop] post-sale balance read failed', e2) }
        return res.json({
          success: true,
          total: grandTotal,
          lines: lines.length,
          walletApplied,
          walletShortfall,
          paidNow: paidNowAmount,
          balance,
        })
      } catch (e) {
        await unwind()
        throw e
      }
    }

    return res.status(405).end()
  } catch (e) {
    console.error('[api/shop]', e)
    return res.status(500).json({ success: false, error: 'Storage error' })
  }
}

export default withStaff(handler)
