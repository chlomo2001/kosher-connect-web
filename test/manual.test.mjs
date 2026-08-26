// The teeth. lib/manual.mjs is only worth having if it cannot fall behind the
// app, and nothing in this repo has ever stayed current on good intentions —
// docs/ is thirty files of proof. So the manual is held to the code:
//
//   • a screen with no entry fails       (ALL_TABS, and the harness page list)
//   • a dialog with no entry fails       (the harness MODALS registry)
//   • a renamed tab or button fails      (TAB_META)
//   • a stale docs/MANUAL.md fails       (it is generated, so it is checkable)
//
// Add a tab, add a modal, rename a primary button — npm test goes red and the
// gate refuses to ship until the sentence is written.
//
// The registries are read as TEXT rather than imported, the same trick and for
// the same reason as test/tabs.test.mjs: main.js is a browser script and the
// harness modules pull in playwright, neither of which loads in a plain node
// test. They are plain literals, so a regex is honest here.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SCREENS, screen, screensOf, draftScreens, manualDialogs } from '../lib/manual.mjs'
import { manualMarkdown } from '../scripts/build-manual.mjs'
import { ALL_TABS } from '../lib/auth.js'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

/** name → tab, from the harness modal registry. */
function harnessModals() {
  const src = read('ops/harness/modals.mjs')
  const m = src.match(/export const MODALS = \[([\s\S]*?)\n\]/)
  assert.ok(m, 'MODALS not found in ops/harness/modals.mjs')
  const rows = [...m[1].matchAll(/^\s*\['([a-z0-9-]+)',\s*'([a-z]+)'/gm)]
  return new Map(rows.map((r) => [r[1], r[2]]))
}

/** page key → source file, from the harness public-page registry. */
function harnessPages() {
  const src = read('ops/harness/public.mjs')
  const m = src.match(/export const PAGES = \{([\s\S]*?)\}/)
  assert.ok(m, 'PAGES not found in ops/harness/public.mjs')
  const rows = [...m[1].matchAll(/'?([a-z-]+)'?\s*:\s*'(pages\/[^']+)'/g)]
  return new Map(rows.map((r) => [r[1], r[2]]))
}

/** tab → { label, primary } from the browser app's tab table. */
function tabMeta() {
  const src = read('public/main.js')
  const m = src.match(/const TAB_META = \{([\s\S]*?)\n\};/)
  assert.ok(m, 'TAB_META not found in public/main.js')
  const out = new Map()
  for (const line of m[1].split('\n')) {
    const id = line.match(/^\s{2}([a-z]+):\s*\{/)
    if (!id) continue
    const label = line.match(/label:\s*'([^']+)'/)
    const primary = line.match(/primary:\s*\{\s*label:\s*'([^']+)'/)
    out.set(id[1], { label: label ? label[1] : null, primary: primary ? primary[1] : null })
  }
  return out
}

const staff = () => screensOf('staff')
const written = () => SCREENS.filter((s) => s.status === 'written')
const prose = (s) => [s.what, ...s.parts.flat(), ...s.dialogs.flat(), ...s.rules, ...s.wrong.flat()].join(' ')

// ── Coverage: nothing in the app is left undescribed ──────────────────────
test('every screen in the app has a manual entry', () => {
  const covered = new Set(staff().map((s) => s.id))
  const missing = ALL_TABS.filter((t) => !covered.has(t))
  assert.deepEqual(missing, [], `no manual entry for: ${missing.join(', ')}`)
})

test('every manual entry points at a real screen', () => {
  for (const s of staff()) {
    assert.ok(ALL_TABS.includes(s.id), `the manual describes "${s.id}", which is not a tab`)
  }
  const pages = harnessPages()
  for (const s of screensOf('public')) {
    assert.ok(pages.has(s.id), `the manual describes "${s.id}", which is not a page`)
  }
})

test('every public page has a manual entry, at the address it actually lives at', () => {
  const pages = harnessPages()
  for (const [key, file] of pages) {
    const s = screen(key)
    assert.ok(s, `no manual entry for the ${key} page`)
    // pages/tools/contacts.js → /tools/contacts. A page that moves takes its
    // manual entry with it or this fails.
    const expected = '/' + file.replace(/^pages\//, '').replace(/\.js$/, '')
    assert.equal(s.path, expected, `the manual sends people to ${s.path} for ${key}; it lives at ${expected}`)
  }
})

test('the frame entry describes controls that still exist', () => {
  // The chrome belongs to no tab, so there is no tab list to hold it to. Its
  // anchors are the ids and attributes of the controls it describes, looked up
  // in the shell and the browser script: rename the burger, drop the palette
  // button, and the entry that explains them fails with it.
  const src = read('components/AppShell.js') + read('public/main.js')
  const frame = screensOf('frame')
  assert.equal(frame.length, 1, 'there should be exactly one entry for the app frame')
  for (const f of frame) {
    assert.ok(f.anchors?.length >= 6, `${f.id}: too few anchors to catch a rename`)
    for (const a of f.anchors) {
      assert.ok(src.includes(a), `${f.id}: nothing in the app is called "${a}" any more`)
    }
    assert.equal(f.tab, undefined, 'the frame belongs to no tab')
    assert.equal(f.path, undefined, 'the frame has no address of its own')
  }
})

test('the frame is described where a reader will meet it — before the screens', () => {
  // It is the part of the app you are looking at before you have chosen a
  // screen, so it reads first. Also stops it being appended to the end and
  // quietly never read.
  assert.equal(SCREENS[0].kind, 'frame')
})

test('every dialog in the app has a manual entry', () => {
  // Coverage only, NOT "filed under the tab the harness uses". The harness's
  // tab is merely somewhere the box can be opened from for a screenshot —
  // cash-up is listed there under the dashboard and staff actually reach it
  // from Wallet and from the till. The manual has to say where a person finds
  // it, so the manual owns that mapping and this test does not second-guess it.
  const modals = harnessModals()
  assert.ok(modals.size >= 20, 'the modal registry did not parse — a bad regex must fail loudly')
  const documented = new Set(manualDialogs())
  for (const id of modals.keys()) {
    assert.ok(documented.has(id), `the "${id}" dialog is in the harness but nowhere in the manual`)
  }
})

test('the manual does not describe dialogs that no longer exist', () => {
  const modals = harnessModals()
  for (const id of manualDialogs()) {
    assert.ok(modals.has(id), `the manual describes a "${id}" dialog that the harness does not know about`)
  }
})

test('a dialog is documented once, not twice', () => {
  const ids = manualDialogs()
  assert.equal(new Set(ids).size, ids.length, 'two screens claim the same dialog')
})

// ── Drift: a rename in the app must be a rename in the manual ─────────────
test('every screen is called what the app calls it', () => {
  const meta = tabMeta()
  for (const s of staff()) {
    assert.equal(s.name, meta.get(s.id)?.label,
      `the manual calls ${s.id} "${s.name}"; the app calls it "${meta.get(s.id)?.label}"`)
  }
})

test("a written screen names its own main button, spelled the way the button is", () => {
  // The drift tooth. It only bites written entries — a draft has no button list
  // yet — so it gets sharper with every screen that lands.
  const meta = tabMeta()
  for (const s of written().filter((x) => x.kind === 'staff')) {
    const primary = meta.get(s.id)?.primary
    if (!primary) continue
    const labels = s.parts.map(([label]) => label).join(' | ')
    // Compared without the leading "+ " / emoji, which differ between the
    // topbar button and the one on the screen itself.
    const bare = primary.replace(/^[+\s]*/, '').toLowerCase()
    assert.ok(labels.toLowerCase().includes(bare),
      `${s.id}: the app's main button is "${primary}"; the manual lists ${labels}`)
  }
})

// ── The standard for a finished entry ─────────────────────────────────────
test('a written screen is actually usable', () => {
  for (const s of written()) {
    assert.match(s.what, /\.$/, `${s.id}: "what" should be a full sentence`)
    assert.ok(s.what.length > 40, `${s.id}: "what" is too thin to tell anyone anything`)
    assert.ok(s.parts.length >= 3, `${s.id}: ${s.parts.length} part(s) is not a description of a screen`)
    assert.ok(s.rules.length >= 1, `${s.id}: no rules — if there are genuinely none, say so in one`)
    assert.ok(s.wrong.length >= 1, `${s.id}: nothing about what to do when it goes wrong`)
    for (const [label, text] of [...s.parts, ...s.dialogs, ...s.wrong]) {
      assert.ok(label.length > 2, `${s.id}: "${label}" is not a label`)
      assert.ok(text.length > 20, `${s.id}: "${label}" — "${text}" is too terse to help anyone`)
    }
  }
})

test('the manual is written for someone with no training', () => {
  // Same standard the guides are held to. A helper covering the counter for an
  // afternoon has never heard of a payload.
  for (const s of SCREENS) {
    assert.doesNotMatch(prose(s), /\b(API|JSON|endpoint|payload|null|boolean|schema|PostgREST|webhook)\b/,
      `${s.id}: the manual uses developer words`)
  }
})

test('the manual quotes no prices — there is one price list and this is not it', () => {
  // Rates, caps, deposits and day counts live in BUSINESS_RULES.md and in
  // Settings. A number copied here is a second price list, and the day it
  // disagrees with the till is the day someone is charged the wrong amount.
  for (const s of SCREENS) {
    assert.doesNotMatch(prose(s), /£\s*\d/, `${s.id}: the manual quotes a price — point at Settings instead`)
    assert.doesNotMatch(prose(s), /\b\d+\s*(days?|months?)\b/i,
      `${s.id}: the manual quotes a period — say what changes it, not what it is`)
  }
})

test('the manual carries no customer data', () => {
  // It is generated into a file, printed and pinned up by the till. Passport
  // numbers are PII (CLAUDE.md), and a real phone number or IMEI has no
  // business being an example either.
  for (const s of SCREENS) {
    assert.doesNotMatch(prose(s), /\d{6,}/, `${s.id}: a long number in the manual looks like real customer data`)
  }
})

// ── The ratchet ───────────────────────────────────────────────────────────
// May only ever go DOWN. Writing a screen out in full lowers it by one; a new
// screen cannot raise it without an edit here that shows up in review — which
// is the point, because "I will document it later" is how the last thirty
// documents in docs/ got the way they are.
const DRAFT_BUDGET = 0

test('the unwritten screens are exactly the ones we admit to', () => {
  const drafts = draftScreens().map((s) => s.id)
  assert.equal(drafts.length, DRAFT_BUDGET,
    `${drafts.length} screens are still drafts, the budget says ${DRAFT_BUDGET}: ${drafts.join(', ')}`)
})

test('every entry says something true even while it is a draft', () => {
  for (const s of SCREENS) {
    assert.ok(s.what && s.what.length > 40, `${s.id}: even a draft owes the reader one honest sentence`)
    assert.ok(['written', 'draft'].includes(s.status), `${s.id}: unknown status "${s.status}"`)
    assert.ok(['staff', 'public', 'frame'].includes(s.kind), `${s.id}: unknown kind "${s.kind}"`)
    assert.match(s.id, /^[a-z0-9-]+$/, `${s.id} is not a plain slug`)
  }
  const ids = SCREENS.map((s) => s.id)
  assert.equal(new Set(ids).size, ids.length, 'two screens share an id')
})

// ── The printed copy ──────────────────────────────────────────────────────
test('the manual prints as a whole document, not as one page', () => {
  // Three things clip a printout of this page and all three have to be undone:
  // html/body are height:100% for the app frame, body is overflow:hidden, and
  // #__next is a fixed-height flex row. Miss any one and the print stops at the
  // fold — which is exactly what shipped on 18 Aug, and what "only the visible
  // screen prints" looked like from the outside.
  const css = read('styles/app.css')
  const block = css.slice(css.indexOf('/* ── /manual'))
  const print = block.slice(block.indexOf('@media print'))
  assert.match(print, /html, body\.kc-manual \{ height: auto; overflow: visible; \}/)
  assert.match(print, /body\.kc-manual #__next \{ display: block; height: auto; overflow: visible; \}/)
  assert.match(print, /\.kc-man-shell \{ height: auto; overflow: visible; \}/)
  // …and the class those rules hang on has to actually be put on the body.
  assert.match(read('pages/manual.js'), /classList\.add\('kc-manual'\)/,
    'nothing adds the kc-manual class, so the print rules never apply')
})

test('the manual is reachable from the menu, not only from inside the help panel', () => {
  const shell = read('components/AppShell.js')
  assert.match(shell, /href="\/manual"/, 'the sidebar has no link to the manual')
  assert.match(read('public/main.js'), /window\.open\('\/manual'/, 'the command palette has no way to the manual')
  assert.match(read('public/main.js'), /href="\/manual"/, 'the help panel has no link to the manual')
})


test('docs/MANUAL.md is up to date', () => {
  assert.equal(read('docs/MANUAL.md'), manualMarkdown(),
    'docs/MANUAL.md has fallen behind lib/manual.mjs — run: node scripts/build-manual.mjs')
})

// ── The pictures ──────────────────────────────────────────────────────────
// Added 26 Aug, after the nightly touch-target audit measured the dialog
// thumbnails at 328×2 on a phone. Every picture on /manual is lazy, and a lazy
// picture with no declared size has no height until it arrives — so the links
// wrapped around them were, for a moment on every load and for ever if a file
// is missing, two pixels tall. The size comes from the PNG header now.
test('a PNG measures, and an unmeasurable file says so rather than guessing', async () => {
  const { pngSize } = await import('../lib/pngSize.mjs')
  const real = pngSize(new URL('../public/manual/dialog-cashup.png', import.meta.url).pathname)
  assert.ok(real.w > 0 && real.h > 0, 'a real screenshot must measure')
  // Not a PNG, and not there at all — both must be {}, never a throw and never
  // a made-up number: a wrong height reserves the wrong box on every screen.
  assert.deepEqual(pngSize(new URL('../package.json', import.meta.url).pathname), {})
  assert.deepEqual(pngSize('/no/such/file.png'), {})
})

test('every lazy picture on the manual declares the space it will need', () => {
  const SRC = readFileSync(new URL('../pages/manual.js', import.meta.url), 'utf8')
  const imgs = SRC.match(/<img\b[\s\S]*?\/>/g) || []
  assert.ok(imgs.length >= 3, `only ${imgs.length} pictures found — the scan has drifted`)
  for (const img of imgs) {
    if (!/loading="lazy"/.test(img)) continue
    assert.match(img, /\{\.\.\.shotAttrs\(/,
      `a lazy picture with no declared size:\n${img}\nit will have no height until it loads, and anything wrapping it collapses`)
  }
})

test('the manual builds its shot list with sizes, not bare paths', () => {
  // Both prop loaders — the real page and the offline harness — must agree, or
  // the harness measures a page the reader never sees.
  for (const [file, where] of [['../pages/manual.js', 'the page'], ['../ops/harness/public.mjs', 'the harness']]) {
    const src = readFileSync(new URL(file, import.meta.url), 'utf8')
    assert.match(src, /pngSize\(/, `${where} builds its shot list without measuring the files`)
  }
})
