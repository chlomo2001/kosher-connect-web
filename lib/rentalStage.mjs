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
// The other missing state is the far end, which Shloime called "non active":
// "the person is back, but hasnt retuned the phone/sim, so the line doesnt have
// to be actively running, but still its not available yet until physically
// back". The day after the travel dates ended, the app called that OVERDUE and
// raised a red task — for a customer who had landed the night before and would
// drop the phone in on his way past. So ENDED sits between active and overdue:
// the hire has stopped running, the handset is still out, and nobody is being
// chased about it yet. It hardens into 'overdue' once it has been sitting past
// its dates longer than the shop's patience (Settings, RETURN_GRACE_DAYS here
// being the fallback).
//
// This does NOT touch what anything costs. The charge runs from `fromDate` —
// the travel date the hire was quoted on — whatever day the customer actually
// walks in for it (Shloime, 27 August: "charge should only start from travel
// date, not pickup"). What changes here is only what the shop is ASKED about,
// and when.

/** How long before travel the line has to be ready. Shloime's 24 hours. */
export const READY_LEAD_DAYS = 1

/**
 * Days past the return date before a hire is LATE — chased as overdue, and
 * charged a late fee. The owner-editable value is `rental_return_grace_days`;
 * this is the fallback and MUST match the migration that seeds it.
 *
 * Seven, from 28 Aug. Owner: "due date is always a day after arrival - end of
 * rental, (and come up as task, amber bla bla) but late fees only once past
 * 7 days." One number does both halves of that:
 *
 *   the day after toDate    the phone is DUE BACK. Stage 'ended', amber, and
 *                           the sweep raises a task. Nothing is charged.
 *   after this many days    stage 'overdue', red, and the late fee starts
 *                           counting — from here, not from day one, so the
 *                           first week back is never billed.
 */
export const RETURN_GRACE_DAYS = 7

/**
 * The day a phone is due back: the day AFTER the last day of the hire.
 * `toDate` is inclusive — the customer has the phone that day — so a hire
 * ending on the 20th is not late on the 20th.
 */
export function dueBackDate(toDate) {
  if (!toDate) return null
  const t = Date.parse(`${toDate}T00:00:00Z`)
  return Number.isFinite(t) ? new Date(t + 86400000).toISOString().slice(0, 10) : null
}

/**
 * The first day a late fee may be charged, or null when there is no return
 * date. Everything before it is free — the shop chases, it does not bill.
 */
export function lateFeeFrom(toDate, graceDays = RETURN_GRACE_DAYS) {
  if (!toDate) return null
  const grace = Number.isFinite(graceDays) ? Math.max(0, graceDays) : RETURN_GRACE_DAYS
  const t = Date.parse(`${toDate}T00:00:00Z`)
  return Number.isFinite(t) ? new Date(t + (grace + 1) * 86400000).toISOString().slice(0, 10) : null
}

const dayBefore = (iso, days) => {
  if (!iso) return null
  const t = Date.parse(`${iso}T00:00:00Z`)
  return Number.isFinite(t) ? new Date(t - days * 86400000).toISOString().slice(0, 10) : null
}

const daysPast = (iso, today) => {
  const a = Date.parse(`${iso}T00:00:00Z`)
  const b = Date.parse(`${today}T00:00:00Z`)
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 86400000) : 0
}

/**
 * @param {object} r      the rental: { status, fromDate, toDate, pickupDate }
 * @param {string} today  'YYYY-MM-DD'
 * @param {boolean} incomplete  whether a returned hire is missing kit
 *
 * @param {number} graceDays  days past the return date before it counts as late
 *
 * 'reserved'  booked, still in the shop
 * 'fetched'   collected, not travelling yet — quiet on purpose
 * 'active'    the trip is running
 * 'ended'     home, phone not handed back yet — also quiet on purpose
 * 'overdue'   past its return date long enough to chase
 * 'returned' / 'returned_incomplete'
 */
export function rentalStage(r, today, incomplete = false, graceDays = RETURN_GRACE_DAYS) {
  if (!r) return 'reserved'
  if (r.status === 'returned') return incomplete ? 'returned_incomplete' : 'returned'
  const from = r.fromDate || null
  const to = r.toDate || null
  if (to && to < today) {
    const grace = Number.isFinite(graceDays) ? Math.max(0, graceDays) : RETURN_GRACE_DAYS
    return daysPast(to, today) > grace ? 'overdue' : 'ended'
  }
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
 *
 * Also false once the hire has ENDED: the customer is home, so whether the pool
 * still has life in it is nobody's problem. It goes true again for a genuinely
 * overdue hire, and that is on purpose rather than an oversight — a phone still
 * out well past its dates is either late or on a trip that got extended, and if
 * it is the second one the customer is abroad on a line the shop should still
 * be watching.
 */
export function readinessDue(r, today, graceDays = RETURN_GRACE_DAYS) {
  const stage = rentalStage(r, today, false, graceDays)
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
    ended: 'Due back',
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
  // 'ended' was quiet until 28 Aug, when the owner asked for the phone to be
  // due back the day after the hire ends and to "come up as task, amber". It is
  // still not a fault and still costs the customer nothing — amber is the shop
  // being told to go and get its phone, not the customer being told off.
  if (stage === 'ended') return 'warning'
  if (stage === 'reserved') return 'quiet'
  return 'normal'
}

/** Every stage the customer's card should show a rental at — which is all of them. */
export const ON_CUSTOMER_CARD = ['reserved', 'fetched', 'active', 'ended', 'overdue']

/**
 * The handset is with a customer and is not available to hire out. Named once
 * because five screens ask this question and the last stage added had to be
 * pasted into all five; the next one should only have to land here.
 */
export const OUT_WITH_CUSTOMER = ['active', 'ended', 'overdue']
