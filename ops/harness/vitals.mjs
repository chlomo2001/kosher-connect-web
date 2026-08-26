// Core Web Vitals, measured rather than assumed.
//
//   node ops/harness/vitals.mjs                            # the staff app, INP
//   node ops/harness/vitals.mjs --cpu 1                    # no throttle (default 4×)
//   npm run build && npm start &                           # …then, for the public pages:
//   node ops/harness/vitals.mjs --public --base http://127.0.0.1:3000
//
// Google's three numbers and where each one actually comes from:
//
//   LCP  — how long until the main thing is on screen. A page-load metric.
//   CLS  — how much the page moved under the reader. A page-load metric.
//   INP  — how long the screen takes to answer a press. NOT a page-load
//          metric, which is why nothing here had ever measured it: Lighthouse
//          reports TBT as its lab stand-in, and TBT is a proxy for INP the way
//          a weather forecast is a proxy for rain.
//
// INP is measured the way the browser measures it — `PerformanceObserver` on
// `event` entries with an `interactionId`, taking the worst — and it is driven
// with real presses through the keyboard and mouse, because a synthetic
// `el.click()` produces no interaction entry at all. On a page with few
// interactions INP IS the worst one, which is what this reports.
//
// The staff app is measured through the offline harness: the real components,
// the real stylesheet, the real event handlers, with only `fetch` shimmed. That
// is the right trade for INP, which is a main-thread question — and it is the
// only way to reach the app at all without a server and a session.
//
// The PUBLIC half needs a real server, and will refuse to run without one.
// That is not fussiness. The offline build renders each public page without its
// data and lets the client fill it in; production server-renders it. Measured
// against the offline build, /phone-guide reports CLS 0.63 — a catastrophic
// score — and against `next start` the same page measures 0.0096. The number
// was real; it was measuring the harness. A metric that can be off by 65× on a
// scaffolding detail is worse than no metric, so this one takes a URL.
//
// 4× CPU throttling by default. The counter runs on a tablet, not on this
// machine, and an unthrottled headless Chromium answers every press in under a
// millisecond, which measures nothing.
//
// Thresholds are Google's "good" bar: LCP ≤ 2500ms, INP ≤ 200ms, CLS ≤ 0.1.
// Exits non-zero when any of them is missed.
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { buildAppHtml, BROWSER_ENV, TABS } from './render.mjs'
import { PAGES } from './public.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(import.meta.url)
const { chromium } = require(path.join(ROOT, 'node_modules/playwright-core'))

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const cpu = Number(arg('--cpu', 4))
const wantPublic = process.argv.includes('--public')
const base = arg('--base', null)
if (wantPublic && !base) {
  console.log('--public needs a running server: --base http://127.0.0.1:3000')
  console.log('(the offline build is not the shipped page — see the header)')
  process.exit(2)
}

const GOOD = { lcp: 2500, inp: 200, cls: 0.1 }

// Installed before any script runs, so nothing is missed between load and the
// first observer. Buffered:true catches what happened before this line anyway.
const COLLECTOR = `
  window.__v = { lcp: 0, cls: 0, inp: 0, events: [] }
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__v.lcp = e.startTime })
      .observe({ type: 'largest-contentful-paint', buffered: true })
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) window.__v.cls += e.value
    }).observe({ type: 'layout-shift', buffered: true })
    // The INP definition: an 'event' entry that carries an interactionId is one
    // the browser counted as an interaction. durationThreshold 0 so short ones
    // are seen too — otherwise a page with nothing slow reports no data at all
    // and reads as a pass it never earned.
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        if (!e.interactionId) continue
        window.__v.events.push({ name: e.name, dur: Math.round(e.duration) })
        if (e.duration > window.__v.inp) window.__v.inp = Math.round(e.duration)
      }
    }).observe({ type: 'event', buffered: true, durationThreshold: 0 })
  } catch (err) { window.__v.error = String(err) }
`

// --no-proxy-server for the --base runs: a dev machine behind an HTTP proxy
// sends 127.0.0.1 to it and gets a 403 that reads as a broken server.
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: BROWSER_ENV,
  args: base ? ['--no-proxy-server'] : [] })

async function newPage(width = 390) {
  const ctx = await browser.newContext({ locale: 'en-GB', viewport: { width, height: 844 }, hasTouch: true })
  const p = await ctx.newPage()
  await p.addInitScript(COLLECTOR)
  if (cpu > 1) {
    const cdp = await ctx.newCDPSession(p)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
  }
  return { ctx, p }
}

const rows = []
let bad = 0
const verdict = (v, k) => (v <= GOOD[k] ? ' ' : '✗')

if (wantPublic) {
  for (const page of Object.keys(PAGES)) {
    // PAGES keys are harness names; the tool pages live under /tools/.
    const url = base.replace(/\/$/, '') + '/' + page.replace(/^tool-/, 'tools/')
    const { ctx, p } = await newPage()
    const res = await p.goto(url, { waitUntil: 'load' }).catch(() => null)
    if (!res || !res.ok()) { console.log(`· skipped ${page} — ${res ? res.status() : 'no response'} at ${url}`); await ctx.close(); continue }
    await p.waitForTimeout(1800)
    // A real press, so CLS after interaction and INP are both exercised. The
    // first focusable thing on the page, whatever it is.
    await p.keyboard.press('Tab')
    await p.keyboard.press('Tab')
    await p.waitForTimeout(400)
    const v = await p.evaluate(() => window.__v)
    rows.push({ where: page, ...v })
    await ctx.close()
  }
} else {
  const { ctx, p } = await newPage(1280)
  await p.goto('file://' + buildAppHtml(), { waitUntil: 'load' })
  await p.waitForTimeout(1500)
  // Every tab, pressed the way a person presses it: find the rail item and
  // click it with the mouse. A synthetic .click() produces no interaction
  // entry, so the first draft of this reported INP 0 on every tab.
  for (const tab of TABS) {
    const sel = `.nav-item[data-tab="${tab}"]`
    const el = await p.$(sel)
    if (el) { await el.click(); await p.waitForTimeout(700) }
    const v = await p.evaluate(() => {
      const s = window.__v.inp, w = window.__v.events.slice(-4).sort((a, b) => b.dur - a.dur)[0]
      window.__v.inp = 0
      return { ...window.__v, inp: s, worst: w }
    })
    // LCP belongs to the page load, not to a tab. It is the same number on
    // every row of a single-page app, and printing it thirteen times invites
    // reading it as thirteen measurements.
    rows.push({ where: `tab:${tab}`, ...v, lcp: rows.length ? 0 : v.lcp })
  }
  // The two heaviest presses in the app: the command palette (renders a list
  // over everything) and the till (a whole-page takeover).
  await p.keyboard.press('Control+k')
  await p.waitForTimeout(600)
  await p.keyboard.type('rent')
  await p.waitForTimeout(700)
  rows.push({ where: 'palette+typing', lcp: 0, ...await p.evaluate(() => {
    const s = window.__v.inp, w = window.__v.events.slice(-8).sort((a, b) => b.dur - a.dur)[0]
    window.__v.inp = 0
    return { ...window.__v, inp: s, worst: w, lcp: 0 }
  }) })
  await p.keyboard.press('Escape')
  await p.waitForTimeout(400)
  await ctx.close()
}

await browser.close()

const label = wantPublic ? 'public pages' : 'staff app'
console.log(`${'where'.padEnd(20)} ${'LCP'.padStart(7)} ${'INP'.padStart(7)} ${'CLS'.padStart(7)}   interactions`)
for (const r of rows) {
  const lcp = Math.round(r.lcp || 0), inp = r.inp || 0, cls = Number((r.cls || 0).toFixed(3))
  // LCP is a page-load number; inside a single-page app only the first row has
  // one, and reporting 0 for the rest would read as an impossibly good result.
  const lcpCell = lcp ? `${lcp}ms${verdict(lcp, 'lcp')}` : '   —  '
  if (lcp > GOOD.lcp) bad++
  if (inp > GOOD.inp) bad++
  if (cls > GOOD.cls) bad++
  const blame = inp > GOOD.inp && r.worst ? `  ← ${r.worst.name}` : ''
  console.log(`${r.where.padEnd(20)} ${lcpCell.padStart(8)} ${(inp + 'ms' + verdict(inp, 'inp')).padStart(8)} ${(cls + verdict(cls, 'cls')).padStart(8)}   ${(r.events || []).length}${blame}`)
}
console.log(bad
  ? `\n${bad} vitals miss Google's "good" bar (${label}, ${cpu}× CPU) — LCP ≤${GOOD.lcp}ms, INP ≤${GOOD.inp}ms, CLS ≤${GOOD.cls}`
  : `\nevery vital is "good" (${label}, ${cpu}× CPU) — LCP ≤${GOOD.lcp}ms, INP ≤${GOOD.inp}ms, CLS ≤${GOOD.cls}`)
process.exit(bad ? 1 : 0)
