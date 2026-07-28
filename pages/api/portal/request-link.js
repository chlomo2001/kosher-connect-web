// Customer-portal login link — SCAFFOLD, dark until PORTAL_ENABLED=1.
//
// POST { email }: if the email matches a customer, a Supabase magic-link
// email goes out. The response is identical either way (no way to probe
// which emails are customers). Staff auth deliberately NOT required —
// this is the customer-facing side.

import { sendMagicLink } from '../../../lib/auth.js'
import { tablesMode } from '../../../lib/db.js'
import { normalizeEmail } from '../../../lib/mappers.js'
import { rateLimit } from '../../../lib/rateLimit.js'

export default async function handler(req, res) {
  if (process.env.PORTAL_ENABLED !== '1') {
    return res.status(404).json({ success: false, error: 'Not found.' })
  }
  if (req.method !== 'POST') return res.status(405).end()
  // Every call sends a Supabase OTP email — the same OTP pool staff 2FA codes
  // draw from. Unthrottled, an outsider could drain it and lock staff out.
  if (!rateLimit(req, { burst: 5, perMinute: 1 })) {
    return res.status(429).json({ success: false, error: 'Too many requests — please wait a minute and try again.' })
  }
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Portal unavailable.' })

  const norm = normalizeEmail(req.body?.email)
  const generic = { success: true, message: 'If that email belongs to a KosherConnect customer, a sign-in link is on its way.' }
  if (!norm) return res.json(generic)

  // Always issue the link so response timing can't reveal whether the email is a
  // known customer (the previous conditional send was a membership oracle). Supabase
  // create_user tolerates unknown emails and rate-limits sends; an unknown signer
  // sees nothing at /portal/me. audit C16.
  await sendMagicLink(String(req.body.email).trim()).catch(() => null)
  return res.json(generic)
}
