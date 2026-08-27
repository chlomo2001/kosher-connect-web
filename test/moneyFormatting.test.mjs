// Every pound sign on screen goes through fmtGbp.
//
// Shloime, testing on 27 August, saw "£28.900000000000006 owed" in the Phone
// Rentals balance column. The cell was building its own string:
//
//   ${totalOwed > 0 ? '£'+totalOwed+' owed' : '✓ Paid'}
//
// A rental total is price + late fee + lost charges, and adding three floats in
// JavaScript is how you get sixteen decimal places. fmtGbp() has always rounded
// to two; the cell simply was not using it. Three more sites were doing the
// same thing — two discount lines and the history list.
//
// This is the cheapest possible guard against the whole class: a pound sign
// followed by anything that is not a call to the formatter. It reads main.js as
// text rather than rendering it, so it costs nothing and runs on every commit.
import test from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const SRC = readFileSync(path.join(import.meta.dirname, '..', 'public/main.js'), 'utf8')
// Comment lines out first — the note above quotes the broken pattern by design,
// and a scan that reads prose has bitten this repo five times now.
const CODE = SRC.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')

test("no '£' + value concatenation — that is what prints sixteen decimals", () => {
  const hits = [...CODE.matchAll(/'£'\s*\+\s*([A-Za-z_][\w.()]*)/g)].map((m) => m[0])
  assert.deepStrictEqual(hits, [],
    `these build a money string by hand instead of calling fmtGbp: ${hits.join(', ')}`)
})

test('no bare £${value} interpolation either', () => {
  // £${x} is fine when x is already formatted text; it is not fine when x is a
  // number. Allow the formatter and the escaper, flag everything else so a new
  // one has to be looked at rather than slipping through.
  const hits = [...CODE.matchAll(/£\$\{\s*(?!fmtGbp|escHtml|fmt|money)([A-Za-z_][\w.?\[\]]*)\s*\}/g)]
    .map((m) => m[0])
  assert.deepStrictEqual(hits, [],
    `these interpolate a raw value after a pound sign: ${hits.join(', ')}`)
})

test('fmtGbp itself still rounds to exactly two places', () => {
  // The guard above is worthless if the formatter stops formatting.
  const fn = SRC.match(/function fmtGbp\(v\) \{[\s\S]*?\n\}/)
  assert.ok(fn, 'fmtGbp is gone')
  assert.match(fn[0], /minimumFractionDigits: 2/)
  assert.match(fn[0], /maximumFractionDigits: 2/)
})
