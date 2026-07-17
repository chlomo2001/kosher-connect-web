// SMS + phonebook format codecs for the phone-to-phone transfer wizard.
// Pure byte/string work (no DOM) so every decoder is unit-tested under node.
//
// Absorbed from the owner's migration chain, logic kept verbatim where it was
// proven against real data:
//   • SMS Backup & Restore XML — regex streaming parse (his "Enhanced" tool's
//     answer to DOMParser choking on multi-MB files)
//   • FIG Messenger backup — ZIP of messages.ndjson; the schema is LEARNED from
//     a fresh backup of the target phone (survives app updates), with his real
//     observed 18-key schema as the built-in fallback
//   • Nokia NBF — ZIP of per-message binaries under predefmessages/1|3 with
//     hex-timestamp filenames and UTF-16LE payloads (heuristic extraction)
//   • Nokia 215 IB — fixed-layout binary phonebook (592-byte records)

import { phoneKey } from './ukPhone.mjs'

// ── SMS Backup & Restore XML ───────────────────────────────────────────────
const XML_ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const decodeEnt = (s) => String(s || '').replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (m, e) => {
  if (e[0] === '#') {
    const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
    return Number.isFinite(code) ? String.fromCodePoint(code) : m
  }
  return XML_ENT[e] ?? m
})

// → [{ address, body, date, date_sent, type, service_center }] (all strings)
export function parseSmsBackupXml(text) {
  const src = String(text || '')
  if (!/<smses[\s>]/.test(src)) throw new Error('Not an SMS Backup & Restore file (no <smses> root).')
  const out = []
  const smsRe = /<sms\b([^>]*?)\/?>/g
  const attrRe = /([\w:]+)="([^"]*)"/g
  let m
  while ((m = smsRe.exec(src)) !== null) {
    const a = {}
    let am
    while ((am = attrRe.exec(m[1])) !== null) a[am[1]] = decodeEnt(am[2])
    out.push({
      address: a.address || '',
      body: a.body || '',
      date: a.date || '0',
      date_sent: a.date_sent || '0',
      type: a.type || '1',               // 1 = received, 2 = sent
      service_center: a.service_center && a.service_center !== 'null' ? a.service_center : '',
    })
  }
  return out
}

// ── FIG Messenger backup ───────────────────────────────────────────────────
// The 18-key schema observed on the real target phone (com.figmessenger).
export const FIG_KEYS = [
  '_id', 'thread_id', 'address', 'date', 'date_sent', 'protocol', 'read',
  'status', 'type', 'reply_path_present', 'body', 'service_center', 'locked',
  'sub_id', 'error_code', 'creator', 'seen', 'ipmsg_id',
]
export const FIG_DEFAULTS = {
  _id: '', thread_id: '', address: '', date: '0', date_sent: '0', protocol: '0',
  read: '1', status: '-1', type: '1', reply_path_present: '0', body: '',
  service_center: '', locked: '0', sub_id: '1', error_code: '-1',
  creator: 'com.figmessenger', seen: '1', ipmsg_id: '0',
}

// Learn the live schema from the first NDJSON line of a fresh backup of the
// TARGET phone — key order + defaults — then pin the sensible defaults the
// owner's converter always pinned.
export function learnFigSchema(ndjsonText) {
  const line = String(ndjsonText || '').split(/\r?\n/).find((l) => l.trim())
  if (!line) throw new Error('The sample backup has no messages to learn the format from.')
  const obj = JSON.parse(line)
  const keys = Object.keys(obj)
  const defaults = {}
  for (const k of keys) defaults[k] = obj[k] == null ? '' : String(obj[k])
  const pinned = {
    protocol: '0', read: '1', status: '-1', reply_path_present: '0', locked: '0',
    sub_id: '1', error_code: '-1', creator: 'com.figmessenger', seen: '1', ipmsg_id: '0',
  }
  for (const [k, v] of Object.entries(pinned)) if (k in defaults) defaults[k] = v
  return { keys, defaults }
}

// Field-name detection for FIG-like schemas whose apps renamed columns.
const pickField = (defaults, primary, alts) =>
  primary in defaults ? primary : alts.find((k) => k in defaults) || primary

// messages: parseSmsBackupXml/parseNbf shape. Returns { ndjson, count, threads }.
export function buildFigNdjson(messages, schema = { keys: FIG_KEYS, defaults: FIG_DEFAULTS }, opts = {}) {
  const { normalizeAddress = (a) => a, markUnread = false } = opts
  const { keys, defaults } = schema
  const addrF = pickField(defaults, 'address', ['phone', 'number', 'peer', 'remote'])
  const textF = pickField(defaults, 'body', ['text', 'message', 'content', 'msg'])
  const dateF = pickField(defaults, 'date', ['timestamp', 'time', 'ts', 'created_at'])
  const typeF = pickField(defaults, 'type', ['direction', 'box', 'folder'])

  const threadMap = new Map()
  let nextThread = 1
  const threadFor = (addr) => {
    const key = phoneKey(addr) || addr
    if (!threadMap.has(key)) threadMap.set(key, String(nextThread++))
    return threadMap.get(key)
  }

  const lines = []
  let id = 1
  for (const m of messages) {
    const addr = normalizeAddress(m.address || '')
    const rec = { ...defaults }
    if ('_id' in rec) rec._id = String(id)
    if ('thread_id' in rec) rec.thread_id = threadFor(addr)
    rec[addrF] = addr
    if (dateF in rec) rec[dateF] = String(m.date || '0')
    if ('date_sent' in rec) rec.date_sent = String(m.date_sent || '0')
    rec[textF] = String(m.body || '')
    if (typeF in rec) rec[typeF] = String(m.type || '1')
    if ('service_center' in rec) rec.service_center = String(m.service_center || '')
    if (markUnread && 'read' in rec) rec.read = '0'
    if (markUnread && 'seen' in rec) rec.seen = '0'

    const ordered = {}
    for (const k of keys) ordered[k] = rec[k] ?? ''
    lines.push(JSON.stringify(ordered))
    id++
  }
  return { ndjson: lines.join('\n') + '\n', count: lines.length, threads: threadMap.size }
}

// ── Nokia NBF (Messages.NBF) ───────────────────────────────────────────────
const isPhoneLike = (s) => /^(\+?\d{7,15})$/.test(s)

export function extractAsciiStrings(u8, minLen = 6) {
  const out = []
  let cur = []
  for (let i = 0; i < u8.length; i++) {
    const b = u8[i]
    if (b >= 32 && b < 127) cur.push(b)
    else { if (cur.length >= minLen) out.push(String.fromCharCode(...cur)); cur = [] }
  }
  if (cur.length >= minLen) out.push(String.fromCharCode(...cur))
  return out
}

export function extractUtf16Strings(u8, minChars = 2) {
  const out = []
  let i = 0
  while (i < u8.length - 1) {
    if (u8[i] >= 32 && u8[i] < 127 && u8[i + 1] === 0x00) {
      let j = i
      const chars = []
      while (j < u8.length - 1 && u8[j] >= 32 && u8[j] < 127 && u8[j + 1] === 0x00) {
        chars.push(String.fromCharCode(u8[j])); j += 2
      }
      if (chars.length >= minChars) out.push(chars.join(''))
      i = j
    } else i++
  }
  return out
}

// NBF filenames carry a hex timestamp (seconds) at characters 8–16.
export function nbfTimestampMs(baseName) {
  if (!baseName || baseName.length < 16) return null
  const hex = baseName.slice(8, 16)
  if (!/^[0-9A-Fa-f]{8}$/.test(hex)) return null
  const sec = parseInt(hex, 16)
  return Number.isFinite(sec) ? String(sec * 1000) : null
}

export function nbfAddressFromFilename(fullPath) {
  const m = fullPath.match(/(\d{10,15})(?=\D*$|[A-Fa-f0-9]{0,8}$)/g)
  if (!m || !m.length) return null
  const digits = m[m.length - 1]
  if (digits.startsWith('0') && digits.length >= 12 && digits.slice(1, 3) === '44') return '+' + digits.slice(1)
  return digits
}

function pickNbfBody(strings, addr) {
  const clean = (arr) => arr.filter((s) => s && s.trim() && !isPhoneLike(s) && !s.includes('$') && !s.startsWith(','))
  const cleaned = clean(strings)
  if (!cleaned.length) return ''
  const idx = strings.findIndex((s) => s === addr)
  if (idx >= 0) {
    const after = clean(strings.slice(idx + 1))
    if (after.length) return after.join('')
  }
  return cleaned.reduce((best, s) => (s.length > best.length ? s : best), cleaned[0])
}

// entries: [{ name, bytes(): Promise<Uint8Array> }] from unzip(Messages.NBF).
// → messages sorted by date, same shape as parseSmsBackupXml.
export async function parseNbf(entries) {
  const files = entries.filter((e) => !e.dir &&
    (e.name.startsWith('predefmessages/1/') || e.name.startsWith('predefmessages/3/')))
  if (!files.length) throw new Error('No messages found (predefmessages/1 or /3) — is this a Nokia Messages.NBF backup?')

  const out = []
  for (const e of files) {
    const base = e.name.split('/').pop()
    const type = e.name.startsWith('predefmessages/1/') ? '1' : '2'
    const date = nbfTimestampMs(base) || '0'
    const u8 = await e.bytes()
    const u16 = extractUtf16Strings(u8, 2)
    const addr = u16.find((s) => isPhoneLike(s) && s.startsWith('+')) ||
      u16.find((s) => isPhoneLike(s)) ||
      nbfAddressFromFilename(e.name) || ''
    const serviceCenter = extractAsciiStrings(u8, 6).find((s) => /^\+\d{8,15}$/.test(s)) || ''
    out.push({
      address: addr, date, date_sent: type === '1' ? date : '0',
      type, body: pickNbfBody(u16, addr), service_center: serviceCenter,
    })
  }
  out.sort((a, b) => (BigInt(a.date) < BigInt(b.date) ? -1 : BigInt(a.date) > BigInt(b.date) ? 1 : 0))
  return out
}

// ── Nokia 215 4G phonebook (.IB) ───────────────────────────────────────────
// Fixed layout reverse-engineered by the owner: records at 0x244, 592 bytes
// each, up to 1246 slots; two length-prefixed UTF-16LE names; two BCD
// nibble-packed numbers (0xF terminates; type 0x11 = international ⇒ '+').
const IB_RECORD_START = 0x244
const IB_RECORD_SIZE = 592
const IB_RECORD_COUNT = 1246

function ibReadName(data, off, maxChars = 42) {
  if (off + 2 > data.length) return ''
  const n = data[off] | (data[off + 1] << 8)
  if (n === 0 || n > maxChars) return ''
  let str = ''
  for (let i = 0; i < n; i++) {
    const p = off + 2 + i * 2
    if (p + 1 >= data.length) break
    const code = data[p] | (data[p + 1] << 8)
    if (code === 0) break
    str += String.fromCharCode(code)
  }
  return str.trim()
}

function ibReadPhone(data, off) {
  if (off + 2 > data.length) return ''
  const n = data[off]
  if (n === 0 || n > 0x10) return ''
  const t = data[off + 1]
  const digits = []
  for (let i = 0; i < n; i++) {
    const byte = data[off + 2 + i]
    const lo = byte & 0xf, hi = (byte >> 4) & 0xf
    if (lo === 0xf) break
    digits.push(String(lo))
    if (hi === 0xf) break
    digits.push(String(hi))
  }
  return (t === 0x11 ? '+' : '') + digits.join('')
}

// → [{ name, phones: [first, second?] }]
export function parseNokiaIb(data) {
  const contacts = []
  for (let i = 0; i < IB_RECORD_COUNT; i++) {
    const off = IB_RECORD_START + i * IB_RECORD_SIZE
    if (off >= data.length) break
    const name1 = ibReadName(data, off + 0x60)
    const name2 = ibReadName(data, off + 0xb4)
    const phones = [ibReadPhone(data, off + 0x1e), ibReadPhone(data, off + 0x34)].filter(Boolean)
    if (name1 || name2 || phones.length) {
      contacts.push({ name: `${name1} ${name2}`.trim(), phones })
    }
  }
  return contacts
}
