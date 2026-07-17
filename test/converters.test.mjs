// Converter-suite net: UK normalisation, vCard, ZIP, sheets, SMS formats.
// Locks in the format knowledge absorbed from the owner's migration tools —
// every byte-layout claim (Nokia IB offsets, NBF filenames, FIG schema) is
// pinned here against synthetic fixtures so a refactor can't silently drift.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import zlib from 'node:zlib'

import { normalizeUkNumber, phoneKey } from '../lib/ukPhone.mjs'
import {
  vcardEscape, decodeQuotedPrintable, splitCards, parseCard, parseVcf,
  buildCard, dedupeCards, rewriteVcfTels,
} from '../lib/vcard.mjs'
import { crc32, unzip, makeZip } from '../lib/zipLite.mjs'
import { parseXlsx, parseCsv } from '../lib/sheetLite.mjs'
import {
  parseSmsBackupXml, FIG_KEYS, learnFigSchema, buildFigNdjson,
  nbfTimestampMs, parseNbf, parseNokiaIb,
} from '../lib/smsFormats.mjs'

// ── ukPhone ────────────────────────────────────────────────────────────────
test('normalizeUkNumber: national → +44 with punctuation stripped', () => {
  assert.equal(normalizeUkNumber('0161 531 1386'), '+441615311386')
  assert.equal(normalizeUkNumber('07911 123-456'), '+447911123456')
  assert.equal(normalizeUkNumber('(0161) 531.1386'), '+441615311386')
})
test('normalizeUkNumber: 00 international prefix and bare 44', () => {
  assert.equal(normalizeUkNumber('00447911123456'), '+447911123456')
  assert.equal(normalizeUkNumber('00 1 7181234567'), '+17181234567')
  assert.equal(normalizeUkNumber('447911123456'), '+447911123456')
})
test('normalizeUkNumber: leaves foreign and short numbers alone', () => {
  assert.equal(normalizeUkNumber('+9725812345678'), '+9725812345678')
  assert.equal(normalizeUkNumber('150'), '150')          // short code, not a UK national
})
test('normalizeUkNumber: alphanumeric sender IDs pass through', () => {
  assert.equal(normalizeUkNumber('LEBARA'), 'LEBARA')
  assert.equal(normalizeUkNumber(' HSBC '), 'HSBC')
})
test('normalizeUkNumber: output modes', () => {
  assert.equal(normalizeUkNumber('07911123456', { mode: '0044' }), '00447911123456')
  assert.equal(normalizeUkNumber('+447911123456', { mode: 'national' }), '07911123456')
  assert.equal(normalizeUkNumber('0161 531 1386', { mode: 'keep' }), '0161 531 1386')
})
test('phoneKey collapses formats to one identity', () => {
  assert.equal(phoneKey('07911 123456'), phoneKey('+447911123456'))
  assert.equal(phoneKey('07911 123456'), phoneKey('00447911123456'))
  assert.equal(phoneKey('Lebara'), 'LEBARA')
})

// ── vCard ──────────────────────────────────────────────────────────────────
test('vcardEscape escapes structure characters', () => {
  assert.equal(vcardEscape('a;b,c\\d\ne'), 'a\\;b\\,c\\\\d\\ne')
})
test('decodeQuotedPrintable decodes UTF-8 bytes and soft breaks', () => {
  assert.equal(decodeQuotedPrintable('=D7=A9=D7=9C=D7=95=D7=9D'), 'שלום')
  assert.equal(decodeQuotedPrintable('ab=\r\ncd'), 'abcd')
})
test('buildCard → parseCard roundtrip', () => {
  const raw = buildCard({ first: 'Menachem', last: 'Adler', phones: ['+447911123456', '0161 531 1386'], email: 'm@example.com' })
  const card = parseCard(raw)
  assert.equal(card.fn, 'Menachem Adler')
  assert.deepEqual(card.tels, ['+447911123456', '0161 531 1386'])
})
test('parseVcf handles 2.1 cards with QP names and derives FN from N', () => {
  const vcf = 'BEGIN:VCARD\r\nVERSION:2.1\r\nN;ENCODING=QUOTED-PRINTABLE;CHARSET=UTF-8:;=D7=A9=D7=9C=D7=95=D7=9D\r\nTEL;CELL:07911123456\r\nEND:VCARD\r\n'
  const cards = parseVcf(vcf)
  assert.equal(cards.length, 1)
  assert.equal(cards[0].fn, 'שלום')
  assert.deepEqual(cards[0].tels, ['07911123456'])
})
test('dedupeCards drops same name + same number set (any format)', () => {
  const cards = parseVcf([
    buildCard({ fullName: 'Yossi Adler', phones: ['07911123456'] }),
    buildCard({ fullName: 'yossi adler', phones: ['+447911123456'] }),
    buildCard({ fullName: 'Yossi Adler', phones: ['+447900000000'] }),
  ].join('\r\n'))
  const { kept, removed } = dedupeCards(cards, phoneKey)
  assert.equal(kept.length, 2)
  assert.equal(removed, 1)
})
test('rewriteVcfTels rewrites only TEL lines, counts changes', () => {
  const vcf = 'BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Test 0161\r\nNOTE:call 07911123456\r\nTEL;TYPE=CELL:07911 123456\r\nitem1.TEL:0161 531 1386\r\nEND:VCARD'
  const { text, found, changed } = rewriteVcfTels(vcf, (v) => normalizeUkNumber(v))
  assert.equal(found, 2)
  assert.equal(changed, 2)
  assert.match(text, /TEL;TYPE=CELL:\+447911123456/)
  assert.match(text, /item1\.TEL:\+441615311386/)
  assert.match(text, /FN:Test 0161/)                         // untouched
  assert.match(text, /NOTE:call 07911123456/)                // untouched
})

// ── zipLite ────────────────────────────────────────────────────────────────
test('crc32 matches the known check value', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926)
})
test('makeZip → unzip roundtrip (STORE)', async () => {
  const zip = makeZip([
    { name: 'messages.ndjson', data: '{"a":"1"}\n' },
    { name: 'data/PART_1', data: new Uint8Array([1, 2, 3]) },
  ])
  const entries = await unzip(zip)
  assert.deepEqual(entries.map((e) => e.name), ['messages.ndjson', 'data/PART_1'])
  assert.equal(new TextDecoder().decode(await entries[0].bytes()), '{"a":"1"}\n')
  assert.deepEqual([...(await entries[1].bytes())], [1, 2, 3])
})
test('unzip inflates DEFLATE members (the real-world NBF/FIG case)', async () => {
  // Hand-assemble a one-member deflated zip using node's raw deflate.
  const content = new TextEncoder().encode('hello deflate world '.repeat(20))
  const comp = zlib.deflateRawSync(content)
  const name = new TextEncoder().encode('predefmessages/1/x')
  const crc = crc32(content)
  const local = new Uint8Array(30 + name.length + comp.length)
  const ldv = new DataView(local.buffer)
  ldv.setUint32(0, 0x04034b50, true); ldv.setUint16(4, 20, true); ldv.setUint16(8, 8, true)
  ldv.setUint32(14, crc, true); ldv.setUint32(18, comp.length, true); ldv.setUint32(22, content.length, true)
  ldv.setUint16(26, name.length, true)
  local.set(name, 30); local.set(comp, 30 + name.length)
  const cen = new Uint8Array(46 + name.length)
  const cdv = new DataView(cen.buffer)
  cdv.setUint32(0, 0x02014b50, true); cdv.setUint16(4, 20, true); cdv.setUint16(6, 20, true)
  cdv.setUint16(10, 8, true); cdv.setUint32(16, crc, true)
  cdv.setUint32(20, comp.length, true); cdv.setUint32(24, content.length, true)
  cdv.setUint16(28, name.length, true); cdv.setUint32(42, 0, true)
  cen.set(name, 46)
  const eocd = new Uint8Array(22)
  const edv = new DataView(eocd.buffer)
  edv.setUint32(0, 0x06054b50, true); edv.setUint16(8, 1, true); edv.setUint16(10, 1, true)
  edv.setUint32(12, cen.length, true); edv.setUint32(16, local.length, true)
  const zip = new Uint8Array(local.length + cen.length + 22)
  zip.set(local, 0); zip.set(cen, local.length); zip.set(eocd, local.length + cen.length)

  const entries = await unzip(zip)
  assert.equal(entries.length, 1)
  assert.deepEqual(await entries[0].bytes(), content)
})

// ── sheetLite ──────────────────────────────────────────────────────────────
test('parseXlsx reads shared strings, inline strings and numbers', async () => {
  const sheet = `<?xml version="1.0"?><worksheet><sheetData>
    <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
    <row r="2"><c r="A2" t="inlineStr"><is><t>Yossi &amp; Co</t></is></c><c r="C2"><v>7911123456</v></c></row>
  </sheetData></worksheet>`
  const shared = `<?xml version="1.0"?><sst><si><t>Name</t></si><si><r><t>Pho</t></r><r><t>ne</t></r></si></sst>`
  const xlsx = makeZip([
    { name: 'xl/worksheets/sheet1.xml', data: sheet },
    { name: 'xl/sharedStrings.xml', data: shared },
  ])
  const rows = await parseXlsx(xlsx)
  assert.deepEqual(rows[0], ['Name', 'Phone'])
  assert.equal(rows[1][0], 'Yossi & Co')
  assert.equal(rows[1][2], '7911123456')
})
test('parseCsv: auto delimiter + quoted fields', () => {
  assert.deepEqual(parseCsv('a;b;"c;d"\n1;2;3'), [['a', 'b', 'c;d'], ['1', '2', '3']])
  assert.deepEqual(parseCsv('name,phone\n"Adler, Yossi","07911 123456"'), [['name', 'phone'], ['Adler, Yossi', '07911 123456']])
})

// ── smsFormats ─────────────────────────────────────────────────────────────
test('parseSmsBackupXml extracts attributes and decodes entities', () => {
  const xml = `<?xml version='1.0'?><smses count="2">
    <sms address="07911123456" date="1683237000000" type="1" body="hi &amp; bye" service_center="+447958879879" />
    <sms address="LEBARA" date="1683237100000" date_sent="1683237090000" type="2" body="top-up &#8216;done&#8217;" service_center="null" />
  </smses>`
  const msgs = parseSmsBackupXml(xml)
  assert.equal(msgs.length, 2)
  assert.equal(msgs[0].body, 'hi & bye')
  assert.equal(msgs[0].service_center, '+447958879879')
  assert.equal(msgs[1].service_center, '')
  assert.equal(msgs[1].body, 'top-up ‘done’')
})
test('parseSmsBackupXml rejects non-SMS XML', () => {
  assert.throws(() => parseSmsBackupXml('<contacts></contacts>'))
})
test('buildFigNdjson: default schema key order, threads per contact, normalisation', () => {
  const msgs = [
    { address: '07911123456', body: 'a', date: '1', date_sent: '0', type: '1' },
    { address: '+447911123456', body: 'b', date: '2', date_sent: '0', type: '2' },
    { address: 'LEBARA', body: 'c', date: '3', date_sent: '0', type: '1' },
  ]
  const { ndjson, count, threads } = buildFigNdjson(msgs, undefined, { normalizeAddress: (a) => normalizeUkNumber(a) })
  assert.equal(count, 3)
  assert.equal(threads, 2)                                   // same number = same thread
  const lines = ndjson.trim().split('\n').map((l) => JSON.parse(l))
  assert.deepEqual(Object.keys(lines[0]), FIG_KEYS)          // exact key order
  assert.equal(lines[0].address, '+447911123456')
  assert.equal(lines[1].thread_id, lines[0].thread_id)
  assert.equal(lines[2].address, 'LEBARA')
})
test('learnFigSchema pins sensible defaults but keeps the sample key order', () => {
  const sample = JSON.stringify({ _id: '9', thread_id: '4', phone: '07000', body: 'x', date: '5', read: '0', creator: 'other.app' })
  const schema = learnFigSchema(sample + '\n')
  assert.deepEqual(schema.keys, ['_id', 'thread_id', 'phone', 'body', 'date', 'read', 'creator'])
  assert.equal(schema.defaults.read, '1')                    // pinned
  assert.equal(schema.defaults.creator, 'com.figmessenger')  // pinned
  const { ndjson } = buildFigNdjson([{ address: '07911123456', body: 'y', date: '7', type: '1' }], schema)
  const rec = JSON.parse(ndjson.trim())
  assert.equal(rec.phone, '07911123456')                     // renamed field detected
  assert.equal(rec.body, 'y')
})
test('nbf: filename timestamp + full parse of synthetic entries', async () => {
  // hex 645436A6 = 1683240614 s → chars 8..16 of the base name
  const base = '00001000645436A6447911123456'
  assert.equal(nbfTimestampMs(base), String(0x645436a6 * 1000))

  const u16 = (s) => {
    const out = []
    for (const ch of s) { out.push(ch.charCodeAt(0) & 0xff, 0x00) }
    return out
  }
  const payload = new Uint8Array([
    0x01, 0x02, ...u16('+447911123456'), 0xff, ...u16('Gut Shabbos!'), 0x00, 0x00,
    ...'+447958879879'.split('').map((c) => c.charCodeAt(0)), 0x00,
  ])
  const entries = [
    { name: `predefmessages/1/${base}`, dir: false, bytes: async () => payload },
    { name: 'predefmessages/3/0000100064543700447900000000', dir: false, bytes: async () => new Uint8Array(u16('07900000000').concat(u16('ok'))) },
  ]
  const msgs = await parseNbf(entries)
  assert.equal(msgs.length, 2)
  assert.equal(msgs[0].type, '1')
  assert.equal(msgs[0].address, '+447911123456')
  assert.equal(msgs[0].body, 'Gut Shabbos!')
  assert.equal(msgs[0].service_center, '+447958879879')
  assert.equal(msgs[1].type, '2')
})
test('parseNokiaIb decodes a synthetic 592-byte record', () => {
  const data = new Uint8Array(0x244 + 592 * 2)
  const off = 0x244
  // name at +0x60: length-prefixed UTF-16LE "Rivky"
  const name = 'Rivky'
  data[off + 0x60] = name.length
  for (let i = 0; i < name.length; i++) data[off + 0x60 + 2 + i * 2] = name.charCodeAt(i)
  // phone at +0x1E: BCD "447911123456" with type 0x11 (international ⇒ +)
  const digits = '447911123456'
  data[off + 0x1e] = Math.ceil(digits.length / 2) + 1       // +1 byte for the 0xFF terminator
  data[off + 0x1e + 1] = 0x11
  for (let i = 0; i < digits.length; i += 2) {
    const lo = digits.charCodeAt(i) - 48
    const hi = i + 1 < digits.length ? digits.charCodeAt(i + 1) - 48 : 0xf
    data[off + 0x1e + 2 + i / 2] = (hi << 4) | lo
  }
  data[off + 0x1e + 2 + digits.length / 2] = 0xff           // BCD terminator
  const contacts = parseNokiaIb(data)
  assert.equal(contacts.length, 1)
  assert.equal(contacts[0].name, 'Rivky')
  assert.deepEqual(contacts[0].phones, ['+447911123456'])
})
