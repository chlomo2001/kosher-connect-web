// Pure money primitives — no DB, no globals, no side effects, so they can be
// unit-tested in isolation (test/money.test.js) and shared between the server
// and, over time, the client. This is the "carve the money logic into small
// tested modules" step: the regression net that must exist before we touch
// any money code (SIM ledger port, VN month-fix, cash-up fix).
//
// Wired into live code TODAY: serviceOrderTotal (pages/api/service-orders.js).
// Canonical spec for upcoming steps (tests lock the contract now; the live
// call sites adopt them in their step): advanceOneMonth (VN month-fix, step 8),
// cashExpected (Z-report fix, step 8), ledgerSignFor (SIM port, step 6).

// ---- tier pricing: "first N-1 at single price, from the Nth at repeat" ----
// e.g. online services "first / 4 or more": qty 6 = 3×single + 3×repeat.
// repeat == null/undefined → every unit at the single price.
export function serviceOrderTotal(single, repeat, qty, repeatFrom) {
  const n = Math.max(1, Math.floor(Number(qty)) || 1)
  const s = Number(single) || 0
  const rep = (repeat === null || repeat === undefined) ? s : Number(repeat)
  const from = Math.max(2, Number(repeatFrom) || 4)
  const atSingle = Math.min(n, from - 1)
  const total = atSingle * s + (n - atSingle) * rep
  return { qty: n, total: Math.round(total * 100) / 100 }
}

// ---- multi-item discount thresholds (settings-driven "starts at Nth") ----
// Phones count the OTHER concurrent rentals, so this one is the Nth phone.
export function phoneDiscountApplies(concurrentOthers, fromN) {
  const from = Math.max(2, Number(fromN) || 3)
  return (Number(concurrentOthers) || 0) + 1 >= from
}
export function simDiscountApplies(activeCount, fromN) {
  const from = Math.max(2, Number(fromN) || 3)
  return (Number(activeCount) || 0) >= from
}

// ---- recurring billing: advance one month, clamped to the month end ----
// Fixes the sweep's setUTCMonth overflow: 2026-01-31 must become 2026-02-28,
// NOT roll forward to March and skip February forever.
export function advanceOneMonth(dateStr) {
  const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return dateStr
  let year = +m[1]
  let month = +m[2] // 1-12
  const day = +m[3]
  month += 1
  if (month > 12) { month = 1; year += 1 }
  // Date.UTC month is 0-based, so (year, month, 0) is the last day of the
  // 1-based `month` — the natural month-end clamp.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const clampedDay = Math.min(day, lastDay)
  const p = (v) => String(v).padStart(2, '0')
  return `${year}-${p(month)}-${p(clampedDay)}`
}

// ---- cash-up: expected cash in the drawer ----
// Nets every CASH-method ledger entry BY SIGN and adds the opening float —
// so a cash refund/payout reduces the expected total (the current live
// summarize counts only positives and has no float, so the till can never
// reconcile). Step 8 wires cash-up to this.
export function cashExpected(entries, openingFloat = 0) {
  let cash = Number(openingFloat) || 0
  for (const e of (entries || [])) {
    if (e && e.method === 'cash') cash += Number(e.amount) || 0
  }
  return Math.round(cash * 100) / 100
}

// ---- ledger sign invariant (mirrors the DB CHECK) ----
// The append-only ledger enforces the sign of each entry type at the DB
// level. This mirror lets writers assert their sign before insert and lets
// tests lock the classification the SIM port (step 6) must honour.
const LEDGER_DEBIT = new Set([
  'rental', 'rental_loss', 'sim_annual', 'sim_additional', 'sim_replacement',
  'sim_service', 'repair', 'online_service', 'booking', 'phone_sale',
  'stock_sale', 'virtual_number',
])
const LEDGER_CREDIT = new Set(['top_up', 'payment', 'refund', 'rental_void'])
export function ledgerSignFor(entryType) {
  if (LEDGER_DEBIT.has(entryType)) return 'debit'   // amount must be < 0
  if (LEDGER_CREDIT.has(entryType)) return 'credit' // amount must be > 0
  return 'either' // manual_adjustment, extra_charge — DB CHECK allows any sign
}

// Round to pennies — the one place money rounding lives.
export const money = (v) => Math.round((Number(v) || 0) * 100) / 100
