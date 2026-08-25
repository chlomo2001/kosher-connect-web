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

test('the helper_tabs validator uses ALL_TABS, not a copy of it', () => {
  // It used to hold its own literal, which had already drifted — 'koltorah'
  // was missing, so ticking that box for a helper was dropped on save.
  const src = read('pages/api/settings.js')
  const block = src.slice(src.indexOf("key === 'helper_tabs'"), src.indexOf("key === 'helper_tabs'") + 900)
  assert.ok(block.includes('ALL_TABS.includes'), 'helper_tabs must validate against ALL_TABS')
  assert.ok(!/const ALL = \[/.test(block), 'helper_tabs must not keep its own tab list')
})

test('review — the tab that shipped hidden — is in all four', () => {
  assert.ok(allTabs().includes('review'))
  assert.ok(navTabs().includes('review'))
  assert.ok(metaTabs().includes('review'))
  assert.ok(helperCheckboxTabs().includes('review'))
})

// The visual harness keeps its own copy of the tab list, and a copy that drifts
// does not fail — it quietly stops looking. 'messages' shipped on 25 Aug and
// ops/harness/render.mjs still listed fifteen screens, so the overflow,
// contrast and touch-target sweeps skipped the new one and said "all 15 tabs"
// as though that were the app.
test('the visual harness sweeps every tab the app has', () => {
  const src = read('ops/harness/render.mjs')
  const m = src.match(/export const TABS = \[([\s\S]*?)\]/)
  assert.ok(m, 'TABS not found in ops/harness/render.mjs')
  const swept = [...m[1].matchAll(/'([a-z]+)'/g)].map((x) => x[1])
  for (const tab of allTabs()) {
    assert.ok(swept.includes(tab), `the harness never renders '${tab}' — it is in ALL_TABS`)
  }
  for (const tab of swept) {
    assert.ok(allTabs().includes(tab), `the harness renders '${tab}', which is not a tab`)
  }
})
