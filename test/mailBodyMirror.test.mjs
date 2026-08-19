// The browser copy of the email tidier, held to the canonical lib — the
// pricing-mirror pattern. A message that reads correctly in a test and badly on
// the screen is the failure this prevents.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mailBodySegments, mailBodyText, linkHost } from '../lib/mailBody.mjs'

const SRC = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')

function liftMirror() {
  const m = SRC.match(/\/\/ ── KC_MAILBODY mirror start ──\n([\s\S]*?)\n\/\/ ── KC_MAILBODY mirror end ──/)
  assert.ok(m, 'KC_MAILBODY mirror region not found in public/main.js')
  return new Function(`${m[1]}; return KC_MAILBODY;`)()
}

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
  for (const body of CASES) {
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
