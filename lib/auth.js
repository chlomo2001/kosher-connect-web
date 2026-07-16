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

// #80 — auth is its OWN concern, no longer silently disabled just because the
// data-layer flag is off. It's on by default; only an explicit AUTH_MODE=off
// (local dev) turns it off. tablesMode is asserted by every data route now, so
// a missing service key fails loudly rather than dropping auth on the floor.
export const authEnabled = process.env.AUTH_MODE !== 'off'

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

// #66 — verify a customer-portal access token (from the magic-link / OAuth
// redirect) and return its user record, or null. Read-only; no session cookie.
export async function verifyPortalToken(accessToken) {
  if (!accessToken) return null
  const r = await getUser(accessToken).catch(() => null)
  return r && r.ok && r.json && r.json.email ? r.json : null
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

// Set a user's password via the admin API. Existing sessions stay valid
// until their tokens expire — access itself is unchanged, only the secret.
export function adminSetPassword(userId, password) {
  return authRequest(`admin/users/${userId}`, { method: 'PUT', body: { password } })
}

// ---------- staff 2FA (password + emailed code) ----------
// Step 1 verifies the password but sets NO cookie; a 6-digit code goes to
// the staff email (Supabase OTP) plus a signed short-lived ticket proving
// the password step happened. Step 2 needs ticket + code; the session comes
// from the OTP verification. Escape hatch: STAFF_2FA=0 disables the step
// (owner can set it in Vercel without being logged in).

import crypto from 'node:crypto'

export const staff2faEnabled = () => process.env.STAFF_2FA !== '0'

export function sendEmailOtp(email) {
  return authRequest('otp', { method: 'POST', body: { email, create_user: false } })
}

export function verifyEmailOtp(email, token) {
  return authRequest('verify', { method: 'POST', body: { type: 'email', email, token } })
}

const TICKET_TTL_MS = 5 * 60 * 1000 // 5 min — tight second-factor window (audit C13)

export function make2faTicket(email) {
  const exp = Date.now() + TICKET_TTL_MS
  const mac = crypto.createHmac('sha256', SB_KEY).update(`${email}|${exp}`).digest('base64url')
  return `${exp}.${mac}`
}

export function check2faTicket(email, ticket) {
  const [expStr, mac] = String(ticket || '').split('.')
  const exp = Number(expStr)
  if (!Number.isFinite(exp) || exp < Date.now() || !mac) return false
  const expect = crypto.createHmac('sha256', SB_KEY).update(`${email}|${exp}`).digest('base64url')
  const a = Buffer.from(mac)
  const b = Buffer.from(expect)
  // Length-guard BEFORE timingSafeEqual: it throws on a length mismatch and `mac`
  // is attacker-controlled, so an unhandled throw here 500s verify-2fa. audit C18.
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

// Best-effort in-memory 2FA brute-force guard (same accepted trade-off as
// staffCache: serverless recycling only makes it stricter, and Supabase's OTP
// rate limit is the durable backstop). Voids a ticket after too many wrong codes
// so a captured/replayed ticket can't grind the 6-digit space. audit C13.
const ticketFails = new Map()
const MAX_2FA_ATTEMPTS = 5
export function twofaTicketLocked(ticket) {
  const e = ticketFails.get(String(ticket || ''))
  return !!(e && e.n >= MAX_2FA_ATTEMPTS)
}
export function note2faFailure(ticket) {
  const key = String(ticket || '')
  const e = ticketFails.get(key) || { n: 0 }
  e.n += 1
  if (ticketFails.size > 500) ticketFails.clear()
  ticketFails.set(key, e)
}
export function clear2faFailures(ticket) { ticketFails.delete(String(ticket || '')) }

// ---------- customer portal (flag-gated scaffold) ----------

// Send a Supabase magic-link email. Used by the customer portal once
// PORTAL_ENABLED=1; the auth user is created on first login and linked to
// customers.auth_user_id by the portal session handler (live-portal build).
export function sendMagicLink(email) {
  return authRequest('otp', { method: 'POST', body: { email, create_user: true } })
}

// ---------- helper visibility ----------

export const ALL_TABS = ['dashboard', 'customers', 'rentals', 'sim', 'wallet',
  'bookings', 'repairs', 'services', 'shop', 'virtual', 'tasks', 'settings']

export async function helperTabs() {
  const rows = await db.select('settings', 'select=text_value&key=eq.helper_tabs')
  const csv = rows[0]?.text_value || ''
  const list = csv.split(',').map(s => s.trim()).filter(t => ALL_TABS.includes(t))
  return list.length ? list : ALL_TABS // an empty/broken row must never lock helpers out entirely
}

// Server-side guard for tab-scoped endpoints: owners always pass.
export async function tabAllowedFor(staff, tab) {
  if (!staff || staff.role === 'owner') return true
  return (await helperTabs()).includes(tab)
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
  const rows = await db.select('staff_profiles', `select=id,role,full_name,email&id=eq.${userId}`)
  return rows.length ? rows[0] : null
}

// Resolve a staff profile by verified email — lets the same person sign in
// with password OR Google (different auth-user id, same email).
export async function staffProfileByEmail(email) {
  if (!email) return null
  const rows = await db.select('staff_profiles',
    `select=id,role,full_name,email&email=eq.${encodeURIComponent(String(email).toLowerCase())}`)
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
// Tiny in-memory cache: access-token → resolved staff. A page load fires
// ~10 API calls at once; without this each one pays the same two Supabase
// round-trips (getUser + staff_profiles). Serverless instances recycle
// often and the TTL is short, so a revoked session still dies quickly.
const staffCache = new Map()
const STAFF_CACHE_TTL = 60 * 1000

export async function resolveStaff(req) {
  const sess = readSessionCookie(req)
  if (!sess?.at) return null

  const hit = staffCache.get(sess.at)
  if (hit && hit.exp > Date.now()) return { staff: hit.staff, setCookie: null }

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

  // Match by auth-user id first, then by verified email (Google sign-in
  // creates a new id but carries the same email as the password account).
  let staff = await staffProfileFor(user.json.id)
  if (!staff && user.json.email) staff = await staffProfileByEmail(user.json.email)
  if (!staff) return null
  const resolved = { ...staff, email: user.json.email }
  if (!renewed) {
    if (staffCache.size > 500) staffCache.clear() // hard cap, never grows unbounded
    staffCache.set(sess.at, { staff: resolved, exp: Date.now() + STAFF_CACHE_TTL })
  }
  return {
    staff: resolved,
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

// Tab-scoped endpoint guard. The customer card cross-reads many features, so
// any signed-in staff may READ (GET); but a WRITE (POST/PUT/DELETE) requires
// the tab to be enabled for that helper (owners always pass). This is the
// server-side enforcement of the "what helpers can see/do" setting, which was
// previously applied ONLY in the browser. Sensitive reads and admin-only
// actions are gated additionally inside the handler (see requireOwner).
export function withTab(tab, handler) {
  return withStaff(async (req, res) => {
    if (authEnabled && req.method !== 'GET' && !(await tabAllowedFor(req.staff, tab))) {
      return res.status(403).json({ success: false, error: `Your account isn’t allowed to change ${tab}.` })
    }
    return handler(req, res)
  })
}

// Owner-only gate for use inside a handler. Returns true if it already sent a
// 403 (caller should return). No-op when auth is disabled (local dev).
export function requireOwner(req, res) {
  if (authEnabled && req.staff && req.staff.role !== 'owner') {
    res.status(403).json({ success: false, error: 'This action is admin-only.' })
    return true
  }
  return false
}
