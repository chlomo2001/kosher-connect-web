// The staff stylesheet is generated, not committed. Run: npm test
//
// This exists because the generation step shipped broken once. It was wired to
// npm's `prebuild` hook, which works locally — and Vercel never runs it, because
// it detects Next and calls `next build` directly rather than `npm run build`.
// public/app.css was absent from the deployment, /app.css fell through to the
// [tab] dynamic route, and the staff app answered a stylesheet request with its
// own sign-in page. Every public page looked perfect throughout.
//
// So the contract under test is not "the script works" but "loading
// next.config.js puts the stylesheet on disk" — config load being the one hook
// that fires no matter how the build was started.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, rmSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public/app.css')
const require = createRequire(import.meta.url)

test('loading next.config.js generates the staff stylesheet', () => {
  rmSync(OUT, { force: true })
  assert.equal(existsSync(OUT), false, 'precondition: the generated file is gone')

  delete require.cache[require.resolve('../next.config.js')]
  delete require.cache[require.resolve('../scripts/build-app-css.cjs')]
  require('../next.config.js')

  assert.equal(existsSync(OUT), true, 'next.config.js must generate public/app.css')
})

test('the generated sheet carries the staff chrome, not the public pages', () => {
  const css = readFileSync(OUT, 'utf8')

  // A representative spread: sidebar, tables, till, modals. If the split ever
  // drops one of these on the floor the staff app loses its layout.
  for (const sel of ['.sidebar', '.table-wrap', '.pos-tile', '.modal-overlay', '.modal-title', '.tool-shell']) {
    assert.ok(css.includes(sel), `${sel} belongs in the staff sheet`)
  }

  // …and none of the public chrome, which would mean the split leaked and the
  // marketing pages are still paying for rules they cannot use.
  for (const sel of ['.w-topbar', '.pg-specs', '.rp-form']) {
    assert.ok(!css.includes(sel), `${sel} is public and must stay in globals.css`)
  }
})

test('the iOS zoom guard survives in both sheets', () => {
  // globals.css declares it for the public pages; the staff sheet has to repeat
  // it, because it loads last and would otherwise beat it with .search-box's
  // 14px and .kc-fs-sel's 13px — putting Safari's zoom-crop back on every phone
  // at the counter. Measured, once, at 730 elements.
  const app = readFileSync(OUT, 'utf8')
  const globals = readFileSync(path.join(ROOT, 'styles/globals.css'), 'utf8')
  const guard = /@media\s*\(max-width:\s*768px\)\s*\{[^}]*\.search-box[^}]*font-size/s

  assert.ok(guard.test(globals), 'globals.css must keep the guard for the public pages')
  assert.ok(guard.test(app), 'the staff sheet must repeat the guard to win the cascade')
})

test('comments are stripped on the way out, and only comments', () => {
  const src = readFileSync(path.join(ROOT, 'styles/app.css'), 'utf8')
  const out = readFileSync(OUT, 'utf8')

  // One banner is allowed; the 20KB of commentary that makes the source
  // readable is not something every member of staff should download.
  assert.ok(out.length < src.length, 'the generated sheet must be smaller than its source')
  assert.equal((out.match(/\/\*/g) || []).length, 1, 'only the generated-file banner survives')

  // Nothing that could change a value: every declaration in, every one out.
  const decls = (s) => (s.replace(/\/\*[\s\S]*?\*\//g, '').match(/[a-z-]+\s*:\s*[^;{}]+/g) || []).length
  assert.equal(decls(out), decls(src), 'stripping must not drop a declaration')
})
