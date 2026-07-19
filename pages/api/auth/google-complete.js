// Staff Google sign-in, step 2. The /auth/google page reads the Supabase
// OAuth tokens from the redirect hash and POSTs them here. We verify the
// token, confirm the email belongs to a staff member (Google is the second
// factor, so no email OTP), and set the kc_session cookie.

import { tablesMode } from '../../../lib/db.js'
import { sessionCookie, staffProfileByEmail, staffProfileFor } from '../../../lib/auth.js'

const SB_URL = (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '')
const SB_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

async function getUser(accessToken) {
  const res = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${accessToken}` },
  })
  const text = await res.text()
  return { ok: res.ok, json: text ? JSON.parse(text) : null }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Login needs the relational data layer.' })

  const { access_token, refresh_token } = req.body || {}
  if (!access_token) return res.status(400).json({ success: false, error: 'Missing token.' })

  try {
    const user = await getUser(access_token)
    if (!user.ok || !user.json?.id) {
      return res.status(401).json({ success: false, error: 'Could not verify the Google sign-in.' })
    }
    // The token is only a valid SECOND factor if it actually came from Google
    // OAuth. Supabase issues the identical token shape for email magic-links, so
    // without this check a portal magic-link token for a staff email (which
    // anyone with that mailbox can request) would mint a full staff session and
    // bypass the password factor entirely. Require a google identity/provider.
    const provider = user.json.app_metadata?.provider
    const providers = user.json.app_metadata?.providers || []
    const hasGoogleIdentity = Array.isArray(user.json.identities)
      && user.json.identities.some((i) => i?.provider === 'google')
    const cameFromGoogle = provider === 'google' || providers.includes('google') || hasGoogleIdentity
    if (!cameFromGoogle) {
      return res.status(403).json({
        success: false,
        error: 'This sign-in did not come from Google. Use the Google button, or sign in with your password.',
      })
    }
    const email = (user.json.email || '').toLowerCase()
    // Must already be a staff member (by id or verified email). We never
    // auto-create staff from a Google login — the owner adds people.
    let staff = await staffProfileFor(user.json.id)
    if (!staff && email) staff = await staffProfileByEmail(email)
    if (!staff) {
      return res.status(403).json({
        success: false,
        error: 'This Google account is not a staff member. Ask the owner to add your email.',
      })
    }

    res.setHeader('Set-Cookie', sessionCookie({ access_token, refresh_token }))
    return res.json({ success: true, role: staff.role })
  } catch (e) {
    console.error('[api/auth/google-complete]', e)
    return res.status(500).json({ success: false, error: 'Sign-in failed — try again.' })
  }
}
