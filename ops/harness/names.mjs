// Interactive things a screen reader would announce as nothing at all.
//
//   node ops/harness/names.mjs
//
// A button with no text, no aria-label, no title; an input whose <label> was
// never associated with it. The 24×24 sweep proves you can HIT a control and
// the contrast sweep proves you can SEE it; this asks whether it says what it
// is. Its first run found five form controls (two time fields sharing one
// label, three headed by a plain <span> instead of a <label>), a returned
// switch, both halves of the equipment slider, and three table cells that
// kcMarkClickable had turned into unnamed buttons because their only onclick
// was an event.stopPropagation() guard.
//
// Exits non-zero on a finding, so it can sit in audit-all.
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { buildAppHtml, BROWSER_ENV } from './render.mjs'
import { MODALS, TRANSIENTS } from './modals.mjs'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(import.meta.url)
const { chromium } = require(path.join(ROOT, 'node_modules/playwright-core'))
const file = buildAppHtml()
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: BROWSER_ENV })
const c = await b.newContext({ locale: 'en-GB', viewport: { width: 1280, height: 900 }, colorScheme: 'light' })
const p = await c.newPage()
await p.goto('file://' + file, { waitUntil: 'load' })
await p.waitForTimeout(900)
await p.evaluate(async () => {
  const first = async (u, k) => { const d = await (await fetch(u)).json(); return (d[k] || d || [])[0]?.id }
  window.__kc = { customer: await first('/api/customers', 'customers'), rental: await first('/api/rentals', 'rentals'),
    sim: await first('/api/sims', 'sims'), supplierReturn: await first('/api/supplier-returns', 'returns') }
})
const seen = new Set()
const scan = async (where) => {
  const rows = await p.evaluate((w) => {
    const out = []
    const sel = 'button, a[href], [role="button"], input:not([type=hidden]), select, textarea'
    document.querySelectorAll(sel).forEach((el) => {
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) return
      // The accessible name, roughly as a screen reader computes it.
      const labelled = el.getAttribute('aria-labelledby')
      const fromIds = labelled ? labelled.split(/\s+/).map((i) => document.getElementById(i)?.textContent || '').join(' ') : ''
      const own = (el.innerText || '').trim()
      const val = el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA'
        ? (document.querySelector(`label[for="${CSS.escape(el.id || '~')}"]`)?.textContent || el.closest('label')?.textContent || '')
        : ''
      const name = [el.getAttribute('aria-label'), el.title, own, fromIds, val, el.getAttribute('placeholder'), el.getAttribute('alt')]
        .map((x) => (x || '').trim()).find(Boolean) || ''
      if (name) return
      out.push([w + '|' + el.tagName + '.' + String(el.className || '').trim().split(/\s+/)[0],
        (el.outerHTML || '').replace(/\s+/g, ' ').slice(0, 90)])
    })
    return out
  }, where)
  for (const [k, html] of rows) {
    if (seen.has(k)) continue
    seen.add(k)
    console.log(`  ${k.padEnd(46)} ${html}`)
  }
}
for (const t of ['dashboard', 'customers', 'rentals', 'sim', 'bookings', 'wallet', 'repairs', 'shop', 'tasks', 'settings']) {
  await p.evaluate((x) => window.renderTab(x), t).catch(() => {})
  await p.waitForTimeout(250)
  await scan('tab:' + t)
}
for (const [name, tab, js, , closer] of [...MODALS, ...TRANSIENTS]) {
  if (name === 'till') continue
  await p.evaluate((x) => window.renderTab(x), tab).catch(() => {})
  await p.waitForTimeout(150)
  try { await p.evaluate(js) } catch { continue }
  await p.waitForTimeout(300)
  await scan('modal:' + name)
  if (closer) await p.evaluate(closer).catch(() => {})
  else await p.evaluate(() => {
    document.querySelectorAll('.modal-overlay, .modal').forEach((m) => m.classList.add('hidden'))
    for (const f of ['closeDynamicModal', 'closeModal', 'dismissCustomerCard']) { try { window[f]?.() } catch {} }
  })
  await p.waitForTimeout(100)
}
await b.close()
console.log(seen.size
  ? `\n${seen.size} interactive kind(s) announce as nothing`
  : 'every interactive element has a name')
process.exit(seen.size ? 1 : 0)
