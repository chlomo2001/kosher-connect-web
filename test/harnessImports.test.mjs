// The harness registries must be readable without a browser.
//
// ops/harness/*.mjs are dev tools that drive Chromium, but several of them
// also EXPORT plain data — modals.mjs exports MODALS, render.mjs exports TABS
// — which other harnesses and the unit tests import. A `require('playwright-core')`
// at module scope makes reading that list require a browser.
//
// That broke CI for 17 hours from 19 Aug 2026. playwright-core is not in
// package.json (it ships with the dev container), so `npm ci` does not install
// it; test/manualShots.test.mjs imports MODALS, the require threw, and the
// whole file failed to load — reported as one failure with its ten tests
// simply missing. Locally it passed, because the container has the browser.
//
// The rule: load the browser where it is used, not where the module is read.
import test from 'node:test'
import assert from 'node:assert'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const DIR = path.join(import.meta.dirname, '../ops/harness')
const files = readdirSync(DIR).filter((f) => f.endsWith('.mjs'))

test('the harness directory is actually being scanned', () => {
  assert.ok(files.length >= 10, `only ${files.length} harness files found — the glob is wrong`)
})

// The rule is narrower than "never at module scope", because most of these
// files are standalone scripts that nothing imports — there, paying for the
// browser on load is exactly right. It bites only for a module SOMEBODY ELSE
// IMPORTS: importing it to read a list should not need Chromium.
function importedByOthers() {
  const imported = new Set()
  const scan = (dir) => {
    for (const f of readdirSync(dir)) {
      if (!/\.(mjs|js)$/.test(f)) continue
      const src = readFileSync(path.join(dir, f), 'utf8')
      for (const m of src.matchAll(/from\s+['"](?:\.\.\/)*(?:ops\/harness\/|\.\/)([\w-]+\.mjs)['"]/g)) {
        if (path.join(dir, f) !== path.join(DIR, m[1])) imported.add(m[1])
      }
    }
  }
  scan(DIR)
  scan(path.join(import.meta.dirname))
  return imported
}

test('a harness module that others import does not load a browser to be read', () => {
  const shared = importedByOthers()
  assert.ok(shared.size >= 2, `expected several shared harness modules, found ${shared.size}`)
  const offenders = []
  for (const f of shared) {
    let src
    try { src = readFileSync(path.join(DIR, f), 'utf8') } catch { continue }
    for (const line of src.split('\n')) {
      const code = line.replace(/\/\/.*$/, '')
      if (!/playwright/.test(code)) continue
      if (!/\brequire\s*\(|\bfrom\s+['"]|\bimport\s*\(/.test(code)) continue
      // Lazy is the whole point: `const load = () => require(...)` at column 0
      // costs nothing until called. Only an EAGER top-level load is the bug.
      const lazy = /=>/.test(code) || /\bfunction\b/.test(code)
      if (!/^\s/.test(line) && !lazy) offenders.push(`${f}: ${line.trim().slice(0, 72)}`)
    }
  }
  assert.deepEqual(offenders, [],
    'load the browser inside the function that uses it — see the note at the top of this file')
})

// The registries themselves, imported for real. This is the check that would
// have caught the outage directly rather than by proxy.
test('MODALS and TABS import cleanly', async () => {
  const { MODALS, TRANSIENTS } = await import('../ops/harness/modals.mjs')
  assert.ok(Array.isArray(MODALS) && MODALS.length > 20, 'MODALS did not import as a list')
  assert.ok(Array.isArray(TRANSIENTS), 'TRANSIENTS did not import as a list')
  const { TABS } = await import('../ops/harness/render.mjs')
  assert.ok(Array.isArray(TABS) && TABS.length > 10, 'TABS did not import as a list')
})
