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
// No repeat tier (null/undefined/''/non-numeric) → every unit at the single
// price. An EXPLICIT numeric 0 is a real tier: "buy N, extras free". The empty
// string is "the form left the repeat price blank", NOT a free tier — treating
// Number('')===0 as free was the trap.
export function serviceOrderTotal(single, repeat, qty, repeatFrom) {
  const n = Math.max(1, Math.floor(Number(qty)) || 1)
  const s = Number(single) || 0
  const repNum = Number(repeat)
  const hasRepeat = repeat !== null && repeat !== undefined && repeat !== '' && Number.isFinite(repNum)
  const rep = hasRepeat ? repNum : s
  const from = Math.max(2, Number(repeatFrom) || 4)
  const atSingle = Math.min(n, from - 1)
  const total = atSingle * s + (n - atSingle) * rep
  return { qty: n, total: money(total) }
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
export function advanceOneMonth(dateStr, anchorDay) {
  const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return dateStr
  let year = +m[1]
  let month = +m[2] // 1-12
  // Clamp an IMMUTABLE anchor day (e.g. 31 = "last day of the month"), not the
  // previously-clamped date. Re-using the clamped date is what made a month-end
  // subscription drift earlier forever (31 Jan -> 28 Feb -> stuck on the 28th);
  // anchoring on 31 lets it recover to the 31st in the next long month. audit C15.
  const anchor = Number(anchorDay)
  const day = (Number.isFinite(anchor) && anchor >= 1 && anchor <= 31) ? anchor : +m[3]
  month += 1
  if (month > 12) { month = 1; year += 1 }
  // Date.UTC month is 0-based, so (year, month, 0) is the last day of the
  // 1-based `month` — the natural month-end clamp.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const clampedDay = Math.min(day, lastDay)
  const p = (v) => String(v).padStart(2, '0')
  return `${year}-${p(month)}-${p(clampedDay)}`
}

// ---- SIM renewal roll-forward ----
// Advance a lapsed renewal date month-by-month until it reaches `floorStr`
// (today minus a grace window). Bounded: a date years in the past must not
// loop unbounded in a cron — cap at 24 steps, same ceiling as VN catch-up
// billing. Non-date input comes back unchanged, like advanceOneMonth.
export function advancePastDate(dateStr, floorStr, maxSteps = 24) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(dateStr))) return dateStr
  const anchor = +String(dateStr).slice(8, 10)
  let d = String(dateStr).slice(0, 10)
  for (let i = 0; i < maxSteps && d < floorStr; i++) d = advanceOneMonth(d, anchor)
  return d
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
  return money(cash)
}

// ---- ledger sign invariant (mirrors the DB CHECK) ----
// The append-only ledger enforces the sign of each entry type at the DB
// level. This mirror lets writers assert their sign before insert and lets
// tests lock the classification the SIM port (step 6) must honour.
const LEDGER_DEBIT = new Set([
  'rental', 'rental_loss', 'sim_annual', 'sim_additional', 'sim_replacement',
  'sim_service', 'sim_charge', 'repair', 'online_service', 'booking',
  'phone_sale', 'stock_sale', 'virtual_number', 'extra_charge',
])
const LEDGER_CREDIT = new Set(['top_up', 'payment', 'refund', 'rental_void'])
export function ledgerSignFor(entryType) {
  if (LEDGER_DEBIT.has(entryType)) return 'debit'   // amount must be < 0
  if (LEDGER_CREDIT.has(entryType)) return 'credit' // amount must be > 0
  return 'either' // rental_adjustment, manual_adjustment — DB CHECK allows any sign
}

// ---- shop sale settlement: how a basket's total is split across wallet credit
// and money-in ----
// `preBasketBalance` is the customer's wallet balance BEFORE this basket's
// charges are posted (positive = they hold credit). Wallet credit is capped at
// what they actually hold; any agreed wallet split beyond that stays on account
// as a shortfall (never booked as credit they don't have). paidNow is what
// physically moves at the till now = total − the agreed wallet split (NOT minus
// the applied amount, so an over-agreed split doesn't silently shrink the
// payment). Walk-ins never draw wallet credit. Pure — unit-tested in money.test.
export function settleSale({ grandTotal, walletRequested, preBasketBalance, paidNow, isWalkin }) {
  const gt = money(grandTotal)
  const requestedWallet = isWalkin ? 0 : Math.min(Math.max(money(walletRequested), 0), gt)
  const creditAvailable = Math.max(0, money(preBasketBalance))
  const walletApplied = Math.min(requestedWallet, creditAvailable)
  const walletShortfall = money(requestedWallet - walletApplied)
  const paidNowAmount = paidNow ? money(gt - requestedWallet) : 0
  return { requestedWallet, walletApplied, walletShortfall, paidNowAmount }
}

// Round to pennies — the one place money rounding lives. Rounds half AWAY from
// zero (so a refund of -x rounds like a charge of x), with a tiny epsilon to
// defeat IEEE-754 representation error at the half-penny boundary: 1.005*100 is
// stored as 100.4999999…, so a naive Math.round gives 1.00 instead of 1.01, and
// the direction would flip unpredictably per value. See test/money.test.mjs.
export const money = (v) => {
  const n = Number(v) || 0
  return (n < 0 ? -1 : 1) * Math.round(Math.abs(n) * 100 + 1e-7) / 100
}
