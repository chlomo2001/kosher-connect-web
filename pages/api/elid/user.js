// ELID per-customer lookup — owner-only, read-only. Returns one ELID account's
// live balance + status by username, using the proven SHA1(username + secret)
// recipe. Nothing is created or changed. The KC customer ↔ ELID username link
// is chosen by staff on the card (remembered client-side for now); this endpoint
// just resolves whatever username it's given.
import { withStaff } from '../../../lib/auth.js'
import { elidEnabled, elidUserDetails, elidStatus } from '../../../lib/elid.js'

async function handler(req, res) {
  if (req.staff?.role !== 'owner') return res.status(403).json({ success: false, error: 'Owner only.' })
  if (!elidEnabled) {
    return res.status(503).json({ success: false, error: 'ELID isn’t configured.', status: elidStatus() })
  }
  const username = String(req.query.username || '').trim()
  if (!username) return res.status(400).json({ success: false, error: 'Give an ELID username.' })

  const d = await elidUserDetails(username)
  if (!d.ok) return res.status(502).json({ success: false, error: d.error || 'ELID lookup failed.' })
  return res.json({ success: true, account: d })
}

export default withStaff(handler)
