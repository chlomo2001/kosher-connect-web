// Shared helpers for customer document uploads (operator + portal).
import crypto from 'crypto'

export const MAX_DOC_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf',
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
  return null
}
// heic/heif are the same container family; compare on that.
const typeFamily = (t) => (t === 'image/heif' ? 'image/heic' : t)

// Validate + decode a base64 upload. Throws a user-facing message on any problem.
export function decodeUpload({ filename, contentType, dataBase64 }) {
  if (!dataBase64) throw new Error('No file data received.')
  const ct = String(contentType || '').toLowerCase()
  if (!ALLOWED.has(ct)) throw new Error('Only images (JPG/PNG/WEBP/HEIC) or PDF files are allowed.')
  const bytes = Buffer.from(String(dataBase64).replace(/^data:[^;]+;base64,/, ''), 'base64')
  if (!bytes.length) throw new Error('The file was empty.')
  if (bytes.length > MAX_DOC_BYTES) throw new Error('File is too large (max 10 MB).')
  // The content-type must match the actual bytes, not just the client's claim, so
  // a non-image payload can't be stored/served under an inert type. audit C17.
  const sniffed = sniffType(bytes)
  if (!sniffed || typeFamily(sniffed) !== typeFamily(ct)) {
    throw new Error('That file doesn’t look like a JPG, PNG, WEBP, HEIC or PDF.')
  }
  return { bytes, safeName: safeFilename(filename), contentType: ct, size: bytes.length }
}
