// Verify that a webhook really came from Twilio. Pure apart from node:crypto.
//
// Twilio signs every webhook it sends with the account's AUTH TOKEN, which we
// already hold — so the status callback needs no new shared secret of its own,
// unlike the Forward Email webhook where the provider cannot sign anything and
// a URL secret is the only gate available.
//
// The scheme, per Twilio's documented algorithm:
//   1. take the full URL the request was sent to, query string included
//   2. sort the POST parameters by key, and append each key immediately
//      followed by its value to that string — no separators at all
//   3. HMAC-SHA1 the result with the auth token, base64 the digest
//   4. compare with the X-Twilio-Signature header, in constant time
//
// The URL matters as much as the body: signing it is what stops a valid
// signature for one endpoint being replayed against another.

import crypto from 'node:crypto'

/** The signature Twilio should have sent for this URL + params. */
export function expectedSignature(authToken, url, params = {}) {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + String(params[key] ?? ''), String(url || ''))
  return crypto.createHmac('sha1', String(authToken || '')).update(data, 'utf8').digest('base64')
}

/**
 * True when `signature` is Twilio's for this request.
 *
 * Fails CLOSED: no token, no signature, or a length mismatch is a rejection,
 * never a pass. An unsigned request to a status callback is either a
 * misconfiguration or someone writing delivery results into the audit trail,
 * and neither should be honoured.
 */
export function verifyTwilioSignature({ authToken, url, params = {}, signature }) {
  if (!authToken || !signature) return false
  const expected = expectedSignature(authToken, url, params)
  const a = Buffer.from(String(signature))
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

/**
 * The URL Twilio signed, rebuilt from the request as it arrived at the proxy.
 * Vercel terminates TLS in front of the function, so req.headers.host and the
 * x-forwarded-* pair are what reflect the public URL Twilio actually called —
 * the same derivation the Stripe checkout routes use.
 */
export function requestUrl(req, { path } = {}) {
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host || ''
  return `${proto}://${host}${path || req.url || ''}`
}
