// The mail lists print WHEN something arrived, and until 18 Aug 2026 carrier
// mail built that by slicing the hours and minutes out of the stored text:
//
//   fmtDate(x) + String(x).slice(11, 16)
//
// Every timestamp is stored as UTC — lib/inboundMail.mjs writes toISOString() —
// so from late March to late October that printed an hour early. Mail that
// arrived at 15:32 read 14:32. Nobody reports a wrongness that small; they just
// stop trusting the column.
//
// Lifted out of main.js and run here, the same way test/pricingMirror.test.mjs
// and test/bookingGateMirror.test.mjs do: it is a browser script that cannot be
// imported, and a test that runs beats a tidier one that does not.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const SRC = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')

function lift(name) {
  const re = new RegExp('function ' + name + '\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n\\}')
  const m = SRC.match(re)
  assert.ok(m, `${name} not found in public/main.js`)
  return m[0]
}

const fmtWhen = new Function(`${lift('fmtDate')}\n${lift('fmtWhen')}\nreturn fmtWhen`)()

// The instant under test, and what a clock in THIS process's timezone says it
// is. The gate runs the suite twice — once in the default zone, once in
// Asia/Jerusalem — so a hard-coded "14:32" would only ever be right in one.
const ISO = '2026-08-18T13:32:00Z'
const local = new Date(ISO).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const offsetMinutes = -new Date(ISO).getTimezoneOffset()

test('the time shown is the time on the wall here', () => {
  assert.equal(fmtWhen(ISO), `18 Aug 2026 ${local}`)
})

test('it is NOT the hours and minutes cut out of the stored text', () => {
  // The actual regression. Skipped only where the two genuinely agree — in UTC
  // the old code was right, which is why this survived so long on a laptop set
  // to UTC and was wrong all summer on the counter.
  if (offsetMinutes === 0) return
  assert.notEqual(fmtWhen(ISO), `18 Aug 2026 ${ISO.slice(11, 16)}`,
    'the timestamp is being sliced out of the raw UTC string again')
})

test('a date with no time in it stays a date', () => {
  // A travel date is a day, not an instant. Printing midnight against it would
  // be inventing precision that was never recorded.
  assert.equal(fmtWhen('2026-08-18'), '18 Aug 2026')
})

test('nothing, or rubbish, does not print as a broken date', () => {
  for (const bad of ['', null, undefined]) assert.equal(fmtWhen(bad), '—')
  assert.equal(fmtWhen('not a date at all'), '—')
  // A malformed timestamp still has a readable date half — show that rather
  // than throwing away the whole line.
  assert.equal(fmtWhen('2026-08-18T99:99:99Z'), '18 Aug 2026')
})

test('both mail lists use it — neither builds its own', () => {
  assert.match(SRC, /const when = fmtWhen\(m\.receivedAt\)/, 'carrier mail no longer uses fmtWhen')
  assert.match(SRC, /tm-when">\$\{t\.receivedAt \? escHtml\(fmtWhen\(t\.receivedAt\)\)/, 'ticket mail no longer uses fmtWhen')
  assert.doesNotMatch(SRC, /slice\(11, 16\)/, 'someone has gone back to slicing the time out of the raw string')
})
