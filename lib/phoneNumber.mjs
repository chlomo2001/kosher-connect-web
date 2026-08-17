// Is this actually a phone number? Pure, no dependencies, mirrored on the client.
//
// Owner, 08-17: a number long enough to be nothing at all was typed into a
// send and nothing objected — TEST mode redirects every message to the shop's
// own handset, so a number that could never receive anything still came back
// "sent". The redirect is what hid it; the missing check is what caused it.
//
// This is deliberately NOT a full libphonenumber. The shop sends to UK
// mobiles, to Israeli and US numbers customers give while abroad, and to
// whatever a walk-in writes down. The job here is to catch what CANNOT be a
// phone number — too short, too long, letters, nothing at all — and to leave
// every plausible international number alone. Refusing a real customer's
// number is a worse failure than passing an odd one through.
//
// The bounds are E.164's: a subscriber number is at most 15 digits including
// the country code, and no country has a reachable number under 7.

const MIN_DIGITS = 7
const MAX_DIGITS = 15

/** Just the digits — the form every comparison should be made on. */
export function phoneDigits(raw) {
  return String(raw ?? '').replace(/\D/g, '')
}

/**
 * The number in the form Twilio wants, as far as we can honestly get.
 *   07911 123456   → +447911123456   (UK national, the shop's usual case)
 *   0044 7911…     → +447911…
 *   +972 54 400…   → +972544000111
 *   447911123456   → +447911123456
 * Anything else keeps its digits and gains a leading + only when it already
 * looked international. Never guesses a country code onto a bare local number
 * that isn't a UK 0-prefixed one.
 */
export function normalisePhoneE164(raw, { defaultCc = '44' } = {}) {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  const plus = s.startsWith('+')
  let d = phoneDigits(s)
  if (!d) return ''

  if (!plus && d.startsWith('00')) d = d.slice(2)                 // 0044… → 44…
  else if (!plus && d.startsWith('0')) d = defaultCc + d.slice(1) // 07911… → 447911…
  return '+' + d
}

/**
 * What is wrong with this number, in words a person at the counter can act on
 * — or null when there is nothing wrong with it.
 *
 * Returns { code, message } so callers can branch on the code and show the
 * message. Never throws; an empty value is a problem ('missing'), not a pass.
 */
export function phoneProblem(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return { code: 'missing', message: 'No number.' }

  // A number is digits, spaces, brackets, dashes and at most one leading +.
  // Letters mean someone typed a note into the number field.
  if (/[a-z]/i.test(s)) return { code: 'letters', message: 'That has letters in it — a number, please.' }
  if (/\+/.test(s.slice(1))) return { code: 'shape', message: 'The + belongs at the front, once.' }

  const d = phoneDigits(s)
  if (!d) return { code: 'missing', message: 'No number.' }
  if (d.length < MIN_DIGITS) {
    return { code: 'short', message: `Too short to be a phone number — ${d.length} digit${d.length === 1 ? '' : 's'}.` }
  }
  // The bound that matters here: E.164 stops at 15, so anything longer cannot
  // reach a handset anywhere in the world, whatever the network.
  if (d.length > MAX_DIGITS) {
    return { code: 'long', message: `Too long to be a phone number — ${d.length} digits, the most any number has is 15.` }
  }
  return null
}

/** Convenience: true when the number could reach a handset. */
export function isSendableNumber(raw) {
  return phoneProblem(raw) === null
}
