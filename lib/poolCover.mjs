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
