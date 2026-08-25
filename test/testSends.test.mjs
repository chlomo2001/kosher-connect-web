// The two "prove the connection" buttons in Settings → Messaging. Run: npm test
//
// Their whole value is being believed, so what they must never do is call a
// message "sent" when it was not. lib/email.js and lib/sms.js each have three
// gate modes and email has two refusal paths on top, and every one of them is
// a different sentence to the person who pressed the button.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const MAIN = read('public/main.js')
const API = read('pages/api/email-test.js')

test('both channels can be proved without touching a customer', () => {
  // Email had no test path until 25 Aug: the only way to prove it was to fire
  // a real receipt at a real customer, which is a poor way to find out the
  // sending domain is unverified.
  assert.ok(read('pages/api/sms-test.js').length, 'the SMS test endpoint is missing')
  assert.ok(API.length, 'the email test endpoint is missing')
  assert.match(MAIN, /function sendTestEmail\(\)/, 'the email test button has no sender')
  assert.match(MAIN, /function sendTestSms\(\)/, 'the SMS test button has no sender')
})

test('the email test is gated like the card it sits on', () => {
  assert.match(API, /tabAllowedFor\(req\.staff, 'settings'\)/,
    'it must need the same permission as seeing the Messaging card')
  assert.match(API, /withStaff\(handler\)/, 'and a signed-in staff session')
})

test('it never calls a message sent when it was not', () => {
  const fn = MAIN.match(/async function sendTestEmail\(\)[\s\S]*?\n\}/)
  assert.ok(fn, 'sendTestEmail is missing')
  assert.match(fn[0], /res\.held/, 'HOLD builds and logs and sends nothing — say so')
  assert.match(fn[0], /res\.redirectedTo/, 'TEST goes somewhere else than typed — say so')
  // The refusals come back as success:false with a reason, so the generic
  // error branch has to carry them rather than swallow them.
  assert.match(API, /suppressed/, 'a suppressed address will never receive anything')
  assert.match(API, /invalid/, 'and a malformed one is refused before sending')
})

test('the live warning is conditional, not decorative', () => {
  // "Safe in every mode" sat beside the SMS box while the shop was live, which
  // is the one mode where it is not safe. Both notes now read the real gate.
  const live = MAIN.match(/health\?\.email\?\.mode === 'live'/)
  const liveSms = MAIN.match(/health\?\.sms\?\.mode === 'live'/)
  assert.ok(live, 'the email note must read the actual mode')
  assert.ok(liveSms, 'so must the SMS one')
  assert.doesNotMatch(MAIN, /Safe in every mode/,
    'no note may claim safety in a mode that sends to whatever is typed')
})

test('the test email goes through the real template', () => {
  // A plain-text test would pass on the day the branded one breaks — the logo
  // failing to load over https is exactly the kind of thing only a real
  // rendering shows.
  assert.match(API, /brandShell\(/, 'the test must use the shell real receipts use')
})
