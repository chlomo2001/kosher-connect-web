// Every Hebrew string the shop shows, next to the English it stands for.
//
//   node scripts/build-hebrew-review.mjs      → docs/HEBREW-COPY.md
//
// Written 26 Aug 2026: the owner wanted the Hebrew checked by somebody who
// reads it properly, and a bare word list is not checkable. A translation is
// right or wrong against the thing it translates, so every row here carries
// the English beside it and says which screen it appears on.
//
// GENERATED, not maintained. The four bilingual pages each hold one object of
// the shape { en: {...}, he: {...} } with the same key on both sides, so the
// pairing is read out of the source rather than typed. Re-run it whenever the
// copy changes; nothing here is written by hand, which is the only way a file
// like this stays true.
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const HEB = /[֐-׿]/

const PAGES = [
  ['pages/welcome.js', 'The front page', '/welcome'],
  ['pages/portal.js', 'The customer portal', '/portal'],
  ['pages/phone-guide.js', 'The phone guide', '/phone-guide'],
  ['pages/repair.js', 'Book a repair', '/repair'],
]

/** The copy object in a page: the first `const X = {` whose block has `he: {`. */
function copyBlock(src) {
  for (const m of src.matchAll(/const ([A-Za-z_][\w]*)\s*=\s*\{/g)) {
    const start = m.index + m[0].length - 1
    let depth = 0, i = start
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++
      else if (src[i] === '}') { depth--; if (!depth) break }
    }
    const block = src.slice(start, i + 1)
    if (/\n\s{2}he:\s*\{/.test(block)) return { name: m[1], block }
  }
  return null
}

// Some copy is a function, because the sentence wraps a number: `youOwe: (v)
// => `You owe ${v}`` and the portal's greeting, which picks one of three by
// the hour. Those are real lines a customer reads, so they are called with
// sample values and every distinct result recorded — the greeting yields all
// three, which is the point.
const SAMPLES = ['£10', 9, 14, 20]
function callAll(fn) {
  // Deduped by SHAPE, not by result. `youOwe` returns a different string for
  // every sample and is one line of copy; `greeting` ignores its argument and
  // returns one of three, which is three lines. Blanking the sample out of the
  // result tells them apart: the first collapses to one row, the second stays
  // as three, which is what somebody checking the language needs to see.
  const seen = new Map()
  for (const a of SAMPLES) {
    try {
      const r = fn(a)
      if (typeof r !== 'string') continue
      const shape = r.split(String(a)).join('…')
      if (!seen.has(shape)) seen.set(shape, shape)
    } catch { /* a sample that does not suit this one */ }
  }
  return [...seen.values()]
}

/** Walk two parallel trees, emitting [keyPath, en, he] for every Hebrew leaf. */
function pairs(en, he, trail = [], out = []) {
  if (typeof he === 'function') {
    const hes = callAll(he)
    const ens = typeof en === 'function' ? callAll(en) : []
    hes.forEach((h, i) => {
      if (HEB.test(h)) out.push([`${trail.join('.')}()`, ens[i] || ens[0] || '', h])
    })
    return out
  }
  if (typeof he === 'string') {
    if (HEB.test(he)) out.push([trail.join('.'), typeof en === 'string' ? en : '', he])
    return out
  }
  if (Array.isArray(he)) {
    he.forEach((v, i) => pairs(Array.isArray(en) ? en[i] : undefined, v, [...trail, i], out))
    return out
  }
  if (he && typeof he === 'object') {
    for (const k of Object.keys(he)) pairs(en?.[k], he[k], [...trail, k], out)
  }
  return out
}

const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim()

let rows = 0
const out = []
out.push('# The Hebrew, next to the English it stands for')
out.push('')
out.push('**Generated** by `scripts/build-hebrew-review.mjs` — do not edit by hand.')
out.push('Re-run it after any copy change and the file catches up.')
out.push('')
out.push('Every line of Hebrew the shop puts in front of a customer is below, beside')
out.push('the English it translates and the screen it appears on. Anything wrong can be')
out.push('answered with the key in the first column — that is the exact place in the')
out.push('source, so a correction can be made without hunting for it.')
out.push('')
out.push('Yiddish and Hebrew are not distinguished here: the pages offer one non-English')
out.push('language and this is all of it.')
out.push('')

for (const [file, title, url] of PAGES) {
  const src = readFileSync(path.join(ROOT, file), 'utf8')
  const found = copyBlock(src)
  if (!found) { out.push(`## ${title}\n\n_No bilingual copy object found in ${file} — check the page by hand._\n`); continue }
  // Pure data: strings, arrays and objects. Evaluated rather than parsed
  // because it IS JavaScript, and a regex that reads nested objects is a bug
  // waiting to happen.
  let copy
  // JSX fragments — `(v) => <>owed {v} after this</>` — are four lines of real
  // copy that will not evaluate as data. Rewritten to the template literal
  // they are equivalent to, which is exactly what the reader sees anyway.
  const asData = found.block.replace(/<>([\s\S]*?)<\/>/g,
    (_, inner) => '`' + inner.replace(/\{([^}]*)\}/g, '${$1}') + '`')
  try { copy = new Function(`return ${asData}`)() }
  catch (e) { out.push(`## ${title}\n\n_Could not read ${file}: ${e.message}_\n`); continue }
  const list = pairs(copy.en, copy.he)
  rows += list.length
  out.push(`## ${title} — \`${url}\``)
  out.push('')
  out.push(`${list.length} lines, from \`${file}\` (\`${found.name}\`).`)
  out.push('')
  out.push('| Where | English | Hebrew |')
  out.push('| --- | --- | --- |')
  for (const [key, en, he] of list) out.push(`| \`${key}\` | ${esc(en)} | ${esc(he)} |`)
  out.push('')
}

// ── The Hebrew that is not page copy ───────────────────────────────────────
// Month names, the company's own name, and a handful of guards. Listed with
// their line so they can be found, but not paired: they have no English twin.
out.push('## Everything else')
out.push('')
out.push('Hebrew outside the four bilingual pages, with no English twin: the company name,')
out.push('the Hebrew month names, and the few places the STAFF app shows Hebrew. Lower')
out.push('priority than the tables above — no customer reads most of it — but the month')
out.push('names in particular are worth a glance, since every Hebrew date in the app is')
out.push('built from them.')
out.push('')
out.push('| File | Line | Hebrew |')
out.push('| --- | --- | --- |')
for (const f of ['lib/hebrewDate.mjs', 'lib/company.mjs', 'lib/vcard.mjs', 'lib/publicForm.mjs', 'public/main.js']) {
  const lines = readFileSync(path.join(ROOT, f), 'utf8').split('\n')
  lines.forEach((line, i) => {
    if (!HEB.test(line)) return
    // Code, not copy: regex character classes that recognise Hebrew INPUT
    // (/^[א-ת]$/, /[a-zA-Z֐-׿]/) contain Hebrew letters and mean nothing to
    // somebody checking the language. Everything left is a word the app shows.
    if (/\.test\(|RegExp|\[[^\]]{0,20}[֐-׿][^\]]{0,20}\]\s*[/.]/.test(line)) return
    out.push(`| \`${f}\` | ${i + 1} | ${esc(line.trim()).slice(0, 160)} |`)
    rows++
  })
}
out.push('')
out.push(`---\n\n**${rows} lines in total.**`)
out.push('')

writeFileSync(path.join(ROOT, 'docs/HEBREW-COPY.md'), out.join('\n'))
console.log(`docs/HEBREW-COPY.md — ${rows} lines of Hebrew across ${PAGES.length} pages plus the rest`)
