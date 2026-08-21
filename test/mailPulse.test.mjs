// The live carrier-post pulse — issue #16.
//
// Owner, 20 Aug: "a small pop-up when carrier mail arrived, for a few seconds?
// so that a worker on the app sees live interaction." The shape under test is
// the ECONOMY and the HONESTY of it: the poll asks a question the size of a
// toast, the watermark can never be moved by the client's own clock, and a
// backlog compresses to one catch-up line instead of a replay.
import test from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.join(import.meta.dirname, '..')
const strip = (f) => readFileSync(path.join(ROOT, f), 'utf8')
  .split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
const API = strip('pages/api/sim-mail.js')
const MAIN = strip('public/main.js')

test('the pulse answer is a count and headlines, never the mailbox', () => {
  const m = API.match(/if \(req\.query\.since !== undefined\) \{[\s\S]*?\n    \}/)
  assert.ok(m, 'no since branch in the mail API')
  assert.match(m[0], /select=id,received_at,carrier,subject/,
    'the pulse must not carry bodies or addresses — it is polled every minute from every open tab')
  assert.match(m[0], /limit=6/, 'six fetched, five named — the sixth only proves "more"')
  assert.match(m[0], /since must be an ISO timestamp/, 'the timestamp goes into a filter — validate it')
})

test('the watermark only ever advances to a server timestamp', () => {
  const fn = MAIN.match(/async function kcMailPulse\(\) \{[\s\S]*?\n\}/)
  assert.ok(fn, 'kcMailPulse not found')
  assert.match(fn[0], /kcMailSeenAt = d\.latest\[0\]\?\.receivedAt \|\| kcMailSeenAt/,
    'the only assignment must fall back to itself')
  assert.doesNotMatch(fn[0], /kcMailSeenAt = new Date/,
    'a client clock ahead of the server would skip mail forever')
})

test('quiet tabs do not poll, and a slow answer cannot stack', () => {
  const fn = MAIN.match(/async function kcMailPulse\(\) \{[\s\S]*?\n\}/)
  assert.match(fn[0], /document\.hidden/, 'hidden tabs must not join the stampede')
  assert.match(fn[0], /kcMailPulseBusy/, 'overlapping pulses must be refused')
})

test('a burst compresses to one line instead of replaying', () => {
  const fn = MAIN.match(/async function kcMailPulse\(\) \{[\s\S]*?\n\}/)
  assert.match(fn[0], /d\.count <= 3 && !d\.capped/, 'names for a few, a summary for many')
  assert.match(fn[0], /carrier posts arrived — see Carrier Mail/)
})

test('it runs on the minute, not on the reminder cadence', () => {
  assert.match(MAIN, /setInterval\(kcMailPulse, 60000\)/,
    'every open tab pays for this — once a minute is the agreed price')
})
