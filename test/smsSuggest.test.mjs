// Suggested replies, and the browser copy of them.
//
// Owner, 27 Aug, item 8: an auto-suggested reply draft. The build this WANTS to
// be is a keyword matcher over the customer's words; production says that would
// almost never fire. Every inbound text the shop has ever received, read on
// 28 Aug: "?", "Hello", "K", "Ok..", one referral spam sent twice, and one real
// question. Five of seven say nothing answerable at all.
//
// So the module is context-led and word-steered, and this holds it to that:
// a text with no content still produces the reply the RECORD justifies, a text
// with content gets that answered first, and nothing is ever offered whose
// facts are missing — an empty promise in the reply box is worse than no chip.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { suggestReplies, readIntent } from '../lib/smsSuggest.mjs'

const SRC = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')
const lift = () => {
  const m = SRC.match(/\/\/ ── KC_SUGGEST mirror start ──\n([\s\S]*?)\n\/\/ ── KC_SUGGEST mirror end ──/)
  assert.ok(m, 'KC_SUGGEST mirror region not found in public/main.js')
  return new Function(`${m[1]}; return KC_SUGGEST;`)()
}

const FMT = { date: (v) => `D(${v})`, gbp: (v) => `£${(Number(v) || 0).toFixed(2)}`, phone: (v) => `P(${v})` }

// The real inbound texts, plus the ones the shop will get once customers know
// they can text it.
const TEXTS = [
  '?', 'Hello ', 'K', 'Ok..', '', '   ',
  'Hi there, any qlyx phones available?',
  'how much is it for a week?',
  'can i extend it another week',
  'what time are you open till',
  'is my phone ready to collect?',
  'i paid it by transfer yesterday',
  'thanks',
  'Thank you',
  'my sister needs a phone for her seminary trip, can you sort it',
]

const CTXS = [
  {},
  { shopPhone: '0161 531 1386' },
  { firstName: 'Menachem Adler', shopPhone: '0161 531 1386' },
  { firstName: 'Yossi', owed: 87, shopPhone: '0161 531 1386' },
  { firstName: 'Yossi', overdue: [{ number: '+447911123456', toDate: '2026-08-20' }] },
  { firstName: 'Yossi', overdue: [{ number: '', toDate: '2026-08-20' }] },
  { firstName: 'Yossi', live: [{ number: '+447911123456', toDate: '2026-09-04' }] },
  { firstName: 'Rivka', readyRepair: { device: 'Nokia 105' } },
  { firstName: 'Rivka', readyRepair: {} },
  { firstName: 'Chaim', trip: { route: 'MAN-TLV', travelDate: '2026-09-02' } },
  { firstName: 'Chaim', trip: { travelDate: '2026-09-02' } },
  { firstName: 'Chaim', rate: { perDay: 3, cap: 50, capDays: 30 }, live: [{ toDate: '2026-09-04' }] },
  { firstName: 'Chaim', rate: { perDay: 3, cap: 0, capDays: 30 } },
  {
    firstName: 'Menachem', owed: 140, shopPhone: '0161 531 1386',
    overdue: [{ number: '+15185550101', toDate: '2026-08-11' }],
    readyRepair: { device: 'FIG Core' }, trip: { route: 'MAN-TLV', travelDate: '2026-09-01' },
    rate: { perDay: 5, cap: 90, capDays: 30 },
  },
]

test('the browser mirror suggests exactly what the lib suggests', () => {
  const B = lift()
  for (const text of TEXTS) {
    for (const ctx of CTXS) {
      assert.deepEqual(B.suggestReplies(text, ctx, FMT), suggestReplies(text, ctx, FMT),
        `${JSON.stringify(text)} / ${JSON.stringify(ctx)}`)
      assert.equal(B.readIntent(text), readIntent(text), JSON.stringify(text))
    }
  }
})

test('the words are read when they say something', () => {
  assert.equal(readIntent('Hi there, any qlyx phones available?'), 'availability')
  assert.equal(readIntent('how much is it for a week?'), 'price')
  assert.equal(readIntent('can i extend it another week'), 'extend')
  assert.equal(readIntent('what time are you open till'), 'hours')
  assert.equal(readIntent('is my phone ready to collect?'), 'collect')
  assert.equal(readIntent('i paid it by transfer yesterday'), 'payment')
  assert.equal(readIntent('thanks'), 'ack')
  assert.equal(readIntent('K'), 'ack')
  assert.equal(readIntent('Ok..'), 'ack')
  assert.equal(readIntent('?'), 'none')       // punctuation only — nothing to read
  assert.equal(readIntent(''), 'none')
  assert.equal(readIntent('my sister needs a phone'), 'other')
})

// The more specific reading wins. "how much to extend it" is somebody asking
// about their hire, not for the price list.
test('a text holding two readings takes the specific one', () => {
  assert.equal(readIntent('how much to extend it another week?'), 'extend')
  assert.equal(readIntent('do you have any available and how much'), 'availability')
})

test('a text saying nothing still gets what the record justifies', () => {
  const ctx = { firstName: 'Yossi', overdue: [{ number: '+447911123456', toDate: '2026-08-20' }], owed: 87 }
  const ids = suggestReplies('?', ctx, FMT).map((s) => s.id)
  assert.deepEqual(ids, ['overdue', 'owed', 'ask'])
})

test('what they asked is answered before what is on the record', () => {
  const ctx = {
    firstName: 'Yossi', owed: 87, rate: { perDay: 3, cap: 50, capDays: 30 },
    overdue: [{ number: '+447911123456', toDate: '2026-08-20' }],
  }
  assert.equal(suggestReplies('how much is it?', ctx, FMT)[0].id, 'price')
  assert.equal(suggestReplies('?', ctx, FMT)[0].id, 'overdue')
})

test('nothing is offered whose facts are missing', () => {
  // No rate on file — the price question gets no priced answer, not a blank one.
  const noRate = suggestReplies('how much is it?', { firstName: 'Yossi' }, FMT)
  assert.ok(!noRate.some((s) => s.id === 'price'))
  // No hire — nothing to extend.
  const noHire = suggestReplies('can i extend', { firstName: 'Yossi' }, FMT)
  assert.ok(!noHire.some((s) => s.id === 'extend'))
  // No shop number configured — no "ring us" reply naming one.
  const noPhone = suggestReplies('what time are you open', { firstName: 'Yossi' }, FMT)
  assert.ok(!noPhone.some((s) => s.id === 'hours'))
  // A repair not on the shelf gets "we will check", never "it is ready".
  const notReady = suggestReplies('is it ready?', { firstName: 'Yossi' }, FMT).map((s) => s.id)
  assert.ok(notReady.includes('checking') && !notReady.includes('collect'))
})

test('there is always exactly one reply to fall back on', () => {
  for (const text of TEXTS) {
    for (const ctx of CTXS) {
      const out = suggestReplies(text, ctx, FMT)
      assert.ok(out.length >= 1, `nothing offered for ${JSON.stringify(text)}`)
      assert.ok(out.length <= 3, `${out.length} chips is a decision, not a shortcut`)
      for (const s of out) {
        assert.ok(s.id && s.label && s.body, JSON.stringify(s))
        assert.ok(s.label.length <= 24, `"${s.label}" is too long for a chip`)
      }
      assert.equal(new Set(out.map((s) => s.id)).size, out.length, 'the same reply twice')
    }
  }
})

test('a name is used only when there is one', () => {
  assert.match(suggestReplies('?', { firstName: 'Menachem Adler' }, FMT)[0].body, /^Hi Menachem, /)
  assert.doesNotMatch(suggestReplies('?', {}, FMT)[0].body, /^Hi /)
  assert.doesNotMatch(suggestReplies('?', { firstName: '   ' }, FMT)[0].body, /^Hi /)
})

// A reply is sent about as often as it is offered, so it is billed like one.
const GSM7 = '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?'
  + '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'
  + '^{}\\[~]|€'
test('every suggested reply is billable as GSM-7', () => {
  const fmt = { date: () => '20 Aug 2026', gbp: (v) => `£${Number(v).toFixed(2)}`, phone: () => '+44 7911 123 456' }
  for (const text of TEXTS) {
    for (const ctx of CTXS) {
      for (const s of suggestReplies(text, ctx, fmt)) {
        for (const ch of s.body) {
          assert.ok(GSM7.includes(ch), `${JSON.stringify(ch)} in "${s.body}" is not GSM-7`)
        }
      }
    }
  }
})

// A suggestion is a guess, and a guess sitting in the reply box is a guess
// somebody sends without reading. The counter's own words have to be a press.
test('the app offers the drafts, it does not pre-fill them', () => {
  assert.match(SRC, /function smsSuggestChipsHtml\(t\)/)
  assert.match(SRC, /class="sms-suggest-chip"/)
  const open = SRC.match(/function openThread\(key\)[\s\S]*?\n}/)[0]
  assert.doesNotMatch(open, /smsReplyText[^>]*>\$\{/, 'the reply box is being pre-filled with a guess')
})

// One number, two customer records — the seed carries that pair on purpose
// (Yossi Taitelbaum / Yoisef Teitelboim). The facts still hold for whoever
// answers; the first name does not.
test('a number shared by two records is not greeted by name', () => {
  const fn = SRC.match(/function smsSuggestContext\(t\)[\s\S]*?\n}/)[0]
  assert.match(fn, /const solo = hits\.length === 1/)
  assert.match(fn, /firstName: solo \?/)
})
