// Render the staff app offline — no server, no auth, no database.
//
//   node ops/harness/render.mjs                    # build ops/harness/app.html
//   node ops/harness/render.mjs --shot rentals     # …and screenshot a tab
//   node ops/harness/render.mjs --shot rentals --width 390 --theme dark
//   node ops/harness/render.mjs --audit            # overflow report, every tab
//
// Why this exists: the UX defects worth finding are the ones you only see by
// looking. Three tabs were clipping their tables dead on a phone and the
// Rentals screen was pushing its second column off a 1280px display; neither
// was findable by reading CSS, and both were obvious in one screenshot.
//
// How it works: components/AppShell.js is rendered to static HTML with React,
// window.fetch is replaced with one that answers from seed.json, and the real
// public/main.js is dropped in after it. main.js then boots exactly as it does
// in production — same render functions, same markup, same stylesheet.
//
// The seed must stay faithful to what the API really returns. An unfaithful
// seed invents defects that do not exist: an early version of it omitted
// `recent` from /api/ledger and made the dashboard look broken when the only
// broken thing was the seed.
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
const React = require(path.join(ROOT, 'node_modules/react'))
const { renderToStaticMarkup } = require(path.join(ROOT, 'node_modules/react-dom/server'))

// next/head and next/script contribute nothing to layout here.
const STUBS = {
  'next/head': { __esModule: true, default: () => null },
  'next/script': { __esModule: true, default: () => null },
}

export function loadComponent(file) {
  const { code } = babel.transformSync(readFileSync(path.join(ROOT, file), 'utf8'), {
    presets: [[presetReact, { runtime: 'classic' }]], plugins: [cjs],
    filename: file, babelrc: false, configFile: false,
  })
  const mod = { exports: {} }
  const req = (id) => {
    if (STUBS[id]) return STUBS[id]
    if (id === 'react') return React
    const p = path.join(ROOT, path.dirname(file), id)
    try { return require(p) } catch { return loadComponent(path.relative(ROOT, p) + '.js') }
  }
  new Function('require', 'module', 'exports', 'React', code)(req, mod, mod.exports, React)
  return mod.exports
}

export function buildAppHtml(out = path.join(HERE, 'app.html')) {
  const AppShell = loadComponent('components/AppShell.js').default
  const shell = renderToStaticMarkup(React.createElement(AppShell, { initialTab: 'customers' }))
  const css = readFileSync(path.join(ROOT, 'styles/globals.css'), 'utf8')
  const main = readFileSync(path.join(ROOT, 'public/main.js'), 'utf8')
  const seed = readFileSync(path.join(HERE, 'seed.json'), 'utf8')
  writeFileSync(out, `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${css}</style>
<script>
const SEED = ${seed};
// Answer from the seed, keyed by path. Anything unlisted returns an empty
// success so a missing stub degrades instead of throwing.
window.fetch = function (url) {
  const u = String(url).split('?')[0];
  const body = Object.prototype.hasOwnProperty.call(SEED, u) ? SEED[u] : { success: true };
  return Promise.resolve({
    ok: true, status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    blob: () => Promise.resolve(new Blob([''])),
  });
};
</script>
</head><body>${shell}
<script>${main}</script>
</body></html>`)
  return out
}

export const TABS = ['dashboard', 'customers', 'rentals', 'sim', 'bookings', 'wallet',
  'repairs', 'services', 'shop', 'koltorah', 'virtual', 'tasks', 'settings']

// A page must never scroll sideways, and nothing may sit outside the content
// column unless it is inside something that scrolls on purpose.
//
// A tab that never rendered must NOT pass. The first version of this reported
// "no tab overflows" while Settings sat on its spinner, because a tab showing
// nothing overflows by nothing. So each tab is also asked whether it actually
// painted, and any error it threw is attached to its row.
export async function audit(page, tabs = TABS) {
  const rows = []
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]))
  for (const tab of tabs) {
    errors.length = 0
    await page.evaluate((t) => window.renderTab(t), tab).catch((e) => errors.push(e.message))
    await page.waitForTimeout(280)
    const row = await page.evaluate((tab) => {
      const c = document.getElementById('mainContent')
      const cr = c.getBoundingClientRect()
      const stray = []
      c.querySelectorAll('*').forEach((el) => {
        if (el.closest('[data-kc-scroller]')) return   // scrolls on purpose
        const r = el.getBoundingClientRect()
        if (r.width && r.right - cr.right > 1) {
          stray.push(el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).trim().split(/\s+/)[0] : ''))
        }
      })
      return {
        tab,
        page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        content: c.scrollWidth - c.clientWidth,
        stray: [...new Set(stray)].slice(0, 4),
        // Still spinning, or barely any text on the screen: it did not render.
        painted: !c.querySelector('.kc-loading') && (c.textContent || '').trim().length > 40,
      }
    }, tab)
    rows.push({ ...row, errors: [...new Set(errors)].slice(0, 2) })
  }
  return rows
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
  const file = buildAppHtml()
  console.log('built', path.relative(ROOT, file))

  if (process.argv.includes('--shot') || process.argv.includes('--audit')) {
    const { chromium } = require(path.join(ROOT, 'node_modules/playwright-core'))
    const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
    const width = Number(arg('--width', process.argv.includes('--audit') ? 390 : 1280))
    const theme = arg('--theme', 'light')
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme })
    const page = await ctx.newPage()
    await page.goto('file://' + file, { waitUntil: 'load' })
    await page.waitForTimeout(800)
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme)

    if (process.argv.includes('--audit')) {
      let bad = 0, blank = 0
      for (const r of await audit(page)) {
        const ok = r.page === 0 && r.content === 0 && r.painted
        if (!ok) (r.painted ? bad++ : blank++)
        const why = [
          r.page ? `page +${r.page}px` : '',
          r.content ? `content +${r.content}px` : '',
          r.painted ? '' : 'DID NOT RENDER',
          r.stray.length ? `stray: ${r.stray.join(' ')}` : '',
          r.errors.length ? `err: ${r.errors[0].slice(0, 70)}` : '',
        ].filter(Boolean).join('  ')
        console.log(`${ok ? '✓' : '✗'} ${r.tab.padEnd(10)} ${why || 'clean'}`)
      }
      const notes = []
      if (bad) notes.push(`${bad} tab(s) overflow`)
      if (blank) notes.push(`${blank} tab(s) never rendered — usually a seed.json shape, check pages/api/ before believing it`)
      console.log(notes.length ? `\n${notes.join('; ')} at ${width}px` : `\nall ${TABS.length} tabs render and none overflows at ${width}px`)
    } else {
      const tab = arg('--shot', 'dashboard')
      await page.evaluate((t) => window.renderTab(t), tab)
      await page.waitForTimeout(400)
      const out = path.join(HERE, `shot_${tab}_${theme}_${width}.png`)
      await page.screenshot({ path: out, fullPage: true })
      console.log('shot', path.relative(ROOT, out))
    }
    await browser.close()
  }
}
