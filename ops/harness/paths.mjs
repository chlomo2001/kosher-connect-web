// How far is the work?
//
// Owner, 25 Aug: "for this go to that tab, that card, that button — somehow not
// fluent". That is a measurable claim, so this measures it: for each everyday
// job, how many interactions from the dashboard until the job's own data entry
// is on screen. Not the typing — the FINDING.
//
// Each job is walked twice: the way somebody navigates who does not know the
// app, and the way the command palette offers if they do. The gap between those
// two numbers is the discoverability cost, and it is the interesting one.
//
//   node ops/harness/paths.mjs
import { chromium } from 'playwright-core'
import { buildAppHtml } from './render.mjs'

const file = buildAppHtml()
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

// A step is a label plus a way to perform it. It returns false if it could not
// be done, which fails the job loudly rather than reporting a shorter path.
const click = (text, opts = {}) => ({
  label: opts.label || `click "${text}"`,
  run: (p) => p.evaluate(({ t, exact }) => {
    // getClientRects(), NOT offsetParent: offsetParent is null for anything
    // inside a position:fixed modal, so the first version of this could never
    // click the customer card and reported the job as broken instead.
    const all = [...document.querySelectorAll('button, a, [role="button"], summary, [class*=head], .stat-card, .nav-item, .card-menu-item')]
      .filter(e => e.getClientRects().length > 0)
    const hit = all.find(e => {
      // Normalised: a real button carries a chevron span, a count, or a
      // two-line sub-label, so === against the visible word never matches.
      // "exact" here means "this control IS this thing", not string equality.
      const s = (e.innerText || e.textContent || '').replace(/[\u25be\u25b8\u2026]/g, ' ').replace(/\s+/g, ' ').trim()
      const a = s.toLowerCase(), b = t.toLowerCase()
      return exact ? (a === b || a.startsWith(b + ' ')) : a.includes(b)
    })
    if (!hit) return false
    hit.click(); return true
  }, { t: text, exact: !!opts.exact }),
})
const tab = (name) => ({ label: `go to ${name}`, run: (p) => p.evaluate((n) => { goToTab(n); return true }, name) })
const palette = () => ({ label: 'Ctrl-K', run: (p) => p.evaluate(() => { openPalette(); return true }) })
const paletteQuick = (label) => ({
  label: `palette → ${label}`,
  run: (p) => p.evaluate((l) => {
    const cards = [...document.querySelectorAll('#paletteQuick .palette-quick-card, #paletteList [class*=row], #paletteList [class*=item]')]
    const hit = cards.find(c => (c.innerText || '').toLowerCase().includes(l.toLowerCase()))
    if (!hit) return false
    hit.click(); return true
  }, label),
})
const typeSearch = (q) => ({
  label: `type "${q}"`,
  run: (p) => p.evaluate((s) => {
    const i = document.getElementById('paletteInput'); if (!i) return false
    i.value = s; i.dispatchEvent(new Event('input', { bubbles: true })); return true
  }, q),
})

const JOBS = [
  { job: 'Hire a phone out',
    navigate: [tab('rentals'), click('New rental')],
    fast:     [palette(), paletteQuick('rental')] },
  { job: 'Take a phone back',
    navigate: [tab('rentals'), click('Manage')],
    fast:     [palette(), typeSearch('overdue'), paletteQuick('overdue')] },
  { job: 'Take a payment',
    navigate: [tab('customers'), click('Details'), click('Take payment')],
    fast:     [palette(), typeSearch('Adler'), paletteQuick('Adler')] },
  { job: 'Chase a debt (text them)',
    navigate: [tab('customers'), click('Details'), click('Contact', { exact: true }), click('Draft a reminder')],
    fast:     [palette(), typeSearch('arrears'), paletteQuick('owes')] },
  { job: 'Sell something (till)',
    navigate: [tab('shop'), click('Sell')],
    fast:     [palette(), paletteQuick('Point of Sale')] },
  // The other end of the same day. Added 27 Aug: the till had a route here and
  // counting it did not, so nothing proved the way to the cash-up stayed open —
  // and it is the one job that has to be done before anybody goes home.
  { job: 'Cash up at the end of the day',
    navigate: [tab('shop'), click('Cash up')],
    fast:     [palette(), paletteQuick('cash')] },
  { job: 'Book a flight',
    navigate: [tab('bookings'), click('New booking')],
    fast:     [palette(), paletteQuick('booking')] },
  { job: 'Book a repair',
    navigate: [tab('repairs'), click('New repair')],
    fast:     [palette(), paletteQuick('repair')] },
  // The route is this long because the destination really is this deep: an
  // inbound customer text is answered from the message log, which lives inside
  // the Messaging card in Settings — eleventh of eighteen cards — and does not
  // load itself. An earlier version of this file walked a "COMMUNICATIONS"
  // heading that does not exist anywhere in the app; it reported a break in the
  // product when the fault was in the route I had written. A harness that
  // invents a screen is worse than no harness: it spends the one thing it is
  // for, which is being believed.
  // Four steps down to two, and the two are the ordinary ones: open the screen,
  // press the person. It used to be Settings → the Messaging card, eleventh of
  // eighteen → Load the log → Reply, which is counter work filed under
  // configuration behind a log that did not load itself.
  { job: 'Answer a text a customer sent',
    navigate: [tab('messages'), click('Yossi')],
    fast:     [palette(), typeSearch('text'), paletteQuick('Answer a text')] },
]

const run = async (steps) => {
  const p = await (await browser.newContext({ viewport: { width: 1280, height: 950 } })).newPage()
  await p.goto('file://' + file); await p.waitForTimeout(1100)
  await p.evaluate(() => goToTab('dashboard')); await p.waitForTimeout(500)
  let n = 0, failedAt = null
  for (const st of steps) {
    const ok = await st.run(p)
    await p.waitForTimeout(450)
    if (!ok) { failedAt = st.label; break }
    n++
  }
  await p.close()
  return { n, failedAt }
}

console.log('steps from the dashboard until the job\'s own screen is open\n')
console.log('job                          navigate   palette   note')
console.log('─'.repeat(78))
let navTotal = 0, fastTotal = 0, broken = []
for (const j of JOBS) {
  const a = await run(j.navigate)
  const b = await run(j.fast)
  navTotal += a.n; fastTotal += b.n
  const note = a.failedAt ? `NAVIGATE BREAKS at ${a.failedAt}` : b.failedAt ? `no palette route (${b.failedAt})` : ''
  if (a.failedAt) broken.push(`${j.job}: ${a.failedAt}`)
  console.log(`${j.job.padEnd(28)} ${String(a.n).padStart(5)}${a.failedAt ? '✗' : ' '}  ${String(b.n).padStart(6)}${b.failedAt ? '✗' : ' '}   ${note}`)
}
console.log('─'.repeat(78))
console.log(`${'TOTAL'.padEnd(28)} ${String(navTotal).padStart(5)}   ${String(fastTotal).padStart(6)}`)
if (broken.length) { console.log('\nCould not be completed by navigating:'); broken.forEach(b => console.log('  ·', b)) }
await browser.close()

// Exit non-zero on a break, so this can go in the nightly sweep and be believed.
// It printed a broken route for a day before anyone looked, because nothing ran
// it but a person remembering to. A check nobody runs is a check that does not
// exist — and the break it printed turned out to be in this file, which is the
// other half of the lesson: an unrun check also never gets corrected.
console.log(broken.length
  ? `\npaths: ${broken.length} job(s) cannot be reached by navigating`
  : `\npaths: every job reachable — ${navTotal} steps navigating, ${fastTotal} by palette`)
process.exit(broken.length ? 1 : 0)
