// Supabase Storage helper — private customer documents.
//
// Same trust model as lib/db.js: these calls run server-side inside API routes
// with the service-role key, never in the browser. Files live in the private
// 'customer-docs' bucket; the browser only ever gets short-lived signed URLs.

const SB_URL = (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '')
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

export const DOCS_BUCKET = 'customer-docs'
export const storageEnabled = SB_URL.startsWith('https://') && SERVICE_KEY.length > 0

function authHeaders(extra = {}) {
  return { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, ...extra }
}

// Upload raw bytes (Buffer/Uint8Array) to bucket/path. Overwrites if present.
export async function putObject(bucket, path, bytes, contentType) {
  const res = await fetch(`${SB_URL}/storage/v1/object/${bucket}/${encodeURI(path)}`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': contentType || 'application/octet-stream', 'x-upsert': 'true' }),
    body: bytes,
  })
  if (!res.ok) throw new Error(`[storage] upload ${path}: HTTP ${res.status} ${await res.text()}`)
  return true
}

// Short-lived signed URL for downloading a private object.
export async function signedUrl(bucket, path, expiresIn = 300) {
  const res = await fetch(`${SB_URL}/storage/v1/object/sign/${bucket}/${encodeURI(path)}`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ expiresIn }),
  })
  if (!res.ok) throw new Error(`[storage] sign ${path}: HTTP ${res.status} ${await res.text()}`)
  const { signedURL } = await res.json()
  return `${SB_URL}/storage/v1${signedURL}` // signedURL is bucket-relative
}

export async function removeObject(bucket, path) {
  const res = await fetch(`${SB_URL}/storage/v1/object/${bucket}/${encodeURI(path)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok && res.status !== 404) throw new Error(`[storage] delete ${path}: HTTP ${res.status} ${await res.text()}`)
  return true
}
