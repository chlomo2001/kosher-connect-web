// Does the pool last as long as the hire?
//
// Shloime, 27 August: "it didnt make the pool expiry awareness good - even the
// rental is much longer than pool validity, it didnt flag it, it should of
// raised it. and maybe in last 7 days the rental should be red telling us that
// it needs renewal/new pool, and task."
//
// The app already knew this at one moment and then forgot it. poolPhoneSuggestions
// ranks candidate phones by how well the pool overlaps the dates and will say
// "Pool expires 4 day(s) BEFORE return — risky, service may cut out mid-trip."
// But that is advice at the moment of CHOOSING. Once the rental exists nothing
// looked again, so a hire that outlasts its pool sat in the list looking exactly
// like one that does not — until the customer rang from abroad with no service.
//
// One decision, three readers: the rentals row paints it, the sweep raises a
// task from it, and the digest groups that task. Written here so those three
// cannot drift, which is the mistake that produced the gap in the first place.
//
// Deliberately NOT a fourth opinion about dates: it takes ISO strings and
// compares them as strings, which is what the rest of this app does for
// day-precision work and is timezone-proof by construction.

/** Days from a to b, both 'YYYY-MM-DD'. Negative when b is before a. */
export function daysBetween(a, b) {
  if (!a || !b) return null
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)
  return Number.isFinite(ms) ? Math.round(ms / 86400000) : null
}

export const WARN_WITHIN_DAYS = 7

/**
 * @param {string|null} poolExpiry  'YYYY-MM-DD', the day the pool stops paying
 * @param {string|null} returnDate  'YYYY-MM-DD', the day the phone is due back
 * @param {string}      today       'YYYY-MM-DD'
 *
 * Returns one of:
 *   'unknown'   no expiry on record — we cannot say, and must not imply we can
 *   'expired'   the pool has already run out and the phone is still out
 *   'short'     the pool runs out BEFORE the phone is due back
 *   'soon'      the pool outlasts the hire, but runs out within 7 days
 *   'covered'   nothing to say
 *
 * `short` and `expired` are the ones that cost a customer their service abroad.
 * `soon` is the one that costs the shop a renewal it forgot to do.
 */
export function poolCover(poolExpiry, returnDate, today) {
  if (!poolExpiry) return 'unknown'
  if (today && poolExpiry < today) return 'expired'
  if (returnDate && poolExpiry < returnDate) return 'short'
  const left = daysBetween(today, poolExpiry)
  if (left !== null && left <= WARN_WITHIN_DAYS) return 'soon'
  return 'covered'
}

/** What a person should read. Empty for the states not worth saying. */
export function poolCoverNote(state, poolExpiry, returnDate, today) {
  switch (state) {
    case 'expired':
      return `Pool ran out ${Math.abs(daysBetween(today, poolExpiry))} day(s) ago and the phone is still out — renew it or move the line to a live pool.`
    case 'short': {
      const gap = daysBetween(poolExpiry, returnDate)
      return `Pool runs out ${gap} day(s) before this is due back — the service will cut out mid-hire unless it is renewed.`
    }
    case 'soon':
      return `Pool runs out in ${daysBetween(today, poolExpiry)} day(s) — renew it or put the line in a new pool.`
    case 'unknown':
      return 'No pool expiry on record — nobody can say whether this hire is covered.'
    default:
      return ''
  }
}

/** Only the states that should interrupt somebody. */
export const poolCoverNeedsAction = (state) => state === 'expired' || state === 'short' || state === 'soon'

/**
 * What the BADGE says — the short version, and it carries the numbers.
 *
 * Owner, 28 Aug: "rentals, pool ends first isnt enough. need to say 7 days etc.
 * with dates."
 *
 * Right, and the reason is worse than terseness. "Pool ends first" is true of a
 * pool ending one day early and of one ending three weeks early, and those are
 * not the same problem: the first is a phone call, the second is a hire that
 * should not have been taken on that line. The count and the date were already
 * worked out — they sat in poolCoverNote, which is the `title` attribute, and a
 * title never appears on the counter tablet at all. So the badge said the least
 * useful part of what the app already knew.
 *
 * `fmt.date` is injected, the same arrangement as the receipt and the reply
 * drafts: this module compares ISO strings and has no locale.
 */
export function poolCoverLabel(state, poolExpiry, returnDate, today, fmt = {}) {
  const date = fmt.date || ((v) => String(v || ''))
  const days = (n) => `${Math.abs(n)} day${Math.abs(n) === 1 ? '' : 's'}`
  switch (state) {
    case 'expired': {
      const ago = daysBetween(today, poolExpiry)
      // A pool that ran out TODAY is not "0 days ago" — it ran out today.
      return ago === 0
        ? `Pool ended today, ${date(poolExpiry)}`
        : `Pool ended ${date(poolExpiry)} — ${days(ago)} ago`
    }
    case 'short': {
      const gap = daysBetween(poolExpiry, returnDate)
      // The number that matters here is the SHORTFALL, not the time left: it is
      // how long the customer is abroad with a dead line.
      return gap === 0
        ? `Pool ends ${date(poolExpiry)} — the day it is due back`
        : `Pool ends ${date(poolExpiry)} — ${days(gap)} before it is back`
    }
    case 'soon': {
      const left = daysBetween(today, poolExpiry)
      return left === 0
        ? `Pool ends today, ${date(poolExpiry)}`
        : `Pool ends ${date(poolExpiry)} — in ${days(left)}`
    }
    case 'unknown':
      return 'Pool expiry not recorded'
    default:
      return ''
  }
}
