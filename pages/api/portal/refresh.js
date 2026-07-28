// Exchange a Supabase refresh token for a fresh access token, server-side.
//
// The portal keeps the refresh token in the browser so a customer's session
// survives tab close and the ~1h access-token expiry — without this, every
// visit costs a freshly emailed magic link, brutal for a community with
// limited email access. The exchange is proxied here because the browser has
// no Supabase key; only a valid refresh token gets anything back, and Supabase
// rotates it on every use.

import { rateLimit } from '../../../lib/rateLimit.js'

export default async function handler(req, res) {
  if (process.env.PORTAL_ENABLED !== '1') return res.status(404).json({ success: false, error: 'Not found.' })
  if (req.method !== 'POST') return res.status(405).end()
  if (!rateLimit(req, { burst: 10, perMinute: 4 })) {
    return res.status(429).json({ success: false, error: 'Too many requests — please wait a minute.' })
  }

  const rt = String(req.body?.refresh_token || '').trim()
  if (!rt || rt.length > 512) return res.status(400).json({ success: false, error: 'Please sign in again.' })

  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '')
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!url || !key) return res.status(503).json({ success: false, error: 'Portal unavailable.' })

  const r = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: rt }),
    signal: AbortSignal.timeout(10000),
  }).catch(() => null)
  if (!r || !r.ok) return res.status(401).json({ success: false, error: 'Please sign in again.' })

  const d = await r.json().catch(() => null)
  if (!d || !d.access_token) return res.status(401).json({ success: false, error: 'Please sign in again.' })
  return res.json({ success: true, access_token: d.access_token, refresh_token: d.refresh_token || null })
}
