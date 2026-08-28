// The wizard stepper, and the two promises it has to keep.
//
// BACKLOG.md filed this under "Owner-held — do not start without a decision",
// with the reason: "The component is loop-eligible; adopting it per flow is
// judgement, because a stepper on a flow staff already do fast is a cost, not a
// help." The owner chose New Booking and New Rental on 28 Aug. The measurements
// that framed the choice: New Booking is 27 fields over 2.5 screens at 390px,
// New Rental 18 fields over 1.6.
//
// Two things make it a help rather than a cost, and both are testable here:
//
//   1. IT CANNOT CHANGE WHAT IS SAVED. Every field stays in the DOM with its id
//      and its value on every step — the stepper only sets `hidden`. So the save
//      functions read exactly what they always read.
//   2. NEXT NEVER REFUSES. A Next button that blocks stops someone filling a
//      form in the order the customer is talking, which is precisely the cost
//      the backlog warned about. The guard sits at the end instead: a save that
//      fails routes to the step and the field it is complaining about.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const SRC = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')
const CSS = readFileSync(new URL('../styles/app.css', import.meta.url), 'utf8')
const MANUAL = readFileSync(new URL('../lib/manual.mjs', import.meta.url), 'utf8')

const fn = (name) => {
  const m = SRC.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`))
  assert.ok(m, `${name} is gone`)
  return m[0]
}

test('both flows the owner chose are stepped, and nothing else was', () => {
  assert.match(SRC, /const BOOKING_STEPS = \[/)
  assert.match(SRC, /const RENTAL_STEPS = \[/)
  const calls = SRC.match(/kcStepInit\([A-Z_]+\)/g) || []
  assert.deepEqual(calls.sort(), ['kcStepInit(BOOKING_STEPS)', 'kcStepInit(RENTAL_STEPS)'],
    'a third flow was adopted without a decision, or one of the two lost its stepper')
})

test('the steps are named for where the answers come from', () => {
  const b = SRC.match(/const BOOKING_STEPS = \[([\s\S]*?)\]/)[1]
  const r = SRC.match(/const RENTAL_STEPS = \[([\s\S]*?)\]/)[1]
  const titles = (s) => [...s.matchAll(/title: '([^']+)'/g)].map((m) => m[1])
  assert.deepEqual(titles(b), ['Who', 'The flight', 'Money', 'Before they fly'])
  assert.deepEqual(titles(r), ['Phone and dates', 'What goes with it', 'Money and terms'])
})

test('every group in both forms belongs to a step', () => {
  // A group with no data-step is hidden by nothing and shows on every step,
  // which reads as the form leaking between pages.
  for (const [open, close, steps] of [
    ['function openNewBookingModal', 'function bkCalcFee', 4],
    ['function openNewRentalModal', 'function updateRentalPhoneInfo', 3],
  ]) {
    const body = SRC.slice(SRC.indexOf(open), SRC.indexOf(close))
    const grid = body.slice(body.indexOf('<div class="form-grid">'), body.indexOf('<div class="modal-actions">'))
    // #rVNSection is itself a step member and holds a nested form-grid; its
    // three groups are carried by the parent and need no step of their own.
    const flat = grid.replace(/<div id="rVNSection"[\s\S]*?\n      <\/div>/, '')
    const groups = [...flat.matchAll(/<div class="form-group[^"]*"([^>]*)>/g)]
    const orphans = groups.filter((g) => !/data-step="\d"/.test(g[1]))
    assert.deepEqual(orphans.map((o) => o[0].slice(0, 60)), [], `${open}: group with no step`)
    const used = new Set([...grid.matchAll(/data-step="(\d)"/g)].map((m) => Number(m[1])))
    for (let i = 1; i <= steps; i++) assert.ok(used.has(i), `${open}: step ${i} has no fields on it`)
  }
})

test('the stepper only ever hides — it never removes a field', () => {
  const go = fn('kcStepGo')
  assert.match(go, /el\.hidden = Number\(el\.dataset\.step\) !== i \+ 1/)
  // The things that would break promise 1.
  assert.doesNotMatch(go, /\.remove\(\)|innerHTML|removeChild|\.value\s*=/,
    'the stepper is touching the form, not just its visibility')
})

test('Next does not refuse', () => {
  // No validation on the way forward. If this ever grows one, the backlog's
  // objection to the whole component comes back with it.
  const next = fn('kcStepNext')
  assert.match(next, /kcStepGo\(kcStep\.i \+ 1\)/)
  assert.doesNotMatch(next, /toast|return false|valid/i, 'Next has grown a guard')
})

test('every step is reachable in both directions from the first moment', () => {
  // The rail is navigation, not just progress: each step is its own button and
  // none of them is disabled by how far you have got.
  const html = fn('kcStepsHtml')
  assert.match(html, /<button type="button" class="kc-step-btn" data-go="\$\{i\}" onclick="kcStepGo\(\$\{i\}\)">/)
  assert.doesNotMatch(html, /disabled/, 'a step button is disabled, so the rail is one-way')
})

test('a refused save takes you to the field it is about', () => {
  // Every check that can stop a save names its field first. These are the exact
  // lines; if a new check is added without one, the person is left hunting.
  for (const id of ['rCustomer', 'rPhoneSearch', 'bkCustomer', 'bkRoute', 'bkTravelDate', 'bkPrice', 'bkReturnDate']) {
    assert.match(SRC, new RegExp(`kcStepReveal\\('${id}'\\)`), `${id} has no route to it`)
  }
  // Both rental save paths, not only the single-phone one.
  assert.equal((SRC.match(/kcStepReveal\(!from \? 'rFrom' : 'rTo'\)/g) || []).length, 2,
    'the multi-phone rental path does not route its date complaint')
})

test('a picker\'s hidden input is not what gets focused', () => {
  // bkCustomer and rCustomer are hidden inputs behind a search box, and they
  // are the two fields most likely to be the missing one. Focusing a hidden
  // input silently does nothing, which would leave the cursor where it was.
  const reveal = fn('kcStepReveal')
  assert.match(reveal, /n\.type !== 'hidden'/)
  assert.match(reveal, /offsetParent !== null/)
})

test('a plain dialog cannot inherit the last wizard', () => {
  assert.match(SRC, /kcStep = null;\s+\/\/ this dialog is not a wizard until it says it is/)
})

test('the save buttons belong to the last step', () => {
  assert.match(fn('kcStepGo'), /querySelectorAll\('\[data-step-final\]'\)\) el\.hidden = i !== steps\.length - 1/)
  assert.ok((SRC.match(/data-step-final/g) || []).length >= 5,
    'the saves and the wallet-charge note should all be marked final')
})

test('where you are is not said by colour alone', () => {
  // WCAG 1.4.1. The current step carries aria-current and extra weight; a
  // finished one swaps its numeral for a tick.
  assert.match(fn('kcStepGo'), /setAttribute\('aria-current', 'step'\)/)
  assert.match(CSS, /\.kc-step-btn\.is-on \{[^}]*font-weight: 600/)
  assert.match(CSS, /\.kc-step-btn\.is-done \.kc-step-n::after \{[\s\S]*?content: "\\2713"/)
})

test('a step button is a 44x44 target where the pointer is coarse', () => {
  // WCAG 2.5.5 AAA, which this repo holds itself to on the counter surfaces.
  const coarse = CSS.match(/@media \(pointer: coarse\) \{\s*\.kc-step-btn \{([^}]*)\}/)
  assert.ok(coarse, 'no coarse-pointer rule for the step buttons')
  assert.match(coarse[1], /min-height: 44px/)
})

test('the manual describes both forms as stepped', () => {
  assert.match(MANUAL, /Starts a hire, in three steps/)
  assert.match(MANUAL, /The ticket, in four steps/)
  assert.match(MANUAL, /Next never refuses/)
})
