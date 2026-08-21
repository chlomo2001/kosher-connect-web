// Open the app's big modals offline and look at them — the same idea as
// render.mjs, one layer deeper. Tabs got eyeballed for four rounds before
// anyone opened a modal in the harness; the first run of this found the
// customer card's whole tool strip sitting off the right edge of a phone.
//
//   node ops/harness/modals.mjs                          # all, 390px light
//   node ops/harness/modals.mjs --width 390 --theme dark
//   node ops/harness/modals.mjs --only customer-card
//   node ops/harness/modals.mjs --fs largest              # Simple Mode, 17px body
//
// Each modal is opened, screenshotted (modal_<name>_<theme>_<width>.png in
// this directory, with _large/_largest appended when --fs is not standard so a
// Simple Mode run cannot overwrite the standard shot), and measured: does the box sit inside the viewport, does
// anything inside it overhang its right edge, does it scroll sideways. A ✗
// is worth a look; a ✓ only means the geometry is sane, not that it reads
// well — the screenshots are the point.
//
// The till (openSaleModal) is deliberately absent: it is not a modal, it
// takes over the page (pos-mode), and render.mjs --shot shop covers it.
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { buildAppHtml, BROWSER_ENV } from './render.mjs'
import { measure, report } from './contrast.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const require = createRequire(import.meta.url)

// Loaded WHERE IT IS USED, not here. This module exports MODALS as a plain
// registry that four other harnesses and one unit test import; requiring a
// browser at module scope makes every one of them need Chromium installed to
// read a list of strings. It broke CI for 17 hours from 19 Aug: `npm ci` does
// not install playwright-core (it is not in package.json — it comes with the
// dev container), so test/manualShots.test.mjs threw on import, taking its ten
// tests with it and reporting as one failure. render.mjs already keeps its own
// require inside the run-directly block, which is why it never had this bug.
const loadChromium = () => require(path.join(ROOT, 'node_modules/playwright-core')).chromium

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const width = Number(arg('--width', 390))
const theme = arg('--theme', 'light')
const only = arg('--only', null)
// Simple Mode (--fs-scale). A third dimension beside width and theme, and the
// one most likely to break a modal: every box in here is sized for 13px body
// copy, and `largest` is 17px. Standard / large / largest — see docs/DESIGN.md.
const fsSize = arg('--fs', 'standard')

// name → [tab, opener, root?, closer?]. Ids are looked up from the seed at
// runtime so the seed stays the single source of fixture truth. `root` and
// `closer` are only for the transient surfaces below — a dialog is found by
// shape and closed by the standard close functions.
export const MODALS = [
  // openAddModal(), not showModal(): the add form differs from the raw markup
  // (the carrier-login field is hidden while adding), and screenshotting the
  // bare modal measured a screen no one is ever shown.
  ['customer-new',  'customers', `openAddModal()`],
  // The edit form is no longer the same screen as the add form — the carrier
  // login field is hidden on one and shown on the other — so it gets measured
  // in its own right instead of being assumed identical.
  ['customer-edit', 'customers', `openEditModal(window.__kc.customer)`],
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
  // The stock story (E4). The opener is async and resolves once the dialog is
  // painted — safe to await, unlike the confirm/prompt openers below whose
  // promise only settles when a person answers.
  ['stock-story',   'shop',      `openStockStory(shopItems[0].id)`],
  // The duplicate review. It shipped unmeasured, and the first run of it here
  // found four sub-24px targets and two sides of a pair that a phone stacked
  // into an unreadable column — exactly the class of thing the other nineteen
  // entries exist to catch. Answers from the seed's /api/customers/duplicates.
  ['dup-scan',      'customers', `openDupScanModal()`],
  // Built 08-13 and never measured: the finishing card every counter flow now
  // ends on, the New-pool card that stacks OVER the rental form (the second
  // overlay — the loop's "last modal-shaped box" rule picks it up), and the
  // business summary. Three surfaces staff meet daily that no sweep had seen.
  ['done-panel',    'rentals',   `showDonePanel({
     title: '✅ Rental saved', customerId: window.__kc.customer,
     customerName: 'Menachem Adler', customerPhone: '+447911123456',
     summary: '+44 7911 123456 · 12 Aug 2026 → 26 Aug 2026 · 14 chargeable days',
     total: 140, payLine: '£60 paid, £80 on account', owed: 80, method: 'cash', paidNow: true,
     lines: [{ name: 'Phone rental +44 7911 123456 · 12 Aug → 26 Aug', qty: 1, total: 140 }],
     smsText: 'Your rental is ready.',
     again: { label: '📱 Another rental', sub: 'same customer' } })`],
  ['pool-new',      'rentals',
    `openNewRentalModal();
     const s = document.createElement('select'); s.id = 'rPool'; s.innerHTML = '<option value="__new__">';
     s.value = '__new__'; document.body.appendChild(s); poolSelectChanged(s);
     // …and take it away again. Left attached it outlived this entry and turned
     // up in every later surface as an unnamed <select>, which is exactly the
     // kind of ghost that makes a sweep report defects the app does not have.
     s.remove()`],
  ['business-summary', 'dashboard', `openBusinessSummary()`],
  // Answering a text a customer sent in (owner item 21). The log has to be
  // loaded first — the composer quotes the message it is replying to, and the
  // seed carries one answerable text and one from somebody who texted STOP so
  // the Reply control can be checked for being ABSENT as well as present.
  ['sms-reply',     'settings',  `(async () => {
     await loadMessageLog();
     msgLogReply('5');
   })()`],
  // "Make this a task", the one affordance wherever something arrives (owner
  // items 2 and 6). Opened from the message log because that is one of the
  // three places it hangs; the box itself is the same on all three.
  // The forward-to-customers approval queue (owner item 20). Owner-only, so
  // the harness runs it as the owner the seed already signs in as.
  ['forward-queue', 'mail', `openForwardQueue()`],
  ['task-from-here', 'settings', `(async () => {
     await loadMessageLog();
     msgLogTask('5');
   })()`],
  // The reconciliation screen — not a modal either, it replaces the content
  // column like the Customer-360 page. Worth the eyes now that Stripe charges
  // triage through it beside bank rows.
  ['bank-recon',    'wallet',    `renderBankRecon()`, '#mainContent'],
  // Choosing the sender by hand. Driven into its no-match state on purpose:
  // that is where it offers to add the person, and an empty result list is
  // the one view of this box worth checking for contrast and fit.
  ['bank-pick',    'wallet',    `(async () => {
     await renderBankRecon();
     const t = (bankData.transactions || []).find(x => x.amount > 0) || (bankData.transactions || [])[0];
     bankPick(t.id);
     document.getElementById('bankPickSearch').value = 'Hershl H';
     bankPickList(t.id);
   })()`],
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
  // The till. Not a dialog either — it takes the whole page over (pos-mode),
  // which is exactly why the tab sweep never reaches it: the sweep renders
  // tabs, and the till is what the shop tab becomes once you press Sell.
  ['till',          'shop', `openSaleModal()`, 'body.pos-mode #mainContent', `closePosView()`],
  // The two house dialogs, which nothing here had ever opened. They are the
  // ask before every destructive action in the app — deleting a customer,
  // removing a team member, charging a card, retiring a shop item — and on
  // 21 Aug they took over eighteen questions that used to be window.confirm
  // and window.prompt, so the sweep not covering them stopped being tolerable.
  //
  // Called the way the app calls them, not built by hand: `api.confirmDelete`
  // is the real builder for ten of those questions, and the message text is
  // lifted verbatim from a real call site. Both closers answer "no", so no
  // entry here deletes, charges or patches anything.
  //
  // `void`, and it is load-bearing. Every other opener returns undefined, but a
  // dialog opener returns the PROMISE the dialog resolves when it is answered —
  // and `await page.evaluate(js)` waits on a returned promise. The runner sat
  // waiting for an answer while the only thing that could answer was the closer
  // thirty lines below, which it never reached. The first run of these four
  // wedged the sweep for half an hour and printed nothing at all.
  //
  // And `\\n`, not `\n`: these openers are TEMPLATE LITERALS, so a single
  // backslash-n becomes a real newline in the JS handed to page.evaluate —
  // inside a single-quoted string, which is a syntax error.
  ['confirm-delete', 'customers',
    `void window.api.confirmDelete('Delete "Miriam Cohen"?\\n\\nThis cannot be undone.', 'Delete')`,
    '#kcConfirm .modal', `kcConfirmDone(false)`],
  // The longest message any of them carries, which is the one that would wrap
  // badly first at 320px with Simple Mode text.
  ['confirm-long',  'settings',
    `void window.api.confirmDelete('Remove YOURSELF from the team?\\n\\nYou will be signed out immediately and lose all access. Only possible while another admin remains.', 'Remove')`,
    '#kcConfirm .modal', `kcConfirmDone(false)`],
  // kcPrompt asking for money — a decimal keypad and a £ label.
  ['prompt-charge', 'customers', `void chargeCardOnFile(window.__kc.customer)`,
    '#kcPrompt .modal', `kcPromptDone(null)`],
  // kcPrompt with a pre-filled value, selected on open. Cancelling returns
  // before patchTask, so the task id does not have to exist.
  ['prompt-snooze', 'tasks', `void snoozeTask('none', 'pick')`,
    '#kcPrompt .modal', `kcPromptDone(null)`],
]

// Run directly to audit the modals; import it (css-diff.mjs does) to reuse
// MODALS without opening a browser.
if (import.meta.url === `file://${process.argv[1]}`) {
  const file = buildAppHtml()
  const chromium = loadChromium()
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: BROWSER_ENV })
  const ctx = await browser.newContext({ locale: 'en-GB', viewport: { width, height: 844 }, colorScheme: theme })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('  pageerror:', String(e).split('\n')[0]))
  await page.goto('file://' + file, { waitUntil: 'load' })
  await page.waitForTimeout(900)
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme)
  // …and Simple Mode, the same way the app does it: an attribute on <html>.
  await page.evaluate((s) => {
    if (s === 'standard') document.documentElement.removeAttribute('data-fs')
    else document.documentElement.setAttribute('data-fs', s)
  }, fsSize)
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
    await page.screenshot({ path: path.join(HERE, `modal_${name}_${theme}_${width}${fsSize === 'standard' ? '' : '_' + fsSize}.png`), fullPage: false })
    const flags = []
    if (geo.offRight || geo.offLeft) flags.push(`off-screen L${geo.offLeft}/R${geo.offRight}`)
    if (geo.scrollX > 0) flags.push(`sideways scroll +${geo.scrollX}px`)
    if (geo.overflowers.length) flags.push(`overflowers: ${geo.overflowers.join(', ')}`)
    if (flags.length) bad++
    console.log(`${flags.length ? '✗' : '✓'} ${name.padEnd(14)} ${geo.w}×${geo.h}  ${flags.join('  ') || 'clean'}`)
    if (closer) await page.evaluate(closer).catch(() => {})
    else await page.evaluate(() => {
      // Hide the OVERLAY, and any modal box that stands on its own (the
      // customer card renders one directly) — but never the .modal inside an
      // overlay. showModal() only un-hides the overlay, so hiding its inner box
      // left it stuck: the next entry to open that same dialog measured an
      // empty screen and failed as "no visible modal". It went unnoticed while
      // no two entries opened the same dialog.
      document.querySelectorAll('.modal-overlay').forEach((m) => m.classList.add('hidden'))
      document.querySelectorAll('.modal').forEach((m) => {
        if (!m.closest('.modal-overlay')) m.classList.add('hidden')
      })
      if (typeof closeDynamicModal === 'function') try { closeDynamicModal() } catch {}
      if (typeof closeModal === 'function') try { closeModal() } catch {}
      if (typeof dismissCustomerCard === 'function') try { dismissCustomerCard() } catch {}
    })
    await page.waitForTimeout(120)
  }
  // `report` DEDUPES — the same 11px badge repeated down four rows is one thing
  // to fix, not four — and RETURNS that count. Adding contrastAll.length instead
  // counted raw occurrences, so a run with two distinct failures announced
  // "3 modal(s) flagged" while the line above it said "2 distinct contrast
  // failure(s)". Two numbers for one answer, and the louder one was wrong.
  // (public.mjs had the mirror image of this bug: it threw the return away.)
  if (wantContrast) { bad += report(contrastAll, `the modals (${theme})`) }
  await browser.close()
  // "modal(s)" was wrong too once contrast joined the count: a contrast failure
  // is a finding inside a dialog, not a dialog.
  console.log(bad ? `\n${bad} finding(s) at ${width}px${fsSize === 'standard' ? '' : ' / text ' + fsSize} ${theme}` : `\nall modals geometrically clean at ${width}px ${theme} — now look at the screenshots`)
  process.exit(bad ? 1 : 0)
}
