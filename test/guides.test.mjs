// The guide library is a promise: ask the app how to do the job and it tells
// you, correctly, every time. These tests hold it to that.
//
// The one that matters most is coverage — a screen with no guide is a screen
// where a helper is on their own, and that is exactly the failure the library
// exists to prevent.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GUIDES, guideTabs, matchGuides, bestGuide, guidesByScreen } from '../lib/guides.mjs'
import { ALL_TABS } from '../lib/auth.js'

test('every screen in the app has at least one guide', () => {
  const covered = new Set(guideTabs())
  const missing = ALL_TABS.filter(t => !covered.has(t))
  assert.deepEqual(missing, [], `no guide covers: ${missing.join(', ')}`)
})

test('every guide points at a real screen', () => {
  for (const g of GUIDES) {
    assert.ok(ALL_TABS.includes(g.tab), `${g.id} points at "${g.tab}", which is not a tab`)
  }
})

test('ids are unique and stable-looking', () => {
  const ids = GUIDES.map(g => g.id)
  assert.equal(new Set(ids).size, ids.length, 'two guides share an id')
  for (const id of ids) assert.match(id, /^[a-z0-9-]+$/, `${id} is not a plain slug`)
})

test('every guide is actually usable — a question, steps, and a way there', () => {
  for (const g of GUIDES) {
    assert.match(g.q, /\?$/, `${g.id}: the question should read as a question`)
    assert.ok(g.steps.length >= 3, `${g.id}: ${g.steps.length} step(s) is not a walk-through`)
    assert.ok(g.go && g.go.length > 3, `${g.id}: no label for the button that takes them there`)
    for (const s of g.steps) {
      assert.ok(s.length > 15, `${g.id}: "${s}" is too terse to help anyone`)
      // Jargon check: the steps are for someone with no training.
      assert.doesNotMatch(s, /\b(API|JSON|endpoint|payload|legacy_extras|null)\b/,
        `${g.id}: "${s}" uses developer words`)
    }
  }
})

test('the questions a person would actually type reach the right guide', () => {
  const cases = [
    ['how do I rent a phone out', 'new-rental'],
    ['someone brought the phone back', 'return-phone'],
    ['a customer wants to pay me', 'take-payment'],
    ['how do I sell a charger at the counter', 'till-sale'],
    ['set up a lebara sim', 'new-sim'],
    ['book a flight', 'new-booking'],
    ['broken screen repair', 'new-repair'],
    ['add a new customer', 'add-customer'],
    ['end of day cash up', 'cash-up'],
    ['how do I text a customer', 'reminder-sms'],
    ['who owes money', 'who-owes'],
    ['change the prices', 'pricing'],
    ['the writing is too small', 'bigger-text'],
    ['what is confirm data', 'confirm-data'],
  ]
  for (const [asked, expected] of cases) {
    const got = bestGuide(asked)
    assert.ok(got, `"${asked}" matched nothing`)
    assert.equal(got.id, expected, `"${asked}" → ${got.id}, expected ${expected}`)
  }
})

test('a question with nothing to do with the shop matches nothing', () => {
  // An honest miss, so the caller can hand it to the generative assistant
  // instead of showing a confident wrong answer.
  for (const q of ['what is the weather', 'tell me a joke', 'zzzzz', '']) {
    assert.deepEqual(matchGuides(q), [], `"${q}" should not have matched`)
  }
})

test('common words alone do not drag in every guide', () => {
  // "how do I" is in every question ever asked here; on its own it must not
  // return the whole library as if it had understood something.
  assert.deepEqual(matchGuides('how do I'), [])
  assert.deepEqual(matchGuides('what is the'), [])
})

test('matching is capped so the panel never dumps the library', () => {
  const many = matchGuides('phone customer payment sim', GUIDES, { limit: 3 })
  assert.ok(many.length <= 3)
})

test('null and rubbish input are a miss, not a crash', () => {
  for (const q of [null, undefined, 0, {}, []]) {
    assert.deepEqual(matchGuides(q), [])
  }
})

// ── Where the asker is standing ──────────────────────────────────────────────
// The panel opens with no question typed more often than not: someone presses ❓
// because they are stuck on the screen in front of them. Leading with that
// screen's jobs is the difference between an answer and a list.

test('the panel leads with the screen you are on', () => {
  const { here, rest } = guidesByScreen('repairs')
  assert.ok(here.length, 'repairs has guides, so some should be first')
  for (const g of here) assert.equal(g.tab, 'repairs')
  for (const g of rest) assert.notEqual(g.tab, 'repairs')
  assert.equal(here.length + rest.length, GUIDES.length, 'no guide may be dropped by the split')
})

test('a screen with no guides of its own still shows the whole library', () => {
  const { here, rest } = guidesByScreen('not-a-tab')
  assert.deepEqual(here, [])
  assert.equal(rest.length, GUIDES.length)
})

test('the screen you are on breaks a tie', () => {
  // "phone" alone is genuinely ambiguous — renting one out, taking one back, a
  // repair. Standing on Repairs should settle it.
  const onRepairs = matchGuides('phone', GUIDES, { limit: 1, boostTab: 'repairs' })[0]
  assert.equal(onRepairs?.tab, 'repairs', `"phone" on the Repairs screen reached ${onRepairs?.id}`)
})

test('the screen you are on never beats a real answer', () => {
  // The failure that would make this feature worse than nothing: someone asks a
  // clear question and gets the answer for the screen they happen to be on.
  const cases = [
    ['how do I take a payment', 'rentals', 'take-payment'],
    ['someone brought the phone back', 'shop', 'return-phone'],
    ['book a flight', 'repairs', 'new-booking'],
    ['the writing is too small', 'wallet', 'bigger-text'],
  ]
  for (const [asked, standingOn, expected] of cases) {
    const got = matchGuides(asked, GUIDES, { limit: 1, boostTab: standingOn })[0]
    assert.equal(got?.id, expected, `"${asked}" from the ${standingOn} screen → ${got?.id}`)
  }
})

test('the boost cannot conjure a match out of nothing', () => {
  // A guide that matched no word at all must not appear just because it belongs
  // to this screen — that would turn an honest miss into a wrong answer.
  assert.deepEqual(matchGuides('what is the weather', GUIDES, { boostTab: 'rentals' }), [])
  assert.deepEqual(matchGuides('', GUIDES, { boostTab: 'rentals' }), [])
})
