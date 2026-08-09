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
import { measure, report } from './contrast.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const require = createRequire(import.meta.url)
const { chromium } = require(path.join(ROOT, 'node_modules/playwright-core'))

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const width = Number(arg('--width', 390))
const theme = arg('--theme', 'light')
const only = arg('--only', null)

// name → [tab, opener, root?, closer?]. Ids are looked up from the seed at
// runtime so the seed stays the single source of fixture truth. `root` and
// `closer` are only for the transient surfaces below — a dialog is found by
// shape and closed by the standard close functions.
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

// The surfaces that exist only while you are using them. They are not modals —
// no overlay shape, no closeModal() — so the loop above never saw them, which
// is the same blind spot that let a 2.92:1 error toast pass every audit. Each
// one names the box to measure and how to put it away again.
export const TRANSIENTS = [
  ['palette',       'dashboard', `openPalette()`, '.palette-box', `closePalette()`],
  // With a query typed: the quick-action tiles hide and the result rows appear,
  // a different set of text entirely. "co" matches seeded customers and phones.
  ['palette-hits',  'dashboard',
    `openPalette(); const i = document.getElementById('paletteInput'); i.value = 'co'; i.dispatchEvent(new Event('input'))`,
    '.palette-box', `closePalette()`],
  // A real undo toast, held open long enough to measure. commit/restore are
  // no-ops: this is the toast's paint job, not the delete path behind it.
  ['undo-toast',    'customers',
    `kcUndoable({ label: 'Deleted Miriam Cohen', commit: () => {}, restore: () => {}, seconds: 600 })`,
    '.kc-undo-toast', `kcUndoFlush()`],
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
  const contrastAll = []
  const wantContrast = process.argv.includes('--contrast')
  for (const [name, tab, js, root, closer] of [...MODALS, ...TRANSIENTS]) {
    if (only && name !== only) continue
    await page.evaluate((t) => window.renderTab(t), tab).catch(() => {})
    await page.waitForTimeout(250)
    try { await page.evaluate(js) } catch (e) { console.log(`✗ ${name}: opener threw — ${String(e.message).split('\n')[0]}`); bad++; continue }
    await page.waitForTimeout(350)
    const geo = await page.evaluate((sel) => {
      // The visible dialog: last modal-shaped box that isn't inside .hidden.
      // .modal is included because the customer card renders one directly.
      const cards = [...document.querySelectorAll(sel || '.modal-content, .modal-card, .modal, [role="dialog"], .kc-cpage')]
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
    }, root)
    if (!geo) { console.log(`✗ ${name}: no visible modal after opener`); bad++; continue }
    // Contrast, while the dialog is actually on screen. The --contrast sweep
    // renders a static page, so every dialog, the palette and the toasts were
    // never measured at all — that is how a 2.92:1 error toast survived every
    // clean audit. Measured here, where the thing exists.
    if (wantContrast) {
      const found = (await measure(page, root || '.modal-overlay:not(.hidden), .modal:not(.hidden), .kc-cpage'))
        .map((f) => ({ ...f, where: `${name}/${theme}` }))
      contrastAll.push(...found)
    }
    await page.screenshot({ path: path.join(HERE, `modal_${name}_${theme}_${width}.png`), fullPage: false })
    const flags = []
    if (geo.offRight || geo.offLeft) flags.push(`off-screen L${geo.offLeft}/R${geo.offRight}`)
    if (geo.scrollX > 0) flags.push(`sideways scroll +${geo.scrollX}px`)
    if (geo.overflowers.length) flags.push(`overflowers: ${geo.overflowers.join(', ')}`)
    if (flags.length) bad++
    console.log(`${flags.length ? '✗' : '✓'} ${name.padEnd(14)} ${geo.w}×${geo.h}  ${flags.join('  ') || 'clean'}`)
    if (closer) await page.evaluate(closer).catch(() => {})
    else await page.evaluate(() => {
      document.querySelectorAll('.modal-overlay, .modal').forEach((m) => m.classList.add('hidden'))
      if (typeof closeDynamicModal === 'function') try { closeDynamicModal() } catch {}
      if (typeof closeModal === 'function') try { closeModal() } catch {}
      if (typeof dismissCustomerCard === 'function') try { dismissCustomerCard() } catch {}
    })
    await page.waitForTimeout(120)
  }
  if (wantContrast) { report(contrastAll, `the modals (${theme})`); bad += contrastAll.length }
  await browser.close()
  console.log(bad ? `\n${bad} modal(s) flagged at ${width}px ${theme}` : `\nall modals geometrically clean at ${width}px ${theme} — now look at the screenshots`)
  process.exit(bad ? 1 : 0)
}
