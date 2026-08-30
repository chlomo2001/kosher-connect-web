// Every status the code writes to email_log is one the table will accept.
//
// This has now cost the shop twice, both times silently:
//
//   18 Aug — 'received', 'opt_out' and 'invalid' were written by code and
//            missing from email_log_status_chk. The shop's FIRST real inbound
//            reply died on the constraint. Fixed by
//            20260818200000_email_log_inbound_statuses.sql, whose own note says
//            so.
//   30 Aug — 'seen' shipped in the app (task #71, "Seen, nothing needed") with
//            no migration behind it. Every press was refused by the database,
//            and because the write sat outside the handler's try the counter
//            was told "Could not reach the server." It had been reached.
//
// The tests that existed could not catch either: they run against seeded
// fixtures and a rendered page, and neither has a CHECK constraint in it. This
// one reads the two sources of truth in the repo — the migration that owns the
// constraint, and the code that writes the column — and holds them together.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const migDir = new URL('supabase/migrations/', root)

/** The live definition: the newest migration that rewrites the constraint. */
function allowedStatuses() {
  const files = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()
  let latest = null
  for (const f of files) {
    const sql = readFileSync(new URL(f, migDir), 'utf8')
    if (/add constraint email_log_status_chk/i.test(sql)) latest = { f, sql }
  }
  assert.ok(latest, 'no migration defines email_log_status_chk')
  const arr = latest.sql.match(/add constraint email_log_status_chk check \(\s*status = any \(array\[([\s\S]*?)\]/i)
  assert.ok(arr, `${latest.f}: could not read the allowed list`)
  return { file: latest.f, list: [...arr[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]) }
}

// Every file that WRITES the column. In each of these, a `status: 'x'` literal
// can only be an email_log status — the one other table any of them touches is
// email_suppressions, and that is read, never written.
//
// pages/api/cron/sweep.js is deliberately not here even though it names the
// table: it only reads delivery_status off it, while it writes a `status` to
// rentals and to sims ('overdue', 'renewal_pending', 'active'). Those belong to
// other tables with other rules, and a scan that swept them in would fail on
// its first run and be deleted by the second person who saw it.
const WRITERS = [
  'pages/api/sms.js', 'pages/api/email/webhook.js',
  'pages/api/sms-inbound.js', 'pages/api/message-log.js', 'pages/api/sms-status.js',
  'lib/email.js', 'lib/sms.js',
]

test('the constraint is defined in a migration and readable', () => {
  const { file, list } = allowedStatuses()
  assert.ok(list.length >= 11, `${file}: only ${list.length} statuses — that list looks truncated`)
  assert.equal(new Set(list).size, list.length, `${file}: a status is listed twice`)
})

test('every status the code writes is one the table accepts', () => {
  const { file, list } = allowedStatuses()
  const allowed = new Set(list)
  const offenders = []
  const seen = new Set()
  for (const rel of WRITERS) {
    const src = readFileSync(new URL(rel, root), 'utf8')
    // `status: 'x'` and `status=eq.x` — the two ways this column is named.
    // delivery_status is a different column with its own values.
    for (const m of src.matchAll(/(?<!delivery_)status:\s*'([a-z_]+)'/g)) {
      seen.add(m[1])
      if (!allowed.has(m[1])) offenders.push(`${rel} writes email_log.status '${m[1]}'`)
    }
    for (const m of src.matchAll(/(?<!delivery_)status=eq\.([a-z_]+)/g)) {
      seen.add(m[1])
      if (!allowed.has(m[1])) offenders.push(`${rel} filters email_log.status '${m[1]}'`)
    }
  }
  // A scan that finds nothing passes by seeing nothing, which is the way this
  // sort of test rots. Six statuses are written in plain sight today.
  assert.ok(seen.size >= 6, `the scan found only ${seen.size} statuses — it has stopped looking in the right place`)
  assert.deepEqual(offenders, [],
    `these would be refused by email_log_status_chk — widen it in a new migration, not by hand (${file} is the current one)`)
})

test("'seen' is in the constraint, because the app writes it", () => {
  // The specific one that broke on 30 Aug. Named rather than left to the sweep
  // above, so the reason it is there survives a refactor of this file.
  assert.ok(allowedStatuses().list.includes('seen'))
  const api = readFileSync(new URL('pages/api/message-log.js', root), 'utf8')
  assert.match(api, /\{ status: 'seen' \}/)
})

test('the seen write cannot escape as a 500 HTML page', () => {
  // The second half of what the counter actually saw. A database refusal has to
  // come back as JSON with a reason, or the browser's r.json() throws on the
  // error page and every cause reads as "could not reach the server".
  const api = readFileSync(new URL('pages/api/message-log.js', root), 'utf8')
  const post = api.match(/if \(req\.method === 'POST'\) \{[\s\S]*?\n  \}/)
  assert.ok(post, 'the POST branch has moved')
  assert.match(post[0], /try \{/, 'the seen write is outside a try again')
  assert.match(post[0], /catch \(e\) \{[\s\S]*?res\.status\(502\)\.json\(/,
    'a failed seen write no longer answers with JSON')
})

test('the browser stops calling a server answer a server it could not reach', () => {
  const src = readFileSync(new URL('public/main.js', root), 'utf8')
  const fn = src.match(/async function kcSendJson\([\s\S]*?\n\}/)
  assert.ok(fn, 'kcSendJson is gone')
  // The three outcomes it exists to tell apart.
  assert.match(fn[0], /Could not reach the server/)
  assert.match(fn[0], /could not read/)
  assert.match(fn[0], /refused that \(\$\{r\.status\}\)/)
  assert.match(src, /kcSendJson\('\/api\/message-log', \{ id, op: 'seen' \}\)/)
})
