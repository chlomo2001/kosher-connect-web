// Every db.<method>() the app calls must exist on the client. Run: npm test
//
// Written the morning of 26 Aug, after the owner asked why the digest email
// never came. It had been scheduled since 21 Aug and returning a green 200
// every day. The endpoint read its tasks like this:
//
//     db.from('tasks').select('title, priority, …').eq('done', false)
//
// which is supabase-js. lib/db.js is not supabase-js — it is a thin PostgREST
// wrapper with `select`, `insert`, `update` and six others, and no `from` at
// all. So the call threw TypeError before a single line of the digest was
// built, every morning for five days, and nothing anywhere said so: a cron
// that 500s is invisible, and a digest that never arrives is exactly what a
// HOLD-gated digest looks like.
//
// One wrong method name, one line, five silent days. This test reads the
// client's real shape at runtime and holds every caller to it, so the next
// wrong name fails the gate instead of the morning.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { db } from '../lib/db.js'

const ROOT = path.join(import.meta.dirname, '..')
const METHODS = new Set(Object.keys(db))

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) { walk(full, out); continue }
    if (/\.(js|mjs)$/.test(name)) out.push(full)
  }
  return out
}

// Comments are stripped before scanning: this file's own header quotes the
// broken call, and a test that trips over prose is a test somebody weakens.
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')

// Only files that import the client. lib/migrationDrift.mjs has a local array
// called `db` and calls db.filter() on it, which is none of this test's
// business — narrowing by the import keeps the scan honest rather than
// carrying a name-based exception list that would hide a real one later.
const CALLERS = [...walk(path.join(ROOT, 'pages')), ...walk(path.join(ROOT, 'lib'))]
  .map((file) => ({ file, src: strip(readFileSync(file, 'utf8')) }))
  .filter(({ src }) => /import\s*\{[^}]*\bdb\b[^}]*\}\s*from\s*['"][^'"]*db\.js['"]/.test(src))

test('every file that imports the client is scanned', () => {
  // The scan is worth nothing if the import pattern stops matching and it
  // silently checks zero files.
  assert.ok(CALLERS.length > 20, `only ${CALLERS.length} db callers found — the import match has drifted`)
})

test('the db client is only called by names it actually has', () => {
  const wrong = []
  for (const { file, src } of CALLERS) {
    // `db.foo(` — the property access, not `.db.foo` on some other object.
    for (const m of src.matchAll(/(^|[^.\w])db\.([A-Za-z_$][\w$]*)\s*\(/g)) {
      if (!METHODS.has(m[2])) wrong.push(`${path.relative(ROOT, file)}: db.${m[2]}()`)
    }
  }
  assert.deepEqual(wrong, [],
    `db has no such method — lib/db.js is PostgREST, not supabase-js (it has: ${[...METHODS].join(', ')})`)
})

test('nothing reaches for the supabase-js query builder', () => {
  // The specific shape that got in. The app has one data layer and it does
  // not chain: no .from(), no .eq(), no { data, error } destructuring.
  for (const { file, src } of CALLERS) {
    const where = path.relative(ROOT, file)
    assert.doesNotMatch(src, /\bdb\.from\s*\(/,
      `${where} calls db.from() — use db.select() / selectAllPaged() with a PostgREST query string`)
    assert.doesNotMatch(src, /const\s*\{\s*data\s*[,:][^}]*\berror\b[^}]*\}\s*=\s*await\s+db\b/,
      `${where} destructures { data, error } — db helpers return rows and throw on failure`)
  }
})

test('the digest reads its tasks through a helper that exists', () => {
  const src = readFileSync(path.join(ROOT, 'pages/api/cron/digest.js'), 'utf8')
  assert.match(src, /selectAllPaged\('tasks'/,
    'the digest must read tasks with selectAllPaged — a plain select caps at 1000 rows')
  assert.match(src, /done=is\.false/, 'the digest must ask the database for open tasks only')
  // A throw here used to become a 500 with no explanation anywhere. It is
  // caught and logged now, because this endpoint has no human watching it.
  assert.match(src, /catch \(e\)[\s\S]{0,200}console\.error\('\[cron\/digest\]/,
    'a failed task read must be logged — nobody is watching this endpoint run')
})
