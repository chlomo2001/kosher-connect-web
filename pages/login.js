import { useState } from 'react'
import Head from 'next/head'
import ThemeToggle from '../components/ThemeToggle'

export default function Login({ supabaseUrl, googleEnabled }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [ticket, setTicket] = useState('') // set → we're on the 2FA code step
  const [code, setCode] = useState('')

  function google() {
    if (!supabaseUrl) return
    const redirect = `${window.location.origin}/auth/google`
    window.location.href =
      `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirect)}`
  }

  async function submit(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (data.success && data.twofa) {
        setTicket(data.ticket)
      } else if (data.success) {
        window.location.href = '/'
        return
      } else {
        setError(data.error || 'Login failed.')
      }
    } catch {
      setError('Login failed — try again.')
    }
    setBusy(false)
  }

  async function submitCode(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, ticket }),
      })
      const data = await res.json()
      if (data.success) {
        window.location.href = '/'
        return
      }
      setError(data.error || 'Wrong code.')
      if (/start again/i.test(data.error || '')) { setTicket(''); setCode('') }
    } catch {
      setError('Verification failed — try again.')
    }
    setBusy(false)
  }

  return (
    <>
      <Head>
        <title>Kosher Connect — Sign in</title>
        <meta property="og:site_name" content="Kosher Connect" />
      </Head>
      <div className="login-shell">
        <ThemeToggle style={{ position: 'fixed', top: 16, right: 16, zIndex: 10 }} />
        <form className="login-card" onSubmit={ticket ? submitCode : submit}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <img src="/logo-full-tight.png" alt="Kosher Connect" style={{ height: 44, marginBottom: 12 }} />
            <div className="login-title">Welcome back</div>
            <div className="login-sub">{ticket ? 'Check your email for your code' : 'Sign in to Kosher Connect'}</div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 8, letterSpacing: '0.02em', lineHeight: 1.5 }}>
              {/* Deliberate two-line lockup: the full list never fits the card
                  on one line, so break it where it balances — never mid-phrase
                  (no orphaned "audio"), never a dangling separator. */}
              Kosher phones worldwide<br />Travel &amp; SIMs&ensp;·&ensp;Kol Torah audio
            </div>
          </div>
          {ticket ? (
            <>
              <div style={{ fontSize: 13, textAlign: 'center', marginBottom: 12, lineHeight: 1.5 }}>
                📬 A 6-digit code is on its way to<br /><strong>{email}</strong>
              </div>
              <input
                className="form-input" inputMode="numeric" name="code" maxLength={6} pattern="[0-9]*" aria-label="Six-digit code" placeholder="Enter the code" value={code}
                onChange={e => setCode(e.target.value)} autoFocus required
                style={{ width: '100%', marginBottom: 14, textAlign: 'center', letterSpacing: '0.3em', fontSize: 18 }}
              />
              {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 12 }}>{error}</div>}
              <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%', padding: '10px 16px' }}>
                {busy ? 'Checking…' : 'Verify code'}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => { setTicket(''); setCode(''); setError('') }}
                style={{ width: '100%', padding: '8px 16px', marginTop: 8, fontSize: 12 }}>
                ← Back
              </button>
            </>
          ) : (
            <>
              <input
                className="form-input" type="email" name="email" autoComplete="username" aria-label="Email address" placeholder="Email" value={email}
                onChange={e => setEmail(e.target.value)} autoFocus required
                style={{ width: '100%', marginBottom: 10 }}
              />
              <input
                className="form-input" type="password" name="password" autoComplete="current-password" aria-label="Password" placeholder="Password" value={password}
                onChange={e => setPassword(e.target.value)} required
                style={{ width: '100%', marginBottom: 14 }}
              />
              {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 12 }}>{error}</div>}
              <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%', padding: '10px 16px' }}>
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
              {googleEnabled && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0', color: 'var(--muted)', fontSize: 12 }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} /> or <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  </div>
                  <button type="button" className="btn btn-outline" onClick={google}
                    style={{ width: '100%', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700 }}>G</span> Continue with Google
                  </button>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
                    Kosher Connect is our staff dashboard for running the shop — rentals, SIM plans, repairs and bookings.
                    Signing in with Google only confirms your name and email address to identify your staff account;
                    we never access your Gmail, Drive, or anything else in your Google account.
                  </div>
                </>
              )}
            </>
          )}
          <div className="login-legal" style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginTop: 16 }}>
            <a href="https://kosher-connect.com/privacy" style={{ color: 'inherit' }}>Privacy policy</a>
            {' · '}
            <a href="https://kosher-connect.com/terms" style={{ color: 'inherit' }}>Terms of service</a>
          </div>
        </form>
      </div>
    </>
  )
}

// Already signed in → straight to the app. We VALIDATE the session here (not just
// cookie presence): a present-but-invalid cookie must be cleared and the form
// shown, otherwise the app shell renders, its boot 401s to /login, and this page
// would bounce it back to '/' forever. audit C9 (+ C20: honest cookie check).
export async function getServerSideProps({ req, res }) {
  const { authEnabled, resolveStaff, sessionCookie, readSessionCookie } = await import('../lib/auth.js')
  if (authEnabled && readSessionCookie(req)?.at) {
    const resolved = await resolveStaff(req).catch(() => null)
    if (resolved?.staff) {
      if (resolved.setCookie) res.setHeader('Set-Cookie', resolved.setCookie)
      return { redirect: { destination: '/', permanent: false } }
    }
    // Cookie present but not a valid staff session → clear it, show the form.
    res.setHeader('Set-Cookie', sessionCookie(null))
  }
  return {
    props: {
      supabaseUrl: (process.env.SUPABASE_URL || '').replace(/\/$/, ''),
      // Staff Google button appears when STAFF_GOOGLE=1 (after enabling the
      // Google provider in Supabase and allow-listing /auth/google).
      googleEnabled: process.env.STAFF_GOOGLE === '1',
    },
  }
}
