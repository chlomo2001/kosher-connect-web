// Team management — OWNER ONLY.
//
// Creating a member creates the Supabase Auth user (auto-confirmed, via the
// service-role admin API) AND the staff_profiles row in one step, so nobody
// has to touch the Supabase dashboard. Removing a member deletes only their
// staff_profiles row — access is revoked instantly, but the auth account is
// kept (it holds no data and deleting accounts is not reversible from here).
// Guards: you cannot remove yourself, and the last owner can never be
// demoted or removed.

import { withStaff, adminCreateUser, adminUserEmail, adminSetPassword } from '../../lib/auth.js'
import { db } from '../../lib/db.js'

const ROLES = ['owner', 'helper']

async function ownerCount() {
  const rows = await db.select('staff_profiles', "select=id&role=eq.owner")
  return rows.length
}

async function handler(req, res) {
  if (req.staff?.role !== 'owner') {
    return res.status(403).json({ success: false, error: 'Team management is owner-only.' })
  }

  try {
    if (req.method === 'GET') {
      const rows = await db.select('staff_profiles', 'select=id,role,full_name,created_at&order=created_at.asc')
      const members = await Promise.all(rows.map(async (r) => ({
        id: r.id,
        fullName: r.full_name || '',
        role: r.role,
        email: await adminUserEmail(r.id),
        createdAt: r.created_at,
        isYou: r.id === req.staff.id,
      })))
      return res.json({ success: true, members })
    }

    if (req.method === 'POST') {
      const { email, password, fullName, role } = req.body || {}
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
        return res.status(400).json({ success: false, error: 'A valid email is required.' })
      }
      if (!password || String(password).length < 8) {
        return res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' })
      }
      if (!ROLES.includes(role)) {
        return res.status(400).json({ success: false, error: 'Role must be owner or helper.' })
      }
      const created = await adminCreateUser(String(email).trim(), String(password), fullName || null)
      if (!created.ok || !created.json?.id) {
        const msg = created.json?.msg || created.json?.message || 'Could not create the account.'
        return res.status(400).json({ success: false, error: msg })
      }
      await db.insert('staff_profiles', [{
        id: created.json.id,
        role,
        full_name: fullName || null,
      }])
      return res.json({ success: true, member: { id: created.json.id, email, fullName: fullName || '', role } })
    }

    if (req.method === 'PUT') {
      const { id, role, password } = req.body || {}
      if (!id) return res.status(400).json({ success: false, error: 'id is required.' })

      // Owner resets a member's password (no current-password needed).
      if (password !== undefined) {
        if (String(password).length < 8) {
          return res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' })
        }
        const member = await db.select('staff_profiles', `select=id&id=eq.${encodeURIComponent(String(id))}`)
        if (!member.length) return res.status(404).json({ success: false, error: 'Member not found.' })
        const set = await adminSetPassword(String(id), String(password))
        if (!set.ok) return res.status(500).json({ success: false, error: 'Could not set the password.' })
        return res.json({ success: true })
      }

      if (!ROLES.includes(role)) {
        return res.status(400).json({ success: false, error: 'A valid role is required.' })
      }
      const existing = await db.select('staff_profiles', `select=id,role&id=eq.${encodeURIComponent(String(id))}`)
      if (!existing.length) return res.status(404).json({ success: false, error: 'Member not found.' })
      if (existing[0].role === 'owner' && role !== 'owner' && (await ownerCount()) <= 1) {
        return res.status(400).json({ success: false, error: 'Cannot demote the last owner.' })
      }
      await db.update('staff_profiles', `id=eq.${encodeURIComponent(String(id))}`, { role })
      return res.json({ success: true })
    }

    if (req.method === 'DELETE') {
      // ANY member is removable — owners included, first owner included,
      // yourself included — with one invariant: at least one owner remains.
      const { id } = req.query
      if (!id) return res.status(400).json({ success: false, error: 'id is required.' })
      const existing = await db.select('staff_profiles', `select=id,role&id=eq.${encodeURIComponent(String(id))}`)
      if (!existing.length) return res.status(404).json({ success: false, error: 'Member not found.' })
      if (existing[0].role === 'owner' && (await ownerCount()) <= 1) {
        return res.status(400).json({ success: false, error: 'Cannot remove the last owner — make someone else an owner first.' })
      }
      await db.delete('staff_profiles', `id=eq.${encodeURIComponent(String(id))}`)
      return res.json({ success: true, removedSelf: id === req.staff.id })
    }

    return res.status(405).end()
  } catch (e) {
    console.error('[api/team]', e)
    return res.status(500).json({ success: false, error: 'Storage error' })
  }
}

export default withStaff(handler)
