// Days the shop does not send an automated message.
//
// Written 26 Aug 2026 for the automated passport and SIM-renewal reminders. A
// text that arrives on Shabbos or yom tov is worse than no text at all in this
// community, and an automation that cannot tell the difference has no business
// messaging anybody.
//
// DERIVED, NOT LISTED. public/main.js carries DIASPORA_YOM_TOV — 1,378 dates
// from 2020 to 2125, hand-checked, used to decide which rental days are free.
// Copying that here would be 1,378 lines of duplication in a repo that just
// deleted 34,000 lines of it, and it would run out in 2125.
//
// So this computes the same answer from lib/hebrewDate.mjs, which is pure and
// already has a real test table behind it (leap years, Adar I vs Adar II, the
// Rosh Hashana year boundary). test/yomTovDerived.test.mjs then checks the
// derivation against every one of those 1,378 dates — so the cheap version is
// held to the hand-checked one rather than trusted.
import { hebrewFromGregorian } from './hebrewDate.mjs'

// The thirteen diaspora days, by Hebrew month and day. Months are numbered
// Nisan=1 … Elul=6, Tishrei=7 … as lib/hebrewDate.mjs numbers them.
//
//   Nisan  15, 16   Pesach, first days        Sivan   6, 7    Shavuos
//   Nisan  21, 22   Pesach, last days         Tishrei 1, 2    Rosh Hashana
//   Tishrei 10      Yom Kippur                Tishrei 15, 16  Succos
//   Tishrei 22, 23  Shmini Atzeres / Simchas Torah
//
// Chol hamoed is deliberately NOT here: it is not yom tov, the shop is open,
// and a reminder that day is fine.
const DAYS = {
  1: [15, 16, 21, 22],
  3: [6, 7],
  7: [1, 2, 10, 15, 16, 22, 23],
}

const parse = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''))
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

/**
 * Is this Gregorian date a diaspora yom tov?
 *
 * The Hebrew day begins the evening BEFORE, so 15 Nisan as a Hebrew date maps
 * to the Gregorian day yom tov is mostly lived in — which is the day a message
 * would land, and therefore the right unit here. This is a send/don't-send
 * gate, not a halachic clock.
 */
export function isYomTov(iso) {
  const g = parse(iso)
  if (!g) return false
  const h = hebrewFromGregorian(g[0], g[1], g[2])
  if (!h) return false
  return (DAYS[h.month] || []).includes(h.day)
}

/** Saturday. Read off the ISO date at UTC noon so no timezone can shift it. */
export function isShabbos(iso) {
  const g = parse(iso)
  if (!g) return false
  return new Date(Date.UTC(g[0], g[1] - 1, g[2], 12)).getUTCDay() === 6
}

/**
 * The one an automation should ask: may we message somebody today?
 *
 * Erev yom tov is not excluded. The sweep runs in the morning, a message sent
 * on erev arrives with the day still ahead of it, and holding it back would
 * mean the reminder lands after the thing it was warning about.
 */
export function isQuietDay(iso) {
  return isShabbos(iso) || isYomTov(iso)
}

// ── When a task should actually be raised ────────────────────────────────
//
// Owner, 30 Aug 2026: "whenever you raise a task for a specific date (e.g. the
// pool expires and its still rented), if its shabbes or yom tov, it should be
// raised 3 days before already."
//
// The reason is the shop's week, not the calendar's. A task dated Shabbos is a
// task nobody sees until Sunday, and by then the thing it was warning about has
// already happened — the pool expired with a customer's phone on it. Three days
// is the owner's number and it is a good one: it clears a three-day yom tov,
// and it leaves a working day to do something in.
//
// The dates themselves never move. This decides WHEN SOMEBODY IS ASKED, and the
// task's own title still carries the real date.

/** The owner's lead. Three days, so a three-day yom tov is cleared in one hop. */
export const QUIET_LEAD_DAYS = 3

const shift = (iso, days) => {
  const g = parse(iso)
  if (!g) return iso
  // Noon UTC, so neither a DST change nor a timezone can move the day.
  const d = new Date(Date.UTC(g[0], g[1] - 1, g[2], 12) + days * 86400000)
  return d.toISOString().slice(0, 10)
}

/**
 * workingDueDate(iso, today) → the day to put in front of somebody.
 *
 * Unchanged unless `iso` is Shabbos or yom tov. When it is, it moves back
 * QUIET_LEAD_DAYS — and then keeps stepping back if that lands on another quiet
 * day, so this holds however the calendar falls rather than only for the cases
 * anyone thought of. Friday is a working day and is not stepped over.
 *
 * `today` is optional. Given, a lead that would land in the past becomes today,
 * because nobody can act on Tuesday any more — EXCEPT when the original date is
 * itself already past, where the task is genuinely late and moving it forward
 * would hide that.
 */
export function workingDueDate(iso, today = null) {
  if (!parse(iso) || !isQuietDay(iso)) return iso
  let d = shift(iso, -QUIET_LEAD_DAYS)
  // A bounded walk: the longest run of quiet days is three, so this settles
  // immediately. The guard is here so a future bug in isQuietDay cannot hang
  // the nightly sweep.
  for (let i = 0; i < 14 && isQuietDay(d); i++) d = shift(d, -1)
  if (today && iso >= today && d < today) return today
  return d
}
