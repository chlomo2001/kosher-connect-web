// No control may hide its own label.
//
//   node ops/harness/clipped.mjs            # standard text size
//   node ops/harness/clipped.mjs --fs largest
//
// A placeholder is not decoration: on a search box it is the only thing on the
// screen saying what is searchable, and for a field with no <label> it is the
// accessible name a screen reader reads out. A `<select>`'s selected option is
// the current value. Either one cut off by its own box is a control that has
// stopped explaining itself.
//
// This is a SIMPLE MODE sweep more than anything. Every one of the seven it
// found on its first run was clean at the standard size and broken at the
// largest — boxes sized in pixels against text that grows 30%, so the people
// who turned the text up were the only ones who could not read the labels.
// "Search customer, number, provider…" lost 136px of itself in a 260px box.
//
// Measured with canvas measureText in the control's own computed font, against
// its content box (a select also spends ~20px on its arrow). Two pixels of
// slack, because sub-pixel rounding is not a defect.
//
// EXAMPLES ARE NOT LABELS. `data-ph="example"` marks a placeholder that teaches
// the format rather than naming the field — Kol Torah's "e.g. 3 CDs of R'
// Shloime onto one SD" — and those are skipped, because a truncated example
// still shows the shape and shortening it would cost the thing it is for. They
// are counted out loud rather than silently dropped: an exemption nobody can
// see is how an allowlist rots into a blindfold.
//
// Exits non-zero on a finding.
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { buildAppHtml, BROWSER_ENV, TABS } from './render.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(import.meta.url)
const { chromium } = require(path.join(ROOT, 'node_modules/playwright-core'))

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const fs = arg('--fs', 'standard')
const width = Number(arg('--width', 1280))

const file = buildAppHtml()
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: BROWSER_ENV })
const ctx = await b.newContext({ viewport: { width, height: 900 }, locale: 'en-GB' })
const p = await ctx.newPage()
await p.goto('file://' + file, { waitUntil: 'load' })
await p.waitForTimeout(900)
if (fs !== 'standard') {
  await p.evaluate((f) => { try { setTextSize(f) } catch { document.documentElement.setAttribute('data-fs', f) } }, fs)
  await p.waitForTimeout(400)
}

const findings = []
let skippedExamples = 0
for (const tab of TABS) {
  await p.evaluate((t) => window.renderTab(t), tab).catch(() => {})
  await p.waitForTimeout(300)
  const res = await p.evaluate((tab) => {
    const cv = document.createElement('canvas')
    const cx = cv.getContext('2d')
    const out = []
    let examples = 0
    const textWidth = (el, txt) => {
      const cs = getComputedStyle(el)
      cx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
      return cx.measureText(txt).width
    }
    document.querySelectorAll('#mainContent input[placeholder], #mainContent select').forEach((el) => {
      const r = el.getBoundingClientRect()
      if (!r.width) return
      const cs = getComputedStyle(el)
      const isSelect = el.tagName === 'SELECT'
      const text = isSelect ? (el.selectedOptions[0]?.textContent || '').trim() : el.placeholder
      if (!text) return
      const room = r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - (isSelect ? 20 : 0)
      const need = textWidth(el, text)
      if (need - room > 2) {
        if (el.dataset.ph === 'example') { examples++; return }
        out.push({ tab, kind: isSelect ? 'select' : 'input', id: el.id || el.name || '(no id)',
          text: text.slice(0, 46), box: Math.round(r.width), short: Math.round(need - room) })
      }
    })
    return { out, examples }
  }, tab)
  findings.push(...res.out)
  skippedExamples += res.examples
}
await b.close()

const label = `${width}px${fs === 'standard' ? '' : ` / text ${fs}`}`
findings.sort((a, b2) => b2.short - a.short)
for (const f of findings) {
  console.log(`✗ ${String(f.short).padStart(4)}px short  ${f.kind.padEnd(6)} ${f.box}px box  ${f.id.padEnd(22)} "${f.text}"  [${f.tab}]`)
}
const note = skippedExamples
  ? ` (${skippedExamples} example placeholder${skippedExamples === 1 ? '' : 's'} skipped — see data-ph)`
  : ''
console.log(findings.length
  ? `\n${findings.length} control(s) hiding their own label at ${label}${note}`
  : `\nno control hides its own label at ${label}${note}`)
if (findings.length) process.exit(1)
