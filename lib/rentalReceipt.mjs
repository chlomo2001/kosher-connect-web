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

/**
 * The rental window laid out as calendar weeks, Sunday-first.
 *
 * Owner, 20 Aug: "maybe a calender showing the chargable days? with hebrew?…
 * i mean the hebrew date in small". A receipt that says "Chargeable days 6"
 * over a seven-day window has not explained itself: the customer cannot see
 * which day was free or why. Shabbos and Yom Tov are not charged
 * (BUSINESS_RULES), and those are facts of the Hebrew calendar — so showing
 * the Hebrew date under each day makes the free days explain themselves
 * instead of needing a footnote.
 *
 * `days` is the window as the COUNTER computed it — [{ iso, free, reason }] —
 * not re-derived here. That is deliberate: the calendar has to agree with the
 * price that was actually charged, so it is built from the same walk that
 * produced the number, and cannot drift from it.
 *
 * Returns [] for a window too long to draw, so a caller can fall back to
 * prose rather than emailing somebody thirteen rows of table.
 */
export function calendarWeeks(days, { maxDays = 35 } = {}) {
  const list = Array.isArray(days) ? days.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d?.iso || ''))) : []
  if (!list.length || list.length > maxDays) return []
  const weeks = []
  let week = new Array(7).fill(null)
  for (const d of list) {
    const [y, m, dd] = d.iso.split('-').map(Number)
    const dow = new Date(Date.UTC(y, m - 1, dd)).getUTCDay()   // 0 = Sunday
    // A new week starts on a Sunday, but only once the first one has begun —
    // otherwise a window that starts on a Sunday emits an empty leading week.
    if (dow === 0 && week.some(Boolean)) { weeks.push(week); week = new Array(7).fill(null) }
    week[dow] = { iso: d.iso, day: dd, free: !!d.free, reason: d.reason || '' }
  }
  if (week.some(Boolean)) weeks.push(week)
  return weeks
}

/**
 * How to say WHY the free days are free, in a sentence a person can read.
 *
 * The first version listed every distinct reason string it found, and a hire
 * spanning Tishrei came out as:
 *
 *   "Rosh Hashanah — 2nd day, Shabbos, Yom Kippur, Shabbos · Succos — 1st day,
 *    Succos — 2nd day, Shabbos · Shemini Atzeres, Simchas Torah."
 *
 * — because a yom tov falling on a Shabbos carries BOTH names in one string, so
 * "Shabbos" appeared three times in three different combinations. The long-hire
 * sentence joined the same list with " and " and was worse again.
 *
 * So: split the combinations back into atoms, dedupe, and stop naming them at
 * all once there are more than a few. Nobody wants nine festivals listed on a
 * receipt; "Shabbos and Yom Tov" is how the shop says it out loud, and the
 * calendar above shows which days they were.
 */
export function freeDayLegend(days) {
  const atoms = []
  for (const d of days || []) {
    if (!d || !d.free) continue
    for (const part of String(d.reason || '').split('·').map((x) => x.trim()).filter(Boolean)) {
      if (!atoms.includes(part)) atoms.push(part)
    }
  }
  if (!atoms.length) return ''
  if (atoms.length > 3) {
    const hasShabbos = atoms.includes('Shabbos')
    const others = atoms.filter((a) => a !== 'Shabbos').length
    if (hasShabbos && others) return 'Shabbos and Yom Tov'
    return hasShabbos ? 'Shabbos' : 'Yom Tov'
  }
  if (atoms.length === 1) return atoms[0]
  return `${atoms.slice(0, -1).join(', ')} and ${atoms[atoms.length - 1]}`
}

/**
 * The rental receipt as a TEXT MESSAGE.
 *
 * Owner, 27 Aug, on what a customer should get by SMS after a hire: the
 * "rented number", "the Kosher Connect team", and the "standard rates".
 * Nothing of the kind existed. buildRentalSms drafts a STATUS text — reserved,
 * due back, overdue — which is a different message for a different moment: it
 * never names what was paid, never names the rate, and could not double as a
 * receipt without becoming both and being right for neither.
 *
 * Straight quotes, hyphens, no em dash, no middle dot: every character here is
 * in the GSM-7 alphabet (£ included), so a five-line receipt bills as three
 * segments rather than the six a single curly character would cost. Same
 * discipline, and the same reason, as lib/autoSms.mjs.
 *
 * Formatters are INJECTED rather than imported. The counter formats a date as
 * "12 Aug 2026" and money as "£140.00" through helpers that already have their
 * own tests; this module has no locale and should not grow one. What it owns
 * is the composition — which sentences, in which order, and which of them are
 * suppressed when there is nothing to say.
 *
 * Every field is optional. A line whose facts are missing is left out rather
 * than printed empty: a receipt that says "Phone:" with nothing after it is
 * worse than a receipt that does not mention the phone.
 */
export function rentalReceiptSms(f = {}, fmt = {}) {
  const date = fmt.date || ((v) => String(v || ''))
  const gbp = fmt.gbp || ((v) => `£${(Number(v) || 0).toFixed(2)}`)
  const phone = fmt.phone || ((v) => String(v || ''))

  const who = String(f.firstName || '').trim().split(/\s+/)[0] || 'there'
  const lines = []

  lines.push(`Hi ${who}, your Kosher Connect phone hire is ${f.reserved ? 'reserved' : 'confirmed'}.`)

  // The rented number, first of the owner's three asks, and the one thing on
  // the receipt the customer cannot look up anywhere else.
  if (f.number) lines.push(`Phone: ${phone(f.number)}`)

  if (f.from && f.to) {
    const days = Number(f.chargeableDays)
    const total = Number(f.totalDays)
    let l = `${date(f.from)} to ${date(f.to)}`
    if (Number.isFinite(days) && days > 0) {
      l += `, ${days} chargeable day${days === 1 ? '' : 's'}`
      // Only worth explaining when some day actually went free.
      if (Number.isFinite(total) && total > days) {
        l += ` (${f.freeLabel || 'Shabbos and Yom Tov'} are not charged)`
      }
    }
    lines.push(`${l}.`)
  }

  const { state, owed } = rentalPayState(f.total, f.paid)
  if (Number(f.total) > 0) {
    // "received", never "you paid" - owner, 27 Aug. The shop is saying what it
    // has, not telling the customer what they did.
    const how = f.method ? ` by ${f.method}` : ''
    if (state === 'paid') lines.push(`${gbp(f.total)} received${how}, paid in full. Thank you.`)
    else if (state === 'part') {
      lines.push(`Total ${gbp(f.total)}. ${gbp(f.paid)} received${how}, ${gbp(owed)} to pay${f.payBy ? ` by ${date(f.payBy)}` : ''}.`)
    } else lines.push(`Total ${gbp(f.total)}, to pay${f.payBy ? ` by ${date(f.payBy)}` : ''}.`)
  }

  // The standard rates, the owner's third ask. From Settings via the caller -
  // BUSINESS_RULES.md is where the shop keeps its prices and this module is
  // not allowed a second copy of them.
  const r = f.rate || null
  if (r && Number(r.perDay) > 0) {
    const bits = [`Standard rate ${gbp(r.perDay)}/day`]
    if (Number(r.min) > 0) bits.push(`minimum ${gbp(r.min)}`)
    if (Number(r.cap) > 0) bits.push(`capped ${gbp(r.cap)} per ${Math.round(Number(r.capDays) || 30)} days`)
    lines.push(`${bits.join(', ')}.`)
  }

  if (f.dueBack) lines.push(`Please have the phone back by ${date(f.dueBack)}.`)
  if (f.shopPhone) lines.push(`Questions: ${f.shopPhone}.`)
  lines.push('- the Kosher Connect team')
  return lines.join('\n')
}
