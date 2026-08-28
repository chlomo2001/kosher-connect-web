import { chromium } from 'playwright-core'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } })
const p = await ctx.newPage()
await p.goto('http://127.0.0.1:3112/welcome', { waitUntil: 'networkidle' })
await p.waitForTimeout(700)
console.log(await p.evaluate(async () => {
  await document.fonts.ready
  const h = document.querySelector('h1')
  const cs = getComputedStyle(h)
  const probe = (fam) => {
    const el = document.createElement('span')
    el.textContent = h.textContent.trim().slice(0, 24)
    el.style.cssText = `position:absolute;left:-9999px;font-size:${cs.fontSize};font-weight:${cs.fontWeight};font-family:${fam}`
    document.body.appendChild(el); const w = el.getBoundingClientRect().width; el.remove(); return Math.round(w)
  }
  return {
    hero: h.textContent.trim().slice(0, 30),
    stack: cs.fontFamily,
    asRendered: probe(cs.fontFamily), asHeebo: probe('"Heebo KC"'),
    asInter: probe('"Inter KC"'), asArial: probe('Arial'),
    interLoaded: document.fonts.check('40px "Inter KC"'),
  }
}))
await p.screenshot({ path: '/tmp/claude-0/-home-user-kosher-connect-web/eab985d1-8e6d-5635-b215-9de4c3245fea/scratchpad/hero-heebo.png', clip: { x: 0, y: 0, width: 1280, height: 620 } })
await b.close()
