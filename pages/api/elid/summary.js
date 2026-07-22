// ELID summary — owner-only, read-only. Returns the reseller's own ELID credit
// balance (the upstream telecom account) for a small Settings card. Optional
// ?username= reads a specific ELID user instead of the configured self account.
import { withStaff } from '../../../lib/auth.js'
import { elidEnabled, elidBalance, elidSelfUsername } from '../../../lib/elid.js'

async function handler(req, res) {
  if (req.staff?.role !== 'owner') return res.status(403).json({ success: false, error: 'Owner only.' })
  if (!elidEnabled) return res.status(503).json({ success: false, error: 'ELID not configured.' })
  const uname = (req.query.username || elidSelfUsername || '').toString().trim()
  if (!uname) return res.status(400).json({ success: false, error: 'No ELID account set (ELID_SELF_USERNAME / ELID_API_USER).' })
  const r = await elidBalance(uname)
  if (!r.ok) return res.status(502).json({ success: false, error: r.error })
  return res.json({ success: true, account: uname, balance: r.balance })
}

export default withStaff(handler)
