// Every customer picker in the app, driven like a person drives it.
//
//   node ops/harness/picker.mjs
//
// Owner, 17 Aug, looking at the help-timer dropdown on Services: "i need same
// customer dropdown logic throughout the system!…. or even better, make it
// should always uses from the same place". Making them share one builder is
// half the job; this is the half that proves it, and keeps proving it — a
// twelfth picker built by hand later will show up here as a bare <select>
// rather than as a bug reported from behind the counter.
//
// For each place a customer is picked, this opens the surface and checks:
//   · the picker exists, and is the shared one (hidden value + _search + _dd)
//   · it opens on WHO WAS IN LATELY, not the alphabet
//   · typing filters, and typing a phone number finds by number
//   · ArrowDown + Enter commits — not just the mouse
//   · the hidden input ends up holding the id, so every save path is unchanged
//   · the ✓ line names the number, so two people with one surname are told apart
//   · a name that matches nobody still offers "➕ Add … as a new customer"
//   · the form's own onPick fired (where one is wired)
//
// It also fails if any <select> anywhere is still listing customers.
//
// Exits non-zero on a finding, so it can sit in audit-all.
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { buildAppHtml, BROWSER_ENV } from './render.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(import.meta.url)
const { chromium } = require(path.join(ROOT, 'node_modules/playwright-core'))

// name → [tab, opener, pickerId, expects onPick?]
const PICKERS = [
  ['wallet · record payment', 'wallet',    '',                      'wtCustomer',     false],
  ['services · help timer',   'services',  '',                      'svcTimerCustomer', false],
  ['services · charge',       'services',  'openNewServiceModal()', 'svCustomer',     false],
  ['rentals · new rental',    'rentals',   'openNewRentalModal()',  'rCustomer',      true],
  ['sim · new plan',          'sim',       'openAddSimModal()',     'simCustomer',    false],
  ['bookings · new booking',  'bookings',  'openNewBookingModal()', 'bkCustomer',     true],
  ['repairs · new repair',    'repairs',   'openNewRepairModal()',  'rpCustomer',     false],
  ['virtual · new number',    'virtual',   'openNewVNModal()',      'vnCustomer',     false],
  ['kol torah · new job',     'koltorah',  '',                      'ktJobCust',      false],
  ['kol torah · add shul',    'koltorah',  '',                      'ktNewShulCust',  false],
  ['shop · till',             'shop',      'openSaleModal()',       'posCustomer',    true],
]

const file = buildAppHtml()
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: BROWSER_ENV })
const c = await b.newContext({ locale: 'en-GB', viewport: { width: 1280, height: 900 }, colorScheme: 'light' })
const p = await c.newPage()
await p.goto('file://' + file, { waitUntil: 'load' })
await p.waitForTimeout(900)

const findings = []
const say = (ok, where, what) => {
  if (!ok) findings.push(`${where}: ${what}`)
  return ok
}

// Someone real to search for, and a name nobody has.
const who = await p.evaluate(() => {
  const c = customers.find((x) => x.phone && x.firstName && x.lastName)
  return { id: String(c.id), first: c.firstName, last: c.lastName, phone: c.phone }
})

const who_id = who.id
for (const [where, tab, opener, id, wantsOnPick] of PICKERS) {
  await p.evaluate(async (t) => { await goToTab(t) }, tab)
  await p.waitForTimeout(320)
  if (opener) { await p.evaluate((o) => eval(o), opener); await p.waitForTimeout(260) }

  const shape = await p.evaluate((pid) => ({
    hidden: !!document.getElementById(pid),
    search: !!document.getElementById(pid + '_search'),
    dd: !!document.getElementById(pid + '_dd'),
    isSelect: document.getElementById(pid)?.tagName === 'SELECT',
  }), id)
  if (!say(shape.hidden && shape.search && shape.dd && !shape.isSelect, where,
    `not the shared picker (${JSON.stringify(shape)})`)) { await p.evaluate(() => { try { closeDynamicModal() } catch {} }); continue }

  // 1. Opens on the recent list, headed as such.
  await p.click(`#${id}_search`)
  await p.waitForTimeout(120)
  const opened = await p.evaluate((pid) => {
    const dd = document.getElementById(pid + '_dd')
    return { open: dd.classList.contains('open'), head: dd.querySelector('.customer-dropdown-head')?.textContent || '',
      rows: dd.querySelectorAll('.customer-dropdown-item').length }
  }, id)
  say(opened.open && opened.rows > 0, where, 'clicking in showed no list')
  say(/recent/i.test(opened.head), where, `list is not headed "Recent" (${opened.head || 'no head'})`)

  // A list that is painted but clipped is worse than no list: the box looks
  // open and shows two pixels of the first name. .table-card's overflow:hidden
  // did exactly that to the help timer.
  const visible = await p.evaluate((pid) => {
    const dd = document.getElementById(pid + '_dd')
    const r = dd.getBoundingClientRect()
    if (r.height < 24) return { ok: false, why: `list is ${Math.round(r.height)}px tall` }
    const hit = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.bottom - 6))
    return { ok: !!hit && dd.contains(hit), why: `its last row is covered or clipped by ${hit?.className || 'nothing'}` }
  }, id)
  say(visible.ok, where, visible.why)

  // 2. Typing a surname filters; the number rides along so two of them differ.
  await p.fill(`#${id}_search`, who.last)
  await p.waitForTimeout(120)
  const typed = await p.evaluate((pid) => {
    const dd = document.getElementById(pid + '_dd')
    const rows = [...dd.querySelectorAll('.customer-dropdown-item')].filter((r) => !r.classList.contains('kc-combo-add'))
    return { n: rows.length, meta: rows.some((r) => r.querySelector('.kc-picker-meta')?.textContent.trim()),
      add: !!dd.querySelector('.kc-combo-add') }
  }, id)
  say(typed.n > 0, where, `typing "${who.last}" matched nobody`)
  say(typed.meta, where, 'no phone number beside the names')

  // 3. Keyboard: down, enter, and the hidden input holds the id.
  await p.press(`#${id}_search`, 'ArrowDown')
  await p.press(`#${id}_search`, 'Enter')
  await p.waitForTimeout(120)
  const picked = await p.evaluate((pid) => ({
    value: document.getElementById(pid).value,
    text: document.getElementById(pid + '_search').value,
    hint: document.getElementById(pid + '_hint')?.textContent.trim() || '',
    open: document.getElementById(pid + '_dd').classList.contains('open'),
  }), id)
  say(!!picked.value && picked.value !== 'walkin', where, 'arrow + Enter picked nobody')
  say(!picked.open, where, 'the list stayed open after picking')
  say(/^✓/.test(picked.hint), where, 'no ✓ line naming the number that was picked');
  say(picked.text.trim().length > 0, where, 'the box is empty after a pick')

  // 4. Search by phone digits, not just letters.
  await p.fill(`#${id}_search`, who.phone.replace(/\D/g, '').slice(-6))
  await p.waitForTimeout(120)
  const byNumber = await p.evaluate((pid) => [...document.getElementById(pid + '_dd')
    .querySelectorAll('.customer-dropdown-item')].filter((r) => !r.classList.contains('kc-combo-add')).length, id)
  say(byNumber > 0, where, 'searching by phone digits found nobody')

  // 5. A name nobody has still offers to create them.
  await p.fill(`#${id}_search`, 'Zzqx Nobody')
  await p.waitForTimeout(120)
  const dead = await p.evaluate((pid) => {
    const dd = document.getElementById(pid + '_dd')
    return { add: !!dd.querySelector('.kc-combo-add'), empty: !!dd.querySelector('.customer-dropdown-empty') }
  }, id)
  say(dead.add, where, 'a no-match search dead-ends — no "add as a new customer"')
  say(dead.empty, where, 'a no-match search says nothing at all')

  // 6. Typing over a pick clears it, so nothing saves a stale id.
  const stale = await p.evaluate((pid) => document.getElementById(pid).value, id)
  say(stale === '' || stale === 'walkin', where, `typing over a pick left the old id (${stale})`)

  // 7. A full name typed and then left — reaching straight for the button next
  // to the box — is taken, not thrown away. Ambiguous stays refused.
  await p.fill(`#${id}_search`, `${who.first} ${who.last}`)
  await p.evaluate((pid) => document.getElementById(pid + '_search').blur(), id)
  await p.waitForTimeout(320)
  const onBlur = await p.evaluate((pid) => document.getElementById(pid).value, id)
  say(onBlur === who_id, where, `typing a full name and tabbing away lost it (value ${onBlur || 'empty'})`)
  await p.fill(`#${id}_search`, 'Zz Ambiguous Nobody')
  await p.evaluate((pid) => document.getElementById(pid + '_search').blur(), id)
  await p.waitForTimeout(320)
  const junk = await p.evaluate((pid) => ({
    v: document.getElementById(pid).value, text: document.getElementById(pid + '_search').value }), id)
  // A name nobody has never becomes a pick, and never stays on screen looking
  // like one — the box goes back to whatever is actually held.
  say(junk.v === '' || junk.v === 'walkin', where, `a name nobody has was taken as a customer (${junk.v})`)
  say(junk.text.trim() !== 'Zz Ambiguous Nobody', where, 'a name nobody has was left sitting in the box')

  // 8. The form's own reaction still runs.
  if (wantsOnPick) {
    const fires = await p.evaluate((pid) => new Promise((res) => {
      const el = document.getElementById(pid)
      el.addEventListener('change', () => res(true), { once: true })
      const c = customers[0]
      kcPickerSet(pid, c.id)
      setTimeout(() => res(false), 300)
    }), id)
    say(fires, where, 'picking fired no change event — the form never hears about it')
  }

  await p.evaluate(() => { try { closeDynamicModal() } catch {}; try { closePosView() } catch {} })
  await p.waitForTimeout(120)
}

// Nothing anywhere may still be a <select> of customers.
for (const [, tab] of PICKERS) {
  await p.evaluate(async (t) => { await goToTab(t) }, tab)
  await p.waitForTimeout(200)
  const bad = await p.evaluate(() => [...document.querySelectorAll('select')]
    .filter((s) => s.options.length > 40 || [...s.options].some((o) => o.value === '__new_customer__'))
    .map((s) => s.id || '(no id)'), )
  if (bad.length) findings.push(`${tab}: still a <select> of customers — ${bad.join(', ')}`)
}

await b.close()

if (findings.length) {
  console.log(`✗ ${findings.length} finding${findings.length === 1 ? '' : 's'}\n`)
  findings.forEach((f) => console.log('  · ' + f))
  process.exit(1)
}
console.log(`✓ all ${PICKERS.length} customer pickers are the same control, and behave like it`)
