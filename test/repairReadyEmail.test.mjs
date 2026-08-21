// "Your iPhone 12 is ready to collect" — the email, not just the text draft.
//
// The builder and its tests shipped on 21 Aug with the other receipt kinds
// (pages/api/email.js buildRepair, ready:true) and nothing called it: the
// repairs screen offered a 💬 SMS draft on a Ready job and no ✉️. A builder
// nothing calls is the same fault as a column nothing reads — it looks done and
// is not, and it was flagged as such in the message that shipped it rather than
// left to be discovered.
//
// The other half of this file is the send path. Confirming, warning about the
// shop's own carrier-login addresses, branching HOLD and TEST off before
// claiming a send, and putting the button back on failure had been written out
// once and was about to be written a second time.
import test from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.join(import.meta.dirname, '..')
const SRC = readFileSync(path.join(ROOT, 'public/main.js'), 'utf8')
const fnBody = (name) => {
  const i = SRC.indexOf(name)
  assert.ok(i > 0, `${name} not found`)
  return SRC.slice(i, SRC.indexOf('\n}\n', i))
}

const send = fnBody('async function kcSendReceipt(btn, customerId, opts)')
const ready = fnBody('async function emailRepairReady(btn, repairId)')
const ledger = fnBody('async function emailLedgerReceipt(btn, customerId, idx)')

// ── the button exists at all ───────────────────────────────────────────────

test('a Ready repair offers the email beside the text draft', () => {
  assert.match(SRC, /emailRepairReady\(this, '\$\{escHtml\(r\.id\)\}'\)/)
  // Both live behind the same status test — a job still in progress must not
  // offer to tell somebody it is done.
  const row = SRC.slice(SRC.indexOf("r.status === 'Ready' ? `<button"), SRC.indexOf('openRemindModal(\'repair\''))
  assert.match(row, /openRepairSmsModal/, 'the SMS draft should still be there')
  assert.match(row, /emailRepairReady/)
  assert.equal((SRC.match(/emailRepairReady\(/g) || []).length, 2,
    'declared once, called once')
})

test('it sends the FINISHED email, not the booked-in one', () => {
  assert.match(ready, /kind: 'repair', ready: true/)
  // ready:true is what turns "Estimate" into "Total" and changes the subject;
  // buildRepair is tested for that in receiptKinds.test.mjs.
  assert.match(ready, /ref: String\(r\.id \|\| ''\)/,
    'without a ref, re-sending mints a second Checkout session')
})

test('it carries the work and the total from the job itself', () => {
  assert.match(ready, /device: r\.device \|\| ''/)
  assert.match(ready, /services: \(r\.services \|\| \[\]\)\.map\(x => x\.name \|\| x\)\.join\(', '\)/)
  assert.match(ready, /total: Number\(r\.total\) \|\| 0/)
})

test('a repair that is not in the list is a refusal, not a crash', () => {
  assert.match(ready, /if \(!r\) \{ toast\([^)]*'error'\); return; \}/)
})

// ── the shared send path ───────────────────────────────────────────────────

test('the recipient is named in the dialog, because that is the mistake worth catching', () => {
  assert.match(send, /Sends \$\{opts\.what\} to \$\{/)
  assert.match(send, /the address on this customer’s record/,
    'no address on file still has to say where it would go')
  assert.match(send, /An email cannot be unsent/)
})

test('it warns when the address on file is one of OURS', () => {
  // Some customer rows carry a carrier login (Lebara etc.) instead of the
  // customer's own address; sending there mails the shop.
  assert.match(send, /const ours = to && isOwnAccountEmail\(to\)/)
  assert.match(send, /shop account login, not the customer’s own address/)
})

test('HOLD and TEST are branched off before anything claims to have sent', () => {
  const held = send.indexOf('res.held')
  const redirected = send.indexOf('res.redirected')
  const success = send.indexOf('toast(`Emailed to')
  assert.ok(held > 0 && redirected > 0 && success > 0, 'shape changed')
  assert.ok(held < success && redirected < success,
    'the success toast must be unreachable for a held or redirected send')
  // And a held send must not be logged against the customer as sent.
  const heldBranch = send.slice(held, redirected)
  assert.doesNotMatch(heldBranch, /recordComm/)
})

test('a refusal at the dialog sends nothing and reports nothing', () => {
  const guard = send.indexOf('if (!(await kcConfirm')
  const fetchAt = send.indexOf('kcFetch(')
  assert.ok(guard > 0 && guard < fetchAt, 'the confirm must come first')
  assert.match(send, /\)\)\) return false;/)
})

test('the button comes back on failure, and is not left saying "…"', () => {
  assert.match(send, /const restore = \(\) => \{ if \(btn\) \{ btn\.disabled = false; btn\.textContent = idle; \} \}/)
  const fail = send.slice(send.indexOf("toast(res?.error"))
  assert.match(fail, /restore\(\)/)
})

// ── one path, not three ────────────────────────────────────────────────────

test('the wallet row and the repair use the same sender', () => {
  assert.match(ledger, /await kcSendReceipt\(btn, customerId,/)
  assert.match(ready, /await kcSendReceipt\(btn, r\.customerId,/)
  // Neither re-implements the gate branches.
  for (const [name, body] of [['emailLedgerReceipt', ledger], ['emailRepairReady', ready]]) {
    assert.doesNotMatch(body, /res\.held|res\.redirected|isOwnAccountEmail/,
      `${name} has grown its own copy of the send path again`)
  }
})

test('customerId is put on the payload by the sender, once', () => {
  // Every caller used to spell it into its own body object; one forgetting it
  // would have sent a receipt with no customer for the server to resolve.
  assert.match(send, /body: JSON\.stringify\(\{ \.\.\.opts\.body, customerId \}\)/)
  assert.doesNotMatch(ledger, /customerId,\s*\n?\s*(amount|lines):/)
})
