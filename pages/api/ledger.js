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

import { withStaff, tabAllowedFor, requireOwner } from '../../lib/auth.js'
import crypto from 'node:crypto'
import { db, tablesMode } from '../../lib/db.js'

// Wallet actions are reachable from the Wallet tab AND the customer card,
// so either tab permits them (owners always pass).
async function canTouchWallet(staff) {
  return (await tabAllowedFor(staff, 'wallet')) || (await tabAllowedFor(staff, 'customers'))
}

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

      // No customerId → business-wide summary for the dashboard/Wallet tab.
      // Tab-gated for helpers (per-customer wallets stay available so the
      // customer panel keeps working).
      if (!customerId) {
        if (!(await tabAllowedFor(req.staff, 'wallet'))) {
          return res.status(403).json({ success: false, error: 'The wallet is not enabled for your account.' })
        }
        // Revenue report: charges (debits) grouped by entry_type + money
        // actually received (payments/top-ups), for entries since `from`.
        if (req.query.report) {
          const from = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.from || ''))
            ? req.query.from : new Date().toISOString().slice(0, 10)
          const rows = await db.select('ledger', `select=entry_type,amount&created_at=gte.${from}`)
          const round = (v) => Math.round(v * 100) / 100
          const byType = {}
          let charged = 0, received = 0, refunded = 0
          for (const r of rows) {
            const amt = Number(r.amount)
            if (amt < 0) { byType[r.entry_type] = (byType[r.entry_type] || 0) - amt; charged -= amt }
            else if (r.entry_type === 'payment' || r.entry_type === 'top_up') received += amt
            else if (r.entry_type === 'refund') refunded += amt
          }
          for (const k of Object.keys(byType)) byType[k] = round(byType[k])
          return res.json({ success: true, from, byType, charged: round(charged), received: round(received), refunded: round(refunded) })
        }
        const since = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.since || ''))
          ? req.query.since : new Date().toISOString().slice(0, 10)
        // recent=N lets the Wallet tab pull a longer feed than the dashboard.
        const recentLimit = Math.min(Math.max(parseInt(req.query.recent, 10) || 12, 1), 200)
        const [recent, todays, balances, custRows] = await Promise.all([
          db.select('ledger', `select=*,customers(first_name,last_name)&order=created_at.desc&limit=${recentLimit}`),
          db.select('ledger', `select=amount&created_at=gte.${since}`),
          db.select('customer_balances', ''),
          db.select('customers', 'select=id,legacy_id,first_name,last_name'),
        ])
        const names = new Map(custRows.map(c => [c.id, `${c.first_name || ''} ${c.last_name || ''}`.trim()]))
        const appIds = new Map(custRows.map(c => [c.id, c.legacy_id]))
        const balanceRow = b => ({
          customerId: appIds.get(b.customer_id) || null, // app id — deep-link
          customerName: names.get(b.customer_id) || '?',
          balance: Number(b.balance),
        })
        const arrears = balances.filter(b => Number(b.balance) < 0)
          .map(balanceRow).sort((a, b) => a.balance - b.balance)
        const credits = balances.filter(b => Number(b.balance) > 0)
          .map(balanceRow).sort((a, b) => b.balance - a.balance)
        return res.json({
          success: true,
          recent: recent.map(r => ({
            ...toAppEntry(r),
            customerId: appIds.get(r.customer_id) || null,
            customerName: names.get(r.customer_id) || '',
          })),
          arrears,
          credits,
          creditsTotal: credits.reduce((s, a) => s + a.balance, 0),
          arrearsTotal: arrears.reduce((s, a) => s + a.balance, 0),
          todayIn: todays.filter(r => Number(r.amount) > 0).reduce((s, r) => s + Number(r.amount), 0),
          todayOut: todays.filter(r => Number(r.amount) < 0).reduce((s, r) => s + Number(r.amount), 0),
        })
      }
      // A customer's statement is money data — gate it to wallet/customers.
      if (!(await canTouchWallet(req.staff))) {
        return res.status(403).json({ success: false, error: 'Not permitted to view wallets.' })
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
      // Authorization: manual adjustments (arbitrary sign — the debt-wipe /
      // self-credit vector) are ADMIN-ONLY; payments/top-ups/refunds need the
      // wallet or customers tab. Previously the POST had no gate at all.
      if (b.kind === 'adjustment') {
        if (requireOwner(req, res)) return
      } else if (!(await canTouchWallet(req.staff))) {
        return res.status(403).json({ success: false, error: 'Not permitted to record wallet money.' })
      }
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
        created_by: req.staff?.id || null, // #46 — who moved the money
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
