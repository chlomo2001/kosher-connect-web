// Tickets that arrived by email → the booking form, offline.
//
//   node ops/harness/tickets.mjs
//
// Owner, 18 Aug: "when he books a ticket, he shouldnt have to enter in the app
// manually, just when it gets forwarded the app should match with customer name
// and suggest a task to confirm."
//
// The parser has unit tests (test/ticketMail.test.mjs). What those cannot see is
// the handover — whether the fields the parser read actually arrive in the boxes
// a person presses save on. That is the whole feature: everything else is a
// suggestion nobody can act on.
//
// So this drives the real thing. It also guards the two ways this quietly goes
// wrong:
//
//   · a price in euros must NOT land in a pounds box (a silent conversion at a
//     made-up rate is a wrong wallet charge)
//   · abandoning a prefilled form and starting a fresh booking must not file the
//     new booking against the old email
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

const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-GB' })
const p = await ctx.newPage()
p.on('pageerror', (e) => findings.push(`page error — ${e.message}`))
await p.goto('file://' + file, { waitUntil: 'load' })
await p.waitForTimeout(900)

await p.evaluate(async () => { await goToTab('bookings') })
await p.waitForTimeout(600)

// ── the queue is there and says what it read ──────────────────────────────
const queue = await p.evaluate(() => {
  const rows = [...document.querySelectorAll('.tm-row')]
  return {
    n: rows.length,
    first: rows[0] ? rows[0].innerText.replace(/\s+/g, ' ') : '',
    // The cancellation must not offer booking as its primary action.
    cancelPrimary: rows.some((r) => /Cancelled/.test(r.innerText) &&
      /Confirm booking details/.test(r.querySelector('.btn-primary')?.textContent || '')),
  }
})
say(queue.n === 3, `three tickets are waiting in the seed — the tab showed ${queue.n}`)
say(/XU2WWH/.test(queue.first) && /LTN → TLV/.test(queue.first) && /£428.60/.test(queue.first),
  `the first card should show the reference, the route and the price — got "${queue.first.slice(0, 120)}"`)
say(!queue.cancelPrimary, 'a cancellation offered booking as its primary action')

// ── what did not parse is visible as missing, not as blank ────────────────
say(await p.evaluate(() => [...document.querySelectorAll('.tm-row')]
  .some((r) => /QK4T2M/.test(r.innerText) && !!r.querySelector('.tm-gap'))),
  'a ticket whose price did not parse should SAY so — a blank reads as free')

// ── the handover: email → the boxes someone presses save on ───────────────
await p.evaluate(() => tmBook(71))
await p.waitForTimeout(700)
const form = await p.evaluate(() => {
  const v = (id) => document.getElementById(id)?.value || ''
  return {
    route: v('bkRoute'), airline: v('bkAirline'), ref: v('bkRef'),
    date: v('bkTravelDate'), dep: v('bkDep'), arr: v('bkArr'), price: v('bkPrice'),
    notes: v('bkNotes'),
    customer: document.getElementById('bkCustomer')?.value || '',
    pax: [...document.querySelectorAll('#bkPaxEditor input')]
      .map((i) => i.value).filter(Boolean),
  }
})
say(form.route === 'LTN → TLV', `route did not carry over — got "${form.route}"`)
say(form.airline === 'Wizz Air', `airline did not carry over — got "${form.airline}"`)
say(form.ref === 'XU2WWH', `booking reference did not carry over — got "${form.ref}"`)
say(form.date === '2026-09-12', `travel date did not carry over — got "${form.date}"`)
say(form.dep === '08:25' && form.arr === '15:05', `times did not carry over — got ${form.dep}/${form.arr}`)
say(form.price === '428.6' || form.price === '428.60', `price did not carry over — got "${form.price}"`)
say(form.customer === 'c1', `the matched customer should be preselected — got "${form.customer}"`)
say(form.pax.includes('Menachem Adler') && form.pax.includes('Rivka Adler'),
  `both passengers should be in the editor — got ${JSON.stringify(form.pax)}`)
say(/return 26/i.test(form.notes),
  `the return leg is a second booking and the note should say so — got "${form.notes}"`)

// ── the form admits it filled itself in ───────────────────────────────────
say(await p.evaluate(() => {
  const banner = document.querySelector('#dynamicModal .tm-prefill')
  const title = document.querySelector('#dynamicModal .modal-title')?.textContent || ''
  return !!banner && /editable|change anything/i.test(banner.textContent) &&
    /Confirm booking details/.test(title)
}), 'a prefilled form must say it was prefilled, and that the fields can be changed')

// ── the task is the doorway ───────────────────────────────────────────────
// Owner, 18 Aug: "it should come up as task needing confirmation". A task that
// only describes the work leaves someone hunting for the card on another tab.
await p.evaluate(() => { try { closeDynamicModal() } catch {} })
await p.waitForTimeout(200)
await p.evaluate(async () => { await goToTab('tasks') })
await p.waitForTimeout(500)
const taskBtn = await p.evaluate(() => {
  const btn = [...document.querySelectorAll('.task-card button')]
    .find((b) => /Confirm booking details/.test(b.textContent))
  return { found: !!btn, onclick: btn ? btn.getAttribute('onclick') : '' }
})
say(taskBtn.found, 'the ticket task should carry a button that opens the confirmation')
say(/tmOpenFromTask\('TICKET-71'\)/.test(taskBtn.onclick),
  `the task button should open its own ticket — got "${taskBtn.onclick}"`)
if (taskBtn.found) {
  await p.evaluate(() => tmOpenFromTask('TICKET-71'))
  await p.waitForTimeout(900)
  say(await p.evaluate(() => document.getElementById('bkRef')?.value === 'XU2WWH'),
    'pressing the task should land on the booking form for THAT ticket')
  await p.evaluate(() => { try { closeDynamicModal() } catch {} })
  await p.evaluate(async () => { await goToTab('bookings') })
  await p.waitForTimeout(500)
}

// ── a foreign price is NOT converted into the pounds box ──────────────────
await p.evaluate(() => { try { closeDynamicModal() } catch {} })
await p.waitForTimeout(200)
await p.evaluate(() => tmBook(69))          // the €170 cancellation
await p.waitForTimeout(700)
const foreign = await p.evaluate(() => ({
  price: document.getElementById('bkPrice')?.value || '',
  notes: document.getElementById('bkNotes')?.value || '',
}))
say(foreign.price === '', `a euro price must not land in the pounds box — got "${foreign.price}"`)
say(/EUR 170/.test(foreign.notes), `the note should carry what the airline actually charged — got "${foreign.notes}"`)

// ── abandoning a prefilled form does not file the next booking against it ──
await p.evaluate(() => { try { closeDynamicModal() } catch {} })
await p.waitForTimeout(200)
await p.evaluate(() => openNewBookingModal())
await p.waitForTimeout(600)
say(await p.evaluate(() => tmPendingId === null),
  'a fresh booking form still pointed at the abandoned ticket email')

await b.close()

if (findings.length) {
  console.log(`✗ ${findings.length} finding${findings.length === 1 ? '' : 's'}\n`)
  findings.forEach((f) => console.log('  · ' + f))
  process.exit(1)
}
console.log('✓ tickets from email reach the booking form intact, and nothing is converted or mis-filed on the way')
