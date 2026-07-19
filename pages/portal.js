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
import AuthBackdrop from '../components/AuthBackdrop'

// Portal copy in English + lashon hakodesh — some customers are Israelis who
// don't know English. Shares the 'kcLang' preference with /welcome (the
// welcome page's Yiddish falls back to English here).
const P = {
  en: {
    locale: 'en-GB',
    loading: 'Loading your account…',
    account: 'Your KosherConnect account',
    signout: 'Sign out',
    wallet: 'Wallet balance',
    youOwe: (v) => `You owe ${v}`,
    inCredit: (v) => `${v} in credit`,
    paidNote: '✓ Payment received — thank you. Your balance will update shortly.',
    payBtn: (v) => `Pay ${v} by card`,
    pay: (v) => `Pay ${v}`,
    starting: 'Starting…', processing: 'Processing…', cancel: 'Cancel',
    payStartFail: 'Could not start the payment.',
    payFormFail: 'Could not load the payment form.',
    payFailed: 'Payment failed.',
    payProcessing: 'Your payment is processing — we’ll update your balance shortly.',
    pmTitle: '💳 Payment method',
    cardOnFile: '✓ A card is saved on file.',
    saveCard: 'Save card', saving: 'Saving…',
    saveCardStart: 'Save a card for future payments',
    couldNotStart: 'Could not start.', couldNotLoadForm: 'Could not load the form.',
    couldNotSaveCard: 'Could not save the card.',
    rentals: '📱 Rentals', noRentals: 'No active rentals.',
    flights: '✈️ Flights', noFlights: 'No upcoming flights.',
    docs: '📄 Documents', noDocs: 'Nothing shared with you yet.',
    download: 'Download', upload: '⬆︎ Send us a document', uploading: 'Uploading…',
    upSent: 'Sent — we’ll review it shortly.', upFailed: 'Upload failed.',
    pendingReview: '⏳ awaiting review', received: '✓ received',
    questions: 'Questions? Reply to your usual KosherConnect contact.',
    subSignedOut: (g) => `${g}! See your rentals, bookings and balance`,
    yourEmail: 'Your email', emailLink: 'Email me a sign-in link', sending: 'Sending…',
    sent: '📬 If that email belongs to a KosherConnect customer, a sign-in link is on its way. You can close this page.',
    or: 'or', google: 'Continue with Google',
    greeting: (h) => (h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'),
    title: 'My KosherConnect', phoneFallback: 'Phone', flightFallback: 'Flight',
  },
  he: {
    locale: 'he-IL',
    loading: 'טוען את החשבון שלך…',
    account: 'החשבון שלך בכשר קונקט',
    signout: 'התנתקות',
    wallet: 'יתרת הארנק',
    youOwe: (v) => `לתשלום: ${v}`,
    inCredit: (v) => `${v} ביתרת זכות`,
    paidNote: '✓ התשלום התקבל — תודה. היתרה תתעדכן בקרוב.',
    payBtn: (v) => `תשלום ${v} בכרטיס`,
    pay: (v) => `לשלם ${v}`,
    starting: 'מתחיל…', processing: 'מעבד…', cancel: 'ביטול',
    payStartFail: 'לא הצלחנו להתחיל את התשלום.',
    payFormFail: 'טופס התשלום לא נטען.',
    payFailed: 'התשלום נכשל.',
    payProcessing: 'התשלום בתהליך — היתרה תתעדכן בקרוב.',
    pmTitle: '💳 אמצעי תשלום',
    cardOnFile: '✓ כרטיס שמור במערכת.',
    saveCard: 'שמירת כרטיס', saving: 'שומר…',
    saveCardStart: 'שמירת כרטיס לתשלומים עתידיים',
    couldNotStart: 'לא הצלחנו להתחיל.', couldNotLoadForm: 'הטופס לא נטען.',
    couldNotSaveCard: 'לא הצלחנו לשמור את הכרטיס.',
    rentals: '📱 השכרות', noRentals: 'אין השכרות פעילות.',
    flights: '✈️ טיסות', noFlights: 'אין טיסות קרובות.',
    docs: '📄 מסמכים', noDocs: 'עדיין לא שותפו איתך מסמכים.',
    download: 'הורדה', upload: '⬆︎ שליחת מסמך אלינו', uploading: 'מעלה…',
    upSent: 'נשלח — נבדוק בקרוב.', upFailed: 'ההעלאה נכשלה.',
    pendingReview: '⏳ ממתין לבדיקה', received: '✓ התקבל',
    questions: 'שאלות? פנו לאיש הקשר הקבוע שלכם בכשר קונקט.',
    subSignedOut: (g) => `${g}! ההשכרות, ההזמנות והיתרה שלך — במקום אחד`,
    yourEmail: 'כתובת האימייל שלך', emailLink: 'שלחו לי קישור כניסה במייל', sending: 'שולח…',
    sent: '📬 אם האימייל שייך ללקוח של כשר קונקט, קישור כניסה כבר בדרך. אפשר לסגור את העמוד.',
    or: 'או', google: 'המשך עם Google',
    greeting: (h) => (h < 12 ? 'בוקר טוב' : h < 18 ? 'צהריים טובים' : 'ערב טוב'),
    title: 'כשר קונקט שלי', phoneFallback: 'טלפון', flightFallback: 'טיסה',
  },
}

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

  // Language: English / lashon hakodesh
  const [lang, setLang] = useState('en')
  useEffect(() => { try {
    // Portal keeps its OWN en/he view in kcPortalLang; fall back to the shared
    // /welcome preference (which may be 'yi' — the portal has no Yiddish, so 'yi'
    // shows English) only when the portal hasn't been toggled here before.
    const p = localStorage.getItem('kcPortalLang')
    if (p === 'he' || p === 'en') { setLang(p); return }
    if (localStorage.getItem('kcLang') === 'he') setLang('he')
  } catch { /* stay en */ } }, [])
  const L = P[lang]
  const isHe = lang === 'he'
  const dir = isHe ? 'rtl' : 'ltr'
  const fl = isHe ? 'left' : 'right'      // "float to the far side" flips in RTL
  const flipLang = () => {
    const n = isHe ? 'en' : 'he'
    setLang(n)
    try {
      localStorage.setItem('kcPortalLang', n)
      // Don't clobber a Yiddish site preference set on /welcome: only mirror the
      // portal toggle into the shared key when it isn't 'yi'.
      if (localStorage.getItem('kcLang') !== 'yi') localStorage.setItem('kcLang', n)
    } catch { /* not persisted */ }
  }
  const langBtn = (
    <button type="button" onClick={flipLang} lang={isHe ? 'en' : 'he'}
      title={isHe ? 'Switch to English' : 'לעבור לעברית'}
      style={{
        position: 'fixed', top: 16, right: 62, zIndex: 10, cursor: 'pointer',
        border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
        borderRadius: 999, padding: '8px 13px', fontSize: 12.5, lineHeight: 1,
      }}>
      {isHe ? 'English' : 'עברית'}
    </button>
  )

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
    return isNaN(t) ? d : t.toLocaleDateString(L.locale, { day: 'numeric', month: 'short', year: 'numeric' })
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
      if (!d.success) setDocMsg(d.error || L.upFailed)
      else { setDocMsg(L.upSent); loadDocs() }
    } catch { setDocMsg(L.upFailed) }
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
      if (!d.success) { setPayMsg(d.error || L.payStartFail); setPayBusy(false); return }
      setPay({ clientSecret: d.clientSecret, publishableKey: d.publishableKey, amount: d.amount })
    } catch { setPayMsg(L.payStartFail); setPayBusy(false) }
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
      } catch (e) { setPayMsg(e.message || L.payFormFail); setPayBusy(false) }
    })()
    return () => { cancelled = true }
  }, [pay])
  async function confirmPay() {
    if (!stripeRef.current) return
    setPayBusy(true); setPayMsg('')
    const { stripe, elements } = stripeRef.current
    const { error, paymentIntent } = await stripe.confirmPayment({ elements, redirect: 'if_required' })
    if (error) { setPayMsg(error.message || L.payFailed); setPayBusy(false); return }
    if (paymentIntent && paymentIntent.status === 'succeeded') {
      setPaid(true); setPay(null); stripeRef.current = null
      // The webhook posts the ledger entry; give it a moment, then refresh.
      setTimeout(() => loadAccount(token()), 2500)
    } else { setPayMsg(L.payProcessing); setPayBusy(false) }
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
      if (!d.success) { setSaveMsg(d.error || L.couldNotStart); setSaveBusy(false); return }
      setSaveCard({ clientSecret: d.clientSecret, publishableKey: d.publishableKey })
    } catch { setSaveMsg(L.couldNotStart); setSaveBusy(false) }
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
      } catch (e) { setSaveMsg(e.message || L.couldNotLoadForm); setSaveBusy(false) }
    })()
    return () => { cancelled = true }
  }, [saveCard])
  async function confirmSaveCard() {
    if (!setupRef.current) return
    setSaveBusy(true); setSaveMsg('')
    const { stripe, elements } = setupRef.current
    const { error, setupIntent } = await stripe.confirmSetup({ elements, redirect: 'if_required' })
    if (error) { setSaveMsg(error.message || L.couldNotSaveCard); setSaveBusy(false); return }
    if (setupIntent && setupIntent.status === 'succeeded') {
      setCardSaved(true); setSaveCard(null); setupRef.current = null
    } else { setSaveMsg(L.saving); setSaveBusy(false) }
  }

  function google() {
    if (!supabaseUrl) return
    const redirect = `${window.location.origin}/portal`
    window.location.href =
      `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirect)}`
  }

  const greeting = L.greeting(new Date().getHours())

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
        <Head><title>{L.title}</title></Head>
        <div className="login-shell"><div className="login-mesh" aria-hidden="true" />
          <AuthBackdrop />
          <ThemeToggle style={{ position: 'fixed', top: 16, right: 16, zIndex: 10 }} />
          {langBtn}
          <div className="login-card" dir={dir} style={{ textAlign: 'center' }}>{L.loading}</div>
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
        <Head><title>{L.title}</title></Head>
        <div className="login-shell">
          <div className="login-mesh" aria-hidden="true" />
          <ThemeToggle style={{ position: 'fixed', top: 16, right: 16, zIndex: 10 }} />
          {langBtn}
          <div className="login-card" dir={dir} style={{ maxWidth: 520, width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <div className="login-title" style={{ fontSize: 22 }}>
                  {greeting}{account.customer?.firstName ? `, ${account.customer.firstName}` : ''}
                </div>
                <div className="login-sub">{L.account}</div>
              </div>
              <button className="btn btn-outline" onClick={signOut} style={{ fontSize: 12, padding: '6px 12px' }}>{L.signout}</button>
            </div>

            <div style={{
              borderRadius: 12, padding: '16px 18px', marginBottom: 18,
              background: owes ? 'rgba(239,68,68,0.10)' : 'rgba(34,197,94,0.10)',
              border: `1px solid ${owes ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
            }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{L.wallet}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: owes ? '#dc2626' : '#16a34a' }}>
                {owes ? L.youOwe(fmtGbp(Math.abs(account.balance))) : account.balance > 0 ? L.inCredit(fmtGbp(account.balance)) : fmtGbp(0)}
              </div>
              {paid && <div role="status" style={{ fontSize: 13, color: '#16a34a', marginTop: 8 }}>{L.paidNote}</div>}
              {owes && !pay && (
                <button className="btn btn-primary" onClick={startPay} disabled={payBusy}
                  style={{ marginTop: 12, width: '100%', padding: '10px 16px' }}>
                  {payBusy ? L.starting : L.payBtn(fmtGbp(Math.abs(account.balance)))}
                </button>
              )}
              {payMsg && <div role="alert" style={{ fontSize: 12, color: '#dc2626', marginTop: 8 }}>{payMsg}</div>}
              {pay && (
                <div style={{ marginTop: 12 }}>
                  <div id="kc-pay-element" />
                  <button className="btn btn-primary" onClick={confirmPay} disabled={payBusy}
                    style={{ marginTop: 12, width: '100%', padding: '10px 16px' }}>
                    {payBusy ? L.processing : L.pay(fmtGbp(pay.amount))}
                  </button>
                  <button className="btn btn-outline" onClick={() => { setPay(null); stripeRef.current = null }}
                    style={{ marginTop: 8, width: '100%', padding: '8px 16px', fontSize: 13 }}>{L.cancel}</button>
                </div>
              )}
            </div>

            {/* Payment method — save a card for future payments */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{L.pmTitle}</div>
              {(account.cardOnFile || cardSaved) ? (
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>{L.cardOnFile}</div>
              ) : saveCard ? (
                <div>
                  <div id="kc-savecard-element" />
                  <button className="btn btn-primary" onClick={confirmSaveCard} disabled={saveBusy}
                    style={{ marginTop: 12, width: '100%', padding: '10px 16px' }}>{saveBusy ? L.saving : L.saveCard}</button>
                  <button className="btn btn-outline" onClick={() => { setSaveCard(null); setupRef.current = null }}
                    style={{ marginTop: 8, width: '100%', padding: '8px 16px', fontSize: 13 }}>{L.cancel}</button>
                </div>
              ) : (
                <button className="btn btn-outline" onClick={startSaveCard} disabled={saveBusy}
                  style={{ fontSize: 13, padding: '8px 14px' }}>{saveBusy ? L.starting : L.saveCardStart}</button>
              )}
              {saveMsg && <div role="status" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>{saveMsg}</div>}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{L.rentals}</div>
              {activeRentals.length === 0
                ? <div style={{ fontSize: 13, color: 'var(--muted)' }}>{L.noRentals}</div>
                : activeRentals.map((r, i) => (
                  <div key={i} style={{ fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <bdi dir="ltr">{r.phoneNumber || L.phoneFallback}</bdi> · {r.country}
                    <span style={{ color: 'var(--muted)' }}> · <bdi dir="ltr">{fmtDate(r.fromDate)} {isHe ? '←' : '→'} {fmtDate(r.toDate)}</bdi></span>
                    <span style={{ float: fl, color: 'var(--muted)' }}>{r.status}</span>
                  </div>
                ))}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{L.flights}</div>
              {upcoming.length === 0
                ? <div style={{ fontSize: 13, color: 'var(--muted)' }}>{L.noFlights}</div>
                : upcoming.map((b, i) => (
                  <div key={i} style={{ fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    {b.route || L.flightFallback}{b.airline ? ` · ${b.airline}` : ''}
                    <span style={{ color: 'var(--muted)' }}>{b.travelDate ? ` · ${fmtDate(b.travelDate)}` : ''}</span>
                    <span style={{ float: fl, color: 'var(--muted)' }}>{b.status}</span>
                  </div>
                ))}
            </div>

            {/* Documents */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{L.docs}</div>
              {staffDocs.length === 0
                ? <div style={{ fontSize: 13, color: 'var(--muted)' }}>{L.noDocs}</div>
                : staffDocs.map((d) => (
                  <div key={d.id} style={{ fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{d.filename}</span>
                    <button className="btn btn-outline" onClick={() => downloadDoc(d.id)} style={{ fontSize: 12, padding: '4px 10px' }}>{L.download}</button>
                  </div>
                ))}

              <div style={{ marginTop: 12 }}>
                <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={onPickFile} style={{ display: 'none' }} />
                <button className="btn btn-outline" onClick={() => fileRef.current && fileRef.current.click()} disabled={docBusy}
                  style={{ fontSize: 13, padding: '8px 14px' }}>
                  {docBusy ? L.uploading : L.upload}
                </button>
                {docMsg && <span role="status" style={{ fontSize: 12, color: 'var(--muted)', marginInlineStart: 10 }}>{docMsg}</span>}
              </div>

              {myUploads.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  {myUploads.map((d) => (
                    <div key={d.id} style={{ fontSize: 12, color: 'var(--muted)', padding: '4px 0' }}>
                      {d.filename}
                      <span style={{ float: fl }}>
                        {d.status === 'pending' ? L.pendingReview : d.status === 'published' ? L.received : d.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: 18, fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>
              {L.questions}
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Head><title>{L.title}</title></Head>
      <div className="login-shell">
        <div className="login-mesh" aria-hidden="true" />
        <AuthBackdrop />
        <ThemeToggle style={{ position: 'fixed', top: 16, right: 16, zIndex: 10 }} />
        {langBtn}
        <form className="login-card" dir={dir} onSubmit={submit}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <img src="/logo-full.png" alt="KosherConnect" style={{ height: 72, marginBottom: 10 }} />
            <div className="login-title">{L.title}</div>
            <div className="login-sub">{L.subSignedOut(greeting)}</div>
          </div>
          {sent ? (
            <div style={{ fontSize: 14, textAlign: 'center', lineHeight: 1.5 }}>
              {L.sent}
            </div>
          ) : (
            <>
              <input
                className="form-input" type="email" placeholder={L.yourEmail} value={email}
                onChange={e => setEmail(e.target.value)} autoFocus required
                aria-label={L.yourEmail} dir="ltr" autoComplete="email"
                style={{ width: '100%', marginBottom: 14, textAlign: isHe ? 'right' : 'left' }}
              />
              <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%', padding: '10px 16px' }}>
                {busy ? L.sending : L.emailLink}
              </button>
              {googleEnabled && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0', color: 'var(--muted)', fontSize: 12 }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} /> {L.or} <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  </div>
                  <button type="button" className="btn btn-outline" onClick={google}
                    style={{ width: '100%', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700 }}>G</span> {L.google}
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
