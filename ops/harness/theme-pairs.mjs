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
const FILES = ['pages/welcome.js', 'pages/portal.js', 'pages/phone-guide.js', 'pages/login.js',
  // The legal shell serves /privacy, /terms and /refund. It was missing here,
  // and it had the gap the OTHER way round — see below.
  'components/LegalShell.js']

let bad = 0
for (const f of FILES) {
  // Comments are stripped first, or the check reads the prose explaining a rule
  // as the rule — these files document their theme decisions at length, and a
  // comment naming :root[data-theme="dark"] was reported as a half-written one.
  const src = readFileSync(path.join(ROOT, f), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
  if (!src.includes('prefers-color-scheme')) {
    console.log(`· ${f} — no OS-dark palette, nothing to pair`)
    continue
  }
  // A rule can be half-written in either direction, and BOTH are live bugs:
  //   attr only  — a visitor on a dark computer who never touched the toggle
  //                gets the dark paper (its token has both forms) under
  //                light-mode ink. Eleven /welcome selectors were here.
  //   media only — a customer who PRESSED the toggle gets nothing, because
  //                data-theme suppresses no media query but globals.css's
  //                [data-theme="dark"] tokens outrank a bare :root. That is
  //                how the privacy policy reached 1.14:1.
  // Palette blocks (no descendant selector) are tracked separately: they carry
  // the tokens everything else reads, so a one-sided palette is the widest
  // version of the same fault.
  const attr = new Set(), media = new Set()
  let attrPalette = false, mediaPalette = false
  const bareRoot = []
  for (const m of src.matchAll(/:root\[data-theme="dark"\]\s*([^{]*)\{/g)) {
    const sel = m[1].trim()
    if (!sel) { attrPalette = true; continue }
    for (const s of sel.split(',')) attr.add(s.trim())
  }
  for (const m of src.matchAll(/@media[^{]*prefers-color-scheme\s*:\s*dark[^{]*\)\s*\{\s*([^{]+)\{/g)) {
    let sel = m[1].trim()
    // Inside an OS-dark block the root must exclude an explicit choice. A bare
    // :root — or no root guard at all, which is how the legal shell wrote its
    // two link overrides — also fires for someone who chose LIGHT on a dark
    // machine, handing them a half-dark page they explicitly asked not to have.
    if (sel.startsWith(':root:not([data-theme])')) sel = sel.slice(':root:not([data-theme])'.length).trim()
    else {
      const guardless = sel.startsWith(':root') ? sel.slice(':root'.length).trim() : sel
      bareRoot.push(guardless || '(palette)')
      sel = guardless
    }
    if (!sel) { mediaPalette = true; continue }
    for (const s of sel.split(',')) media.add(s.trim())
  }
  const noTwin = [...attr].filter((s) => !media.has(s)).sort()
  const noAttr = [...media].filter((s) => !attr.has(s)).sort()
  if (mediaPalette && !attrPalette) noAttr.unshift('(the :root palette itself)')
  if (attrPalette && !mediaPalette) noTwin.unshift('(the :root palette itself)')
  const lines = []
  if (noTwin.length) lines.push(`${noTwin.length} with no prefers-color-scheme twin (wrong on a dark OS):\n    ${noTwin.join('\n    ')}`)
  if (noAttr.length) lines.push(`${noAttr.length} with no [data-theme="dark"] twin (wrong once the toggle is pressed):\n    ${noAttr.join('\n    ')}`)
  if (bareRoot.length) lines.push(`${bareRoot.length} OS-dark rule(s) on a bare :root — use :root:not([data-theme]):\n    ${bareRoot.join('\n    ')}`)
  bad += noTwin.length + noAttr.length + bareRoot.length
  console.log(lines.length ? `✗ ${f} — ${lines.join('\n  ')}` : `✓ ${f} — every dark rule has both forms`)
}
console.log(bad ? `\n${bad} selector(s) would be wrong in one of the two dark states` : '\nno half-written dark rules')
process.exit(bad ? 1 : 0)
