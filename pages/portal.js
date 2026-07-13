// Customer portal — SCAFFOLD. Returns 404 until PORTAL_ENABLED=1 is set in
// the environment, so nothing customer-facing is live before launch. The
// magic-link session handler + "my rentals / my balance" pages arrive with
// the live-portal build.

import { useState } from 'react'
import Head from 'next/head'

export default function Portal() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

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
            </>
          )}
        </form>
      </div>
    </>
  )
}

export async function getServerSideProps() {
  if (process.env.PORTAL_ENABLED !== '1') return { notFound: true }
  return { props: {} }
}
