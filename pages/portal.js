// Customer portal — SCAFFOLD. Returns 404 until PORTAL_ENABLED=1 is set in the
// environment, so nothing customer-facing is live before launch.
//
// Signed-in customers get a read-only "my account" slice (#66) PLUS, in phase 2:
//   • Documents — download what staff shared, and upload files back (which land
//     as 'pending' for staff to approve).
//   • Pay by card — clear an outstanding balance via Stripe (dormant until the
//     Stripe keys are set; the button just says so until then).

import { useState, useEffect, useRef, useCallback } from 'react'
import Head from 'next/head'
import ThemeToggle from '../components/ThemeToggle'

function loadStripeJs() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('no window'))
    if (window.Stripe) return resolve(window.Stripe)
    const s = document.createElement('script')
    s.src = 'https://js.stripe.com/v3/'
    s.onload = () => resolve(window.Stripe)
    s.onerror = () => reject(new Error('Could not load the payment form.'))
    document.head.appendChild(s)
  })
}

export default function Portal({ supabaseUrl, googleEnabled }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(false)

  // Documents
  const [docs, setDocs] = useState(null)
  const [docBusy, setDocBusy] = useState(false)
  const [docMsg, setDocMsg] = useState('')
  const fileRef = useRef(null)

  // Pay by card
  const [pay, setPay] = useState(null) // { clientSecret, publishableKey, amount } | null
  const [payBusy, setPayBusy] = useState(false)
  const [payMsg, setPayMsg] = useState('')
  const [paid, setPaid] = useState(false)
  const stripeRef = useRef(null)

  // Save a card on file (SetupIntent — no charge now)
  const [saveCard, setSaveCard] = useState(null)
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [cardSaved, setCardSaved] = useState(false)
  const setupRef = useRef(null)

  const token = () => (typeof window !== 'undefined' ? sessionStorage.getItem('kc_portal_token') : null)

  const loadAccount = useCallback((tok) => {
    setLoading(true)
    return fetch('/api/portal/me', { headers: { Authorization: `Bearer ${tok}` } })
      .then((r) => r.json())
      .then((d) => { if (d && d.success) setAccount(d); else signOut() })
      .catch(() => signOut())
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const tok = hash.get('access_token') || sessionStorage.getItem('kc_portal_token')
    if (!tok) return
    sessionStorage.setItem('kc_portal_token', tok)
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname)
    loadAccount(tok)
  }, [loadAccount])

  // Load documents once signed in.
  const loadDocs = useCallback(() => {
    const tok = token()
    if (!tok) return
    fetch('/api/portal/documents', { headers: { Authorization: `Bearer ${tok}` } })
      .then((r) => (r.status === 404 ? { success: true, documents: [] } : r.json()))
      .then((d) => setDocs(d.success ? d.documents : []))
      .catch(() => setDocs([]))
  }, [])
  useEffect(() => { if (account) loadDocs() }, [account, loadDocs])

  function signOut() {
    if (typeof window !== 'undefined') sessionStorage.removeItem('kc_portal_token')
    setAccount(null); setDocs(null); setPay(null); setPaid(false)
    setSaveCard(null); setCardSaved(false); setupRef.current = null
  }

  const fmtGbp = (v) => `£${(Math.round((Number(v) || 0) * 100) / 100).toFixed(2)}`
  const fmtDate = (d) => {
    if (!d) return ''
    const t = new Date(d)
    return isNaN(t) ? d : t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  // ── Documents actions ──────────────────────────────────────────────────────
  async function onPickFile(e) {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    setDocMsg(''); setDocBusy(true)
    try {
      const dataBase64 = await new Promise((resolve, reject) => {
        const fr = new FileReader()
        fr.onload = () => resolve(String(fr.result))
        fr.onerror = reject
        fr.readAsDataURL(file)
      })
      const r = await fetch('/api/portal/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ filename: file.name, contentType: file.type, dataBase64 }),
      })
      const d = await r.json()
      if (!d.success) setDocMsg(d.error || 'Upload failed.')
      else { setDocMsg('Sent — we’ll review it shortly.'); loadDocs() }
    } catch { setDocMsg('Upload failed.') }
    finally { setDocBusy(false); if (fileRef.current) fileRef.current.value = '' }
  }
  async function downloadDoc(id) {
    try {
      const r = await fetch(`/api/portal/documents/download?id=${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token()}` },
      })
      const d = await r.json()
      if (d.success && d.url) window.open(d.url, '_blank', 'noopener')
    } catch { /* ignore */ }
  }

  // ── Pay by card ────────────────────────────────────────────────────────────
  async function startPay() {
    setPayMsg(''); setPayBusy(true)
    try {
      const r = await fetch('/api/portal/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({}),
      })
      const d = await r.json()
      if (!d.success) { setPayMsg(d.error || 'Could not start the payment.'); setPayBusy(false); return }
      setPay({ clientSecret: d.clientSecret, publishableKey: d.publishableKey, amount: d.amount })
    } catch { setPayMsg('Could not start the payment.'); setPayBusy(false) }
  }
  // Mount the Stripe Payment Element once we have a client secret.
  useEffect(() => {
    if (!pay?.clientSecret) return
    let cancelled = false
    ;(async () => {
      try {
        const Stripe = await loadStripeJs()
        if (cancelled) return
        const stripe = Stripe(pay.publishableKey)
        const elements = stripe.elements({ clientSecret: pay.clientSecret })
        const el = elements.create('payment')
        el.mount('#kc-pay-element')
        stripeRef.current = { stripe, elements }
        setPayBusy(false)
      } catch (e) { setPayMsg(e.message || 'Could not load the payment form.'); setPayBusy(false) }
    })()
    return () => { cancelled = true }
  }, [pay])
  async function confirmPay() {
    if (!stripeRef.current) return
    setPayBusy(true); setPayMsg('')
    const { stripe, elements } = stripeRef.current
    const { error, paymentIntent } = await stripe.confirmPayment({ elements, redirect: 'if_required' })
    if (error) { setPayMsg(error.message || 'Payment failed.'); setPayBusy(false); return }
    if (paymentIntent && paymentIntent.status === 'succeeded') {
      setPaid(true); setPay(null); stripeRef.current = null
      // The webhook posts the ledger entry; give it a moment, then refresh.
      setTimeout(() => loadAccount(token()), 2500)
    } else { setPayMsg('Your payment is processing — we’ll update your balance shortly.'); setPayBusy(false) }
  }

  // ── Save a card on file ────────────────────────────────────────────────────
  async function startSaveCard() {
    setSaveMsg(''); setSaveBusy(true)
    try {
      const r = await fetch('/api/portal/save-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({}),
      })
      const d = await r.json()
      if (!d.success) { setSaveMsg(d.error || 'Could not start.'); setSaveBusy(false); return }
      setSaveCard({ clientSecret: d.clientSecret, publishableKey: d.publishableKey })
    } catch { setSaveMsg('Could not start.'); setSaveBusy(false) }
  }
  useEffect(() => {
    if (!saveCard?.clientSecret) return
    let cancelled = false
    ;(async () => {
      try {
        const Stripe = await loadStripeJs()
        if (cancelled) return
        const stripe = Stripe(saveCard.publishableKey)
        const elements = stripe.elements({ clientSecret: saveCard.clientSecret })
        const el = elements.create('payment')
        el.mount('#kc-savecard-element')
        setupRef.current = { stripe, elements }
        setSaveBusy(false)
      } catch (e) { setSaveMsg(e.message || 'Could not load the form.'); setSaveBusy(false) }
    })()
    return () => { cancelled = true }
  }, [saveCard])
  async function confirmSaveCard() {
    if (!setupRef.current) return
    setSaveBusy(true); setSaveMsg('')
    const { stripe, elements } = setupRef.current
    const { error, setupIntent } = await stripe.confirmSetup({ elements, redirect: 'if_required' })
    if (error) { setSaveMsg(error.message || 'Could not save the card.'); setSaveBusy(false); return }
    if (setupIntent && setupIntent.status === 'succeeded') {
      setCardSaved(true); setSaveCard(null); setupRef.current = null
    } else { setSaveMsg('Saving…'); setSaveBusy(false) }
  }

  function google() {
    if (!supabaseUrl) return
    const redirect = `${window.location.origin}/portal`
    window.location.href =
      `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirect)}`
  }

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
    const staffDocs = (docs || []).filter((d) => d.source === 'staff')
    const myUploads = (docs || []).filter((d) => d.source === 'customer')
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
              {paid && <div style={{ fontSize: 13, color: '#16a34a', marginTop: 8 }}>✓ Payment received — thank you. Your balance will update shortly.</div>}
              {owes && !pay && (
                <button className="btn btn-primary" onClick={startPay} disabled={payBusy}
                  style={{ marginTop: 12, width: '100%', padding: '10px 16px' }}>
                  {payBusy ? 'Starting…' : `Pay ${fmtGbp(Math.abs(account.balance))} by card`}
                </button>
              )}
              {payMsg && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 8 }}>{payMsg}</div>}
              {pay && (
                <div style={{ marginTop: 12 }}>
                  <div id="kc-pay-element" />
                  <button className="btn btn-primary" onClick={confirmPay} disabled={payBusy}
                    style={{ marginTop: 12, width: '100%', padding: '10px 16px' }}>
                    {payBusy ? 'Processing…' : `Pay ${fmtGbp(pay.amount)}`}
                  </button>
                  <button className="btn btn-outline" onClick={() => { setPay(null); stripeRef.current = null }}
                    style={{ marginTop: 8, width: '100%', padding: '8px 16px', fontSize: 13 }}>Cancel</button>
                </div>
              )}
            </div>

            {/* Payment method — save a card for future payments */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>💳 Payment method</div>
              {(account.cardOnFile || cardSaved) ? (
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>✓ A card is saved on file.</div>
              ) : saveCard ? (
                <div>
                  <div id="kc-savecard-element" />
                  <button className="btn btn-primary" onClick={confirmSaveCard} disabled={saveBusy}
                    style={{ marginTop: 12, width: '100%', padding: '10px 16px' }}>{saveBusy ? 'Saving…' : 'Save card'}</button>
                  <button className="btn btn-outline" onClick={() => { setSaveCard(null); setupRef.current = null }}
                    style={{ marginTop: 8, width: '100%', padding: '8px 16px', fontSize: 13 }}>Cancel</button>
                </div>
              ) : (
                <button className="btn btn-outline" onClick={startSaveCard} disabled={saveBusy}
                  style={{ fontSize: 13, padding: '8px 14px' }}>{saveBusy ? 'Starting…' : 'Save a card for future payments'}</button>
              )}
              {saveMsg && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>{saveMsg}</div>}
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

            <div style={{ marginBottom: 16 }}>
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

            {/* Documents */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>📄 Documents</div>
              {staffDocs.length === 0
                ? <div style={{ fontSize: 13, color: 'var(--muted)' }}>Nothing shared with you yet.</div>
                : staffDocs.map((d) => (
                  <div key={d.id} style={{ fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{d.filename}</span>
                    <button className="btn btn-outline" onClick={() => downloadDoc(d.id)} style={{ fontSize: 12, padding: '4px 10px' }}>Download</button>
                  </div>
                ))}

              <div style={{ marginTop: 12 }}>
                <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={onPickFile} style={{ display: 'none' }} />
                <button className="btn btn-outline" onClick={() => fileRef.current && fileRef.current.click()} disabled={docBusy}
                  style={{ fontSize: 13, padding: '8px 14px' }}>
                  {docBusy ? 'Uploading…' : '⬆︎ Send us a document'}
                </button>
                {docMsg && <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 10 }}>{docMsg}</span>}
              </div>

              {myUploads.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  {myUploads.map((d) => (
                    <div key={d.id} style={{ fontSize: 12, color: 'var(--muted)', padding: '4px 0' }}>
                      {d.filename}
                      <span style={{ float: 'right' }}>
                        {d.status === 'pending' ? '⏳ awaiting review' : d.status === 'published' ? '✓ received' : d.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
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
      googleEnabled: process.env.PORTAL_GOOGLE === '1',
    },
  }
}
