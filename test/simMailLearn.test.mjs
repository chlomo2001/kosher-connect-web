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
import { buildSimIndex, matchSimForMail, mailboxKey } from '../lib/simMailMatch.mjs'

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

test('teaching an address another line already claims is refused', () => {
  const fn = learnOp()
  assert.match(fn, /409/, 'a clash must be refused, not merged')
  assert.match(fn, /byAddress\.get\(key\)/,
    'the clash check must ask the matcher index, not compare strings')
  // The refusal must ignore the SIM being taught — re-teaching a line its own
  // address is a no-op, not a conflict with itself.
  assert.match(fn, /String\(sid\) !== String\(target\.id\)/,
    'a line would collide with itself and re-teaching would be impossible')
})

test('the clash check sees through Gmail dots, as the matcher does', () => {
  // Two spellings, one mailbox. A string compare would call these different
  // and let both lines claim what Gmail delivers to one place.
  assert.equal(mailboxKey('red.far.bilig+x@gmail.com'), mailboxKey('redfarbilig+x@gmail.com'))
  const idx = buildSimIndex([{ id: 'sim-a', email: 'red.far.bilig+x@gmail.com', simNumber: '' }])
  const claimed = idx.byAddress.get(mailboxKey('redfarbilig+x@gmail.com')) || []
  assert.deepEqual(claimed, ['sim-a'],
    'the index must find the claim under either spelling, or the refusal is bypassable')
})

test('the address is stored as written, not as the routing key', () => {
  // The key has Gmail's dots stripped; storing it would put an address on the
  // record that nobody typed and that reads as a typo on screen.
  const fn = learnOp()
  assert.match(fn, /alt_emails: \[\.\.\.have, address\]/,
    'the raw address must be stored, not the normalised key')
  assert.ok(!/alt_emails: \[\.\.\.have, key\]/.test(fn))
})

test('a line is not taught the same address twice', () => {
  const fn = learnOp()
  assert.match(fn, /have\.some\(\(a\) => mailboxKey\(a\) === key\)/,
    'the duplicate check must normalise, or one mailbox lands in the list twice')
})

// ---------- the cache that would undo the whole feature ----------

test('learning clears the SIM directory cache', () => {
  // The directory is cached for a minute. Left stale, the very next message to
  // the address just taught comes back unmatched — the one thing this exists
  // to stop, failing silently for up to sixty seconds after every teach.
  assert.match(learnOp(), /cache = \{ at: 0, sims: null \}/,
    'the taught address would be invisible to the next message')
})

test('forgetting an address clears the cache too', () => {
  assert.match(forgetOp(), /cache = \{ at: 0, sims: null \}/,
    'a removed address would keep filing mail for another minute')
})

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
