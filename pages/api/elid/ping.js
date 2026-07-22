// ELID connection probe — owner-only, read-only. State so far:
//   • HTTPS on elid.co.il has a bad cert → we use HTTP (the secret is never
//     sent, only its SHA1 hash; response data is the only plaintext exposure).
//   • Auth is solved: hash = SHA1(u + secret) is accepted ("Access Denied" for
//     users_get means authorised-but-not-permitted, not a bad hash).
// This pass hunts for a read function THIS api user is allowed to call, so we
// can build the first real feature on it. Nothing is created or changed.
import { withStaff } from '../../../lib/auth.js'
import { elidEnabled, elidCall, elidStatus } from '../../../lib/elid.js'

// Read-only MOR functions to try, each with hash = SHA1(u + secret) (no extra
// hashed params). A "needs an id / missing param" error still means we're IN —
// it's the "Access Denied" / "Incorrect hash" ones we're ruling out.
const FUNCS = [
  'user_details_get', 'user_balance_get', 'balance', 'get_balance',
  'dids_get', 'did_owners_get', 'calls', 'user_calls_get', 'payments_get',
  'devices_get', 'services_get', 'users_get',
]

async function handler(req, res) {
  if (req.staff?.role !== 'owner') return res.status(403).json({ success: false, error: 'Owner only.' })
  const status = elidStatus()
  if (!elidEnabled) {
    return res.status(503).json({
      success: false,
      error: 'ELID isn’t configured yet — set ELID_BASE_URL, ELID_API_USER and ELID_API_SECRET in Vercel, then redeploy.',
      status,
    })
  }

  const httpBase = status.base.replace(/^https:/i, 'http:') // HTTPS cert is broken

  const results = []
  for (const func of FUNCS) {
    const out = await elidCall(func, {}, { hashOrder: [], base: httpBase })
    const err = out.error || null
    results.push({
      func,
      httpStatus: out.httpStatus,
      ok: !!out.ok,                       // no <error> at all → real data
      error: err,
      // "authorised" = the server accepted the hash and the user; only the
      // request content (e.g. a missing id) was wrong.
      authorised: !!out.ok || !!(err && !/incorrect hash|access denied|no such api/i.test(err)),
      connError: !!out.connError,
      errorCode: out.errorCode || null,
      dataKeys: out.ok ? Object.keys(out.data || {}).slice(0, 15) : [],
      rawSnippet: String(out.raw || '').slice(0, 220),
    })
  }

  const readable = results.filter((r) => r.ok)
  const permitted = results.filter((r) => r.authorised)
  return res.json({
    success: true,
    base: httpBase,
    hashRule: 'SHA1(u + secret)  [confirmed]',
    readableFunctions: readable.map((r) => r.func),
    permittedFunctions: permitted.map((r) => r.func),
    status,
    results,
  })
}

export default withStaff(handler)
