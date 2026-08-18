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
    date: v('bkTravelDate'), ret: v('bkReturnDate'), dep: v('bkDep'), arr: v('bkArr'), price: v('bkPrice'),
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
say(form.ret === '2026-09-26',
  `the return leg belongs in its own field, not prose in the notes — got "${form.ret}"`)
say(!/return/i.test(form.notes),
  `the notes should no longer carry the return as prose — got "${form.notes}"`)

// ── the count and the round trip are SAID, not just filled in ─────────────
// Owner, 18 Aug: "does the parser know how many passengers in booking and
// suggest to confirm accordingly?" It knew, and it set the fee calculator's
// count — but nothing on the screen said so, which is the same as not knowing.
say(await p.evaluate(() => {
  const banner = document.querySelector('#dynamicModal .tm-prefill')
  return !!banner && /2 passengers/.test(banner.textContent) &&
    /prices for all 2/.test(banner.textContent)
}), 'a two-passenger ticket should say so, and say the fee will price for both')
say(await p.evaluate(() => {
  const banner = document.querySelector('#dynamicModal .tm-prefill')
  return !!banner && /Round trip/i.test(banner.textContent)
}), 'a round trip should be named on the form, not left to be noticed')
say(await p.evaluate(() => {
  // The count the tiered fee is computed from.
  return document.getElementById('bkPax')?.value === '2'
}), 'the fee calculator should already be counting both passengers')

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

// ── a journey with several airlines says so ───────────────────────────────
// Owner, 18 Aug: "sometimes we do 2 airlines for there and 2 additional for
// back.. all for one person's one time 2-way journey." The register must not
// imply there is one airline and one PNR when there are four legs.
await p.evaluate(() => { try { closeDynamicModal() } catch {} })
await p.waitForTimeout(200)
const legRow = await p.evaluate(() => {
  const row = [...document.querySelectorAll('#mainContent table tbody tr')]
    .find(r => /\+1|flights/.test(r.innerText))
  return row ? row.innerText.replace(/\s+/g, ' ') : ''
})
say(/\+2\b/.test(legRow), `two extra airlines beyond the booking's own should be counted — got "${legRow}"`)
say(/4 flights/.test(legRow), `a four-leg journey should say how many flights — got "${legRow}"`)
// +2, not +3: the reference shown as the headline must not also be counted
// as extra. That off-by-one was real and this line is what found it.
say(/\+2 refs/.test(legRow), `the extra PNRs beyond the one displayed should be counted — got "${legRow}"`)

// …and both forms can edit those legs.
await p.evaluate(() => openNewBookingModal())
await p.waitForTimeout(600)
say(await p.evaluate(() => !!document.getElementById('bkLegEditor')),
  'the new booking form should offer the flight-legs editor')
say(await p.evaluate(() => {
  bkAddLeg('bkLegs'); bkAddLeg('bkLegs')
  // Second leg added is almost always the way home.
  return bkLegs.length === 2 && bkLegs[0].direction === 'out' && bkLegs[1].direction === 'out'
}), 'adding flights should build the itinerary in order')
say(await p.evaluate(() => {
  bkAddLeg('bkLegs')
  return bkLegs[2].direction === 'return'
}), 'the third flight of a journey is the way back, and should default that way')
say(await p.evaluate(() => {
  bkRemoveLeg('bkLegs', 0)
  return bkLegs.length === 2
}), 'a flight should be removable')
await p.evaluate(() => { try { closeDynamicModal() } catch {} })
await p.waitForTimeout(200)

// ── splitting one ticket across payers ────────────────────────────────────
// Owner, 18 Aug: "sometimes its 2 passengers, each one chargable on his own".
// The arithmetic here decides who is charged what, so it is checked directly
// rather than by reading the screen.
await p.evaluate(async () => { await goToTab('bookings') })
await p.waitForTimeout(400)
say(await p.evaluate(() => {
  const card = [...document.querySelectorAll('.tm-row')].find(r => /XU2WWH/.test(r.innerText))
  const single = [...document.querySelectorAll('.tm-row')].find(r => /QK4T2M/.test(r.innerText))
  // Offered on the two-passenger ticket, absent on the one-passenger ticket.
  return /Split across payers/.test(card?.innerText || '') &&
    !/Split across payers/.test(single?.innerText || '')
}), 'the split should be offered only where there is more than one passenger to split')

await p.evaluate(() => tmSplit(71))
await p.waitForTimeout(500)
const split = await p.evaluate(() => {
  const modes = {}
  for (const m of ['each', 'split', 'one']) {
    tsState.feeMode = m
    modes[m] = tsShares().map(r => ({ ticket: r.ticket, fee: r.fee }))
  }
  return { modes, rows: tsState.rows.length, price: tsState.price }
})
say(split.rows === 2, `two passengers should make two payers — got ${split.rows}`)
// £428.60 over two: 214.30 each, and the fee rule decides the rest.
say(JSON.stringify(split.modes.each) === JSON.stringify([{ ticket: 214.3, fee: 25 }, { ticket: 214.3, fee: 25 }]),
  `"a fee each" should charge both the full fee — got ${JSON.stringify(split.modes.each)}`)
say(JSON.stringify(split.modes.split) === JSON.stringify([{ ticket: 214.3, fee: 12.5 }, { ticket: 214.3, fee: 12.5 }]),
  `"split evenly" should halve one fee — got ${JSON.stringify(split.modes.split)}`)
say(JSON.stringify(split.modes.one) === JSON.stringify([{ ticket: 214.3, fee: 25 }, { ticket: 214.3, fee: 0 }]),
  `"all on the first payer" should leave the second paying only their ticket — got ${JSON.stringify(split.modes.one)}`)

// THE PENNY. An odd total divided three ways must still add up to the total —
// somebody carries the rounding and it has to be deterministic.
say(await p.evaluate(() => {
  tsState.price = 100.01
  tsState.feeMode = 'split'
  tsState.feeEach = 25
  tsState.rows = [{ name: 'A', customerId: 'c1' }, { name: 'B', customerId: 'c2' }, { name: 'C', customerId: 'c3' }]
  const s = tsShares()
  const tickets = Math.round(s.reduce((n, r) => n + r.ticket, 0) * 100) / 100
  const fees = Math.round(s.reduce((n, r) => n + r.fee, 0) * 100) / 100
  return tickets === 100.01 && fees === 25 && s[0].ticket > s[1].ticket
}), 'an uneven split must still total the ticket and the fee, with the odd penny on the first payer')

await p.evaluate(() => { try { closeStackedModal() } catch {} })
await p.waitForTimeout(200)

// ── attaching a second confirmation to a booking already made ─────────────
// A self-transfer journey arrives as several emails; the later ones are legs.
await p.evaluate(() => tmAttach(70))
await p.waitForTimeout(500)
const attach = await p.evaluate(() => {
  const m = document.querySelector('#stackedModal') || document.querySelectorAll('.modal-overlay:not(.hidden)')[1]
  const text = m ? m.innerText : ''
  return {
    open: /Add this flight to a booking/.test(text),
    saysNoCharge: /no new charge/i.test(text),
    offers: (m ? m.querySelectorAll('button[onclick^="tmAttachTo"]').length : 0),
  }
})
say(attach.open, 'the attach picker should open')
say(attach.saysNoCharge, 'attaching must say plainly that no new charge is posted')
say(attach.offers > 0, 'the attach picker should offer at least one booking to attach to')
await p.evaluate(() => { try { closeStackedModal() } catch {} })
await p.waitForTimeout(200)

// ── the flight home gets its own check-in ─────────────────────────────────
// Owner, 18 Aug. Every check-in field was singular, so a round trip prompted
// the check-in out and never the one back — the half where the customer is
// abroad and least able to sort it out themselves.
await p.evaluate(() => { try { closeStackedModal() } catch {} })
await p.evaluate(() => { try { closeDynamicModal() } catch {} })
await p.waitForTimeout(200)
await p.evaluate(() => openNewBookingModal())
await p.waitForTimeout(600)
const ci = await p.evaluate(() => {
  document.getElementById('bkTravelDate').value = '2026-09-12'
  document.getElementById('bkReturnDate').value = '2026-09-26'
  document.getElementById('bkCheckinBy').value = 'us'
  bkCheckinToggle()
  const wrap = document.getElementById('bkRetCheckinWrap')
  return {
    out: document.getElementById('bkCheckinDate').value,
    back: document.getElementById('bkRetCheckinDate').value,
    shown: !!wrap && getComputedStyle(wrap).display !== 'none',
  }
})
say(ci.out === '2026-09-11', `the outbound check-in should default to the day before — got "${ci.out}"`)
say(ci.back === '2026-09-25', `the return check-in should default to the day before the flight home — got "${ci.back}"`)
say(ci.shown, 'the return check-in field should appear once the journey has a way back')

// It must NOT appear on a one-way — an empty second date on 389 of 394
// bookings is noise, and noise is what makes people stop reading a form.
say(await p.evaluate(() => {
  document.getElementById('bkReturnDate').value = ''
  bkCheckinToggle()
  const wrap = document.getElementById('bkRetCheckinWrap')
  return !!wrap && getComputedStyle(wrap).display === 'none'
}), 'a one-way booking should not ask about a return check-in')

// The chip must not say the job is done while the flight home is outstanding.
say(await p.evaluate(() => {
  const oneWayDone = checkinChip({ checkinDone: true })
  const halfDone = checkinChip({ checkinDone: true, returnDate: '2026-09-26', checkinBy: 'us', returnCheckinDate: '2026-09-25' })
  const bothDone = checkinChip({ checkinDone: true, returnDate: '2026-09-26', returnCheckinDone: true })
  return /✅/.test(oneWayDone) && !/✅/.test(halfDone) && /✅/.test(bothDone) && /×2/.test(bothDone)
}), 'the chip should only read done when BOTH legs are done')
await p.evaluate(() => { try { closeDynamicModal() } catch {} })
await p.waitForTimeout(200)

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
