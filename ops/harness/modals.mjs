// Open the app's big modals offline and look at them — the same idea as
// render.mjs, one layer deeper. Tabs got eyeballed for four rounds before
// anyone opened a modal in the harness; the first run of this found the
// customer card's whole tool strip sitting off the right edge of a phone.
//
//   node ops/harness/modals.mjs                          # all, 390px light
//   node ops/harness/modals.mjs --width 390 --theme dark
//   node ops/harness/modals.mjs --only customer-card
//
// Each modal is opened, screenshotted (modal_<name>_<theme>_<width>.png in
// this directory), and measured: does the box sit inside the viewport, does
// anything inside it overhang its right edge, does it scroll sideways. A ✗
// is worth a look; a ✓ only means the geometry is sane, not that it reads
// well — the screenshots are the point.
//
// The till (openSaleModal) is deliberately absent: it is not a modal, it
// takes over the page (pos-mode), and render.mjs --shot shop covers it.
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { buildAppHtml } from './render.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const require = createRequire(import.meta.url)
const { chromium } = require(path.join(ROOT, 'node_modules/playwright-core'))

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const width = Number(arg('--width', 390))
const theme = arg('--theme', 'light')
const only = arg('--only', null)

// name → [tab, opener]. Ids are looked up from the seed at runtime so the
// seed stays the single source of fixture truth.
export const MODALS = [
  ['customer-new',  'customers', `showModal()`],
  ['customer-card', 'customers', `openCustomerById(window.__kc.customer)`],
  ['rental-new',    'rentals',   `openNewRentalModal()`],
  ['rental-manage', 'rentals',   `openManageRentalModal(window.__kc.rental)`],
  ['booking-new',   'bookings',  `openNewBookingModal()`],
  ['wallet',        'wallet',    `openWalletModal(window.__kc.customer)`],
  ['sim-add',       'sim',       `openAddSimModal()`],
  ['sim-manage',    'sim',       `openManageSimModal(window.__kc.sim)`],
  ['vn-new',        'virtual',   `openNewVNModal()`],
  ['stock-item',    'shop',      `openStockItemModal()`],
  // The small dynamic dialogs staff open all day long.
  ['remind',        'customers', `openRemindModal('customer', window.__kc.customer)`],
  ['draft-reminder','customers', `openDraftReminderModal(window.__kc.customer)`],
  ['log-comm',      'customers', `openLogCommModal(window.__kc.customer)`],
  ['cashup',        'dashboard', `openCashupModal()`],
  ['supplier-return','shop',     `openSupplierReturnModal()`],
  ['supplier-return-manage','shop', `openSupplierReturnModal(window.__kc.supplierReturn)`],
  ['goods-in',      'shop',      `openGoodsInModal()`],
  // Not modals, but the same eyes-on treatment: the Customer-360 page
  // (/customers/<id>) renders in the content column — .kc-cpage is in the
  // geometry selector below so both sub-tabs get measured and screenshotted.
  ['customer-page',     'customers', `openCustomerPage(window.__kc.customer)`],
  ['customer-page-log', 'customers', `openCustomerPage(window.__kc.customer); kcCustomerPageTab('activity')`],
]

// Run directly to audit the modals; import it (css-diff.mjs does) to reuse
// MODALS without opening a browser.
if (import.meta.url === `file://${process.argv[1]}`) {
  const file = buildAppHtml()
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, colorScheme: theme })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('  pageerror:', String(e).split('\n')[0]))
  await page.goto('file://' + file, { waitUntil: 'load' })
  await page.waitForTimeout(900)
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme)
  await page.evaluate(async () => {
    // Routes differ on envelope ({customers:[…]} vs a bare array) — take either.
    const first = async (u, k) => { const d = await (await fetch(u)).json(); return (d[k] || d || [])[0]?.id }
    window.__kc = {
      customer: await first('/api/customers', 'customers'),
      rental: await first('/api/rentals', 'rentals'),
      sim: await first('/api/sims', 'sims'),
      supplierReturn: await first('/api/supplier-returns', 'returns'),
    }
  })

  let bad = 0
  for (const [name, tab, js] of MODALS) {
    if (only && name !== only) continue
    await page.evaluate((t) => window.renderTab(t), tab).catch(() => {})
    await page.waitForTimeout(250)
    try { await page.evaluate(js) } catch (e) { console.log(`✗ ${name}: opener threw — ${String(e.message).split('\n')[0]}`); bad++; continue }
    await page.waitForTimeout(350)
    const geo = await page.evaluate(() => {
      // The visible dialog: last modal-shaped box that isn't inside .hidden.
      // .modal is included because the customer card renders one directly.
      const cards = [...document.querySelectorAll('.modal-content, .modal-card, .modal, [role="dialog"], .kc-cpage')]
        .filter((el) => el.getBoundingClientRect().width && !el.closest('.hidden'))
      const el = cards[cards.length - 1]
      if (!el) return null
      const r = el.getBoundingClientRect()
      const overflowers = []
      el.querySelectorAll('*').forEach((k) => {
        const kr = k.getBoundingClientRect()
        if (kr.width && kr.right - r.right > 1.5)
          overflowers.push(k.tagName.toLowerCase() + (k.className ? '.' + String(k.className).trim().split(/\s+/)[0] : '') + ` +${Math.round(kr.right - r.right)}px`)
      })
      return {
        w: Math.round(r.width), h: Math.round(r.height),
        offRight: Math.round(Math.max(0, r.right - innerWidth)),
        offLeft: Math.round(Math.max(0, -r.left)),
        scrollX: el.scrollWidth - el.clientWidth,
        overflowers: [...new Set(overflowers)].slice(0, 5),
      }
    })
    if (!geo) { console.log(`✗ ${name}: no visible modal after opener`); bad++; continue }
    await page.screenshot({ path: path.join(HERE, `modal_${name}_${theme}_${width}.png`), fullPage: false })
    const flags = []
    if (geo.offRight || geo.offLeft) flags.push(`off-screen L${geo.offLeft}/R${geo.offRight}`)
    if (geo.scrollX > 0) flags.push(`sideways scroll +${geo.scrollX}px`)
    if (geo.overflowers.length) flags.push(`overflowers: ${geo.overflowers.join(', ')}`)
    if (flags.length) bad++
    console.log(`${flags.length ? '✗' : '✓'} ${name.padEnd(14)} ${geo.w}×${geo.h}  ${flags.join('  ') || 'clean'}`)
    await page.evaluate(() => {
      document.querySelectorAll('.modal-overlay, .modal').forEach((m) => m.classList.add('hidden'))
      if (typeof closeDynamicModal === 'function') try { closeDynamicModal() } catch {}
      if (typeof closeModal === 'function') try { closeModal() } catch {}
      if (typeof dismissCustomerCard === 'function') try { dismissCustomerCard() } catch {}
    })
    await page.waitForTimeout(120)
  }
  await browser.close()
  console.log(bad ? `\n${bad} modal(s) flagged at ${width}px ${theme}` : `\nall modals geometrically clean at ${width}px ${theme} — now look at the screenshots`)
  process.exit(bad ? 1 : 0)
}
