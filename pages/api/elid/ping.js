// ELID connection probe — owner-only, read-only. Confirms the credentials work
// and pins the exact MOR v1 hash recipe this install expects (which params go
// into the hash varies by server config). Tries a few variants of a harmless
// "list my users" call and reports what each returned, so we can lock the recipe
// in one round-trip. Nothing is created or changed.
import { withStaff } from '../../../lib/auth.js'
import { elidEnabled, elidCall, elidStatus } from '../../../lib/elid.js'

async function handler(req, res) {
  if (req.staff?.role !== 'owner') return res.status(403).json({ success: false, error: 'Owner only.' })
  if (!elidEnabled) {
    return res.status(503).json({
      success: false,
      error: 'ELID isn’t configured yet — set ELID_BASE_URL, ELID_API_USER and ELID_API_SECRET in Vercel, then redeploy.',
      status: elidStatus(),
    })
  }

  // Candidate hash recipes for users_get (read-only). We only need one to work.
  const recipes = [
    { label: 'u only', func: 'users_get', params: {}, hashOrder: [] },
    { label: 'u + test, test not hashed', func: 'users_get', params: { test: 1 }, hashOrder: [] },
    { label: 'u + test hashed', func: 'users_get', params: { test: 1 }, hashOrder: ['test'] },
  ]

  const results = []
  for (const r of recipes) {
    try {
      const out = await elidCall(r.func, r.params, { hashOrder: r.hashOrder })
      results.push({
        recipe: r.label,
        httpStatus: out.httpStatus,
        ok: out.ok,
        error: out.error || null,
        dataKeys: out.ok ? Object.keys(out.data || {}).slice(0, 12) : [],
        rawSnippet: String(out.raw || '').slice(0, 400),
      })
      if (out.ok) break // found a working recipe — stop probing
    } catch (e) {
      results.push({ recipe: r.label, error: String(e.message || e) })
    }
  }

  const worked = results.find((x) => x.ok)
  return res.json({
    success: true,
    connected: !!worked,
    workingRecipe: worked ? worked.recipe : null,
    status: elidStatus(),
    results,
  })
}

export default withStaff(handler)
