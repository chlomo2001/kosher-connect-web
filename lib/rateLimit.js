// Best-effort per-IP rate limiting for the UNAUTHENTICATED public endpoints
// (/api/public/join, /api/public/message, /api/portal/request-link).
//
// Why it exists: these routes create tasks or trigger Supabase OTP emails on
// every call. Unthrottled, a script can bury the staff task queue — or worse,
// exhaust the Supabase project's OTP budget, which the STAFF 2FA codes share,
// locking the owner out of his own admin. A token bucket per IP turns
// "trivial" into "not worth it".
//
// Same accepted serverless trade-off as staffCache/ticketFails in lib/auth.js:
// the map is per-instance, so a determined attacker spread across many cold
// instances can exceed the nominal budget — but the cheap, single-source abuse
// this defends against comes from one client, which one instance sees.

const buckets = new Map() // ip -> { tokens, last }
const MAX_IPS = 5000 // bound memory; oldest entries evicted wholesale

export function clientIp(req) {
  // Platform-set headers first (sweep 2026-08-02 #11): x-forwarded-for can
  // carry a client-supplied first entry on some hops, and a forged per-request
  // value would hand every request its own fresh bucket. Vercel sets these two
  // itself; the x-forwarded-for path remains only for local dev.
  const platform = String(
    req.headers['x-vercel-forwarded-for'] || req.headers['x-real-ip'] || ''
  ).split(',')[0].trim()
  if (platform) return platform
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  return fwd || req.socket?.remoteAddress || 'unknown'
}

// Allow `burst` immediate calls per IP, refilling at `perMinute` tokens/min.
// Returns true when the call may proceed, false when it should be refused.
export function rateLimit(req, { burst = 5, perMinute = 2 } = {}) {
  const ip = clientIp(req)
  const now = Date.now()
  if (buckets.size > MAX_IPS) buckets.clear()
  const b = buckets.get(ip) || { tokens: burst, last: now }
  b.tokens = Math.min(burst, b.tokens + ((now - b.last) / 60000) * perMinute)
  b.last = now
  if (b.tokens < 1) {
    buckets.set(ip, b)
    return false
  }
  b.tokens -= 1
  buckets.set(ip, b)
  return true
}
