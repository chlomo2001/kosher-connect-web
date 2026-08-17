import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isStopKeyword, isStartKeyword, matchCustomerByPhone, inboundLogRow, inboundSummary,
} from '../lib/inboundSms.mjs'

test('the stop words carriers and the law recognise', () => {
  for (const w of ['STOP', 'stop', 'Stop.', 'STOPALL', 'unsubscribe', 'CANCEL', 'end', 'QUIT']) {
    assert.equal(isStopKeyword(w), true, w)
  }
})

test('a sentence containing "stop" is a sentence, not an opt-out', () => {
  for (const s of ['stop sending me the £20 one', 'can you stop the rental', 'please stop by tomorrow']) {
    assert.equal(isStopKeyword(s), false, s)
  }
  assert.equal(isStopKeyword(''), false)
  assert.equal(isStopKeyword(null), false)
})

test('START puts them back on', () => {
  assert.equal(isStartKeyword('START'), true)
  assert.equal(isStartKeyword('yes'), true)
  assert.equal(isStartKeyword('yes please, tomorrow'), false)
})

const CUSTOMERS = [
  { id: '1', firstName: 'Menachem', phone: '07911 123456' },
  { id: '2', firstName: 'Yossi', phone: '+44 7700 900123' },
  { id: '3', firstName: 'Rivka', phone: '+972 54 412 3456' },
  { id: '4', firstName: 'Chaim', phone: '0161 531 1386', altPhone: '07871 385566' },
]

test('a UK number matches however either side wrote it', () => {
  // The shop stores 07911…, Twilio delivers +447911… — they agree from the right.
  assert.equal(matchCustomerByPhone('+447911123456', CUSTOMERS)?.id, '1')
  assert.equal(matchCustomerByPhone('07911123456', CUSTOMERS)?.id, '1')
  assert.equal(matchCustomerByPhone('+44 7700 900 123', CUSTOMERS)?.id, '2')
})

test('an international number matches too', () => {
  assert.equal(matchCustomerByPhone('+972544123456', CUSTOMERS)?.id, '3')
})

test('the second number on a record is matched as well', () => {
  assert.equal(matchCustomerByPhone('+447871385566', CUSTOMERS)?.id, '4')
})

test('no match, and an ambiguous match, both return null rather than a guess', () => {
  assert.equal(matchCustomerByPhone('+447000000000', CUSTOMERS), null)
  assert.equal(matchCustomerByPhone('', CUSTOMERS), null)
  assert.equal(matchCustomerByPhone('12345', CUSTOMERS), null)
  // Two customers sharing a tail: filing it against either would be a coin toss.
  const twins = [{ id: 'a', phone: '07911123456' }, { id: 'b', phone: '+447911123456' }]
  assert.equal(matchCustomerByPhone('+447911123456', twins), null)
})

test('the log row keeps the customer on the OTHER-party column, either direction', () => {
  const row = inboundLogRow({
    from: '+447911123456', to: '+441615311386', body: 'Yes that is fine, thanks',
    messageSid: 'SM123', customerId: '1',
  })
  assert.equal(row.kind, 'sms_in')
  assert.equal(row.to_email, '+447911123456')   // the customer, as on outbound rows
  assert.equal(row.actual_to, '+441615311386')  // our own number
  assert.equal(row.subject, 'Yes that is fine, thanks')
  assert.equal(row.status, 'received')
  assert.equal(row.provider, 'twilio')
  assert.equal(row.customer_id, '1')
})

test('an opt-out is logged as one, so nobody wonders why the texts stopped', () => {
  const row = inboundLogRow({ from: '+447911123456', to: '+441615311386', body: 'STOP', messageSid: 'SM9' })
  assert.equal(row.status, 'opt_out')
  assert.equal(row.customer_id, null)
})

test('a long message is stored to the same 160 the outbound rows use', () => {
  const row = inboundLogRow({ from: '+1', to: '+2', body: 'x'.repeat(400), messageSid: 'SM1' })
  assert.equal(row.subject.length, 160)
})

test('the one-line summary names the person when we know them', () => {
  assert.equal(
    inboundSummary({ from: '+447911123456', body: 'on my way', customerName: 'Menachem Adler' }),
    'Menachem Adler: on my way',
  )
  assert.equal(inboundSummary({ from: '+447911123456', body: 'on my way' }), '+447911123456: on my way')
  assert.match(inboundSummary({ from: '+44', body: 'STOP', customerName: 'Yossi' }), /asked to stop/)
  assert.match(inboundSummary({ from: '+44', body: 'y'.repeat(200) }), /…$/)
})
