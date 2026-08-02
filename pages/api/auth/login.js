// Staff login step 1: password grant against Supabase Auth + staff_profiles
// gate. With 2FA on (default), NO cookie is set here — a code is emailed and
// step 2 (/api/auth/verify-2fa) completes the session.

import { tablesMode } from '../../../lib/db.js'
import { rateLimit } from '../../../lib/rateLimit.js'
import {
  passwordLogin,
  sessionCookie,
  staffProfileFor,
  bootstrapOwnerIfFirst,
  staff2faEnabled,
  sendEmailOtp,
  make2faTicket,
  loginLocked,
  noteLoginFailure,
  clearLoginFailures,
} from '../../../lib/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!tablesMode) {
    return res.status(503).json({ success: false, error: 'Login needs the relational data layer.' })
  }
  // Two guessing guards (sweep 2026-08-02 #5): per-IP token bucket, and a
  // per-email lockout that holds even when the guesses arrive from many IPs.
  // Staff logins are a handful a day, so the budget is generous for humans
  // and hopeless for a wordlist.
  if (!rateLimit(req, { burst: 10, perMinute: 3 })) {
    return res.status(429).json({ success: false, error: 'Too many sign-in attempts — wait a minute and try again.' })
  }
  const { email, password } = req.body || {}
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' })
  }

  try {
    const cleanEmail = String(email).trim()
    if (loginLocked(cleanEmail)) {
      return res.status(429).json({ success: false, error: 'Too many sign-in attempts — wait 15 minutes and try again.' })
    }
    const grant = await passwordLogin(cleanEmail, String(password))
    if (!grant.ok || !grant.json?.access_token) {
      noteLoginFailure(cleanEmail)
      return res.status(401).json({ success: false, error: 'Wrong email or password.' })
    }
    const user = grant.json.user

    let staff = await staffProfileFor(user.id)
    if (!staff) {
      staff = await bootstrapOwnerIfFirst(user.id, user.user_metadata?.full_name || null)
      if (staff) console.log(`[auth] bootstrap: ${user.email} is now the owner`)
    }
    if (!staff) {
      // Don't reveal that the password was correct but the account isn't staff —
      // that distinguishes staff from non-staff Supabase accounts. Mirror the
      // wrong-password response exactly, lockout counting included. audit C19.
      noteLoginFailure(cleanEmail)
      return res.status(401).json({ success: false, error: 'Wrong email or password.' })
    }
    clearLoginFailures(cleanEmail)

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
