// styles/app.css → public/app.css, with the commentary stripped.
//
// The staff stylesheet is served as a static file so the public pages never
// download it (see components/AppStyles.js). Static files skip Next's CSS
// minifier, so whatever is in the source is what goes down the wire — and the
// source is a third comments, because that is how this codebase is written.
// Shipping those comments made the staff app pay 12.6KB gzipped MORE than
// before the split, which would have turned a win for customers into a loss
// for the counter. So: keep the comments in styles/app.css where they are read,
// strip them on the way to public/app.css where they are only downloaded.
//
// Deliberately not a minifier. It removes comments and collapses the blank
// lines they leave behind — nothing that could change a value, reorder a rule,
// or alter the cascade. Everything else is passed through byte for byte,
// because a stylesheet that has been proved identical is worth more than one
// that is a few hundred bytes smaller.
//
// Runs from `npm run build` and `npm run dev` (prebuild/predev), so the file is
// always there and never committed. The offline harness reads the SOURCE, so
// what it measures and what ships stay the same rules either way.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'styles/app.css')
const OUT = path.join(ROOT, 'public/app.css')

// Walk the file rather than regex it: a `/*` inside a string (content: "/*")
// is not a comment, and url(data:…) can carry anything at all.
function stripComments(css) {
  let out = ''
  for (let i = 0; i < css.length;) {
    const c = css[i]
    if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      i = end < 0 ? css.length : end + 2
      continue
    }
    if (c === '"' || c === "'") {
      const q = c
      let j = i + 1
      while (j < css.length && css[j] !== q) { if (css[j] === '\\') j++; j++ }
      out += css.slice(i, j + 1)
      i = j + 1
      continue
    }
    out += c
    i++
  }
  return out
}

const src = readFileSync(SRC, 'utf8')
const stripped = stripComments(src)
  .replace(/[ \t]+$/gm, '')       // trailing space a removed comment left behind
  .replace(/\n{3,}/g, '\n\n')     // and the holes between rules
  .replace(/^\n+/, '')
const banner = '/* Generated from styles/app.css — edit that, not this. */\n'

mkdirSync(path.dirname(OUT), { recursive: true })
writeFileSync(OUT, banner + stripped)

const kb = (s) => (s.length / 1024).toFixed(1) + 'KB'
console.log(`app.css: ${kb(src)} → ${kb(banner + stripped)} (comments stripped)`)
