import { authEnabled, resolveStaff, helperTabs, ALL_TABS } from '../../../lib/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  if (!authEnabled) return res.json({ success: true, authEnabled: false })
  const resolved = await resolveStaff(req)
  if (!resolved) return res.status(401).json({ success: false, error: 'Not signed in.' })
  if (resolved.setCookie) res.setHeader('Set-Cookie', resolved.setCookie)
  const allowedTabs = resolved.staff.role === 'owner' ? ALL_TABS : await helperTabs()
  return res.json({ success: true, authEnabled: true, staff: resolved.staff, allowedTabs })
}
