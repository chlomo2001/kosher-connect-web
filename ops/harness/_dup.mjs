import { chromium } from 'playwright-core'
import { buildAppHtml, BROWSER_ENV, TABS } from './render.mjs'
const file = buildAppHtml()
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: BROWSER_ENV })
try {
  const p=await (await b.newContext({viewport:{width:1280,height:1000}})).newPage()
  await p.goto('file://'+file); await p.waitForTimeout(1500)
  const norm = t => t.replace(/[+＋]/g,'').replace(/\s+/g,' ').trim().toLowerCase()
  console.log('tab           topbar primary            duplicated in content?')
  console.log('-'.repeat(78))
  let dup=0
  for (const t of TABS) {
    await p.evaluate(x=>goToTab(x),t); await p.waitForTimeout(600)
    const r = await p.evaluate((n) => {
      const btn = document.getElementById('btnNewCustomer')
      const hidden = !btn || btn.style.display === 'none'
      const label = hidden ? null : btn.textContent.trim()
      if (hidden) return { label: null, matches: [] }
      const norm = s => s.replace(/[+＋]/g,'').replace(/\s+/g,' ').trim().toLowerCase()
      const main = document.getElementById('mainContent')
      const matches = [...main.querySelectorAll('button, a[role=button]')]
        .filter(e => e.getClientRects().length && norm(e.textContent) === norm(label))
        .map(e => ({ cls: e.className, w: Math.round(e.getBoundingClientRect().width) }))
      return { label, matches }
    }, t)
    if (r.label) {
      const n = r.matches.length
      if (n) dup++
      console.log(t.padEnd(13), (r.label||'').padEnd(26), n ? `YES ×${n}  ${r.matches.map(m=>m.cls.includes('btn-primary')?'primary':'outline').join(',')}` : '—')
    } else {
      console.log(t.padEnd(13), '(no topbar create)'.padEnd(26), '—')
    }
  }
  console.log('-'.repeat(78))
  console.log('tabs showing the same create action twice:', dup)
} finally { await b.close() }
