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
      <Head><title>Sign in · KosherConnect</title></Head>
      <div className="login-shell">
        <div className="login-mesh" aria-hidden="true" />
        <ThemeToggle style={{ position: 'fixed', top: 16, right: 16, zIndex: 10 }} />
        <form className="login-card" onSubmit={ticket ? submitCode : submit}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <img src="/logo-full.png" alt="KosherConnect" style={{ height: 72, marginBottom: 10 }} />
            <div className="login-title">KosherConnect</div>
            <div className="login-sub">{ticket ? 'Check your email' : 'Staff sign in'}</div>
          </div>
          {ticket ? (
            <>
              <div style={{ fontSize: 13, textAlign: 'center', marginBottom: 12, lineHeight: 1.5 }}>
                📬 A 6-digit code is on its way to<br /><strong>{email}</strong>
              </div>
              <input
                className="form-input" inputMode="numeric" placeholder="Enter the code" value={code}
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
                className="form-input" type="email" placeholder="Email" value={email}
                onChange={e => setEmail(e.target.value)} autoFocus required
                style={{ width: '100%', marginBottom: 10 }}
              />
              <input
                className="form-input" type="password" placeholder="Password" value={password}
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
                </>
              )}
            </>
          )}
        </form>
      </div>
    </>
  )
}

// Already signed in (cookie present) → straight to the app.
export async function getServerSideProps({ req }) {
  if ((req.headers.cookie || '').includes('kc_session=')) {
    return { redirect: { destination: '/', permanent: false } }
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
