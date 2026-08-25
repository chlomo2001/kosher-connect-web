// The brand standard, checked against the code.
//
// docs/brand/KOSHER-CONNECT-BRAND-STANDARD.pdf makes claims about this product.
// A claim nobody checks is a claim that quietly stops being true — plate 11 says
// exactly that about itself, and it would be a poor document if the sentence did
// not apply to it. This is the enforcement half.
//
// Static only: no browser, well under a second, so it can sit in --smoke.
//
//   node ops/harness/brand.mjs
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = f => readFileSync(path.join(ROOT, f), 'utf8')
const main = read('public/main.js')

let bad = 0
const fail = (what, detail) => { bad++; console.log(`✗ ${what}`); detail.slice(0, 8).forEach(d => console.log(`    ${d}`)) }
const pass = what => console.log(`✓ ${what}`)

// ── PLATE 06 · sentence case ─────────────────────────────────────────────
// Scoped to the stat labels and plain button text. Nav and tab names are
// deliberately OUT: those are feature names ("Kol Torah", "SIM Plans"), the
// manual names them, and test/manual.test.mjs already guards them.
const KEEP = new Set(['SIM','SIMs','SMS','IMEI','VN','VNs','CSV','PDF','KC','UK','USA','US','ID','AI',
  'Kol','Torah','Shabbos','Yom','Tov','Stripe','Gmail','WhatsApp','Google','Twilio','Israel','I'])
const titleCase = t => {
  // Contractions carry their own capital: "I've" is the pronoun, not Title Case.
  const ws = (t.match(/[A-Za-z][A-Za-z'’-]*/g) || []).map(w => w.replace(/['’].*$/, ''))
  return ws.length >= 2 && ws.slice(1).some(w => /^[A-Z]/.test(w) && !KEEP.has(w))
}
const labels = []
for (const re of [/<div class="stat-label">([^<]{2,40})<\/div>/g,
                  /<div class="detail-stat-label"[^>]*>([^<]{2,40})<\/div>/g]) {
  for (const m of main.matchAll(re)) if (!m[1].includes('$')) labels.push(m[1].trim())
}
const btns = [...main.matchAll(/<button[^>]*>([^<>{}$]{3,40})<\/button>/g)].map(m => m[1].trim())
const caseBad = [...new Set([...labels, ...btns].filter(titleCase))]
caseBad.length ? fail(`plate 06 · sentence case: ${caseBad.length} label(s) in Title Case`, caseBad)
               : pass(`plate 06 · sentence case (${labels.length} stat labels, ${btns.length} plain buttons)`)

// ── PLATE 03 · gold is decoration, never ink ─────────────────────────────
const goldInk = []
for (const f of ['styles/app.css', 'styles/globals.css']) {
  read(f).split('\n').forEach((l, i) => {
    if (/(^|[^-\w])color:\s*var\(--kc-gold\)/.test(l)) goldInk.push(`${f}:${i + 1} ${l.trim().slice(0, 70)}`)
  })
}
goldInk.length ? fail('plate 03 · kc-gold used as text ink (2.80:1 on paper — use kc-gold-ink)', goldInk)
               : pass('plate 03 · kc-gold is decoration only, never ink')

// ── PLATE 03 · colour comes off a token ──────────────────────────────────
// Three exemptions, each with a reason rather than a shrug:
//   · national flag SVGs — a Union Jack's red is not a theme colour
//   · the print stylesheet — paper has no dark mode
//   · var(--token, #fallback) — the token leads; the literal is the safety net
const hexLines = []
main.split('\n').forEach((l, i) => {
  const t = l.trim()
  if (t.startsWith('//') || t.startsWith('*')) return
  if (/viewBox="0 0 20 14"/.test(l)) return              // flag swatches
  if (/PRINT_INK|PRINT_MUTED|border-bottom: [12]px solid #|1px solid #eef1f4/.test(l)) return
  const hits = (l.match(/#[0-9a-fA-F]{6}\b/g) || []).filter(h => {
    const at = l.indexOf(h)
    return !/var\([^)]*,\s*$/.test(l.slice(Math.max(0, at - 60), at)) &&
           !/getPropertyValue\([^)]*\)[^|]*\|\|\s*$/.test(l.slice(Math.max(0, at - 80), at).replace(/['"]\s*$/, ''))
  })
  if (hits.length) hexLines.push(`public/main.js:${i + 1} ${hits.join(' ')}  ${t.slice(0, 60)}`)
})
hexLines.length ? fail(`plate 03 · literal hex that cannot flip for dark mode (${hexLines.length})`, hexLines)
                : pass('plate 03 · no literal hex outside flags, print and var() fallbacks')

// ── PLATE 08 · a text message is only its words ──────────────────────────
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u
const smsBad = []
for (const f of ['lib/smsFormats.mjs', 'pages/api/sms.js']) {
  let src; try { src = read(f) } catch { continue }
  src.split('\n').forEach((l, i) => {
    if (l.trim().startsWith('//')) return
    if (EMOJI.test(l)) smsBad.push(`${f}:${i + 1} ${l.trim().slice(0, 60)}`)
  })
}
smsBad.length ? fail('plate 08 · emoji in an outbound SMS', smsBad)
              : pass('plate 08 · SMS carries no emoji')

console.log(bad ? `brand: ${bad} claim(s) in the standard are no longer true`
                : 'brand: every checkable claim in the standard still holds')
process.exit(bad)
