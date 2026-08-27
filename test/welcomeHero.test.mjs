// The accent and the subline are ONE sentence, and the spacing has to say so.
//
// "Shabbos & Yom Tov / never charged — priced by the day, not the trip" is a
// single claim broken over two lines with different styling. An earlier pass
// bound them together by SIZE, closing the ratio from 2.3× to ~1.6×. The
// spacing still said the opposite (owner, 20 Aug: "isnt the spacing here
// somewhat off?"): 4px above the accent, 5px below it — three lines evenly
// spaced, so nothing grouped. Allowing for line-height the optical gaps were
// ~7.6px above and ~10.1px below, meaning the sentence was held LESS tightly
// to itself than to the headline it is not part of.
//
// Proximity is the strongest grouping cue there is, so the spacing has to say
// the true thing — but the root cause was neither size nor spacing. The line
// broke MID-CLAUSE: "Shabbos & Yom Tov" alone says nothing, so the eye had to
// travel on to find out what about it. The owner spotted it after two attempts
// had worked around it: put the whole claim on the first line and the second
// claim on the second. The other two bands were always shaped that way — a
// complete claim ("Pay less", "Same day") over a supporting line — which is
// why only this one ever looked wrong.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const SRC = readFileSync(new URL('../pages/welcome.js', import.meta.url), 'utf8')

const marginTopOf = (selector) => {
  const rule = SRC.match(new RegExp(`\\${selector}\\{([^}]*)\\}`))
  assert.ok(rule, `${selector} is missing from the page's CSS`)
  // `0` is valid CSS without a unit, and reading it as "absent" would have this
  // test fail on the very value it is checking for.
  const m = rule[1].match(/margin-top:\s*(-?[\d.]+)(px)?/)
  assert.ok(m, `${selector} sets no margin-top`)
  return Number(m[1])
}

test('the sentence is held to itself more tightly than to the headline', () => {
  const above = marginTopOf('.sk-accent')    // headline → the pair
  const inside = marginTopOf('.sk-subline')  // within the pair
  assert.ok(above > inside,
    `the gap above the accent (${above}px) must exceed the gap inside the sentence (${inside}px) — ` +
    'otherwise the headline and the accent read as the pair, and the line that says what about it is orphaned')
  // Not merely bigger: bigger by enough to be seen. Line-height adds a few
  // px of its own on both sides, so a 1–2px difference disappears optically —
  // which is exactly how the original 4px/5px looked evenly spaced.
  assert.ok(above - inside >= 8,
    `${above - inside}px of difference is too small to read as grouping once line-height is added`)
})

test('the accent still does not compete with the headline it sits under', () => {
  // The earlier fix, held so a spacing change cannot undo it: the accent is
  // smaller than the h2, and close enough to the subline in size that the two
  // read as one sentence rather than as a headline and a caption.
  const h2 = SRC.match(/\.sk-band-inner h2\{[^}]*font-size:clamp\([^,]+,[^,]+,\s*([\d.]+)px\)/)
  const accent = SRC.match(/\.sk-accent\{[^}]*font-size:clamp\([^,]+,[^,]+,\s*([\d.]+)px\)/)
  const sub = SRC.match(/\.sk-subline\{[^}]*font-size:\s*([\d.]+)px/)
  assert.ok(h2 && accent && sub, 'the three sizes should all be findable')
  assert.ok(Number(accent[1]) < Number(h2[1]), 'the accent must not be as loud as the headline')
  assert.ok(Number(accent[1]) / Number(sub[1]) < 2,
    'at more than 2× the eye takes the accent as a finished headline and never reaches the subline')
})

test('every accent is a claim that stands on its own', () => {
  // The shape of the other two bands, made the rule. An accent that needs the
  // next line to mean anything is the fragment this band had.
  const accents = [...SRC.matchAll(/accent:\s*'([^']+)'/g)].map((m) => m[1])
  assert.ok(accents.length >= 6, `only ${accents.length} accents found — both languages should be here`)
  // A trailing conjunction or a dangling preposition is the tell.
  for (const a of accents) {
    assert.ok(!/\b(and|or|with|for|from|the|a|an|to)$/i.test(a.trim()),
      `"${a}" ends mid-thought — it needs the next line to mean anything`)
  }
  // The one that was broken, named so it cannot quietly revert.
  const travel = accents.find((a) => /Shabbos/.test(a))
  assert.ok(travel, 'the travel band lost its accent')
  // The source carries the escape sequence \u00A0 as text; JS turns it into a
  // real non-breaking space at runtime, so match either form.
  assert.match(travel, /never(\\u00A0|\u00A0|\s)charged/,
    '"Shabbos & Yom Tov" on its own is a fragment — the claim has to finish on that line')
})

test('the long accent breaks at the phrase, not mid-claim', () => {
  // At 320px this one wraps. Without the non-breaking space it breaks as
  // "…Yom Tov never / charged", which puts a fragment back on the first line —
  // the very thing this change fixed.
  const travel = SRC.match(/accent:\s*'(Shabbos[^']+)'/)
  assert.ok(travel, 'the travel accent is missing')
  assert.match(travel[1], /never\\u00A0charged|never\u00A0charged/,
    'glue "never charged" together so the wrap lands after "Yom Tov"')
})

test('the Hebrew says the same thing in the same shape', () => {
  // The Hebrew had the identical fault: שבת ויום טוב on one line with בחינם —
  // the word that carries the claim — stranded on the next.
  //
  // This used to pin the exact phrase 'שבת ויום טוב בחינם'. On 27 Aug the owner
  // had the whole of the Hebrew rewritten by somebody who writes Israeli
  // microcopy for a living, and this line became 'ללא חיוב בשבתות וימים טובים'
  // — which says the same thing better and put the claim FIRST, where it cannot
  // be stranded at all. A test that pins a sentence blocks the sentence being
  // improved; what it is actually for is the property, so that is what it
  // checks now: the accent names the days AND says they are not charged, in one
  // string.
  const he = SRC.match(/accent:\s*'([^']*(?:שבת|שבתות)[^']*)'/)
  assert.ok(he, 'the Hebrew travel accent is missing')
  assert.match(he[1], /ימים טובים|יום טוב/, 'it must name Yom Tov as well as Shabbos')
  assert.match(he[1], /ללא חיוב|בחינם|לא מחויב/, 'it must carry the claim — that they are not charged')
})
