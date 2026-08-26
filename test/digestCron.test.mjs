// The digest endpoint — the piece that turns two tested halves into a morning.
//
// What is under test is the SAFETY SHAPE, because that is what this endpoint
// is: a reader and a hand-off. It must authenticate like the sweep, send only
// through the gated sendEmail (never a provider directly), say nothing on a
// quiet morning, and never write to the database at all.
import test from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.join(import.meta.dirname, '..')
const SRC = readFileSync(path.join(ROOT, 'pages/api/cron/digest.js'), 'utf8')
// CODE is SRC with comment-shaped lines dropped — the endpoint's comments talk
// about MAIL_LIVE and sendEmail by name, and a grep that reads prose has bitten
// this repo three times today alone (houseDialogs found the same trap twice).
// Every comment in the file starts its line, so the line filter is enough.
const CODE = SRC.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')

test('it authenticates the way the sweep does', () => {
  assert.match(SRC, /timingSafeEqual/, 'the bearer compare must be timing-safe')
  assert.match(SRC, /req\.method !== 'POST'/, 'cookie-authenticated runs must be POST-only')
  assert.match(SRC, /resolveStaff/, 'non-cron callers must be signed-in staff')
})

test('the send goes through the gate, and only the gate', () => {
  assert.match(CODE, /sendEmail\(\{ to, subject, html, kind: 'daily_digest' \}\)/)
  for (const smell of ['nodemailer', 'fetch(', 'api.resend.com', 'MAIL_LIVE']) {
    assert.ok(!CODE.includes(smell),
      `the endpoint reaches past the gate: ${smell} — MAIL_LIVE is sendEmail's business, not this file's`)
  }
})

test('no recipient configured means nothing at all happens', () => {
  // DIGEST_TO is checked BEFORE the database is read: an endpoint with nowhere
  // to send has no reason to touch anything.
  //
  // This test used to look for `.from('tasks')` as the read. It found it, and
  // passed, every day for five days — while that exact call threw TypeError on
  // every real invocation, because the client has no `from`. A test can only
  // check that one string sits before another; it cannot check that either one
  // runs. That is test/dbApi.test.mjs's job now, and this one names the helper
  // that actually exists so the two cannot drift apart again.
  const gate = CODE.indexOf('digestStatus()')
  const read = CODE.indexOf("selectAllPaged('tasks'")
  assert.ok(gate > -1 && read > -1 && gate < read, 'the DIGEST_TO gate must come before the tasks read')
})

test('the probe and the run answer from the same gate', () => {
  // The whole point of 26 Aug: /api/health said everything was fine while the
  // digest sent nothing. Two copies of "is the digest on?" is how that stays
  // possible, so there is one function and both sides import it.
  const HEALTH = readFileSync(path.join(ROOT, 'pages/api/health.js'), 'utf8')
  assert.match(HEALTH, /import \{ digestStatus \} from '\.\.\/\.\.\/lib\/digestGate\.mjs'/,
    '/api/health must report the digest')
  assert.match(HEALTH, /digest: digestStatus\(\)/, 'the probe must call the shared gate, not re-derive it')
  assert.match(CODE, /digestStatus\(\)/, 'the endpoint must call the shared gate, not re-derive it')
  assert.ok(!CODE.includes('process.env.DIGEST_TO'),
    'the endpoint must not read DIGEST_TO itself — digestGate.mjs owns that question')
})

test('the probe says whether a recipient exists, never who it is', () => {
  // /api/health is public and unauthenticated. `digest` is on/off in the same
  // sense `vault` is: an address is somebody's contact detail.
  const GATE = readFileSync(path.join(ROOT, 'lib/digestGate.mjs'), 'utf8')
  const statusFn = GATE.slice(GATE.indexOf('export function digestStatus'))
  assert.ok(!/return digestRecipient\(\)/.test(statusFn) && !/\$\{/.test(statusFn),
    'digestStatus must return a fixed word, never the address')
  // Comment lines dropped: health.js explains in prose why the field exists,
  // and that explanation names the env var. Naming it is not reading it.
  const HEALTH_CODE = readFileSync(path.join(ROOT, 'pages/api/health.js'), 'utf8')
    .split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
  assert.ok(!HEALTH_CODE.includes('digestRecipient') && !HEALTH_CODE.includes('DIGEST_TO'),
    'the public probe must never touch the address')
})

test('the three words the gate can say are the words the endpoint reports', async () => {
  const { digestStatus } = await import('../lib/digestGate.mjs')
  const had = process.env.DIGEST_TO
  try {
    delete process.env.DIGEST_TO
    assert.equal(digestStatus(), 'no-recipient')
    process.env.DIGEST_TO = '   '
    assert.equal(digestStatus(), 'no-recipient', 'whitespace is not a recipient')
    process.env.DIGEST_TO = 'someone@example.com'
    // No mail provider is configured under test, so this is the second gate.
    assert.equal(digestStatus(), 'email-not-configured')
  } finally {
    if (had === undefined) delete process.env.DIGEST_TO; else process.env.DIGEST_TO = had
  }
  // Whatever it says, the endpoint reports it verbatim as `skipped`.
  assert.match(CODE, /skipped: gate/, 'the endpoint must report the gate\'s own word')
})

test('a quiet morning returns before anything is sent', () => {
  const quiet = CODE.indexOf('digest.quiet')
  const send = CODE.indexOf('sendEmail(')
  assert.ok(quiet > -1 && send > -1 && quiet < send,
    'the quiet check must sit before the send — a daily "nothing today" trains the reader to ignore the real one')
})

test('it reads, and it never writes', () => {
  for (const smell of ['.insert(', '.update(', '.upsert(', '.delete(']) {
    assert.ok(!CODE.includes(smell), `the digest endpoint writes to the database: ${smell}`)
  }
})

test('it is scheduled, and after the sweep that raises the morning tasks', () => {
  const cfg = JSON.parse(readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'))
  const at = Object.fromEntries(cfg.crons.map((c) => [c.path, c.schedule]))
  assert.ok(at['/api/cron/digest'], 'no cron entry for the digest')
  const mins = (s) => { const [m, h] = s.split(' '); return Number(h) * 60 + Number(m) }
  assert.ok(mins(at['/api/cron/digest']) > mins(at['/api/cron/sweep']),
    'the digest must run AFTER the sweep, or every morning it describes yesterday')
})
