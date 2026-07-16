// Staff login step 2: the emailed 6-digit code + the step-1 ticket (which
// proves the password was verified minutes ago). The OTP verification
// itself yields the session tokens for the cookie.

import { tablesMode } from '../../../lib/db.js'
import {
  sessionCookie,
  staffProfileFor,
  check2faTicket,
  twofaTicketLocked,
  note2faFailure,
  clear2faFailures,
  verifyEmailOtp,
} from '../../../lib/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Login needs the relational data layer.' })

  const { email, code, ticket } = req.body || {}
  const cleanEmail = String(email || '').trim()
  if (!cleanEmail || !code) return res.status(400).json({ success: false, error: 'Email and code are required.' })
  if (!check2faTicket(cleanEmail, ticket)) {
    return res.status(403).json({ success: false, error: 'Sign-in expired — start again with your password.' })
  }
  if (twofaTicketLocked(ticket)) {
    return res.status(429).json({ success: false, error: 'Too many attempts — start again with your password.' })
  }

  try {
    const verified = await verifyEmailOtp(cleanEmail, String(code).trim())
    if (!verified.ok || !verified.json?.access_token) {
      note2faFailure(ticket)
      return res.status(401).json({ success: false, error: 'Wrong or expired code.' })
    }
    const staff = await staffProfileFor(verified.json.user.id)
    if (!staff) return res.status(403).json({ success: false, error: 'This account is not a staff member.' })

    clear2faFailures(ticket)
    res.setHeader('Set-Cookie', sessionCookie(verified.json))
    return res.json({ success: true, role: staff.role })
  } catch (e) {
    console.error('[api/auth/verify-2fa]', e)
    return res.status(500).json({ success: false, error: 'Verification failed — try again.' })
  }
}
