// Reading an email in the app.
//
// The owner opened a Jet2 confirmation on 19 Aug and got a screen of
// `https://jet2email.com/c/AQi_qhAQ5NaHARjQi_-2ASCBrr0fKMvmsh…` with a handful
// of real words buried in it. These hold the two things that matter: the words
// come back, and no destination is silently lost on the way.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mailBodySegments, mailBodyText, linkHost } from '../lib/mailBody.mjs'

// The shape the html-to-text flattener leaves, trimmed from the real mail.
const JET2 = `Tick, tock!

( https://jet2email.com/c/AQi_qhAQ5NaHARjQi_-2ASCBrr0fKMvmshAFxsSJR9mTHEK9 )

Essentials ( https://jet2email.com/c/AQi_qhAQ5NaHARjQi_-2ASCCrr0 ) Manage My Booking ( https://jet2email.com/c/AQi_qhAQ5NaHARjQi_-2ASCDrr0 ) Guides ( https://jet2email.com/c/AQi_qhAQ5NaHARjQi_-2ASCErr0 )

Your flight LS1234 departs Manchester at 06:20 on 24 Aug.`

test('the words survive and the tracking blobs do not', () => {
  const text = mailBodyText(JET2)
  assert.ok(text.includes('Manage My Booking'))
  assert.ok(text.includes('Your flight LS1234 departs Manchester at 06:20'))
  assert.ok(!/AQi_qh/.test(text), 'a tracking blob reached the reader')
  assert.ok(!/https?:\/\//.test(text), 'a raw URL reached the reader')
})

test('a label becomes the link, whole and once', () => {
  const segs = mailBodySegments(JET2)
  const link = segs.find(s => s.type === 'link' && s.text === 'Manage My Booking')
  assert.ok(link, 'the label should have become the link')
  assert.equal(link.href, 'https://jet2email.com/c/AQi_qhAQ5NaHARjQi_-2ASCDrr0')
  // The label leaves the prose exactly — the first cut of this ate its first
  // letter and left the space, giving "MManage My Booking".
  assert.ok(!mailBodyText(JET2).includes('MManage'))
  assert.equal(mailBodyText(JET2).split('Manage My Booking').length - 1, 1)
})

test('nothing is thrown away — every URL in still has a way out', () => {
  const urls = JET2.match(/https?:\/\/\S+/g).filter(u => !u.startsWith('http'.repeat(2)))
  const hrefs = mailBodySegments(JET2).filter(s => s.type === 'link').map(s => s.href)
  for (const u of urls) {
    assert.ok(hrefs.includes(u.replace(/[)\s]+$/, '')), `lost the destination ${u}`)
  }
})

test('an unlabelled link falls back to somewhere a person can judge', () => {
  const segs = mailBodySegments('( https://jet2email.com/c/AQi_qh )')
  assert.deepEqual(segs, [{ type: 'link', text: 'jet2email.com', href: 'https://jet2email.com/c/AQi_qh' }])
  assert.equal(linkHost('https://www.ryanair.com/gb/en/booking'), 'ryanair.com')
  assert.equal(linkHost('not a url'), '')
})

test('a bare URL with no brackets is caught too', () => {
  const segs = mailBodySegments('Unsubscribe https://jet2email.com/u/xyz123')
  assert.deepEqual(segs.map(s => s.type), ['text', 'link'])
  assert.equal(segs[1].href, 'https://jet2email.com/u/xyz123')
  assert.equal(segs[1].text, 'jet2email.com')
})

test('a whole sentence is not a label — it stays in the prose', () => {
  const long = 'We could not confirm your seat because the airline did not answer in time ( https://x.com/a )'
  const segs = mailBodySegments(long)
  assert.ok(segs[0].text.includes('did not answer in time'), 'the sentence was eaten by the link')
  assert.equal(segs[1].text, 'x.com')
})

test('two links in a row stay two links', () => {
  const segs = mailBodySegments('A ( https://a.com/1 ) B ( https://b.com/2 )')
  const links = segs.filter(s => s.type === 'link')
  assert.equal(links.length, 2)
  assert.deepEqual(links.map(l => [l.text, l.href]),
    [['A', 'https://a.com/1'], ['B', 'https://b.com/2']])
})

test('an ordinary email is left alone', () => {
  const plain = 'Hello Eliezer,\n\nYour SIM has been activated.\n\nThanks,\nThe team'
  assert.equal(mailBodyText(plain), plain)
})

test('empty and rubbish in, nothing out — never a crash', () => {
  for (const bad of ['', '   \n\n  ', null, undefined]) {
    assert.deepEqual(mailBodySegments(bad), [])
    assert.equal(mailBodyText(bad), '')
  }
  // A body that is only the number 0 is still a body — content, not emptiness.
  assert.equal(mailBodyText(0), '0')
})

test('the blank-line canyon a stripped footer leaves is closed up', () => {
  const segs = mailBodySegments('Top\n\n\n\n\n( https://a.com/x )\n\n\n\n\nBottom')
  assert.ok(!mailBodyText(segs.length ? 'Top\n\n\n\n\nBottom' : '').includes('\n\n\n'))
  assert.ok(!segs.some(s => s.type === 'text' && /\n{3,}/.test(s.text)))
})
