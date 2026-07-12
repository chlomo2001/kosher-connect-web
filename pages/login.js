import { useState } from 'react'
import Head from 'next/head'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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
      if (data.success) {
        window.location.href = '/'
        return
      }
      setError(data.error || 'Login failed.')
    } catch {
      setError('Login failed — try again.')
    }
    setBusy(false)
  }

  return (
    <>
      <Head><title>Sign in · KosherConnect</title></Head>
      <div className="login-shell">
        <div className="login-mesh" aria-hidden="true" />
        <form className="login-card" onSubmit={submit}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <img src="/logo-full.png" alt="KosherConnect" style={{ height: 72, marginBottom: 10 }} />
            <div className="login-title">KosherConnect</div>
            <div className="login-sub">Staff sign in</div>
          </div>
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
  return { props: {} }
}
