// Shared helpers for customer document uploads (operator + portal).
import crypto from 'crypto'

export const MAX_DOC_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf',
  // Office documents (owner ask, 21 Jul): zip-container (docx/xlsx) and the
  // old OLE binaries (doc/xls), plus plain text/CSV. text/html stays banned —
  // nothing here can execute when served back.
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword', 'application/vnd.ms-excel',
  'text/plain', 'text/csv',
])

export function safeFilename(name) {
  return String(name || 'file').replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'file'
}

// Files live under <customerId>/<uuid>-<name> so paths are unguessable and
// per-customer, and two uploads with the same name never collide.
export function docStoragePath(customerId, filename) {
  return `${customerId}/${crypto.randomUUID()}-${safeFilename(filename)}`
}

// Sniff the leading magic bytes so the stored/served content-type reflects the
// actual file, not a client-declared string (which was trusted verbatim before).
// Returns a normalized type, or null if the bytes match no allowed signature.
function sniffType(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
  if (buf.length >= 5 && buf.toString('latin1', 0, 5) === '%PDF-') return 'application/pdf'
  if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'image/webp'
  // HEIC/HEIF: ISO base-media 'ftyp' box at offset 4 with a HEIF-family brand.
  if (buf.length >= 12 && buf.toString('latin1', 4, 8) === 'ftyp') {
    if (/heic|heix|heif|hevc|hevx|mif1|msf1|heim|heis|hevm|hevs/.test(buf.toString('latin1', 8, 12))) return 'image/heic'
  }
  // Zip container (docx/xlsx) and OLE compound file (legacy doc/xls) — the
  // sniff proves the container; the declared type picks the flavour within it.
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) return 'zip'
  if (buf.length >= 8 && buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0) return 'ole'
  // Plain text/CSV: no magic bytes — accept only if the sample is clean text
  // (no NULs, mostly printable), so a binary can't sneak in under text/plain.
  const sample = buf.subarray(0, 8192)
  if (!sample.includes(0)) {
    let printable = 0
    for (const b of sample) if (b === 9 || b === 10 || b === 13 || b >= 32) printable++
    if (printable / sample.length > 0.95) return 'text'
  }
  return null
}
// heic/heif are one container family; office types collapse to their container.
const ZIP_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])
const OLE_TYPES = new Set(['application/msword', 'application/vnd.ms-excel'])
const TEXT_TYPES = new Set(['text/plain', 'text/csv'])
function typeFamily(t) {
  if (t === 'image/heif') return 'image/heic'
  if (ZIP_TYPES.has(t)) return 'zip'
  if (OLE_TYPES.has(t)) return 'ole'
  if (TEXT_TYPES.has(t)) return 'text'
  return t
}

// Validate + decode a base64 upload. Throws a user-facing message on any problem.
export function decodeUpload({ filename, contentType, dataBase64 }) {
  if (!dataBase64) throw new Error('No file data received.')
  const ct = String(contentType || '').toLowerCase()
  if (!ALLOWED.has(ct)) throw new Error('Allowed files: images (JPG/PNG/WEBP/HEIC), PDF, Word, Excel, or plain text/CSV.')
  const bytes = Buffer.from(String(dataBase64).replace(/^data:[^;]+;base64,/, ''), 'base64')
  if (!bytes.length) throw new Error('The file was empty.')
  if (bytes.length > MAX_DOC_BYTES) throw new Error('File is too large (max 10 MB).')
  // The content-type must match the actual bytes, not just the client's claim, so
  // a non-image payload can't be stored/served under an inert type. audit C17.
  const sniffed = sniffType(bytes)
  if (!sniffed || typeFamily(sniffed) !== typeFamily(ct)) {
    throw new Error('The file’s contents don’t match its type — please upload the original file.')
  }
  return { bytes, safeName: safeFilename(filename), contentType: ct, size: bytes.length }
}
