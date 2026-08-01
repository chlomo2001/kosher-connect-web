// Render a PUBLIC page (welcome / join / portal / phone-guide) in the browser,
// for real, with effects running — which is the only way to see Hebrew.
//
//   node ops/harness/public.mjs --audit
//   node ops/harness/public.mjs --shot join --lang he --width 390
//
// The staff harness renders to static markup, which is fine because main.js
// paints everything afterwards. These pages are different: language lives in
// React state, set by a useEffect that reads localStorage, so static markup is
// always English and the RTL half of the product is invisible to it. So this
// one ships React + ReactDOM as UMD from node_modules, transpiles the page to
// a browser script, sets `kcLang` before mounting, and lets React do the work.
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const require = createRequire(import.meta.url)
const babel = require(path.join(ROOT, 'node_modules/next/dist/compiled/babel/core'))
const presetReact = require(path.join(ROOT, 'node_modules/next/dist/compiled/babel/preset-react'))
const cjs = require(path.join(ROOT, 'node_modules/next/dist/compiled/babel/plugin-transform-modules-commonjs'))

export const PAGES = { welcome: 'pages/welcome.js', join: 'pages/join.js', portal: 'pages/portal.js', 'phone-guide': 'pages/phone-guide.js' }

// Transpile the page and everything it imports into one browser bundle with a
// tiny CommonJS shim. next/head and next/script render nothing here; next/link
// and next/router are stubbed to the minimum these pages touch.
function bundle(entry) {
  const mods = new Map()
  const walk = (file) => {
    if (mods.has(file)) return
    mods.set(file, null)
    const src = readFileSync(path.join(ROOT, file), 'utf8')
    const { code } = babel.transformSync(src, {
      presets: [[presetReact, { runtime: 'classic' }]], plugins: [cjs],
      filename: file, babelrc: false, configFile: false,
    })
    mods.set(file, code)
    for (const m of src.matchAll(/require\(['"](.+?)['"]\)|from\s+['"](.+?)['"]/g)) {
      const id = m[1] || m[2]
      if (!id || !id.startsWith('.')) continue
      const rel = path.relative(ROOT, path.join(ROOT, path.dirname(file), id))
      for (const cand of [rel, rel + '.js', rel + '/index.js']) {
        try { readFileSync(path.join(ROOT, cand)); walk(cand); break } catch { /* next candidate */ }
      }
    }
  }
  walk(entry)
  const defs = [...mods].map(([f, code]) => `${JSON.stringify(f)}: function(require, module, exports){\n${code}\n}`).join(',\n')
  return `
var __defs = {${defs}}, __cache = {};
function __req(from, id) {
  if (id === 'react') return window.React;
  if (id === 'react-dom') return window.ReactDOM;
  if (id === 'next/head' || id === 'next/script') return { __esModule: true, default: function(){ return null } };
  if (id === 'next/link') return { __esModule: true, default: function(p){ return window.React.createElement('a', {href: p.href}, p.children) } };
  if (id === 'next/router') return { __esModule: true, useRouter: function(){ return { query: {}, push: function(){}, replace: function(){}, isReady: true } } };
  var base = id.charAt(0) === '.' ? __join(__dir(from), id) : id;
  var hit = [base, base + '.js', base + '/index.js'].find(function(c){ return __defs[c] });
  if (!hit) throw new Error('cannot resolve ' + id + ' from ' + from);
  if (__cache[hit]) return __cache[hit].exports;
  var m = { exports: {} }; __cache[hit] = m;
  __defs[hit](function(x){ return __req(hit, x) }, m, m.exports);
  return m.exports;
}
function __dir(p){ var i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i) }
function __join(a, b){
  var parts = (a ? a.split('/') : []).concat(b.split('/')), out = [];
  parts.forEach(function(s){ if (s === '.' || s === '') return; if (s === '..') out.pop(); else out.push(s) });
  return out.join('/');
}
window.__page = __req('', ${JSON.stringify(entry)}).default;
`
}

export function buildPublicHtml(page, lang = 'en', out) {
  const entry = PAGES[page]
  if (!entry) throw new Error(`unknown page "${page}" — one of ${Object.keys(PAGES).join(', ')}`)
  const react = readFileSync(path.join(ROOT, 'node_modules/react/umd/react.production.min.js'), 'utf8')
  const reactDom = readFileSync(path.join(ROOT, 'node_modules/react-dom/umd/react-dom.production.min.js'), 'utf8')
  const css = readFileSync(path.join(ROOT, 'styles/globals.css'), 'utf8')
  const file = out || path.join(HERE, `public_${page}_${lang}.html`)
  writeFileSync(file, `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${css}</style>
<script>
// pages/join.js and AppShell inline process.env.NEXT_PUBLIC_* values; Next
// replaces those at build time and we are not Next, so give them a home.
window.process = { env: {} };
try { localStorage.setItem('kcLang', ${JSON.stringify(lang)}) } catch (e) {}
// These pages fetch their own bits (opening hours, portal session). Answer
// everything with an empty success so a missing stub degrades, never throws.
window.fetch = function () {
  return Promise.resolve({ ok: true, status: 200, json: function(){ return Promise.resolve({ success: true }) },
    text: function(){ return Promise.resolve('{}') } });
};</script>
<script>${react}</script>
<script>${reactDom}</script>
</head><body><div id="root"></div>
<script>${bundle(entry)}</script>
<script>ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(window.__page));</script>
</body></html>`)
  return file
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
  const { chromium } = require(path.join(ROOT, 'node_modules/playwright-core'))
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  const widths = (arg('--width', '390,1280')).split(',').map(Number)
  const langs = (arg('--lang', 'en,he')).split(',')
  const only = arg('--shot', null)
  let bad = 0

  for (const page of (only ? [only] : Object.keys(PAGES))) {
    for (const lang of langs) {
      const file = buildPublicHtml(page, lang)
      for (const w of widths) {
        const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, colorScheme: arg('--theme', 'light') })
        const p = await ctx.newPage()
        const errs = []
        p.on('pageerror', (e) => errs.push(String(e).split('\n')[0]))
        await p.goto('file://' + file, { waitUntil: 'load' })
        await p.waitForTimeout(700)
        const r = await p.evaluate(() => {
          const root = document.getElementById('root')
          const de = document.documentElement
          const rtl = [...root.querySelectorAll('[dir]')].some((el) => el.getAttribute('dir') === 'rtl')
          const stray = []
          const vw = de.clientWidth
          root.querySelectorAll('*').forEach((el) => {
            // Decorative layers and the /join honeypot are deliberately off
            // screen and are all aria-hidden, so skip those subtrees rather
            // than report known-good as noise.
            if (el.closest('[aria-hidden="true"], .jn-hp')) return
            const b = el.getBoundingClientRect()
            if (b.width && (b.right - vw > 1 || b.left < -1)) {
              stray.push(el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).toString().trim().split(/\s+/)[0] : ''))
            }
          })
          return {
            painted: (root.textContent || '').trim().length > 60,
            overflow: de.scrollWidth - de.clientWidth,
            rtl,
            stray: [...new Set(stray)].slice(0, 3),
          }
        })
        // Latin text renders in a fallback face here — Inter comes from Google
        // Fonts and there is no network — and the fallback is wider: measured
        // 65px on the welcome nav alone. So a width does not fail a page here;
        // rendering, page errors and RTL do. Widths are printed to be looked at
        // with that in mind, not treated as defects.
        const ok = r.painted && !errs.length && (lang === 'en' || r.rtl)
        if (!ok) bad++
        if (only) {
          await p.screenshot({ path: path.join(HERE, `shot_${page}_${lang}_${w}.png`), fullPage: true })
        }
        const why = [
          r.painted ? '' : 'DID NOT RENDER',
          r.overflow ? `content ${r.overflow}px wider than the viewport — see the font caveat` : '',
          lang === 'he' && !r.rtl ? 'NO dir=rtl anywhere' : '',
          r.stray.length ? `outside viewport: ${r.stray.join(' ')}` : '',
          errs.length ? `err: ${errs[0].slice(0, 70)}` : '',
        ].filter(Boolean).join('  ')
        console.log(`${ok ? '✓' : '✗'} ${page.padEnd(12)} ${lang} ${String(w).padStart(5)}px  ${why || 'clean'}`)
        await ctx.close()
      }
    }
  }
  console.log(bad ? `\n${bad} public-page check(s) failed` : '\nevery public page renders clean in both languages')
  await browser.close()
}
