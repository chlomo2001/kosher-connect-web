// The staff app must not hard-code colour in inline styles. Run: npm test
//
// This is the third time this class of bug has been fixed (booking badges in
// July, then five more badge families, then the reload banner), so it gets a
// test rather than another fix.
//
// Why inline styles specifically: a colour in styles/globals.css can be paired
// with a `:root[data-theme="dark"]` override, and several are. A colour baked
// into a style="" string in main.js has nowhere to put that override, so it
// renders identically on an ivory card and a near-black one. The failures were
// not subtle — #07639e on a translucent wash measured 2.32:1 against the dark
// card, and #4434d4 on a 45% lavender fill measured 1.39:1.
//
// Scope is public/main.js only. pages/api/email.js is exempt because mail
// clients do not support custom properties, and pages/welcome.js is exempt
// because its <style> blocks can and do carry their own dark overrides.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const SRC = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')

// Tokens that are deliberately the same in both themes, so white on top of
// them is safe. Anything else that flips (--danger lightens to #ff5f80 for
// dark cards) cannot carry white text: that pairing measured 2.92:1.
const SOLID_TOKENS = ['--danger-solid', '--brand-dark', '--primary-deep', '--primary-press']

const lineOf = (i) => SRC.slice(0, i).split('\n').length

test('no literal text colour in an inline style', () => {
  const offenders = []
  const re = /color:\s*(#[0-9a-fA-F]{3,8})/g
  let m
  while ((m = re.exec(SRC))) {
    const hex = m[1].toLowerCase()
    // White and black are theme-neutral inks; whether they are legible is a
    // question about the background, which the next test covers.
    if (hex === '#fff' || hex === '#ffffff' || hex === '#000' || hex === '#000000') continue
    // A `background:` shorthand can contain a hex too — only flag text colour.
    if (/-color:\s*$/.test(SRC.slice(Math.max(0, m.index - 12), m.index))) continue
    offenders.push(`${lineOf(m.index)}: ${hex}`)
  }
  assert.deepEqual(offenders, [],
    `Use a var(--token) so the colour flips for the dark theme:\n${offenders.join('\n')}`)
})

test('white text is never put on a token that lightens for dark', () => {
  // The reload banner was `background:var(--danger);color:#fff` — fine at
  // 4.80:1 on light, 2.92:1 on dark, and it is the banner that blocks saving.
  const offenders = []
  const re = /background:\s*var\((--[a-z0-9-]+)\)\s*;\s*color:\s*#(?:fff|ffffff)\b/gi
  let m
  while ((m = re.exec(SRC))) {
    if (!SOLID_TOKENS.includes(m[1])) offenders.push(`${lineOf(m.index)}: white on var(${m[1]})`)
  }
  assert.deepEqual(offenders, [],
    `That token lightens for dark, so white on it fails AA. Use one of ${SOLID_TOKENS.join(', ')}:\n${offenders.join('\n')}`)
})

test('the guard would have caught the bugs it was written for', () => {
  // A test that cannot fail is not a guard. These are the exact strings that
  // shipped, checked against the same regexes.
  const wasBroken = [
    'background:rgba(7,99,158,0.14);color:#07639e;',   // travel chips, 2.32:1
    'background:rgba(185,185,249,0.45);color:#4434d4;', // repair Open, 1.39:1
    'background:#f5e9d4;color:#9b6829;',                // reserved, 3.97:1 in LIGHT
  ]
  for (const s of wasBroken) {
    assert.match(s, /color:\s*#[0-9a-fA-F]{3,8}/, `${s} should trip the literal-colour rule`)
  }
  assert.match('background:var(--danger);color:#fff;',
    /background:\s*var\((--[a-z0-9-]+)\)\s*;\s*color:\s*#(?:fff|ffffff)\b/i)
  // …and the replacements must not trip it.
  for (const s of [
    'background:rgba(7,99,158,0.14);color:var(--accent);',
    'background:var(--canvas-cream);color:var(--gold);',
    'background:var(--danger-solid);color:#fff;',
  ]) {
    assert.doesNotMatch(s, /color:\s*#(?!fff|ffffff)[0-9a-fA-F]{3,8}/)
  }
})
