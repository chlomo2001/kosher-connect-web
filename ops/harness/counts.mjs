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
// ── Carrier mail: the card against the queue under it ────────────────────
//
// The same promise, and it was being broken quietly. "Needs a human" read 180
// while the list under it held 60, with nothing saying the list was a page and
// no way to reach the other 120 — so the pile could be worked at all afternoon
// and not go down. The counts were right the whole time, which is what made it
// invisible.
//
// The rule is not "the card must equal the rows": a long queue SHOULD be paged.
// It is that a screen showing part of a list has to say so. Either the numbers
// agree, or the page says how many of how many it is showing.
await page.evaluate(() => goToTab('mail'))
await page.waitForTimeout(900)

const cm = await page.evaluate(() => {
  const card = [...document.querySelectorAll('.stat-card')]
    .find((c) => /needs a human/i.test(c.querySelector('.stat-label')?.textContent || ''))
  const more = document.querySelector('.cm-more')
  return {
    value: card ? Number(card.querySelector('.stat-value').textContent.trim()) : null,
    rows: document.querySelectorAll('.cm-row').length,
    says: more ? more.textContent.replace(/\s+/g, ' ').trim() : null,
  }
})

if (cm.value === null) {
  console.log('· no "Needs a human" card in this seed')
} else if (cm.rows === cm.value) {
  console.log(`✓ Needs a human: card says ${cm.value}, the queue holds ${cm.rows}`)
} else if (cm.says && cm.says.includes(String(cm.rows)) && cm.says.includes(String(cm.value))) {
  console.log(`✓ Needs a human: ${cm.value} waiting, ${cm.rows} on the page, and it says so — "${cm.says}"`)
} else {
  console.log(`✗ Needs a human: card says ${cm.value}, the queue shows ${cm.rows}, and nothing on the page says it is a page`)
  bad = 1
}

await browser.close()
console.log(bad ? 'counts: a headline disagrees with its own list' : 'counts: every headline matches the list it opens')
process.exit(bad)
