// vCard read/build/merge/dedupe — the engine behind the contacts converter and
// the customer VCF export. Pure string work, no DOM, so it runs in the browser
// pages AND under node --test.
//
// Absorbed from the owner's tool chain: escaping + card building (Nokia IB
// converter), TEL-line-only rewriting that preserves every other byte (UK
// prefix converter), block merge (vcf-merger) and the FN+TEL-set dedupe key
// (vcard_cleaner) — plus quoted-printable name decoding, which his tools
// skipped but his real phonebook export (vCard 2.1) needs.

export function vcardEscape(s) {
  return String(s == null ? '' : s)
    .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,')
    .replace(/\n/g, '\\n').replace(/\r/g, '')
}

const unescapeV = (s) => String(s || '')
  .replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')

// Basic quoted-printable → UTF-8 (vCard 2.1 exports encode Hebrew/emoji names
// this way: =XX byte pairs, =<CRLF> soft line breaks).
export function decodeQuotedPrintable(s) {
  const bytes = []
  const src = String(s || '').replace(/=\r?\n/g, '')
  for (let i = 0; i < src.length; i++) {
    if (src[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(src.slice(i + 1, i + 3))) {
      bytes.push(parseInt(src.slice(i + 1, i + 3), 16)); i += 2
    } else bytes.push(src.charCodeAt(i) & 0xff)
  }
  try { return new TextDecoder('utf-8').decode(new Uint8Array(bytes)) }
  catch { return src }
}

// Unfold RFC continuation lines (next line starts with space/tab), keeping the
// original raw block intact separately.
const unfold = (block) => block.replace(/\r?\n[ \t]/g, '')

// Split a .vcf file into raw card blocks.
export function splitCards(text) {
  const out = []
  const re = /BEGIN:VCARD[\s\S]*?END:VCARD/gi
  let m
  while ((m = re.exec(String(text || ''))) !== null) out.push(m[0])
  return out
}

// Parse one raw block → { fn, tels, raw }. TEL params are ignored for matching
// (dedupe cares about the number, not its TYPE).
export function parseCard(raw) {
  const lines = unfold(raw).split(/\r?\n/)
  let fn = '', n = ''
  const tels = []
  for (const line of lines) {
    const idx = line.indexOf(':')
    if (idx < 0) continue
    const head = line.slice(0, idx), val = line.slice(idx + 1)
    const prop = head.split(';')[0].replace(/^item\d+\./i, '').toUpperCase()
    const qp = /ENCODING=QUOTED-PRINTABLE/i.test(head)
    if (prop === 'FN') fn = qp ? decodeQuotedPrintable(val) : unescapeV(val)
    else if (prop === 'N' && !n) n = qp ? decodeQuotedPrintable(val) : val
    else if (prop === 'TEL') {
      const t = val.replace(/^tel:/i, '').trim()
      if (t) tels.push(t)
    }
  }
  if (!fn && n) fn = n.split(';').filter(Boolean).reverse().join(' ').trim()
  return { fn: fn.trim(), tels, raw }
}

export function parseVcf(text) {
  return splitCards(text).map(parseCard)
}

// Build a clean vCard 3.0 from structured fields (converter + KC export path).
export function buildCard({ first = '', last = '', fullName = '', phones = [], email = '', address = '' }) {
  const fn = (fullName || `${first} ${last}`.trim()).trim() || (phones[0] || 'Unknown')
  const lines = [
    'BEGIN:VCARD', 'VERSION:3.0',
    `FN:${vcardEscape(fn)}`,
    `N:${vcardEscape(last)};${vcardEscape(first)};;;`,
  ]
  phones.forEach((p, i) => lines.push(`TEL;TYPE=${i === 0 ? 'CELL' : 'HOME'}:${vcardEscape(p)}`))
  if (email) lines.push(`EMAIL:${vcardEscape(email)}`)
  if (address) lines.push(`ADR;TYPE=HOME:;;${vcardEscape(address)};;;;`)
  lines.push('END:VCARD')
  return lines.join('\r\n')
}

// vcard_cleaner's identity: normalised name + the SET of its numbers.
export function dedupeKey(card, phoneKeyFn = (t) => t.replace(/\D/g, '')) {
  const name = (card.fn || '').toUpperCase().replace(/[^A-Z0-9֐-׿]/g, '')
  const tels = [...new Set(card.tels.map(phoneKeyFn).filter(Boolean))].sort()
  return `${name}|${tels.join(',')}`
}

// Merge blocks, drop exact duplicates (first occurrence wins).
export function dedupeCards(cards, phoneKeyFn) {
  const seen = new Set()
  const kept = []
  let removed = 0
  for (const c of cards) {
    const k = dedupeKey(c, phoneKeyFn)
    if (seen.has(k)) { removed++; continue }
    seen.add(k); kept.push(c)
  }
  return { kept, removed }
}

// Rewrite ONLY the TEL lines of an existing VCF (any version), preserving every
// other line byte-for-byte — the UK prefix converter's contract.
export function rewriteVcfTels(text, normalize) {
  let found = 0, changed = 0
  const out = String(text || '').split(/\r\n|\n/).map((line) => {
    const m = line.match(/^((?:item\d+\.)?TEL[^:]*:)(.*)$/i)
    if (!m) return line
    found++
    const oldVal = m[2].replace(/^tel:/i, '')
    const newVal = normalize(oldVal)
    if (newVal && newVal !== oldVal) { changed++; return m[1] + newVal }
    return line
  }).join('\r\n')
  return { text: out, found, changed }
}
