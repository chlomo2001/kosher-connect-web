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
  // Both sheets, in the order the browser really gets them: globals.css comes
  // from Next's own <link> at the end of <head>, and components/AppStyles puts
  // /app.css at the top of <body>, which is later in document order. So the
  // staff sheet wins ties — the same way it did when both halves lived in one
  // file. Get this order wrong here and the harness tests a cascade that does
  // not exist in production.
  const css = readFileSync(path.join(ROOT, 'styles/globals.css'), 'utf8') +
    '\n' + readFileSync(path.join(ROOT, 'styles/app.css'), 'utf8')
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

// Contrast of every visible run of text against what is actually painted
// behind it — translucent fills composited down to the first opaque ancestor,
// because a wash over a dark card is where this goes wrong.
export async function contrast(page, tabs = TABS) {
  const findings = []
  for (const tab of tabs) {
    await page.evaluate((t) => window.renderTab(t), tab).catch(() => {})
    await page.waitForTimeout(280)
    findings.push(...await page.evaluate((tab) => {
      // Chromium reports some colours as `color(srgb 0.88 0.44 0.54)` — 0–1
      // channels, not 0–255. Dividing those by 255 makes anything look black,
      // which invented a 1.28:1 failure on a button that is genuinely fine.
      const parts = (c) => {
        const nums = (String(c).match(/[\d.]+/g) || []).map(Number)
        if (!nums.length) return []
        if (/^color\(/i.test(String(c).trim())) {
          const [r, g, b, a] = nums
          return [r * 255, g * 255, b * 255, a === undefined ? 1 : a]
        }
        return nums
      }
      const lum = (col) => {
        const [r, g, b] = parts(col).slice(0, 3).map((v) => {
          const c = v / 255
          return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
        })
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      // Composite this element's stack down to the first opaque background.
      const backdrop = (el) => {
        let layers = []
        for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
          const p = parts(getComputedStyle(n).backgroundColor)
          if (!p.length) continue
          const a = p.length > 3 ? p[3] : 1
          if (a === 0) continue
          layers.push([p[0], p[1], p[2], a])
          if (a === 1) break
        }
        if (!layers.length) layers = [[255, 255, 255, 1]]
        let out = layers[layers.length - 1].slice(0, 3)
        for (let i = layers.length - 2; i >= 0; i--) {
          const [r, g, b, a] = layers[i]
          out = [a * r + (1 - a) * out[0], a * g + (1 - a) * out[1], a * b + (1 - a) * out[2]]
        }
        return `rgb(${out.join(',')})`
      }
      const out = []
      document.querySelectorAll('#mainContent *').forEach((el) => {
        const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim()
        if (text.length < 2) return
        const cs = getComputedStyle(el)
        if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.15) return
        const r = el.getBoundingClientRect()
        if (!r.width || !r.height) return
        const size = parseFloat(cs.fontSize)
        const bold = Number(cs.fontWeight) >= 700
        const large = size >= 24 || (size >= 18.66 && bold)
        const need = large ? 3 : 4.5
        const L1 = lum(cs.color), L2 = lum(backdrop(el))
        const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
        if (ratio < need) {
          out.push({ tab, text: text.slice(0, 34), ratio: Number(ratio.toFixed(2)), need,
            size, sel: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).trim().split(/\s+/)[0] : '') })
        }
      })
      return out
    }, tab))
  }
  return findings
}

// Interactive things smaller than WCAG 2.5.8's 24×24 CSS px. Run the page with
// a coarse pointer, since that is the counter tablet and the rules that bump
// these are scoped to `pointer: coarse`.
export async function targets(page, tabs = TABS) {
  const found = []
  for (const tab of tabs) {
    await page.evaluate((t) => window.renderTab(t), tab).catch(() => {})
    await page.waitForTimeout(280)
    found.push(...await page.evaluate((tab) => {
      const out = []
      document.querySelectorAll('#mainContent button, #mainContent a[href], #mainContent input, #mainContent select, #mainContent [role="button"]').forEach((el) => {
        const cs = getComputedStyle(el)
        if (cs.display === 'none' || cs.visibility === 'hidden') return
        const r = el.getBoundingClientRect()
        if (!r.width || !r.height) return
        const min = Math.min(Math.round(r.width), Math.round(r.height))
        if (min >= 24) return
        out.push({ tab, min, w: Math.round(r.width), h: Math.round(r.height),
          sel: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).trim().split(/\s+/)[0] : ''),
          text: (el.textContent || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 22) })
      })
      return out
    }, tab))
  }
  return found
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
  const file = buildAppHtml()
  console.log('built', path.relative(ROOT, file))

  if (process.argv.includes('--shot') || process.argv.includes('--audit') || process.argv.includes('--contrast') || process.argv.includes('--targets')) {
    const { chromium } = require(path.join(ROOT, 'node_modules/playwright-core'))
    const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
    const width = Number(arg('--width', process.argv.includes('--audit') ? 390 : 1280))
    const theme = arg('--theme', 'light')
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, hasTouch: process.argv.includes('--targets') })
    // Simple Mode's text-size steps (docs/DESIGN.md §Type). The third dimension
    // beside width and theme, and the one most likely to break a layout: every
    // screen here was laid out against 13px body copy and `largest` is 17px.
    // modals.mjs has taken --fs for a while; the tab sweep was only reachable by
    // setting data-fs by hand, so nobody ran it, and Manage Rental's Save button
    // sat 53px off a 390px screen at `largest` until the modal sweep found it.
    const fsSize = arg('--fs', 'standard')
    const page = await ctx.newPage()
    await page.goto('file://' + file, { waitUntil: 'load' })
    await page.waitForTimeout(800)
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme)
    if (fsSize !== 'standard') {
      await page.evaluate((v) => document.documentElement.setAttribute('data-fs', v), fsSize)
      await page.waitForTimeout(200)
    }
    const fsNote = fsSize === 'standard' ? '' : ` / text ${fsSize}`

    if (process.argv.includes('--targets')) {
      const seen = new Map()
      for (const f of await targets(page)) {
        const k = `${f.sel}|${f.min}`
        if (!seen.has(k)) seen.set(k, { ...f, tabs: new Set() })
        seen.get(k).tabs.add(f.tab)
      }
      const rows = [...seen.values()].sort((a, b) => a.min - b.min)
      for (const r of rows) {
        console.log(`✗ ${String(r.min).padStart(3)}px min  ${(r.w + '×' + r.h).padEnd(9)} ${r.sel.padEnd(22)} "${r.text}"  [${[...r.tabs].slice(0, 4).join(' ')}]`)
      }
      console.log(rows.length ? `\n${rows.length} distinct target(s) under 24×24 at ${width}px${fsNote}` : `\nno target under 24×24 at ${width}px${fsNote}`)
    } else if (process.argv.includes('--contrast')) {
      const found = await contrast(page)
      const seen = new Map()
      for (const f of found) {
        const key = `${f.sel}|${f.ratio}`
        if (!seen.has(key)) seen.set(key, { ...f, tabs: new Set() })
        seen.get(key).tabs.add(f.tab)
      }
      const rows = [...seen.values()].sort((a, b) => a.ratio - b.ratio)
      for (const r of rows) {
        console.log(`✗ ${String(r.ratio).padStart(5)}:1 (needs ${r.need}) ${String(Math.round(r.size)) + 'px'} ${r.sel.padEnd(24)} "${r.text}"  [${[...r.tabs].join(' ')}]`)
      }
      console.log(rows.length ? `\n${rows.length} distinct contrast failure(s) in ${theme}${fsNote}` : `\nno contrast failures in ${theme}${fsNote}`)
    } else if (process.argv.includes('--audit')) {
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
      console.log(notes.length ? `\n${notes.join('; ')} at ${width}px${fsNote}` : `\nall ${TABS.length} tabs render and none overflows at ${width}px${fsNote}`)
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
