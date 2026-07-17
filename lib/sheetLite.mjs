// Spreadsheet reading for the contacts converter — dependency-free.
//
// .xlsx: a ZIP of XML (unzipped with lib/zipLite). We read the first worksheet
// plus sharedStrings, which covers what a contact list actually is: text and
// numbers in cells. No styles, no dates-as-serials, no formulas evaluated —
// a phone list needs none of that (and the owner's lists never did).
// .csv: the owner's offline tool's approach — auto-detect , ; or tab from the
// first line, honest quoted-field parser.
// Legacy .xls (BIFF) is intentionally NOT parsed — the page asks for a re-save
// as .xlsx/.csv instead of shipping a binary BIFF decoder.

import { unzip } from './zipLite.mjs'

const XML_ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
export function decodeXmlEntities(s) {
  return String(s || '').replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : m
    }
    return XML_ENT[e] ?? m
  })
}

const colToIndex = (ref) => {
  let n = 0
  for (const ch of ref) {
    if (ch >= 'A' && ch <= 'Z') n = n * 26 + (ch.charCodeAt(0) - 64)
    else break
  }
  return n - 1
}

// Concatenate every <t> run inside a block (handles rich-text <r> runs).
const textRuns = (xml) => {
  let out = ''
  const re = /<t[^>]*>([\s\S]*?)<\/t>|<t[^>]*\/>/g
  let m
  while ((m = re.exec(xml)) !== null) out += decodeXmlEntities(m[1] || '')
  return out
}

export async function parseXlsx(input) {
  const entries = await unzip(input)
  const byName = new Map(entries.map((e) => [e.name, e]))

  const shared = []
  const ss = byName.get('xl/sharedStrings.xml')
  if (ss) {
    const xml = new TextDecoder().decode(await ss.bytes())
    const re = /<si[ >]([\s\S]*?)<\/si>/g
    let m
    while ((m = re.exec(xml)) !== null) shared.push(textRuns(m[1]))
  }

  const sheetEntry =
    byName.get('xl/worksheets/sheet1.xml') ||
    entries.filter((e) => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.name))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))[0]
  if (!sheetEntry) throw new Error('No worksheet found — is this a real .xlsx file?')

  const xml = new TextDecoder().decode(await sheetEntry.bytes())
  const rows = []
  const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g
  const cellRe = /<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g
  let rm
  while ((rm = rowRe.exec(xml)) !== null) {
    const row = []
    let cm
    while ((cm = cellRe.exec(rm[1])) !== null) {
      const attrs = cm[1] || ''
      const inner = cm[2] || ''
      const ref = /r="([A-Z]+)\d+"/.exec(attrs)
      const col = ref ? colToIndex(ref[1]) : row.length
      const type = /t="([^"]+)"/.exec(attrs)?.[1] || ''
      let val = ''
      if (type === 'inlineStr') val = textRuns(inner)
      else {
        const v = /<v[^>]*>([\s\S]*?)<\/v>/.exec(inner)
        val = v ? decodeXmlEntities(v[1]) : ''
        if (type === 's') val = shared[parseInt(val, 10)] ?? ''
      }
      row[col] = String(val).trim()
    }
    rows.push(Array.from(row, (c) => c ?? ''))
  }
  return rows
}

export function parseCsv(text) {
  const src = String(text || '').replace(/^﻿/, '')
  const firstLine = src.split(/\r?\n/, 1)[0] || ''
  const counts = [[',', 0], [';', 0], ['\t', 0]].map(([d]) => [d, firstLine.split(d).length - 1])
  const delim = counts.sort((a, b) => b[1] - a[1])[0][1] > 0 ? counts.sort((a, b) => b[1] - a[1])[0][0] : ','

  const rows = []
  let row = [], cell = '', inQ = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQ) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++ } else inQ = false
      } else cell += ch
    } else if (ch === '"') inQ = true
    else if (ch === delim) { row.push(cell.trim()); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cell.trim()); cell = ''
      if (row.some((c) => c !== '')) rows.push(row)
      row = []
    } else cell += ch
  }
  row.push(cell.trim())
  if (row.some((c) => c !== '')) rows.push(row)
  return rows
}
