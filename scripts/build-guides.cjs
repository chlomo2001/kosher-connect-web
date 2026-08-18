// lib/guides.mjs → public/guides.js
//
// The curated "How do I…" library has to exist in two places: the module the
// tests hold to a standard, and a plain script the browser can load (main.js
// is a classic script and cannot import). Everywhere else in this app that
// happens, the second copy is written by hand and a mirror test stops it
// drifting — see phoneProblem, priceFromDays.
//
// Not here. This one is 20 guides of prose, and prose copied by hand drifts
// silently: a step gets corrected in one file and stays wrong in the other,
// and the wrong one is the one the counter reads. So the browser copy is
// GENERATED from the module, exactly as public/app.css is generated from
// styles/app.css, and there is only ever one place to edit a guide.
//
// The transform is mechanical because lib/guides.mjs is pure: no imports, no
// dependencies, nothing but data and two functions over it. Strip the `export`
// keywords, hang the pieces off `window`, done.

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const SRC = path.join(ROOT, 'lib/guides.mjs')
const OUT = path.join(ROOT, 'public/guides.js')

function build() {
  const src = fs.readFileSync(SRC, 'utf8')

  if (/^\s*import\s/m.test(src)) {
    throw new Error('lib/guides.mjs has grown an import — it must stay dependency-free to be generated into the browser copy')
  }

  const body = src.replace(/^export\s+(const|function)\s/gm, '$1 ')

  const out = `// GENERATED FROM lib/guides.mjs — DO NOT EDIT.
// Edit the guides in lib/guides.mjs and run: node scripts/build-guides.cjs
// (next.config.js runs it on every build, however the build was started.)
${body}
window.KC_GUIDES = GUIDES
window.kcMatchGuides = matchGuides
window.kcBestGuide = bestGuide
window.kcGuidesByScreen = guidesByScreen
`

  const prev = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null
  if (prev !== out) {
    fs.writeFileSync(OUT, out)
    console.log(`guides.js: ${GUIDE_COUNT(src)} guides → public/guides.js`)
  }
  return out
}

const GUIDE_COUNT = (src) => (src.match(/^\s{4}id: '/gm) || []).length

build()
module.exports = build
