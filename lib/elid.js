// ELID reseller API — ELID runs Kolmisoft MOR, and its install exposes the
// LEGACY v1 API (XML over GET); the REST v2 returns "There is no such API".
//
// READ-ONLY for now, and env-gated: nothing happens until the owner pastes the
// credentials into Vercel. Writes (provisioning, payments) come later behind a
// send-style gate, mirroring lib/sms.js.
//
// Auth (MOR v1): every call carries u=<user> and hash, where
//     hash = SHA1( <u value><the hashed param values, in order><API secret> )
// The API Secret Key is ALWAYS last and never appears in the URL. Which params
// go into the hash (and their order) is per-function, so elidCall() takes an
// explicit hashOrder. Keep "Disable hash checking" OFF in ELID — the hash is
// the secure mode.
//
// URL: <ELID_BASE_URL>/billing/api/<function>?u=<user>&<params>&hash=<hash>
//
// Env (owner pastes in Vercel — SECRET never in code/repo/chat):
//   ELID_BASE_URL    e.g. https://elid.co.il
//   ELID_API_USER    the reseller API username
//   ELID_API_SECRET  the "API Secret Key" from ELID → Settings → API
import crypto from 'crypto'

const BASE = (process.env.ELID_BASE_URL || '').trim().replace(/\/+$/, '')
const USER = (process.env.ELID_API_USER || '').trim()
const SECRET = (process.env.ELID_API_SECRET || '').trim()

// The reseller's own ELID account to show a balance for (defaults to the API
// user). Override with ELID_SELF_USERNAME if the API login differs from the
// billing account you want to display.
export const elidSelfUsername = (process.env.ELID_SELF_USERNAME || process.env.ELID_API_USER || '').trim()

export const elidEnabled = !!(BASE && USER && SECRET)

// Safe to expose (no secrets) — for /api/health and diagnostics.
export function elidStatus() {
  return { configured: elidEnabled, provider: elidEnabled ? 'elid-mor-v1' : null, base: elidEnabled ? BASE : null }
}

const sha1 = (s) => crypto.createHash('sha1').update(s, 'utf8').digest('hex')

// Minimal parser for MOR's flat XML responses. Detects the <error> envelope and
// otherwise pulls leaf <tag>value</tag> pairs (repeated tags become arrays).
// Not a general XML parser — the raw text is always returned alongside so the
// caller can inspect anything this misses.
export function parseMorXml(xml) {
  const s = String(xml || '')
  const err = /<error>([\s\S]*?)<\/error>/i.exec(s)
  if (err) return { ok: false, error: err[1].trim(), raw: s }
  // Match innermost leaf tags anywhere (value has no nested '<'), so we capture
  // leaves inside container tags like <users><user><id>… too. Repeated tags
  // collapse to an array (grouping across records is lost — fine for a probe;
  // record-level parsing comes with the real feature methods).
  const out = {}
  const re = /<([a-zA-Z0-9_]+)>([^<]*)<\/\1>/g
  let m
  while ((m = re.exec(s))) {
    const [, tag, val] = m
    const v = val.trim()
    if (out[tag] === undefined) out[tag] = v
    else out[tag] = [].concat(out[tag], v)
  }
  return { ok: true, data: out, raw: s }
}

// elidCall('users_get', { test: 1 }, { hashOrder: ['test'] })
//   → { httpStatus, ok, data|error, raw, url }
// hashOrder lists the param keys (besides the implicit leading `u`) whose values
// join into the hash, in order. Defaults to the params' own order.
export async function elidCall(func, params = {}, { hashOrder, base } = {}) {
  if (!elidEnabled) throw new Error('ELID not configured')
  const b = (base || BASE).replace(/\/+$/, '')
  const all = { u: USER, ...params }
  const order = ['u', ...(hashOrder || Object.keys(params))]
  const hash = sha1(order.map((k) => String(all[k] ?? '')).join('') + SECRET)
  const qs = new URLSearchParams(all)
  qs.set('hash', hash)
  const url = `${b}/billing/api/${func}?${qs.toString()}`
  const safeUrl = SECRET ? url.split(SECRET).join('') : url // secret isn't in the URL anyway
  const doFetch = (u) => fetch(u, { signal: AbortSignal.timeout(20000) })
  try {
    let res
    try {
      res = await doFetch(url)
    } catch (e) {
      // ELID's HTTPS cert is broken; fall back to HTTP (the secret is never sent,
      // only its hash). Remove this once ELID fixes their certificate.
      const why = `${e?.cause?.code || e?.code || ''} ${e?.cause?.message || e?.message || ''}`
      if (url.startsWith('https:') && /CERT|TLS|SSL|SELF_SIGNED|UNABLE_TO_VERIFY|ALTNAME/i.test(why)) {
        res = await doFetch(url.replace(/^https:/, 'http:'))
      } else throw e
    }
    const text = await res.text().catch(() => '')
    return { httpStatus: res.status, ...parseMorXml(text), url: safeUrl }
  } catch (e) {
    // Surface the REAL network reason (Node wraps it in .cause): certificate
    // error, connection refused, timeout, DNS, etc. — that's what tells us the fix.
    return {
      httpStatus: 0, ok: false, connError: true, error: 'connection failed',
      errorCode: e?.cause?.code || e?.code || e?.name || '',
      errorDetail: String(e?.cause?.message || e?.message || e).slice(0, 200),
      url: safeUrl,
    }
  }
}

// A user's ELID (MOR) balance, by username. Proven recipe:
//   user_balance_get?u=<api user>&username=<target>&hash=SHA1(u + secret)
// (the target username is NOT part of the hash). Returns a number.
export async function elidBalance(username) {
  const uname = String(username || '').trim()
  if (!uname) return { ok: false, error: 'No ELID username given.' }
  const r = await elidCall('user_balance_get', { username: uname }, { hashOrder: [] })
  const bal = r?.data?.balance
  if (r.ok && bal !== undefined) {
    const n = Number(bal)
    return { ok: true, balance: Number.isFinite(n) ? n : null, raw: String(bal) }
  }
  return { ok: false, error: r.error || r.errorDetail || 'ELID balance read failed', errorCode: r.errorCode || null }
}
