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
    ddOnFile: '✓ Direct Debit is set up — monthly charges collect from your bank account automatically.',
    ddStart: 'Set up Direct Debit (bank account)',
    ddNote: 'For monthly plans: pays from your bank account, keeps working when a card is replaced, protected by the Direct Debit Guarantee.',
    couldNotSaveDd: 'Could not set up the Direct Debit.',
    rentals: 'Rentals', noRentals: 'No active rentals.',
    flights: 'Flights', noFlights: 'No upcoming flights.',
    simPlan: (n) => (n === 1 ? 'My SIM plan' : 'My SIM plans'), noSims: 'No SIM plan with us yet.',
    simLogin: 'Sign-in email', simLoginOurs: 'ours, set up for this line — use it to sign in at the carrier; don\u2019t email it',
    simLoginNone: 'Sign-in email not on record — call us and we\u2019ll sort it.',
    simOtp: 'Sign-in code', simOtpAt: (t) => `received ${t}`,
    downloadFailed: 'Couldn’t open that file — try again, or call us and we’ll send it over.',
    renews: (d) => `Renews ${d}`,
    renewIn: (n) => (n === 1 ? 'tomorrow' : `in ${n} days`),
    renewToday: 'today',
    renewOverdueLead: 'renewal due —', renewOverdueCall: 'call us',
    bookingRef: 'Ref',
    bankRef1: 'Paying by bank transfer? Please use the reference', bankRef2: 'so we can match your payment.',
    noMatchTitle: 'We couldn’t match this email to an account',
    noMatchBody: 'You’re signed in, but this email address isn’t linked to a Kosher Connect account yet. If you’re a customer, we may have a different email (or none) on file — call us and we’ll link it up in a minute.',
    tryAnother: 'Try a different email',
    statement: 'Recent activity', noStatement: 'No activity yet.',
    // Keyed on ledger.entry_type — the machine-written descriptions are
    // English, so Hebrew titles its rows from these instead.
    entryTypes: {
      payment: 'Payment received', charge: 'Charge', refund: 'Refund',
      refund_payout: 'Refund paid out', manual_adjustment: 'Adjustment',
      topup: 'Top-up', rental: 'Rental', sim_charge: 'SIM plan',
      booking: 'Flight booking', repair: 'Repair', service: 'Service',
    },
    balAfterOwed: (v) => <>owed {v} after this</>,
    balAfterCredit: (v) => <>{v} in credit after this</>,
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
    statuses: { active: 'Active', out: 'Active', booked: 'Booked', overdue: 'Overdue', returned: 'Returned', renewal_pending: 'Renewal due', cancelled: 'Cancelled', suspended: 'Suspended', Booked: 'Booked', Ticketed: 'Ticket issued', Confirmed: 'Confirmed', Cancelled: 'Cancelled', Completed: 'Completed' },
    daysLeft: (n) => (n === 0 ? 'returns today' : n === 1 ? 'returns tomorrow' : `${n} days left`),
    subSignedOut: (g) => `${g}! See your rentals, bookings and balance`,
    yourEmail: 'Your email', emailLink: 'Email me a sign-in link', sending: 'Sending…',
    noEmailHelp: 'No email address? Call us on', noEmailHelp2: 'and we’ll sort your account in the shop.',
    sent: '📬 If that email belongs to a Kosher Connect customer, a sign-in link is on its way. You can close this page.',
    linkExpired: 'That sign-in link has expired — enter your email and we’ll send a fresh one.',
    sendFailed: 'That didn’t send — try again in a minute, or call us on',
    offline: 'We couldn’t reach us just now — check your connection and try again, or call us on',
    netErrTitle: 'We couldn’t load your account',
    netErrBody: 'That looks like a connection problem, not a sign-in problem — you’re still signed in.',
    tryAgain: 'Try again',
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
    ddOnFile: '✓ הוראת קבע פעילה — חיובים חודשיים נגבים מחשבון הבנק אוטומטית.',
    ddStart: 'להקים הוראת קבע (חשבון בנק)',
    ddNote: 'לחבילות חודשיות: התשלום יורד מחשבון הבנק, ממשיך לעבוד גם כשמחליפים כרטיס, ומוגן במסגרת ה־Direct Debit Guarantee.',
    couldNotSaveDd: 'הוראת הקבע לא הוקמה. נסו שוב.',
    rentals: 'השכרות', noRentals: 'אין כרגע השכרות פעילות.',
    flights: 'טיסות', noFlights: 'אין טיסות קרובות ביומן.',
    simPlan: (n) => (n === 1 ? 'חבילת הסים שלי' : 'חבילות הסים שלי'), noSims: 'עוד אין חבילת סים אצלנו.',
    simLogin: 'מייל כניסה', simLoginOurs: 'שלנו, הוקם עבור הקו הזה — להתחברות אצל הספק; לא לשליחת מיילים',
    simLoginNone: 'אין מייל כניסה רשום — התקשרו אלינו ונסדר.',
    simOtp: 'קוד כניסה', simOtpAt: (t) => `התקבל ${t}`,
    downloadFailed: 'לא הצלחנו לפתוח את הקובץ — נסו שוב, או התקשרו אלינו ונשלח לכם אותו.',
    renews: (d) => `מתחדשת ב־${d}`,
    renewIn: (n) => (n === 1 ? 'מחר' : `בעוד ${n} ימים`),
    renewToday: 'היום',
    renewOverdueLead: 'החידוש הגיע —', renewOverdueCall: 'התקשרו אלינו',
    bookingRef: 'אסמכתא',
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
    statuses: { active: 'פעילה', out: 'פעילה', booked: 'שמורה', overdue: 'באיחור', returned: 'הוחזרה', renewal_pending: 'לחידוש', cancelled: 'בוטלה', suspended: 'מושהית', Booked: 'הוזמנה', Ticketed: 'כורטסה', Confirmed: 'מאושרת', Cancelled: 'בוטלה', Completed: 'הושלמה' },
    daysLeft: (n) => (n === 0 ? 'חוזר היום' : n === 1 ? 'חוזר מחר' : `נותרו ${n} ימים`),
    subSignedOut: (g) => `${g}! כל ההשכרות, ההזמנות והיתרה שלכם — במקום אחד`,
    yourEmail: 'כתובת המייל שלכם', emailLink: 'שלחו לי קישור כניסה', sending: 'שולחים…',
    noEmailHelp: 'אין לכם כתובת מייל? התקשרו אלינו:', noEmailHelp2: 'ונסדר לכם גישה בחנות.',
    entryTypes: {
      payment: 'תשלום שהתקבל', charge: 'חיוב', refund: 'זיכוי',
      refund_payout: 'החזר ששולם', manual_adjustment: 'התאמה',
      topup: 'טעינה', rental: 'השכרה', sim_charge: 'חבילת SIM',
      booking: 'הזמנת טיסה', repair: 'תיקון', service: 'שירות',
    },
    balAfterOwed: (v) => <>נותרה יתרת חוב {v} אחרי הפעולה</>,
    balAfterCredit: (v) => <>נותרה יתרת זכות {v} אחרי הפעולה</>,
    sent: '📬 אם הכתובת שייכת ללקוח של כשר קונקט — קישור הכניסה כבר בדרך אליכם. אפשר לסגור את העמוד.',
    linkExpired: 'תוקף קישור הכניסה פג — הזינו את כתובת המייל ונשלח לכם קישור חדש.',
    sendFailed: 'השליחה לא הצליחה — נסו שוב בעוד דקה, או התקשרו אלינו:',
    offline: 'לא הצלחנו להתחבר כרגע — בדקו את החיבור ונסו שוב, או התקשרו אלינו:',
    netErrTitle: 'לא הצלחנו לטעון את החשבון שלכם',
    netErrBody: 'נראה שזו בעיית חיבור ולא בעיית התחברות — אתם עדיין מחוברים.',
    tryAgain: 'לנסות שוב',
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
  const [netErr, setNetErr] = useState(false)   // couldn't reach us — session kept
  const [linkErr, setLinkErr] = useState('')    // expired / already-used sign-in link

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
  // Set up a Direct Debit mandate (hosted Stripe Checkout — no charge now)
  const [ddBusy, setDdBusy] = useState(false)
  const [ddMsg, setDdMsg] = useState('')
  const [ddSaved, setDdSaved] = useState(false)

  const token = () => (typeof window !== 'undefined' ? sessionStorage.getItem('kc_portal_token') : null)

  // Holds refreshSession, which is defined below and itself depends on
  // loadAccount — a ref breaks what would otherwise be a useCallback cycle.
  const refreshRef = useRef(null)

  const loadAccount = useCallback((tok) => {
    setLoading(true)
    setNetErr(false)
    return fetch('/api/portal/me', { headers: { Authorization: `Bearer ${tok}` } })
      .then((r) => r.json())
      .then((d) => {
        if (d && d.success) { setAccount(d); return }
        // The server actively said no, so this access token really is dead.
        // Spend the refresh token before falling back to the signed-out card:
        // a same-tab reload after the ~1h expiry used to wipe the session
        // without ever attempting a refresh.
        const rt = typeof window !== 'undefined' ? localStorage.getItem('kc_portal_refresh') : null
        if (rt && refreshRef.current) {
          sessionStorage.removeItem('kc_portal_token')
          refreshRef.current(rt)
          return
        }
        signOut()
      })
      .catch(() => {
        // A dropped connection is NOT an invalid token. Signing out here threw
        // away the refresh token — the only session persistence — and cost an
        // emailed link round trip, which is expensive on a filtered phone.
        setNetErr(true)
      })
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

  // Give loadAccount a live handle on refreshSession without a dependency cycle.
  useEffect(() => { refreshRef.current = refreshSession }, [refreshSession])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    // Supabase's magic-link redirect delivers a refresh_token too — keeping it
    // means the session survives tab close and the ~1h access-token expiry,
    // instead of costing a freshly emailed link on every single visit.
    const ref = hash.get('refresh_token')
    if (ref) localStorage.setItem('kc_portal_refresh', ref)
    // Supabase returns a dead link as #error=access_denied&error_code=otp_expired.
    // Read it BEFORE the hash is wiped below — otherwise an expired link just
    // bounces the customer back to a bare login form with no explanation, and
    // they have no idea whether to wait, retry, or ring us.
    const errCode = hash.get('error_code') || hash.get('error')
    if (errCode) setLinkErr(errCode)
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
    setDdSaved(false)
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
    // Tapping Download and having nothing at all happen is the worst of both
    // worlds — the customer can't tell whether it failed or their browser
    // blocked it. Say so in the message line the panel already renders.
    setDocMsg('')
    try {
      const r = await fetch(`/api/portal/documents/download?id=${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token()}` },
      })
      const d = await r.json()
      if (d.success && d.url) window.open(d.url, '_blank', 'noopener')
      else setDocMsg(d.error || L.downloadFailed)
    } catch { setDocMsg(L.downloadFailed) }
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

  // ── Set up a Direct Debit mandate (Bacs — bank account, not a card) ───────
  // Hosted Stripe Checkout, not an embedded form: Stripe refuses direct Bacs
  // SetupIntents on standard accounts, and the hosted page carries the
  // Direct Debit Guarantee wording. We redirect out; ?dd=done marks the trip
  // back, and the webhook records the mandate.
  async function startDd() {
    setDdMsg(''); setDdBusy(true)
    try {
      const r = await fetchT('/api/portal/setup-dd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({}),
      })
      const d = await r.json()
      if (!d.success || !d.url) { setDdMsg(d.error || L.couldNotStart); setDdBusy(false); return }
      window.location.href = d.url
    } catch { setDdMsg(L.couldNotStart); setDdBusy(false) }
  }
  // Back from the hosted page: say so, and drop the marker from the URL so a
  // reload doesn't repeat the message.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const dd = q.get('dd')
    if (!dd) return
    if (dd === 'done') setDdSaved(true)
    q.delete('dd')
    const rest = q.toString()
    try { window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : '')) } catch { /* cosmetic only */ }
  }, [])

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
    setLinkErr('')
    // Only a 2xx may claim "the link is on its way". A 429, a 503 or a dropped
    // connection used to render the same success card AND replace the form, so
    // there was no retry — the customer waited for an email that never came.
    // 200 responses stay byte-identical, so email-enumeration safety is
    // unchanged. (A failed send behind a 200 is a separate, deliberate case.)
    let ok = false
    try {
      const r = await fetch('/api/portal/request-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      ok = r.ok
      if (!ok) {
        const d = await r.json().catch(() => null)
        setLinkErr(d && d.error ? 'server' : 'server')
      }
    } catch { setLinkErr('offline') }
    if (ok) setSent(true)
    setBusy(false)
  }

  // ── Signed-in read-only account view ──────────────────────────────────────
  if (loading) {
    // Skeleton of the signed-in dashboard, so the page doesn't flash a
    // login-style card and then jump to a completely different layout.
    return (
      <>
        <Head><title>{L.title}</title><meta name="robots" content="noindex, nofollow" /></Head>
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
        <Head><title>{L.title}</title><meta name="robots" content="noindex, nofollow" /></Head>
        <div className="login-shell">
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
    const stClass = (s) => (s === 'active' || s === 'out' || s === 'Ticketed' ? 'p-badge-ok' : s === 'overdue' || s === 'renewal_pending' ? 'p-badge-warn' : 'p-badge-muted')
    // "9 days left" on an active rental — the one number a traveller actually
    // wants from this row. Display-only; silently absent for odd dates.
    const daysLeft = (r) => {
      // 'out' is the legacy sheet's word for active — imported rentals carry it.
      if ((r.status !== 'active' && r.status !== 'out') || !r.toDate) return ''
      const d = new Date(r.toDate)
      if (isNaN(d)) return ''
      const n = Math.ceil((d.getTime() - Date.now()) / 86400000)
      return n < 0 ? '' : ` · ${L.daysLeft(n)}`
    }
    // How close a SIM's renewal is — the answer to "do I need to do anything?".
    // Display-only, from the one date the record holds; no usage feed exists, so
    // this deliberately does not pretend to know data-left.
    const simRenewal = (s) => {
      if (!s.renewalDate) return null
      const d = new Date(s.renewalDate)
      if (isNaN(d)) return null
      const n = Math.ceil((d.getTime() - Date.now()) / 86400000)
      const cls = n < 0 ? 'p-renew-over' : n <= 14 ? 'p-renew-soon' : ''
      // Overdue is the one state that asks the customer to DO something, so
      // it carries the call. Returns a node rather than a string — the caller
      // renders it directly, and the anchor needs its own colour so it isn't
      // swallowed by the red .p-renew-over rule.
      const rel = n < 0
        ? <>{L.renewOverdueLead} <a className="p-renew-call" href="tel:+441615311386" dir="ltr">{L.renewOverdueCall}</a></>
        : n === 0 ? L.renewToday : L.renewIn(n)
      return { text: <>{L.renews(fmtDate(s.renewalDate))} · {rel}</>, cls }
    }
    return (
      <>
        <Head><title>{L.title}</title><meta name="robots" content="noindex, nofollow" /></Head>
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
                        {/* Ledger descriptions are machine-generated English; in
                            an RTL context an unisolated run gets its word order
                            shuffled, and untranslated it just reads as English
                            in a Hebrew page. Hebrew prefers the translated entry
                            type and falls back to the raw description. */}
                        <div className="p-row-title"><bdi>
                          {(isHe ? (L.entryTypes[e.type] || e.description) : (e.description || L.entryTypes[e.type]))
                            || (e.amount >= 0 ? L.received : '—')}
                        </bdi></div>
                        <div className="p-row-sub">
                          {fmtDate(e.at)}
                          {/* The hero sums the whole ledger, so without a running
                              figure per line an older debt can't be reconciled
                              against anything on screen. */}
                          {typeof e.balanceAfter === 'number' && (
                            <> · {e.balanceAfter < 0
                              ? L.balAfterOwed(<bdi key="b" dir="ltr">{fmtGbp(Math.abs(e.balanceAfter))}</bdi>)
                              : L.balAfterCredit(<bdi key="b" dir="ltr">{fmtGbp(e.balanceAfter)}</bdi>)}</>
                          )}
                        </div>
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

                {/* Direct Debit mandate (DD phase 1) — sits under the card
                    option; a customer can hold either or both. */}
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--p-line, rgba(128,128,128,.25))' }}>
                  {(account.ddOnFile || ddSaved) ? (
                    <div className="p-empty">{L.ddOnFile}</div>
                  ) : (
                    <div>
                      <button className="btn btn-outline" onClick={startDd} disabled={ddBusy}
                        style={{ fontSize: 13, padding: '8px 14px' }}>{ddBusy ? L.starting : L.ddStart}</button>
                      <div className="p-msg" style={{ marginTop: 6 }}>{L.ddNote}</div>
                    </div>
                  )}
                  {ddMsg && <div role="status" className="p-msg">{ddMsg}</div>}
                </div>
              </section>

              <section className="pd-card">
                <div className="p-kicker"><FlipPhoneIcon /> {L.rentals}</div>
                {activeRentals.length === 0
                  ? <div className="p-empty">{L.noRentals}</div>
                  : activeRentals.map((r, i) => (
                    <div className="p-row" key={i}>
                      <div className="p-row-main">
                        <div className="p-row-title"><bdi dir="ltr">{formatPhoneDisplay(r.phoneNumber) || L.phoneFallback}</bdi> · {r.country}</div>
                        {/* The arrow lives INSIDE a forced-LTR bdi, so the run
                            already reads left-to-right in both languages —
                            flipping it for Hebrew pointed the date range
                            backwards (to-date first). Same glyph both ways. */}
                        <div className="p-row-sub"><bdi dir="ltr">{fmtDate(r.fromDate)} → {fmtDate(r.toDate)}</bdi>{daysLeft(r)}</div>
                      </div>
                      <span className={`p-badge ${stClass(r.status)}`}>{stLabel(r.status)}</span>
                    </div>
                  ))}
              </section>

              {/* SIM plan — 88% of customers have one; without this card the
                  portal reads as empty/broken to the typical customer. */}
              <section className="pd-card">
                <div className="p-kicker"><SimIcon /> {L.simPlan((account.sims || []).length)}</div>
                {(account.sims || []).length === 0
                  ? <div className="p-empty">{L.noSims}</div>
                  : account.sims.map((s, i) => (
                    <div className="p-row" key={i}>
                      <div className="p-row-main">
                        <div className="p-row-title"><bdi dir="ltr">{s.provider || 'SIM'}{s.tier ? ` · ${s.tier}` : ''}</bdi></div>
                        {(() => { const r = simRenewal(s); return r
                          ? <div className={`p-row-sub ${r.cls}`}>{r.text}</div> : null })()}
                        {/* #15 part 1 — the carrier login, per PLAN. The API
                            sends it only when the address is tagged; a blank
                            here means the login is honestly not on record,
                            and says so rather than showing a pool address. */}
                        <div className="p-row-sub">
                          {s.login
                            ? <>{L.simLogin}: <bdi dir="ltr" style={{ fontWeight: 600 }}>{s.login}</bdi>
                                {' '}<span style={{ opacity: 0.75 }}>({L.simLoginOurs})</span></>
                            : L.simLoginNone}
                        </div>
                        {/* #15 part 3 — the freshest sign-in code, so a
                            customer with no email on file can still read it.
                            The API only sends codes younger than 15 minutes. */}
                        {s.otp && (
                          <div className="p-row-sub" style={{ fontWeight: 700 }}>
                            {L.simOtp}: <bdi dir="ltr" style={{ fontSize: '1.15em', letterSpacing: '0.06em' }}>{s.otp.code || s.otp.text}</bdi>
                            {' '}<span style={{ fontWeight: 400, opacity: 0.75 }}>{L.simOtpAt(new Date(s.otp.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))}</span>
                          </div>
                        )}
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
                        <div className="p-row-sub">
                          {b.travelDate ? fmtDate(b.travelDate) : null}
                          {b.travelDate && b.bookingReference ? ' · ' : null}
                          {b.bookingReference
                            ? <>{L.bookingRef} <bdi dir="ltr" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{b.bookingReference}</bdi></>
                            : null}
                        </div>
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

  // Signed in, but we couldn't reach the server. The tokens are intact, so
  // offer a retry instead of the login form — dropping them here is what used
  // to cost an emailed link for what was only a dropped connection.
  if (netErr) {
    const retry = () => {
      const tok = token()
      const rt = typeof window !== 'undefined' ? localStorage.getItem('kc_portal_refresh') : null
      if (tok) loadAccount(tok)
      else if (rt) refreshSession(rt)
      else setNetErr(false)
    }
    return (
      <>
        <Head><title>{L.title}</title><meta name="robots" content="noindex, nofollow" /></Head>
        <div className="login-shell" dir={dir}>
          <ThemeToggle style={{ position: 'fixed', top: 16, right: 16, zIndex: 10 }} />
          <div className="login-card" role="alert">
            <div style={{ textAlign: 'center' }}>
              <img src="/logo-full-tight.png" alt="Kosher Connect" style={{ height: 44, marginBottom: 12 }} />
              <div className="login-title">{L.netErrTitle}</div>
              <div className="login-sub">{L.netErrBody}</div>
            </div>
            <button className="btn btn-primary" onClick={retry} style={{ width: '100%', padding: '10px 16px', marginTop: 16 }}>
              {L.tryAgain}
            </button>
            <div className="p-reassure" style={{ marginTop: 10 }}>
              {L.noEmailHelp} <a href="tel:+441615311386" dir="ltr" style={{ whiteSpace: 'nowrap' }}>0161 531 1386</a>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Head><title>{L.title}</title><meta name="robots" content="noindex, nofollow" /></Head>
      <div className="login-shell">
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
              {/* An expired link, or a send that genuinely failed, is explained
                  here instead of silently dropping the customer on a bare form. */}
              {linkErr && (
                <div className="p-linkerr" role="alert">
                  {linkErr === 'offline' ? <>{L.offline} <a href="tel:+441615311386" dir="ltr" style={{ whiteSpace: 'nowrap' }}>0161 531 1386</a></>
                    : linkErr === 'server' ? <>{L.sendFailed} <a href="tel:+441615311386" dir="ltr" style={{ whiteSpace: 'nowrap' }}>0161 531 1386</a></>
                    : L.linkExpired}
                </div>
              )}
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
