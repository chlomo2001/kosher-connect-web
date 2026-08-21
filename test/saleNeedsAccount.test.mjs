// A sale left on account needs an account.
//
// From the Epos Now read (docs/IDEAS-EPOSNOW-2026-08-21.md, E6). Their loyalty
// docs are blunt that the customer must be picked BEFORE the sale or the sale
// is anonymous and the points are lost. KC's till has the same trap and a worse
// consequence: untick "Paid now" on a walk-in and the charge posts against the
// built-in Walk-in customer — a debt belonging to nobody, on a record nobody
// opens, which cannot be chased and cannot be moved onto a person afterwards.
// A sale is saved once; there is no way back.
//
// It has NOT happened: the walkin account's six ledger rows net to £0.00 as of
// 21 Aug. This is the guard, not the repair.
import test from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.join(import.meta.dirname, '..')
const SRC = readFileSync(path.join(ROOT, 'public/main.js'), 'utf8')
const API = readFileSync(path.join(ROOT, 'pages/api/shop.js'), 'utf8')

const saveSale = (() => {
  const i = SRC.indexOf('async function saveSale() {')
  assert.ok(i > 0, 'saveSale not found')
  return SRC.slice(i, SRC.indexOf('\n}\n', i))
})()

test('the till refuses an unpaid walk-in, and says what to do about it', () => {
  assert.match(saveSale, /if \(!paidNow && \(!custNow \|\| custNow === 'walkin'\)\)/)
  assert.match(saveSale, /needs a customer/)
  assert.match(saveSale, /Pick who it is, or tick "Paid now"/,
    'a refusal that does not say the way out is a dead end')
  assert.match(saveSale, /'error'/, 'this is a refusal, not a note')
})

test('it puts the cursor where the fix is', () => {
  assert.match(saveSale, /posCustomer_search'\)\?\.focus\(\)/,
    'the operator has a queue; do not make them hunt for the box')
})

test('the guard runs before anything is written', () => {
  // Before the idempotency token, before the terminal, before stock moves.
  const guard = saveSale.indexOf("custNow === 'walkin'")
  for (const later of ['kcBeginWrite', 'posSaleRef = kcRef()', 'PAY-SALE-']) {
    const at = saveSale.indexOf(later)
    assert.ok(at > guard, `${later} happens before the guard — a refused sale would still have side effects`)
  }
})

test('a PAID walk-in is untouched — that is the normal counter sale', () => {
  // The trap is unpaid-and-anonymous. Cash over the counter with no customer is
  // most of what this shop does and must not grow a question.
  assert.doesNotMatch(saveSale, /custNow === 'walkin'\)\)\s*\{[\s\S]{0,200}?paidNow \)/)
  const guardLine = saveSale.split('\n').find((l) => l.includes("custNow === 'walkin'"))
  assert.match(guardLine, /!paidNow/, 'the guard must be conditional on the sale being unpaid')
})

// The browser is not the only caller.
test('the server refuses it too', () => {
  assert.match(API, /if \(b\.paidNow === false && \(!b\.customerId \|\| b\.customerId === 'walkin'\)\)/)
  assert.match(API, /needs a customer — a walk-in has no account to put it on/)
  assert.match(API, /status\(400\)/)
})

test('the server refuses before it resolves or creates anything', () => {
  const guard = API.indexOf('b.paidNow === false')
  const walkin = API.indexOf('await walkInCustomer()')
  const claim = API.indexOf('db.claimKey(`SALE-')
  assert.ok(guard > 0 && walkin > 0 && claim > 0, 'shape changed')
  assert.ok(guard < walkin, 'it would mint the walk-in customer before refusing')
  assert.ok(guard < claim, 'it would burn the idempotency key on a sale it then refuses')
})

// `paidNow === false` and not `!b.paidNow`: a caller that omits the field is
// not asserting "on account", and defaulting a missing flag into a refusal
// would break every existing paid-sale caller that never sends it.
test('an absent paidNow is not read as "on account"', () => {
  assert.match(API, /b\.paidNow === false/)
  assert.doesNotMatch(API, /if \(!b\.paidNow && \(!b\.customerId/)
})
