// ELID connection probe — owner-only, read-only. Diagnoses the connection AND
// pins the MOR v1 hash recipe. Tries both https and http (ELID's panel shows as
// "Not Secure", so it may be HTTP or have a dodgy cert) and, when a connection
// works, a few harmless "list my users" hash variants. Surfaces the REAL network
// error (cert / refused / timeout / DNS) so a failure is actionable. No writes.
import { withStaff } from '../../../lib/auth.js'
import { elidEnabled, elidCall, elidStatus } from '../../../lib/elid.js'

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

  // Try the configured scheme first, then the other scheme as a fallback.
  const bases = [status.base]
  const alt = /^https:/i.test(status.base) ? status.base.replace(/^https:/i, 'http:') : status.base.replace(/^http:/i, 'https:')
  if (alt !== status.base) bases.push(alt)

  // Candidate hash recipes for users_get (read-only). One working is enough.
  const recipes = [
    { label: 'u only', func: 'users_get', params: {}, hashOrder: [] },
    { label: 'u + test, test not hashed', func: 'users_get', params: { test: 1 }, hashOrder: [] },
    { label: 'u + test hashed', func: 'users_get', params: { test: 1 }, hashOrder: ['test'] },
  ]

  const results = []
  let worked = null
  outer:
  for (const base of bases) {
    for (const r of recipes) {
      const out = await elidCall(r.func, r.params, { hashOrder: r.hashOrder, base })
      const row = {
        base, recipe: r.label, httpStatus: out.httpStatus,
        connError: !!out.connError, errorCode: out.errorCode || null,
        errorDetail: out.connError ? out.errorDetail : null,
        ok: !!out.ok, error: out.error || null,
        dataKeys: out.ok ? Object.keys(out.data || {}).slice(0, 12) : [],
        rawSnippet: String(out.raw || '').slice(0, 300),
      }
      results.push(row)
      if (out.ok) { worked = row; break outer }
      if (out.connError) break // can't connect on this scheme — try the other base
    }
  }

  return res.json({
    success: true,
    connected: !!worked,
    workingRecipe: worked ? worked.recipe : null,
    workingBase: worked ? worked.base : null,
    status,
    results,
  })
}

export default withStaff(handler)
