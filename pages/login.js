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
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'var(--bg, #0f1115)',
      }}>
        <form onSubmit={submit} style={{
          width: 340, padding: '32px 28px', borderRadius: 14,
          background: 'var(--bg-card, #171a21)',
          border: '1px solid var(--border, #262b36)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 22 }}>
            <img src="/logo.png" alt="" style={{ height: 46, marginBottom: 10 }} />
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text, #e7eaf0)' }}>KosherConnect</div>
            <div style={{ fontSize: 12, color: 'var(--muted, #8b93a3)' }}>Staff sign in</div>
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
          {error && <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%' }}>
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
