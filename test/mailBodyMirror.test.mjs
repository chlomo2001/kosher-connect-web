// The browser copy of the email tidier, held to the canonical lib — the
// pricing-mirror pattern. A message that reads correctly in a test and badly on
// the screen is the failure this prevents.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mailBodySegments, mailBodyText, linkHost, htmlToText } from '../lib/mailBody.mjs'

const SRC = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')

function liftMirror() {
  const m = SRC.match(/\/\/ ── KC_MAILBODY mirror start ──\n([\s\S]*?)\n\/\/ ── KC_MAILBODY mirror end ──/)
  assert.ok(m, 'KC_MAILBODY mirror region not found in public/main.js')
  return new Function(`${m[1]}; return KC_MAILBODY;`)()
}

// Raw HTML that never got flattened on the way in. The owner opened a Ryanair
// itinerary on 28 Aug and got the DOCTYPE and four hundred lines of CSS; these
// cases keep both copies flattening it the same way.
const HTML_CASES = [
  `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN"><html><head>`
  + `<style type="text/css">body{margin:0}#outlook a{padding:0}@media only screen{html{background-color:#E6EAED}}</style>`
  + `</head><body><table><tr><td><h1>Your Ryanair itinerary</h1>`
  + `<p>Flight FR1234 &mdash; MAN to TLV, 21&nbsp;Aug 2026.</p>`
  + `<p><a href="https://ryanair.com/manage">Manage my booking</a></p></td></tr></table></body></html>`,
  `<div>Check-in <b>is open</b><br/>Ref <span>X2LZ6P</span></div>`,
  `<p>Nothing but a paragraph.</p>`,
  `<a href="https://example.com/x">   </a>`,
  `<!-- a comment only -->`,
  'Plain text with no tags at all — must pass through untouched.',
]

const CASES = [
  'Tick, tock!\n\n( https://jet2email.com/c/AQi_qhAQ5NaHARjQi_-2ASCBrr0 )\n\nEssentials ( https://jet2email.com/c/AQi_qhAQ5NaHARjQi_-2ASCCrr0 ) Manage My Booking ( https://jet2email.com/c/AQi_x )',
  'A ( https://a.com/1 ) B ( https://b.com/2 )',
  'Unsubscribe https://jet2email.com/u/xyz123',
  'Hello Eliezer,\n\nYour SIM has been activated.\n\nThanks,\nThe team',
  'We could not confirm your seat because the airline did not answer in time ( https://x.com/a )',
  'Top\n\n\n\n\n( https://a.com/x )\n\n\n\n\nBottom',
  'Your PAC is ABC123456 . Give it to your new network ( https://ee.co.uk/pac ) within 30 days.',
  '',
  '   \n\n  ',
  'no links here at all',
]

test('the browser mirror agrees with the lib, segment for segment', () => {
  const B = liftMirror()
  for (const body of [...CASES, ...HTML_CASES]) {
    assert.deepEqual(B.segments(body), mailBodySegments(body), `segments differ for: ${JSON.stringify(body.slice(0, 60))}`)
    assert.equal(B.text(body), mailBodyText(body), `text differs for: ${JSON.stringify(body.slice(0, 60))}`)
  }
  for (const u of ['https://www.ryanair.com/gb/en', 'http://a.b.c/d?e#f', 'nonsense', '']) {
    assert.equal(B.linkHost(u), linkHost(u), `host differs for ${u}`)
  }
})

test('the screen never shows a tracking blob', () => {
  const B = liftMirror()
  for (const body of CASES) {
    assert.ok(!/https?:\/\//.test(B.text(body)), `a raw URL survived into: ${B.text(body)}`)
  }
})

test('the dialog escapes what it renders — a mail cannot inject markup', () => {
  // tmMailHtml is the only place a stored email becomes HTML. It must escape
  // both halves of a link, or a crafted subject/href is script on our page.
  const m = SRC.match(/function tmMailHtml\(body\) \{[\s\S]*?\n\}/)
  assert.ok(m, 'tmMailHtml not found in public/main.js')
  const fn = m[0]
  assert.ok(/escHtml\(s\.href\)/.test(fn), 'the href must be escaped')
  assert.ok(/escHtml\(s\.text\)/.test(fn), 'the link text must be escaped')
  assert.ok(/escHtml\(s\.text\)\)\.join/.test(fn) || /: escHtml\(s\.text\)/.test(fn),
    'the prose must be escaped')
  assert.ok(/rel="noopener noreferrer"/.test(fn), 'a new-tab link must not hand over window.opener')
})

test('an HTML mail that was never flattened comes out readable, both copies alike', () => {
  const B = liftMirror()
  for (const body of HTML_CASES) {
    assert.equal(B.htmlToText(body), htmlToText(body),
      `htmlToText differs for: ${JSON.stringify(body.slice(0, 60))}`)
  }
  const out = htmlToText(HTML_CASES[0])
  assert.ok(!/<[a-z!/]/i.test(out), `a tag survived: ${out}`)
  assert.ok(!/background-color|@media|DOCTYPE/i.test(out), `stylesheet text survived: ${out}`)
  assert.match(out, /Your Ryanair itinerary/)
  assert.match(out, /FR1234 — MAN to TLV/, 'entities decoded and the words kept')
  assert.match(out, /Manage my booking \( https:\/\/ryanair\.com\/manage \)/,
    'a link keeps its label AND its destination, in the shape segments() reads')
})

test('text that is already flat is not put through the flattener twice', () => {
  const plain = 'Booking ABC123. Manage it ( https://example.com/manage )'
  assert.equal(htmlToText(plain), plain)
})
