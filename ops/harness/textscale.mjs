// Does Simple Mode reach ALL the text?
//
//   node ops/harness/textscale.mjs
//
// Renders every tab and every modal twice — at `standard` and at `largest` —
// and diffs the computed font-size of each element that holds its own words.
// Anything identical in both renders is text the size control cannot touch.
//
// The failure it exists to catch is invisible in either render alone: the copy
// looks fine at Standard and fine-ish at Largest, and only a diff shows one
// line sitting at 15px while everything round it grew 30%. That is how
// `body { font-size: 15px }` — the size inherited by every element that never
// asked for one — went unnoticed through nine Simple Mode sweeps.
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { buildAppHtml, BROWSER_ENV } from './render.mjs'
import { MODALS } from './modals.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const require = createRequire(import.meta.url)
const { chromium } = require(path.join(ROOT, 'node_modules/playwright-core'))

const TABS = ['dashboard', 'customers', 'rentals', 'sim', 'bookings', 'wallet',
  'repairs', 'shop', 'tasks', 'settings']

// Text that holds its size ON PURPOSE. Both are argued where they are defined;
// this list is the second half of that argument, so the sweep can be green and
// a NEW frozen size is the only thing that turns it red.
const BY_DESIGN = [
  // The button that changes the text size must not change its own — it would
  // grow under the finger pressing it. (globals.css .kc-textsize)
  'BUTTON.theme-toggle.kc-textsize',
  // A glyph, not a word: holding still keeps the icon column aligned as the
  // labels beside it scale. (app.css .card-action .ca-icon)
  'SPAN.ca-icon',
  // The Aa inside the text-size button is a READOUT of the mode, not text in
  // it: it is 13/15/18px BY the mode, so of course it does not scale with the
  // mode. It sits inside the button above, which is itself by design.
  // (globals.css .kc-fs-aa — added 18 Aug with the level pips.)
  'SPAN.kc-fs-aa',
]

const file = buildAppHtml()
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: BROWSER_ENV })

async function measure(fs) {
  const ctx = await browser.newContext({ locale: 'en-GB', viewport: { width: 1280, height: 900 }, colorScheme: 'light' })
  const page = await ctx.newPage()
  await page.goto('file://' + file, { waitUntil: 'load' })
  await page.evaluate((s) => { if (s !== 'standard') document.documentElement.setAttribute('data-fs', s) }, fs)
  await page.waitForTimeout(900)
  await page.evaluate(async () => {
    const first = async (u, k) => { const d = await (await fetch(u)).json(); return (d[k] || d || [])[0]?.id }
    window.__kc = {
      customer: await first('/api/customers', 'customers'),
      rental: await first('/api/rentals', 'rentals'),
      sim: await first('/api/sims', 'sims'),
      supplierReturn: await first('/api/supplier-returns', 'returns'),
    }
  })
  const sizes = new Map()
  const grab = async (where) => {
    const rows = await page.evaluate((w) => {
      const out = []
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT)
      let el
      while ((el = walk.nextNode())) {
        // Only elements holding their OWN words — a wrapper inherits its
        // child's apparent size and would report twice.
        if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1)) continue
        const r = el.getBoundingClientRect()
        if (!r.width || !r.height) continue
        const kind = el.tagName + '.' + String(el.className || '').trim().split(/\s+/).slice(0, 2).join('.')
        out.push([`${w}|${kind}`, kind, parseFloat(getComputedStyle(el).fontSize),
          (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 36)])
      }
      return out
    }, where)
    for (const [key, kind, size, text] of rows) if (!sizes.has(key)) sizes.set(key, { kind, size, text })
  }
  for (const tab of TABS) {
    await page.evaluate((t) => window.renderTab(t), tab).catch(() => {})
    await page.waitForTimeout(250)
    await grab('tab:' + tab)
  }
  for (const [name, tab, js] of MODALS) {
    await page.evaluate((t) => window.renderTab(t), tab).catch(() => {})
    await page.waitForTimeout(150)
    try { await page.evaluate(js) } catch { continue }
    await page.waitForTimeout(300)
    await grab('modal:' + name)
    await page.evaluate(() => {
      document.querySelectorAll('.modal-overlay, .modal').forEach((m) => m.classList.add('hidden'))
      for (const f of ['closeDynamicModal', 'closeModal', 'dismissCustomerCard']) { try { window[f]?.() } catch {} }
    })
    await page.waitForTimeout(100)
  }
  await ctx.close()
  return sizes
}

const std = await measure('standard')
const big = await measure('largest')
await browser.close()

const stuck = []
for (const [key, v] of std) {
  const b = big.get(key)
  if (!b || b.size !== v.size) continue
  if (BY_DESIGN.includes(v.kind)) continue
  stuck.push({ key, ...v })
}
for (const s of stuck.slice(0, 30)) {
  console.log(`  ${String(s.size).padStart(5)}px  ${s.key.padEnd(48)} ${s.text}`)
}
if (stuck.length > 30) console.log(`  …and ${stuck.length - 30} more`)
console.log(stuck.length
  ? `\n${stuck.length} text element(s) do not grow in Simple Mode`
  : `every text element grows in Simple Mode (${std.size} compared)`)
process.exit(stuck.length ? 1 : 0)
