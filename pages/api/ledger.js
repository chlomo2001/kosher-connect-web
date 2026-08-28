// Wallet ledger — read a customer's statement/balance and record money-in.
//
// Money model:
//   - the ledger is append-only; the DB enforces sign per entry_type and
//     idempotency via charge_reference unique
//   - balance is never stored: customer_balances view (sum of amounts)
//   - money-in kinds here: payment (settling arrears), top_up (credit in
//     advance), refund (credit back to the customer's wallet — we owe them),
//     adjustment (owner correction, either sign, never zero)
//   - money-out: refund_payout (that credit actually handed back). The pair is
//     what makes a refund we still owe distinguishable from one we've settled.
// Charges are posted only by their owning features (bookings, repairs, …),
// each with a stable reference — never from this endpoint.

import { withStaff, tabAllowedFor, requireOwner } from '../../lib/auth.js'
import { db, tablesMode, STORAGE_ERROR } from '../../lib/db.js'
import { londonDate, londonDayStartUtc } from '../../lib/localDay.mjs'

// Wallet actions are reachable from the Wallet tab AND the customer card,
// so either tab permits them (owners always pass).
async function canTouchWallet(staff) {
  return (await tabAllowedFor(staff, 'wallet')) || (await tabAllowedFor(staff, 'customers'))
}

// The ledger's beginning, for all-time aggregates. The first entry is Feb 2025;
// this is deliberately earlier than any row can be rather than a lookup, so the
// figure cannot quietly start at whatever the oldest surviving row happens to be
// after a tidy-up.
const EPOCH = '1970-01-01T00:00:00Z'

const KINDS = {
  payment:       { entry_type: 'payment',           prefix: 'PAY' },
  top_up:        { entry_type: 'top_up',            prefix: 'TOPUP' },
  refund:        { entry_type: 'refund',            prefix: 'REFUND' },
  refund_payout: { entry_type: 'refund_payout',     prefix: 'RFDOUT' },
  adjustment:    { entry_type: 'manual_adjustment', prefix: 'ADJ' },
}
const METHODS = ['cash', 'card', 'bank_transfer', 'voucher', 'wallet', 'other']
// 'wallet' is not a way to pay a refund out: the wallet credit IS the thing
// being settled, so tendering it against itself would book the payout twice.
const PAYOUT_METHODS = METHODS.filter((m) => m !== 'wallet')
// The one kind here that moves money OUT. The caller sends how much is going
// back as a positive figure (same as a payment); the sign is applied server-side
// so no screen can mint a credit by flipping it.
const MONEY_OUT = 'refund_payout'
// Kinds that pass through the till drawer and so carry a tender method.
const TENDERED = ['payment', 'top_up', MONEY_OUT]

// A client idempotency token (uuid-ish) folds into a stable charge_reference so a
// retried / double-submitted money-in POST collapses to one row via the ledger's
// unique charge_reference. Loose length/charset guard — used only as a reference.
const validRef = (v) => (typeof v === 'string' && /^[\w-]{8,64}$/.test(v)) ? v : null

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
        // The shape of the last N days, for the dashboard's trend line. Kept
        // beside the report because it reads the same ledger with the same
        // split — the sparkline under a figure has to be that figure's own
        // history, not a second definition of "money in".
        if (req.query.series) {
          const days = Math.min(120, Math.max(2, parseInt(req.query.series, 10) || 30))
          const to = londonDate()
          const from = londonDate(-(days - 1))   // londonDate takes an offset in DAYS
          const rows = await db.rpc('ledger_daily_series', { p_from: from, p_to: to })
          const round = (v) => Math.round((Number(v) || 0) * 100) / 100
          return res.json({
            success: true, from, to,
            days: (rows || []).map(r => ({
              day: r.day,
              charged: round(r.charged),
              received: round(r.received),
            })),
          })
        }
        // Who was served in a window, derived from the same ledger as the
        // money above it — so the two can never disagree. Definitions live in
        // the migration, because each is a choice: "served" is a CHARGE in the
        // period (paying off an old debt is not being served again), and "new"
        // is a first-ever charge, not a record created date — a row imported
        // from a spreadsheet years ago is not a new customer the day someone
        // finally bills it.
        if (req.query.customers) {
          const ok = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''))
          const from = ok(req.query.from) ? req.query.from : londonDate(-29)
          const to = ok(req.query.to) ? req.query.to : londonDate()
          const rows = await db.rpc('ledger_customer_stats', { p_from: from, p_to: to })
          const r = (rows && rows[0]) || {}
          const round = (v) => Math.round((Number(v) || 0) * 100) / 100
          const served = Number(r.served) || 0
          let topName = null
          if (r.top_customer_id) {
            const c = await db.select('customers',
              `select=first_name,last_name&id=eq.${encodeURIComponent(String(r.top_customer_id))}&limit=1`).catch(() => [])
            if (c[0]) topName = `${c[0].first_name || ''} ${c[0].last_name || ''}`.trim()
          }
          return res.json({
            success: true, from, to,
            served,
            newCustomers: Number(r.new_customers) || 0,
            returningCustomers: Number(r.returning_customers) || 0,
            totalCharged: round(r.total_charged),
            averageSpend: served ? round(Number(r.total_charged) / served) : 0,
            topCustomer: topName,
            topCustomerCharged: round(r.top_customer_charged),
          })
        }
        if (req.query.report) {
          const from = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.from || ''))
            ? req.query.from : londonDate()
          // Aggregate in the DB (grouped by entry_type), anchored to London
          // midnight. Summing raw rows client-side truncated at PostgREST's
          // 1000-row cap — the report silently under-counted once the ledger grew
          // past it. ledger_revenue_since returns one row per type, never capped.
          const rows = await db.rpc('ledger_revenue_since', { p_from: londonDayStartUtc(from) })
          const round = (v) => Math.round(v * 100) / 100
          const byType = {}
          // `refunded` is credit ISSUED to wallets, `paidOut` is money actually
          // returned. The gap between them is what the shop still owes back —
          // before the payout leg existed the two were the same number, so a
          // settled refund and an owed one read identically.
          let charged = 0, received = 0, refunded = 0, paidOut = 0
          for (const r of (rows || [])) {
            const c = Number(r.charged) || 0
            if (c > 0) byType[r.entry_type] = round((byType[r.entry_type] || 0) + c)
            charged += c
            received += Number(r.received) || 0
            refunded += Number(r.refunded) || 0
            paidOut += Number(r.paid_out) || 0
          }
          return res.json({
            success: true, from, byType,
            charged: round(charged), received: round(received),
            refunded: round(refunded), paidOut: round(paidOut),
            refundsOwed: round(refunded - paidOut),
          })
        }
        const since = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.since || ''))
          ? req.query.since : londonDate()
        // recent=N lets the Wallet tab pull a longer feed than the dashboard.
        const recentLimit = Math.min(Math.max(parseInt(req.query.recent, 10) || 12, 1), 200)
        // How many debtors/creditors to LIST (the totals below are exact via the
        // aggregate regardless). 500 covers every realistic debtor set; a bigger
        // one caps the visible list, never the money figures.
        const LIST_CAP = 500
        const sinceUtc = londonDayStartUtc(since)
        // Same weekday LAST WEEK, midnight to this time of day. Comparing
        // "today so far" against a whole previous day is not a comparison —
        // at 10am it would always look like a collapse. And last week rather
        // than yesterday because a shop's week has a shape: a Sunday is only
        // ever comparable to a Sunday.
        const elapsedMs = Date.now() - Date.parse(sinceUtc)
        const lastWeekStartUtc = new Date(Date.parse(sinceUtc) - 7 * 86400000).toISOString()
        const lastWeekToUtc = new Date(Date.parse(lastWeekStartUtc) + elapsedMs).toISOString()
        // Month to date, for the target line.
        const monthStartUtc = londonDayStartUtc(since.slice(0, 8) + '01')
        const [recent, flowRows, totalsRows, arrearsRows, creditRows, lastWeekRows, monthRows,
          allTimeRows] = await Promise.all([
          // Names/app-ids ride along on each row's embed, so no whole-table
          // customers read is needed (752 rows and climbing toward the 1000 cap).
          db.select('ledger', `select=*,customers(legacy_id,first_name,last_name)&order=created_at.desc&limit=${recentLimit}`),
          db.rpc('ledger_day_flow', { p_from: sinceUtc }),
          db.rpc('wallet_totals', {}),
          db.select('customer_balances', `select=customer_id,balance&balance=lt.0&order=balance.asc&limit=${LIST_CAP}`),
          db.select('customer_balances', `select=customer_id,balance&balance=gt.0&order=balance.desc&limit=${LIST_CAP}`),
          db.rpc('ledger_flow_between', { p_from: lastWeekStartUtc, p_to: lastWeekToUtc }),
          db.rpc('ledger_flow_between', { p_from: monthStartUtc, p_to: new Date().toISOString() }),
          // Everything ever received. Aggregated in the DB by entry_type, so it
          // is exact however big the ledger gets — summing rows client-side is
          // what truncated the revenue report at PostgREST's 1000-row cap once.
          db.rpc('ledger_revenue_since', { p_from: EPOCH }),
        ])
        const flow = (flowRows && flowRows[0]) || { money_in: 0, money_out: 0 }
        const totals = (totalsRows && totalsRows[0]) || { owed: 0, credit: 0 }
        // Names for just the debtors/creditors being listed — a bounded id-set
        // read, not the whole customers table.
        const idSet = [...new Set([...arrearsRows, ...creditRows].map(b => b.customer_id))]
        const custRows = idSet.length
          ? await db.select('customers', `select=id,legacy_id,first_name,last_name&id=in.(${idSet.map(encodeURIComponent).join(',')})`)
          : []
        const names = new Map(custRows.map(c => [c.id, `${c.first_name || ''} ${c.last_name || ''}`.trim()]))
        const appIds = new Map(custRows.map(c => [c.id, c.legacy_id]))
        const balanceRow = b => ({
          customerId: appIds.get(b.customer_id) || null, // app id — deep-link
          customerName: names.get(b.customer_id) || '?',
          balance: Number(b.balance),
        })
        const arrears = arrearsRows.map(balanceRow) // already balance.asc (worst first)
        const credits = creditRows.map(balanceRow)  // already balance.desc (biggest first)
        return res.json({
          success: true,
          recent: recent.map(r => ({
            ...toAppEntry(r),
            customerId: r.customers?.legacy_id ?? null,
            customerName: r.customers ? `${r.customers.first_name || ''} ${r.customers.last_name || ''}`.trim() : '',
          })),
          arrears,
          credits,
          // Totals from the DB aggregate — exact no matter how many rows exist.
          creditsTotal: Number(totals.credit) || 0,
          // MAGNITUDE, not the signed sum (clarity-scan Tier 1 #5; owner said
          // rename, 23 Aug). totals.owed is negative — balances in arrears —
          // and every consumer was quietly abs'ing it; a new one printing it
          // raw would show '−£350 owed', and a `> threshold` check would never
          // fire. The sign convention stays in the rows; the headline is a size.
          arrearsTotal: Math.abs(Number(totals.owed) || 0),
          todayIn: Number(flow.money_in) || 0,
          todayOut: Number(flow.money_out) || 0,
          // Same weekday last week to this time of day, and the month so far.
          lastWeekIn: Number((lastWeekRows && lastWeekRows[0]?.money_in) || 0),
          monthIn: Number((monthRows && monthRows[0]?.money_in) || 0),
          // Money the shop has actually taken, ever — payments and top-ups, the
          // same definition `received` carries everywhere else in this file. The
          // Customers tab headlines it; before this it summed `amountPaid` over
          // the rentals array and showed 0.4% of the business under a heading
          // saying "All time" (owner's screenshot, 28 Aug: £410.40 against
          // £92,129.10). NOT netted against refund_payout — that is money out
          // and has its own line; netting the two would make one number answer
          // two questions, which is the fault this repo has paid for before.
          receivedAllTime: Math.round((allTimeRows || [])
            .reduce((sum, r) => sum + (Number(r.received) || 0), 0) * 100) / 100,
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
      // Authorization: any positive credit NOT backed by money coming in is the
      // debt-wipe / self-credit vector — a helper could mint wallet credit and
      // convert it to goods at the till. So adjustment (arbitrary sign), refund
      // and top_up (unbacked credits) are ADMIN-ONLY. Only 'payment' — which
      // records real money received and requires a method — stays open to the
      // wallet/customers tab. Previously only 'adjustment' was gated.
      // …and refund_payout is money leaving the business, which is at least as
      // sensitive as minting credit — owner-only too.
      if (['adjustment', 'refund', 'top_up', MONEY_OUT].includes(b.kind)) {
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
      // Same ceiling as charge-card and portal/pay (sweep 2026-08-02 #3): this
      // was the one money-in path with no upper bound, and a fat-fingered credit
      // is spendable as goods at the till. Genuine larger amounts get split.
      if (Math.abs(amount) > 5000) {
        return res.status(400).json({ success: false, error: 'Single entries are capped at £5,000 — record larger amounts as two entries.' })
      }
      // Every kind takes a positive figure; only this one is stored negative.
      const signed = b.kind === MONEY_OUT ? -amount : amount
      // A method (till tender) only makes sense for money that moves through the
      // drawer — payment/top_up, and now a payout going the other way. Forcing it
      // null for refund/adjustment stops a stale 'cash' method from inflating the
      // Z-report's expected cash.
      const allowedMethods = b.kind === MONEY_OUT ? PAYOUT_METHODS : METHODS
      const method = (TENDERED.includes(b.kind) && b.method && allowedMethods.includes(b.method))
        ? b.method : null
      // A payout needs its tender for the same reason a payment does: cash-up
      // nets cash-method rows by sign, so an untagged cash refund would leave the
      // drawer short with nothing to explain it.
      if (['payment', MONEY_OUT].includes(b.kind) && !method) {
        return res.status(400).json({ success: false, error: `Method must be one of: ${allowedMethods.join(', ')}.` })
      }
      const uuid = await resolveCustomer(b.customerId)
      if (!uuid) return res.status(400).json({ success: false, error: `Customer ${b.customerId} not found.` })

      // Idempotent write: a client token yields a stable reference; a replay/retry
      // hits the unique charge_reference and is ignored, then we return the row that
      // already exists — never a second credit/debit for one action. The token is
      // REQUIRED (sweep 2026-08-02 #1): minting a fresh UUID per call meant a
      // retry-after-timeout posted the same £50 twice, because the unique index
      // never saw the same reference. The Stripe paths already insist on it.
      const token = validRef(b.clientRef)
      if (!token) {
        return res.status(400).json({ success: false, error: 'Missing idempotency token — refresh and try again.' })
      }
      const chargeRef = `${kind.prefix}-${token}`
      const inserted = await db.insertIgnoreDup('ledger', [{
        customer_id: uuid,
        charge_reference: chargeRef,
        entry_type: kind.entry_type,
        amount: signed,
        method,
        description: b.note || null,
        created_by: req.staff?.id || null, // #46 — who moved the money
      }], 'charge_reference')
      let row = inserted && inserted[0]
      if (!row) {
        // Duplicate submit — the entry already exists; return it idempotently.
        const existing = await db.select('ledger', `charge_reference=eq.${encodeURIComponent(chargeRef)}&limit=1`)
        row = existing[0]
      }
      if (!row) return res.status(500).json({ success: false, error: STORAGE_ERROR })

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
    return res.status(500).json({ success: false, error: STORAGE_ERROR })
  }
}

export default withStaff(handler)
