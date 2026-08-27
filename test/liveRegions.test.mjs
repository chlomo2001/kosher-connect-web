// A number that changes on screen and is announced to nobody.
//
// WCAG 4.1.3 Status Messages (Level AA): a message about the result of an
// action, presented without moving focus, has to carry a role or property that
// lets assistive technology read it. The classic failure is not a missing
// label — it is a value the sighted user watches update while a screen-reader
// user hears the keystrokes and never the answer.
//
// Found 27 Aug walking the till, the cash-up and the repair booking. Four
// computed readouts had no live region, and they were the point of their
// screens:
//
//   cuVariance      is the till over or short — the whole reason to cash up
//   posChange       the change due to the customer standing at the counter
//   rpTotal         the repair total as services are ticked
//   bkFeeBreakdown  the booking fee as the form is filled in
//
// The customer-facing pages were already covered (portal, /repair and /welcome
// carry eight between them). The staff app had five live regions in 26,000
// lines, and none of them was on a number.
//
// This test is deliberately a LIST rather than a rule. There is no way to tell
// from the source whether a given element is a status message or ordinary
// content — that is a judgement, and it was made once, here. What the test
// prevents is the judgement being quietly undone: an element on this list that
// loses its role, or is renamed without anybody thinking about it, goes red.
import test from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const SRC = readFileSync(path.join(import.meta.dirname, '..', 'public/main.js'), 'utf8')

// id → what it tells the person, for the failure message.
const ANNOUNCED = {
  cuVariance: 'whether the till balances',
  posChange: 'the change due to the customer',
  rpTotal: 'the repair total',
  bkFeeBreakdown: 'the booking fee',
}

for (const [id, what] of Object.entries(ANNOUNCED)) {
  test(`#${id} is announced — it carries ${what}`, () => {
    const tag = SRC.match(new RegExp(`<[^>]*id="${id}"[^>]*>`))
      || SRC.match(new RegExp(`<[^>]*\\bid="${id}"[^>]*>`))
    assert.ok(tag, `#${id} is gone — if it was renamed, move it on this list too`)
    // Either on the element or on the row it sits in: rpTotal's role lives on
    // its wrapper, because the wrapper is what carries the whole sentence
    // ("Total: £12.00") and announcing the number alone would be worse.
    const around = SRC.slice(Math.max(0, SRC.indexOf(tag[0]) - 220), SRC.indexOf(tag[0]) + tag[0].length)
    assert.match(around, /role="status"|aria-live=/,
      `#${id} tells the person ${what} and would say it to nobody`)
  })
}

test('the customer-facing pages did not lose theirs either', () => {
  // These were right before this test existed; it is here so they stay right.
  for (const [file, least] of [['pages/portal.js', 4], ['pages/repair.js', 1], ['pages/welcome.js', 1]]) {
    const src = readFileSync(path.join(import.meta.dirname, '..', file), 'utf8')
    const n = (src.match(/role="status"/g) || []).length
    assert.ok(n >= least, `${file} has ${n} live regions, expected at least ${least}`)
  }
})
