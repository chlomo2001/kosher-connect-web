// Content that escapes the CARD it lives in.
//
//   node ops/harness/cardfit.mjs                       # 390px, text largest
//   node ops/harness/cardfit.mjs --width 320 --fs standard
//
// Every other sweep here measures the PAGE. render.mjs --audit fails a tab that
// scrolls sideways; clipped.mjs fails a control that hides its own label. A
// card whose heading runs seven pixels past its own rounded corner does neither
// — the page is fine, the control is readable, and the app just looks broken.
// That is precisely what the owner reported on 19 Aug ("at extra-large text the
// card overflows"), and eight checks had passed over it, because none of them
// was looking at the box rather than the screen.
//
// A card that SCROLLS sideways on purpose is not a finding — a wide table in an
// overflow-x wrapper is reachable, which is the wrapper doing its job. Nor is
// anything inside such a wrapper.
//
// `overflow: hidden` is NOT in that exemption, and the first draft of this file
// had it there — which made the check pass over the very defect it was written
// for. Hidden does not make the problem safe: it makes the words disappear at
// the card's edge with no way to reach them, which is worse than a scrollbar
// and is exactly what "the card overflows" looks like to somebody using it.
//
// Exits non-zero on a finding.
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { buildAppHtml, BROWSER_ENV } from './render.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(import.meta.url)
const { chromium } = require(path.join(ROOT, 'node_modules/playwright-core'))

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const width = Number(arg('--width', 390))
const fsSize = arg('--fs', 'largest')
const theme = arg('--theme', 'light')

const TABS = ['dashboard', 'customers', 'rentals', 'sim', 'bookings', 'wallet', 'repairs',
  'services', 'shop', 'koltorah', 'virtual', 'tasks', 'review', 'mail', 'settings']

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: BROWSER_ENV })
const ctx = await b.newContext({ viewport: { width, height: 900 }, locale: 'en-GB' })
const p = await ctx.newPage()
await p.goto('file://' + buildAppHtml(), { waitUntil: 'load' })
await p.waitForTimeout(900)
await p.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme)
await p.evaluate((s) => {
  if (s === 'standard') document.documentElement.removeAttribute('data-fs')
  else document.documentElement.setAttribute('data-fs', s)
}, fsSize)

let findings = 0
for (const tab of TABS) {
  await p.evaluate((t) => renderTab(t), tab).catch(() => {})
  await p.waitForTimeout(450)
  const bad = await p.evaluate(() => {
    const out = []
    const CARDS = '#mainContent .card, #mainContent .stat-card, #mainContent .table-card, #mainContent .dash-hero'
    // Reachable-by-scrolling only. See the note at the top about `hidden`.
    const scrolly = (s) => s.overflowX === 'auto' || s.overflowX === 'scroll' ||
      s.overflow === 'auto' || s.overflow === 'scroll'
    document.querySelectorAll(CARDS).forEach((card) => {
      const cr = card.getBoundingClientRect()
      if (!cr.width) return
      if (scrolly(getComputedStyle(card))) return
      card.querySelectorAll('*').forEach((k) => {
        const r = k.getBoundingClientRect()
        if (!r.width || !r.height) return
        for (let par = k.parentElement; par && par !== card; par = par.parentElement) {
          if (scrolly(getComputedStyle(par))) return
        }
        const past = Math.round(r.right - cr.right)
        if (past > 1) {
          const cls = String(k.className || '').split(' ').filter(Boolean)[0] || ''
          out.push(`${k.tagName.toLowerCase()}${cls ? '.' + cls : ''} +${past}px  «${(k.textContent || '').trim().slice(0, 44)}»`)
        }
      })
    })
    return [...new Set(out)]
  })
  if (bad.length) {
    findings += bad.length
    console.log(`✗ ${tab}`)
    bad.slice(0, 8).forEach((x) => console.log('   ', x))
    if (bad.length > 8) console.log(`    …and ${bad.length - 8} more`)
  }
}
await b.close()

console.log(findings
  ? `\n✗ ${findings} thing(s) painted outside their card at ${width}px / text ${fsSize}`
  : `nothing overflows its card at ${width}px / text ${fsSize}`)
process.exit(findings ? 1 : 0)
