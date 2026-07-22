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

  // ── Target mode: prove a live balance read + lock the hash recipe ──
  if (id || username) {
    const key = id ? 'id' : 'username'
    const val = id || username
    const results = []
    for (const func of ['user_balance_get', 'balance']) {
      results.push(await run(base, func, { [key]: val }, []))       // target NOT hashed
      results.push(await run(base, func, { [key]: val }, [key]))    // target hashed
    }
    const hit = results.find((r) => r.ok)

    // ── Usage sweep, MOR-correct, with an auto-resolve step. A username alone
    // can't drive user_calls_get (it needs the numeric s_user), so we read
    // user_details_get first, pull the numeric id out of it, then use that. ──
    const periodEnd = Math.floor(Date.now() / 1000)
    const periodStart = periodEnd - 30 * 86400
    const usage = []

    // 1) user_details_get — hash SHA1(u + user_id + secret) OR SHA1(u + username + secret)
    const detail = id
      ? await run(base, 'user_details_get', { user_id: val }, ['user_id'])
      : await run(base, 'user_details_get', { username: val }, ['username'])
    usage.push(detail)

    // Resolve the numeric MOR user id: given directly via ?id=, else dug out of
    // the details response (MOR returns it as <id>/<user_id>/<userid>).
    const firstNum = (v) => (Array.isArray(v) ? v[0] : v)
    let resolvedId = id || null
    if (detail.ok && detail.data) {
      resolvedId = resolvedId || firstNum(detail.data.id) || firstNum(detail.data.user_id) || firstNum(detail.data.userid) || null
    }

    // 2) user_calls_get — needs the numeric s_user. hash SHA1(u + s_user + period_start + period_end + secret)
    if (resolvedId) {
      usage.push(await run(base, 'user_calls_get',
        { s_user: resolvedId, period_start: periodStart, period_end: periodEnd },
        ['s_user', 'period_start', 'period_end']))
      usage.push(await run(base, 'user_calls_get',
        { s_user: resolvedId, period_start: periodStart, period_end: periodEnd, s_call_type: 'all' },
        ['s_user', 'period_start', 'period_end', 's_call_type']))
    }

    // 3) dids_get — only u is hashed; filters are unhashed. List all (maps every
    // number → its owner), then the per-user filter once we know the id.
    usage.push(await run(base, 'dids_get', {}, []))
    if (resolvedId) usage.push(await run(base, 'dids_get', { search_user: resolvedId }, []))

    // 4) payments_get — user_id-hashed if we have it, else the u-only variant
    usage.push(await run(base, 'payments_get', resolvedId ? { user_id: resolvedId } : {}, resolvedId ? ['user_id'] : []))

    const usageHits = usage.filter((r) => r.ok)

    return res.json({
      success: true, mode: 'target', target: { [key]: val }, base, resolvedUserId: resolvedId,
      liveReadWorks: !!hit,
      workingCall: hit ? { func: hit.func, hashRule: hit.hashRule, dataKeys: hit.dataKeys } : null,
      usageWorks: usageHits.map((r) => ({ func: r.func, params: Object.keys(r.params), hashRule: r.hashRule, dataKeys: r.dataKeys })),
      results, usage, status,
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
