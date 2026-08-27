// The product, checked against the standard — this way round on purpose.
//
// docs/brand/standard.json DECIDES the brand. styles/globals.css has to agree
// with it, and when they disagree the CSS is wrong. That is the inversion the
// owner asked for on 27 Aug 2026: "i dont realy want the 'site' to tell the
// branding sheet the brand, i want the pdf/whtever sheet to be the main doc
// deciding branding and marketing, and work the other way round."
//
// It used to run the other way and the README said so out loud — "colours are
// sampled pixel-by-pixel out of logo-full.png; the type ramp and the tokens are
// read from styles/globals.css… which is the intended relationship". In
// practice it was worse than either direction: ops/brand/kit.py held the values
// as Python literals with comments naming the tokens they mirrored, so the
// document was a hand-transcribed COPY that could disagree with the product in
// silence. It already had — BLUE_TOK sat at #0060a8 commented "--kc-blue, as
// declared" long after the owner moved --kc-blue to #07639e, and nothing
// noticed, because nothing read it.
//
// A brand standard that is downstream of the code cannot govern the code. So:
// one authored file, the PDF typeset from it, and this asserting the product
// declares exactly what it says.
//
//   node ops/harness/brandTokens.mjs
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (f) => readFileSync(path.join(ROOT, f), 'utf8')
const STANDARD = JSON.parse(read('docs/brand/standard.json'))
const CSS = read('styles/globals.css')

let bad = 0
const fail = (what, detail = []) => { bad++; console.log(`✗ ${what}`); detail.forEach((d) => console.log(`    ${d}`)) }
const pass = (what) => console.log(`✓ ${what}`)

// ── every palette token is declared, at exactly the standard's value ──────
//
// Read from the :root block only. The dark theme deliberately re-points
// semantic aliases (--accent becomes the bright blue) and that is not drift —
// what must not move is the brand VALUE itself.
const rootBlock = CSS.slice(CSS.indexOf(':root'), CSS.indexOf('[data-theme') > -1
  ? CSS.indexOf('[data-theme') : CSS.length)

const declared = new Map()
for (const m of rootBlock.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
  declared.set(m[1], m[2].toLowerCase())
}

const wrong = []
const missing = []
for (const [name, spec] of Object.entries(STANDARD.palette)) {
  if (name.startsWith('$')) continue
  const want = String(spec.hex).toLowerCase()
  const got = declared.get(spec.token)
  if (got === undefined) { missing.push(`${spec.token} (${name}) is not declared in :root`); continue }
  if (got !== want) {
    wrong.push(`${spec.token} is ${got}, the standard says ${want} — ${spec.role}`)
  }
}

if (missing.length || wrong.length) {
  fail(`the palette does not match docs/brand/standard.json (${wrong.length + missing.length})`,
    [...wrong, ...missing,
      '',
      'The standard decides. Either change styles/globals.css to match it, or',
      'change the standard on purpose and rebuild the PDF (ops/brand/README.md).'])
} else {
  pass(`palette: ${Object.keys(STANDARD.palette).length - 1} tokens declared exactly as the standard says`)
}

// ── the document's own furniture must not leak into the product ──────────
//
// print_only values exist to draw the standard — rules and hairlines on a
// page. A product token set to one of them means somebody read a colour off
// the PDF instead of out of the palette.
const leaked = []
for (const [k, hex] of Object.entries(STANDARD.print_only)) {
  if (k.startsWith('$')) continue
  for (const [tok, val] of declared) {
    if (val === String(hex).toLowerCase()) leaked.push(`${tok} = ${val} is print_only.${k} — a page colour, not a brand value`)
  }
}
leaked.length ? fail('print-only colour used as a product token', leaked)
              : pass('print-only colours stay in the document')

// ── the accessibility floor is a brand commitment, not a harness setting ──
//
// The numbers the sweeps enforce have to come from the same place as the
// colours, or the standard can promise AAA while the harness quietly measures
// AA. Pinned here so moving one without the other fails.
const a = STANDARD.accessibility
const floorProblems = []
if (a.contrast_body.ratio !== 7) floorProblems.push(`contrast_body is ${a.contrast_body.ratio}, AAA body text is 7:1`)
if (a.contrast_large.ratio !== 4.5) floorProblems.push(`contrast_large is ${a.contrast_large.ratio}, AAA large text is 4.5:1`)
if (a.target_min_px !== 44) floorProblems.push(`target_min_px is ${a.target_min_px}, WCAG 2.5.5 is 44`)

const harness = read('ops/harness/render.mjs')
if (!/wantAAA \? \(large \? 4\.5 : 7\)/.test(harness)) {
  floorProblems.push('render.mjs no longer measures 7:1 / 4.5:1 for --aaa — the standard would be promising a bar nothing checks')
}
floorProblems.length ? fail('the accessibility floor and what enforces it have parted company', floorProblems)
                     : pass(`floor: ${a.contrast_body.ratio}:1 body, ${a.target_min_px}px targets, and the harness measures both`)

console.log(bad ? `\nBRAND TOKENS: ${bad} check(s) failed — the product disagrees with the standard.`
                : '\nbrand tokens: the product declares what the standard decides.')
process.exit(bad ? 1 : 0)
