// Staff authentication for the operator app.
//
// Model: Supabase Auth (email/password) + the staff_profiles table decides
// WHO is staff and their role (owner/helper). The session lives in an
// httpOnly cookie holding access + refresh tokens; API routes verify the
// access token against Supabase Auth on every request and silently refresh
// when it expires.
//
// Bootstrap: the FIRST user ever to log in becomes the owner (a two-person
// shop needs no invite flow yet); later logins require an existing
// staff_profiles row — an authenticated non-staff user is rejected.
//
// Enforcement scope: auth is enforced only in tables mode (the same switch
// as the data layer). Blob/file mode keeps today's behaviour so local dev
// and the legacy deployment are unaffected.

import { db, tablesMode } from './db.js'

const SB_URL = (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '')
const SB_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
const COOKIE = 'kc_session'

export const authEnabled = tablesMode

// ---------- Supabase Auth REST ----------

async function authRequest(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${SB_URL}/auth/v1/${path}`, {
    method,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${token || SB_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  const json = text ? JSON.parse(text) : null
  return { ok: res.ok, status: res.status, json }
}

export function passwordLogin(email, password) {
  return authRequest('token?grant_type=password', { method: 'POST', body: { email, password } })
}

function refreshSession(refreshToken) {
  return authRequest('token?grant_type=refresh_token', {
    method: 'POST',
    body: { refresh_token: refreshToken },
  })
}

function getUser(accessToken) {
  return authRequest('user', { token: accessToken })
}

// ---------- Auth admin (service-role only; used by the owner's Team screen) ----------

export function adminCreateUser(email, password, fullName) {
  return authRequest('admin/users', {
    method: 'POST',
    body: {
      email,
      password,
      email_confirm: true,
      user_metadata: fullName ? { full_name: fullName } : undefined,
    },
  })
}

export async function adminUserEmail(userId) {
  const r = await authRequest(`admin/users/${userId}`)
  return r.ok ? r.json?.email || '' : ''
}

// ---------- cookie ----------

export function sessionCookie(session) {
  const value = session
    ? Buffer.from(JSON.stringify({
        at: session.access_token,
        rt: session.refresh_token,
      })).toString('base64url')
    : ''
  const maxAge = session ? 60 * 60 * 24 * 30 : 0
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${maxAge}`
}

export function readSessionCookie(req) {
  const raw = req.headers?.cookie || ''
  const m = raw.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`))
  if (!m) return null
  try {
    return JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

// ---------- staff resolution ----------

export async function staffProfileFor(userId) {
  const rows = await db.select('staff_profiles', `select=id,role,full_name&id=eq.${userId}`)
  return rows.length ? rows[0] : null
}

// First-ever staff member becomes the owner.
export async function bootstrapOwnerIfFirst(userId, fullName) {
  const existing = await db.select('staff_profiles', 'select=id&limit=1')
  if (existing.length) return null
  const [row] = await db.insert('staff_profiles', [{
    id: userId,
    role: 'owner',
    full_name: fullName || null,
  }])
  return row
}

// ---------- request guard ----------

// Resolve the staff session on a request. Returns { staff, setCookie? } or
// null. When the access token has expired but the refresh token works, the
// caller must forward setCookie so the browser gets the renewed session.
export async function resolveStaff(req) {
  const sess = readSessionCookie(req)
  if (!sess?.at) return null

  let user = await getUser(sess.at)
  let renewed = null
  if (!user.ok && sess.rt) {
    const refreshed = await refreshSession(sess.rt)
    if (refreshed.ok && refreshed.json?.access_token) {
      renewed = refreshed.json
      user = await getUser(renewed.access_token)
    }
  }
  if (!user.ok || !user.json?.id) return null

  const staff = await staffProfileFor(user.json.id)
  if (!staff) return null
  return {
    staff: { ...staff, email: user.json.email },
    setCookie: renewed ? sessionCookie(renewed) : null,
  }
}

// Wrap an API handler: 401 unless the request carries a valid staff session.
// req.staff = { id, role, full_name, email } inside the handler.
export function withStaff(handler) {
  return async function guarded(req, res) {
    if (!authEnabled) return handler(req, res)
    const resolved = await resolveStaff(req)
    if (!resolved) {
      return res.status(401).json({ success: false, error: 'Not signed in.' })
    }
    if (resolved.setCookie) res.setHeader('Set-Cookie', resolved.setCookie)
    req.staff = resolved.staff
    return handler(req, res)
  }
}
