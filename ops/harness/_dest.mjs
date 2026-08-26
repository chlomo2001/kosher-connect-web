import { chromium } from 'playwright-core'
import { buildAppHtml, BROWSER_ENV, TABS } from './render.mjs'
const file = buildAppHtml()
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: BROWSER_ENV })
try {
  const p=await (await b.newContext({viewport:{width:1440,height:1000}})).newPage()
  await p.goto('file://'+file); await p.waitForTimeout(1500)
  const DEST = /delete|remove|void|cancel|✕|✖|discard/i
  for (const t of TABS) {
    await p.evaluate(x=>goToTab(x),t); await p.waitForTimeout(600)
    const r = await p.evaluate((src) => {
      const DEST = new RegExp(src, 'i')
      const out = []
      for (const tr of document.querySelectorAll('#mainContent tbody tr')) {
        const cells = tr.querySelectorAll('td'); const last = cells[cells.length-1]; if (!last) continue
        const ctrls = [...last.querySelectorAll('button,a[role=button]')].filter(e=>e.getClientRects().length)
        if (ctrls.length < 2) continue
        const names = ctrls.map(e => (e.textContent||'').trim() || e.getAttribute('aria-label') || e.getAttribute('title') || '?')
        const di = names.findIndex(n => DEST.test(n))
        if (di > -1 && di !== names.length - 1) out.push({ names, di })
      }
      return out
    }, DEST.source)
    if (r.length) console.log(t.padEnd(11), `${r.length} row(s): destructive at position ${r[0].di+1} of ${r[0].names.length} — [${r[0].names.join(' | ')}]`)
  }
} finally { await b.close() }
console.log('(done)')
