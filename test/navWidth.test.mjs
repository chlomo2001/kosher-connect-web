// The sidebar's width lives in two files and they have to agree.
//
// styles/app.css carries the width the rail paints at before any script runs
// (`width: var(--sb-w, 208px)`); public/main.js carries the default the grip
// resets to and the floor and ceiling it clamps a drag between. Let those drift
// and the rail jumps on load — one width for the half-second before main.js
// runs, another after — which reads as the app being broken on every sign-in.
//
// Read as text, like test/tabs.test.mjs: main.js is a browser script and app.css
// is a stylesheet, and neither loads in a plain node test.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

function jsWidths() {
  const src = read('public/main.js')
  const m = src.match(/const SB_W_KEY = '([^']+)', SB_W_DEFAULT = (\d+), SB_W_MIN = (\d+), SB_W_MAX = (\d+)/)
  assert.ok(m, 'the sidebar width constants were not found in public/main.js')
  return { key: m[1], def: Number(m[2]), min: Number(m[3]), max: Number(m[4]) }
}

const cssVar = (name, prop) => {
  const src = read('styles/app.css')
  const m = src.match(new RegExp(`${prop}:\\s*var\\(${name},\\s*(\\d+)px\\)`))
  assert.ok(m, `${prop}: var(${name}, …) not found in styles/app.css`)
  return Number(m[1])
}

function railWidth() {
  const src = read('styles/app.css')
  const m = src.match(/body\.nav-collapsed \.sidebar \{ width: (\d+)px/)
  assert.ok(m, 'the collapsed rail width was not found in styles/app.css')
  return Number(m[1])
}

test('the stylesheet and the script agree on how wide the menu starts', () => {
  assert.equal(cssVar('--sb-w', 'width'), jsWidths().def,
    'the CSS fallback width and SB_W_DEFAULT differ — the rail would jump when main.js loads')
})

test('the clamp makes sense', () => {
  const { min, def, max } = jsWidths()
  assert.ok(min < def && def < max, `the default ${def} must sit inside ${min}–${max}`)
  // The floor exists so a nav label cannot be silently truncated: every row is
  // white-space:nowrap inside an overflow-hidden rail, so a too-narrow sidebar
  // does not wrap or scroll — it just cuts the words off.
  assert.ok(min >= 180, 'below ~180px the longest nav label starts being cut off')
})

test('a dragged sidebar can never be mistaken for the collapsed rail', () => {
  // Two states the burger toggles, plus a width you choose. If a drag could
  // reach the rail's width, "collapsed" would stop meaning anything — and the
  // rail hides its labels, which a merely-narrow sidebar does not.
  assert.ok(railWidth() < jsWidths().min,
    'the drag floor must stay above the collapsed rail width')
})

test('the grip is in the shell, and is a separator a keyboard can reach', () => {
  const src = read('components/AppShell.js')
  assert.match(src, /id="navGrip"/, 'the sidebar grip is missing from the shell')
  assert.match(src, /role="separator"/, 'the grip should be a separator, not a button')
  assert.match(src, /tabIndex=\{0\}/, 'the grip must be reachable from the keyboard')
  assert.match(src, /aria-label="Resize the menu"/, 'the grip needs a name')
})

test('the two states that own their own width hide the grip', () => {
  // The collapsed rail animates its width, and the phone drawer slides over the
  // content — a 7px drag target on either is a mis-tap, not a feature.
  const src = read('styles/app.css')
  assert.match(src, /body\.nav-collapsed \.sb-grip \{ display: none; \}/)
  assert.match(src, /@media \(max-width: 820px\) \{ \.sb-grip \{ display: none; \} \}/)
})

test('a live drag switches the width transition off', () => {
  // The rail carries a 0.2s width transition for the ⌘B collapse. Left on
  // during a drag, the edge trails the pointer and the app feels slow.
  assert.match(read('styles/app.css'), /body\.kc-resizing-x \.sidebar \{ transition: none; \}/)
})
