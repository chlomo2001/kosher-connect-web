// The help timer, floating on top of everything — driven end to end.
//
//   node ops/harness/popout.mjs
//
// Owner, 17 Aug: "the timer should come up even when OUT of the app. like it
// should stay pinned (and movable) in front of pc even while doing the work on
// other sites. an extension maybe?" — built with Document Picture-in-Picture,
// which is a real always-on-top OS window rather than something drawn inside a
// browser tab (see svcTimerPopOut in public/main.js for why not an extension).
//
// A second window is exactly the kind of thing that works on the day it is
// written and quietly rots afterwards: it has its own document, its own
// stylesheet and its own copies of the buttons. So this drives it like a
// person does, in both themes — opens it, watches the clock move, pauses from
// the window and checks the APP agrees, then stops from the window and checks
// the charge form comes up in the app with the customer and the money already
// in it.
//
// Exits non-zero on a finding.
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { buildAppHtml, BROWSER_ENV } from './render.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(import.meta.url)
const { chromium } = require(path.join(ROOT, 'node_modules/playwright-core'))

const file = buildAppHtml()
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: BROWSER_ENV })
const findings = []
const say = (ok, what) => { if (!ok) findings.push(what) }

for (const theme of ['light', 'dark']) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-GB', colorScheme: theme })
  const p = await ctx.newPage()
  p.on('pageerror', (e) => findings.push(`${theme}: page error — ${e.message}`))
  await p.goto('file://' + file, { waitUntil: 'load' })
  await p.waitForTimeout(900)
  if (theme === 'dark') await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))

  say(await p.evaluate(() => svcPipSupported()), `${theme}: the browser reports no floating-window support`)

  await p.evaluate(async () => { await goToTab('services') })
  await p.waitForTimeout(350)
  await p.evaluate(() => kcPickerSet('svcTimerCustomer', customers[0].id))
  await p.click('button:has-text("Start timer")')
  await p.waitForTimeout(400)
  say(await p.locator('button:has-text("Float on top")').count() === 1,
    `${theme}: no "Float on top" button on a running timer`)

  await p.evaluate(async () => { await svcTimerPopOut() })
  await p.waitForTimeout(1500)
  const pip = ctx.pages().find((x) => x !== p)
  if (!pip) { findings.push(`${theme}: the floating window never opened`); await ctx.close(); continue }

  say(await pip.title() === 'Kosher Connect — help timer', `${theme}: the window has no name of its own`)
  say(await pip.evaluate(() => document.documentElement.getAttribute('data-theme')) === (theme === 'dark' ? 'dark' : 'light'),
    `${theme}: the window ignores the app's theme`)
  // Its own stylesheet, because a PiP document inherits nothing.
  say(await pip.evaluate(() => getComputedStyle(document.body).backgroundColor) !== 'rgba(0, 0, 0, 0)',
    `${theme}: the window has no background of its own`)

  const t1 = await pip.textContent('#pipClock')
  await p.waitForTimeout(1300)
  const t2 = await pip.textContent('#pipClock')
  say(t1 !== t2, `${theme}: the clock in the window does not move (stuck at ${t1})`)
  say(/^£/.test((await pip.textContent('#pipSub')).trim()), `${theme}: the window never says what it will cost`)

  // Pause from the window — the app has to agree, not just the window.
  await pip.click('#pipHold')
  await p.waitForTimeout(1200)
  say(await p.evaluate(() => !svcTimerState()?.runningSince), `${theme}: pausing from the window left the app's timer running`)
  say((await pip.textContent('#pipHold')).includes('Resume'), `${theme}: the paused window still offers Pause`)
  await pip.click('#pipHold')
  await p.waitForTimeout(400)
  say(await p.evaluate(() => !!svcTimerState()?.runningSince), `${theme}: resuming from the window did not restart the app's timer`)

  // While the window is up, the in-app chip stands down — one clock, not two.
  await p.evaluate(async () => { await goToTab('dashboard') })
  await p.waitForTimeout(1200)
  say(await p.locator('#svcTimerFloat').count() === 0, `${theme}: the in-app chip and the floating window are both showing`)

  // Stop from the window: it closes, the app comes forward with the charge
  // form already filled in.
  await pip.click('#pipStop')
  await p.waitForTimeout(900)
  say(ctx.pages().length === 1, `${theme}: stopping from the window left it open`)
  say(await p.locator('.modal-title:has-text("Charge a service")').count() === 1,
    `${theme}: stopping from the window did not open the charge form`)
  say(!!(await p.evaluate(() => document.getElementById('svCustomer')?.value)),
    `${theme}: the charge form does not know who was being helped`)
  const total = await p.inputValue('#svTotal').catch(() => '')
  say(Number(total) > 0, `${theme}: the charge form came up with no money in it (${total})`)

  await ctx.close()
}

await b.close()

if (findings.length) {
  console.log(`✗ ${findings.length} finding${findings.length === 1 ? '' : 's'}\n`)
  findings.forEach((f) => console.log('  · ' + f))
  process.exit(1)
}
console.log('✓ the help timer floats, ticks, pauses and charges from its own window — light and dark')
