// Server-side PostgREST helper for the relational tables (staging/production).
//
// Tables mode is opt-in: it activates only when BOTH SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are set (and DATA_BACKEND !== 'store').
// Without the service key the app keeps its previous behaviour (key-value
// `store` table via lib/data.js, or local JSON files) — a safe rollout switch.
//
// The service key is server-only: these calls happen inside Next API routes,
// never in the browser. RLS stays intact for every other client; the API
// routes are the trusted operator surface until staff auth (step 1) lands.

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

  // Upsert rows keyed on `onConflict`; returns the stored representation.
  upsert: (table, rows, onConflict) =>
    rest(`${table}?on_conflict=${onConflict}`, {
      method: 'POST',
      body: rows,
      prefer: 'resolution=merge-duplicates,return=representation',
    }),

  // Delete rows matching a PostgREST filter query (e.g. 'legacy_id=eq.123').
  delete: (table, query) =>
    rest(`${table}?${query}`, { method: 'DELETE', prefer: 'return=minimal' }),
}
