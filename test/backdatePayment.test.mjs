// A payment can be recorded for the day the money actually came in.
//
// Owner, 30 Aug 2026: "when recording a payment it should be an option to set
// as paid at a previous date." Money reaches a counter before it reaches the
// app — cash on Friday entered on Sunday, a transfer noticed three days later —
// and every entry used to be stamped with the moment somebody typed it, so
// Friday's cash landed in Sunday's takings.
//
// WHICH COLUMN MOVES. created_at becomes the day the MONEY moved, because all
// five money reports already group by it (ledger_day_flow, ledger_revenue_since,
// ledger_daily_series, ledger_flow_between, ledger_customer_stats). Making that
// column true means every one of them answers correctly with no change, and no
// chance of one being missed. entered_at is NEW and holds when the row was
// written — so the audit trail is gained rather than spent.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const API = readFileSync(new URL('pages/api/ledger.js', root), 'utf8')
const SRC = readFileSync(new URL('public/main.js', root), 'utf8')
const CSS = readFileSync(new URL('styles/app.css', root), 'utf8')
const MANUAL = readFileSync(new URL('lib/manual.mjs', root), 'utf8')

const migration = (() => {
  const dir = new URL('supabase/migrations/', root)
  const f = readdirSync(dir).filter((x) => x.endsWith('_ledger_entered_at.sql'))
  assert.equal(f.length, 1, 'the entered_at migration is missing or duplicated')
  return readFileSync(new URL(f[0], dir), 'utf8')
})()

test('entered_at exists, is backfilled, and is not nullable', () => {
  // The backfill is exact: for every row that existed before this, the moment
  // it was typed IS its created_at, because there was no other way in.
  assert.match(migration, /alter table ledger add column if not exists entered_at timestamptz/)
  assert.match(migration, /update ledger set entered_at = created_at where entered_at is null/)
  assert.match(migration, /alter column entered_at set default now\(\)/)
  assert.match(migration, /alter column entered_at set not null/)
})

test('the append-only trigger pins entered_at too', () => {
  // A backdated entry whose witness could be edited afterwards is a backdated
  // entry with no witness. Both allow-branches of the trigger — the ordinary
  // one and the customer-merge one — have to hold it.
  const branches = migration.split('return new;')
  assert.ok(branches.length >= 3, 'the trigger no longer has its two allow-branches')
  for (const [i, b] of branches.slice(0, 2).entries()) {
    assert.match(b, /new\.entered_at = old\.entered_at/, `branch ${i + 1} lets entered_at be rewritten`)
  }
})

test('the day the money moved goes in created_at, and only when it differs', () => {
  const fn = API.match(/function backdateStamp\(paidOn\) \{[\s\S]*?\n\}/)
  assert.ok(fn, 'backdateStamp is gone')
  // Today is the ordinary case and must leave the database to stamp it: writing
  // our own "now" would put a clock skew into every entry for no reason.
  assert.match(fn[0], /if \(day === today\) return null/)
  assert.match(API, /\.\.\.\(createdAt \? \{ created_at: createdAt \} : \{\}\)/)
  // entered_at is never written by this code — the column's default is the
  // only thing allowed to say when a row was made.
  assert.doesNotMatch(API, /entered_at:/, 'the API is setting entered_at itself')
})

test('the future is refused, and so is a mistyped year', () => {
  const fn = API.match(/function backdateStamp\(paidOn\) \{[\s\S]*?\n\}/)[0]
  assert.match(fn, /day > today.*\n?.*has not happened yet/s)
  assert.match(fn, /BACKDATE_MAX_DAYS/)
  assert.match(API, /const BACKDATE_MAX_DAYS = 730/)
  assert.match(fn, /check the year/)
  assert.match(fn, /That date is not a date/)
})

test('noon, not midnight', () => {
  // Midnight London is midnight-or-11pm in UTC depending on the season, and
  // every report here groups by London day. Noon cannot fall out of its day.
  const fn = API.match(/function backdateStamp\(paidOn\) \{[\s\S]*?\n\}/)[0]
  assert.match(fn, /londonDayStartUtc\(day\)\) \+ 12 \* 3600 \* 1000/)
})

test('the form carries the date, defaulted to today and capped at today', () => {
  assert.match(SRC, /<label class="form-label" for="wlPaidOn">Day the money was taken<\/label>/)
  assert.match(SRC, /id="wlPaidOn"[\s\S]{0,120}value="\$\{escHtml\(localISO\(\)\)\}" max="\$\{escHtml\(localISO\(\)\)\}"/)
  assert.match(SRC, /paidOn,\s*clientRef: kcRef\(\)/, 'the date is not being sent with the entry')
})

test('the browser refuses a future date too, not only the server', () => {
  // The server is the one that matters, but a date field that lets you type
  // tomorrow and only complains after you press Record is a form arguing with
  // you about something it could have said while you were looking at it.
  assert.match(SRC, /if \(paidOn && paidOn > localISO\(\)\) \{ toast\('That day has not happened yet\.'/)
  assert.match(SRC, /function wlPaidOnNote\(\)/)
  assert.match(SRC, /Counts in the takings for/)
})

test('a backdated entry says on the row when it was actually typed', () => {
  // A row that quietly appeared in last week with nothing saying when it was
  // made is a row somebody will have to argue about later.
  const fn = SRC.match(/function ledgerEnteredNote\(e\) \{[\s\S]*?\n\}/)
  assert.ok(fn, 'ledgerEnteredNote is gone')
  assert.match(fn[0], /if \(!moved \|\| !typed \|\| moved === typed\) return ''/,
    'the note must print nothing on an ordinary entry')
  assert.equal((SRC.match(/\$\{ledgerEnteredNote\(e\)\}/g) || []).length, 3,
    'all three ledger row renderers should carry the note')
  assert.match(CSS, /\.kc-entered-note \{/)
})

test('the API hands both dates to the screen', () => {
  const shape = API.match(/const toAppEntry = \(row\) => \(\{[\s\S]*?\n\}\)/)
  assert.ok(shape, 'toAppEntry has moved')
  assert.match(shape[0], /at: row\.created_at,/)
  assert.match(shape[0], /enteredAt: row\.entered_at \|\| row\.created_at,/)
})

test('the manual says the date is there and what it changes', () => {
  assert.match(MANUAL, /Day the money was taken/)
})
