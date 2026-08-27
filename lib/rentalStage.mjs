// Where a hire has got to — and when the shop needs to care.
//
// Shloime, 27 August: "at each rental there should be (if not yet..)
// 'reserved'/booked state, fetched, and then active, non active and returned.
// and at each stage - even only reserved - shall be recorded on customers card.
// so that even when fetched from shop, it shouldnt raise a task or flag that
// the customer is stuck cuz its not activated in a pool etc., as theyre not yet
// flown. only when the date for that reservation comes, 24hr before it should
// be raised - color plus task -."
//
// The missing state is FETCHED: the handset has left the shop and the trip has
// not started. getComputedStatus had no room for it —
//
//   if (r.status !== 'returned') return r.toDate < today ? 'overdue' : 'active'
//
// — so the moment a phone was collected the hire read Active, whether the
// customer was flying tomorrow or in three weeks. Everything watching active
// rentals then started asking why the line was not live: a pool that has not
// been activated is not a problem on a phone sitting on somebody's kitchen
// table, and a task saying it is trains people to ignore tasks.
//
// TWO DATES, and keeping them apart is the whole idea. `fromDate` is when the
// customer travels. `pickupDate` is when they walked out with it. They are the
// same day most of the time and the interesting cases are when they are not.
//
// This does NOT touch what anything costs. "Start rental" re-prices from the
// real pickup — a deliberate rule with a confirm of its own — and stays exactly
// as it is. What changes is only what the shop is ASKED about, and when.

/** How long before travel the line has to be ready. Shloime's 24 hours. */
export const READY_LEAD_DAYS = 1

const dayBefore = (iso, days) => {
  if (!iso) return null
  const t = Date.parse(`${iso}T00:00:00Z`)
  return Number.isFinite(t) ? new Date(t - days * 86400000).toISOString().slice(0, 10) : null
}

/**
 * @param {object} r      the rental: { status, fromDate, toDate, pickupDate }
 * @param {string} today  'YYYY-MM-DD'
 * @param {boolean} incomplete  whether a returned hire is missing kit
 *
 * 'reserved'  booked, still in the shop
 * 'fetched'   collected, not travelling yet — quiet on purpose
 * 'active'    the trip is running
 * 'overdue'   past its return date and still out
 * 'returned' / 'returned_incomplete'
 */
export function rentalStage(r, today, incomplete = false) {
  if (!r) return 'reserved'
  if (r.status === 'returned') return incomplete ? 'returned_incomplete' : 'returned'
  const from = r.fromDate || null
  const to = r.toDate || null
  if (to && to < today) return 'overdue'
  if (from && from > today) return r.pickupDate ? 'fetched' : 'reserved'
  // No dates at all is not a reservation and not a trip; treat a booked record
  // as booked and anything else as running, which is what it was before.
  if (r.status === 'booked' && !r.pickupDate) return 'reserved'
  return 'active'
}

/**
 * Should the shop be chasing whether this line is actually live?
 *
 * True once the trip is running, and from 24 hours before it starts. False for
 * a phone that is reserved, or collected early and not travelling yet — which
 * is the flag Shloime asked to have taken off his back.
 */
export function readinessDue(r, today) {
  const stage = rentalStage(r, today)
  if (stage === 'active' || stage === 'overdue') return true
  if (stage !== 'fetched') return false
  const due = dayBefore(r.fromDate, READY_LEAD_DAYS)
  return !!due && today >= due
}

/** The day the shop should start caring, or null. */
export const readyFrom = (r) => dayBefore(r?.fromDate, READY_LEAD_DAYS)

/** What a person reads, and how loudly. */
export function stageLabel(stage) {
  return {
    reserved: 'Reserved',
    fetched: 'Collected — not travelling yet',
    active: 'Active',
    overdue: 'Overdue',
    returned: 'Closed',
    returned_incomplete: 'Returned — kit unaccounted for',
  }[stage] || stage
}

/** 'quiet' says it on the screen without asking for anything. */
export function stageTone(stage, ready = false) {
  if (stage === 'overdue') return 'danger'
  if (stage === 'returned_incomplete') return 'warning'
  if (stage === 'fetched') return ready ? 'warning' : 'quiet'
  if (stage === 'reserved') return 'quiet'
  return 'normal'
}

/** Every stage the customer's card should show a rental at — which is all of them. */
export const ON_CUSTOMER_CARD = ['reserved', 'fetched', 'active', 'overdue']
