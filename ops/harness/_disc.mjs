import { chromium } from 'playwright-core'
import { buildAppHtml, BROWSER_ENV } from './render.mjs'
const file = buildAppHtml()
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: BROWSER_ENV })
const OUT='/tmp/claude-0/-home-user-kosher-connect-web/eab985d1-8e6d-5635-b215-9de4c3245fea/scratchpad'
const tabs = process.argv.slice(2)
try {
  for (const t of tabs) {
    const ctx=await b.newContext({viewport:{width:1280,height:1000}})
    const p=await ctx.newPage(); await p.goto('file://'+file); await p.waitForTimeout(1500)
    await p.evaluate(x=>goToTab(x),t); await p.waitForTimeout(1100)
    await p.screenshot({path:`${OUT}/disc_${t}.png`,clip:{x:224,y:0,width:1056,height:900}})
    await ctx.close()
  }
} finally { await b.close() }
console.log('rendered', tabs.join(' '))
