// Real pictures of the real app, for the manual.
//
// The manual was four stacked bullet lists per screen. Someone starting on
// Sunday cannot match "the four figures" to anything until they are already
// looking at the screen, by which point they did not need the sentence. A
// picture of the actual screen, with the words underneath it, is the whole
// difference between a reference and a wall of text.
//
// These are not mock-ups. Each one is the app running against the seed, shot
// by the same Playwright harness that audits geometry — so a screen that
// changes shape produces a different picture next time this runs, and a
// screenshot can never quietly describe a version of the app that no longer
// exists.
//
// Run:  node scripts/build-manual-shots.mjs            (all screens)
//       node scripts/build-manual-shots.mjs --only wallet
//
// Not on prebuild: it needs Chromium, which Vercel's builder does not have.
// The images are committed, and test/manualShots.test.mjs fails if a written
// screen has no picture.
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildAppHtml, BROWSER_ENV } from '../ops/harness/render.mjs'
import { buildPublicHtml } from '../ops/harness/public.mjs'
import { SCREENS } from '../lib/manual.mjs'
import { pngSize } from '../lib/pngSize.mjs'
import { MODALS } from '../ops/harness/modals.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright-core')

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public/manual')
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null

// Wide enough that the sidebar and the content column both read, short enough
// that the picture is a glance rather than a scroll. The manual scales it down
// to its column, so this is the retina copy.
const WIDTH = 1180
const HEIGHT = 700

mkdirSync(OUT, { recursive: true })

const file = buildAppHtml()
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: BROWSER_ENV })
const ctx = await browser.newContext({ locale: 'en-GB', viewport: { width: WIDTH, height: HEIGHT }, colorScheme: 'light' })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('  pageerror:', String(e).split('\n')[0]))
await page.goto('file://' + file, { waitUntil: 'load' })
await page.waitForTimeout(1000)

await page.evaluate(async () => {
  const first = async (u, k) => { const d = await (await fetch(u)).json(); return (d[k] || d || [])[0]?.id }
  window.__kc = {
    customer: await first('/api/customers', 'customers'),
    rental: await first('/api/rentals', 'rentals'),
    sim: await first('/api/sims', 'sims'),
    supplierReturn: await first('/api/supplier-returns', 'returns'),
  }
})

const shot = async (name, opts = {}) => {
  const out = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: out, fullPage: false, ...opts })
  return statSync(out).size
}

let n = 0, bytes = 0
const problems = []

// One picture per staff screen, taken the way the operator meets it.
for (const s of SCREENS) {
  if (s.kind !== 'staff' || s.status !== 'written') continue
  if (only && s.id !== only) continue
  try {
    // syncNavActive too, not just renderTab: a picture whose sidebar points at
    // Dashboard while the content says Wallet teaches the reader the wrong
    // place to click, which is the one thing a manual must not do.
    await page.evaluate((t) => { window.syncNavActive?.(t); window.renderTab(t) }, s.id)
    await page.waitForTimeout(450)
    const painted = await page.evaluate(() => (document.getElementById('mainContent')?.textContent || '').trim().length)
    if (painted < 40) { problems.push(`${s.id}: rendered almost nothing — the picture would be a lie`); continue }
    bytes += await shot(`screen-${s.id}`); n++
  } catch (e) { problems.push(`${s.id}: ${String(e.message).split('\n')[0]}`) }
}

// …and one per box that opens on top, for the screens that have them. These
// are where the actual decisions get made, so they are the pictures a manual
// most needs and the ones it never had.
for (const [name, tab, js, root] of MODALS) {
  if (only && name !== only) continue
  try {
    await page.evaluate((t) => { window.syncNavActive?.(t); window.renderTab(t) }, tab)
    await page.waitForTimeout(250)
    await page.evaluate(js)
    await page.waitForTimeout(400)
    const box = await page.evaluate((sel) => {
      const cards = [...document.querySelectorAll(sel || '.modal-content, .modal-card, .modal, [role="dialog"], .kc-cpage')]
        .filter((el) => el.getBoundingClientRect().width && !el.closest('.hidden'))
      const el = cards[cards.length - 1]
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: Math.max(0, r.x - 16), y: Math.max(0, r.y - 16), width: Math.min(r.width + 32, 1180), height: Math.min(r.height + 32, 700) }
    }, root)
    if (!box || box.height < 40) { problems.push(`${name}: no dialog on screen to photograph`); continue }
    bytes += await shot(`dialog-${name}`, { clip: box }); n++
    await page.evaluate(() => { try { window.closeDynamicModal?.(); window.closeModal?.() } catch {} })
    await page.waitForTimeout(120)
  } catch (e) { problems.push(`${name}: ${String(e.message).split('\n')[0]}`) }
}

// The public pages too (owner, 23 Aug: "some more ... screenshots rendered").
// Same offline harness the public sweep audits with, English, light — the
// manual's own section for them was the only one with no pictures at all.
for (const s of SCREENS) {
  if (s.kind !== 'public' || s.status !== 'written') continue
  if (only && s.id !== only) continue
  try {
    const pf = buildPublicHtml(s.id, 'en', null, 'light')
    const p2 = await ctx.newPage()
    p2.on('pageerror', (e) => console.log(`  pageerror on ${s.id}:`, String(e).split('\n')[0]))
    await p2.goto('file://' + pf, { waitUntil: 'load' })
    await p2.waitForTimeout(700)
    bytes += await (async () => {
      const out = path.join(OUT, `screen-${s.id}.png`)
      await p2.screenshot({ path: out, fullPage: false })
      return statSync(out).size
    })()
    n++
    await p2.close()
  } catch (e) { problems.push(`${s.id}: ${String(e.message).split('\n')[0]}`) }
}

await browser.close()

const files = readdirSync(OUT).filter(f => f.endsWith('.png'))

// ── The manifest ─────────────────────────────────────────────────────────────
// Written here, committed, and imported by the page — because reading the
// directory at request time does not work where the page actually runs.
//
// /manual built its picture list with fs.readdirSync(process.cwd() +
// '/public/manual') inside getServerSideProps. That is correct locally and
// correct in the offline harness, and on Vercel it throws ENOENT every time:
// `public/` is served by the CDN and is NOT part of the serverless function's
// bundle, so the function's own filesystem has no such directory. The read
// failed, the catch turned it into `shots = {}`, and the page degraded exactly
// as designed — to the words-only manual it used to be. Sixty screenshots sat
// on the CDN, every one of them fetchable by URL, and the manual never asked
// for a single one. The owner had never seen a picture in it (26 Aug).
//
// A generated manifest has none of that failure mode: it is a module, so a
// missing one is a build error rather than a blank page, and there is no
// filesystem involved at the moment it matters.
writeFileSync(path.join(ROOT, 'lib/manualShots.mjs'),
  `// GENERATED by scripts/build-manual-shots.mjs — do not edit by hand.\n` +
  `//\n` +
  `// Which pictures exist, and how big each one is. Read at BUILD time, not at\n` +
  `// request time: public/ is not on the serverless function's filesystem, so a\n` +
  `// readdir there returns nothing on Vercel and the manual quietly loses every\n` +
  `// picture it has (26 Aug). test/manualShots.test.mjs fails if this drifts\n` +
  `// from what is actually on disk, so a new screenshot cannot ship unphotographed\n` +
  `// in the manifest or unlisted on the page.\n` +
  `//\n` +
  `// The sizes are what let the browser hold each picture's space open before it\n` +
  `// loads — without them the thumbnail links measure two pixels tall.\n` +
  `export const MANUAL_SHOTS = {\n` +
  files.sort().map((f) => {
    const { w, h } = pngSize(path.join(OUT, f))
    return `  '${f.slice(0, -4)}': { src: '/manual/${f}', w: ${w}, h: ${h} },`
  }).join('\n') +
  `\n}\n`)

console.log(`${n} picture${n === 1 ? '' : 's'} written to public/manual (${files.length} on disk, ${(bytes / 1e6).toFixed(1)} MB this run)`)
console.log(`manifest: lib/manualShots.mjs, ${files.length} entries`)
if (problems.length) {
  console.log('\nnot photographed:')
  for (const p of problems) console.log('  ·', p)
}
