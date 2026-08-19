// Two customer cards at once (owner item 22).
//
//   node ops/harness/twocards.mjs
//
// The owner chose both cards FULLY EDITABLE over a read-only second one, so the
// question this harness exists to answer is the one that choice creates: can a
// save land on the card you were not looking at?
//
// It checks the mechanism rather than trusting it — that the second card opens
// only after the first is gripped aside, that the two do not overlap, that each
// card's own buttons carry its own customer's id, and that closing one leaves
// the other alone.
//
// Exits non-zero on a finding.
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { buildAppHtml, BROWSER_ENV } from './render.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(import.meta.url)
const { chromium } = require(path.join(ROOT, 'node_modules/playwright-core'))

const findings = []
const say = (ok, what) => { if (!ok) findings.push(what) }

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: BROWSER_ENV })
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-GB' })
const p = await ctx.newPage()
p.on('pageerror', (e) => findings.push(`page error — ${e.message}`))
await p.goto('file://' + buildAppHtml(), { waitUntil: 'load' })
await p.waitForTimeout(900)
await p.evaluate(async () => { await goToTab('customers') })
await p.waitForTimeout(400)

const two = await p.evaluate(() => [customers[0].id, customers[1].id])

// ── one card behaves exactly as it always did ─────────────────────────────
await p.evaluate((id) => renderDetailPanel(id), two[0])
await p.waitForTimeout(500)
await p.evaluate((id) => renderDetailPanel(id), two[1])
await p.waitForTimeout(500)
say(await p.evaluate(() => {
  const second = document.getElementById('customerCard2')
  return !second || second.classList.contains('hidden')
}), 'a second card opened without the first being gripped aside — an ordinary click must not split the screen')
say(await p.evaluate((id) => String(kcCardCustomer.primary) === String(id), two[1]),
  'the one card did not follow the second customer')

// ── grip the first aside, then open another ──────────────────────────────
await p.evaluate((id) => renderDetailPanel(id), two[0])
await p.waitForTimeout(400)
await p.evaluate(() => {
  const d = document.querySelector('#customerCard .modal')
  kcWinPin(d); kcWinPlace(d, 12, 12, 600, 700)
})
await p.waitForTimeout(250)
await p.evaluate((id) => renderDetailPanel(id), two[1])
await p.waitForTimeout(600)

const state = await p.evaluate(() => {
  const a = document.querySelector('#customerCard .modal')
  const c = document.querySelector('#customerCard2 .modal')
  const box = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), r: Math.round(r.right), b: Math.round(r.bottom) } }
  return {
    bothOpen: !!a && !!c,
    primary: kcCardCustomer.primary, secondary: kcCardCustomer.secondary,
    A: a ? box(a) : null, B: c ? box(c) : null,
    marker: document.body.classList.contains('kc-two-cards'),
  }
})
say(state.bothOpen, 'gripping the first aside and opening another did not give two cards')
say(String(state.primary) === String(two[0]) && String(state.secondary) === String(two[1]),
  `the cards hold the wrong customers — ${state.primary} / ${state.secondary}`)
say(state.marker, 'with two cards open the screen does not mark which one has the keyboard')
if (state.A && state.B) {
  const overlap = !(state.B.x >= state.A.r || state.B.r <= state.A.x || state.B.y >= state.A.b || state.B.b <= state.A.y)
  say(!overlap, `the second card overlaps the first — ${JSON.stringify(state.A)} vs ${JSON.stringify(state.B)}`)
}

// ── the point of the whole exercise ──────────────────────────────────────
// Every action button on a card carries ITS OWN customer's id, so a button on
// card B writes to B whichever card has focus. Checked by reading the handlers.
const wiring = await p.evaluate(([idA, idB]) => {
  const ids = (sel) => [...document.querySelectorAll(`${sel} .modal [onclick]`)]
    .map((el) => el.getAttribute('onclick'))
    .filter((h) => /'[^']+'/.test(h))
  const mentions = (handlers, id) => handlers.filter((h) => h.includes(id)).length
  const A = ids('#customerCard'), B = ids('#customerCard2')
  return {
    aButtons: A.length, bButtons: B.length,
    aWrongCustomer: mentions(A, String(idB)),
    bWrongCustomer: mentions(B, String(idA)),
  }
}, two)
say(wiring.aButtons > 3 && wiring.bButtons > 3, 'a card rendered with almost no buttons — the check below would prove nothing')
say(wiring.aWrongCustomer === 0, `${wiring.aWrongCustomer} button(s) on the FIRST card carry the second customer's id`)
say(wiring.bWrongCustomer === 0, `${wiring.bWrongCustomer} button(s) on the SECOND card carry the first customer's id`)

// ── closing one leaves the other ─────────────────────────────────────────
await p.evaluate(() => dismissCustomerCard('secondary'))
await p.waitForTimeout(300)
const after = await p.evaluate(() => ({
  secondGone: document.getElementById('customerCard2').classList.contains('hidden'),
  firstStill: !document.getElementById('customerCard').classList.contains('hidden'),
  primary: kcCardCustomer.primary, secondary: kcCardCustomer.secondary,
  marker: document.body.classList.contains('kc-two-cards'),
}))
say(after.secondGone, 'closing the second card left it on screen')
say(after.firstStill, 'closing the SECOND card closed the first as well')
say(after.secondary === null, 'the second slot still claims a customer after closing')
say(String(after.primary) === String(two[0]), 'closing the second card disturbed the first')
say(!after.marker, 'the two-card marker survived going back to one card')

await b.close()
if (findings.length) {
  console.log(`✗ ${findings.length} finding(s)`)
  findings.forEach((f) => console.log('  ·', f))
  process.exit(1)
}
console.log('✓ two cards: only after a grip, side by side, each writing to its own customer, closing independently')
