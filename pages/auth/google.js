// Staff Google sign-in landing. Supabase redirects here after Google with
// the session tokens in the URL hash (#access_token=…&refresh_token=…). We
// hand them to the server, which checks staff membership and sets the
// session cookie, then bounce to the app.

import { useEffect, useState } from 'react'
import Head from 'next/head'

export default function GoogleAuth() {
  const [error, setError] = useState('')

  useEffect(() => {
    const hash = new URLSearchParams((window.location.hash || '').replace(/^#/, ''))
    const access_token = hash.get('access_token')
    const refresh_token = hash.get('refresh_token')
    if (!access_token) {
      setError(hash.get('error_description') || 'No sign-in token — please try again.')
      return
    }
    fetch('/api/auth/google-complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token, refresh_token }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) window.location.href = '/'
        else setError(data.error || 'Sign-in failed.')
      })
      .catch(() => setError('Sign-in failed — please try again.'))
  }, [])

  return (
    <>
      <Head><title>Signing in · KosherConnect</title></Head>
      <div className="login-shell">
        <div className="login-mesh" aria-hidden="true" />
        <div className="login-card" style={{ textAlign: 'center' }}>
          <img src="/logo-full.png" alt="KosherConnect" style={{ height: 64, marginBottom: 14 }} />
          {error ? (
            <>
              <div style={{ color: 'var(--danger)', fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>{error}</div>
              <a className="btn btn-outline" href="/login" style={{ padding: '8px 16px' }}>← Back to sign in</a>
            </>
          ) : (
            <div style={{ fontSize: 14, color: 'var(--muted)' }}>Signing you in…</div>
          )}
        </div>
      </div>
    </>
  )
}
