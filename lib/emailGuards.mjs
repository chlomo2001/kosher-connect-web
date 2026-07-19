// Pure helpers for the email pipeline — testable without network or DB.
//
// verifySvixSignature implements the Svix webhook scheme (used by Resend for
// delivery/bounce/complaint events): the signed content is
// `${id}.${timestamp}.${rawBody}`, the HMAC key is the base64 payload of the
// `whsec_…` secret, and the `svix-signature` header carries one or more
// space-separated `v1,<base64 hmac>` candidates (key rotation sends several).
// Comparison is constant-time, and stale timestamps are rejected so a captured
// delivery can't be replayed later.

import crypto from 'node:crypto'

export const normalizeEmail = (s) => String(s == null ? '' : s).trim().toLowerCase()

export function verifySvixSignature({ secret, id, timestamp, payload, signatureHeader, nowSec, toleranceSec = 300 }) {
  if (!secret || !id || !timestamp || !signatureHeader) return false
  const tsNum = Number(timestamp)
  if (!Number.isFinite(tsNum)) return false
  const now = Number.isFinite(nowSec) ? nowSec : Math.floor(Date.now() / 1000)
  if (Math.abs(now - tsNum) > toleranceSec) return false

  const key = Buffer.from(String(secret).replace(/^whsec_/, ''), 'base64')
  if (!key.length) return false
  const expected = crypto
    .createHmac('sha256', key)
    .update(`${id}.${timestamp}.${payload}`)
    .digest()

  for (const part of String(signatureHeader).trim().split(/\s+/)) {
    const [version, sig] = part.split(',')
    if (version !== 'v1' || !sig) continue
    let candidate
    try {
      candidate = Buffer.from(sig, 'base64')
    } catch {
      continue
    }
    if (candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected)) return true
  }
  return false
}
