// Customer portal — SCAFFOLD. Returns 404 until PORTAL_ENABLED=1 is set in
// the environment, so nothing customer-facing is live before launch. The
// magic-link session handler + "my rentals / my balance" pages arrive with
// the live-portal build.

import { useState } from 'react'
import Head from 'next/head'

export default function Portal({ supabaseUrl, googleEnabled }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  // "Continue with Google" → Supabase OAuth. Dormant until the Google
  // provider is turned on in Supabase (googleEnabled), at which point this
  // button just works — Supabase creates the auth user and the portal
  // session handler links it to customers.auth_user_id.
  function google() {
    if (!supabaseUrl) return
    const redirect = `${window.location.origin}/portal`
    window.location.href =
      `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirect)}`
  }

  // Personal touch: time-of-day greeting. Once portal sessions exist the
  // customer's first name joins it ("Good afternoon, Rivka").
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  async function submit(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      await fetch('/api/portal/request-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
    } catch { /* the message below is identical either way */ }
    setSent(true)
    setBusy(false)
  }

  return (
    <>
      <Head><title>My KosherConnect</title></Head>
      <div className="login-shell">
        <div className="login-mesh" aria-hidden="true" />
        <form className="login-card" onSubmit={submit}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <img src="/logo-full.png" alt="KosherConnect" style={{ height: 72, marginBottom: 10 }} />
            <div className="login-title">My KosherConnect</div>
            <div className="login-sub">{greeting}! See your rentals, bookings and balance</div>
          </div>
          {sent ? (
            <div style={{ fontSize: 14, textAlign: 'center', lineHeight: 1.5 }}>
              📬 If that email belongs to a KosherConnect customer, a sign-in
              link is on its way. You can close this page.
            </div>
          ) : (
            <>
              <input
                className="form-input" type="email" placeholder="Your email" value={email}
                onChange={e => setEmail(e.target.value)} autoFocus required
                style={{ width: '100%', marginBottom: 14 }}
              />
              <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%', padding: '10px 16px' }}>
                {busy ? 'Sending…' : 'Email me a sign-in link'}
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

export async function getServerSideProps() {
  if (process.env.PORTAL_ENABLED !== '1') return { notFound: true }
  return {
    props: {
      supabaseUrl: (process.env.SUPABASE_URL || '').replace(/\/$/, ''),
      // Show the Google button only once you flip PORTAL_GOOGLE=1 (after
      // enabling the Google provider in Supabase).
      googleEnabled: process.env.PORTAL_GOOGLE === '1',
    },
  }
}
