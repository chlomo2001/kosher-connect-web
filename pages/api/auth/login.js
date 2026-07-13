// Staff login step 1: password grant against Supabase Auth + staff_profiles
// gate. With 2FA on (default), NO cookie is set here — a code is emailed and
// step 2 (/api/auth/verify-2fa) completes the session.

import { tablesMode } from '../../../lib/db.js'
import {
  passwordLogin,
  sessionCookie,
  staffProfileFor,
  bootstrapOwnerIfFirst,
  staff2faEnabled,
  sendEmailOtp,
  make2faTicket,
} from '../../../lib/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!tablesMode) {
    return res.status(503).json({ success: false, error: 'Login needs the relational data layer.' })
  }
  const { email, password } = req.body || {}
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' })
  }

  try {
    const cleanEmail = String(email).trim()
    const grant = await passwordLogin(cleanEmail, String(password))
    if (!grant.ok || !grant.json?.access_token) {
      return res.status(401).json({ success: false, error: 'Wrong email or password.' })
    }
    const user = grant.json.user

    let staff = await staffProfileFor(user.id)
    if (!staff) {
      staff = await bootstrapOwnerIfFirst(user.id, user.user_metadata?.full_name || null)
      if (staff) console.log(`[auth] bootstrap: ${user.email} is now the owner`)
    }
    if (!staff) {
      return res.status(403).json({ success: false, error: 'This account is not a staff member. Ask the owner to add you.' })
    }

    if (staff2faEnabled()) {
      const sent = await sendEmailOtp(cleanEmail)
      if (!sent.ok) {
        console.error('[api/auth/login] otp send failed', sent.status, sent.json)
        return res.status(503).json({
          success: false,
          error: 'Could not send the sign-in code (email limit?). Try again shortly.',
        })
      }
      // Password proven; the emailed code is the second factor.
      return res.json({ success: true, twofa: true, ticket: make2faTicket(cleanEmail) })
    }

    res.setHeader('Set-Cookie', sessionCookie(grant.json))
    return res.json({ success: true, role: staff.role })
  } catch (e) {
    console.error('[api/auth/login]', e)
    return res.status(500).json({ success: false, error: 'Login failed — try again.' })
  }
}
