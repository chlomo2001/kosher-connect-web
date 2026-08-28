import { chromium } from 'playwright-core'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
for (const [path, label] of [['/welcome', 'public site'], ['/login', 'staff (login)']]) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } })
  const p = await ctx.newPage()
  const woff = []
  p.on('response', r => { if (/\.woff2/.test(r.url())) woff.push(`${r.status()} ${r.url().split('/').pop()}`) })
  await p.goto('http://127.0.0.1:3112' + path, { waitUntil: 'networkidle' })
  await p.waitForTimeout(600)
  const r = await p.evaluate(async () => {
    await document.fonts.ready
    const el = document.createElement('span')
    el.textContent = 'Handgloves 123'
    el.style.cssText = 'position:absolute;left:-9999px;font-size:48px;font-weight:400'
    document.body.appendChild(el)
    el.style.fontFamily = getComputedStyle(document.body).fontFamily
    const withStack = el.getBoundingClientRect().width
    el.style.fontFamily = 'Heebo KC'
    const heebo = el.getBoundingClientRect().width
    el.style.fontFamily = 'Arial'
    const arial = el.getBoundingClientRect().width
    el.remove()
    return {
      stack: getComputedStyle(document.body).fontFamily,
      heeboLoaded: document.fonts.check('40px "Heebo KC"'),
      widths: { withStack: Math.round(withStack), heebo: Math.round(heebo), arial: Math.round(arial) },
      usingHeebo: Math.abs(withStack - heebo) < 1.5,
    }
  })
  console.log(label, JSON.stringify(r, null, 1))
  console.log('   woff2:', woff.join(' · ') || 'none')
  await ctx.close()
}
await b.close()
