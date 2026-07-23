// ELID account roster — owner-only. Returns the seeded ELID usernames (with an
// "internal" flag for non-person accounts) so the import/review tool can show
// which ELID accounts aren't yet in KC. Read-only; no ELID call.
import { withStaff } from '../../../lib/auth.js'
import { ELID_ACCOUNTS, elidIsInternal } from '../../../lib/elidAccounts.js'
import { elidEnabled } from '../../../lib/elid.js'

async function handler(req, res) {
  if (req.staff?.role !== 'owner') return res.status(403).json({ success: false, error: 'Owner only.' })
  if (!elidEnabled) return res.status(503).json({ success: false, error: 'ELID isn’t configured.' })
  const accounts = ELID_ACCOUNTS.map((username) => ({ username, internal: elidIsInternal(username) }))
  return res.json({ success: true, accounts })
}

export default withStaff(handler)
