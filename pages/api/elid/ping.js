// ELID connection probe — owner-only, read-only.
//
// Solved so far: HTTP (HTTPS cert is bad); hash = SHA1(u + <hashed params> +
// secret); user_balance_get / balance are permitted and just need a target user.
//
// Two modes:
//   • no query      → sweep read functions, report which authenticate.
//   • ?id=123  OR  ?username=levi
//                   → look that user up via user_balance_get, trying both hash
//                     variants (target not hashed / target hashed) so we lock
//                     the exact per-function recipe and prove a live read.
// Nothing is created or changed.
import { withStaff } from '../../../lib/auth.js'
import { elidEnabled, elidCall, elidStatus } from '../../../lib/elid.js'

const SWEEP = [
  'user_details_get', 'user_balance_get', 'balance', 'get_balance',
  'dids_get', 'calls', 'user_calls_get', 'payments_get', 'devices_get',
  'services_get', 'users_get',
]

// Per-user USAGE recipes, now matched to the Kolmisoft MOR API docs
// (wiki.kolmisoft.com). The earlier "Incorrect hash" was wrong param NAMES +
// wrong date format, not a wrong secret:
//   user_details_get → user_id | username ; hash SHA1(u + user_id + secret)
//   user_calls_get   → s_user + period_start + period_end (UNIX seconds!) ;
//                      hash SHA1(u + s_user + period_start + period_end + secret)
//   dids_get         → only u is hashed: SHA1(u + secret) ; filters are unhashed
//   payments_get     → try user_id hashed, and the u-only variant

async function run(base, func, params, hashOrder) {
  const out = await elidCall(func, params, { hashOrder, base })
  return {
    func, params, hashRule: `SHA1(u${hashOrder.length ? ' + ' + hashOrder.join(' + ') : ''} + secret)`,
    httpStatus: out.httpStatus, ok: !!out.ok, error: out.error || null,
    connError: !!out.connError, errorCode: out.errorCode || null,
    dataKeys: out.ok ? Object.keys(out.data || {}).slice(0, 20) : [],
    data: out.ok ? out.data : undefined,
    rawSnippet: String(out.raw || '').slice(0, 260),
  }
}

async function handler(req, res) {
  if (req.staff?.role !== 'owner') return res.status(403).json({ success: false, error: 'Owner only.' })
  const status = elidStatus()
  if (!elidEnabled) {
    return res.status(503).json({ success: false, error: 'ELID isn’t configured — set ELID_BASE_URL, ELID_API_USER, ELID_API_SECRET in Vercel, then redeploy.', status })
  }
  const base = status.base.replace(/^https:/i, 'http:') // HTTPS cert is broken

  const id = (req.query.id || '').toString().trim()
  const username = (req.query.username || '').toString().trim()

  // ── Crack mode: which hash construction does each function ACTUALLY accept? ──
  // Same SHA1(u+secret) is accepted by user_balance_get yet rejected by dids_get,
  // so MOR hashes a different param set per function. We can't read the spec
  // (wiki blocks us), so we ask the live server: for each candidate we try a
  // matrix of hash orderings and report which are NOT "Incorrect hash".
  if (req.query.crack) {
    const uname = username || 'kosherconnect'
    async function tryK(func, params, hashKeys) {
      const out = await elidCall(func, params, { hashKeys, base })
      const err = out.error || null
      // "Incorrect hash" = wrong construction. Anything else (data, "user not
      // found", "access denied") means the HASH itself was accepted.
      const hashOk = !!out.ok || (err && !/incorrect hash/i.test(err))
      return {
        func, params, hashKeys, hash: `SHA1(${hashKeys.join(' + ')} + secret)`,
        ok: !!out.ok, error: err, hashOk,
        dataKeys: out.ok ? Object.keys(out.data || {}).slice(0, 20) : [],
        data: out.ok ? out.data : undefined, rawSnippet: String(out.raw || '').slice(0, 200),
      }
    }
    // Candidate (func, params) pairs; for each we sweep several key orderings.
    const cands = [
      ['user_details_get', { username: uname }],
      ['user_details_get', { user: uname }],
      ['dids_get', {}],
      ['dids_get', { search_status: 'all' }],
      ['dids_get', { search_status: 'any' }],
      ['payments_get', {}],
      ['users_get', {}],
    ]
    const trials = []
    for (const [func, params] of cands) {
      const pk = Object.keys(params)
      const orders = [['u'], ...pk.map((k) => ['u', k]), ...pk.map((k) => [k]), ...pk.map((k) => [k, 'u'])]
      const seen = new Set()
      for (const o of orders) {
        const sig = func + '|' + o.join(',')
        if (seen.has(sig)) continue
        seen.add(sig)
        trials.push(tryK(func, params, o))
      }
    }
    const all = await Promise.all(trials)
    return res.json({
      success: true, mode: 'crack', base,
      hashAccepted: all.filter((r) => r.hashOk).map((r) => ({ func: r.func, params: Object.keys(r.params), hash: r.hash, ok: r.ok, error: r.error, dataKeys: r.dataKeys })),
      all, status,
    })
  }

  // ── Target mode: crack + prove the per-customer recipe ──
  // Key finding: SHA1(u+secret) works for kosherconnect but FAILS for a real
  // customer — because kosherconnect==u made SHA1(u+secret)==SHA1(target+secret)
  // by coincidence. So the hash is over the TARGET identifier, not u. This mode
  // tries the target-only family and reports which construction each call wants.
  if (id || username) {
    const key = id ? 'user_id' : 'username'
    const val = id || username
    const periodEnd = Math.floor(Date.now() / 1000)
    const periodStart = periodEnd - 30 * 86400

    async function runK(func, params, hashKeys) {
      const out = await elidCall(func, params, { hashKeys, base })
      return {
        func, params, hash: `SHA1(${hashKeys.join(' + ')} + secret)`,
        httpStatus: out.httpStatus, ok: !!out.ok, error: out.error || null,
        dataKeys: out.ok ? Object.keys(out.data || {}).slice(0, 30) : [],
        data: out.ok ? out.data : undefined, rawSnippet: String(out.raw || '').slice(0, 200),
      }
    }

    // Balance — primary hypothesis SHA1(target + secret), then ordered variants.
    const balance = await Promise.all([
      runK('user_balance_get', { [key]: val }, [key]),        // SHA1(target + secret)  ← primary
      runK('user_balance_get', { [key]: val }, [key, 'u']),   // SHA1(target + u + secret)
      runK('user_balance_get', { [key]: val }, ['u', key]),   // SHA1(u + target + secret)
    ])
    const balHit = balance.find((r) => r.ok)

    // Details — same hash family; resolve the numeric id from whatever works.
    const details = await Promise.all([
      runK('user_details_get', { [key]: val }, [key]),
      runK('user_details_get', { [key]: val }, [key, 'u']),
    ])
    const detHit = details.find((r) => r.ok)
    const firstNum = (v) => (Array.isArray(v) ? v[0] : v)
    let resolvedId = id || null
    if (detHit?.data) resolvedId = resolvedId || firstNum(detHit.data.id) || firstNum(detHit.data.user_id) || firstNum(detHit.data.userid) || null

    // Calls — needs the numeric s_user; try the target-only hash and the
    // full-param hash (s_user + period window) in case calls signs the range.
    const sUser = resolvedId || val
    const calls = await Promise.all([
      runK('user_calls_get', { s_user: sUser, period_start: periodStart, period_end: periodEnd }, ['s_user']),
      runK('user_calls_get', { s_user: sUser, period_start: periodStart, period_end: periodEnd }, ['s_user', 'period_start', 'period_end']),
    ])
    const callHit = calls.find((r) => r.ok)

    return res.json({
      success: true, mode: 'target', target: { [key]: val }, base, resolvedUserId: resolvedId,
      liveReadWorks: !!balHit,
      balance: balHit ? { value: balHit.data?.balance, recipe: balHit.hash } : null,
      details: detHit ? { recipe: detHit.hash, dataKeys: detHit.dataKeys, data: detHit.data } : null,
      calls: callHit ? { recipe: callHit.hash, dataKeys: callHit.dataKeys } : null,
      tries: { balance, details, calls }, status,
    })
  }

  // ── Discovery mode: which functions authenticate at all ──
  const results = []
  for (const func of SWEEP) results.push(await run(base, func, {}, []))
  return res.json({
    success: true, mode: 'discovery', base,
    hashRule: 'SHA1(u + secret) [confirmed]',
    permitted: results.filter((r) => r.ok || (r.error && !/incorrect hash|access denied|no such api/i.test(r.error))).map((r) => r.func),
    hint: 'Add ?id=<ELID user id> or ?username=<name> to prove a live balance read.',
    results, status,
  })
}

export default withStaff(handler)
