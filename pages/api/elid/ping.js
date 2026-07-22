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

    // ── Usage sweep, MOR-correct. `val` is treated as the MOR user_id when it
    // arrived via ?id=, or the username via ?username=. Dates are UNIX seconds. ──
    const periodEnd = Math.floor(Date.now() / 1000)
    const periodStart = periodEnd - 30 * 86400
    const usage = []

    // user_details_get — hash SHA1(u + user_id + secret) (or + username)
    if (id) usage.push(await run(base, 'user_details_get', { user_id: val }, ['user_id']))
    if (username) usage.push(await run(base, 'user_details_get', { username: val }, ['username']))

    // user_calls_get — hash SHA1(u + s_user + period_start + period_end + secret)
    usage.push(await run(base, 'user_calls_get',
      { s_user: val, period_start: periodStart, period_end: periodEnd },
      ['s_user', 'period_start', 'period_end']))
    // …and with s_call_type=all appended (some installs want it in the hash)
    usage.push(await run(base, 'user_calls_get',
      { s_user: val, period_start: periodStart, period_end: periodEnd, s_call_type: 'all' },
      ['s_user', 'period_start', 'period_end', 's_call_type']))

    // dids_get — only u is hashed; filters are unhashed. List all, then narrow.
    usage.push(await run(base, 'dids_get', {}, []))
    usage.push(await run(base, 'dids_get', { search_user: val }, []))

    // payments_get — try the user_id-hashed and the u-only variants
    usage.push(await run(base, 'payments_get', { user_id: val }, ['user_id']))
    usage.push(await run(base, 'payments_get', {}, []))

    const usageHits = usage.filter((r) => r.ok)

    return res.json({
      success: true, mode: 'target', target: { [key]: val }, base,
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
