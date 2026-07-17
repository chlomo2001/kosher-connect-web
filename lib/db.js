// Server-side PostgREST helper for the relational tables (staging/production).
//
// tablesMode is TRUE whenever SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set.
// It is the app's only data layer now (#80): the old file/key-value fallback
// was deleted, and every data route asserts tablesMode and returns 503 if the
// service key is missing — a loud misconfiguration, not a silent half-app.
//
// The service key is server-only: these calls happen inside Next API routes,
// never in the browser. RLS stays intact for every other client; the API
// routes are the trusted operator surface.

const SB_URL = (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '')
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

export const tablesMode =
  SB_URL.startsWith('https://') &&
  SERVICE_KEY.length > 0 &&
  process.env.DATA_BACKEND !== 'store'

async function rest(pathAndQuery, { method = 'GET', body, prefer } = {}) {
  const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  }
  if (prefer) headers.Prefer = prefer
  const res = await fetch(`${SB_URL}/rest/v1/${pathAndQuery}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`[db] ${method} ${pathAndQuery.split('?')[0]}: HTTP ${res.status} ${text}`)
  }
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

export const db = {
  select: (table, query = '') => rest(`${table}${query ? `?${query}` : ''}`),

  // Plain insert; returns the stored representation (with generated ids).
  insert: (table, rows) =>
    rest(table, { method: 'POST', body: rows, prefer: 'return=representation' }),

  // Insert that silently skips rows whose `onConflict` key already exists
  // (ON CONFLICT DO NOTHING). Required for append-only tables like ledger,
  // where a merge-upsert would attempt an UPDATE and trip the immutability
  // trigger. Returns only the rows actually inserted.
  insertIgnoreDup: (table, rows, onConflict) =>
    rest(`${table}?on_conflict=${onConflict}`, {
      method: 'POST',
      body: rows,
      prefer: 'resolution=ignore-duplicates,return=representation',
    }),

  // Upsert rows keyed on `onConflict`; returns the stored representation.
  upsert: (table, rows, onConflict) =>
    rest(`${table}?on_conflict=${onConflict}`, {
      method: 'POST',
      body: rows,
      prefer: 'resolution=merge-duplicates,return=representation',
    }),

  // Partial update of rows matching a PostgREST filter query.
  update: (table, query, patch) =>
    rest(`${table}?${query}`, {
      method: 'PATCH',
      body: patch,
      prefer: 'return=representation',
    }),

  // Delete rows matching a PostgREST filter query (e.g. 'legacy_id=eq.123').
  delete: (table, query) =>
    rest(`${table}?${query}`, { method: 'DELETE', prefer: 'return=minimal' }),

  // Call a Postgres function (PostgREST RPC). Used for operations SQL must do
  // atomically that PostgREST verbs can't express — e.g. a guarded
  // read-modify-write like adjust_stock_qty(item, delta). Returns the function's
  // result (a scalar for scalar-returning functions; null when it matched no row).
  rpc: (fn, args = {}) =>
    rest(`rpc/${fn}`, { method: 'POST', body: args }),

  // Claim an idempotency key. Returns TRUE if this call inserted it (first time
  // through — proceed with the side effects), FALSE if it already existed (a
  // retry / double-click / concurrent submit — short-circuit). Atomic: the
  // primary-key conflict is resolved in the database, so two racing callers
  // can't both get TRUE. Release with `db.releaseKey` if the operation aborts
  // without side effects so a genuine retry isn't blocked.
  claimKey: async (key, meta = {}) => {
    const rows = await rest('idempotency_keys?on_conflict=key', {
      method: 'POST',
      body: [{ key, scope: meta.scope || null, customer_id: meta.customerId || null }],
      prefer: 'resolution=ignore-duplicates,return=representation',
    })
    return Array.isArray(rows) && rows.length > 0
  },
  releaseKey: (key) =>
    rest(`idempotency_keys?key=eq.${encodeURIComponent(key)}`, { method: 'DELETE', prefer: 'return=minimal' }),
}
