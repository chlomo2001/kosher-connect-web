// Staff login: password grant against Supabase Auth, staff_profiles gate,
// first-user-becomes-owner bootstrap, httpOnly session cookie.

import { tablesMode } from '../../../lib/db.js'
import {
  passwordLogin,
  sessionCookie,
  staffProfileFor,
  bootstrapOwnerIfFirst,
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
    const grant = await passwordLogin(String(email).trim(), String(password))
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

    res.setHeader('Set-Cookie', sessionCookie(grant.json))
    return res.json({ success: true, role: staff.role })
  } catch (e) {
    console.error('[api/auth/login]', e)
    return res.status(500).json({ success: false, error: 'Login failed — try again.' })
  }
}
