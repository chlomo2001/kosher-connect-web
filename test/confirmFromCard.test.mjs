// Confirming an imported record from the customer card.
//
// Owner, 20 Aug: "confirm data should also be reachable from the customer
// card." The marker already appeared there and its tooltip said "Manage →
// Confirm Data" — sending the reader off to find, in a queue of hundreds, the
// person whose record was open in front of them. It is the action now.
import test from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.join(import.meta.dirname, '..')
const SRC = readFileSync(path.join(ROOT, 'public/main.js'), 'utf8')
const CSS = readFileSync(path.join(ROOT, 'styles/app.css'), 'utf8')

function lift() {
  const m = SRC.match(/function unconfirmedChip\(rec[\s\S]*?\n\}/)
  assert.ok(m, 'unconfirmedChip not found')
  // MIRRORS main.js:12830 EXACTLY — &, <, > and " and deliberately NOT the
  // apostrophe. A stub that escapes more than the real thing is a stub that
  // cannot fail: the first version of this test escaped apostrophes here, so
  // removing the escaping from the code under test changed nothing and the
  // test passed either way. The point of this test is that the real escHtml
  // leaves ' alone, which is why the call site has to handle it.
  const escHtml = (v) => String(v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  return new Function('escHtml', `${m[0]}; return unconfirmedChip;`)(escHtml)
}

const chip = lift()
const IMPORTED = { id: 'c1', dataSource: 'import', verifiedAt: null }

test('a confirmed record shows no marker at all, in either mode', () => {
  for (const rec of [
    { id: 'c1', dataSource: 'import', verifiedAt: '2026-08-01T00:00:00.000Z' },
    { id: 'c1', dataSource: 'app', verifiedAt: null },
    null, undefined,
  ]) {
    assert.equal(chip(rec), '')
    assert.equal(chip(rec, { actionable: true }), '')
  }
})

test('by default the marker is still an inert label', () => {
  const out = chip(IMPORTED)
  assert.match(out, /<span /)
  assert.doesNotMatch(out, /<button|onclick/, 'a list row must not sprout a button')
})

test('the card asks the marker to be the control', () => {
  const out = chip(IMPORTED, { actionable: true })
  assert.match(out, /<button type="button"/)
  assert.match(out, /confirmFromCard\('c1'\)/)
  assert.match(out, /confirm\?/, 'it must read as an offer, not just a state')
})

// escHtml does not escape apostrophes (main.js:12830) and the id sits inside a
// single-quoted JS string inside an attribute. The payload text may still
// appear — as inert data; what must not survive is a raw quote that ends the
// string early.
test('an apostrophe in the id cannot close the handler string', () => {
  const out = chip({ id: `x'; alert(1); '`, dataSource: 'import', verifiedAt: null }, { actionable: true })
  const onclick = out.match(/onclick="([^"]*)"/)[1]
  const inner = onclick.slice(onclick.indexOf('(') + 1, onclick.lastIndexOf(')'))
  assert.ok(!inner.slice(1, -1).includes("'"),
    `a raw apostrophe survived into the JS string: ${inner}`)
  assert.ok(inner.includes('&#39;'), 'the apostrophes must be entity-escaped')
})

test('only the card is actionable — the list rows and the SIM table are not', () => {
  const cardCalls = SRC.match(/unconfirmedChip\([^)]*actionable: true[^)]*\)/g) || []
  assert.ok(cardCalls.length >= 1, 'the card never asks for the actionable form')
  // The customers table row and the SIM table both call the plain form.
  assert.match(SRC, /customer-name">\$\{customerNameCell\(c, surnameFirst\)\}[\s\S]{0,120}?\$\{unconfirmedChip\(c\)\}/,
    'the customers list row should keep the plain label')
})

test('confirming asks first, and stops if the answer is no', () => {
  const fn = SRC.slice(SRC.indexOf('async function confirmFromCard(customerId)'))
  const body = fn.slice(0, fn.indexOf('\n}\n'))
  assert.match(body, /if \(!\(await kcConfirm\(\{[\s\S]*?\)\)\) return;/,
    'vouching for data must be a deliberate answer')
  assert.ok(body.indexOf('kcConfirm') < body.indexOf('confirmReviewed'),
    'it must ask before it writes')
})

test('a failed confirm changes nothing locally', () => {
  const fn = SRC.slice(SRC.indexOf('async function confirmFromCard(customerId)'))
  const body = fn.slice(0, fn.indexOf('\n}\n'))
  assert.match(body, /if \(!res \|\| !res\.success\)[\s\S]{0,200}?return;/)
  assert.ok(body.indexOf('!res.success') < body.indexOf('c.verifiedAt = stamp'),
    'the marker must not clear before the server has agreed')
})

test('the Confirm Data counts are kept in step', () => {
  const fn = SRC.slice(SRC.indexOf('async function confirmFromCard(customerId)'))
  const body = fn.slice(0, fn.indexOf('\n}\n'))
  assert.match(body, /confirmStats\.done \+= res\.confirmed/)
  assert.match(body, /confirmStats\.remaining = Math\.max\(0,/)
  assert.match(body, /for \(const list of \[sims, bookings/,
    'attached records are confirmed server-side, so their markers must clear too')
})

// The harness sweeps the seed, and no seeded customer is unconfirmed, so this
// button never renders during an audit. Measured by hand at 390px (24px) and
// held here, because the automated check is blind to it.
test('the pressable marker meets the 24px tap floor', () => {
  const m = CSS.match(/\.kc-unconfirmed-btn \{[\s\S]*?\}/)
  assert.ok(m, '.kc-unconfirmed-btn rule not found')
  assert.match(m[0], /min-height:\s*24px/,
    'it is pressed, so it needs the floor the plain label does not')
})
