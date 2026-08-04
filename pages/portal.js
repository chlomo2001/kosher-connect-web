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
import { formatPhoneDisplay } from '../lib/ukPhone.mjs'
import AuthBackdrop from '../components/AuthBackdrop'
import { CardIcon, FlipPhoneIcon, PlaneIcon, DocIcon, TicketIcon, SimIcon, ChatIcon } from '../components/kcIcons'

// Portal copy in English + lashon hakodesh — some customers are Israelis who
// don't know English. Shares the 'kcLang' preference with /welcome.
const P = {
  en: {
    locale: 'en-GB',
    loading: 'Loading your account…',
    account: 'Your Kosher Connect account',
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
    pmTitle: 'Payment method',
    cardOnFile: '✓ A card is saved on file.',
    saveCard: 'Save card', saving: 'Saving…',
    saveCardStart: 'Save a card for future payments',
    couldNotStart: 'Could not start.', couldNotLoadForm: 'Could not load the form.',
    couldNotSaveCard: 'Could not save the card.',
    rentals: 'Rentals', noRentals: 'No active rentals.',
    flights: 'Flights', noFlights: 'No upcoming flights.',
    simPlan: 'My SIM plan', noSims: 'No SIM plan with us yet.',
    renews: (d) => `Renews ${d}`,
    bankRef1: 'Paying by bank transfer? Please use the reference', bankRef2: 'so we can match your payment.',
    noMatchTitle: 'We couldn’t match this email to an account',
    noMatchBody: 'You’re signed in, but this email address isn’t linked to a Kosher Connect account yet. If you’re a customer, we may have a different email (or none) on file — call us and we’ll link it up in a minute.',
    tryAnother: 'Try a different email',
    statement: 'Recent activity', noStatement: 'No activity yet.',
    docs: 'Documents', noDocs: 'Nothing shared with you yet.',
    download: 'Download', upload: 'Send us a document', uploading: 'Uploading…',
    docSend: 'Send this file',
    upSent: 'Sent — we’ll review it shortly.', upFailed: 'Upload failed.',
    pendingReview: 'Awaiting review', received: 'Received',
    rejected: 'Not accepted', rejectedHint: 'Please send it again — pop into the shop or call us if unsure.',
    reqTitle: 'Need something?',
    reqHint: 'Tell us what you need and we’ll get back to you — a call back, a question about your plan, anything.',
    reqPlaceholder: 'e.g. Please call me about my SIM plan — mornings are best, 07…',
    reqSend: 'Send request', reqSending: 'Sending…',
    reqSent: '✓ Got it — we’ll be in touch.',
    reqFailed: 'That didn’t send. Please try again, or just call us.',
    qShort: 'Questions? We’re here —',
    reassure: 'No password needed — we email you a secure one-time sign-in link.',
    statuses: { active: 'Active', booked: 'Booked', overdue: 'Overdue', Booked: 'Booked', Ticketed: 'Ticketed', Confirmed: 'Confirmed' },
    daysLeft: (n) => (n === 0 ? 'returns today' : n === 1 ? 'returns tomorrow' : `${n} days left`),
    subSignedOut: (g) => `${g}! See your rentals, bookings and balance`,
    yourEmail: 'Your email', emailLink: 'Email me a sign-in link', sending: 'Sending…',
    noEmailHelp: 'No email address? Call us on', noEmailHelp2: 'and we’ll sort your account in the shop.',
    sent: '📬 If that email belongs to a Kosher Connect customer, a sign-in link is on its way. You can close this page.',
    or: 'or', google: 'Continue with Google',
    greeting: (h) => (h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'),
    title: 'My Kosher Connect', phoneFallback: 'Phone', flightFallback: 'Flight',
    backToSite: 'Back to kosher-connect.com',
  },
  // Rewritten to read as written-in-Hebrew, in the same voice as the Hebrew
  // welcome page: warm, respectful plural, plain words — not translated English.
  he: {
    locale: 'he-IL',
    loading: 'החשבון שלכם נטען…',
    account: 'החשבון שלכם בכשר קונקט',
    signout: 'יציאה מהחשבון',
    wallet: 'יתרת הארנק',
    youOwe: (v) => `יתרה לתשלום: ${v}`,
    inCredit: (v) => `${v} עומדים לזכותכם`,
    paidNote: '✓ התשלום התקבל — תודה רבה. היתרה תתעדכן בדקות הקרובות.',
    payBtn: (v) => `לתשלום ${v} בכרטיס אשראי`,
    pay: (v) => `לתשלום ${v}`,
    starting: 'רק רגע…', processing: 'התשלום מתבצע…', cancel: 'ביטול',
    payStartFail: 'התשלום לא הצליח להתחיל. נסו שוב, ואם זה חוזר על עצמו — דברו איתנו.',
    payFormFail: 'טופס התשלום לא עלה. נסו לרענן את העמוד.',
    payFailed: 'התשלום לא עבר. אפשר לנסות שוב, או פשוט לשלם אצלנו בחנות.',
    payProcessing: 'התשלום בעיצומו — היתרה תתעדכן בעוד רגע.',
    pmTitle: 'אמצעי תשלום',
    cardOnFile: '✓ כרטיס אשראי שמור אצלנו במערכת.',
    saveCard: 'שמירת כרטיס', saving: 'שומרים…',
    saveCardStart: 'לשמור כרטיס לתשלומים הבאים',
    couldNotStart: 'משהו השתבש. נסו שוב בעוד רגע.', couldNotLoadForm: 'הטופס לא עלה. נסו לרענן את העמוד.',
    couldNotSaveCard: 'הכרטיס לא נשמר. נסו שוב.',
    rentals: 'השכרות', noRentals: 'אין כרגע השכרות פעילות.',
    flights: 'טיסות', noFlights: 'אין טיסות קרובות ביומן.',
    simPlan: 'חבילת הסים שלי', noSims: 'עוד אין חבילת סים אצלנו.',
    renews: (d) => `מתחדשת ב־${d}`,
    bankRef1: 'משלמים בהעברה בנקאית? נא לציין את האסמכתא', bankRef2: 'כדי שנוכל לשייך את התשלום.',
    noMatchTitle: 'לא הצלחנו לשייך את המייל הזה לחשבון',
    noMatchBody: 'נכנסתם בהצלחה, אבל כתובת המייל הזו עדיין לא מקושרת לחשבון בכשר קונקט. ייתכן שרשומה אצלנו כתובת אחרת (או שאין בכלל) — התקשרו אלינו ונקשר את החשבון תוך דקה.',
    tryAnother: 'לנסות כתובת מייל אחרת',
    statement: 'תנועות אחרונות', noStatement: 'עוד אין תנועות להצגה.',
    docs: 'מסמכים', noDocs: 'עוד לא שותפו איתכם מסמכים.',
    download: 'הורדה', upload: 'שליחת מסמך אלינו', uploading: 'המסמך בדרך…',
    docSend: 'שליחת הקובץ',
    upSent: 'הגיע אלינו — נעבור עליו בקרוב.', upFailed: 'ההעלאה לא הצליחה. נסו שוב.',
    pendingReview: 'ממתין לבדיקה', received: 'התקבל',
    rejected: 'לא התקבל', rejectedHint: 'נא לשלוח שוב — או לגשת לחנות או להתקשר אם משהו לא ברור.',
    reqTitle: 'צריכים משהו?',
    reqHint: 'כתבו לנו מה אתם צריכים ונחזור אליכם — שיחת טלפון, שאלה על החבילה, כל דבר.',
    reqPlaceholder: 'למשל: נא להתקשר אליי בעניין חבילת הסים — עדיף בבוקר, 07…',
    reqSend: 'שליחת בקשה', reqSending: 'שולחים…',
    reqSent: '✓ קיבלנו — נחזור אליכם בקרוב.',
    reqFailed: 'הבקשה לא נשלחה. נסו שוב, או פשוט התקשרו אלינו.',
    qShort: 'יש שאלה? אנחנו כאן —',
    reassure: 'בלי סיסמה ובלי הרשמה — שולחים לכם למייל קישור כניסה מאובטח, חד־פעמי.',
    statuses: { active: 'פעילה', booked: 'שמורה', overdue: 'באיחור', Booked: 'הוזמנה', Ticketed: 'כורטסה', Confirmed: 'מאושרת' },
    daysLeft: (n) => (n === 0 ? 'חוזר היום' : n === 1 ? 'חוזר מחר' : `נותרו ${n} ימים`),
    subSignedOut: (g) => `${g}! כל ההשכרות, ההזמנות והיתרה שלכם — במקום אחד`,
    yourEmail: 'כתובת המייל שלכם', emailLink: 'שלחו לי קישור כניסה', sending: 'שולחים…',
    noEmailHelp: 'אין לכם כתובת מייל? התקשרו אלינו:', noEmailHelp2: 'ונסדר לכם גישה בחנות.',
    sent: '📬 אם הכתובת שייכת ללקוח של כשר קונקט — קישור הכניסה כבר בדרך אליכם. אפשר לסגור את העמוד.',
    or: 'או', google: 'כניסה עם Google',
    greeting: (h) => (h < 12 ? 'בוקר טוב' : h < 18 ? 'צהריים טובים' : 'ערב טוב'),
    title: 'כשר קונקט שלי', phoneFallback: 'טלפון', flightFallback: 'טיסה',
    backToSite: 'חזרה לאתר כשר קונקט',
  },
}

function loadStripeJs() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('no window'))
    if (window.Stripe) return resolve(window.Stripe)
    // Reject with an empty message so callers fall back to their localized
    // "could not load the form" copy instead of an English string.
    const timer = setTimeout(() => reject(new Error('')), 15000)
    const s = document.createElement('script')
    s.src = 'https://js.stripe.com/v3/'
    s.onload = () => { clearTimeout(timer); resolve(window.Stripe) }
    s.onerror = () => { clearTimeout(timer); reject(new Error('')) }
    document.head.appendChild(s)
  })
}

// fetch that gives up instead of leaving a button stuck on "Starting…" forever.
function fetchT(url, opts, ms = 20000) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  return fetch(url, { ...opts, signal: c.signal }).finally(() => clearTimeout(t))
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
    // /welcome preference only when the portal hasn't been toggled here before.
    const p = localStorage.getItem('kcPortalLang')
    if (p === 'he' || p === 'en') { setLang(p); return }
    if (localStorage.getItem('kcLang') === 'he') setLang('he')
  } catch { /* stay en */ } }, [])
  const L = P[lang]
  const isHe = lang === 'he'
  const dir = isHe ? 'rtl' : 'ltr'
  const flipLang = () => {
    const n = isHe ? 'en' : 'he'
    setLang(n)
    try {
      localStorage.setItem('kcPortalLang', n)
      localStorage.setItem('kcLang', n)
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
  const [pendingDoc, setPendingDoc] = useState(null) // staged file awaiting explicit send
  const [reqText, setReqText] = useState('')
  const [reqBusy, setReqBusy] = useState(false)
  const [reqMsg, setReqMsg] = useState('')
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

  // Exchange the stored refresh token for a fresh access token (server proxy —
  // the anon key never ships to the browser). On failure, fall back to the
  // signed-out card; the stale refresh token is cleared so we don't loop.
  const refreshSession = useCallback((rt) => {
    setLoading(true)
    fetch('/api/portal/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rt }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d && d.success && d.access_token) {
          sessionStorage.setItem('kc_portal_token', d.access_token)
          if (d.refresh_token) localStorage.setItem('kc_portal_refresh', d.refresh_token)
          return loadAccount(d.access_token)
        }
        localStorage.removeItem('kc_portal_refresh')
        setLoading(false)
      })
      .catch(() => { localStorage.removeItem('kc_portal_refresh'); setLoading(false) })
  }, [loadAccount])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    // Supabase's magic-link redirect delivers a refresh_token too — keeping it
    // means the session survives tab close and the ~1h access-token expiry,
    // instead of costing a freshly emailed link on every single visit.
    const ref = hash.get('refresh_token')
    if (ref) localStorage.setItem('kc_portal_refresh', ref)
    const tok = hash.get('access_token') || sessionStorage.getItem('kc_portal_token')
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname)
    if (tok) {
      sessionStorage.setItem('kc_portal_token', tok)
      loadAccount(tok)
      return
    }
    const stored = localStorage.getItem('kc_portal_refresh')
    if (stored) refreshSession(stored)
  }, [loadAccount, refreshSession])

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
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('kc_portal_token')
      localStorage.removeItem('kc_portal_refresh')
    }
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
  // Picking a file only STAGES it — nothing uploads until the customer
  // explicitly presses send (owner feedback 28 Jul: it sent without a confirm).
  function onPickFile(e) {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    setDocMsg(''); setPendingDoc(file)
  }
  function cancelUpload() {
    setPendingDoc(null); setDocMsg('')
    if (fileRef.current) fileRef.current.value = ''
  }
  async function confirmUpload() {
    const file = pendingDoc
    if (!file || docBusy) return
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
      else { setDocMsg(L.upSent); setPendingDoc(null); loadDocs() }
    } catch { setDocMsg(L.upFailed) }
    finally { setDocBusy(false); if (fileRef.current) fileRef.current.value = '' }
  }
  async function sendRequest() {
    const msg = reqText.trim()
    if (!msg || reqBusy) return
    setReqBusy(true); setReqMsg('')
    try {
      const r = await fetch('/api/portal/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ message: msg }),
      })
      const d = await r.json()
      if (d.success) { setReqMsg(L.reqSent); setReqText('') }
      else setReqMsg(d.error || L.reqFailed)
    } catch { setReqMsg(L.reqFailed) }
    finally { setReqBusy(false) }
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
      const r = await fetchT('/api/portal/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({}),
      })
      const d = await r.json()
      // A success without a client secret would otherwise hang the form forever.
      if (!d.success || !d.clientSecret) { setPayMsg(d.error || L.payStartFail); setPayBusy(false); return }
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
        // Stripe reports a bad key / mode mismatch via this event, not a throw —
        // without it the form fails as a silent empty box.
        el.on('loaderror', (ev) => { if (!cancelled) setPayMsg(ev?.error?.message || L.payFormFail) })
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
      const r = await fetchT('/api/portal/save-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({}),
      })
      const d = await r.json()
      if (!d.success || !d.clientSecret) { setSaveMsg(d.error || L.couldNotStart); setSaveBusy(false); return }
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
        el.on('loaderror', (ev) => { if (!cancelled) setSaveMsg(ev?.error?.message || L.couldNotLoadForm) })
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
    // Skeleton of the signed-in dashboard, so the page doesn't flash a
    // login-style card and then jump to a completely different layout.
    return (
      <>
        <Head><title>{L.title}</title></Head>
        <div className="pd-shell" dir={dir}>
          <header className="pd-top">
            <img className="pd-logo" src="/logo-full-tight.png" alt="Kosher Connect" />
          </header>
          <main className="pd-main" aria-busy="true" aria-label={L.loading}>
            <div className="pd-skel pd-skel-title" />
            <div className="pd-grid" aria-hidden="true">
              <div className="pd-card pd-span2 pd-hero">
                <div className="pd-skel" style={{ width: '30%' }} />
                <div className="pd-skel pd-skel-big" />
              </div>
              <div className="pd-card">
                <div className="pd-skel" style={{ width: '55%' }} />
                <div className="pd-skel" />
                <div className="pd-skel" style={{ width: '72%' }} />
              </div>
              <div className="pd-card">
                <div className="pd-skel" style={{ width: '48%' }} />
                <div className="pd-skel" style={{ width: '64%' }} />
              </div>
            </div>
          </main>
        </div>
      </>
    )
  }
  // Signed in but not matched to a customer record: never render the
  // convincing-but-fake £0.00 dashboard (a customer whose on-file email
  // differs would be silently told they owe nothing). Hand them to a human.
  if (account && !account.customer) {
    return (
      <>
        <Head><title>{L.title}</title></Head>
        <div className="login-shell">
          <div className="login-mesh" aria-hidden="true" />
          <AuthBackdrop />
          <ThemeToggle style={{ position: 'fixed', top: 16, right: 16, zIndex: 10 }} />
          {langBtn}
          <div className="login-card" dir={dir}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <img src="/logo-full-tight.png" alt="Kosher Connect" style={{ height: 44, marginBottom: 12 }} />
              <div className="login-title" style={{ fontSize: 22 }}>{L.noMatchTitle}</div>
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.55 }}>{L.noMatchBody}</div>
            <div style={{ marginTop: 14, textAlign: 'center' }}>
              <a href="tel:+441615311386" dir="ltr" style={{ fontWeight: 600 }}>{formatPhoneDisplay('01615311386')}</a>
            </div>
            <button className="btn btn-outline" onClick={signOut}
              style={{ width: '100%', marginTop: 16, padding: '10px 16px' }}>{L.tryAnother}</button>
            <a className="p-backlink" href="/welcome">{L.backToSite}</a>
          </div>
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
    const stLabel = (s) => L.statuses[s] || s
    const stClass = (s) => (s === 'active' || s === 'Ticketed' ? 'p-badge-ok' : s === 'overdue' ? 'p-badge-warn' : 'p-badge-muted')
    // "9 days left" on an active rental — the one number a traveller actually
    // wants from this row. Display-only; silently absent for odd dates.
    const daysLeft = (r) => {
      if (r.status !== 'active' || !r.toDate) return ''
      const d = new Date(r.toDate)
      if (isNaN(d)) return ''
      const n = Math.ceil((d.getTime() - Date.now()) / 86400000)
      return n < 0 ? '' : ` · ${L.daysLeft(n)}`
    }
    return (
      <>
        <Head><title>{L.title}</title></Head>
        <div className="pd-shell" dir={dir}>
          <header className="pd-top">
            <img className="pd-logo" src="/logo-full-tight.png" alt="Kosher Connect" />
            <div className="pd-top-actions">
              <button type="button" className="pd-chip" onClick={flipLang} lang={isHe ? 'en' : 'he'}
                title={isHe ? 'Switch to English' : 'לעבור לעברית'}>{isHe ? 'English' : 'עברית'}</button>
              <ThemeToggle />
              <button className="btn btn-outline" onClick={signOut}
                style={{ fontSize: 12.5, padding: '7px 14px', flexShrink: 0 }}>{L.signout}</button>
            </div>
          </header>

          <main className="pd-main">
            <div className="pd-greet">
              <h1>{greeting}{account.customer?.firstName ? `, ${account.customer.firstName}` : ''}</h1>
              <div className="pd-greet-sub">{L.account}</div>
            </div>

            <div className="pd-grid">
              <section className={`pd-card pd-span2 p-balance pd-hero ${owes ? 'owe' : 'credit'}`}>
                <div className="p-balance-label">{L.wallet}</div>
                <div className="p-balance-num pd-hero-num">
                  {owes ? L.youOwe(fmtGbp(Math.abs(account.balance))) : account.balance > 0 ? L.inCredit(fmtGbp(account.balance)) : fmtGbp(0)}
                </div>
                {paid && <div role="status" className="p-paid">{L.paidNote}</div>}
                {owes && !pay && (
                  <button className="btn btn-primary" onClick={startPay} disabled={payBusy}
                    style={{ marginTop: 14, padding: '10px 22px' }}>
                    {payBusy ? L.starting : L.payBtn(fmtGbp(Math.abs(account.balance)))}
                  </button>
                )}
                {/* 94% of money arrives by bank transfer — tell the payer which
                    reference to use so it can be matched without detective work.
                    The ref is a directional-isolated, unbreakable run: inside
                    Hebrew text it otherwise splits and reorders across lines. */}
                {owes && account.payRef && !pay && (
                  <div className="p-row-sub" style={{ marginTop: 10 }}>
                    {L.bankRef1}{' '}
                    <bdi dir="ltr" style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{account.payRef}</bdi>
                    {' '}{L.bankRef2}
                  </div>
                )}
                {payMsg && <div role="alert" className="p-payerr">{payMsg}</div>}
                {pay && (
                  <div style={{ marginTop: 12, maxWidth: 480 }}>
                    <div id="kc-pay-element" />
                    <button className="btn btn-primary" onClick={confirmPay} disabled={payBusy}
                      style={{ marginTop: 12, width: '100%', padding: '10px 16px' }}>
                      {payBusy ? L.processing : L.pay(fmtGbp(pay.amount))}
                    </button>
                    <button className="btn btn-outline" onClick={() => { setPay(null); stripeRef.current = null }}
                      style={{ marginTop: 8, width: '100%', padding: '8px 16px', fontSize: 13 }}>{L.cancel}</button>
                  </div>
                )}
              </section>

              {/* Mini statement — the customer's own last few wallet lines. */}
              <section className="pd-card">
                <div className="p-kicker"><TicketIcon /> {L.statement}</div>
                {(account.statement || []).length === 0
                  ? <div className="p-empty">{L.noStatement}</div>
                  : account.statement.map((e, i) => (
                    <div className="p-row" key={i}>
                      <div className="p-row-main">
                        {/* Ledger descriptions are English; in an RTL context an
                            unisolated run gets its word order shuffled. */}
                        <div className="p-row-title"><bdi>{e.description || (e.amount >= 0 ? L.received : '—')}</bdi></div>
                        <div className="p-row-sub">{fmtDate(e.at)}</div>
                      </div>
                      <span className={`p-amt ${e.amount >= 0 ? 'p-amt-pos' : ''}`} dir="ltr">
                        {e.amount >= 0 ? '+' : '−'}{fmtGbp(Math.abs(e.amount))}
                      </span>
                    </div>
                  ))}
              </section>

              {/* Payment method — save a card for future payments */}
              <section className="pd-card">
                <div className="p-kicker"><CardIcon /> {L.pmTitle}</div>
                {(account.cardOnFile || cardSaved) ? (
                  <div className="p-empty">{L.cardOnFile}</div>
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
                {saveMsg && <div role="status" className="p-msg">{saveMsg}</div>}
              </section>

              <section className="pd-card">
                <div className="p-kicker"><FlipPhoneIcon /> {L.rentals}</div>
                {activeRentals.length === 0
                  ? <div className="p-empty">{L.noRentals}</div>
                  : activeRentals.map((r, i) => (
                    <div className="p-row" key={i}>
                      <div className="p-row-main">
                        <div className="p-row-title"><bdi dir="ltr">{formatPhoneDisplay(r.phoneNumber) || L.phoneFallback}</bdi> · {r.country}</div>
                        <div className="p-row-sub"><bdi dir="ltr">{fmtDate(r.fromDate)} {isHe ? '←' : '→'} {fmtDate(r.toDate)}</bdi>{daysLeft(r)}</div>
                      </div>
                      <span className={`p-badge ${stClass(r.status)}`}>{stLabel(r.status)}</span>
                    </div>
                  ))}
              </section>

              {/* SIM plan — 88% of customers have one; without this card the
                  portal reads as empty/broken to the typical customer. */}
              <section className="pd-card">
                <div className="p-kicker"><SimIcon /> {L.simPlan}</div>
                {(account.sims || []).length === 0
                  ? <div className="p-empty">{L.noSims}</div>
                  : account.sims.map((s, i) => (
                    <div className="p-row" key={i}>
                      <div className="p-row-main">
                        <div className="p-row-title"><bdi dir="ltr">{s.provider || 'SIM'}{s.tier ? ` · ${s.tier}` : ''}</bdi></div>
                        {s.renewalDate ? <div className="p-row-sub">{L.renews(fmtDate(s.renewalDate))}</div> : null}
                      </div>
                      <span className={`p-badge ${stClass(s.status)}`}>{stLabel(s.status)}</span>
                    </div>
                  ))}
              </section>

              <section className="pd-card">
                <div className="p-kicker"><PlaneIcon /> {L.flights}</div>
                {upcoming.length === 0
                  ? <div className="p-empty">{L.noFlights}</div>
                  : upcoming.map((b, i) => (
                    <div className="p-row" key={i}>
                      <div className="p-row-main">
                        <div className="p-row-title"><bdi dir="ltr">{b.route || L.flightFallback}{b.airline ? ` · ${b.airline}` : ''}</bdi></div>
                        {b.travelDate ? <div className="p-row-sub">{fmtDate(b.travelDate)}</div> : null}
                      </div>
                      <span className={`p-badge ${stClass(b.status)}`}>{stLabel(b.status)}</span>
                    </div>
                  ))}
              </section>

              {/* Documents */}
              <section className="pd-card pd-span2">
                <div className="p-kicker"><DocIcon /> {L.docs}</div>
                {staffDocs.length === 0
                  ? <div className="p-empty">{L.noDocs}</div>
                  : staffDocs.map((d) => (
                    <div className="p-row" key={d.id}>
                      <div className="p-row-main"><div className="p-row-title">{d.filename}</div></div>
                      <button className="btn btn-outline" onClick={() => downloadDoc(d.id)} style={{ fontSize: 12, padding: '4px 10px', flexShrink: 0 }}>{L.download}</button>
                    </div>
                  ))}

                <div style={{ marginTop: 12 }}>
                  <input ref={fileRef} type="file"
                    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                    onChange={onPickFile} style={{ display: 'none' }} />
                  {!pendingDoc ? (
                    <button className="btn btn-outline" onClick={() => fileRef.current && fileRef.current.click()} disabled={docBusy}
                      style={{ fontSize: 13, padding: '8px 14px' }}>{L.upload}</button>
                  ) : (
                    <div className="pd-upconfirm">
                      <span className="p-row-title" style={{ flex: '1 1 auto', minWidth: 0 }}>
                        {pendingDoc.name}
                        <span className="p-row-sub" style={{ display: 'inline', marginInlineStart: 8 }}>
                          {Math.max(1, Math.round(pendingDoc.size / 1024))} KB
                        </span>
                      </span>
                      <button className="btn btn-primary" onClick={confirmUpload} disabled={docBusy}
                        style={{ fontSize: 13, padding: '8px 14px' }}>{docBusy ? L.uploading : L.docSend}</button>
                      <button className="btn btn-outline" onClick={cancelUpload} disabled={docBusy}
                        style={{ fontSize: 13, padding: '8px 14px' }}>{L.cancel}</button>
                    </div>
                  )}
                  {docMsg && <span role="status" className="p-msg" style={{ marginInlineStart: 10 }}>{docMsg}</span>}
                </div>

                {myUploads.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    {myUploads.map((d) => (
                      <div className="p-row" key={d.id}>
                        <div className="p-row-main">
                          <div className="p-row-sub">{d.filename}</div>
                          {d.status === 'rejected' && (
                            <div className="p-row-sub" style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
                              {d.note ? <bdi>{d.note}</bdi> : L.rejectedHint}
                            </div>
                          )}
                        </div>
                        <span className={`p-badge ${d.status === 'pending' ? 'p-badge-warn' : d.status === 'published' ? 'p-badge-ok' : 'p-badge-muted'}`}>
                          {d.status === 'pending' ? L.pendingReview : d.status === 'published' ? L.received : d.status === 'rejected' ? L.rejected : d.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="pd-card pd-span2">
                <div className="p-kicker"><ChatIcon /> {L.reqTitle}</div>
                <div className="p-empty" style={{ marginBottom: 8 }}>{L.reqHint}</div>
                <textarea className="form-input" rows={3} value={reqText} maxLength={500}
                  onChange={(e) => setReqText(e.target.value)} placeholder={L.reqPlaceholder}
                  style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 14 }} />
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" onClick={sendRequest} disabled={reqBusy || !reqText.trim()}
                    style={{ fontSize: 13, padding: '8px 16px' }}>{reqBusy ? L.reqSending : L.reqSend}</button>
                  {reqMsg && <span role="status" className="p-msg">{reqMsg}</span>}
                </div>
              </section>
            </div>

            <footer className="pd-foot">
              {L.qShort}{' '}
              <a href="tel:+441615311386" dir="ltr">{formatPhoneDisplay('01615311386')}</a>
              {' · '}
              <a href="mailto:support@kosher-connect.com" dir="ltr">support@kosher-connect.com</a>
            </footer>
          </main>
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
            <img src="/logo-full-tight.png" alt="Kosher Connect" style={{ height: 44, marginBottom: 12 }} />
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
              <div className="p-reassure">{L.reassure}</div>
              {/* 94% of customers have no email on file — never dead-end them. */}
              <div className="p-reassure" style={{ marginTop: 6 }}>
                {L.noEmailHelp} <a href="tel:+441615311386" dir="ltr" style={{ whiteSpace: 'nowrap' }}>0161 531 1386</a> {L.noEmailHelp2}
              </div>
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
          <a className="p-backlink" href="/welcome">{L.backToSite}</a>
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
