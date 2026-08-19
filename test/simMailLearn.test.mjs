// Teaching a line a second address (owner, 19 Aug: "do the list of addresses").
//
// Ten messages could not be paired with anything. Not because the line was
// unknown — because the carrier wrote to an address the SIM did not claim. The
// shop gives a SIM a tagged address per carrier account, so one phone receives
// at gitt.bilig+a12@ from one carrier and gitt.bilig+sidner@ from another, and
// a SIM could hold only the first.
//
// The rules that matter are all about NOT being clever:
//   • one address, one line — teaching a claimed address is refused
//   • the taught address is checked the way the MATCHER checks it, not by
//     string compare, or the refusal would not mean what it says
//   • it comes off again, because a wrong one files a stranger's mail silently
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildSimIndex, matchSimForMail, mailboxKey, addressTag } from '../lib/simMailMatch.mjs'

const API = readFileSync(new URL('../pages/api/sim-mail.js', import.meta.url), 'utf8')
const MAIN = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')

const learnOp = () => {
  const m = API.match(/if \(op === 'learn'\) \{[\s\S]*?\n    \}\n/)
  assert.ok(m, "the 'learn' op is missing from the endpoint")
  return m[0]
}
const forgetOp = () => {
  const m = API.match(/if \(op === 'forgetAddress'\) \{[\s\S]*?\n    \}\n/)
  assert.ok(m, "the 'forgetAddress' op is missing from the endpoint")
  return m[0]
}

// ---------- what the whole thing is for ----------

test('a taught address pairs the next message on its own', () => {
  // Before: the SIM holds one address, and mail to the other is unmatchable.
  const before = buildSimIndex([{ id: 'sim-1', email: 'gitt.bilig+a12@gmail.com', simNumber: '' }])
  assert.equal(matchSimForMail({ to: 'gitt.bilig+sidner@gmail.com' }, before).simId, null)

  // After: the same message files itself, with no human in the loop.
  const after = buildSimIndex([{
    id: 'sim-1', email: 'gitt.bilig+a12@gmail.com',
    altEmails: ['gitt.bilig+sidner@gmail.com'], simNumber: '',
  }])
  const hit = matchSimForMail({ to: 'gitt.bilig+sidner@gmail.com' }, after)
  assert.equal(hit.simId, 'sim-1')
  assert.equal(hit.confidence, 'address')
})

// ---------- one address, one line ----------


test('the clash check sees through Gmail dots, as the matcher does', () => {
  // Two spellings, one mailbox. A string compare would call these different
  // and let both lines claim what Gmail delivers to one place.
  assert.equal(mailboxKey('red.far.bilig+x@gmail.com'), mailboxKey('redfarbilig+x@gmail.com'))
  const idx = buildSimIndex([{ id: 'sim-a', email: 'red.far.bilig+x@gmail.com', simNumber: '' }])
  const claimed = idx.byAddress.get(mailboxKey('redfarbilig+x@gmail.com')) || []
  assert.deepEqual(claimed, ['sim-a'],
    'the index must find the claim under either spelling, or the refusal is bypassable')
})





test('forgetting an address clears the cache too', () => {
  assert.match(forgetOp(), /cache = \{ at: 0, sims: null \}/,
    'a removed address would keep filing mail for another minute')
})

// The clash refusal, the raw-address rule, the duplicate check and the cache
// clear used to be asserted here, against the body of the 'learn' op. They now
// live in claimAddress, which BOTH doors call — so they are asserted against
// that function further down, and "both doors go through the same rule" is what
// keeps 'learn' bound to them. Nothing was dropped; it moved with the code.

// ---------- taking it off again ----------

test('an address can be taken off, and an unknown one is refused', () => {
  const fn = forgetOp()
  assert.match(fn, /mailboxKey\(a\) !== key/,
    'removal must normalise, or an address stored one way cannot be removed the other')
  assert.match(fn, /left\.length === have\.length/,
    'removing an address that is not there must say so, not report success')
  assert.match(fn, /404/)
})

test('forgetting an address does not unfile the mail it already matched', () => {
  // Those messages were matched on an address the shop believed at the time.
  // Un-filing them would rewrite history to match a later decision; "undo
  // match" is the per-message tool for that, on purpose.
  const fn = forgetOp()
  assert.ok(!/sim_mail/.test(fn),
    'forgetting an address must not touch the messages it already filed')
})

test('the primary address is not removable through this op', () => {
  // It is a field on the SIM form and belongs to it. Removing it here would
  // leave the form showing an address the matcher no longer uses.
  const fn = forgetOp()
  assert.ok(!/legacy_extras/.test(fn), 'forgetAddress must only touch alt_emails')
  assert.match(fn, /alt_emails: left/)
})

// ---------- the screens ----------

test('the teach button is offered only where it applies', () => {
  // On a row with candidates the answer is "pick one of these"; with no
  // recipient there is no address to teach.
  assert.match(MAIN, /m\.recipient \? `<button[^`]*cmLearn/,
    'the teach button must depend on the message having an address')
  // Sliced rather than regex-matched: the block nests its own template
  // literals, so a non-greedy match stops at the first inner one and would
  // pass over the very line being checked.
  const from = MAIN.indexOf("!settled && !m.candidates.length")
  assert.ok(from > -1, 'the no-candidates block is missing')
  const block = MAIN.slice(from, MAIN.indexOf('class="cm-actions"', from))
  assert.match(block, /cmLearn/, 'the teach button belongs on the unmatched rows')
  // And NOT on the rows that have candidates — those already have the right
  // question ("which of these?") and a second one competes with it.
  const picker = MAIN.slice(MAIN.indexOf('function cmPickHtml'), from)
  assert.ok(!/cmLearn\(/.test(picker), 'the teach button must not appear where candidates do')
})

test('the picker makes you type before it lists anything', () => {
  // 797 lines. Offering the first twenty in database order invites picking
  // whichever is on top, on a screen where a wrong pick files one customer's
  // carrier mail onto another's line.
  const fn = MAIN.match(/function cmLearnPaint\(term\) \{[\s\S]*?\n\}/)
  assert.ok(fn, 'cmLearnPaint is missing')
  assert.match(fn[0], /if \(!q\) \{/, 'an empty search must list nothing')
  assert.match(fn[0], /Start typing/)
})

test('teaching asks first, and says which line it will file on', () => {
  const fn = MAIN.match(/async function cmLearnPick\(simLegacyId\) \{[\s\S]*?\n\}/)
  assert.ok(fn, 'cmLearnPick is missing')
  assert.match(fn[0], /if \(!\(await kcConfirm\(\{[\s\S]*?\}\)\)\) return;/,
    'this writes to a customer record — the confirmation must be able to stop it')
  assert.ok(fn[0].indexOf('kcConfirm') < fn[0].indexOf("op: 'learn'"),
    'it must ask before it writes, not after')
  assert.match(fn[0], /op: 'learn'/)
  // The 409 ("another line claims it") is the message that matters most, so it
  // must reach the person rather than becoming a generic "try again".
  assert.match(fn[0], /e\.message/, 'the reason for a refusal must be shown')
})

test('removing an address from the SIM card asks first', () => {
  const fn = MAIN.match(/async function simForgetAddress\(simLegacyId, address\) \{[\s\S]*?\n\}/)
  assert.ok(fn, 'simForgetAddress is missing')
  // The confirm must GATE the call, not merely be present. Asserting the word
  // appears passes a version that asks and then goes ahead regardless — which
  // is exactly the bug worth catching on a write to a customer record.
  assert.match(fn[0], /if \(!\(await kcConfirm\(\{[\s\S]*?\}\)\)\) return;/,
    'the confirmation must be able to stop it')
  assert.ok(fn[0].indexOf('kcConfirm') < fn[0].indexOf("op: 'forgetAddress'"),
    'it must ask before it writes, not after')
  assert.match(fn[0], /op: 'forgetAddress'/)
})

test('the SIM card shows the taught addresses, and only those are removable', () => {
  const fn = MAIN.match(/function paintSimAddresses\(simLegacyId, addresses\) \{[\s\S]*?\n\}/)
  assert.ok(fn, 'paintSimAddresses is missing')
  assert.match(fn[0], /chip\(primary, false\)/, 'the primary address must not be removable here')
  assert.match(fn[0], /alt\.map\(a => chip\(a, true\)\)/, 'taught addresses must be removable')
})

// ---------- the tag is a hint, and only a hint ----------

test('the tag is lifted out of the address, header form and all', () => {
  assert.equal(addressTag('gitt.bilig+sidner@gmail.com'), 'sidner')
  assert.equal(addressTag('Gitt Bilig <gitt.bilig+z.e.fried@gmail.com>'), 'z.e.fried')
  // No tag, no address, no argument — all the same empty answer, so the caller
  // has one case to handle rather than three.
  assert.equal(addressTag('gitt.bilig@gmail.com'), '')
  assert.equal(addressTag('rubbish'), '')
  assert.equal(addressTag(null), '')
  assert.equal(addressTag(undefined), '')
})

test('the tag is never used to file anything', () => {
  // It is right often enough to be worth typing into a search box and wrong
  // often enough to be dangerous: on the real queue +v7@ and +2@ name nobody,
  // and +rapaport1@ names eight different customers. So the matcher must not
  // see it at all — a SIM is found by a registered address or not at all.
  const idx = buildSimIndex([{ id: 'sim-1', email: 'someone.else@gmail.com', simNumber: '' }])
  const hit = matchSimForMail({ to: 'gitt.bilig+sidner@gmail.com' }, idx)
  assert.equal(hit.simId, null, 'a tag must never file a message on its own')

  const api = API.slice(API.indexOf("if (op === 'learn')"))
  assert.ok(!/addressTag/.test(api.slice(0, api.indexOf("\n    }\n"))),
    'the teach op must not consult the tag — a person decides')
})

test('the picker prefills the tag but lets the first keystroke replace it', () => {
  const fn = MAIN.match(/function cmLearn\(id\) \{[\s\S]*?\n\}/)
  assert.ok(fn, 'cmLearn is missing')
  assert.match(fn[0], /cmLearnFilter = String\(m\.recipientTag \|\| ''\)/,
    'the tag should be offered as the search term')
  assert.match(fn[0], /box\.select\(\)/,
    'the prefill is a guess — typing must replace it, not append to it')
})

test('a tag that matches nobody says so, rather than looking broken', () => {
  const fn = MAIN.match(/function cmLearnPaint\(term\) \{[\s\S]*?\n\}/)
  assert.ok(fn, 'cmLearnPaint is missing')
  assert.match(fn[0], /only the tag from the address/,
    'a prefilled search that finds nothing must explain why')
})

// ── typing the address in, rather than waiting for mail to go missing ──────
//
// Teaching from the queue only works once a message has ALREADY failed to
// pair: it has to arrive at an unclaimed address, be missed, and be found by a
// person. When the shop opens a second carrier account it knows the address
// that day. Both doors must obey the same rule, or the one nobody wrote a test
// for becomes the way to create the ambiguity the matcher exists to refuse.

const claimFn = () => {
  const m = API.match(/async function claimAddress\(target, address\) \{[\s\S]*?\n\}/)
  assert.ok(m, 'claimAddress is missing')
  return m[0]
}
const addOp = () => {
  const m = API.match(/if \(op === 'addAddress'\) \{[\s\S]*?\n    \}\n/)
  assert.ok(m, "the 'addAddress' op is missing from the endpoint")
  return m[0]
}

test('both doors go through the same rule', () => {
  // If either one grew its own copy of the checks they would drift, and the
  // weaker one would be the way in.
  const learn = learnOp()
  assert.match(learn, /await claimAddress\(target, address\)/,
    'teaching from a message must use the shared rule')
  assert.match(addOp(), /await claimAddress\(target, address\)/,
    'typing an address in must use the shared rule')
  // And neither may re-implement the clash check itself.
  assert.ok(!/byAddress\.get\(key\)/.test(learn), 'the learn op has its own copy of the clash check')
  assert.ok(!/byAddress\.get\(key\)/.test(addOp()), 'the add op has its own copy of the clash check')
})

test('the shared rule refuses a claimed address, a line’s own address, and rubbish', () => {
  const fn = claimFn()
  assert.match(fn, /409/, 'an address another line claims must be refused')
  assert.match(fn, /String\(sid\) !== String\(target\.id\)/,
    'a line would collide with itself and re-adding would be impossible')
  assert.match(fn, /mailboxKey\(target\.email\) === key/,
    'a line’s own main address must not also be recorded as an extra')
  assert.match(fn, /if \(!key\) return \{ status: 400/, 'anything that is not an address must be refused')
  // Same index the matcher uses, so the refusal means what the matcher does.
  assert.match(fn, /dir\.index\.byAddress\.get\(key\)/)
})

test('adding an address twice does not duplicate it', () => {
  const fn = claimFn()
  assert.match(fn, /have\.some\(\(a\) => mailboxKey\(a\) === key\)/,
    'the duplicate check must normalise, or one mailbox lands in the list twice')
  assert.match(fn, /already: true/, 'a repeat must report itself as a no-op, not as an addition')
})

test('the shared rule clears the directory cache', () => {
  assert.match(claimFn(), /cache = \{ at: 0, sims: null \}/,
    'a newly added address would be invisible to the next message for up to a minute')
})

test('the address is stored as typed, not as the routing key', () => {
  const fn = claimFn()
  assert.match(fn, /\[\.\.\.have, String\(address\)\.trim\(\)\]/,
    'the raw address must be stored — the key has Gmail’s dots stripped and is not an address anybody typed')
})

test('the editor asks for an email, not a phone number', () => {
  // kcPrompt was built for phone numbers and hardcoded type/inputmode="tel".
  // Reused as-is it would put a numeric keypad under an email field on a
  // phone, which is a prompt people mistype into.
  const fn = MAIN.match(/async function simAddAddress\(simLegacyId\) \{[\s\S]*?\n\}/)
  assert.ok(fn, 'simAddAddress is missing')
  assert.match(fn[0], /type: 'email', inputmode: 'email'/)
  assert.match(fn[0], /op: 'addAddress'/)
  assert.match(fn[0], /e\.message/, 'the reason for a refusal must reach the person')
})

test('kcPrompt still defaults to a phone keypad for everybody else', () => {
  // Every existing caller asks for a number. Changing the default under them
  // would be a silent regression on screens this change never touched.
  const m = MAIN.match(/function kcPrompt\(\{[\s\S]*?\}\) \{/)
  assert.ok(m, 'kcPrompt is missing')
  assert.match(m[0], /type = 'tel', inputmode = 'tel'/)
})

test('the add control sits with the list it edits', () => {
  const fn = MAIN.match(/function paintSimAddresses\(simLegacyId, addresses\) \{[\s\S]*?\n\}/)
  assert.ok(fn, 'paintSimAddresses is missing')
  assert.match(fn[0], /simAddAddress\(/, 'adding belongs beside removing, not on another screen')
})
