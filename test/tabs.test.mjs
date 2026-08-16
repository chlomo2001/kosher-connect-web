// The three tab lists must agree. Run: npm test
//
// A destination is declared in three places, and all three have to know about
// it or it half-exists:
//
//   components/AppShell.js  NAV       — the sidebar row you click
//   public/main.js          TAB_META  — what renders when you click it
//   lib/auth.js             ALL_TABS  — the server's allowlist, which IS the
//                                       owner's allowedTabs
//
// Miss the third and the tab is invisible in production to everyone, owner
// included — while the offline harness shows it working perfectly, because the
// harness runs with auth off and filters nothing. That is exactly how the
// Confirm Data tab shipped hidden on 16 Aug 2026.
//
// Read as text rather than imported: main.js is a browser script and AppShell
// is JSX, neither of which loads in a plain node test. The lists are plain
// literals, so a regex is honest here — and a test that runs beats a tidier one
// that does not.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

function allTabs() {
  const src = read('lib/auth.js')
  const m = src.match(/export const ALL_TABS = \[([\s\S]*?)\]/)
  assert.ok(m, 'ALL_TABS not found in lib/auth.js')
  return [...m[1].matchAll(/'([a-z]+)'/g)].map((x) => x[1])
}

function navTabs() {
  const src = read('components/AppShell.js')
  const m = src.match(/const NAV = \[([\s\S]*?)\n\]/)
  assert.ok(m, 'NAV not found in components/AppShell.js')
  return [...m[1].matchAll(/\['([a-z]+)',\s*'/g)].map((x) => x[1])
}

function metaTabs() {
  const src = read('public/main.js')
  const m = src.match(/const TAB_META = \{([\s\S]*?)\n\};/)
  assert.ok(m, 'TAB_META not found in public/main.js')
  return [...m[1].matchAll(/^\s{2}([a-z]+):\s*\{/gm)].map((x) => x[1])
}

// A FOURTH copy: the "What helpers can see" checkboxes in Settings. A tab
// missing here cannot be granted to a helper at all — the row simply is not on
// the screen to tick.
function helperCheckboxTabs() {
  const src = read('public/main.js')
  const m = src.match(/\$\{\[('dashboard'[^\]]*)\]\.map\(t => `/)
  assert.ok(m, 'the helper-access tab list not found in public/main.js')
  return [...m[1].matchAll(/'([a-z]+)'/g)].map((x) => x[1])
}

test('a helper can be granted every tab the server knows about', () => {
  const tickable = new Set(helperCheckboxTabs())
  for (const tab of allTabs()) {
    assert.ok(tickable.has(tab),
      `'${tab}' is in ALL_TABS but has no checkbox in Settings — it cannot be granted to a helper`)
  }
})

test('every sidebar destination is in the server allowlist', () => {
  const allowed = new Set(allTabs())
  for (const tab of navTabs()) {
    assert.ok(allowed.has(tab),
      `'${tab}' is in the sidebar but missing from ALL_TABS — it will be hidden in production`)
  }
})

test('every sidebar destination knows how to render', () => {
  const meta = new Set(metaTabs())
  for (const tab of navTabs()) {
    assert.ok(meta.has(tab), `'${tab}' is in the sidebar but has no TAB_META entry`)
  }
})

test('the allowlist grants nothing that cannot render', () => {
  const meta = new Set(metaTabs())
  for (const tab of allTabs()) {
    assert.ok(meta.has(tab), `ALL_TABS grants '${tab}', which has no TAB_META entry`)
  }
})

test('the lists are actually populated (a bad regex must fail loudly)', () => {
  assert.ok(allTabs().length >= 10)
  assert.ok(navTabs().length >= 10)
  assert.ok(metaTabs().length >= 10)
})

test('review — the tab that shipped hidden — is in all four', () => {
  assert.ok(allTabs().includes('review'))
  assert.ok(navTabs().includes('review'))
  assert.ok(metaTabs().includes('review'))
  assert.ok(helperCheckboxTabs().includes('review'))
})
