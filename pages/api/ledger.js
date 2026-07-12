// Wallet ledger — read a customer's statement/balance and record money-in.
//
// Money model:
//   - the ledger is append-only; the DB enforces sign per entry_type and
//     idempotency via charge_reference unique
//   - balance is never stored: customer_balances view (sum of amounts)
//   - money-in kinds here: payment (settling arrears), top_up (credit in
//     advance), refund (money back to the customer's wallet), adjustment
//     (owner correction, either sign, never zero)
// Charges are posted only by their owning features (bookings, repairs, …),
// each with a stable reference — never from this endpoint.

import crypto from 'node:crypto'
import { db, tablesMode } from '../../lib/db.js'

const KINDS = {
  payment:    { entry_type: 'payment',           prefix: 'PAY' },
  top_up:     { entry_type: 'top_up',            prefix: 'TOPUP' },
  refund:     { entry_type: 'refund',            prefix: 'REFUND' },
  adjustment: { entry_type: 'manual_adjustment', prefix: 'ADJ' },
}
const METHODS = ['cash', 'card', 'bank_transfer', 'voucher', 'wallet', 'other']

async function resolveCustomer(legacyId) {
  const rows = await db.select(
    'customers',
    `select=id&legacy_id=eq.${encodeURIComponent(String(legacyId))}`
  )
  return rows.length ? rows[0].id : null
}

async function walletBalance(customerUuid) {
  const rows = await db.select('customer_balances', `customer_id=eq.${customerUuid}`)
  return rows.length ? Number(rows[0].balance) : 0
}

const toAppEntry = (row) => ({
  id: row.id,
  type: row.entry_type,
  amount: Number(row.amount),
  method: row.method || '',
  reference: row.charge_reference,
  description: row.description || '',
  at: row.created_at,
})

async function handler(req, res) {
  if (!tablesMode) {
    return res.status(503).json({
      success: false,
      error: 'The wallet needs the relational data layer (SUPABASE_SERVICE_ROLE_KEY not configured).',
    })
  }

  try {
    if (req.method === 'GET') {
      const { customerId } = req.query

      // No customerId → business-wide summary for the dashboard.
      // `since` is the shop's local date (client-computed) so "today's money"
      // matches what the operator means by today.
      if (!customerId) {
        const since = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.since || ''))
          ? req.query.since : new Date().toISOString().slice(0, 10)
        const [recent, todays, balances, custRows] = await Promise.all([
          db.select('ledger', 'select=*,customers(first_name,last_name)&order=created_at.desc&limit=12'),
          db.select('ledger', `select=amount&created_at=gte.${since}`),
          db.select('customer_balances', ''),
          db.select('customers', 'select=id,first_name,last_name'),
        ])
        const names = new Map(custRows.map(c => [c.id, `${c.first_name || ''} ${c.last_name || ''}`.trim()]))
        const arrears = balances
          .filter(b => Number(b.balance) < 0)
          .map(b => ({ customerName: names.get(b.customer_id) || '?', balance: Number(b.balance) }))
          .sort((a, b) => a.balance - b.balance)
        return res.json({
          success: true,
          recent: recent.map(r => ({
            ...toAppEntry(r),
            customerName: r.customers
              ? `${r.customers.first_name || ''} ${r.customers.last_name || ''}`.trim() : '',
          })),
          arrears,
          arrearsTotal: arrears.reduce((s, a) => s + a.balance, 0),
          todayIn: todays.filter(r => Number(r.amount) > 0).reduce((s, r) => s + Number(r.amount), 0),
          todayOut: todays.filter(r => Number(r.amount) < 0).reduce((s, r) => s + Number(r.amount), 0),
        })
      }
      const uuid = await resolveCustomer(customerId)
      if (!uuid) return res.json({ success: true, entries: [], balance: 0, known: false })
      const rows = await db.select(
        'ledger',
        `customer_id=eq.${uuid}&order=created_at.desc&limit=100`
      )
      return res.json({
        success: true,
        known: true,
        entries: rows.map(toAppEntry),
        balance: await walletBalance(uuid),
      })
    }

    if (req.method === 'POST') {
      const b = req.body || {}
      const kind = KINDS[b.kind]
      if (!kind) return res.status(400).json({ success: false, error: `kind must be one of: ${Object.keys(KINDS).join(', ')}.` })
      const amount = Number(b.amount)
      if (!Number.isFinite(amount) || amount === 0) {
        return res.status(400).json({ success: false, error: 'Amount must be a non-zero number.' })
      }
      if (b.kind !== 'adjustment' && amount < 0) {
        return res.status(400).json({ success: false, error: 'Amount must be positive — use an adjustment for corrections.' })
      }
      const method = b.method && METHODS.includes(b.method) ? b.method : null
      if (b.kind === 'payment' && !method) {
        return res.status(400).json({ success: false, error: `Payment method must be one of: ${METHODS.join(', ')}.` })
      }
      const uuid = await resolveCustomer(b.customerId)
      if (!uuid) return res.status(400).json({ success: false, error: `Customer ${b.customerId} not found.` })

      const [row] = await db.insert('ledger', [{
        customer_id: uuid,
        charge_reference: `${kind.prefix}-${crypto.randomUUID()}`,
        entry_type: kind.entry_type,
        amount,
        method,
        description: b.note || null,
      }])

      return res.json({
        success: true,
        entry: toAppEntry(row),
        balance: await walletBalance(uuid),
      })
    }

    return res.status(405).end()
  } catch (e) {
    console.error('[api/ledger]', e)
    // Surface the DB's sign-constraint message usefully instead of a blind 500.
    if (/ledger_amount_sign|ledger_amount_nonzero/.test(String(e.message))) {
      return res.status(400).json({ success: false, error: 'Amount sign does not match the entry type.' })
    }
    return res.status(500).json({ success: false, error: 'Storage error' })
  }
}

export default withStaff(handler)
