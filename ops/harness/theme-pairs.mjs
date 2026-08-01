// Dark-mode rules that only got written once.
//
//   node ops/harness/theme-pairs.mjs
//
// /welcome ships its OWN OS-dark palette, so every dark rule there needs two
// forms: `:root[data-theme="dark"] X` for someone who used the toggle, and
// `@media (prefers-color-scheme:dark) :root:not([data-theme]) X` for someone
// who never touched it. Write only the first and a visitor on a dark computer
// gets the dark paper — that token has both — with light-mode ink on top.
// Eleven selectors were in that state, including the ghost "My account" button
// at 2.86:1.
//
// styles/globals.css is EXEMPT and must stay exempt: it has no OS-dark palette
// at all, every dark token lives under [data-theme="dark"], and html pins
// color-scheme: light. An OS-preference rule there would swap one layer to dark
// while everything behind it stayed light — the same bug, inverted. That
// reasoning is written out at the .pd-logo rule; read it before "fixing" this.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const FILES = ['pages/welcome.js', 'pages/portal.js', 'pages/join.js', 'pages/phone-guide.js', 'pages/login.js']

let bad = 0
for (const f of FILES) {
  const src = readFileSync(path.join(ROOT, f), 'utf8')
  if (!src.includes('prefers-color-scheme')) {
    console.log(`· ${f} — no OS-dark palette, nothing to pair`)
    continue
  }
  const attr = new Set(), media = new Set()
  for (const m of src.matchAll(/:root\[data-theme="dark"\]\s+([^{]+)\{/g)) {
    for (const s of m[1].split(',')) attr.add(s.trim())
  }
  for (const m of src.matchAll(/:root:not\(\[data-theme\]\)\s+([^{,]+)/g)) {
    media.add(m[1].trim().replace(/\{$/, '').trim())
  }
  const gap = [...attr].filter((s) => !s.startsWith(':root') && !media.has(s)).sort()
  bad += gap.length
  console.log(gap.length
    ? `✗ ${f} — ${gap.length} dark rule(s) with no prefers-color-scheme twin:\n    ${gap.join('\n    ')}`
    : `✓ ${f} — every dark rule has both forms`)
}
console.log(bad ? `\n${bad} selector(s) would be wrong on a dark OS` : '\nno half-written dark rules')
process.exit(bad ? 1 : 0)
