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
  const gate = CODE.indexOf("process.env.DIGEST_TO")
  const read = CODE.indexOf(".from('tasks')")
  assert.ok(gate > -1 && read > -1 && gate < read, 'DIGEST_TO gate must come before the tasks read')
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
