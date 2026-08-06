// Names get a capital first letter on every word — and the two copies of that
// rule have to stay the same rule.
//
// There are two on purpose. lib/mappers' capName is the enforcement point: it
// runs inside upsertCustomer, so the ELID import, the merge routes and the
// legacy import script cannot write past it. public/main.js has its own,
// because that file is a classic script served from /public and cannot import
// anything — it exists so the staff form shows the corrected name immediately
// rather than after a round trip.
//
// Two copies is how the fix half-happened the first time: the browser one
// shipped in July, the server had none, and the import that followed wrote 31
// production customers as "yossy-adler". So this does not compare source text
// (identical text can still be two rules a year apart) — it lifts the browser
// function out of main.js, runs it, and holds it to the same answers.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { capName } from '../lib/mappers.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// The pairs that say what the rule actually is. The last three are the reason
// this is not initcap(), which lowercases the remainder of every word.
const CASES = [
  ['moshe', 'Moshe'],
  ['moshe chaim', 'Moshe Chaim'],
  ['cohen-levi', 'Cohen-Levi'],
  ['yossy-adler', 'Yossy-Adler'],
  ["o'brien", "O'Brien"],
  ["Thaler I'm Paying", "Thaler I'm Paying"], // a real record; "I'm" must not become "I'M"
  ['  shloime  ', 'Shloime'],
  ['', ''],
  ['McDonald', 'McDonald'],       // an existing capital inside a word is left alone
  ['COHEN', 'COHEN'],             // an all-caps passport name stays as typed
  ['Yehuda-altovsky', 'Yehuda-Altovsky'],
]

test('capName capitalises each word and touches nothing else', () => {
  for (const [input, want] of CASES) {
    assert.equal(capName(input), want, `capName(${JSON.stringify(input)})`)
  }
})

test('capName handles the absent cases without throwing', () => {
  for (const v of [null, undefined, 0]) assert.equal(capName(v), '')
})

test("the browser's copy in public/main.js agrees on every case", () => {
  const src = readFileSync(path.join(ROOT, 'public/main.js'), 'utf8')
  const m = src.match(/function capName\s*\([^)]*\)\s*\{[\s\S]*?\n\}/)
  assert.ok(m, 'public/main.js must still define capName')

  // eslint-disable-next-line no-new-func -- lifting one pure function out of a
  // classic script is the only way to run it here; it takes a string and
  // returns a string, and the source it comes from is in this repo.
  const browserCapName = new Function(`${m[0]}; return capName`)()

  for (const [input, want] of CASES) {
    assert.equal(browserCapName(input), want,
      `public/main.js capName(${JSON.stringify(input)}) has drifted from lib/mappers`)
  }
})
