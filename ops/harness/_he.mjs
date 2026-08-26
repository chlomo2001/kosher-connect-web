import { chromium } from 'playwright-core'
import { BROWSER_ENV } from './render.mjs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT='/tmp/claude-0/-home-user-kosher-connect-web/eab985d1-8e6d-5635-b215-9de4c3245fea/scratchpad'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: BROWSER_ENV })
try {
  for (const [page, w] of [['portal',390],['welcome',390],['phone-guide',390],['portal',1280]]) {
    const p=await (await b.newContext({viewport:{width:w,height:1000}})).newPage()
    await p.goto('file://' + path.join(HERE, `public_${page}_he.html`)); await p.waitForTimeout(1200)
    await p.screenshot({path:`${OUT}/he_${page}_${w}.png`,clip:{x:0,y:0,width:w,height:900}})
  }
} finally { await b.close() }
console.log('ok')
