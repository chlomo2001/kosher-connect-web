// #47 — the rental money formulas, carved out of the 7,499-line public/main.js
// into a pure, dependency-free, unit-tested module (mirrors lib/money.mjs and
// lib/mappers.js). NO DOM, NO global pricingConfig, NO network: every input is
// a parameter. This is the canonical, testable statement of the maths; the
// client keeps a thin formula that mirrors these exactly (see public/main.js
// priceFromDays / poolScore / ddSurcharge) until a bundler lets it import.

// Round half away from zero with an epsilon to defeat the IEEE-754 half-penny
// boundary (1.005*100 === 100.4999999…). Mirrors money() in lib/money.mjs — the
// two must stay identical, since rentals and shop totals share this rounding.
export const round2 = (v) => {
  const n = Number(v) || 0
  return (n < 0 ? -1 : 1) * Math.round(Math.abs(n) * 100 + 1e-7) / 100
}

// How many cap periods a rental spans (default 30-day windows): a 60-day
// rental caps at 2× the monthly cap, not 1×.
export function capPeriods(totalDays, capPeriodDays = 30) {
  return Math.max(1, Math.ceil((Number(totalDays) || 0) / (capPeriodDays || 30)))
}

// The core price for ONE cap window: chargeable days × day-rate, lifted to the
// minimum, then clamped to the cap. `rate` = { ratePerDay, minCharge, cap,
// capPeriodDays, afterCapPerDay }. cap null/undefined = uncapped.
//
// `dayRate` overrides ratePerDay for the windows after the first — see
// priceFromPeriods. The min charge is a FIRST-WINDOW idea only: it exists so a
// two-day hire is worth serving, not so that every extra month has a floor.
function priceForWindow(chargeableDays, rate, { dayRate = null, applyMin = true } = {}) {
  const cd = Number(chargeableDays) || 0
  let price = cd * (dayRate == null ? (Number(rate.ratePerDay) || 0) : Number(dayRate) || 0)
  if (applyMin && cd > 0 && price < rate.minCharge) price = Number(rate.minCharge) || 0
  if (rate.cap != null && price > Number(rate.cap)) price = Number(rate.cap)
  return price
}

/**
 * The price of a rental, window by window.
 *
 * `periods` is the chargeable-day count in each cap window, in order — the
 * split matters and cannot be derived from the totals, because where the
 * Shabbos and Yom Tov days fall decides which window loses them.
 *
 * Owner's rule, 08-17: a rental that rolls past the monthly cap does not
 * simply buy a second month at full price. The first window prices as it
 * always has — days × rate, lifted to the minimum, capped. Every window after
 * it charges `afterCapPerDay` (£2 by default, per rate row) and is capped in
 * its own right, so a long hire can never cost more than a short one.
 *
 *   USA · £3/day · min £20 · cap £50/30d · after-cap £2
 *     30 days → £50            (90 → cap)
 *     35 days → £60            £50 + 5 × £2
 *     65 days → £110           £50 + £50 (30 × £2 = £60 → cap) + 5 × £2
 *
 * A rate row with no afterCapPerDay keeps the old behaviour — every window
 * priced at the full day rate — so an unconfigured rate cannot silently
 * become cheaper.
 */
export function priceFromPeriods(periods, rate) {
  const list = Array.isArray(periods) ? periods : [Number(periods) || 0]
  if (!list.length) return 0
  const after = rate.afterCapPerDay == null ? null : Number(rate.afterCapPerDay)
  const total = list.reduce((sum, cd, i) => sum + (i === 0
    ? priceForWindow(cd, rate)
    : priceForWindow(cd, rate, { dayRate: after, applyMin: false })), 0)
  return round2(total)
}

// Count chargeable days in [fromISO, toISO] inclusive, given a predicate that
// says whether a given YYYY-MM-DD is a free (Shabbos / Yom Tov) day. Pure: the
// caller injects the calendar logic. Returns { chargeableDays, totalDays }.
export function countDays(fromISO, toISO, isFreeDay = () => false, { capPeriodDays = 30 } = {}) {
  if (!fromISO || !toISO || toISO < fromISO) return { chargeableDays: 0, totalDays: 0, periods: [] }
  const windowLen = Number(capPeriodDays) || 30
  const periods = []
  let chargeableDays = 0
  let totalDays = 0
  const cur = new Date(`${fromISO}T00:00:00`)
  const end = new Date(`${toISO}T00:00:00`)
  const p = (v) => String(v).padStart(2, '0')
  while (cur <= end) {
    // Format the LOCAL calendar day the loop is on. Round-tripping through
    // toISOString() (UTC) shifts the day back by one in any timezone ahead of UTC
    // (UK BST / Israel), so a Shabbos/Yom Tov at the range edge was queried for the
    // wrong day and mischarged; local components always match the loop. audit C10.
    const iso = `${cur.getFullYear()}-${p(cur.getMonth() + 1)}-${p(cur.getDate())}`
    // Which cap window this calendar day falls in — windows are counted in
    // CALENDAR days from the start, so a free day still uses up its place.
    const w = Math.floor(totalDays / windowLen)
    while (periods.length <= w) periods.push(0)
    totalDays++
    if (!isFreeDay(iso)) { chargeableDays++; periods[w]++ }
    cur.setDate(cur.getDate() + 1)
  }
  return { chargeableDays, totalDays, periods }
}

// A late fee = chargeable late days × per-day rate.
export function lateFeeAmount(chargeableLateDays, perDay = 1) {
  return round2((Number(chargeableLateDays) || 0) * (Number(perDay) || 0))
}

// The through-me SIM monthly direct-debit surcharge: cost + max(cost×pct, min).
export function ddSurcharge(cost, pct = 0.1, min = 2) {
  const c = Number(cost) || 0
  return round2(c + Math.max(c * (Number(pct) || 0), Number(min) || 0))
}

// A multi-item discount applies when the Nth concurrent item is reached
// (e.g. the 3rd concurrent phone gets 15% off ⇒ fromN = 3).
export function discountApplies(concurrentCount, fromN = 3) {
  return (Number(concurrentCount) || 0) >= Math.max(2, Number(fromN) || 0)
}

// Ticket-service fee for N passengers: passenger 1 = single price; 2–5 =
// repeatPrice each; 6+ = bulkPrice (falls back to repeatPrice) each. A flat
// service (repeatPrice null) charges the single price once.
export function ticketFeeFor(svc, passengers) {
  const n = Math.max(1, Math.floor(Number(passengers)) || 1)
  const single = Number(svc.price) || 0
  if (svc.repeatPrice === null || svc.repeatPrice === undefined) return round2(single)
  const upTo5 = Math.min(n - 1, 4) * Number(svc.repeatPrice)
  const from6 = Math.max(n - 5, 0) * Number(svc.bulkPrice ?? svc.repeatPrice)
  return round2(single + upTo5 + from6)
}

// USA pool optimiser score: how well a pooled line's expiry lines up with the
// return date. Higher is better. `overlap` = days the pool expires AFTER the
// return (negative = expires before return, risky).
export function poolScore(overlap, alreadyActive, { activationFee = 8 } = {}) {
  let s
  if (overlap < 0) s = -1000 + overlap * 10
  else if (overlap <= 3) s = 100 - overlap
  else s = 90 - (overlap - 3) * 1.5
  if (alreadyActive) s += activationFee
  return s
}
