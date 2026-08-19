// The customer record page — the units, and the card it must NOT become.
//
//   node ops/harness/record.mjs
//   node ops/harness/record.mjs --width 390 --theme dark
//
// Owner, 20 August 2026: the card "isn't the correct broadness… should it not
// open as if it was a complete user profile… all his lines, linked to that
// sim/vn". The page and the card were the same body, and Active Services was a
// row of badges of which only the SIM could be pressed.
//
// So this checks the two things that decision creates:
//
//   1. On the PAGE every service is a real control that opens something, past
//      ones included and folded away. A row that renders but cannot be pressed
//      is the old badge with a new coat of paint, which is exactly the failure
//      worth catching automatically.
//   2. On the CARD it is still the compact badge row. The card exists so
//      somebody does not have to leave the list they are working through, and
//      two cards sit side by side only because they are small — this feature
//      must not quietly undo the one shipped the day before.
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

const findings = []
const say = (ok, what) => { if (!ok) findings.push(what) }

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: BROWSER_ENV })
const ctx = await b.newContext({ viewport: { width, height: 1000 }, locale: 'en-GB' })
const p = await ctx.newPage()
p.on('pageerror', (e) => findings.push(`page error — ${e.message}`))
await p.goto('file://' + buildAppHtml(), { waitUntil: 'load' })
await p.waitForTimeout(900)
await p.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme)
await p.evaluate(async () => { await goToTab('customers') })
await p.waitForTimeout(400)

const busiest = await p.evaluate(() => {
  const score = (c) => sims.filter((x) => x.customerId === c.id).length
    + rentals.filter((x) => x.customerId === c.id).length
    + virtualNumbers.filter((x) => x.customerId === c.id).length
    + (bookings || []).filter((x) => x.customerId === c.id).length
    + repairs.filter((x) => x.customerId === c.id).length
  return customers.slice().sort((a, z) => score(z) - score(a))[0].id
})

// ── 1. the page ───────────────────────────────────────────────────────────
await p.evaluate((id) => renderCustomerPage(id), busiest)
await p.waitForTimeout(700)

const page = await p.evaluate(() => {
  const units = [...document.querySelectorAll('.kc-unit')]
  return {
    headline: (document.querySelector('.kc-record-headline') || {}).textContent || '',
    total: units.length,
    // A unit that is not a button, or carries no handler, is a badge again.
    pressable: units.filter((u) => u.tagName === 'BUTTON' && u.getAttribute('onclick')).length,
    kinds: [...new Set(units.map((u) => [...u.classList].find((c) => c.startsWith('kc-unit-')
      && !['kc-unit-icon', 'kc-unit-main', 'kc-unit-side', 'kc-unit-ended'].includes(c))))],
    past: !!document.querySelector('.kc-units-past'),
    pastOpenByDefault: !!document.querySelector('.kc-units-past[open]'),
    // Every row must say WHICH thing it is, or a list of four rows reading
    // "Rental" twice is worse than the badges were.
    titled: units.filter((u) => (u.querySelector('.kc-unit-title') || {}).textContent?.trim()).length,
    overflows: units.filter((u) => u.getBoundingClientRect().right > window.innerWidth + 1).length,
  }
})

say(page.total > 0, 'the record shows no units at all on the busiest customer')
say(page.pressable === page.total,
  `${page.total - page.pressable} of ${page.total} record rows cannot be pressed — that is a badge, not a link`)
say(page.titled === page.total, 'some record rows have no title')
say(page.kinds.length >= 3, `only ${page.kinds.length} kind(s) of service reached the record — the seed has more`)
say(page.headline.trim().length > 0, 'the record has no headline saying what this person is to the shop')
say(page.past, 'nothing finished is shown — a record that only shows the present tense is the old card')
say(!page.pastOpenByDefault, 'finished items are unfolded by default, which buries the running ones')
say(!page.overflows, `${page.overflows} record row(s) run past the right edge at ${width}px`)

// ── the number leads on anything that has one ─────────────────────────────
//
// 838 numbers across 502 customers, 837 of them carrying exactly one thing:
// the number is not a folder to group under, it is the name of the thing. The
// row used to lead with the network ("Lebara") and put the number underneath
// in small grey text, which is backwards in a shop where every question opens
// "what's going on with 07…".
const leads = await p.evaluate(() => {
  const units = [...document.querySelectorAll('.kc-unit')]
  return units.map((u) => {
    const kind = [...u.classList].map((c) => c.replace('kc-unit-', ''))
      .find((c) => ['sim', 'rental', 'vn', 'booking', 'repair', 'service'].includes(c))
    return {
      kind,
      title: (u.querySelector('.kc-unit-title') || {}).textContent?.trim() || '',
      sub: (u.querySelector('.kc-unit-detail') || {}).textContent?.trim() || '',
      label: (u.querySelector('.kc-unit-label') || {}).textContent?.trim() || '',
    }
  })
})
const NUMBERED = new Set(['sim', 'rental', 'vn'])
for (const row of leads) {
  const digits = row.title.replace(/\D/g, '')
  if (NUMBERED.has(row.kind)) {
    say(digits.length >= 6,
      `a ${row.kind} row leads with "${row.title}" instead of its number`)
  } else {
    // And nothing invents one — a booking reference in the number position
    // would make the column meaningless.
    say(digits.length < 6 || /[A-Za-z]/.test(row.title),
      `a ${row.kind} row leads with something that looks like a number: "${row.title}"`)
  }
  say(!(row.sub && row.sub === row.label),
    `a ${row.kind} row says "${row.sub}" twice — once under the title and once beside it`)
}

// Every pressable row must name an action the app actually has.
const handlers = await p.evaluate(() =>
  [...document.querySelectorAll('.kc-unit')].map((u) => u.getAttribute('onclick') || ''))
for (const h of handlers) {
  const m = h.match(/kcOpenUnit\('([a-z]+)'/)
  say(!!m, `a record row has an unrecognised handler: ${h.slice(0, 60)}`)
}
const kindsUsed = handlers.map((h) => (h.match(/kcOpenUnit\('([a-z]+)'/) || [])[1]).filter(Boolean)
const known = await p.evaluate(() => Object.keys(KC_RECORD.KINDS))
for (const k of new Set(kindsUsed)) {
  say(known.includes(k), `a record row opens "${k}", which is not a kind the record knows`)
}

// ── 2. the card must still be the card ────────────────────────────────────
await p.evaluate(async () => { await goToTab('customers') })
await p.waitForTimeout(300)
await p.evaluate((id) => renderDetailPanel(id), busiest)
await p.waitForTimeout(500)

const card = await p.evaluate(() => ({
  units: document.querySelectorAll('#customerCard .kc-unit, .detail-panel .kc-unit').length,
  badges: document.querySelectorAll('.detail-panel .badge').length,
  onPage: !!document.querySelector('.kc-cpage'),
}))
say(!card.onPage, 'renderDetailPanel opened the full page instead of the card')
say(card.units === 0,
  'the compact card has grown the full record — it exists so somebody does not leave the list, and two cards fit only because it is small')
say(card.badges > 0, 'the card lost its service badges altogether')

await b.close()
if (findings.length) {
  console.log(`\n✗ ${findings.length} finding(s)`)
  findings.forEach((f) => console.log('  ·', f))
  process.exit(1)
}
console.log(`\n✓ the record opens every service it lists, keeps the finished ones folded, and the card stayed a card (${width}px, ${theme})`)
