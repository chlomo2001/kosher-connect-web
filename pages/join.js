import { useEffect, useRef, useState } from 'react'
import Head from 'next/head'
import Script from 'next/script'
import ThemeToggle from '../components/ThemeToggle'
import AuthBackdrop from '../components/AuthBackdrop'

// Public "Join Kosher Connect" — the native replacement for the owner's Google
// signup form. Name + phone (+ optional email and a free-text ask) land as an
// open task in the staff queue via /api/public/join, deduped against existing
// customers server-side. EN + Hebrew, sharing the kcLang preference.

const PHONE_TEL = 'tel:+441615311386'
const PHONE_SHOWN = '0161 531 1386'

const T = {
  en: {
    dir: 'ltr',
    tag: 'Join us',
    back: '← Back to the shop',
    account: 'My account',
    strap: 'New here? Welcome',
    title: 'Join Kosher Connect',
    lead: 'Leave your details and what you’re after — a phone, a SIM, a trip, anything — and we’ll come back to you. No obligation, and you’ll get a straight answer.',
    firstName: 'First name', lastName: 'Last name (optional)',
    phone: 'Phone', email: 'Email (optional)',
    address: 'Address (optional)', addressPh: 'Start typing your address…',
    message: 'How can we help?',
    msgPlaceholder: 'e.g. a kosher phone for my son · a SIM that matches how I actually use it · a rental for a simcha in Israel',
    send: 'Send', sending: 'Sending…',
    required: 'Required',
    failed: 'That didn’t go through — please try again, or just call us.',
    doneTitle: 'We’ve got your details',
    doneBody: 'We’ll come back to you shortly.',
    doneCall: 'Prefer to talk? Call',
    doneVisit: 'or pop into the shop — 421 Bury New Road, Salford M7 4ED.',
  },
  he: {
    dir: 'rtl',
    tag: 'הצטרפות',
    back: 'חזרה לחנות ←',
    account: 'החשבון שלי',
    strap: 'חדשים אצלנו? ברוכים הבאים',
    title: 'מצטרפים לכשר קונקט',
    lead: 'השאירו פרטים וספרו מה אתם מחפשים — טלפון, סים, נסיעה, כל דבר — ונחזור אליכם. בלי שום התחייבות, ועם תשובה ישרה.',
    firstName: 'שם פרטי', lastName: 'שם משפחה (לא חובה)',
    phone: 'טלפון', email: 'אימייל (לא חובה)',
    address: 'כתובת (לא חובה)', addressPh: 'התחילו להקליד את הכתובת…',
    message: 'איך נוכל לעזור?',
    msgPlaceholder: 'למשל: טלפון כשר לבחור · סים שמתאים לשימוש האמיתי · השכרה לשמחה בארץ ישראל',
    send: 'שליחה', sending: 'שולחים…',
    required: 'שדה חובה',
    failed: 'זה לא עבר — נסו שוב, או פשוט התקשרו אלינו.',
    doneTitle: 'הפרטים הגיעו אלינו',
    doneBody: 'נחזור אליכם בקרוב.',
    doneCall: 'מעדיפים לדבר? התקשרו',
    doneVisit: 'או קפצו לחנות — 421 Bury New Road, Salford M7 4ED.',
  },
}

export default function Join() {
  const [lang, setLang] = useState('en')
  useEffect(() => { try {
    if (localStorage.getItem('kcLang') === 'he') setLang('he')
  } catch { /* stay en */ } }, [])
  const t = T[lang]
  const isHe = lang === 'he'
  const flip = () => {
    const n = isHe ? 'en' : 'he'
    setLang(n)
    try { localStorage.setItem('kcLang', n) } catch { /* not persisted */ }
  }

  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', email: '', address: '', message: '', company: '' })
  const [busy, setBusy] = useState(false)
  const [errs, setErrs] = useState({})
  const [failMsg, setFailMsg] = useState('')
  const [done, setDone] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  // Google address autocomplete on the Address field. Attaches once the helper
  // script has loaded (and again on mount, in case it was already cached from a
  // prior page). No-op if the key/helper isn't there — the field stays plain.
  const addrRef = useRef(null)
  const attachAddr = () => {
    if (window.kcAddressAutocomplete && addrRef.current) {
      window.kcAddressAutocomplete(addrRef.current, {
        onSelect: (r) => setForm((f) => ({ ...f, address: r.formatted })),
      })
    }
  }
  useEffect(() => { attachAddr() }, [])

  async function submit(e) {
    e.preventDefault()
    const missing = {}
    if (!form.firstName.trim()) missing.firstName = true
    if (!form.phone.trim()) missing.phone = true
    setErrs(missing)
    if (Object.keys(missing).length) return
    setBusy(true); setFailMsg('')
    try {
      const r = await fetch('/api/public/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await r.json().catch(() => ({}))
      if (d.success) setDone(true)
      else setFailMsg(d.error || t.failed)
    } catch { setFailMsg(t.failed) }
    finally { setBusy(false) }
  }

  const field = (k, label, type = 'text', props = {}) => (
    <div className="form-group">
      <label className="form-label" htmlFor={`jn-${k}`}>{label}</label>
      <input className="form-input" id={`jn-${k}`} type={type} value={form[k]}
        onChange={set(k)} autoComplete="off" {...props} />
      {errs[k] && <span className="form-error" style={{ display: 'block' }}>{t.required}</span>}
    </div>
  )

  return (
    <>
      <Head>
        <title>Join — Kosher Connect</title>
        <meta name="description" content="New to Kosher Connect? Leave your details and what you're looking for — phones, SIMs, travel, repairs — and we'll come back to you." />
      </Head>
      <div className="welcome-shell">
        <AuthBackdrop />
        <ThemeToggle style={{ position: 'fixed', top: 16, right: 16, zIndex: 10 }} />
        <div className="w-wrap" dir={t.dir} lang={lang}>
          <div className="w-topbar">
            <div className="w-brand">
              <img src="/logo-full-tight.png" alt="Kosher Connect" />
              <div>
                <h1>Kosher Connect</h1>
                <p>{t.tag}</p>
              </div>
            </div>
            <nav className="w-pills" aria-label="Site">
              <div className="w-lang" role="group" aria-label="Language">
                {['en', 'he'].map((l) => (
                  <button key={l} type="button" lang={l}
                    className={lang === l ? 'active' : ''} aria-pressed={lang === l}
                    onClick={() => (lang === l ? null : flip())}>{l === 'en' ? 'EN' : 'HE'}</button>
                ))}
              </div>
              <a href="/welcome" className="w-anchor">{t.back}</a>
              <a href="/portal" className="w-pill-primary">{t.account}</a>
            </nav>
          </div>

          <section className="w-section" id="top">
            <div className="w-strap">{t.strap}</div>
            <h3 className="w-show">{t.title}</h3>
            <p className="w-lead">{t.lead}</p>
          </section>

          <section className="w-section jn-wrap" aria-label={t.title}>
            {done ? (
              <div className="w-card jn-card jn-done" role="status">
                <h4>✓ {t.doneTitle}</h4>
                <p>{t.doneBody}</p>
                <p>{t.doneCall} <a href={PHONE_TEL} dir="ltr">{PHONE_SHOWN}</a> {t.doneVisit}</p>
              </div>
            ) : (
              <form className="w-card jn-card" onSubmit={submit} noValidate>
                <div className="form-grid">
                  {field('firstName', t.firstName)}
                  {field('lastName', t.lastName)}
                  {field('phone', t.phone, 'tel', { dir: 'ltr', inputMode: 'tel' })}
                  {field('email', t.email, 'email', { dir: 'ltr', inputMode: 'email' })}
                  <div className="form-group form-full">
                    <label className="form-label" htmlFor="jn-address">{t.address}</label>
                    <input className="form-input" id="jn-address" ref={addrRef} type="text"
                      value={form.address} onChange={set('address')} autoComplete="off"
                      placeholder={t.addressPh} />
                  </div>
                  <div className="form-group form-full">
                    <label className="form-label" htmlFor="jn-message">{t.message}</label>
                    <textarea className="form-input" id="jn-message" rows={3} value={form.message}
                      onChange={set('message')} placeholder={t.msgPlaceholder}
                      style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
                  </div>
                  {/* Honeypot — hidden from real visitors; bots that fill it are dropped. */}
                  <div className="jn-hp" aria-hidden="true">
                    <label htmlFor="jn-company">Company</label>
                    <input id="jn-company" type="text" tabIndex={-1} autoComplete="off"
                      value={form.company} onChange={set('company')} />
                  </div>
                </div>
                {failMsg && <p className="jn-fail" role="alert">{failMsg}</p>}
                <div className="jn-actions">
                  <button className="btn btn-primary" type="submit" disabled={busy}>
                    {busy ? t.sending : t.send}
                  </button>
                </div>
              </form>
            )}
          </section>

          <footer className="w-footer2">
            <div className="w-footer-bottom">
              <div>© {new Date().getFullYear()} Kosher Connect. All rights reserved.<span className="w-legal"> Kosher Connect is a trading name of Hatsluche Ltd.</span></div>
            </div>
          </footer>
        </div>
      </div>
      {/* Google Maps key (referrer-restricted → safe in the browser) + the
          shared autocomplete helper. attachAddr runs on the script's onLoad. */}
      <Script id="kc-maps-key" strategy="beforeInteractive">
        {`window.KC_MAPS_KEY=${JSON.stringify(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '')};`}
      </Script>
      <Script src="/address-autocomplete.js" strategy="afterInteractive" onLoad={attachAddr} />
    </>
  )
}
