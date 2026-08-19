// Hebrew dates beside the English ones — on the counter screens only.
//
// Owner, 20 August, choosing between four options: "the counter screens —
// rentals, flights, SIM renewals and repairs", the dates actually said out
// loud to somebody standing there. Not the money screens, not the admin lists,
// and above all not the messages sent to customers.
//
// The line that matters is the one NOT crossed: fmtDate has 78 call sites and
// several of them are the SMS drafts a customer receives. Putting a second
// date into all 78 is a different decision, and nobody made it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const MAIN = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')

test('fmtDate itself is untouched', () => {
  const fn = MAIN.match(/function fmtDate\(iso\) \{[\s\S]*?\n\}/)
  assert.ok(fn, 'fmtDate is missing')
  assert.ok(!/hebrew/i.test(fn[0]),
    'fmtDate has grown a Hebrew date — that reaches all 78 call sites, including the texts customers receive')
})

test('the Hebrew helper adds to the English date, never replaces it', () => {
  const fn = MAIN.match(/function fmtDateHeb\(iso\) \{[\s\S]*?\n\}/)
  assert.ok(fn, 'fmtDateHeb is missing')
  assert.match(fn[0], /const en = fmtDate\(iso\)/, 'the English date must still come from the one formatter')
  assert.match(fn[0], /hebrewDateString\(d\)/)
  // Falls back to the English date alone rather than showing nothing.
  assert.match(fn[0], /if \(!heb\) return escHtml\(en\)/)
})

test('the date is read at noon, so it cannot slip a day', () => {
  // A bare YYYY-MM-DD parses as UTC. West of Greenwich that is the previous
  // evening, and the Hebrew date printed would be yesterday's.
  const fn = MAIN.match(/function fmtDateHeb\(iso\) \{[\s\S]*?\n\}/)
  assert.match(fn[0], /T12:00:00/, 'midnight parsing would put the wrong Hebrew day on the screen')
})

test('it is used on the four counter screens', () => {
  for (const [what, needle] of [
    ['SIM renewals', /data-label="Renews"[^\n]*fmtDateHeb\(s\.renewalDate\)/],
    ['rental return dates', /fmtDateHeb\(r\.toDate\)/],
    ['flight travel dates', /b\.travelDate \? fmtDateHeb\(b\.travelDate\)/],
    ['repairs', /r\.openedAt \? fmtDateHeb\(r\.openedAt\)/],
  ]) {
    assert.match(MAIN, needle, `${what} should carry the Hebrew date`)
  }
})

test('a rental shows Hebrew under the RETURN date only', () => {
  // The cell already stacks two dates. Under both it is four lines in a table
  // row, and the date anybody says about a rental is when it is due back.
  assert.match(MAIN, /fmtDate\(r\.fromDate\)\}<br>\$\{fmtDateHeb\(r\.toDate\)/,
    'the from-date should stay plain and the to-date carry the Hebrew')
})

test('nothing sent to a customer carries it', () => {
  // The SMS drafts and reminder lines are built from plain strings; a helper
  // that returns HTML would arrive as markup in a text message even if the
  // second date were wanted there.
  const smsish = MAIN.match(/lines\.push\(`[^`]*fmtDateHeb[^`]*`\)/g) || []
  assert.equal(smsish.length, 0, 'a customer message is being built with the HTML date helper')
  assert.match(MAIN, /Returns HTML, so callers must not escape it again/,
    'the helper must say that it returns HTML')
})
