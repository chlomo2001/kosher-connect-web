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

const TICKET_TTL_MS = 10 * 60 * 1000

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
  return crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expect))
}

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
