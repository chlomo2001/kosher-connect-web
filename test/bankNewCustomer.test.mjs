// Adding the sender of a bank row as a customer, in place.
//
// This path creates a person AND posts money to them on one click, so the
// things it decides — what the name splits into, whether the row carries an
// email worth keeping — are checked here rather than trusted to the screen.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { splitPersonName, emailFromTransaction, newCustomerDraft } from '../lib/bankNewCustomer.mjs'

const SRC = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')
function liftMirror() {
  const m = SRC.match(/\/\/ ── KC_BANKNEW mirror start ──[^\n]*\n([\s\S]*?)\n\/\/ ── KC_BANKNEW mirror end ──/)
  assert.ok(m, 'KC_BANKNEW mirror region not found in public/main.js')
  return new Function(`${m[1]}; return { splitPersonName, emailFromTransaction, newCustomerDraft };`)()
}

test('a middle name stays with the surname, not dropped', () => {
  assert.deepEqual(splitPersonName('Yechiel Chaim Halberstam'),
    { firstName: 'Yechiel', lastName: 'Chaim Halberstam' })
  assert.deepEqual(splitPersonName('Hershl H'), { firstName: 'Hershl', lastName: 'H' })
  assert.deepEqual(splitPersonName('Hershy'), { firstName: 'Hershy', lastName: '' })
})

test('blank, spaces-only and null give no first name, so nothing is created', () => {
  for (const bad of ['', '   ', '\t\n ', null, undefined]) {
    assert.equal(splitPersonName(bad).firstName, '')
    assert.equal(newCustomerDraft(bad, { description: 'a@b.com' }), null)
  }
})

test('runs of whitespace collapse rather than producing empty name parts', () => {
  assert.deepEqual(splitPersonName('  Moishe   Chaim   Samet  '),
    { firstName: 'Moishe', lastName: 'Chaim Samet' })
})

test('a Stripe row hands over the payer address, lowercased', () => {
  assert.equal(emailFromTransaction({ counterparty: 'horowits', description: 'HershlHorowits@Gmail.com' }),
    'hershlhorowits@gmail.com')
})

test('a plain bank transfer has no address to take', () => {
  assert.equal(emailFromTransaction({ counterparty: 'BLEIER S', description: 'FASTER PAYMENT REF 4471' }), '')
  assert.equal(emailFromTransaction({}), '')
  assert.equal(emailFromTransaction(null), '')
})

// The guard that matters: a reference *containing* an address is a sentence,
// not a payer's email. Filing it on the customer would put a wrong address on
// their record and teach the matcher the wrong thing for next time.
test('an address buried in a longer reference is left alone', () => {
  assert.equal(emailFromTransaction({ description: 'REF hershl@x.com pending review' }), '')
  assert.equal(emailFromTransaction({ description: 'payment from a@b.com' }), '')
})

test('the counterparty is used when the description has no address', () => {
  assert.equal(emailFromTransaction({ counterparty: 'moses@breuer.co.uk', description: 'STRIPE' }),
    'moses@breuer.co.uk')
})

test('the draft carries a display name that omits an absent surname', () => {
  assert.equal(newCustomerDraft('Hershy', {}).fullName, 'Hershy')
  assert.equal(newCustomerDraft('Hershl H', {}).fullName, 'Hershl H')
})

test('the browser copy answers exactly as the module does', () => {
  const m = liftMirror()
  const names = ['Hershl H', 'Yechiel Chaim Halberstam', '  Moishe   Chaim  Samet ', 'Hershy', '', '   ']
  const txns = [
    { counterparty: 'horowits', description: 'hershlhorowits@gmail.com' },
    { counterparty: 'BLEIER S', description: 'FASTER PAYMENT REF 4471' },
    { description: 'REF hershl@x.com pending' },
    { counterparty: 'moses@breuer.co.uk', description: 'STRIPE' },
    {},
  ]
  for (const n of names) {
    assert.deepEqual(m.splitPersonName(n), splitPersonName(n), `split ${JSON.stringify(n)}`)
    for (const t of txns) {
      assert.deepEqual(m.emailFromTransaction(t), emailFromTransaction(t))
      assert.deepEqual(m.newCustomerDraft(n, t), newCustomerDraft(n, t), `draft ${JSON.stringify(n)}`)
    }
  }
})

// Wiring guards. Each names a specific way this screen could go wrong.
test('the picker offers to create only after something has been typed', () => {
  const fn = SRC.match(/function bankPickList\(txnId\) \{[\s\S]*?\n\}/)[0]
  assert.match(fn, /bankPickCreate/, 'no create option in the no-match state')
  assert.match(fn, /:\s*!q\s*\n?\s*\?/, 'an empty box should say "type a name", not offer to create a blank customer')
})

test('creating asks before it writes, and posts only after the customer exists', () => {
  const fn = SRC.match(/async function bankPickCreate\(txnId\)[\s\S]*?\n\}/)[0]
  assert.match(fn, /if \(!\(await kcConfirm\(\{[\s\S]*?\)\)\) return;/,
    'must not create a customer and post money without confirming')
  const askAt  = fn.indexOf('kcConfirm')
  const addAt  = fn.indexOf('addCustomer')
  const postAt = fn.indexOf('bankPostMatch')
  assert.ok(askAt < addAt, 'the question must come before the customer is created')
  assert.ok(addAt < postAt, 'the payment must not post before the customer exists')
  assert.match(fn, /if \(!res \|\| !res\.success \|\| !res\.customer\)[\s\S]*?return;/,
    'a failed create must stop, not post money to nobody')
})

test('a created customer joins the picker list, so the next row finds them', () => {
  const fn = SRC.match(/async function bankPickCreate\(txnId\)[\s\S]*?\n\}/)[0]
  assert.match(fn, /bankData\.customers\.push/,
    'without this, a second payment from the same sender offers to create a duplicate')
})

test('bankConfirm still asks — the shared poster must not become the way in', () => {
  const fn = SRC.match(/async function bankConfirm\(txnId, customerId, name\)[\s\S]*?\n\}/)[0]
  assert.match(fn, /if \(!\(await kcConfirm\(\{[\s\S]*?\)\)\) return;/)
  assert.ok(fn.indexOf('kcConfirm') < fn.indexOf('bankPostMatch'))
})
