// One element, two class attributes — and the browser silently keeps the first.
//
// This is the failure mode of adding an icon class to an element that already
// has one. Converting 96 emoji to CSS masks meant appending `kc-ic kc-ic-x` to
// hundreds of tags, and on a long line the existing class= is often 150
// characters away from where the icon goes. Write a second one and nothing
// complains: node --check passes (it is a string), the gate passes, the render
// harness passes, and the icon simply never appears. It reads on screen as "the
// icon didn't work" rather than as a mistake in the markup.
//
// It happened three times on 24 Aug — the overdue and returned rental badges
// and the reservation Start button — and all three were caught by eye, not by
// anything that runs.
//
// Scoped to opening tags in template literals, which is where this app builds
// its markup.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const FILES = ['public/main.js', 'public/guides.js', 'components/AppShell.js']

test('no element is given two class attributes', () => {
  const bad = []
  for (const f of FILES) {
    const src = readFileSync(f, 'utf8')
    src.split('\n').forEach((line, i) => {
      // Every opening tag on the line, quote-aware: an attribute value may hold
      // a `>` (onclick arrow functions do), so stopping at the first one splits
      // a tag in half and hides whatever came after it. That exact shortcut is
      // why three buttons were skipped when the icons went in.
      for (const m of line.matchAll(/<[a-zA-Z][^>"']*(?:"[^"]*"[^>"']*|'[^']*'[^>"']*)*>/g)) {
        const tag = m[0]
        const n = (tag.match(/(?:^|\s)class(?:Name)?\s*=/g) || []).length
        if (n > 1) bad.push(`${f}:${i + 1} — ${tag.slice(0, 90)}`)
      }
    })
  }
  assert.deepEqual(bad, [], `an element with two class attributes keeps only the first:\n${bad.join('\n')}`)
})
