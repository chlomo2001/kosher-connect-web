// Self-service password change: prove you know the CURRENT password (a live
// login attempt), then the new one is set via the admin API. Owner resets
// for other members live in /api/team (PUT with a password field).

import { withStaff, passwordLogin, adminSetPassword } from '../../../lib/auth.js'

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { currentPassword, newPassword } = req.body || {}

  if (!newPassword || String(newPassword).length < 8) {
    return res.status(400).json({ success: false, error: 'New password must be at least 8 characters.' })
  }
  if (!req.staff?.email) {
    return res.status(400).json({ success: false, error: 'Could not resolve your account email.' })
  }

  const check = await passwordLogin(req.staff.email, String(currentPassword || ''))
  if (!check.ok) {
    return res.status(403).json({ success: false, error: 'Current password is wrong.' })
  }

  const set = await adminSetPassword(req.staff.id, String(newPassword))
  if (!set.ok) {
    return res.status(500).json({ success: false, error: 'Could not update the password — try again.' })
  }
  return res.json({ success: true })
}

export default withStaff(handler)
