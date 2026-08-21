// Render a PUBLIC page (welcome / portal / phone-guide) in the browser,
// for real, with effects running — which is the only way to see Hebrew.
//
// The mount point is `#__next` and must stay that way. globals.css styles that
// id — `#__next { display:flex; width:100%; height:100% }` — which is what lets
// a `width:100%` shell fill the viewport inside the flex `body`. Mounted on any
// other id the shell shrink-wraps its content, and every page reads as if its
// background stops mid-screen. That cost a round of chasing a defect that only
// existed here.
//
//   node ops/harness/public.mjs --audit
//   node ops/harness/public.mjs --shot welcome --lang he --width 390
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
import { measure, report } from './contrast.mjs'
import { BROWSER_ENV } from './render.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const require = createRequire(import.meta.url)
const babel = require(path.join(ROOT, 'node_modules/next/dist/compiled/babel/core'))
const presetReact = require(path.join(ROOT, 'node_modules/next/dist/compiled/babel/preset-react'))
const cjs = require(path.join(ROOT, 'node_modules/next/dist/compiled/babel/plugin-transform-modules-commonjs'))

export const PAGES = { welcome: 'pages/welcome.js', portal: 'pages/portal.js', 'phone-guide': 'pages/phone-guide.js', repair: 'pages/repair.js', login: 'pages/login.js',
  // The four staff TOOLS pages. They are ordinary Next pages behind a
  // server-side cookie gate, so they render here fine — and until now neither
  // harness knew about them, which meant four screens in the sidebar had never
  // been looked at once.
  'tool-contacts': 'pages/tools/contacts.js', 'tool-convert': 'pages/tools/convert.js',
  'tool-ocr': 'pages/tools/ocr.js', 'tool-transfer': 'pages/tools/transfer.js',
  // The three LEGAL pages. They are linked from the welcome footer and from the
  // sign-up form's privacy line, so a customer reaches them from the most-read
  // page on the site — and neither harness had ever rendered one.
  privacy: 'pages/privacy.js', terms: 'pages/terms.js', refund: 'pages/refund.js',
  // The staff manual. It is a page like any other and it prints, so it gets
  // looked at like any other — a reference nobody can read on a phone at the
  // counter is a reference nobody reads.
  manual: 'pages/manual.js' }

// The product has FOUR theme states, not two, and conflating them is how a
// page can look right here and wrong on a phone:
//   light    — no choice stored, OS light.
//   dark     — the customer pressed the toggle. `_document.js` writes
//              data-theme="dark" before first paint; the OS may well still be
//              light. This is the state globals.css is built for.
//   dark-os  — no choice stored, OS dark. Nothing sets data-theme, so only a
//              `prefers-color-scheme` rule can paint it. globals.css has none
//              on purpose; /welcome and the legal shell carry complete ones.
//   light-os — the customer pressed the toggle for LIGHT on a dark phone.
//              Distinguishable from "no choice" only because the toggle now
//              writes data-theme="light" rather than removing the attribute.
// The dark run used to set BOTH data-theme and colorScheme:dark, which meant a
// stylesheet that answers only to the OS preference passed the dark run while
// being wrong for every customer who has actually pressed the toggle.
const THEMES = {
  light: { attr: null, os: 'light' },
  dark: { attr: 'dark', os: 'light' },
  'dark-os': { attr: null, os: 'dark' },
  'light-os': { attr: 'light', os: 'dark' },
}

// The RTL assertion only means something on a page that offers Hebrew. /login
// is the staff door — no language switcher, English by design — so requiring
// dir=rtl there would fail it for doing the right thing.
const BILINGUAL = new Set(['welcome', 'portal', 'phone-guide', 'repair'])

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

// Every asset these pages name is an absolute path (`/logo-full-tight.png`,
// `/fonts/heebo-var-hebrew.woff2`). On a file:// page that resolves to the
// filesystem root and 404s, so the harness used to render the brand as broken-
// image alt text and every Hebrew glyph in a fallback face — i.e. the two things
// a screenshot is FOR were the two things it could not show. The dark wordmark
// swap is invisible that way. Inline them instead: small files, exact bytes.
const MIME = { png: 'image/png', svg: 'image/svg+xml', woff2: 'font/woff2' }
function inlineAssets(html) {
  return html.replace(/\/(?:fonts\/)?[a-z0-9-]+\.(?:png|svg|woff2)/g, (ref) => {
    try {
      const buf = readFileSync(path.join(ROOT, 'public', ref.slice(1)))
      return `data:${MIME[ref.split('.').pop()]};base64,${buf.toString('base64')}`
    } catch { return ref }   // not a real asset — leave the string alone
  })
}

export function buildPublicHtml(page, lang = 'en', out, theme = 'light') {
  const entry = PAGES[page]
  if (!entry) throw new Error(`unknown page "${page}" — one of ${Object.keys(PAGES).join(', ')}`)
  const react = readFileSync(path.join(ROOT, 'node_modules/react/umd/react.production.min.js'), 'utf8')
  const reactDom = readFileSync(path.join(ROOT, 'node_modules/react-dom/umd/react-dom.production.min.js'), 'utf8')
  const css = readFileSync(path.join(ROOT, 'styles/globals.css'), 'utf8')
  // Pages that render staff chrome pull in <AppStyles/>, which is a bare
  // <link href="/app.css"> — generated from styles/app.css at build time and,
  // on a file:// page, a 404. Without it the four /tools/* screens paint with
  // tokens but no layout: no card, no padding, text flush to x=0. That is not
  // what production looks like, and it is why they had never been reviewed.
  // Inlined AFTER globals.css because that is the production cascade order —
  // app.css is deliberately loaded from <body> so it wins ties (see the note
  // in components/AppStyles.js).
  const script = bundle(entry)
  const appCss = script.includes('components/AppStyles.js')
    ? readFileSync(path.join(ROOT, 'styles/app.css'), 'utf8') : ''
  const file = out || path.join(HERE, `public_${page}_${lang}.html`)
  // data-theme is how these pages actually go dark — the toggle sets it and the
  // pre-paint script in _document.js restores it. globals.css deliberately has
  // NO prefers-color-scheme palette (the reasoning is written out beside the
  // :root[data-theme="dark"] block), so a browser-level `colorScheme: dark`
  // changes nothing here and the dark half of /repair, /phone-guide and /portal
  // went four months without ever being rendered.
  writeFileSync(file, inlineAssets(`<!doctype html>
<html lang="en"${THEMES[theme]?.attr ? ` data-theme="${THEMES[theme].attr}"` : ''}><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${css}</style>
<style>${appCss}</style>
<script>
// pages/welcome.js and AppShell inline process.env.NEXT_PUBLIC_* values; Next
// replaces those at build time and we are not Next, so give them a home.
window.process = { env: {} };
try { localStorage.setItem('kcLang', ${JSON.stringify(lang)}) } catch (e) {}
// The portal reads its access token from sessionStorage before it will ask
// /api/portal/me for anything. Without one it renders the sign-in card and
// stops, which is why the customer dashboard was never in a screenshot.
try { sessionStorage.setItem('kc_portal_token', 'harness') } catch (e) {}
// These pages fetch their own bits (opening hours, portal session). Answer
// everything with an empty success so a missing stub degrades, never throws.
window.fetch = function (url) {
  var u = String(url || '');
  var body = { success: true };
  // Two sample handsets, so the guide renders its CARDS — the blanket
  // success stub meant every screenshot showed the "being written" empty
  // state, and the spec grid was never actually looked at.
  if (u.indexOf('/api/public/phone-guide') !== -1) {
    body = { models: [
      { name: 'Nokia 105', price: 35, dualSim: 'Yes', yiddishText: 'Yes', touchScreen: 'No',
        texting: 'Yes — OTP (bank texts only)', pros: 'Big clear buttons\\nBattery lasts all week', cons: 'No camera' },
      { name: 'Alcatel 2053', price: 42, dualSim: 'Yes', yiddishText: '', touchScreen: 'No',
        texting: '', pros: 'Loud speaker', cons: 'Screen is small' },
    ] };
  }
  if (u.indexOf('/api/public/info') !== -1) body = { openingHours: 'Sun-Thu 2:00pm-6:30pm · Fri closed' };
  // Signed-in portal. Without a session the only thing this harness could ever
  // render was the sign-in card — the dashboard a customer actually lives in
  // (balance, rentals, SIM renewals, statement) had never been screenshotted.
  // Shape copied field for field from pages/api/portal/me.js; an unfaithful
  // seed invents defects, and this one carries money rows.
  if (u.indexOf('/api/portal/me') !== -1) {
    body = { success: true, customer: { firstName: 'Yoel', lastName: 'Klein' },
      balance: -45, payRef: 'KC-1042', cardOnFile: false,
      rentals: [{ phoneNumber: '+1 518 555 0102', country: 'USA', fromDate: '2026-08-02',
                  toDate: '2026-08-16', status: 'out' }],
      bookings: [{ route: 'MAN → TLV', airline: 'Wizz Air', bookingReference: 'BNKYRW',
                   travelDate: '2026-08-18', status: 'Confirmed' }],
      sims: [{ provider: 'Lebara', tier: 'Unlimited calls + data', status: 'active',
               renewalDate: '2026-08-12' }],
      statement: [
        { at: '2026-08-02T10:00:00Z', description: 'Nokia 105 rental — 2 weeks', amount: -120, type: 'rental', balanceAfter: -45 },
        { at: '2026-07-24T15:30:00Z', description: 'Part payment at the counter', amount: 45, type: 'payment', balanceAfter: 75 },
        { at: '2026-07-20T09:15:00Z', description: 'Charger + SIM tray tool', amount: -12, type: 'sale', balanceAfter: 30 },
      ] };
  }
  if (u.indexOf('/api/portal/documents') !== -1) body = { success: true, documents: [] };
  return Promise.resolve({ ok: true, status: 200, json: function(){ return Promise.resolve(body) },
    text: function(){ return Promise.resolve('{}') } });
};</script>
<script>${react}</script>
<script>${reactDom}</script>
</head><body><div id="__next"></div>
<script>${script}</script>
<script>ReactDOM.createRoot(document.getElementById('__next')).render(React.createElement(window.__page));</script>
</body></html>`))
  return file
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
  const { chromium } = require(path.join(ROOT, 'node_modules/playwright-core'))
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: BROWSER_ENV })
  const widths = (arg('--width', '390,1280')).split(',').map(Number)
  const langs = (arg('--lang', 'en,he')).split(',')
  const only = arg('--shot', null)
  let bad = 0
  const contrastAll = []
  const targetsBad = []
  const wantTargets = process.argv.includes('--targets')

  const theme = arg('--theme', 'light')
  if (!THEMES[theme]) throw new Error(`unknown --theme "${theme}" — one of ${Object.keys(THEMES).join(', ')}`)
  for (const page of (only ? [only] : Object.keys(PAGES))) {
    for (const lang of langs) {
      const file = buildPublicHtml(page, lang, null, theme)
      for (const w of widths) {
        const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, colorScheme: THEMES[theme].os,
          // --targets needs a touch device: the 24px rules are scoped to
          // `pointer: coarse`, because the case that matters is a customer's
          // phone, not a narrow desktop window.
          ...(wantTargets ? { hasTouch: true, isMobile: true } : {}) })
        const p = await ctx.newPage()
        const errs = []
        p.on('pageerror', (e) => errs.push(String(e).split('\n')[0]))
        await p.goto('file://' + file, { waitUntil: 'load' })
        await p.waitForTimeout(700)
        const r = await p.evaluate(() => {
          const root = document.getElementById('__next')
          const de = document.documentElement
          const rtl = [...root.querySelectorAll('[dir]')].some((el) => el.getAttribute('dir') === 'rtl')
          const stray = []
          const vw = de.clientWidth
          // An element inside a horizontal scroller (the welcome page's mobile
          // section chips) is SUPPOSED to sit past the fold — that is what the
          // scroller is for. Reporting those as stray cried wolf on every run
          // and sent a real investigation chasing a designed behaviour.
          const scrollers = new Set()
          root.querySelectorAll('*').forEach((el) => {
            const o = getComputedStyle(el).overflowX
            if ((o === 'auto' || o === 'scroll') && el.scrollWidth > el.clientWidth) scrollers.add(el)
          })
          root.querySelectorAll('*').forEach((el) => {
            // Decorative layers and the contact-form honeypot are deliberately off
            // screen and are all aria-hidden, so skip those subtrees rather
            // than report known-good as noise.
            if (el.closest('[aria-hidden="true"]')) return
            let inScroller = false
            for (let a = el.parentElement; a && a !== root; a = a.parentElement) {
              if (scrollers.has(a)) { inScroller = true; break }
            }
            if (inScroller) return
            const b = el.getBoundingClientRect()
            if (b.width && (b.right - vw > 1 || b.left < -1)) {
              stray.push(el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).toString().trim().split(/\s+/)[0] : ''))
            }
          })
          // CAN A PERSON REACH THE BOTTOM OF THIS PAGE?
          // body and #__next are overflow:hidden for the app frame, so a
          // standalone page that forgets to be its own scroll container is
          // clipped at the first viewport — with no scrollbar to hint at it,
          // and a full-page screenshot that quietly comes back one viewport
          // tall. /welcome shipped that bug, and /manual shipped it again on
          // 18 Aug 2026 with four rounds of harness runs calling it clean.
          const lowest = () => {
            let max = 0
            root.querySelectorAll('*').forEach((el) => {
              if (el.closest('[aria-hidden="true"]')) return
              const b = el.getBoundingClientRect()
              if (b.width && b.height) max = Math.max(max, b.bottom)
            })
            return max
          }
          let reachable = lowest() <= window.innerHeight + 2
          if (!reachable) {
            // Try to get there the way a person would: scroll the document and
            // every scroller on the page to its end, then look again. Positions
            // are put back, so a screenshot after this is of the page at rest.
            // scroll-behavior:smooth ANIMATES a scrollTop assignment, so the
            // position read back a line later is the one it started from —
            // which reported every smooth-scrolling page here as unscrollable.
            // Turn the behaviour off for the measurement and put it back.
            const jump = (el) => {
              const prev = el.style.scrollBehavior
              el.style.scrollBehavior = 'auto'
              const was = el.scrollTop
              el.scrollTop = 1e7
              return () => { el.scrollTop = was; el.style.scrollBehavior = prev }
            }
            const undo = [jump(de)]
            root.querySelectorAll('*').forEach((el) => {
              const o = getComputedStyle(el).overflowY
              if ((o === 'auto' || o === 'scroll') && el.scrollHeight > el.clientHeight + 2) undo.push(jump(el))
            })
            reachable = lowest() <= window.innerHeight + 2
            undo.forEach((fn) => fn())
          }
          return {
            painted: (root.textContent || '').trim().length > 60,
            overflow: de.scrollWidth - de.clientWidth,
            rtl,
            reachable,
            stray: [...new Set(stray)].slice(0, 3),
          }
        })
        // Latin text renders in a fallback face here — Inter comes from Google
        // Fonts and there is no network — and the fallback is wider: measured
        // 65px on the welcome nav alone. So a width does not fail a page here;
        // rendering, page errors and RTL do. Widths are printed to be looked at
        // with that in mind, not treated as defects.
        if (wantTargets) {
          const small = await p.evaluate(() => {
            const out = []
            document.querySelectorAll('a,button,input,select,textarea,[role="button"]').forEach((el) => {
              if (el.closest('[aria-hidden="true"]') || el.tabIndex < 0) return
              const r = el.getBoundingClientRect()
              if (!r.width || !r.height || r.width >= 24 && r.height >= 24) return
              // WCAG 2.5.8 exempts a target that sits inline in a sentence.
              // Test that by looking at the ADJACENT TEXT NODES, not the whole
              // parent: a block parent almost always holds more text, which
              // silently exempted everything — including a standalone "Back to
              // the app" that this check exists to catch.
              // ...stepping over whitespace-only nodes, which JSX leaves
              // between prose and a link ("Urgent? Call <a>0161…</a>").
              const proseSide = (n, dir) => {
                while (n && n.nodeType === 3 && !n.textContent.trim()) n = n[dir]
                return n && n.nodeType === 3 && n.textContent.trim().length > 1
              }
              if (proseSide(el.previousSibling, 'previousSibling')
               || proseSide(el.nextSibling, 'nextSibling')) return
              // A control wrapped in a <label> is hit by pressing the label —
              // the visually-hidden file input inside .tool-drop is 1x1 on
              // purpose and its drop zone is the target.
              const lab = el.closest('label')
              if (lab && lab !== el) {
                const lr = lab.getBoundingClientRect()
                if (lr.width >= 24 && lr.height >= 24) return
              }
              out.push(`${Math.round(r.width)}x${Math.round(r.height)} ${el.textContent.trim().slice(0, 24) || el.className}`)
            })
            return [...new Set(out)]
          })
          if (small.length) { targetsBad.push(`${page}/${lang}/${w}: ${small.join(' · ')}`) }
        }
        if (process.argv.includes('--contrast')) {
          const found = (await measure(p, '#__next')).map((f) => ({ ...f, where: `${page}/${lang}/${w}` }))
          contrastAll.push(...found)
        }
        const wantsRtl = lang === 'he' && BILINGUAL.has(page)
        const ok = r.painted && !errs.length && (!wantsRtl || r.rtl) && r.reachable
        if (!ok) bad++
        if (only) {
          // Theme is in the filename: without it a dark run silently overwrote
          // the light shot and the pair could never be compared side by side.
          await p.screenshot({ path: path.join(HERE, `shot_${page}_${lang}_${w}_${theme}.png`), fullPage: true })
        }
        const why = [
          r.painted ? '' : 'DID NOT RENDER',
          r.overflow ? `content ${r.overflow}px wider than the viewport — see the font caveat` : '',
          wantsRtl && !r.rtl ? 'NO dir=rtl anywhere' : '',
          r.reachable ? '' : 'BOTTOM OF THE PAGE UNREACHABLE — nothing scrolls',
          r.stray.length ? `outside viewport: ${r.stray.join(' ')}` : '',
          errs.length ? `err: ${errs[0].slice(0, 70)}` : '',
        ].filter(Boolean).join('  ')
        console.log(`${ok ? '✓' : '✗'} ${page.padEnd(12)} ${lang} ${String(w).padStart(5)}px  ${why || 'clean'}`)
        await ctx.close()
      }
    }
  }
  // `report` RETURNS how many it found, and dropping that return was half the
  // reason this script could print failures and still exit 0.
  if (process.argv.includes('--contrast')) bad += report(contrastAll, `the public pages (${arg('--theme', 'light')})`)
  if (wantTargets) {
    if (targetsBad.length) { bad += targetsBad.length; targetsBad.forEach((t) => console.log('✗ ' + t)) }
    else console.log('no public target under 24x24 on a coarse pointer')
  }
  console.log(bad ? `\n${bad} public-page check(s) failed` : '\nevery public page renders clean in both languages')
  await browser.close()
  // Every other runnable check in ops/harness/ ends this way — cardfit,
  // clipped, focus, modals, render, textscale, theme-pairs and eleven more,
  // eighteen in all. (contrast.mjs is the twentieth file and has no exit code
  // because it is a library, not a check.) This was the only one that could not
  // fail, so `run()` in audit-all.sh saw success from a check that had just
  // printed "2 public-page check(s) failed" and went on to say "AUDIT: all
  // checks reported clean." A check nobody can fail is not a check. Set rather
  // than process.exit() so the close above actually happens.
  process.exitCode = bad ? 1 : 0
}
