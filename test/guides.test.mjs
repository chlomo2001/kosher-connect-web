// The guide library is a promise: ask the app how to do the job and it tells
// you, correctly, every time. These tests hold it to that.
//
// The one that matters most is coverage — a screen with no guide is a screen
// where a helper is on their own, and that is exactly the failure the library
// exists to prevent.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GUIDES, guideTabs, matchGuides, bestGuide } from '../lib/guides.mjs'
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
