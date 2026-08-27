// Reading the owner's own converters, and matching them where they were right.
//
// Shloime's office PC runs three HTML converters. Two of them we had already
// reimplemented; this test locks what comparing them proved.
//
//   Nokia_IB_to_VCF.html    byte-for-byte the same as parseNokiaIb — same
//                           record start 0x244, stride 592, name offsets
//                           0x60/0xb4, phone offsets 0x1e/0x34, same nibble
//                           decode, same 0x11 → '+'.
//   Nokia_C2_to_FIG.html    emits exactly our FIG_KEYS record, down to
//                           creator 'com.figmessenger' and sub_id '1'. Our
//                           FIG output format is confirmed against his.
//   NEW_GOOD_XML_to_FIG     the one real difference, and it went BOTH ways.
//
// His XML matcher is /<sms\s+([^>]+?)\s*\/>/g. `[^>]` stops at the first '>',
// so a message body containing one — "u there? ->" — never matches and the
// message is silently dropped. Ours consumes quoted spans and keeps it; that
// bug is already fixed here and the first test below is the proof.
//
// But his tool never checked for an <smses> root and ours demanded one, so a
// file he could convert was refused here — which is a job going back to the
// office PC over a wrapper element nobody reads.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseSmsBackupXml } from '../lib/smsFormats.mjs'

const ROWS = [
  `<sms address="+447700900001" date="1750000000000" type="1" body="ok" read="1" />`,
  `<sms address="+447700900002" date="1750000001000" type="2" body="u there? ->" read="1" />`,
  `<sms address="+447700900003" date="1750000002000" type="1" body="last" read="1" />`,
].join('\n')

test("a body containing '>' is kept, not silently dropped", () => {
  const out = parseSmsBackupXml(`<smses count="3">${ROWS}</smses>`)
  assert.equal(out.length, 3, 'all three messages survive')
  assert.ok(out.some((m) => m.body === 'u there? ->'),
    'the one his converter loses is the one to check for')
})

test('the messages are the test, not the <smses> wrapper', () => {
  const wrapped = parseSmsBackupXml(`<smses count="3">${ROWS}</smses>`)
  const bare = parseSmsBackupXml(ROWS)
  assert.equal(bare.length, wrapped.length)
  assert.deepEqual(bare, wrapped, 'the wrapper changes nothing about the content')
})

test('an XML file with no messages in it is still an error', () => {
  assert.throws(() => parseSmsBackupXml('<html><body>nope</body></html>'), /No <sms> entries/)
  assert.throws(() => parseSmsBackupXml(''), /No <sms> entries/)
})


// Comparing the two parsers turned up a flaw that was ours alone, and it was
// the quiet kind. Both his attribute matcher and ours read only DOUBLE-quoted
// values — but his skips a tag it could not read (`if (attrs.address ||
// attrs.body)`) while ours pushed the record anyway. So a single-quoted export
// did not fail here and did not drop messages: it produced the right NUMBER of
// completely BLANK ones, and those went into the FIG zip as empty texts. An
// error is recoverable and a missing message is noticeable; a backup full of
// blanks is neither.

test('single-quoted attributes read the same as double-quoted ones', () => {
  const dq = `<sms address="+447700900002" date="1750000001000" type="2" body="u there? ->" />`
  const sq = `<sms address='+447700900002' date='1750000001000' type='2' body='u there? ->' />`
  assert.deepEqual(parseSmsBackupXml(sq), parseSmsBackupXml(dq))
  assert.equal(parseSmsBackupXml(sq)[0].body, 'u there? ->')
})

test('an apostrophe in the body does not end its own attribute', () => {
  const out = parseSmsBackupXml(`<sms address="+447700900003" date="1" type="1" body="it&apos;s fine > really" />`)
  assert.equal(out.length, 1)
  assert.equal(out[0].body, "it's fine > really", 'entity decoded, and the > kept')
})

test('a tag that reads as nothing is skipped, not carried as a blank message', () => {
  // Neither an address nor a body survived the read — whatever this is, it is
  // not a message, and an empty line in a restore is worse than a missing one.
  const out = parseSmsBackupXml(`<sms read="1" type="1" />\n<sms address="+447700900001" body="real" />`)
  assert.equal(out.length, 1)
  assert.equal(out[0].body, 'real')
})
