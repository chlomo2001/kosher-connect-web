// "The red parts didn't parse" — and the red parts being red.
//
// Owner, 20 August, with a screenshot: "red parts? what?!"
//
// Two faults on one card, and neither was the sentence.
//
// 1. Three of the four gaps were not red. `.tm-flight span` is (0,1,1) and
//    `.tm-gap` was (0,1,0), so every gap INSIDE the flight line — route?,
//    date?, price? — lost its colour to the muted rule above it. The three that
//    cost money were the three not marked, while "no passenger name in the
//    mail" sits outside that container and stayed red. The card named a colour
//    that most of what it pointed at did not have.
//
// 2. The sentence appeared on cards with no gaps on screen at all. A message
//    that is not a booking shows its subject instead of the route?/date?/price?
//    prompts — so on a Jet2 advert the only red thing was the sentence claiming
//    there were red things.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const CSS = readFileSync(new URL('../styles/app.css', import.meta.url), 'utf8')
const MAIN = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')

test('a gap inside the flight line is still red', () => {
  // Named explicitly rather than reordered: reordering works until somebody
  // adds a rule between the two, and then it silently stops working again.
  assert.match(CSS, /\.tm-gap,\s*\.tm-flight \.tm-gap \{[^}]*color:\s*var\(--danger-ink\)/,
    'the flight line’s gaps must out-specify the muted rule that covers that container')
  // And the rule that beat it is still there, so this is not passing because
  // the conflict was removed rather than resolved.
  assert.match(CSS, /\.tm-flight span \{[^}]*color:\s*var\(--muted\)/,
    'the muted rule is gone — then this test no longer proves anything')
})

test('the sentence only appears where the gaps are on screen', () => {
  assert.match(MAIN, /t\.bookable !== false && t\.missing\.length\s*\n?\s*\?\s*`<div class="tm-missing">The red parts/,
    'the footnote must be gated on the row actually showing its gaps')
})

test('a non-booking shows its subject instead of the prompts', () => {
  // The half that was already right, held so the fix above cannot be "simplified"
  // by making every card show route?/date?/price? again.
  assert.match(MAIN, /t\.bookable === false[\s\S]{0,400}?<div class="tm-pax">\$\{escHtml\(t\.subject/,
    'a message that is not a booking must not be asked to fill in a flight')
})

test('the neutral notes stay neutral', () => {
  // A check-in reminder is information, not a fault. If .tm-note ever took the
  // danger colour, every card would read as a problem and the red would stop
  // meaning anything — which is the same failure as this bug, inverted.
  assert.match(CSS, /\.tm-note \{[^}]*color:\s*var\(--muted\)/)
})
