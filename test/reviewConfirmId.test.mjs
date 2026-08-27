// The confirm button on the customer card, and the id it sends.
//
// Shloime, testing on 27 August: pressing "unconfirmed — confirm?" on a
// customer card answered "Could not confirm that — nothing was changed." every
// time. He pressed it twice; the screenshot has two toasts.
//
// There are two kinds of customer id in this app. The row uuid, and `legacy_id`
// — which is what the UI calls a customer id and what it deep-links with
// (lib/bankCandidates.mjs says so in as many words). TEN endpoints look a
// customer up by legacy_id. pages/api/review.js was the only one matching on
// `id`, so:
//
//   Confirm Data screen  → sends bundle.id, a uuid  → matched → worked
//   Customer card        → sends customer.id, legacy → matched nothing → 404
//
// A 404 on an update that matched no rows is indistinguishable from "that
// record is not waiting to be confirmed", which is why the message was
// confident and wrong.
import test from 'node:test'
import assert from 'node:assert'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.join(import.meta.dirname, '..')
const SRC = readFileSync(path.join(ROOT, 'pages/api/review.js'), 'utf8')
const CODE = SRC.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')

test('the confirm route accepts a legacy customer id, not only a uuid', () => {
  assert.match(CODE, /legacy_id.*=eq\.|isUuid \? 'id' : 'legacy_id'/,
    'the card sends legacy_id — matching only on `id` is how this 404d')
})

test('it resolves to the row uuid before stamping the attached records', () => {
  // sims/bookings/virtual_numbers hold a uuid foreign key. Stamping them with
  // whatever id arrived would quietly confirm nothing.
  assert.match(CODE, /customer_id=eq\.\$\{enc\(uuid\)\}/,
    'the attached tables must be updated by uuid whichever id came in')
})

test('confirming something already confirmed is not an error', () => {
  // A person pressing confirm on a record that is already vouched for has the
  // outcome they wanted. An error toast there is the app arguing with somebody
  // who is right — which is the half of this Shloime actually complained about.
  assert.match(CODE, /row\.verified_at\)\s*return res\.json\(\{ success: true/,
    'an already-verified record must answer success, not 404')
})

test('every other customer lookup still agrees on legacy_id', () => {
  // The reason this bug was findable at all: nine other routes do it one way
  // and one did it another. If that ratio inverts, the convention has moved and
  // this test is the wrong way round.
  const api = path.join(ROOT, 'pages/api')
  const walk = (d, out = []) => {
    for (const n of readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, n.name)
      if (n.isDirectory()) walk(f, out)
      else if (n.name.endsWith('.js')) out.push(f)
    }
    return out
  }
  let byLegacy = 0
  for (const f of walk(api)) {
    const src = readFileSync(f, 'utf8')
    byLegacy += (src.match(/'customers',\s*`select=[^`]*legacy_id=eq/g) || []).length
  }
  assert.ok(byLegacy >= 8,
    `only ${byLegacy} routes look a customer up by legacy_id — the convention may have moved`)
})
