import { chromium } from 'playwright-core'
import { buildAppHtml, BROWSER_ENV, TABS } from './render.mjs'
const file = buildAppHtml()
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: BROWSER_ENV })
try {
  const p=await (await b.newContext({viewport:{width:1440,height:1000}})).newPage()
  await p.goto('file://'+file); await p.waitForTimeout(1500)
  console.log('DESIGN.md: under three actions inline; three or more = one primary + the rest behind ...')
  console.log('measured at 1440px, where .row-actions is meant to hold one line\n')
  for (const t of TABS) {
    await p.evaluate(x=>goToTab(x),t); await p.waitForTimeout(600)
    const r = await p.evaluate(() => {
      const out = []
      for (const tr of document.querySelectorAll('#mainContent tbody tr')) {
        const cells = tr.querySelectorAll('td')
        const last = cells[cells.length-1]
        if (!last) continue
        const ctrls = [...last.querySelectorAll('button,a[role=button]')].filter(e=>e.getClientRects().length)
        const menu = ctrls.some(e => /card-menu-btn|row-menu/.test(e.className) || e.getAttribute('aria-haspopup')==='menu')
        out.push({ n: ctrls.length, menu, labels: ctrls.map(e=>(e.textContent||e.getAttribute('aria-label')||'?').trim().slice(0,14)) })
      }
      return out
    })
    if (!r.length) continue
    const worst = r.reduce((a,x)=>x.n>a.n?x:a, r[0])
    const bad = r.filter(x => x.n >= 3 && !x.menu).length
    console.log(`${t.padEnd(11)} rows ${String(r.length).padStart(3)}  max controls ${worst.n}  ${bad? `${bad} row(s) with 3+ and NO menu  [${worst.labels.join(' | ')}]` : 'ok'}`)
  }
} finally { await b.close() }
