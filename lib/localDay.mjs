// The shop's business calendar is Europe/London; Vercel functions run in UTC.
// The ledger stores created_at as a UTC timestamptz, so filtering "today" with a
// bare date string compares against UTC midnight — which is 23:00 the previous
// London day in summer (BST). A till movement at 00:30 London time then lands on
// the WRONG Z-report and persists a wrong till_counts.expected/variance.
//
// These helpers turn a London calendar day into the exact UTC instants the
// created_at column must be filtered against, so the day window is the real
// shop day. Timezone is pinned via Intl (independent of the process TZ), so the
// result is identical whether the server runs in UTC or anywhere else.

const TZ = 'Europe/London'

// The shop-local calendar date (YYYY-MM-DD), optionally offset by whole days.
export function londonDate(offsetDays = 0, now = Date.now()) {
  const d = new Date(now + offsetDays * 86400000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)
}

// How far ahead of UTC the London wall clock is at `instant` (ms): +3600000 in
// BST, 0 in GMT. Derived by formatting the instant in London and reading it back
// as if it were UTC.
function londonOffsetMs(instant) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const p = {}
  for (const part of dtf.formatToParts(instant)) p[part.type] = part.value
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  return asUTC - instant.getTime()
}

// The UTC instant (ISO) of London-local midnight that OPENS calendar day
// `dateStr` (YYYY-MM-DD). Solve T + offset(T) = midnight-as-if-UTC for T; one
// refinement settles it (London DST switches at 01:00, so midnight is never the
// ambiguous hour).
export function londonDayStartUtc(dateStr) {
  const wall = Date.parse(dateStr + 'T00:00:00Z')
  let off = londonOffsetMs(new Date(wall))
  let t = wall - off
  off = londonOffsetMs(new Date(t))
  t = wall - off
  return new Date(t).toISOString()
}

// [start, end) UTC ISO bounds for the whole London calendar day `dateStr`.
export function londonDayBoundsUtc(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
  return { start: londonDayStartUtc(dateStr), end: londonDayStartUtc(next) }
}

// "7 Aug 2026" — the same display form as the client's fmtDate (public/main.js),
// and for the same reason it exists there: 05/08 and 08/05 are different days on
// either side of the Atlantic, so anything a human reads gets the unambiguous
// form. The cron sweep writes task TITLES that staff read all day, and four of
// them were interpolating the raw ISO column straight in — "SIM renews
// 2026-08-07", "Rental overdue — Shimon Adler (due 2026-07-21)". Every other
// date in the app renders through fmtDate, so the task list was the one screen
// speaking a different dialect to the rest.
//
// Kept deliberately simple and string-based: these are already London-local
// date strings (localDate / the DB's date columns), so constructing a Date
// would only add a timezone to get wrong.
export function displayDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = String(dateStr).slice(0, 10).split('-')
  if (!y || !m || !d) return String(dateStr)
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const mi = parseInt(m, 10) - 1
  if (!(mi >= 0 && mi < 12)) return String(dateStr)
  return `${parseInt(d, 10)} ${MONTHS[mi]} ${y}`
}
