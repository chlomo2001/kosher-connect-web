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

// Per-user USAGE functions to crack once a target is known. MOR installs vary in
// naming, so we try the common snake_case + legacy variants and report which
// authenticate and return rows. Call/CDR functions also get a from/to window.
const USAGE_DETAIL = ['user_get', 'user_details_get', 'user_info_get']
const USAGE_CALLS = ['user_calls_get', 'calls_get', 'cdr_get', 'call_get', 'calls', 'getCDR']
const USAGE_DIDS = ['user_dids_get', 'dids_get', 'did_get']
const USAGE_PAY = ['user_payments_get', 'payments_get']

function ymd(d) { return d.toISOString().slice(0, 10) }

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

    // ── Usage sweep: crack the per-customer detail/CDR/DID/payment recipe ──
    const from = ymd(new Date(Date.now() - 30 * 86400000))
    const to = ymd(new Date())
    const usage = []
    for (const func of USAGE_DETAIL) {
      usage.push(await run(base, func, { [key]: val }, []))
      usage.push(await run(base, func, { [key]: val }, [key]))
    }
    for (const func of USAGE_CALLS) {
      usage.push(await run(base, func, { [key]: val, from, to }, []))
      usage.push(await run(base, func, { [key]: val, from, to }, [key]))
    }
    for (const func of [...USAGE_DIDS, ...USAGE_PAY]) {
      usage.push(await run(base, func, { [key]: val }, []))
    }
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
