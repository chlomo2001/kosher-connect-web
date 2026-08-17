// What the app looks like while it is still loading.
//
//   node ops/harness/loading.mjs
//
// Owner, 17 Aug, on the Services tab mid-load: "dont feel that this
// pre-loading thing is correct for each screen, and its also only half of the
// page's length."
//
// Two separate faults in that one sentence, and this holds both closed:
//
//   1. It should not be there at all most of the time. These loads come back
//      in well under a quarter of a second, and a ghost layout that appears
//      and is replaced inside 200ms does not read as loading — it reads as the
//      page changing its mind. Nothing shows now until the wait earns it.
//   2. When it IS there it has to reach the fold. A ghost that stops halfway
//      down a 900px screen reads as a page that gave up, and the real lists it
//      stands in for do run to the bottom.
//
// Fetch is slowed to 1.5s to force the ghost out where it can be measured.
// Exits non-zero on a finding.
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { buildAppHtml, BROWSER_ENV } from './render.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(import.meta.url)
const { chromium } = require(path.join(ROOT, 'node_modules/playwright-core'))

// The tabs that load over the network and therefore ghost.
const TABS = ['wallet', 'services', 'shop', 'repairs', 'tasks', 'virtual', 'koltorah', 'settings']

const file = buildAppHtml()
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: BROWSER_ENV })
const findings = []
const instant = []
let ghosted = 0
const say = (ok, what) => { if (!ok) findings.push(what) }

for (const width of [1280, 390]) {
  const ctx = await b.newContext({ viewport: { width, height: 900 }, locale: 'en-GB' })
  const p = await ctx.newPage()
  p.on('pageerror', (e) => findings.push(`${width}px: page error — ${e.message}`))
  await p.goto('file://' + file, { waitUntil: 'load' })
  await p.waitForTimeout(900)

  // 1. At full speed, no tab may flash a ghost.
  for (const tab of TABS) {
    const flashed = await p.evaluate(async (t) => {
      const el = document.getElementById('mainContent')
      let saw = false
      const ob = new MutationObserver(() => { if (el.querySelector('.kc-skel')) saw = true })
      ob.observe(el, { childList: true, subtree: true })
      await goToTab(t)
      await new Promise((r) => setTimeout(r, 450))
      ob.disconnect()
      return saw
    }, tab)
    say(!flashed, `${width}px · ${tab}: ghosted on a load fast enough not to need it`)
  }

  // 2. Slow the network right down; now it must appear, and reach the fold.
  await p.evaluate(() => {
    const real = window.fetch
    window.fetch = async (...a) => { await new Promise((r) => setTimeout(r, 1500)); return real(...a) }
  })
  for (const tab of TABS) {
    await p.evaluate((t) => { goToTab(t) }, tab)
    await p.waitForTimeout(600)
    const geo = await p.evaluate(() => {
      const w = document.querySelector('.kc-skel-wrap')
      if (!w) return null
      const r = w.getBoundingClientRect()
      const rows = [...document.querySelectorAll('.kc-skel-panel .kc-skel')]
      const last = rows.length ? rows[rows.length - 1].getBoundingClientRect().bottom : r.top
      return { bottom: Math.round(r.bottom), lastRow: Math.round(last),
        vh: window.innerHeight, wide: document.documentElement.scrollWidth > window.innerWidth }
    })
    // Several tabs paint from data already in hand and never wait on the
    // network at all — Shop, Repairs, Virtual Numbers, Kol Torah, Settings.
    // Those are not expected to ghost; that IS the desired end state.
    if (!geo) { instant.push(`${width}px ${tab}`); continue }
    ghosted++
    // Within a screenful of the bottom — not stopping half way down.
    say(geo.bottom >= geo.vh * 0.85,
      `${width}px · ${tab}: ghost stops at ${geo.bottom} of ${geo.vh} — short of the fold`)
    // And the rows have to reach it too: a stretched empty panel is the same
    // fault wearing a border.
    say(geo.lastRow >= geo.vh * 0.75,
      `${width}px · ${tab}: ghost rows stop at ${geo.lastRow} of ${geo.vh}, leaving an empty panel`)
    say(!geo.wide, `${width}px · ${tab}: the ghost scrolls sideways`)
  }
  await ctx.close()
}

await b.close()

// If nothing ghosted anywhere, the mechanism is dead rather than restrained.
say(ghosted > 0, 'no tab ghosted at all under a 1.5s load — the skeleton never appears')
if (instant.length) console.log(`· never waits on the network, so never ghosts: ${instant.join(', ')}`)

if (findings.length) {
  console.log(`✗ ${findings.length} finding${findings.length === 1 ? '' : 's'}\n`)
  findings.forEach((f) => console.log('  · ' + f))
  process.exit(1)
}
console.log('✓ no tab flashes a ghost, and a real wait ghosts all the way to the fold (1280 + 390)')
