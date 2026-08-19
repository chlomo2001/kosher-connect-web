// Charge and Park follow the basket (owner, 20 August).
//
// They used to sit lit on an empty till, and the only answer to pressing one
// was an error toast — which on a busy counter reads as "something went wrong",
// not as "you have not scanned anything yet". The owner chose to grey both.
//
// The guards inside saveSale and posParkSale STAY, and that is the point worth
// holding: Ctrl+Enter from the scan box calls saveSale directly and never
// touches the button, so disabling it is only the APPEARANCE. Delete the guard
// because "the button is disabled now" and the keyboard path rings up an empty
// sale.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const MAIN = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')
const GLOBALS = readFileSync(new URL('../styles/globals.css', import.meta.url), 'utf8')

test('both buttons start disabled and follow the basket from one place', () => {
  assert.match(MAIN, /id="posChargeBtn"[^>]*disabled/, 'Charge must start disabled')
  assert.match(MAIN, /id="posParkBtn"[\s\S]{0,200}?disabled/, 'Park must start disabled')
  const fn = MAIN.match(/function posSyncActionButtons\(\) \{[\s\S]*?\n\}/)
  assert.ok(fn, 'posSyncActionButtons is missing')
  assert.match(fn[0], /posBasket\.length > 0/)
  assert.match(fn[0], /charge\.disabled = !has/)
  assert.match(fn[0], /park\.disabled = !has/)
  // Painting the basket is what drives it.
  assert.match(MAIN, /function posRenderBasket\(\) \{[\s\S]{0,200}posSyncActionButtons\(\)/)
})

test('the keyboard guards stay — disabling a button is not a rule', () => {
  // Ctrl+Enter reaches saveSale without the button existing at all.
  assert.match(MAIN, /async function saveSale\(\) \{\s*\n\s*if \(!posBasket\.length\)/,
    'saveSale must still refuse an empty basket itself')
  assert.match(MAIN, /function posParkSale\(silent\) \{\s*\n\s*if \(!posBasket\.length\)/,
    'posParkSale must still refuse an empty basket itself')
})

test('coming out of a card charge, the basket decides — not the charge routine', () => {
  // A sale that succeeded has just emptied the basket, so blindly re-enabling
  // after the card machine replies would light Charge back up on an empty till.
  const fn = MAIN.match(/const setCharging = \(on, label\) => \{[\s\S]*?\n  \};/)
  assert.ok(fn, 'setCharging is missing')
  assert.match(fn[0], /else posSyncActionButtons\(\)/,
    'leaving a charge must re-ask the basket, not assume the button should be live')
  assert.ok(!/chargeBtn\.disabled = on;/.test(fn[0]),
    'the old unconditional enable is back')
})

test('every button variant has a disabled look, not just the blue one', () => {
  // .btn-primary:disabled was styled and .btn-outline:disabled was not, so a
  // disabled Park button looked exactly like a live one — the "looks pressable
  // and isn't" problem the disabled state exists to solve, made worse.
  assert.match(GLOBALS, /\.btn:disabled \{[^}]*opacity/,
    'there must be a disabled look for every .btn, not only .btn-primary')
  assert.match(GLOBALS, /\.btn:disabled:hover/,
    'a disabled button must not light up on hover as though it were live')
})
