// A headline number must equal the list it opens.
//
// The Rentals tile is a filter button: it prints a count and, when pressed,
// filters the table. Nothing made those two agree, and on 25 Aug they did not
// — the tile counted rentals stored as 'active' while the list filtered on
// COMPUTED status, and the attention banner counted uncollected reservations
// as "phones overdue back". One screen, three different answers to "how many
// phones are with customers".
//
// This renders the tab, reads the number off the tile, presses it, and counts
// the rows. No knowledge of the implementation — just the promise the UI makes.
//
//   node ops/harness/counts.mjs [--width 1280]
import { chromium } from 'playwright-core'
import { buildAppHtml } from './render.mjs'

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const width = Number(arg('--width', 1280))

const file = buildAppHtml()
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await (await browser.newContext({ viewport: { width, height: 1000 } })).newPage()
await page.goto('file://' + file)
await page.waitForTimeout(1200)
await page.evaluate(() => goToTab('rentals'))
await page.waitForTimeout(900)

const rowCount = () => page.evaluate(() => {
  const tb = document.getElementById('rentalTableBody')
  if (!tb) return null
  // an empty-state row is one cell spanning the table, not a rental
  return [...tb.querySelectorAll('tr')].filter(tr => tr.querySelectorAll('td').length > 1).length
})

const tile = await page.evaluate(() => {
  const card = [...document.querySelectorAll('.stat-card')]
    .find(c => /phones out/i.test(c.querySelector('.stat-label')?.textContent || ''))
  if (!card) return null
  return { label: card.querySelector('.stat-label').textContent.trim(),
           value: Number(card.querySelector('.stat-value').textContent.trim()),
           sub: card.querySelector('.stat-sub').textContent.trim() }
})

let bad = 0
if (!tile) {
  console.log('✗ no "Phones Out" tile on the rentals tab')
  bad = 1
} else {
  await page.evaluate(() => {
    const card = [...document.querySelectorAll('.stat-card')]
      .find(c => /phones out/i.test(c.querySelector('.stat-label')?.textContent || ''))
    card.click()
  })
  await page.waitForTimeout(700)
  const rows = await rowCount()
  const ok = rows === tile.value
  console.log(`${ok ? '✓' : '✗'} ${tile.label}: tile says ${tile.value}, the list it opens holds ${rows}`)
  if (!ok) bad = 1

  // …and the banner must not claim more phones are overdue than are out at all
  const banner = await page.evaluate(() => {
    const el = [...document.querySelectorAll('*')]
      .find(e => e.children.length === 0 && /overdue back/i.test(e.textContent || ''))
    return el ? el.textContent.trim() : null
  })
  if (banner) {
    const n = Number((banner.match(/(\d+)/) || [])[1])
    const ok2 = Number.isFinite(n) && n <= tile.value
    console.log(`${ok2 ? '✓' : '✗'} banner "${banner}" against ${tile.value} out`)
    if (!ok2) bad = 1
  } else {
    console.log('· no overdue banner in this seed')
  }
}
await browser.close()
console.log(bad ? 'counts: a headline disagrees with its own list' : 'counts: every headline matches the list it opens')
process.exit(bad)
