// Folding the top of a tab down to a few buttons.
//
// Owner, 30 Aug, with a red box drawn round the whole top of Phone Rentals:
// "i wanna be able to collapse the top thing to a few buttons, so most of the
// screen should be the list." On that screenshot the list starts 740px down a
// 1290px window, with four of twelve rentals visible under a block of chrome
// that earns its place the first time you look at the screen and not the
// fiftieth.
//
// The three rules that keep a fold from becoming a trap:
//   · nothing folds without being said — the button carries the figures
//   · navigation never folds — the view pills are the way off this view
//   · a row that is ASKING for something never folds, however folded the rest
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const SRC = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')
const CSS = readFileSync(new URL('../styles/app.css', import.meta.url), 'utf8')
const MANUAL = readFileSync(new URL('../lib/manual.mjs', import.meta.url), 'utf8')
const fn = (name) => {
  const m = SRC.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`))
  assert.ok(m, `${name} is gone`)
  return m[0]
}

test('the fold is remembered, per tab, and off by default', () => {
  // Somebody who wants the list wants it every morning. And it is opt-in: a
  // fold nobody asked for would hide the numbers from the person who has not
  // learnt them yet.
  const folded = fn('kcFolded')
  assert.match(folded, /localStorage\.getItem\(kcFoldKey\(tab\)\) === '1'/)
  assert.match(folded, /catch \{ return false; \}/, 'a private window would throw and take the tab with it')
  assert.match(SRC, /const kcFoldKey = \(tab\) => `kc\.fold\.\$\{tab\}`/)
})

test('folded, the button says the numbers it put away', () => {
  // The rule that makes this a fold and not a hiding place — and the summary is
  // read off the cards themselves, so it cannot drift from what it stands in
  // for and no screen has to know how to describe itself.
  assert.match(fn('kcFoldBtnHtml'), /escHtml\(summary \|\| 'Show the counts'\)/)
  const sum = fn('kcFoldSummary')
  assert.match(sum, /querySelectorAll\('\.stat-card'\)/)
  assert.match(sum, /\.stat-label/)
  assert.match(sum, /\.stat-value/)
})

test('a row that is asking for something never folds', () => {
  // "3 phones overdue back" is the reason the screen exists. Only a CLEAR row —
  // "nothing waiting on you here" — is foldable, and the check is on the
  // rendered class rather than on a flag that could drift from it.
  const apply = fn('kcFoldApply')
  assert.match(apply, /el\.dataset\.fold === 'clear'/)
  assert.match(apply, /el\.hidden = on && !!el\.querySelector\('\.kc-next-clear'\)/)
  assert.match(apply, /na\.hidden = on && !!na\.querySelector\('\.kc-next-clear'\)/)
})

test('a repaint of the next-action row cannot undo the fold', () => {
  // kcPaintNextAction rewrites that row from scratch and has three exits. Miss
  // one and a folded row comes back on the next poll, which reads as the fold
  // being broken rather than as a race.
  const paint = fn('kcPaintNextAction')
  assert.equal((paint.match(/refold\(\);/g) || []).length, 3,
    'every one of kcPaintNextAction\'s three exits must re-apply the fold')
})

test('what folds on rentals, and what does not', () => {
  const tab = SRC.slice(SRC.indexOf('function renderRentalsTab() {'), SRC.indexOf('function renderRentalRows('))
  // The counts fold by being a .stats-row — no tab has to say so. The heading
  // over the list is rentals' own extra, because the view pill above it
  // already says "Rentals 12".
  assert.match(tab, /<div class="stats-row">/)
  assert.match(tab, /<div class="section-header" data-fold>/)
  // The buttons, the pills and the filters stay — none of them is marked.
  const toolbar = tab.slice(tab.indexOf('<div class="kc-toolbar">'), tab.indexOf('${kcSubviews('))
  assert.doesNotMatch(toolbar, /data-fold/, 'the toolbar folds, so there are no buttons left to press')
  const pills = tab.slice(tab.indexOf('${kcSubviews('), tab.indexOf('<div id="availCalWrap">'))
  assert.doesNotMatch(pills, /data-fold/, 'the view pills fold, which makes the fold a trap')
  assert.match(tab, /kcFoldApply\('rentals'\)/)
})

test('every screen with a row of counts has the fold', () => {
  // Adoption is one call per tab and the control installs itself, which is the
  // only reason thirteen screens could take it at once. If a screen draws a
  // .stats-row and never calls kcFoldApply, its cards cannot be put away.
  const tops = [...SRC.matchAll(/^(?:async )?function (\w+)\(/gm)].map((m) => [m.index, m[1]])
  const owners = new Set()
  for (const m of SRC.matchAll(/<div class="stats-row"/g)) {
    owners.add(tops.filter(([i]) => i < m.index).pop()[1])
  }
  owners.delete('skeletonHtml')   // the loading ghost, which has nothing to fold
  const missing = [...owners].filter((fname) => {
    const start = SRC.search(new RegExp(`^(?:async )?function ${fname}\\(`, 'm'))
    const body = SRC.slice(start, start + SRC.slice(start).search(/\n\}\n/))
    return !/kcFoldApply\(/.test(body)
  })
  assert.deepEqual(missing, [], 'these screens draw counts nobody can put away')
  assert.ok(owners.size >= 12, `only ${owners.size} screens have counts — the scan has drifted`)
})

test('the control installs itself, so no tab can wire it wrongly', () => {
  const apply = fn('kcFoldApply')
  assert.match(apply, /content\.querySelector\('\.stats-row'\)/)
  assert.match(apply, /row\.id = 'kcFoldRegion'/)
  assert.match(apply, /createElement\('div'\)/)
  assert.match(apply, /insertBefore\(bar, row\)/)
  assert.match(apply, /row\.hidden = on/)
})

test('the button never goes away — it is the way back', () => {
  // Owner, 30 Aug: "it shouldnt vanish the cards entirely but leave a small
  // button for it to cum back." So the bar is rewritten on both states and the
  // fold hides the ROW, never the control.
  const apply = fn('kcFoldApply')
  assert.match(apply, /bar\.innerHTML = kcFoldBtnHtml\(tab, summary\)/)
  assert.doesNotMatch(apply, /bar\.hidden/, 'the control itself is being hidden')
})

test('it says what it does to a screen reader', () => {
  const html = fn('kcFoldBtnHtml')
  assert.match(html, /aria-expanded="\$\{on \? 'false' : 'true'\}"/)
  assert.match(html, /aria-controls="kcFoldRegion"/)
  assert.match(html, /aria-hidden="true"/, 'the chevron is decoration and should not be read out')
})

test('the control is a 44x44 target on a coarse pointer', () => {
  const coarse = CSS.match(/@media \(pointer: coarse\) \{\s*\.kc-fold-btn \{([^}]*)\}/)
  assert.ok(coarse, 'no coarse-pointer rule for the fold button')
  assert.match(coarse[1], /min-height: 44px/)
})

test('an input in a toolbar is not eaten by the empty-slot rule', () => {
  // `.kc-toolbar > :empty` hid every <input> placed directly in a toolbar —
  // an input has no child nodes, so the selector matches it always. Adopting
  // .kc-toolbar on rentals lost Scan IMEI and Search rentals outright, with
  // nothing in the console to say so. Found by looking at a screenshot.
  assert.doesNotMatch(CSS, /\.kc-toolbar > :empty/,
    'the unscoped empty rule is back, and it hides toolbar inputs')
  assert.match(CSS, /\.kc-toolbar > div:empty,\s*\.kc-toolbar > span:empty \{ display: none; \}/)
})

test('the manual documents it once, on the frame, because it is everywhere', () => {
  // It was in the Phone Rentals entry while only that screen had it. A control
  // on thirteen screens belongs with the menu and the top bar, or the same
  // paragraph gets written thirteen times and drifts twelve of them.
  const frame = MANUAL.slice(MANUAL.indexOf("id: 'app-frame'"), MANUAL.indexOf("id: 'dashboard'"))
  assert.match(frame, /\['Hide the counts',/)
  const rentals = MANUAL.slice(MANUAL.indexOf("id: 'rentals'"), MANUAL.indexOf("id: 'sim'"))
  assert.doesNotMatch(rentals, /Hide the counts/, 'it is documented twice and will drift')
})
