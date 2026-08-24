// kcTopModalOverlay answers "which dialog is on top?" for the Tab focus-trap
// and the phone-book letter-jump guard. Its probe list IS the z-order: the
// first open id wins. Until 24 Aug the list was missing kcPrompt, stackedModal,
// paletteOverlay and customerCard2 — so Tab in the house prompt walked the page
// behind the dialog, and Tab in a stacked modal (or a second customer card) was
// trapped inside the dialog UNDERNEATH the one on screen.
//
// These tests hold the list to the layers that actually exist, in the order
// they actually paint, and ratchet: a new modal-overlay id created in main.js
// must be added to the probe list before it ships.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const MAIN = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')

const fnSrc = MAIN.match(/function kcTopModalOverlay\(\) \{[\s\S]*?\n\}/)?.[0]
const list = fnSrc && fnSrc.match(/\[([^\]]+)\]/)?.[1]
  .split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean)

test('the probe list exists and covers every dialog layer', () => {
  assert.ok(list && list.length, 'kcTopModalOverlay or its id list is missing')
  for (const id of ['kcConfirm', 'kcPrompt', 'paletteOverlay', 'stackedModal',
    'kcShortcuts', 'dynamicModal', 'customerModal', 'customerCard2', 'customerCard']) {
    assert.ok(list.includes(id), `${id} is missing from the probe list — Tab will escape or mistrap its dialog`)
  }
})

test('the probe order matches the real z-order (3000 → 2000 → 1000 → 100 → 91 → 90)', () => {
  const at = (id) => list.indexOf(id)
  // kcConfirm/kcPrompt (z 3000, set inline where they are created) sit above
  // the palette (2000, app.css), above stackedModal (1000, .kc-stacked),
  // above the 100-layer modals, above the customer cards (91 over 90).
  for (const [above, below] of [
    ['kcConfirm', 'paletteOverlay'], ['kcPrompt', 'paletteOverlay'],
    ['paletteOverlay', 'stackedModal'],
    ['stackedModal', 'dynamicModal'], ['stackedModal', 'customerModal'],
    ['dynamicModal', 'customerCard2'], ['customerModal', 'customerCard2'],
    ['customerCard2', 'customerCard'],
  ]) {
    assert.ok(at(above) < at(below), `${above} must be probed before ${below}`)
  }
})

test('the Escape walk answers for the same layers as the Tab trap', () => {
  // Escape has its own top-down walk (the `if (open('id'))` chain). Until
  // 24 Aug it was missing kcPrompt, so Escape on the house prompt fell
  // through and closed the dialog UNDERNEATH it. Hold the two walks to the
  // same set of ids so one can never learn a layer the other forgets.
  const esc = MAIN.match(/if \(e\.key === 'Escape'\) \{\s*\n\s*const open =[\s\S]*?\n  \}/)?.[0]
  assert.ok(esc, 'the global Escape walk is missing')
  const escIds = [...esc.matchAll(/open\('([A-Za-z0-9]+)'\)/g)].map((m) => m[1])
  assert.deepEqual([...escIds].sort(), [...list].sort(),
    'Tab and Escape disagree about which dialog layers exist')
})

test('ratchet: every modal-overlay id created in main.js is in the probe list', () => {
  // Sites that assign a literal id and then make the element a .modal-overlay.
  // The customer cards assign a variable id (KC_CARD_SLOTS) and are asserted
  // by name above instead.
  const missing = []
  for (const m of MAIN.matchAll(/\.id = '([A-Za-z0-9]+)';\s*\n\s*\w+\.className = 'modal-overlay/g)) {
    if (!list.includes(m[1])) missing.push(m[1])
  }
  assert.deepEqual(missing, [],
    'these modal-overlay ids are invisible to kcTopModalOverlay — add them to the probe list at their z-layer')
})
