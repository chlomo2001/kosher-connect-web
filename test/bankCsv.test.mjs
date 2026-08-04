// Bank statement CSV import. Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseAmount, parseDate, detectDateOrder, mapColumns, parseStatementCsv,
} from '../lib/bankCsv.mjs'

test('parseAmount — the shapes banks actually export', () => {
  assert.equal(parseAmount('1234.56'), 1234.56)
  assert.equal(parseAmount('£1,234.56'), 1234.56)
  assert.equal(parseAmount('(50.00)'), -50)      // accountancy brackets
  assert.equal(parseAmount('75.00-'), -75)       // trailing minus
  assert.equal(parseAmount('-75.00'), -75)
  assert.equal(parseAmount('12.34 CR'), 12.34)
  assert.equal(parseAmount('12.34 DR'), -12.34)
  assert.equal(parseAmount(''), null)
  assert.equal(parseAmount('Balance'), null)     // a header leaking into a row
})

test('parseDate — ISO, UK and named-month', () => {
  assert.equal(parseDate('2026-07-31'), '2026-07-31')
  assert.equal(parseDate('31/07/2026'), '2026-07-31')
  assert.equal(parseDate('31-07-2026'), '2026-07-31')
  assert.equal(parseDate('31 Jul 2026'), '2026-07-31')
  assert.equal(parseDate('07/31/2026', 'MDY'), '2026-07-31')
  assert.equal(parseDate('not a date'), null)
})

test('detectDateOrder — proves the order from the data, not the locale', () => {
  // A day above 12 can only be a day.
  assert.deepEqual(detectDateOrder(['05/06/2026', '31/07/2026']), { order: 'DMY', proven: true, conflict: false })
  assert.deepEqual(detectDateOrder(['06/05/2026', '07/31/2026']), { order: 'MDY', proven: true, conflict: false })
  // Nothing above 12 anywhere — unprovable, so assume UK and warn.
  assert.deepEqual(detectDateOrder(['05/06/2026', '07/08/2026']), { order: 'DMY', proven: false, conflict: false })
  // Both directions "proven" — the file is inconsistent and must not be trusted.
  assert.deepEqual(detectDateOrder(['31/07/2026', '07/31/2026']), { order: 'DMY', proven: false, conflict: true })
})

test('detectDateOrder — one file decides once, so no row is read the other way', () => {
  // 05/06 alone is ambiguous, but 31/07 in the same file proves day-first, and
  // the whole file follows. Deciding per row would read this one as 6 May.
  const csv = 'Date,Description,Amount\n05/06/2026,COFFEE,-3.50\n31/07/2026,WAGES,-900.00\n'
  const { rows, dateOrder } = parseStatementCsv(csv, { accountRef: 'acc' })
  assert.equal(dateOrder.proven, true)
  assert.equal(rows[0].bookedAt, '2026-06-05')
  assert.equal(rows[1].bookedAt, '2026-07-31')
})

test('mapColumns — "transaction date" is not claimed by "date"', () => {
  const m = mapColumns(['Transaction Date', 'Description', 'Amount', 'Balance'])
  assert.equal(m.date, 0)
  assert.equal(m.description, 1)
  assert.equal(m.amount, 2)
  assert.equal(m.balance, 3)
})

test('signed Amount column — Barclays/Monzo shape', () => {
  const csv = [
    'Date,Description,Amount',
    '30/07/2026,BGC BNKYRW KOPILOWITZ,285.00',
    '29/07/2026,CARD PAYMENT,-42.15',
  ].join('\n')
  const { rows, warnings } = parseStatementCsv(csv, { accountRef: 'acc' })
  assert.equal(rows.length, 2)
  assert.equal(rows[0].amount, 285)
  assert.equal(rows[1].amount, -42.15)
  assert.equal(warnings.length, 0)
})

test('split Paid In / Paid Out — the column carries the sign', () => {
  // Both columns hold POSITIVE figures; money out must still come back negative,
  // matching the ledger's convention.
  const csv = [
    'Date,Description,Paid Out,Paid In',
    '30/07/2026,REFUND TO CUSTOMER,285.00,',
    '29/07/2026,BANK CREDIT,,90.00',
  ].join('\n')
  const { rows } = parseStatementCsv(csv, { accountRef: 'acc' })
  assert.equal(rows[0].amount, -285)
  assert.equal(rows[1].amount, 90)
})

test('preamble above the header is skipped, junk rows are counted', () => {
  const csv = [
    'Your statement,,',
    'Account 12345678,,',
    '',
    'Date,Description,Amount',
    '30/07/2026,PAYMENT,50.00',
    'Closing balance,,1234.00',      // no date — skipped
  ].join('\n')
  const { rows, warnings } = parseStatementCsv(csv, { accountRef: 'acc' })
  assert.equal(rows.length, 1)
  assert.match(warnings.join(' '), /preamble/)
  assert.match(warnings.join(' '), /1 row skipped/)
})

test('re-importing the same statement yields the same ids', () => {
  // The whole point: the unique constraint absorbs a repeat import instead of
  // doubling every row in a table that feeds an append-only ledger.
  const csv = 'Date,Description,Amount\n30/07/2026,PAYMENT,50.00\n29/07/2026,FEE,-3.00\n'
  const a = parseStatementCsv(csv, { accountRef: 'acc' })
  const b = parseStatementCsv(csv, { accountRef: 'acc' })
  assert.deepEqual(a.rows.map((r) => r.providerTxnId), b.rows.map((r) => r.providerTxnId))
})

test('overlapping windows dedupe on the shared rows only', () => {
  const jan = 'Date,Description,Amount\n05/01/2026,A,10.00\n06/01/2026,B,20.00\n'
  const feb = 'Date,Description,Amount\n06/01/2026,B,20.00\n07/01/2026,C,30.00\n'
  const ids = (csv) => parseStatementCsv(csv, { accountRef: 'acc' }).rows.map((r) => r.providerTxnId)
  const [janIds, febIds] = [ids(jan), ids(feb)]
  const shared = janIds.filter((i) => febIds.includes(i))
  assert.equal(shared.length, 1)                                  // only row B
  assert.equal(new Set([...janIds, ...febIds]).size, 3)           // A, B, C
})

test('two genuinely identical movements on one day both survive', () => {
  // Same date, same amount, same description — two real £20 withdrawals. They
  // must not collapse into one, so the occurrence index separates them.
  const csv = 'Date,Description,Amount\n30/07/2026,CASH,-20.00\n30/07/2026,CASH,-20.00\n'
  const { rows } = parseStatementCsv(csv, { accountRef: 'acc' })
  assert.equal(rows.length, 2)
  assert.notEqual(rows[0].providerTxnId, rows[1].providerTxnId)
})

test('the same movement in two different accounts is not the same movement', () => {
  const csv = 'Date,Description,Amount\n30/07/2026,PAYMENT,50.00\n'
  const one = parseStatementCsv(csv, { accountRef: 'business' }).rows[0]
  const two = parseStatementCsv(csv, { accountRef: 'personal' }).rows[0]
  assert.notEqual(one.providerTxnId, two.providerTxnId)
})

// The shop's likely bank. Real export shape: completed/started date pair, the
// bank's own ID, a State lifecycle column, Description AND Reference, Payer,
// and a Fee booked BESIDE the amount rather than inside it.
const REVOLUT = [
  'Date started (UTC),Date completed (UTC),ID,Type,State,Description,Reference,Payer,Orig currency,Orig amount,Payment currency,Amount,Fee,Balance,Account',
  '2026-07-29 09:11:03,2026-07-30 09:12:00,rev-001,TRANSFER,COMPLETED,Incoming transfer,BNKYRW,KOPILOWITZ M,GBP,285.00,GBP,285.00,0.00,1520.44,Main',
  '2026-07-30 11:00:00,2026-07-30 11:00:04,rev-002,CARD_PAYMENT,COMPLETED,Amazon,order 123,,GBP,42.15,GBP,-42.15,0.20,1478.09,Main',
  '2026-07-31 08:00:00,,rev-003,TRANSFER,DECLINED,Outgoing transfer,,SUPPLIER LTD,GBP,900.00,GBP,-900.00,0.00,,Main',
].join('\n')

test('Revolut Business export — columns, fee netting, dead rows', () => {
  const { rows, warnings } = parseStatementCsv(REVOLUT, { accountRef: 'revolut-main' })
  assert.equal(rows.length, 2)                    // the DECLINED row never moved money
  assert.match(warnings.join(' '), /declined, reverted or still pending/)
  // Completed date, not started date.
  assert.equal(rows[0].bookedAt, '2026-07-30')
  // Payer lands as the counterparty; Reference rides with the description so a
  // PNR in it stays findable by the matcher.
  assert.equal(rows[0].counterpartyName, 'KOPILOWITZ M')
  assert.match(rows[0].description, /BNKYRW/)
  // The balance change is Amount − Fee: −42.15 with a 0.20 fee is −42.35.
  assert.equal(rows[1].amount, -42.35)
})

test('Revolut Business export — the bank id is the idempotency key', () => {
  const a = parseStatementCsv(REVOLUT, { accountRef: 'revolut-main' })
  // Same rows exported again in a wider window → identical ids, so the unique
  // constraint absorbs the overlap.
  const b = parseStatementCsv(REVOLUT, { accountRef: 'revolut-main' })
  assert.deepEqual(a.rows.map((r) => r.providerTxnId), b.rows.map((r) => r.providerTxnId))
  assert.match(a.rows[0].providerTxnId, /^bank:/)
  // A second account label is a different account — never the same movement.
  const other = parseStatementCsv(REVOLUT, { accountRef: 'revolut-savings' })
  assert.notEqual(a.rows[0].providerTxnId, other.rows[0].providerTxnId)
})

test('an unrecognisable file explains itself instead of importing nothing quietly', () => {
  const { rows, warnings } = parseStatementCsv('Foo,Bar\n1,2\n', { accountRef: 'acc' })
  assert.equal(rows.length, 0)
  assert.match(warnings.join(' '), /Could not find a header row/)
})

test('unprovable date order is warned about, not assumed silently', () => {
  const csv = 'Date,Description,Amount\n05/06/2026,A,10.00\n07/08/2026,B,20.00\n'
  const { warnings, rows } = parseStatementCsv(csv, { accountRef: 'acc' })
  assert.match(warnings.join(' '), /cannot be proven/)
  assert.equal(rows[0].bookedAt, '2026-06-05')  // UK assumption stated
})
