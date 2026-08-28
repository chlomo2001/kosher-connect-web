import { chromium } from 'playwright-core'
const out='/tmp/claude-0/-home-user-kosher-connect-web/eab985d1-8e6d-5635-b215-9de4c3245fea/scratchpad'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await b.newContext({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
await p.goto('http://127.0.0.1:3112/welcome', { waitUntil: 'networkidle' })
await p.waitForTimeout(900)
await p.screenshot({ path: `${out}/hero-inter.png`, clip: { x: 0, y: 0, width: 1280, height: 560 } })
await b.close(); console.log('ok')
