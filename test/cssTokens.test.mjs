// A custom property that was never defined does not fall back — it poisons the
// whole declaration.
//
// `outline: 2px solid var(--primary)` where --primary does not exist is
// INVALID AT COMPUTED-VALUE TIME: the property falls to its inherited or
// initial value, so outline-style became `none` and the links inside a read
// carrier email had no keyboard focus indicator at all. Nothing warns. The
// browser console says nothing. It renders as "that rule was never written".
//
// Found by a design audit on 24 Aug 2026, which named --primary; the same scan
// then turned up --fs-h2 (the customer's name on every Confirm-Data card
// rendering at body size), --radius-md (a row cornering square), --ink (twice,
// on the till's category buttons — the note at app.css "audit U13" says this
// exact token had already done it once before) and --bg-primary (two Kol Torah
// boxes painting no background at all).
//
// Six live faults from one typo class, one of them a WCAG 2.4.7 failure. So it
// gets a test rather than six fixes.
//
// The escape hatch is a FALLBACK: `var(--x, 6px)` is safe by construction and
// is deliberately not flagged — that is the correct spelling for a token set
// from JavaScript at runtime (--sb-w, --cat-h), which this scan cannot see.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const ROOT = new URL('..', import.meta.url)
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8')

// Comments must go FIRST. app.css carries the line "audit U13 — was
// var(--ink), undefined → invisible in dark mode", and the fix notes added
// alongside this test quote --primary and --bg-primary by name. A scanner that
// reads comments reports the tombstones as fresh bodies.
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '')

const FILES = ['styles/globals.css', 'styles/app.css', 'public/main.js']
const SRC = Object.fromEntries(FILES.map((f) => [f, strip(read(f))]))

const defined = new Set()
for (const src of Object.values(SRC)) {
  for (const m of src.matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)) defined.add(m[1])
  // main.js also sets tokens through the CSSOM (the rail width, the theme).
  for (const m of src.matchAll(/setProperty\(\s*['"](--[A-Za-z0-9_-]+)/g)) defined.add(m[1])
}

test('every var(--token) without a fallback names a token that exists', () => {
  const orphans = []
  for (const [file, src] of Object.entries(SRC)) {
    // var(--x) only — var(--x, anything) carries its own fallback and is safe.
    for (const m of src.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)\s*\)/g)) {
      if (!defined.has(m[1])) {
        const line = src.slice(0, m.index).split('\n').length
        orphans.push(`${file}:${line} → ${m[1]}`)
      }
    }
  }
  assert.deepEqual(orphans, [],
    'these declarations are silently dead — define the token, or give the var() a fallback')
})

test('the token vocabulary is big enough that this scan is worth running', () => {
  // A guard on the guard: if the regexes ever stop matching (a rewrite, a
  // different comment style), the test above would pass by finding nothing at
  // all. Pin the floor so silence means clean, not broken.
  assert.ok(defined.size > 80, `only ${defined.size} tokens found — the scan is probably not reading the files`)
})
