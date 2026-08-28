import { chromium } from 'playwright-core'
import { buildAppHtml, BROWSER_ENV } from '../render.mjs'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: BROWSER_ENV })
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } })
const p = await ctx.newPage()
const failed = []
p.on('requestfailed', r => { if (/\.woff2/.test(r.url())) failed.push(r.url()) })
await p.goto('file://' + buildAppHtml(), { waitUntil: 'load' })
await p.waitForTimeout(900)
console.log(await p.evaluate(async () => {
  await document.fonts.ready
  const loaded = [...document.fonts].map(f => `${f.family} ${f.status}`)
  const probe = (text) => {
    const el = document.createElement('span')
    el.textContent = text
    el.style.cssText = 'position:absolute;font-size:40px'
    document.body.appendChild(el)
    const w = el.getBoundingClientRect().width
    el.style.fontFamily = 'monospace'
    const mono = el.getBoundingClientRect().width
    el.remove()
    return { w: Math.round(w), differsFromMono: Math.abs(w - mono) > 2 }
  }
  return {
    faces: loaded,
    bodyStack: getComputedStyle(document.body).fontFamily,
    latinRendersDifferently: probe('Handgloves 123'),
  }
}))
console.log('failed font requests:', failed.length ? failed : 'none')
await b.close()
