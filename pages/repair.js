import { legalIdentifier } from '../lib/company.mjs'
import { useEffect, useState } from 'react'
import Head from 'next/head'
import ThemeToggle from '../components/ThemeToggle'
import SkipLink from '../components/SkipLink'
import { WrenchIcon } from '../components/kcIcons'

// Public repair booking — the online front door for the repair bench. One
// short form (who you are, which device, what's wrong), lands as a task in
// the staff queue via /api/public/repair; staff open a real Repairs job when
// the device arrives. Deliberately two questions lighter than the SaaS
// widgets it competes with: no address, no appointment grid — this is a
// walk-in shop and the form's job is a heads-up, not a contract.
// EN + Hebrew sharing the kcLang preference, same chrome as /phone-guide.

const PHONE_TEL = 'tel:+441615311386'
const PHONE_SHOWN = '0161 531 1386'

const T = {
  en: {
    skip: 'Skip to content',
    dir: 'ltr',
    tag: 'Repairs',
    back: '← Back to the main page', account: 'My account',
    homeAria: 'Kosher Connect — back to the main page',
    strap: 'Screens · mic · charging · housing · buttons',
    h3: 'Book a repair',
    lead: 'Tell us what’s broken and how to reach you — we’ll come back with an honest price, and if it isn’t worth fixing, we’ll say so. Most jobs are done quickly.',
    fName: 'Your name', fContact: 'Phone number or email', fDevice: 'Which phone or device? (e.g. Nokia 105, Fig Core)',
    fIssue: 'What’s wrong with it?',
    send: 'Send it in',
    sending: 'Sending…',
    okTitle: 'Got it — we’ll be in touch.',
    okWhen: 'We reply during opening hours, usually the same day.',
    hoursLabel: 'Open:',
    okBody: 'Bring the device in to 421 Bury New Road, Salford M7 4ED. Left of Toy Zone, MMR Group building — ring bell 5.',
    okCall: 'In a hurry? Call',
    errFallback: 'That didn’t send — please call us on',
    errCodes: {
      rate: 'That’s a few in a row — give it a minute, or call us on',
      name: 'Please enter your name, then try again — or call us on',
      contact: 'Please check the phone number or email, then try again — or call us on',
      device: 'Please tell us which device and what’s wrong, then try again — or call us on',
      offline: 'We can’t take repairs through the form this minute — please call us on',
      server: 'That didn’t send — please call us on',
    },
    urgent: 'Urgent? Skip the form —',
    urgentCall: 'call',
    brandName: 'Kosher Connect', rights: 'All rights reserved.',
    tradingName: 'Kosher Connect is a trading name of',
  },
  he: {
    skip: 'דילוג לתוכן',
    dir: 'rtl',
    tag: 'מעבדת תיקונים',
    homeAria: 'כשר קונקט — חזרה לעמוד הבית',
    back: '→ חזרה לעמוד הבית', account: 'האזור האישי',
    strap: 'מסכים · מיקרופונים · שקעי טעינה · מארזים · כפתורים',
    h3: 'הזמנת תיקון',
    lead: 'ספרו לנו מה התקלקל ואיך להשיג אתכם — נחזור אליכם עם מחיר הוגן, ואם לא שווה לתקן נגיד ביושר. את רוב התיקונים מסיימים מהר.',
    fName: 'שם מלא', fContact: 'טלפון או דוא״ל', fDevice: 'איזה מכשיר ברשותכם? (למשל Nokia 105, Fig Core)',
    fIssue: 'תיאור התקלה',
    send: 'שלח פנייה',
    sending: 'שולח פנייה...',
    okTitle: 'קיבלנו — נהיה בקשר.',
    okWhen: 'אנו עונים בשעות הפעילות, בדרך כלל עוד באותו היום.',
    hoursLabel: 'שעות פעילות:',
    okBody: 'הביאו את המכשיר אלינו לכתובת: 421 Bury New Road, Salford M7 4ED. משמאל ל-Toy Zone, בבניין MMR Group — צלצלו בפעמון 5.',
    okCall: 'ממהרים? התקשרו:',
    errFallback: 'הפנייה לא נשלחה — אנא התקשרו אלינו:',
    errCodes: {
      rate: 'שלחתם מספר פניות ברצף — המתינו דקה ונסו שוב, או התקשרו אלינו:',
      name: 'אנא הזינו את שמכם ונסו שוב — או התקשרו:',
      contact: 'אנא בדקו את מספר הטלפון או הדוא״ל ונסו שוב — או התקשרו:',
      device: 'אנא ציינו איזה מכשיר ברשותכם ומה התקלה, ונסו שוב — או התקשרו:',
      offline: 'לא ניתן לקבל פניות דרך הטופס כרגע — אנא התקשרו:',
      server: 'הפנייה לא נשלחה — אנא התקשרו:',
    },
    urgent: 'מקרה דחוף? דלגו על הטופס —',
    urgentCall: 'חייגו עכשיו',
    brandName: 'כשר קונקט', rights: 'כל הזכויות שמורות.',
    tradingName: 'כשר קונקט הוא שם מסחרי של',
  },
}

const EMPTY = { name: '', contact: '', device: '', issue: '', company: '' }

export default function RepairBooking() {
  const [lang, setLang] = useState('en')
  useEffect(() => { try {
    if (localStorage.getItem('kcLang') === 'he') setLang('he')
  } catch { /* stay en */ } }, [])
  const t = T[lang]
  const flip = () => {
    const n = lang === 'he' ? 'en' : 'he'
    setLang(n)
    try { localStorage.setItem('kcLang', n) } catch { /* not persisted */ }
  }

  const [form, setForm] = useState(EMPTY)
  const [state, setState] = useState('idle') // idle | busy | ok | err
  const [errCode, setErrCode] = useState('')
  const [hours, setHours] = useState('')
  // Opening hours from the same settings key /welcome reads, so the owner's
  // Settings value stays the single source of truth. Without them the success
  // card said "whenever suits you" — but the shop opens afternoons only, which
  // invites a wasted morning trip.
  useEffect(() => {
    fetch('/api/public/info')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.openingHours) setHours(d.openingHours) })
      .catch(() => {})
  }, [])
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    if (state === 'busy') return
    setState('busy'); setErrCode('')
    try {
      const r = await fetch('/api/public/repair', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await r.json().catch(() => null)
      if (d && d.success) { setState('ok'); setForm(EMPTY) }
      else { setState('err'); setErrCode((d && d.code) || 'server') }
    } catch { setState('err'); setErrCode('offline') }
  }

  return (
    <>
      <Head>
        <title>Book a repair — Kosher Connect</title>
        <meta name="description" content="Phone repairs in Salford — screens, mic, charging, housing. Tell us what's wrong and we'll come back with an honest price. Kosher Connect, 421 Bury New Road." />
        <link rel="canonical" href="https://www.kosher-connect.com/repair" />
      </Head>
      <div className="welcome-shell">
        <SkipLink>{t.skip}</SkipLink>
        {/* Physical side from the page language, not `right` — this button is
            outside the dir="rtl" wrapper, so in Hebrew the mirrored topbar puts
            the logo on the right and a right-pinned toggle lands on top of it. */}
        <ThemeToggle style={{ position: 'fixed', top: 16, [t.dir === 'rtl' ? 'left' : 'right']: 16, zIndex: 10 }} />
        <div className="w-wrap" dir={t.dir} lang={lang}>
          <div className="w-topbar">
            <a className="w-brand w-brand-link" href="/welcome" aria-label={t.homeAria}>
              {/* The artwork IS the wordmark — it reads "KOSHER CONNECT". A text
                  copy beside it printed the name twice and cost 162px, which on
                  a phone is what pushed this bar onto a second row. Only the
                  section tag stays. The alt text and the link's aria-label keep
                  the brand for anyone who can't see the mark. */}
              <img src="/logo-full-tight.png" alt="Kosher Connect" />
              <p className="w-brand-tag">{t.tag}</p>
            </a>
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

          {/* The topbar above is the site nav; everything from here to the
              end of the wrapper is the page. */}
          <main id="main">

          <section className="w-section rp-head" id="top">
            <div className="w-strap">{t.strap}</div>
            <h1 className="w-page-title w-show">{t.h3}</h1>
            <p className="w-lead">{t.lead}</p>
          </section>

          <section className="w-section rp-form-wrap" aria-label={t.h3}>
            {state === 'ok' ? (
              <div className="w-card rp-card rp-ok" role="status">
                <div className="rp-ok-ico" aria-hidden="true"><WrenchIcon /></div>
                <h3>{t.okTitle}</h3>
                <p>{t.okWhen}</p>
                <p>{t.okBody}</p>
                {hours && <p className="rp-hours"><strong>{t.hoursLabel}</strong> <span dir="ltr">{hours}</span></p>}
                <p>{t.okCall} <a href={PHONE_TEL} dir="ltr">{PHONE_SHOWN}</a></p>
              </div>
            ) : (
              <form className="w-card rp-card rp-form" onSubmit={submit}>
                <label>
                  <span>{t.fName}</span>
                  <input value={form.name} onChange={set('name')} required minLength={2} maxLength={80} autoComplete="name" />
                </label>
                <label>
                  <span>{t.fContact}</span>
                  <input value={form.contact} onChange={set('contact')} required maxLength={120} autoComplete="tel" dir="ltr" />
                </label>
                <label>
                  <span>{t.fDevice}</span>
                  <input value={form.device} onChange={set('device')} required maxLength={80} />
                </label>
                <label>
                  <span>{t.fIssue}</span>
                  <textarea value={form.issue} onChange={set('issue')} required minLength={3} maxLength={600} rows={4} />
                </label>
                {/* Honeypot — humans never see it; bots fill it and get a polite nothing. */}
                <input className="rp-hp" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true"
                  value={form.company} onChange={set('company')} placeholder="Company" />
                <button type="submit" className="rp-btn" disabled={state === 'busy'}>
                  {state === 'busy' ? t.sending : t.send}
                </button>
                {state === 'err' && (
                  <p className="rp-err" role="alert">
                    {(t.errCodes && t.errCodes[errCode]) || t.errFallback}{' '}
                    <a href={PHONE_TEL} dir="ltr">{PHONE_SHOWN}</a>
                  </p>
                )}
                <p className="rp-urgent">{t.urgent} <a href={PHONE_TEL}>{t.urgentCall} <span dir="ltr">{PHONE_SHOWN}</span></a></p>
              </form>
            )}
          </section>

          <footer className="rp-foot">
            © {new Date().getFullYear()} {t.brandName}. {t.rights} {t.tradingName} <bdi>{legalIdentifier()}</bdi>
          </footer>
        </main>
        </div>
      </div>
    </>
  )
}
