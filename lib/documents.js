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

// Validate + decode a base64 upload. Throws a user-facing message on any problem.
export function decodeUpload({ filename, contentType, dataBase64 }) {
  if (!dataBase64) throw new Error('No file data received.')
  const ct = String(contentType || '').toLowerCase()
  if (!ALLOWED.has(ct)) throw new Error('Only images (JPG/PNG/WEBP/HEIC) or PDF files are allowed.')
  const bytes = Buffer.from(String(dataBase64).replace(/^data:[^;]+;base64,/, ''), 'base64')
  if (!bytes.length) throw new Error('The file was empty.')
  if (bytes.length > MAX_DOC_BYTES) throw new Error('File is too large (max 10 MB).')
  return { bytes, safeName: safeFilename(filename), contentType: ct, size: bytes.length }
}
