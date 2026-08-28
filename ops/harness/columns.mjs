// Everything in the content column starts on the same line.
//
//   node ops/harness/columns.mjs [--width 1920]
//
// `.content > * { max-width: 1220px; margin-inline: auto }` centres every
// direct child, so on a screen wider than the column they all drift right
// together. One child that resets its own inline margins stops drifting and
// stays pinned to the left gutter — and NOTHING SAYS SO at the widths the
// harness usually runs, because under ~1300px there is no spare room and every
// child sits at the same place whatever its margins are.
//
// That is exactly how it happened. `.kc-toolbar` was given `margin: 0 0 14px`
// to set a bottom margin; the four-value shorthand also set margin-inline to 0.
// Clean at 1280, 194px adrift at 1920, 334px at 2200 — the owner's screenshot,
// 28 Aug, with a red box drawn round the gap.
//
// So this sweeps WIDE on purpose. A tab is clean when every direct child of
// .content shares a left edge; the tolerance is 2px for sub-pixel rounding.
import { chromium } from 'playwright-core'
import { buildAppHtml } from './render.mjs'

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const width = Number(arg('--width', 1920))
const SLACK = 2

// Every tab that draws a list. Dashboard included: it is the widest screen and
// the one most likely to grow a full-bleed child.
const TABS = ['dashboard', 'customers', 'rentals', 'sim', 'wallet', 'bookings',
  'repairs', 'services', 'shop', 'virtual', 'tasks', 'mail', 'messages']

const file = buildAppHtml()
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await (await browser.newContext({ viewport: { width, height: 1000 } })).newPage()
page.on('pageerror', (e) => console.log('  pageerror:', String(e).split('\n')[0]))
await page.goto('file://' + file)
await page.waitForTimeout(1200)

let bad = 0
for (const tab of TABS) {
  await page.evaluate((t) => window.renderTab(t), tab).catch(() => {})
  await page.waitForTimeout(450)
  const rows = await page.evaluate((slack) => {
    const content = document.querySelector('#mainContent') || document.querySelector('.content')
    if (!content) return null
    const kids = [...content.children]
      .filter((el) => {
        const r = el.getBoundingClientRect()
        const cs = getComputedStyle(el)
        // Only things actually on screen and actually in the column: a
        // positioned or full-bleed child is not making the same promise.
        return r.width > 40 && r.height > 4 && cs.display !== 'none' &&
          cs.position !== 'fixed' && cs.position !== 'absolute'
      })
      .map((el) => ({
        name: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string'
          ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''),
        left: Math.round(el.getBoundingClientRect().left),
      }))
    if (kids.length < 2) return { kids, spread: 0 }
    const lefts = kids.map((k) => k.left)
    return { kids, spread: Math.max(...lefts) - Math.min(...lefts) }
  }, SLACK)

  if (!rows) { console.log(`· ${tab}: no content column`); continue }
  if (rows.kids.length < 2) { console.log(`· ${tab}: nothing stacked to compare`); continue }
  if (rows.spread <= SLACK) {
    console.log(`✓ ${tab.padEnd(10)} ${rows.kids.length} children, all on ${rows.kids[0].left}px`)
  } else {
    const lefts = rows.kids.map((k) => k.left)
    const common = lefts.sort((a, b) => lefts.filter(v => v === a).length - lefts.filter(v => v === b).length).pop()
    const strays = rows.kids.filter((k) => Math.abs(k.left - common) > SLACK)
    console.log(`✗ ${tab.padEnd(10)} ${rows.spread}px adrift — ${strays.map((s) => `${s.name} at ${s.left} (column is ${common})`).join(', ')}`)
    bad++
  }
}

await browser.close()
console.log(bad
  ? `columns: ${bad} tab(s) have a child out of the column at ${width}px`
  : `columns: every content child shares its column's left edge at ${width}px`)
process.exit(bad)
