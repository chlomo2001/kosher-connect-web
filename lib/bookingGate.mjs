// The Booking Gate — the questions that must be answered before a flight is
// booked. Pure, dependency-free, unit-tested: no DOM, no network, every input
// a parameter. Same shape and the same reasoning as lib/chargeGate.mjs.
//
// WHY A SECOND GATE
//
// chargeGate.mjs says it plainly: "DELIBERATELY RENTAL-CLOSE ONLY … If a second
// surface ever needs a gate, it should get its own function rather than a
// `type` parameter here." This is that second surface, and it is a separate
// module for exactly that reason — none of the checks below is about handing a
// phone back.
//
// Today the app notices passport problems AFTERWARDS: the daily sweep raises a
// PASSPORT-<booking> task when an expiry falls within 90 days of travel. That
// is the right safety net and the wrong moment. The customer is at the counter
// when the booking is made and gone by the time the task appears — and a
// passport that expires before the flight is not a task, it is a trip that will
// not happen.
//
// So the same questions get asked at the only moment anyone can still answer
// them, and the gate decides whether the app knows enough to take the booking.
//
// BLOCK cannot be overridden — a passport that expires before the travel date
// is not a judgement call. VERIFY can proceed once a named member of staff says
// so on the record: "I have seen the ETA confirmation" is a real answer, and
// refusing the booking over it would be the app overruling the person who can
// actually see the document.

export const BLOCK = 'block'
export const VERIFY = 'verify'
export const PASS = 'pass'

const dayDiff = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000)
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))

// Most destinations want a passport valid for six months beyond the travel
// date. That is a rule of thumb, not law, so it WARNS rather than blocks —
// the exception (an EU national flying to Israel) is common enough here that
// a hard block would be wrong more often than right.
const SIX_MONTHS_DAYS = 183

/**
 * gateFor(booking, { today, requirement, coverage, verifications })
 *
 * `requirement` and `coverage` come from lib/travelRules.mjs — this module
 * does not re-implement the rules matrix, it only decides what to do about the
 * answer. Returns { checks: [...], worst, canProceed }.
 */
export function bookingGateFor(booking = {}, {
  today,
  requirement = null,
  coverage = null,
  verifications = [],
} = {}) {
  const checks = []
  const verified = new Set((verifications || []).map(String))
  const travelDate = booking.travelDate || booking.travel_date || ''
  const seen = (key) => verified.has(key)

  // 1. Is there a passport on file at all?
  if (!booking.passportOnFile && !booking.passport_on_file) {
    checks.push({
      key: 'passport-on-file',
      level: seen('passport-on-file') ? PASS : VERIFY,
      title: 'No passport copy on file',
      detail: 'Take a photocopy or scan now — chasing it later is how a booking becomes a problem.',
    })
  }

  // 2. Does the passport outlive the trip? This one BLOCKS.
  const expiry = booking.passportExpiry || booking.passport_expiry || ''
  if (isDate(expiry) && isDate(travelDate)) {
    const daysAfterTravel = dayDiff(expiry, travelDate)
    if (daysAfterTravel < 0) {
      checks.push({
        key: 'passport-expired',
        level: BLOCK,
        title: 'Passport expires before the travel date',
        detail: `It runs out ${Math.abs(daysAfterTravel)} day${Math.abs(daysAfterTravel) === 1 ? '' : 's'} before they fly. The trip cannot go ahead on this document.`,
      })
    } else if (daysAfterTravel < SIX_MONTHS_DAYS) {
      checks.push({
        key: 'passport-thin',
        level: seen('passport-thin') ? PASS : VERIFY,
        title: `Passport valid only ${daysAfterTravel} days after travel`,
        detail: 'Many destinations want six months beyond the return date. Check this one before booking.',
      })
    }
  } else if (isDate(travelDate) && !isDate(expiry)) {
    checks.push({
      key: 'passport-expiry-unknown',
      level: seen('passport-expiry-unknown') ? PASS : VERIFY,
      title: 'Passport expiry not recorded',
      detail: 'Without it nobody can tell whether this passport outlives the trip.',
    })
  }

  // 3. Travel authorisation — ESTA / ETA / ETIAS, per lib/travelRules.
  if (requirement && coverage) {
    const code = requirement.code
    if (coverage.status === 'missing' && code && code !== 'NONE') {
      checks.push({
        key: `auth-missing-${code}`,
        level: seen(`auth-missing-${code}`) ? PASS : VERIFY,
        title: `No ${code} on record`,
        detail: requirement.note || `This destination needs ${code} before travel.`,
      })
    } else if (coverage.status === 'expiring' && coverage.expiresBeforeTravel) {
      checks.push({
        key: `auth-expired-${code}`,
        level: BLOCK,
        title: `${code} expires before travel`,
        detail: `Valid only until ${coverage.validUntil}. A new one is needed before this trip.`,
      })
    } else if (coverage.status === 'expiring') {
      checks.push({
        key: `auth-expiring-${code}`,
        level: seen(`auth-expiring-${code}`) ? PASS : VERIFY,
        title: `${code} expires soon after travel`,
        detail: `Valid until ${coverage.validUntil}.`,
      })
    } else if (coverage.status === 'check') {
      checks.push({
        key: 'auth-check',
        level: seen('auth-check') ? PASS : VERIFY,
        title: 'Entry requirements need checking',
        detail: requirement.note || 'The rules for this destination and nationality are not settled in the app.',
      })
    }
  }

  const worst = checks.some((c) => c.level === BLOCK) ? BLOCK
    : checks.some((c) => c.level === VERIFY) ? VERIFY
      : PASS
  return { checks, worst, canProceed: worst !== BLOCK }
}

/** One line for a button or a badge. */
export function bookingGateSummary(gate) {
  if (!gate || gate.worst === PASS) return 'Nothing outstanding'
  const open = gate.checks.filter((c) => c.level !== PASS)
  if (gate.worst === BLOCK) {
    const b = open.find((c) => c.level === BLOCK)
    return b ? b.title : 'Cannot book'
  }
  return `${open.length} thing${open.length === 1 ? '' : 's'} to confirm`
}
