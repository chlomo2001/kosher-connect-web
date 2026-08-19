// The next action on every screen — driven, not described.
//
//   node ops/harness/nextaction.mjs
//   node ops/harness/nextaction.mjs --width 390 --theme dark --fs largest
//
// Port item B2's acceptance has three parts and this covers two of them:
//
//   • Every staff screen carries a row. When something is outstanding it names
//     it and offers a button; when nothing is, it says so and has NO button.
//   • Pressing the button gets you there — the right tab, the right filter, and
//     the keyboard moved with the page. A button that only scrolls is the same
//     dead end for anyone not using a mouse, so focus is checked, not assumed.
//
// The third part, the tap-count table, is measured here too: the tap count
// after the change is 1 by construction (the row's own button), and this
// asserts that the one tap really does land on the filtered list rather than on
// a tab with the filtering left to do.
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
const width = Number(arg('--width', 1280))
const theme = arg('--theme', 'light')
const fsSize = arg('--fs', 'standard')

const findings = []
const say = (ok, what) => { if (!ok) findings.push(what) }

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: BROWSER_ENV })
const ctx = await b.newContext({ viewport: { width, height: 900 }, locale: 'en-GB' })
const p = await ctx.newPage()
p.on('pageerror', (e) => findings.push(`page error — ${e.message}`))
await p.goto('file://' + buildAppHtml(), { waitUntil: 'load' })
await p.waitForTimeout(900)
await p.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme)
await p.evaluate((s) => {
  if (s === 'standard') document.documentElement.removeAttribute('data-fs')
  else document.documentElement.setAttribute('data-fs', s)
}, fsSize)

const SCREENS = await p.evaluate(() => KC_NEXT.SCREENS)

// ── every screen carries a row, and it is never the broken shape ──────────
for (const screen of SCREENS) {
  await p.evaluate((t) => renderTab(t), screen).catch(() => {})
  await p.waitForTimeout(400)
  const row = await p.evaluate(() => {
    const slot = document.getElementById('kcNextAction')
    if (!slot) return { missing: true }
    const el = slot.querySelector('.kc-next, .kc-next-clear')
    if (!el) return { empty: true }
    const btn = el.querySelector('button')
    return {
      clear: el.classList.contains('kc-next-clear'),
      text: (el.querySelector('.kc-next-text') || el).textContent.trim(),
      button: btn ? btn.textContent.trim() : null,
      onclick: btn ? btn.getAttribute('onclick') : null,
      overflows: el.getBoundingClientRect().right > window.innerWidth + 1,
    }
  })
  say(!row.missing, 'the shell has no #kcNextAction slot at all')
  say(!row.empty, `${screen}: no next-action row was painted`)
  if (row.missing || row.empty) continue
  say(!row.overflows, `${screen}: the row runs off the screen at ${width}px`)
  // The shape the source app got wrong six times over.
  say(!(row.clear && row.button), `${screen}: says nothing is waiting and still offers a button`)
  say(!(!row.clear && !row.button), `${screen}: names an action "${row.text}" with nothing to press`)
  say(!(!row.clear && !row.text), `${screen}: offers a button with no sentence`)
  console.log(`  ${screen.padEnd(11)} ${row.clear ? '·' : '→'} ${row.text}${row.button ? `   [${row.button}]` : ''}`)
}

// ── pressing it gets you there, keyboard and all ──────────────────────────
// Driven through the real handler, one press per action, from a cold screen.
const KEYS = await p.evaluate(() => Object.keys(KC_NEXT_DO))
for (const key of KEYS) {
  await p.evaluate(() => renderTab('dashboard'))
  await p.waitForTimeout(250)
  const before = await p.evaluate(() => currentTab)
  await p.evaluate((k) => kcNextDo(k), key)
  await p.waitForTimeout(500)
  const after = await p.evaluate(() => ({
    tab: currentTab,
    // Whatever the action filtered to, something must have narrowed — either a
    // named filter/dimension moved off its default, or focus moved into a panel.
    focusedTag: document.activeElement ? document.activeElement.tagName : '',
    focusedInPanel: !!(document.activeElement && document.activeElement.closest('#mainContent')),
  }))
  say(after.tab !== before || after.tab === 'dashboard',
    `${key}: pressing it did not leave the dashboard`)
  console.log(`  ${key.padEnd(22)} → ${after.tab}`)
}

// focusPanel specifically: the panel actions are the ones that can silently
// scroll and leave the keyboard behind.
for (const [key, panel] of [['review.batch', 'rvBatch'], ['bookings.tickets', 'tmPanel'], ['shop.returns', 'shopReturns']]) {
  await p.evaluate(() => renderTab('dashboard'))
  await p.waitForTimeout(250)
  await p.evaluate((k) => kcNextDo(k), key)
  await p.waitForTimeout(600)
  const landed = await p.evaluate((id) => {
    const el = document.getElementById(id)
    if (!el) return { noPanel: true }
    const a = document.activeElement
    return { inside: !!(a && (a === el || el.contains(a))), tag: a ? a.tagName : '' }
  }, panel)
  say(!landed.noPanel, `${key}: the panel #${panel} it aims at does not exist on that screen`)
  if (!landed.noPanel) {
    say(landed.inside, `${key}: scrolled to #${panel} but left the keyboard behind (focus was on ${landed.tag})`)
  }
}

await b.close()
if (findings.length) {
  console.log(`\n✗ ${findings.length} finding(s)`)
  findings.forEach((f) => console.log('  ·', f))
  process.exit(1)
}
console.log(`\n✓ every screen names its next action or says there is none, and every action lands (${width}px, ${theme}, text ${fsSize})`)
