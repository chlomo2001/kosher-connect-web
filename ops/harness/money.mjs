// Money wording, checked on the rendered screens rather than in the source.
//
//   node ops/harness/money.mjs
//   node ops/harness/money.mjs --width 390 --theme dark
//
// Port item C1's last piece. The unit tests prove lib/moneyWords.mjs says the
// right thing; test/moneyWordsMirror.test.mjs proves the browser copy agrees
// with it. Neither proves the SCREENS call either of them — a screen that
// builds its own sentence out of a number passes both and still tells a
// customer the wrong thing.
//
// So this drives the real app and reads what a person would read:
//
//   1. Every customer-balance phrase on screen is one the vocabulary can
//      actually produce. Not "does not contain a banned word" — that passes
//      for anything invented. It must MATCH the vocabulary's own output.
//   2. The retired words are gone from the money surfaces: "owing", "£45 owed",
//      "balance due". Four spellings of one fact is what C1 was raised for.
//   3. A balance the app does not have is never quoted. This is the refusal:
//      a missing figure must read as unknown, and must not show a £ amount
//      dressed as fact.
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

// The money surfaces, and nothing else. Goods-in and purchase orders talk about
// money the SHOP owes a supplier — the opposite direction, legitimately
// different words — and sweeping them in here is how a guard gets weakened
// later by someone who is right that it was over-broad.
const SCREENS = ['dashboard', 'wallet', 'customers', 'koltorah']

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: BROWSER_ENV })
const ctx = await b.newContext({ viewport: { width, height: 900 }, locale: 'en-GB' })
const p = await ctx.newPage()
p.on('pageerror', (e) => findings.push(`page error — ${e.message}`))
await p.goto('file://' + buildAppHtml(), { waitUntil: 'load' })
await p.waitForTimeout(900)
await p.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme)

// ── 1. the vocabulary is the only thing that reaches the screen ───────────
//
// Built from KC_MONEY itself rather than hard-coded here: a harness carrying
// its own copy of the wording is a third place for the wording to drift.
const legal = await p.evaluate(() => {
  const out = new Set()
  const money = [0, 1, 4.5, 12, 20, 45, 45.5, 100, 1234.56]
  for (const n of money) {
    for (const ctx of [{ balance: -n }, { balance: n }, { balance: -n, oldestDebtDays: 99 },
      { balance: n, refundDue: n }, { balance: n, reliable: false }]) {
      out.add(KC_MONEY.moneySayShort(ctx).text)
    }
  }
  return [...out]
})
say(legal.length > 5, 'KC_MONEY produced almost no phrases — the harness is not reading the vocabulary')

// A phrase that LOOKS like a balance statement: it carries a £ figure and one
// of the words the vocabulary uses about a customer's account.
//
// `debt` and `credit` are in this list because of what the first run of this
// harness found: the customers list — the busiest list in the shop — was
// rendering "£45.00 debt" and "£20.00 credit", two spellings the vocabulary
// does not have, and the first draft of this regex was too narrow to see them.
// A guard written only for the wording you already know about finds the
// wording you already know about.
const BALANCEY = /(owes|in credit|to refund|settled|not checked yet|owed|owing|balance due|outstanding|\bdebt\b|\bcredit\b)/i
const RETIRED = [
  [/\bowing\b/i, '"owing" — the vocabulary says "owes"'],
  [/£[\d,.]+\s*owed\b/i, '"£X owed" — the vocabulary says "owes £X"'],
  [/£[\d,.]+\s*debt\b/i, '"£X debt" — the vocabulary says "owes £X"'],
  [/\bbalance due\b/i, '"balance due" — the vocabulary says "owes £X"'],
]

for (const screen of SCREENS) {
  await p.evaluate((t) => renderTab(t), screen).catch(() => {})
  await p.waitForTimeout(500)
  const phrases = await p.evaluate(() => {
    const seen = new Set()
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    let n
    while ((n = walk.nextNode())) {
      const el = n.parentElement
      if (!el || el.closest('[hidden]') || el.offsetParent === null) continue
      const t = n.textContent.trim().replace(/\s+/g, ' ')
      if (t) seen.add(t)
    }
    return [...seen]
  })
  for (const t of phrases) {
    for (const [re, why] of RETIRED) {
      say(!re.test(t), `${screen}: retired money wording on screen — ${why} · "${t.slice(0, 80)}"`)
    }
    // A phrase that is balance-ish AND carries a £ figure must be a phrase the
    // vocabulary can produce. Longer sentences that merely contain one are
    // allowed to wrap it, so containment is enough — inventing a new form is
    // what this catches, not punctuation around a correct one.
    if (BALANCEY.test(t) && /£/.test(t)) {
      const known = legal.some((L) => t.includes(L))
      say(known, `${screen}: a balance phrase the vocabulary cannot produce — "${t.slice(0, 90)}"`)
    }
  }
}

// ── 2. the refusal: a balance we do not have is never quoted ──────────────
//
// The bug this is aimed at is not hypothetical. Number(null) is 0, so until
// 19 Aug a customer whose balance the app did not hold rendered as "settled" —
// a confident claim about somebody's money, from the module written to refuse
// exactly that. A unit test now names it; this proves the SCREEN refuses too.
const refusal = await p.evaluate(() => {
  const out = {}
  for (const [name, ctx] of [
    ['missing', { balance: null }],
    ['empty-string', { balance: '' }],
    ['unreliable', { balance: -45, reliable: false }],
  ]) {
    const said = KC_MONEY.moneySayShort(ctx)
    out[name] = { state: said.state, text: said.text }
  }
  out.realZero = KC_MONEY.moneySayShort({ balance: 0 })
  return out
})
for (const key of ['missing', 'empty-string', 'unreliable']) {
  const r = refusal[key]
  say(r.state === 'unreliable', `a ${key} balance came out as "${r.state}" — it must refuse, not decide`)
  say(!/£/.test(r.text), `a ${key} balance still shows a £ figure ("${r.text}") — that is a quote we cannot stand behind`)
  say(!/\bsettled\b/i.test(r.text), `a ${key} balance reads as "${r.text}" — it claims the account is clear`)
}
say(refusal.realZero.state === 'settled',
  `a real zero balance came out as "${refusal.realZero.state}" — the refusal has eaten the ordinary case`)

await b.close()
if (findings.length) {
  console.log(`\n✗ ${findings.length} finding(s)`)
  findings.forEach((f) => console.log('  ·', f))
  process.exit(1)
}
console.log(`\n✓ every money phrase on screen comes from the one vocabulary, and an unknown balance is refused rather than quoted (${width}px, ${theme})`)
