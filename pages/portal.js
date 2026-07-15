// Customer portal — SCAFFOLD. Returns 404 until PORTAL_ENABLED=1 is set in
// the environment, so nothing customer-facing is live before launch. The
// magic-link session handler + "my rentals / my balance" pages arrive with
// the live-portal build.

import { useState, useEffect } from 'react'
import Head from 'next/head'
import ThemeToggle from '../components/ThemeToggle'

export default function Portal({ supabaseUrl, googleEnabled }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  // #66 — read-only "my account" slice. The magic-link / OAuth redirect lands
  // back here with the access token in the URL hash; we verify it server-side
  // and show the customer only their own balance, rentals and bookings.
  const [account, setAccount] = useState(null)   // loaded data
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const token = hash.get('access_token') || sessionStorage.getItem('kc_portal_token')
    if (!token) return
    sessionStorage.setItem('kc_portal_token', token)
    // Clean the token out of the address bar.
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname)
    setLoading(true)
    fetch('/api/portal/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { if (d && d.success) setAccount(d); else signOut() })
      .catch(() => signOut())
      .finally(() => setLoading(false))
  }, [])

  function signOut() {
    if (typeof window !== 'undefined') sessionStorage.removeItem('kc_portal_token')
    setAccount(null)
  }

  const fmtGbp = (v) => `£${(Math.round((Number(v) || 0) * 100) / 100).toFixed(2)}`
  const fmtDate = (d) => {
    if (!d) return ''
    const t = new Date(d)
    return isNaN(t) ? d : t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

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

  // ── Signed-in read-only account view ──────────────────────────────────────
  if (loading) {
    return (
      <>
        <Head><title>My KosherConnect</title></Head>
        <div className="login-shell"><div className="login-mesh" aria-hidden="true" />
          <ThemeToggle style={{ position: 'fixed', top: 16, right: 16, zIndex: 10 }} />
          <div className="login-card" style={{ textAlign: 'center' }}>Loading your account…</div>
        </div>
      </>
    )
  }
  if (account) {
    const owes = account.balance < 0
    const activeRentals = (account.rentals || []).filter((r) => r.status !== 'returned' && r.status !== 'cancelled')
    const upcoming = (account.bookings || []).filter((b) => b.status !== 'Cancelled' && b.status !== 'Completed')
    return (
      <>
        <Head><title>My KosherConnect</title></Head>
        <div className="login-shell">
          <div className="login-mesh" aria-hidden="true" />
          <ThemeToggle style={{ position: 'fixed', top: 16, right: 16, zIndex: 10 }} />
          <div className="login-card" style={{ maxWidth: 520, width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <div className="login-title" style={{ fontSize: 22 }}>
                  {greeting}{account.customer?.firstName ? `, ${account.customer.firstName}` : ''}
                </div>
                <div className="login-sub">Your KosherConnect account</div>
              </div>
              <button className="btn btn-outline" onClick={signOut} style={{ fontSize: 12, padding: '6px 12px' }}>Sign out</button>
            </div>

            <div style={{
              borderRadius: 12, padding: '16px 18px', marginBottom: 18,
              background: owes ? 'rgba(239,68,68,0.10)' : 'rgba(34,197,94,0.10)',
              border: `1px solid ${owes ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
            }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Wallet balance</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: owes ? '#dc2626' : '#16a34a' }}>
                {owes ? `You owe ${fmtGbp(Math.abs(account.balance))}` : account.balance > 0 ? `${fmtGbp(account.balance)} in credit` : fmtGbp(0)}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>📱 Rentals</div>
              {activeRentals.length === 0
                ? <div style={{ fontSize: 13, color: 'var(--muted)' }}>No active rentals.</div>
                : activeRentals.map((r, i) => (
                  <div key={i} style={{ fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    {r.phoneNumber || 'Phone'} · {r.country}
                    <span style={{ color: 'var(--muted)' }}> · {fmtDate(r.fromDate)} → {fmtDate(r.toDate)}</span>
                    <span style={{ float: 'right', color: 'var(--muted)' }}>{r.status}</span>
                  </div>
                ))}
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>✈️ Flights</div>
              {upcoming.length === 0
                ? <div style={{ fontSize: 13, color: 'var(--muted)' }}>No upcoming flights.</div>
                : upcoming.map((b, i) => (
                  <div key={i} style={{ fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    {b.route || 'Flight'}{b.airline ? ` · ${b.airline}` : ''}
                    <span style={{ color: 'var(--muted)' }}>{b.travelDate ? ` · ${fmtDate(b.travelDate)}` : ''}</span>
                    <span style={{ float: 'right', color: 'var(--muted)' }}>{b.status}</span>
                  </div>
                ))}
            </div>

            <div style={{ marginTop: 18, fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>
              Questions? Reply to your usual KosherConnect contact.
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Head><title>My KosherConnect</title></Head>
      <div className="login-shell">
        <div className="login-mesh" aria-hidden="true" />
        <ThemeToggle style={{ position: 'fixed', top: 16, right: 16, zIndex: 10 }} />
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
