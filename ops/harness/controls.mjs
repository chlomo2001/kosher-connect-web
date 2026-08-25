// How much is on screen, per tab.
//
// Owner, 25 Aug: "the balance vs overdone — no buttons which aren't really
// needed". That is countable. This counts what is actually VISIBLE on each tab
// at rest — not what exists in the source — because the cost of a control is
// paid by the person looking at it, not by the file holding it.
//
//   node ops/harness/controls.mjs [--width 1280]
import { chromium } from 'playwright-core'
import { buildAppHtml, TABS } from './render.mjs'

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const width = Number(arg('--width', 1280))
const file = buildAppHtml()
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await (await browser.newContext({ viewport: { width, height: 1000 } })).newPage()
await p.goto('file://' + file); await p.waitForTimeout(1200)

const rows = []
for (const t of TABS) {
  await p.evaluate((n) => goToTab(n), t)
  await p.waitForTimeout(650)
  const r = await p.evaluate(() => {
    const main = document.getElementById('mainContent') || document.body
    const vis = (e) => e.getClientRects().length > 0
    const ctrls = [...main.querySelectorAll('button, a[href], [role="button"], select, input:not([type=hidden]), textarea')].filter(vis)
    const buttons = ctrls.filter(e => e.tagName === 'BUTTON' || e.getAttribute('role') === 'button')
    const inputs  = ctrls.filter(e => ['SELECT','INPUT','TEXTAREA'].includes(e.tagName))
    // A control repeated once per row is one DECISION, not N — the row count is
    // the honest divisor, or every list looks like chaos.
    const rowCtrls = [...main.querySelectorAll('tbody tr button, tbody tr a, tbody tr [role=button]')].filter(vis)
    return {
      total: ctrls.length, buttons: buttons.length, inputs: inputs.length,
      inRows: rowCtrls.length, chrome: ctrls.length - rowCtrls.length,
    }
  })
  rows.push([t, r])
}
await browser.close()

console.log(`visible controls per tab at ${width}px — "chrome" is everything not repeated per row\n`)
console.log('tab            total  buttons  inputs  in-rows  CHROME')
console.log('─'.repeat(60))
rows.sort((a, b) => b[1].chrome - a[1].chrome)
for (const [t, r] of rows) {
  const flag = r.chrome > 20 ? '  ←' : ''
  console.log(`${t.padEnd(14)} ${String(r.total).padStart(5)} ${String(r.buttons).padStart(8)} ${String(r.inputs).padStart(7)} ${String(r.inRows).padStart(8)} ${String(r.chrome).padStart(7)}${flag}`)
}
const tot = rows.reduce((s, [, r]) => s + r.chrome, 0)
console.log('─'.repeat(60))
console.log(`median chrome ${rows.map(r=>r[1].chrome).sort((a,b)=>a-b)[Math.floor(rows.length/2)]} · total across ${rows.length} tabs ${tot}`)
