// The rental receipt's facts, worked out once. Pure — no I/O.
//
// Owner, 20 Aug, on the receipt a customer got for a US phone: "it should of
// been written their full name, longer language, sim number (i mean the phone
// number they rented), exact dates 'from' and 'to', if he paid; how they paid,
// if not, please pay till (7 days? or the due date of phone return?), and a
// generated link to pay."
//
// The receipt that existed said what it cost and, on a rental left on account,
// nothing whatever about owing it — no date, no amount outstanding, no way to
// pay. This module answers the two questions that are policy rather than
// markup: by when, and how much is still owed.

/**
 * The day the money is due.
 *
 * THE RETURN DATE, because that is the day the customer is at the counter
 * anyway and it needs no separate chase — with a floor so a two-day rental
 * does not demand payment the day after tomorrow. The floor is a setting
 * (`rental_pay_days`, 7 by default) and not a constant here: it is a term of
 * business, and BUSINESS_RULES.md is where the shop keeps those.
 *
 * Dates are ISO days ('2026-08-26'), compared as strings — they sort
 * correctly, and no timezone can move one across midnight on the way.
 */
export function rentalPayBy(returnISO, todayISO, floorDays = 7) {
  const today = String(todayISO || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return null
  const days = Math.min(90, Math.max(0, Math.round(Number(floorDays) || 0)))
  const floor = addDays(today, days)
  const ret = String(returnISO || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ret)) return floor
  return ret > floor ? ret : floor
}

/** ISO day + n days, via UTC so no local clock shifts it. */
function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number)
  const t = Date.UTC(y, m - 1, d) + n * 86400000
  const out = new Date(t)
  const p = (v) => String(v).padStart(2, '0')
  return `${out.getUTCFullYear()}-${p(out.getUTCMonth() + 1)}-${p(out.getUTCDate())}`
}

/**
 * What the receipt has to say about money.
 *
 * `paidAmount` is what was taken at the counter, which may be part of the
 * total. Three states, and the middle one is the one the old receipt could not
 * express at all:
 *   'paid'    settled in full — say how
 *   'part'    some taken, a balance left — say how much, and by when
 *   'unpaid'  nothing taken — the whole total, and by when
 */
export function rentalPayState(total, paidAmount) {
  const t = round2(total)
  const p = Math.max(0, round2(paidAmount))
  if (!(t > 0)) return { state: 'paid', owed: 0 }
  if (p >= t) return { state: 'paid', owed: 0 }
  if (p > 0) return { state: 'part', owed: round2(t - p) }
  return { state: 'unpaid', owed: t }
}

const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100
