// The manual's pictures, held to the manual's words.
//
// A screenshot is the one part of a manual that rots invisibly: the prose is
// checked by manual.test.mjs, but an image is just a file, and a file of the
// Wallet screen as it looked in June will happily sit under a paragraph
// describing the Wallet screen as it is now. So the set of pictures is checked
// against the set of screens and dialogs the manual claims to describe.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, existsSync, statSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SCREENS } from '../lib/manual.mjs'
import { MODALS } from '../ops/harness/modals.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(ROOT, 'public/manual')
const shots = existsSync(DIR) ? new Set(readdirSync(DIR).filter(f => f.endsWith('.png')).map(f => f.slice(0, -4))) : new Set()

test('the pictures were built at all', () => {
  assert.ok(shots.size >= 30, `only ${shots.size} pictures in public/manual — run scripts/build-manual-shots.mjs`)
})

test('every written staff screen has a picture of itself', () => {
  const missing = SCREENS
    .filter(s => s.kind === 'staff' && s.status === 'written')
    .filter(s => !shots.has(`screen-${s.id}`))
    .map(s => s.id)
  assert.deepEqual(missing, [], `no picture for: ${missing.join(', ')} — run scripts/build-manual-shots.mjs`)
})

test('every dialog the manual describes has a picture of itself', () => {
  const ids = SCREENS.flatMap(s => s.dialogs.map(([id]) => id))
  const known = new Set(MODALS.map(([id]) => id))
  const missing = ids.filter(id => known.has(id) && !shots.has(`dialog-${id}`))
  assert.deepEqual(missing, [], `no picture for dialog: ${missing.join(', ')}`)
})

// The failure this exists for: a screen is deleted or renamed, its entry goes,
// and its photograph stays behind on disk to be served by a stale link.
test('no picture describes a screen that no longer exists', () => {
  const liveScreens = new Set(SCREENS.map(s => `screen-${s.id}`))
  const liveDialogs = new Set(MODALS.map(([id]) => `dialog-${id}`))
  const orphans = [...shots].filter(n => !liveScreens.has(n) && !liveDialogs.has(n))
  assert.deepEqual(orphans, [], `stale pictures in public/manual: ${orphans.join(', ')}`)
})

test('no picture is an empty or truncated file', () => {
  for (const n of shots) {
    const size = statSync(path.join(DIR, `${n}.png`)).size
    assert.ok(size > 3000, `${n}.png is ${size} bytes — that is not a screenshot`)
  }
})

// The page must actually put them on screen. Without this the pictures could
// all be present, correct and never rendered.
test('the manual page renders the pictures it is given', () => {
  const src = readFileSync(path.join(ROOT, 'pages/manual.js'), 'utf8')
  assert.match(src, /shots\[`screen-\$\{s\.id\}`\]/, 'screen pictures are not looked up')
  assert.match(src, /shots\[`dialog-\$\{id\}`\]/, 'dialog pictures are not looked up')
  assert.match(src, /<img[\s\S]{0,160}?src=\{screenShot\}/, 'the screen picture is never rendered')
  assert.match(src, /readdirSync/, 'the page never reads which pictures exist')
})

// A missing picture must degrade to the old text page, not to a broken image.
test('a screen with no picture still renders its words', () => {
  const src = readFileSync(path.join(ROOT, 'pages/manual.js'), 'utf8')
  assert.match(src, /\{screenShot && \(/, 'the screen picture is not guarded by its own existence')
  assert.match(src, /img \? \([\s\S]*?\) : \(/, 'a dialog without a picture must fall back to text')
})

test('worked examples reach both the page and the printed manual', () => {
  const withExample = SCREENS.filter(s => s.example)
  assert.ok(withExample.length >= 3, 'the examples went missing')
  for (const s of withExample) {
    assert.ok(s.example.title && s.example.steps?.length >= 3,
      `${s.id}: an example needs a title and steps worth reading`)
  }
  const page = readFileSync(path.join(ROOT, 'pages/manual.js'), 'utf8')
  assert.match(page, /s\.example/, 'the page ignores the examples')
  const md = readFileSync(path.join(ROOT, 'docs/MANUAL.md'), 'utf8')
  for (const s of withExample) {
    assert.ok(md.includes(s.example.title), `${s.id}: the example is missing from docs/MANUAL.md`)
    assert.ok(md.includes(s.example.steps[0]), `${s.id}: the example steps are missing from docs/MANUAL.md`)
  }
})

// The manual is staff-only: it describes how the shop is run. While building
// the picture pipeline the gate was lifted locally to photograph the page, and
// this is the guard that a bypass like that can never reach production.
test('the manual is behind the staff gate, unconditionally', () => {
  const src = readFileSync(path.join(ROOT, 'pages/manual.js'), 'utf8')
  const gssp = src.slice(src.indexOf('export async function getServerSideProps'))
  assert.match(gssp, /const gate = await requireStaffCookie\(req\)\s*\n\s*if \(gate\) return gate/,
    'the staff gate must be unconditional — no env flag, no ternary, no preview mode')
  assert.doesNotMatch(src, /PREVIEW|BYPASS|process\.env\.[A-Z_]*MANUAL/,
    'a bypass was left in the manual page')
})
