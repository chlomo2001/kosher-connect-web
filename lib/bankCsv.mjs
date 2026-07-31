// Bank statement CSV → bank_transactions rows. Pure, no I/O.
//
// The owner exports a statement and hands it over; nothing has standing access
// to the account. That is the whole point while the shop's money still runs
// through a personal account (docs/OPEN-BANKING.md) — he chooses what to share,
// each time.
//
// Three things make this harder than it looks, and each is a way to silently
// corrupt money data:
//
//   1. Every UK bank exports a different shape. Some give one signed `Amount`,
//      others split `Paid In` / `Paid Out` where BOTH columns hold positive
//      numbers and the column is the sign.
//   2. Dates are ambiguous. 05/06/2026 is 5 June here and 6 May in a US export.
//      Guessing per-row would mix both inside one file, so the order is decided
//      once for the whole file, from the rows that can prove it.
//   3. There is no transaction id. Re-importing an overlapping window would
//      double every shared row, and the ledger it feeds is append-only.

import { parseCsv } from './sheetLite.mjs'

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }

const normHeader = (h) => String(h || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// Longest-match-first so "transaction date" doesn't get claimed by "date".
const COLUMN_ALIASES = [
  ['date',         ['transaction date', 'value date', 'completed date', 'posting date', 'date value', 'date']],
  ['paidIn',       ['paid in', 'money in', 'credit amount', 'credits', 'credit', 'in']],
  ['paidOut',      ['paid out', 'money out', 'debit amount', 'debits', 'debit', 'out', 'withdrawn']],
  ['amount',       ['transaction amount', 'amount gbp', 'amount', 'value']],
  ['counterparty', ['counter party', 'counterparty', 'payee', 'to from', 'name']],
  ['description',  ['transaction description', 'description', 'narrative', 'details', 'reference', 'memo', 'transaction', 'type']],
  ['balance',      ['running balance', 'balance']],
]

export function mapColumns(headerRow) {
  const norm = (headerRow || []).map(normHeader)
  const used = new Set()
  const map = {}
  for (const [field, aliases] of COLUMN_ALIASES) {
    for (const alias of aliases) {
      const i = norm.findIndex((h, idx) => h === alias && !used.has(idx))
      if (i > -1) { map[field] = i; used.add(i); break }
    }
  }
  return map
}

// "£1,234.56" · "(50.00)" · "75.00-" · "12.34 CR" → a number, or null.
export function parseAmount(raw) {
  let s = String(raw ?? '').trim()
  if (!s) return null
  let sign = 1
  if (/^\(.*\)$/.test(s)) { sign = -1; s = s.slice(1, -1) }
  if (/\bDR\b/i.test(s)) sign = -1
  if (/\bCR\b/i.test(s)) sign = 1
  s = s.replace(/\b[CD]R\b/gi, '').replace(/[£$€,\s]/g, '')
  if (/-$/.test(s)) { sign = -1; s = s.slice(0, -1) }
  if (/^-/.test(s)) { sign = -1; s = s.slice(1) }
  if (!/^\d*\.?\d+$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? Math.round(sign * n * 100) / 100 : null
}

// Splits a date into its parts without deciding what they mean yet.
function dateParts(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return null
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)          // ISO — unambiguous
  if (m) return { y: +m[1], a: +m[2], b: +m[3], iso: true }
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/) // a/b/yyyy — ambiguous
  if (m) {
    let y = +m[3]
    if (y < 100) y += y < 70 ? 2000 : 1900
    return { y, a: +m[1], b: +m[2], iso: false }
  }
  m = s.match(/^(\d{1,2})\s*([A-Za-z]{3})[a-z]*\.?\s*(\d{2,4})/) // 31 Jul 2026
  if (m && MONTHS[m[2].toLowerCase()]) {
    let y = +m[3]
    if (y < 100) y += y < 70 ? 2000 : 1900
    return { y, a: +m[1], b: MONTHS[m[2].toLowerCase()], iso: false, named: true }
  }
  return null
}

// Decides day/month order ONCE for the whole file. A value over 12 in either
// position proves which is which; if nothing proves it, UK order is assumed
// because that is where the shop banks — and the caller is warned, because an
// unprovable file is exactly where a silent month/day swap would hide.
export function detectDateOrder(rawDates) {
  let dayFirst = 0, monthFirst = 0
  for (const raw of rawDates) {
    const p = dateParts(raw)
    if (!p || p.iso || p.named) continue
    if (p.a > 12) dayFirst++
    if (p.b > 12) monthFirst++
  }
  if (dayFirst && monthFirst) return { order: 'DMY', proven: false, conflict: true }
  if (dayFirst) return { order: 'DMY', proven: true, conflict: false }
  if (monthFirst) return { order: 'MDY', proven: true, conflict: false }
  return { order: 'DMY', proven: false, conflict: false }
}

const pad = (n) => String(n).padStart(2, '0')

export function parseDate(raw, order = 'DMY') {
  const p = dateParts(raw)
  if (!p) return null
  const [d, mo] = (p.iso || p.named || order === 'DMY') ? [p.iso ? p.b : p.a, p.iso ? p.a : p.b] : [p.b, p.a]
  const day = p.iso ? p.b : d
  const month = p.iso ? p.a : mo
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${p.y}-${pad(month)}-${pad(day)}`
}

// FNV-1a. A short deterministic digest with no dependency — this only has to be
// stable and well-spread, not cryptographic.
function digest(s) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(36)
}

// A statement has no transaction id, so one is synthesised from the fields that
// identify the movement, plus its position among identical siblings.
//
// This is what makes a re-import safe. The same statement, or an overlapping
// window, yields the same ids and the table's unique constraint absorbs them.
// The occurrence suffix is what stops it going too far: two genuine £20 cash
// withdrawals on one day are different movements and must both survive, so they
// become :0 and :1 rather than collapsing into one.
export function synthesiseTxnId(accountRef, row, occurrence) {
  return `csv:${digest([accountRef, row.bookedAt, row.amount.toFixed(2), row.description || ''].join('|'))}:${occurrence}`
}

export function parseStatementCsv(text, opts = {}) {
  const accountRef = opts.accountRef || 'unknown'
  const provider = opts.provider || 'csv'
  const currency = opts.currency || 'GBP'
  const warnings = []

  const table = parseCsv(text)
  if (!table.length) return { rows: [], warnings: ['The file is empty.'], columns: {}, dateOrder: null }

  // Some exports carry preamble lines before the real header. Take the first
  // row that maps to a usable shape.
  let headerIdx = -1, columns = {}
  for (let i = 0; i < Math.min(table.length, 15); i++) {
    const m = mapColumns(table[i])
    if (m.date != null && (m.amount != null || m.paidIn != null || m.paidOut != null)) {
      headerIdx = i; columns = m; break
    }
  }
  if (headerIdx === -1) {
    return {
      rows: [],
      warnings: ['Could not find a header row with a date and an amount. Expected something like "Date, Description, Amount" or "Date, Description, Paid Out, Paid In".'],
      columns: {}, dateOrder: null,
    }
  }
  if (headerIdx > 0) warnings.push(`Skipped ${headerIdx} line${headerIdx === 1 ? '' : 's'} of preamble above the header.`)

  const body = table.slice(headerIdx + 1)
  const cell = (r, i) => (i == null ? '' : (r[i] ?? ''))

  const dateOrder = detectDateOrder(body.map((r) => cell(r, columns.date)))
  if (dateOrder.conflict) {
    warnings.push('Dates disagree about day/month order — some rows read as day-first and others as month-first. Treated as UK day-first; check a few rows before trusting this import.')
  } else if (!dateOrder.proven) {
    warnings.push('No date in this file has a day above 12, so day/month order cannot be proven. Assumed UK day-first.')
  }

  const parsed = []
  let skipped = 0
  for (const r of body) {
    const bookedAt = parseDate(cell(r, columns.date), dateOrder.order)
    if (!bookedAt) { skipped++; continue }

    // A signed Amount column wins; otherwise Paid In / Paid Out, where the
    // column carries the sign and the figure itself is usually positive.
    let amount = null
    if (columns.amount != null) amount = parseAmount(cell(r, columns.amount))
    if (amount == null && (columns.paidIn != null || columns.paidOut != null)) {
      const inAmt = parseAmount(cell(r, columns.paidIn))
      const outAmt = parseAmount(cell(r, columns.paidOut))
      if (inAmt != null && inAmt !== 0) amount = Math.abs(inAmt)
      else if (outAmt != null && outAmt !== 0) amount = -Math.abs(outAmt)
    }
    if (amount == null || amount === 0) { skipped++; continue }

    const description = String(cell(r, columns.description) || '').trim()
    const counterpartyName = String(cell(r, columns.counterparty) || '').trim() || null

    parsed.push({
      provider,
      accountRef,
      bookedAt,
      amount,
      currency,
      description: description || null,
      counterpartyName,
      raw: { row: r, columns: Object.keys(columns) },
    })
  }
  if (skipped) warnings.push(`${skipped} row${skipped === 1 ? '' : 's'} skipped — no readable date or amount (totals and blank lines usually).`)

  // Assign occurrence indices across identical movements, in file order.
  const seen = new Map()
  const rows = parsed.map((row) => {
    const key = [row.bookedAt, row.amount.toFixed(2), row.description || ''].join('|')
    const n = seen.get(key) || 0
    seen.set(key, n + 1)
    return { ...row, providerTxnId: synthesiseTxnId(accountRef, row, n) }
  })

  return { rows, warnings, columns, dateOrder }
}
