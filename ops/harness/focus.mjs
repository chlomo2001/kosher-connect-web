// Can you SEE where the keyboard is?
//
//   node ops/harness/focus.mjs                 # light
//   node ops/harness/focus.mjs --theme dark
//   node ops/harness/focus.mjs --only rentals
//
// Every other sweep in here measures geometry or colour. This one measures a
// state: focus each keyboard stop in turn and compare what is painted before
// and after. An element that matches :focus-visible and paints nothing is
// focusable in name only — the keyboard is somewhere on the screen and the
// screen does not say where.
//
// It is not a theoretical check. The first run of it found the Rentals
// drill-down cards and every WCAG-2.1.1 scroll region painting their resting
// shadow while focused (the zero-specificity --ring loses to any component
// shadow), and the sidebar wearing a translucent blue ring on navy.
//
// Two things it must do or it lies:
//   · press a real Tab first — :focus-visible only matches once Chrome believes
//     focus is keyboard-driven, and without it EVERY ring reads as missing;
//   · wait for the transition — focus styles animate, and reading the computed
//     style in the same tick returns the pre-focus values.
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { buildAppHtml, BROWSER_ENV } from './render.mjs'
import { MODALS, TRANSIENTS } from './modals.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const require = createRequire(import.meta.url)
const { chromium } = require(path.join(ROOT, 'node_modules/playwright-core'))

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const theme = arg('--theme', 'light')
const only = arg('--only', null)

const TABS = ['dashboard', 'customers', 'rentals', 'wallet', 'shop', 'settings']

const file = buildAppHtml()
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: BROWSER_ENV })
const ctx = await browser.newContext({ locale: 'en-GB', viewport: { width: 1280, height: 900 }, colorScheme: theme })
const page = await ctx.newPage()
await page.goto('file://' + file, { waitUntil: 'load' })
await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme)
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

async function probe(label, seenGlobally) {
  await page.keyboard.press('Tab')          // …into keyboard mode. See the header.
  const bad = await page.evaluate(async (already) => {
    const settle = () => new Promise((r) => setTimeout(r, 90))
    const SEL = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]),'
      + ' textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
    const snap = (el) => {
      const s = getComputedStyle(el)
      return [s.outlineStyle, s.outlineWidth, s.outlineColor, s.boxShadow, s.borderColor, s.backgroundColor].join('|')
    }
    const out = []
    const seen = new Set(already)
    for (const el of [...document.querySelectorAll(SEL)].filter(visible)) {
      const key = (el.tagName + '.' + String(el.className || '').trim().split(/\s+/)[0]).slice(0, 60)
      if (seen.has(key)) continue          // one verdict per kind — and it keeps this fast
      // An element that is ALREADY focused cannot change by being focused, and
      // reporting it would blame the palette's autofocused search box every run.
      if (el === document.activeElement) continue
      const before = snap(el)
      el.focus()
      await settle()
      if (snap(el) !== before) { seen.add(key); continue }
      seen.add(key)
      out.push({ key, text: (el.innerText || el.value || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 44) })
    }
    return { out, seen: [...seen] }
  }, [...seenGlobally])
  for (const k of bad.seen) seenGlobally.add(k)
  if (bad.out.length) {
    console.log(`✗ ${label}`)
    for (const b of bad.out) console.log(`    ${b.key.padEnd(32)} ${b.text}`)
  }
  return bad.out.length
}

let bad = 0
const seenGlobally = new Set()
for (const tab of TABS) {
  if (only && only !== tab) continue
  await page.evaluate((t) => window.renderTab(t), tab).catch(() => {})
  await page.waitForTimeout(280)
  bad += await probe(`tab:${tab}`, seenGlobally)
}
for (const [name, tab, js, , closer] of [...MODALS, ...TRANSIENTS]) {
  if (only && only !== name) continue
  // The till is a whole-page takeover with its own known geometry item; the
  // sweep opens every other surface.
  if (name === 'till') continue
  await page.evaluate((t) => window.renderTab(t), tab).catch(() => {})
  await page.waitForTimeout(200)
  try { await page.evaluate(js) } catch { continue }
  await page.waitForTimeout(320)
  bad += await probe(`modal:${name}`, seenGlobally)
  if (closer) await page.evaluate(closer).catch(() => {})
  else await page.evaluate(() => {
    document.querySelectorAll('.modal-overlay, .modal').forEach((m) => m.classList.add('hidden'))
    for (const f of ['closeDynamicModal', 'closeModal', 'dismissCustomerCard']) { try { window[f]?.() } catch {} }
  })
  await page.waitForTimeout(110)
}
await browser.close()
console.log(bad
  ? `\n${bad} element kind(s) focus with nothing to show for it (${theme})`
  : `\nevery keyboard stop shows itself (${theme}, ${seenGlobally.size} kinds)`)
process.exit(bad ? 1 : 0)
