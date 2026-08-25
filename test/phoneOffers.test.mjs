// Two places in the New rental form offer a handset, and they must never
// disagree about what "free" means. Run: npm test
//
// On 25 Aug the picker offered nothing while the USA pool suggestion two
// fields below it offered a handset with a one-click "Use" — for a phone
// marked rented, permanent, not_working or unknown. None of those has a rental
// record behind it, so a conflict check ALONE lets all four through, and
// poolPhoneSuggestions was doing exactly that. A not_working handset is a
// broken phone recommended to a customer. Issue #21.
//
// public/main.js is a browser script, so this reads it as text — the same
// approach test/tabs.test.mjs and test/replyQueue.test.mjs take, and a test
// that runs beats a tidier one that cannot.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const MAIN = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')

test('what counts as rentable is decided in exactly one place', () => {
  const fn = MAIN.match(/function phoneInService\(p\) \{[^}]*\}/)
  assert.ok(fn, 'phoneInService is missing')
  assert.match(fn[0], /maintenance/, 'a handset under maintenance is never offerable')
  assert.match(fn[0], /status === 'available'/,
    "and 'not rented' is not the same as 'rentable'")
})

test('both offers on the New rental form go through it', () => {
  const offerable = MAIN.match(/function phonesOfferableFor\([\s\S]*?\n\}/)
  assert.ok(offerable, 'phonesOfferableFor is missing')
  assert.match(offerable[0], /phoneInService/, 'the picker must use the shared rule')

  const pool = MAIN.match(/function poolPhoneSuggestions\([\s\S]*?\n\}/)
  assert.ok(pool, 'poolPhoneSuggestions is missing')
  assert.match(pool[0], /phoneInService\(p\)/, 'the pool suggestion must use it too')
  // The specific regression: ranking by pool fit is not permission to offer.
  assert.doesNotMatch(pool[0], /\.filter\(p => \(p\.country/,
    'the pool filter must not start from country alone — that was the bug')
})

test('the modal builds its phone list for the dates it prefilled', () => {
  // The form fills From and To itself and computes the price from them, so the
  // handset field has to be built for those dates too. Without this the hint
  // read "(pick dates to see availability)" over dates already picked, and the
  // scan path tested an nrPhoneShown that had never been built — scanning a
  // free handset on the first rental of a session was refused.
  // Sliced to the next top-level function, NOT matched with a lazy /\n\}/:
  // this body is mostly one long template literal, and the first line starting
  // with a brace lands hundreds of lines before the code being checked.
  const start = MAIN.indexOf('function openNewRentalModal(')
  assert.ok(start > -1, 'openNewRentalModal is missing')
  const rest = MAIN.slice(start + 1)
  const end = rest.indexOf('\nfunction ')
  const open = rest.slice(0, end > -1 ? end : rest.length)

  const setDates = open.indexOf("getElementById('rTo').value")
  // Searched FROM the dates, not from the top: the template above holds
  // onchange="refreshRentalPhoneOptions(); …" on both date inputs, and a plain
  // indexOf finds that attribute rather than the call being checked for.
  const refresh = open.indexOf('refreshRentalPhoneOptions()', setDates)
  const scanCheck = open.indexOf('nrPhoneShown.some')
  assert.ok(setDates > -1 && refresh > -1 && scanCheck > -1, 'the three landmarks must all be present')
  assert.ok(refresh > setDates, 'the offer must be rebuilt after the dates are set')
  assert.ok(refresh < scanCheck, 'and before the scan path tests the list it produces')
})

test('an empty shelf is said, not enforced', () => {
  // A hire booked for a future date is legitimate when nothing is free today —
  // that is what the 'booked' status is for — so the notice never disables the
  // form, and it names a date that would work rather than only refusing.
  const fn = MAIN.match(/function refreshRentalPhoneOptions\(\)[\s\S]*?\n\}/)
  assert.ok(fn, 'refreshRentalPhoneOptions is missing')
  assert.match(fn[0], /rNoneFree/, 'the notice must be driven by the availability pass')
  assert.match(fn[0], /nrNextFreeFrom/, 'and name the first date that works')
  assert.doesNotMatch(fn[0], /disabled = true/, 'it must not block a future booking')
})
