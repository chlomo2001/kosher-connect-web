// Dialogs as windows — eight grips, a draggable title, four snap buttons.
//
//   node ops/harness/window.mjs
//
// Owner, 17 Aug: "i want every card should be expandable not only from bottom
// right corner, but from all 4 box endings and corners - like word textboxes"
// and "can we do like windows does — press to arrange view right, left, big,
// small, or custom?"
//
// The half of this that rots quietly is the arithmetic. Pulling the LEFT edge
// has to widen the box AND move it, at the same speed as the pointer, and stop
// moving when the width hits its floor — get that wrong and the dialog slides
// off under a hand that is no longer resizing anything. Pulling the RIGHT edge
// must not move it at all. So this drags every edge and checks both numbers.
//
// It also checks the grips stay glued to the dialog after it moves, since they
// live on the overlay rather than inside the dialog (the dialog scrolls its own
// content, and anything inside it scrolls away from the edge it marks).
//
// Exits non-zero on a finding.
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { buildAppHtml, BROWSER_ENV } from './render.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(import.meta.url)
const { chromium } = require(path.join(ROOT, 'node_modules/playwright-core'))

const file = buildAppHtml()
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: BROWSER_ENV })
const findings = []
const say = (ok, what) => { if (!ok) findings.push(what) }

const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-GB' })
const p = await ctx.newPage()
p.on('pageerror', (e) => findings.push(`page error — ${e.message}`))
await p.goto('file://' + file, { waitUntil: 'load' })
await p.waitForTimeout(900)

const rect = () => p.evaluate(() => {
  const r = document.querySelector('#dynamicModal .modal').getBoundingClientRect()
  return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }
})
const open = async () => {
  await p.evaluate(() => { try { closeDynamicModal() } catch {} })
  await p.evaluate(() => openNewRentalModal())
  await p.waitForTimeout(350)
}

await p.evaluate(async () => { await goToTab('rentals') })
await p.waitForTimeout(300)
await open()

// ── the chrome is there ───────────────────────────────────────────────────
say(await p.evaluate(() => document.querySelectorAll('#dynamicModal .kc-grip').length) === 8,
  'a dialog should carry eight grips — four edges and four corners')
say(await p.evaluate(() => document.querySelectorAll('#dynamicModal .kc-snap-b').length) === 4,
  'the snap bar should offer left, fill, right and restore')

// ── snapping ──────────────────────────────────────────────────────────────
const home = await rect()
for (const [how, check] of [
  ['left',  (r) => r.x < 20 && r.w > 500 && r.w < 700],
  ['right', (r) => r.x > 600 && r.w > 500 && r.w < 700],
  ['max',   (r) => r.x < 20 && r.w > 1200 && r.h > 850],
]) {
  await p.evaluate((h) => kcWinSnap(document.querySelector('.kc-snap-b'), h), how)
  await p.waitForTimeout(180)
  const r = await rect()
  say(check(r), `snap ${how} put the dialog at ${JSON.stringify(r)}`)
}
await p.evaluate(() => kcWinSnap(document.querySelector('.kc-snap-b'), 'reset'))
await p.waitForTimeout(220)
say(JSON.stringify(await rect()) === JSON.stringify(home),
  'restore should put the dialog back exactly where it opened')

// ── every edge and corner, with the arithmetic checked both ways ──────────
const D = 120
const drags = [
  // dir, dx, dy, what must happen
  ['e',  D,  0, (a, z) => z.w === a.w + D && z.x === a.x,               'east should widen it and leave the left edge alone'],
  ['w', -D,  0, (a, z) => z.w === a.w + D && z.x === a.x - D,           'west should widen it AND move it left, in step'],
  ['s',  0,  D, (a, z) => z.h === a.h + D && z.y === a.y,               'south should heighten it and leave the top alone'],
  ['n',  0, -D, (a, z) => z.h === a.h + D && z.y === a.y - D,           'north should heighten it AND move it up, in step'],
  ['se', D,  D, (a, z) => z.w === a.w + D && z.h === a.h + D,           'south-east should do both'],
  ['nw', -D, -D, (a, z) => z.w === a.w + D && z.h === a.h + D && z.x === a.x - D, 'north-west should grow both and move both'],
  ['ne', D, -D, (a, z) => z.w === a.w + D && z.h === a.h + D && z.y === a.y - D,  'north-east should widen right and grow upward'],
  ['sw', -D, D, (a, z) => z.w === a.w + D && z.h === a.h + D && z.x === a.x - D,  'south-west should widen left and grow downward'],
]
for (const [dir, dx, dy, ok, why] of drags) {
  await open()
  // Start small and centred so a 120px pull in any direction has room.
  await p.evaluate(() => {
    const d = document.querySelector('#dynamicModal .modal')
    kcWinPin(d); kcWinPlace(d, 420, 260, 440, 360)
  })
  await p.waitForTimeout(150)
  const before = await rect()
  const g = await p.evaluate((d) => {
    const r = document.querySelector(`#dynamicModal .kc-grip-${d}`).getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }, dir)
  await p.mouse.move(g.x, g.y)
  await p.mouse.down()
  await p.mouse.move(g.x + dx, g.y + dy, { steps: 10 })
  await p.mouse.up()
  await p.waitForTimeout(160)
  const after = await rect()
  say(ok(before, after), `${why} — ${JSON.stringify(before)} → ${JSON.stringify(after)}`)
}

// ── the grips follow ──────────────────────────────────────────────────────
await open()
await p.evaluate(() => {
  const d = document.querySelector('#dynamicModal .modal')
  kcWinPin(d); kcWinPlace(d, 100, 100, 500, 400)
})
await p.waitForTimeout(180)
say(await p.evaluate(() => {
  const r = document.querySelector('#dynamicModal .modal').getBoundingClientRect()
  const w = document.querySelector('#dynamicModal .kc-grip-w').getBoundingClientRect()
  const s = document.querySelector('#dynamicModal .kc-grip-s').getBoundingClientRect()
  return Math.abs((w.left + w.width / 2) - r.left) < 2 && Math.abs((s.top + s.height / 2) - r.bottom) < 2
}), 'the grips came adrift from the dialog they mark after it moved')

// ── it cannot be shrunk to nothing, or pushed off the screen ──────────────
await p.evaluate(() => {
  const d = document.querySelector('#dynamicModal .modal')
  kcWinPin(d); kcWinPlace(d, -900, -900, 10, 10)
})
await p.waitForTimeout(150)
const tiny = await rect()
say(tiny.w >= 300 && tiny.h >= 180, `a dialog should not shrink below 300×180 — got ${tiny.w}×${tiny.h}`)
say(tiny.x >= 0 && tiny.y >= 0, `a dialog should not be pushed off screen — got ${tiny.x},${tiny.y}`)

// ── the customer card gets it too ─────────────────────────────────────────
// The surface staff have open longest, and the one it was missing on.
await p.evaluate(() => { try { closeDynamicModal() } catch {} })
await p.evaluate(async () => { await goToTab('customers') })
await p.waitForTimeout(300)
await p.evaluate(() => openCustomerById(customers[0].id))
await p.waitForTimeout(700)
const card = await p.evaluate(() => ({
  grips: document.querySelectorAll('#customerCard .kc-grip').length,
  snap: document.querySelectorAll('#customerCard .kc-snap-b').length,
}))
say(card.grips === 8 && card.snap === 4,
  `the customer card should carry the window chrome too — got ${card.grips} grips, ${card.snap} snap buttons`)

// Its caps live in an INLINE style (max-width:94vw, max-height:90vh), and
// inline beats the stylesheet — so "fill the screen" filled 90% of it.
await p.evaluate(() => kcWinSnap(document.querySelector('#customerCard .kc-snap-b'), 'max'))
await p.waitForTimeout(250)
const filled = await p.evaluate(() => {
  const r = document.querySelector('#customerCard .modal').getBoundingClientRect()
  return { w: Math.round(r.width), h: Math.round(r.height), vw: window.innerWidth, vh: window.innerHeight }
})
say(filled.h >= filled.vh - 30 && filled.w >= filled.vw - 30,
  `filling the screen from the customer card left ${filled.w}×${filled.h} of ${filled.vw}×${filled.vh}`)
await p.evaluate(() => { try { dismissCustomerCard() } catch {} })
await p.waitForTimeout(200)

// ── phones keep the plain dialog ──────────────────────────────────────────
await ctx.close()
const phone = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-GB', hasTouch: true, isMobile: true })
const pp = await phone.newPage()
await pp.goto('file://' + file, { waitUntil: 'load' })
await pp.waitForTimeout(900)
await pp.evaluate(async () => { await goToTab('rentals') })
await pp.waitForTimeout(250)
await pp.evaluate(() => openNewRentalModal())
await pp.waitForTimeout(350)
const onPhone = await pp.evaluate(() => {
  const bar = document.querySelector('#dynamicModal .kc-snap')
  const grip = document.querySelector('#dynamicModal .kc-grip')
  const seen = (el) => !!el && el.getBoundingClientRect().width > 0
  return { bar: seen(bar), grip: seen(grip) }
})
say(!onPhone.bar && !onPhone.grip, 'a phone should get the plain dialog — no grips, no snap bar')
await phone.close()

await b.close()

if (findings.length) {
  console.log(`✗ ${findings.length} finding${findings.length === 1 ? '' : 's'}\n`)
  findings.forEach((f) => console.log('  · ' + f))
  process.exit(1)
}
console.log('✓ dialogs resize from all eight points, snap left/right/full/restore, and stay plain on a phone')
