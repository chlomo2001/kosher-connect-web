import { useEffect, useState } from 'react'
import Head from 'next/head'
import ThemeToggle from '../components/ThemeToggle'
import {
  PlaneIcon, FlipPhoneIcon, MusicIcon, WrenchIcon, BagIcon, ChatIcon,
  PhoneCallIcon, MailIcon, PinIcon,
} from '../components/kcIcons'

// The public face of Kosher Connect — the approved Sky redesign, rev5:
// dark starfield hero, centred text-only feature bands (three-tier heading:
// dark title → blue accent → gold subtitle), grouped "More" grid, a dark
// "why people send their friends" line, and a working "Send us a message"
// form. Bilingual (English + lashon hakodesh, RTL flips with it), with the
// dynamic opening hours, JSON-LD SEO and portal / login / join links kept.

const PHONE_TEL = 'tel:+441615311386'
const PHONE_SHOWN = '0161 531 1386' // shop's local form; tel: link stays +44
const EMAIL = 'admin@kosher-connect.com'
const MAPS_URL = 'https://maps.google.com/?q=421+Bury+New+Road,+Salford+M7+4ED'
// Keyless Google Maps embed — the iframe endpoint needs no API key.
const MAPS_EMBED = 'https://www.google.com/maps?q=421+Bury+New+Road,+Salford+M7+4ED&z=16&output=embed'

const BAND_IDS = ['mobile', 'travel', 'intl']

// Client-side mirror of the server's message-form validation (server is the
// real guard). A name needs a real letter (Latin or Hebrew); a contact is a
// valid email or has ≥7 digits — so "/" or junk can't be sent.
const nameOk = (s) => s.trim().length >= 2 && /[a-zA-Z֐-׿]/.test(s)
const contactOk = (s) => {
  const v = s.trim()
  if (/@/.test(v)) return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
  return (v.match(/\d/g) || []).length >= 7
}

const T = {
  en: {
    dir: 'ltr', langLabel: 'EN',
    brandName: 'Kosher Connect',
    nav: { mobile: 'Mobile & SIM', travel: 'Travel phones', intl: 'International numbers', repairs: 'Repairs & more', visit: 'Visit us', message: 'Message us', account: 'My account', signin: 'Staff sign in', join: 'Join us' },
    heroEyebrow: 'Kosher Connect · Salford, Manchester',
    heroTitle: 'Your phone bill, halved.',
    heroBody: 'Most people are quietly on the wrong SIM. Bring us your last bill and we’ll match a plan to how you actually use your phone — same coverage, same number, far less money.',
    heroPill: 'Keep your number · pay less every month',
    ctaMessage: 'Message us', ctaCall: 'Call',
    heroSub: 'Travel phones, international numbers, repairs — everything else, all under one roof.',
    bands: [
      {
        eyebrow: 'Mobile & SIM',
        title: 'Kosher SIM plans, matched to how you really use your phone',
        accent: 'Pay less', sub: 'the right plan for how you really use your phone',
        body: 'Most people are quietly on the wrong SIM and overpaying every month. Bring in your latest bill and we’ll match the plan to what you really need — international minutes and all. No long contract you can’t follow, no company in the middle, no small print.',
        chips: ['Keep your number', 'Keep your phone', 'We do the switch for you'], cta: 'Bring us your bill',
      },
      {
        eyebrow: 'Travel phones',
        title: 'A kosher phone, sorted before you travel',
        accent: 'Shabbos & Yom Tov', sub: 'never charged — you pay only for the days you use',
        body: 'Off to the USA, Canada, Europe or Eretz Yisroel? Rent a kosher phone, set up with you in the shop before you go — so there’s nothing to arrange at a foreign airport. You pay only for the days you actually use it, and Shabbos and Yom Tov are never charged.',
        chips: ['Set up before you travel', 'Only pay for days used', 'Shabbos never charged'], cta: 'Plan your trip',
      },
      {
        eyebrow: 'International numbers',
        title: 'An Israeli or USA number that rings on your UK phone',
        accent: 'Same day', sub: 'an Israeli or USA number, ringing on your own phone',
        body: 'Family in Israel? Business in the States? Get a local number that rings straight through to the phone already in your pocket — no second handset, and no roaming charges for the people calling you.',
        chips: ['Rings on your own phone', 'Israeli or USA number', 'No roaming for callers'], cta: 'Get your number',
      },
    ],
    moreTitle: 'More at Kosher Connect',
    moreLead: 'One shop for the phone and everything around it — so you’re not sent from place to place.',
    moreGroups: [
      {
        label: 'For your phone',
        items: [
          { icon: 'wrench', title: 'Repairs', body: 'Screens, batteries, charging trouble — most fixed quickly, and we’ll tell you honestly if it isn’t worth it.' },
          { icon: 'bag', title: 'Accessories', body: 'Chargers, cables, cases, power banks, SD cards, adapters and USA SIMs — on the shelf.' },
          { icon: 'phone', title: 'Kosher phones', body: 'The right kosher handset for you — we stock a range and talk you through what suits.' },
        ],
      },
      {
        label: 'Everyday help',
        items: [
          { icon: 'music', title: 'Kol Torah audio', body: 'Shiurim, music and children’s stories — on CD or loaded onto your phone or player while you visit.' },
          { icon: 'plane', title: 'Flights & tickets', body: 'We book the trip and keep an eye on times and changes, so it’s sorted before you pack.' },
          { icon: 'chat', title: 'Online help', body: 'Forms, printing and the little online jobs that are easier done properly than fought with.' },
        ],
      },
    ],
    phoneGuideCta: 'Choosing a handset? See the phone guide →',
    friendsEyebrow: 'Why people send their friends',
    friendsText: 'No contracts, no middleman, no jargon — just the deal that actually fits you. And if you’re already on a good one, we’ll tell you.',
    contactEyebrow: 'Message us',
    contactTitle: 'Send us a message',
    contactLead: 'Ask a question, tell us your plan, or leave your bill details — we’ll get back to you.',
    fName: 'Your name', fContact: 'Phone or email', fMsg: 'How can we help?', fSend: 'Send message', fSending: 'Sending…',
    fOk: 'Thanks — we’ve got it and we’ll be in touch.', fErr: 'Couldn’t send — please call us on 0161 531 1386.',
    fBadName: 'Please enter your name.', fBadContact: 'Please enter a valid phone number or email address.',
    preferCall: 'Prefer to call?', joinCta: 'New here? Leave your details →',
    visitTitle: 'Come and see us',
    openMaps: 'Open in Google Maps',
    addressLabel: 'Address',
    addressLine: '421 Bury New Road, Salford M7 4ED',
    findUs: 'The door left of Toy Zone (MMR Group sign) — ring bell 5, we’re on level 2.',
    phoneLabel: 'Phone', emailLabel: 'Email',
    footServices: 'Services', footAccount: 'Your account', footLegal: 'Information',
    hoursLabel: 'Open',
    rights: 'All rights reserved.',
    tradingName: 'Kosher Connect is a trading name of Hatsluche Ltd.',
    paidTitle: 'Payment received — thank you!',
    paidBody: 'Your payment went through and will show on your account shortly.',
    paidClose: 'Dismiss',
    backTop: 'Back to top',
  },
  he: {
    dir: 'rtl', langLabel: 'HE',
    brandName: 'כשר קונקט',
    nav: { mobile: 'סים וטלפון', travel: 'טלפונים לנסיעות', intl: 'מספרים בינלאומיים', repairs: 'תיקונים ועוד', visit: 'בואו לחנות', message: 'דברו איתנו', account: 'החשבון שלי', signin: 'כניסת צוות', join: 'הצטרפות' },
    heroEyebrow: 'כשר קונקט · סלפורד, מנצ׳סטר',
    heroTitle: 'חשבון הטלפון שלכם — בחצי.',
    heroBody: 'רוב האנשים מחזיקים סים לא מתאים ומשלמים יותר מדי. הביאו את החשבון האחרון — נתאים תוכנית לשימוש האמיתי שלכם: אותה רשת, אותו מספר, הרבה פחות כסף.',
    heroPill: 'שומרים על המספר · משלמים פחות כל חודש',
    ctaMessage: 'דברו איתנו', ctaCall: 'חייגו',
    heroSub: 'טלפונים לנסיעות, מספרים בינלאומיים, תיקונים — וכל השאר, הכול תחת קורת גג אחת.',
    bands: [
      {
        eyebrow: 'סים וטלפון',
        title: 'תוכניות סים כשרות, מותאמות לשימוש האמיתי שלכם',
        accent: 'לשלם פחות', sub: 'התוכנית הנכונה לשימוש האמיתי שלכם',
        body: 'רוב האנשים מחזיקים סים לא מתאים ומשלמים יותר מדי מדי חודש. הביאו את החשבון האחרון — נתאים את התוכנית למה שאתם באמת צריכים, כולל דקות לחו״ל. בלי חוזה ארוך, בלי חברה באמצע, בלי אותיות קטנות.',
        chips: ['שומרים על המספר', 'שומרים על הטלפון', 'אנחנו מבצעים את המעבר'], cta: 'הביאו את החשבון',
      },
      {
        eyebrow: 'טלפונים לנסיעות',
        title: 'טלפון כשר, מסודר עוד לפני הנסיעה',
        accent: 'שבת ויום טוב', sub: 'אף פעם לא בחשבון — משלמים רק על ימי השימוש',
        body: 'נוסעים לארה״ב, קנדה, אירופה או ארץ ישראל? טלפון כשר מושכר, מוגדר אתכם בחנות עוד לפני היציאה — כך שאין מה לסדר בשדה תעופה זר. משלמים רק על הימים שבאמת משתמשים, ושבת ויום טוב תמיד חינם.',
        chips: ['מסודר לפני הנסיעה', 'תשלום רק על ימי שימוש', 'שבת תמיד חינם'], cta: 'לתכנון הנסיעה',
      },
      {
        eyebrow: 'מספרים בינלאומיים',
        title: 'מספר ישראלי או אמריקאי שמצלצל בטלפון שלכם',
        accent: 'עוד באותו יום', sub: 'מספר ישראלי או אמריקאי, מצלצל בטלפון שלכם',
        body: 'משפחה בישראל? עסקים בארה״ב? מספר מקומי שמצלצל ישירות אל הטלפון שכבר בכיס שלכם — בלי מכשיר שני, ובלי חיובי נדידה למי שמתקשר אליכם.',
        chips: ['מצלצל בטלפון שלכם', 'מספר ישראלי או אמריקאי', 'בלי נדידה למתקשרים'], cta: 'קבלו מספר',
      },
    ],
    moreTitle: 'עוד בכשר קונקט',
    moreLead: 'חנות אחת לטלפון ולכל מה שסביבו — כדי שלא ישלחו אתכם ממקום למקום.',
    moreGroups: [
      {
        label: 'לטלפון שלכם',
        items: [
          { icon: 'wrench', title: 'תיקונים', body: 'מסכים, סוללות, בעיות טעינה — רוב התיקונים מהירים, ואם לא משתלם — נאמר לכם ביושר.' },
          { icon: 'bag', title: 'אביזרים', body: 'מטענים, כבלים, כיסויים, סוללות ניידות, כרטיסי זיכרון, מתאמים וכרטיסי סים לארה״ב — על המדף.' },
          { icon: 'phone', title: 'טלפונים כשרים', body: 'המכשיר הכשר המתאים לכם — יש לנו מגוון, ונעבור אתכם על מה שמתאים.' },
        ],
      },
      {
        label: 'עזרה יומיומית',
        items: [
          { icon: 'music', title: 'קול תורה', body: 'שיעורים, ניגונים וסיפורי ילדים — על דיסק או מועברים לטלפון או לנגן בזמן שאתם בחנות.' },
          { icon: 'plane', title: 'טיסות וכרטיסים', body: 'אנחנו מזמינים את הנסיעה ושומרים עין על הזמנים והשינויים, כך שהכול מסודר עוד לפני שאורזים.' },
          { icon: 'chat', title: 'עזרה אונליין', body: 'טפסים, הדפסות והעבודות הקטנות באינטרנט — עדיף לעשות אותן כמו שצריך מאשר להתמודד לבד.' },
        ],
      },
    ],
    phoneGuideCta: 'בוחרים מכשיר? למדריך הטלפונים ←',
    friendsEyebrow: 'למה שולחים אלינו חברים',
    friendsText: 'בלי חוזים, בלי מתווך, בלי מילים מסובכות — פשוט העסקה שבאמת מתאימה לכם. ואם אתם כבר על תוכנית טובה, נגיד לכם.',
    contactEyebrow: 'דברו איתנו',
    contactTitle: 'שלחו לנו הודעה',
    contactLead: 'שאלה, התוכנית שלכם, או פרטי החשבון — נחזור אליכם.',
    fName: 'השם שלכם', fContact: 'טלפון או אימייל', fMsg: 'איך נוכל לעזור?', fSend: 'שליחה', fSending: 'שולח…',
    fOk: 'תודה — קיבלנו וניצור קשר.', fErr: 'לא הצלחנו לשלוח — התקשרו אלינו 0161 531 1386.',
    fBadName: 'נא להזין שם.', fBadContact: 'נא להזין מספר טלפון או כתובת אימייל תקינים.',
    preferCall: 'מעדיפים להתקשר?', joinCta: 'חדשים כאן? השאירו פרטים ←',
    visitTitle: 'בואו לבקר אותנו',
    openMaps: 'פתיחה בגוגל מפות',
    addressLabel: 'כתובת',
    addressLine: '421 Bury New Road, Salford M7 4ED',
    findUs: 'הדלת משמאל ל־Toy Zone (שלט MMR Group) — לצלצל בפעמון 5, אנחנו בקומה 2.',
    phoneLabel: 'טלפון', emailLabel: 'אימייל',
    footServices: 'שירותים', footAccount: 'החשבון שלכם', footLegal: 'מידע',
    hoursLabel: 'שעות פתיחה',
    rights: 'כל הזכויות שמורות.',
    tradingName: 'כשר קונקט הוא שם מסחרי של Hatsluche Ltd.',
    paidTitle: 'התשלום התקבל — תודה רבה!',
    paidBody: 'התשלום עבר בהצלחה ויופיע בחשבונכם בקרוב.',
    paidClose: 'סגירה',
    backTop: 'חזרה למעלה',
  },
}

const MORE_ICONS = { wrench: WrenchIcon, bag: BagIcon, phone: FlipPhoneIcon, music: MusicIcon, plane: PlaneIcon, chat: ChatIcon }

// kcIcons has no clock — small local one for the opening-hours row.
const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
  </svg>
)

const LD_JSON = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'Kosher Connect',
  legalName: 'Hatsluche Ltd',
  description: 'Kosher phones, SIM plans, travel phone rentals, international numbers, Kol Torah audio and repairs. Serving the Heimishe community.',
  telephone: '+441615311386',
  email: EMAIL,
  url: 'https://kosher-connect.com/welcome',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '421 Bury New Road, Level 2',
    addressLocality: 'Salford',
    addressRegion: 'Greater Manchester',
    postalCode: 'M7 4ED',
    addressCountry: 'GB',
  },
  openingHours: ['Su 14:00-18:30', 'Mo-Th 14:00-18:30'],
})

export default function Welcome() {
  const [lang, setLang] = useState('en')
  const [hours, setHours] = useState('Sunday–Thursday, 2:00–6:30pm')
  const [form, setForm] = useState({ name: '', contact: '', message: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState('') // '', 'ok', 'err'
  const [errMsg, setErrMsg] = useState('')
  const [paid, setPaid] = useState(false) // Stripe Checkout success lands on /welcome?paid=1
  const [showTop, setShowTop] = useState(false)
  useEffect(() => {
    try { const saved = localStorage.getItem('kcLang'); if (saved && T[saved]) setLang(saved) } catch {}
    try { if (new URLSearchParams(window.location.search).get('paid') === '1') setPaid(true) } catch {}
    fetch('/api/public/info')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.openingHours) setHours(d.openingHours) })
      .catch(() => {})
  }, [])
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 700)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  const pick = (l) => { setLang(l); try { localStorage.setItem('kcLang', l) } catch {} }
  // Strip ?paid=1 on dismiss so a refresh or shared link doesn't re-announce it.
  const dismissPaid = () => { setPaid(false); try { window.history.replaceState(null, '', window.location.pathname) } catch {} }
  const t = T[lang]

  useEffect(() => {
    const els = document.querySelectorAll('.sk-reveal:not(.in)')
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target) } })
    }, { threshold: 0.12 })
    els.forEach((c) => obs.observe(c))
    return () => obs.disconnect()
  }, [lang])

  const submit = async (e) => {
    e.preventDefault()
    if (sending) return
    if (!nameOk(form.name)) { setSent('err'); setErrMsg(t.fBadName); return }
    if (!contactOk(form.contact)) { setSent('err'); setErrMsg(t.fBadContact); return }
    setSending(true); setSent(''); setErrMsg('')
    try {
      const r = await fetch('/api/public/message', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), contact: form.contact.trim(), message: form.message.trim() }),
      })
      const j = await r.json().catch(() => ({}))
      if (r.ok && j.success) { setSent('ok'); setForm({ name: '', contact: '', message: '' }) }
      else { setSent('err'); setErrMsg(j.error || t.fErr) }
    } catch { setSent('err'); setErrMsg(t.fErr) }
    finally { setSending(false) }
  }

  return (
    <>
      <Head>
        <title>Kosher Connect — Kosher phones, SIM plans, travel, repairs & international numbers</title>
        <meta name="description" content="Kosher Connect - Kosher phones, SIM plans, travel phones, repairs, and international numbers. Serving the Heimishe community from Manchester." />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Kosher Connect" />
        <meta property="og:title" content="Kosher Connect — Your phone bill, halved" />
        <meta property="og:description" content="Kosher phones, SIM plans, travel rentals, international numbers, Kol Torah audio and repairs — under one roof in Manchester." />
        <meta property="og:url" content="https://kosher-connect.com/welcome" />
        <meta property="og:image" content="https://kosher-connect.com/logo-full.png" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: LD_JSON }} />
      </Head>
      <style dangerouslySetInnerHTML={{ __html: SKY_CSS }} />
      <ThemeToggle style={{ position: 'fixed', top: 14, insetInlineEnd: 14, zIndex: 60 }} />

      <div className="sk" dir={t.dir} lang={lang === 'en' ? 'en' : lang}>
        <header className="sk-nav-wrap">
          <div className="sk-wrap sk-nav">
            <a className="sk-brand" href="#top">
              <img className="sk-logo" src="/logo-full-tight.png" alt="Kosher Connect" />
            </a>
            <nav className="sk-nav-links" aria-label="Site">
              <a href="#mobile" className="sk-navlink">{t.nav.mobile}</a>
              <a href="#travel" className="sk-navlink">{t.nav.travel}</a>
              <a href="#intl" className="sk-navlink">{t.nav.intl}</a>
              <a href="#services" className="sk-navlink">{t.nav.repairs}</a>
              <a href="#visit" className="sk-navlink">{t.nav.visit}</a>
              <div className="sk-lang" role="group" aria-label="Language">
                {['en', 'he'].map((l) => (
                  <button key={l} type="button" lang={l === 'en' ? 'en' : l}
                    className={lang === l ? 'on' : ''} aria-pressed={lang === l}
                    onClick={() => pick(l)}>{T[l].langLabel}</button>
                ))}
              </div>
              <a href={PHONE_TEL} className="sk-nav-phone" dir="ltr" aria-label="Call Kosher Connect">
                <strong>{PHONE_SHOWN}</strong><span>{hours}</span>
              </a>
              <a href="#contact" className="sk-btn sk-btn-sky sk-btn-sm">{t.nav.message}</a>
            </nav>
          </div>
        </header>

        {paid && (
          <div className="sk-paid" role="status">
            <div className="sk-wrap sk-paid-in">
              <span className="sk-paid-tick" aria-hidden="true">✓</span>
              <span className="sk-paid-txt">
                <strong>{t.paidTitle}</strong>
                <span>{t.paidBody}</span>
              </span>
              <button type="button" className="sk-paid-x" onClick={dismissPaid} aria-label={t.paidClose}>×</button>
            </div>
          </div>
        )}

        <section className="sk-hero" id="top">
          <div className="sk-hero-stars" aria-hidden="true" />
          <div className="sk-wrap">
            <span className="sk-eyebrow">{t.heroEyebrow}</span>
            <h1>{t.heroTitle}</h1>
            <p className="sk-hero-body">{t.heroBody}</p>
            <span className="sk-pill">{t.heroPill}</span>
            <div className="sk-hero-cta">
              <a className="sk-btn sk-btn-sky sk-btn-lg" href="#contact">{t.ctaMessage}</a>
              <a className="sk-btn sk-btn-ghost sk-btn-lg" href={PHONE_TEL}>{t.ctaCall}{' '}<span dir="ltr">{PHONE_SHOWN}</span></a>
            </div>
            <p className="sk-hero-sub">{t.heroSub}</p>
          </div>
        </section>

        {t.bands.map((b, i) => (
          <section className={`sk-band ${i % 2 ? 'sk-band-tint' : ''}`} id={BAND_IDS[i]} key={`${lang}-b${i}`}>
            <div className="sk-wrap sk-band-inner sk-reveal">
              <span className="sk-eyebrow">{b.eyebrow}</span>
              <h2>{b.title}</h2>
              <div className="sk-accent">{b.accent}</div>
              <div className="sk-subline">{b.sub}</div>
              <p className="sk-band-body">{b.body}</p>
              <div className="sk-chips">{b.chips.map((c, j) => <span key={j}>✓ {c}</span>)}</div>
              <a className="sk-btn sk-btn-sky sk-btn-lg" href="#contact">{b.cta}</a>
            </div>
          </section>
        ))}

        <section className="sk-also" id="services">
          <div className="sk-wrap">
            <h2 className="sk-reveal">{t.moreTitle}</h2>
            <p className="sk-also-lead sk-reveal">{t.moreLead}</p>
            {t.moreGroups.map((g, gi) => (
              <div key={`${lang}-g${gi}`}>
                <div className="sk-group-label sk-reveal">{g.label}</div>
                <div className="sk-grid">
                  {g.items.map((m, i) => {
                    const Icon = MORE_ICONS[m.icon] || ChatIcon
                    return (
                      <div className="sk-tile sk-reveal" key={`${lang}-g${gi}-m${i}`}>
                        <div className="sk-tile-ico" aria-hidden="true"><Icon /></div>
                        <h4>{m.title}</h4>
                        <p>{m.body}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
            <p className="sk-guide"><a href="/phone-guide">{t.phoneGuideCta}</a></p>
          </div>
        </section>

        <section className="sk-friends">
          <div className="sk-wrap sk-reveal">
            <span className="sk-eyebrow">{t.friendsEyebrow}</span>
            <p className="sk-friends-line">{t.friendsText}</p>
          </div>
        </section>

        <section className="sk-contact" id="contact">
          <div className="sk-wrap sk-reveal">
            <span className="sk-eyebrow">{t.contactEyebrow}</span>
            <h2>{t.contactTitle}</h2>
            <p className="sk-contact-lead">{t.contactLead}</p>
            <form className="sk-form" onSubmit={submit}>
              <input type="text" name="name" autoComplete="name" placeholder={t.fName}
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <input type="text" name="contact" placeholder={t.fContact}
                value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} required />
              <textarea name="message" rows={3} placeholder={t.fMsg}
                value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
              <input type="text" name="company" tabIndex={-1} autoComplete="off"
                value="" onChange={() => {}} style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }} aria-hidden="true" />
              <button type="submit" className="sk-btn sk-btn-sky sk-btn-lg" disabled={sending}>
                {sending ? t.fSending : t.fSend}
              </button>
              {sent === 'ok' && <p className="sk-form-ok" role="status">{t.fOk}</p>}
              {sent === 'err' && <p className="sk-form-err" role="alert">{errMsg || t.fErr}</p>}
            </form>
            <p className="sk-prefer">
              {t.preferCall} <a href={PHONE_TEL} dir="ltr">{PHONE_SHOWN}</a>
              &nbsp;·&nbsp;<a className="sk-join" href="/join">{t.joinCta}</a>
            </p>
          </div>
        </section>

        <section className="sk-visit" id="visit">
          <div className="sk-wrap sk-reveal">
            <span className="sk-eyebrow">{t.nav.visit}</span>
            <h2>{t.visitTitle}</h2>
            <div className="sk-visit-grid">
              <div className="sk-map-card">
                <iframe
                  src={`${MAPS_EMBED}&hl=${lang === 'he' ? 'iw' : 'en'}`}
                  title={t.visitTitle} loading="lazy" allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade" />
                <a className="sk-btn sk-btn-sky sk-btn-sm sk-map-open" href={MAPS_URL}
                  target="_blank" rel="noopener noreferrer">{t.openMaps} ↗</a>
              </div>
              <div className="sk-visit-info">
                <div className="sk-visit-row">
                  <span className="sk-visit-ico" aria-hidden="true"><PinIcon /></span>
                  <div>
                    <strong>{t.addressLabel}</strong>
                    <p dir="ltr">{t.addressLine}</p>
                    <p>{t.findUs}</p>
                  </div>
                </div>
                <div className="sk-visit-row">
                  <span className="sk-visit-ico" aria-hidden="true"><ClockIcon /></span>
                  <div><strong>{t.hoursLabel}</strong><p>{hours}</p></div>
                </div>
                <div className="sk-visit-row">
                  <span className="sk-visit-ico" aria-hidden="true"><PhoneCallIcon /></span>
                  <div><strong>{t.phoneLabel}</strong><p><a href={PHONE_TEL} dir="ltr">{PHONE_SHOWN}</a></p></div>
                </div>
                <div className="sk-visit-row">
                  <span className="sk-visit-ico" aria-hidden="true"><MailIcon /></span>
                  <div><strong>{t.emailLabel}</strong><p><a href={`mailto:${EMAIL}`} dir="ltr">{EMAIL}</a></p></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="sk-foot">
          <div className="sk-wrap">
            <div className="sk-foot-grid">
              <div className="sk-foot-brand">
                <img className="sk-logo sk-foot-logo" src="/logo-full-tight.png" alt="Kosher Connect" />
                <p dir="ltr">{t.addressLine}</p>
                <p><a href={PHONE_TEL} dir="ltr">{PHONE_SHOWN}</a></p>
                <p><a href={`mailto:${EMAIL}`} dir="ltr">{EMAIL}</a></p>
              </div>
              <nav className="sk-foot-col" aria-label={t.footServices}>
                <strong>{t.footServices}</strong>
                <a href="#mobile">{t.nav.mobile}</a>
                <a href="#travel">{t.nav.travel}</a>
                <a href="#intl">{t.nav.intl}</a>
                <a href="#services">{t.nav.repairs}</a>
              </nav>
              <nav className="sk-foot-col" aria-label={t.footAccount}>
                <strong>{t.footAccount}</strong>
                <a href="/join">{t.nav.join}</a>
                <a href="/portal">{t.nav.account}</a>
                <a href="/login">{t.nav.signin}</a>
              </nav>
              <nav className="sk-foot-col" aria-label={t.footLegal}>
                <strong>{t.footLegal}</strong>
                <a href="#visit">{t.nav.visit}</a>
                <a href="/privacy">Privacy</a>
                <a href="/terms">Terms</a>
                <a href="/refund">Refunds</a>
              </nav>
            </div>
            <p className="sk-foot-legal">
              © {new Date().getFullYear()} {t.brandName}. {t.rights} {t.tradingName}
            </p>
          </div>
        </footer>

        <button type="button" className={`sk-top ${showTop ? 'show' : ''}`}
          onClick={() => window.scrollTo({ top: 0 })} aria-label={t.backTop} title={t.backTop}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </>
  )
}

const SKY_CSS = `
  :root{
    --sk-ink:#0d1526; --sk-sky:#07639e; --sk-sky-bright:#2f95d8; --sk-gold:#c19161;
    --sk-text:#0d1526; --sk-muted:#566079; --sk-line:#dbe3f0;
    --sk-paper:#ffffff; --sk-canvas:#f4f7fc; --sk-band:#ffffff; --sk-band-alt:#eef2fb;
    --sk-maxw:1320px; /* Sky-scale desktop container (owner comparison, 27 Jul) */
    --sk-fdisp:"Helvetica Neue",Arial,system-ui,-apple-system,"Segoe UI",sans-serif;
    --sk-fbody:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;
  }
  @media (prefers-color-scheme:dark){:root:not([data-theme]){
    --sk-text:#eaf0fb; --sk-muted:#9aa6c4; --sk-line:#26305c;
    --sk-paper:#0c1330; --sk-canvas:#080d24; --sk-band:#0b1230; --sk-band-alt:#080d24;
  }}
  :root[data-theme="dark"]{
    --sk-text:#eaf0fb; --sk-muted:#9aa6c4; --sk-line:#26305c;
    --sk-paper:#0c1330; --sk-canvas:#080d24; --sk-band:#0b1230; --sk-band-alt:#080d24;
  }
  /* overflow-x must live on <html> only: any overflow value on <body> turns it
     into its own scroll container, which silently disables the sticky nav. */
  html{height:auto;overflow-x:hidden;overflow-y:auto}
  body{height:auto;overflow:visible}
  #__next{display:block;height:auto;overflow:visible}
  /* The sticky nav is 66px tall — keep anchor targets clear of it. */
  .sk [id]{scroll-margin-top:78px}
  @media (prefers-reduced-motion:no-preference){ html{scroll-behavior:smooth} }
  .sk *{box-sizing:border-box}
  .sk{background:var(--sk-paper);color:var(--sk-text);font-family:var(--sk-fbody);
    font-size:17px;line-height:1.6;-webkit-font-smoothing:antialiased}
  .sk a{color:inherit;text-decoration:none}
  .sk-wrap{max-width:var(--sk-maxw);margin:0 auto;padding:0 24px}
  .sk h1,.sk h2,.sk h4{font-family:var(--sk-fdisp);font-weight:800;letter-spacing:-.028em;margin:0;line-height:1.05}
  .sk-eyebrow{font-family:var(--sk-fbody);font-weight:700;font-size:12.5px;letter-spacing:.14em;
    text-transform:uppercase;color:var(--sk-sky);display:block;margin-bottom:14px}
  @media (prefers-color-scheme:dark){:root:not([data-theme]) .sk-eyebrow{color:var(--sk-sky-bright)}}
  :root[data-theme="dark"] .sk-eyebrow{color:var(--sk-sky-bright)}

  /* nav */
  .sk-nav-wrap{position:sticky;top:0;z-index:50;background:color-mix(in srgb,var(--sk-paper) 88%,transparent);
    backdrop-filter:saturate(150%) blur(12px);border-bottom:1px solid var(--sk-line)}
  .sk-paid{background:#e8f6ee;border-bottom:1px solid #bfe5cd;color:#14532d}
  @media (prefers-color-scheme:dark){:root:not([data-theme]) .sk-paid{background:#0e2b1c;border-bottom-color:#1e5c3a;color:#c7f0d8}}
  :root[data-theme="dark"] .sk-paid{background:#0e2b1c;border-bottom-color:#1e5c3a;color:#c7f0d8}
  .sk-paid-in{display:flex;align-items:center;gap:16px;padding:20px 24px}
  .sk-paid-tick{flex:none;width:40px;height:40px;border-radius:50%;background:#1a9a50;color:#fff;display:grid;place-items:center;font-size:20px;font-weight:800}
  .sk-paid-txt{display:flex;flex-direction:column;gap:3px}
  .sk-paid-txt strong{font-family:var(--sk-fdisp);font-size:19.5px;letter-spacing:-.015em;line-height:1.2}
  .sk-paid-txt > span{font-size:15px;opacity:.92}
  .sk-paid-x{margin-inline-start:auto;background:none;border:0;color:inherit;font-size:26px;line-height:1;cursor:pointer;opacity:.7;padding:2px 8px}
  .sk-paid-x:hover{opacity:1}
  .sk-nav{display:flex;align-items:center;justify-content:space-between;height:66px;gap:14px}
  /* logo-full-tight.png is the artwork with its transparent padding cropped off —
     the original canvas is ~2/3 empty, which made the mark render ~11px tall. */
  .sk-logo{height:32px;width:auto;display:block}
  :root[data-theme="dark"] .sk-logo{filter:brightness(0) invert(1)}
  @media (prefers-color-scheme:dark){:root:not([data-theme]) .sk-logo{filter:brightness(0) invert(1)}}
  .sk-nav-links{display:flex;align-items:center;gap:20px}
  .sk-navlink{color:var(--sk-muted);font-weight:600;font-size:14.5px;white-space:nowrap}
  .sk-navlink:hover{color:var(--sk-text)}
  .sk-lang{display:inline-flex;border:1px solid var(--sk-line);border-radius:999px;overflow:hidden}
  .sk-lang button{border:0;background:transparent;color:var(--sk-muted);font-weight:700;font-size:12.5px;
    padding:5px 11px;cursor:pointer}
  .sk-lang button.on{background:var(--sk-sky);color:#fff}
  .sk-nav-phone{display:flex;flex-direction:column;line-height:1.15;color:var(--sk-text);white-space:nowrap}
  .sk-nav-phone strong{font-weight:800;font-size:15px;letter-spacing:-.01em}
  .sk-nav-phone span{font-size:11px;color:var(--sk-muted);font-weight:600}
  .sk-nav-phone:hover strong{color:var(--sk-sky)}
  :root[data-theme="dark"] .sk-nav-phone:hover strong{color:var(--sk-sky-bright)}

  /* back to top */
  .sk-top{position:fixed;bottom:22px;inset-inline-end:22px;z-index:40;width:44px;height:44px;
    border-radius:50%;border:1px solid var(--sk-line);background:var(--sk-paper);color:var(--sk-text);
    display:grid;place-items:center;cursor:pointer;box-shadow:0 4px 16px rgba(10,21,38,.14);
    opacity:0;visibility:hidden;transform:translateY(8px);
    transition:opacity .2s ease,transform .2s ease,visibility 0s .2s}
  .sk-top.show{opacity:1;visibility:visible;transform:none;transition:opacity .2s ease,transform .2s ease}
  .sk-top:hover{color:var(--sk-sky);border-color:var(--sk-sky)}
  :root[data-theme="dark"] .sk-top:hover{color:var(--sk-sky-bright);border-color:var(--sk-sky-bright)}

  /* buttons */
  .sk-btn{display:inline-flex;align-items:center;justify-content:center;gap:.35em;font-weight:700;
    border-radius:999px;cursor:pointer;transition:transform .12s ease,filter .12s ease;white-space:nowrap;
    border:0;font-family:inherit}
  .sk-btn:hover{transform:translateY(-1px)}
  .sk-btn:disabled{opacity:.6;cursor:default;transform:none}
  .sk-btn-sky{background:var(--sk-sky);color:#fff}
  .sk-btn-sky:hover{filter:brightness(1.08)}
  .sk-btn-ghost{background:transparent;color:var(--sk-sky);border:1.5px solid var(--sk-sky)}
  .sk-btn-sm{padding:9px 17px;font-size:14px}
  .sk-btn-lg{padding:13px 26px;font-size:15.5px}

  /* hero — always the dark Sky banner, both themes, with a faint starfield */
  .sk-hero{position:relative;overflow:hidden;padding:88px 0 78px;
    background:radial-gradient(130% 150% at 14% 0%,#123a6b 0%,#0b2350 42%,#071634 100%);color:#eaf2ff}
  .sk-hero-stars{position:absolute;inset:0;pointer-events:none;opacity:.5;
    background-image:
      radial-gradient(1.4px 1.4px at 12% 22%,#cfe0f6 40%,transparent 41%),
      radial-gradient(1.2px 1.2px at 28% 62%,#9fc3ea 40%,transparent 41%),
      radial-gradient(1.5px 1.5px at 46% 14%,#eaf2ff 40%,transparent 41%),
      radial-gradient(1.2px 1.2px at 63% 44%,#bcd6f2 40%,transparent 41%),
      radial-gradient(1.6px 1.6px at 78% 20%,#eaf2ff 40%,transparent 41%),
      radial-gradient(1.2px 1.2px at 88% 58%,#9fc3ea 40%,transparent 41%),
      radial-gradient(1.3px 1.3px at 36% 82%,#cfe0f6 40%,transparent 41%),
      radial-gradient(1.2px 1.2px at 70% 78%,#bcd6f2 40%,transparent 41%),
      radial-gradient(1.4px 1.4px at 55% 30%,#eaf2ff 40%,transparent 41%)}
  .sk-hero .sk-wrap{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center}
  .sk-hero .sk-eyebrow{color:#7db8e6}
  .sk-hero h1{font-size:clamp(38px,7vw,74px);max-width:16ch;color:#fff;letter-spacing:-.035em;line-height:1.0}
  .sk-hero-body{color:#c4d4ee;max-width:47ch;margin:22px auto 0;font-size:clamp(16.5px,2.2vw,20px)}
  .sk-pill{display:inline-block;margin-top:22px;border:1px solid rgba(255,255,255,.22);
    border-radius:999px;padding:9px 18px;font-size:13.5px;font-weight:600;color:#cfe0f6;background:rgba(255,255,255,.05)}
  .sk-hero-cta{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px;justify-content:center}
  .sk-hero .sk-btn-ghost{color:#fff;border-color:rgba(255,255,255,.5)}
  .sk-hero .sk-btn-ghost:hover{background:rgba(255,255,255,.08)}
  .sk-hero-sub{color:#9fb4d6;max-width:46ch;margin:24px auto 0;font-size:15px}

  /* feature bands — centred, text only */
  .sk-band{padding:70px 0;border-bottom:1px solid var(--sk-line)}
  .sk-band-tint{background:var(--sk-band-alt)}
  .sk-band-inner{max-width:760px;margin:0 auto;text-align:center;display:flex;flex-direction:column;align-items:center}
  .sk-band-inner h2{font-size:clamp(26px,4vw,38px);line-height:1.08}
  .sk-accent{font-family:var(--sk-fdisp);font-weight:800;font-size:clamp(24px,3.6vw,34px);
    color:var(--sk-sky);letter-spacing:-.02em;margin-top:4px}
  :root[data-theme="dark"] .sk-accent{color:var(--sk-sky-bright)}
  .sk-subline{color:var(--sk-gold);font-size:14.5px;margin-top:8px;font-style:italic}
  .sk-band-body{color:var(--sk-muted);margin:18px 0 0;font-size:16.5px;max-width:60ch}
  .sk-chips{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:22px 0 0}
  .sk-chips span{background:var(--sk-band);border:1px solid var(--sk-line);border-radius:999px;
    padding:7px 14px;font-size:13.5px;font-weight:600;color:var(--sk-text)}
  .sk-band-tint .sk-chips span{background:var(--sk-paper)}
  .sk-band-inner .sk-btn{margin-top:26px}

  /* more grid, grouped */
  .sk-also{padding:70px 0;background:var(--sk-band)}
  .sk-also h2{font-size:clamp(24px,3.6vw,34px);text-align:center}
  .sk-also-lead{color:var(--sk-muted);text-align:center;max-width:60ch;margin:12px auto 30px}
  .sk-group-label{font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;
    color:var(--sk-muted);text-align:center;margin:26px 0 14px}
  .sk-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
  .sk-tile{background:var(--sk-band-alt);border:1px solid var(--sk-line);border-radius:16px;padding:22px}
  .sk-tile-ico{width:38px;height:38px;color:var(--sk-sky);margin-bottom:12px}
  :root[data-theme="dark"] .sk-tile-ico{color:var(--sk-sky-bright)}
  .sk-tile-ico svg{width:100%;height:100%}
  .sk-tile h4{font-size:18px;margin:0 0 8px}
  .sk-tile p{color:var(--sk-muted);font-size:14.5px;margin:0}
  .sk-guide{text-align:center;margin-top:30px}
  .sk-guide a{color:var(--sk-sky);font-weight:700}
  :root[data-theme="dark"] .sk-guide a{color:var(--sk-sky-bright)}

  /* friends — dark one-liner band */
  .sk-friends{background:radial-gradient(130% 150% at 84% 0%,#123a6b 0%,#0b2350 45%,#071634 100%);
    color:#eaf2ff;padding:60px 0;text-align:center}
  .sk-friends .sk-eyebrow{color:#7db8e6}
  .sk-friends-line{font-family:var(--sk-fdisp);font-weight:800;letter-spacing:-.02em;
    font-size:clamp(21px,3.2vw,30px);line-height:1.25;max-width:24ch;margin:0 auto;color:#fff}

  /* contact + message form */
  .sk-contact{padding:70px 0;background:var(--sk-band-alt);text-align:center}
  .sk-contact h2{font-size:clamp(24px,3.6vw,34px)}
  .sk-contact-lead{color:var(--sk-muted);max-width:52ch;margin:12px auto 26px}
  .sk-form{max-width:440px;margin:0 auto;display:flex;flex-direction:column;gap:12px;text-align:start}
  .sk-form input,.sk-form textarea{width:100%;padding:12px 14px;border:1px solid var(--sk-line);
    border-radius:12px;background:var(--sk-paper);color:var(--sk-text);font:inherit;font-size:15px}
  .sk-form textarea{resize:vertical;min-height:88px}
  .sk-form input:focus,.sk-form textarea:focus{outline:2px solid var(--sk-sky);outline-offset:1px;border-color:transparent}
  .sk-form .sk-btn{margin-top:2px}
  .sk-form-ok{color:#1a7f4b;font-size:14px;margin:2px 0 0;font-weight:600}
  .sk-form-err{color:var(--sk-gold);font-size:14px;margin:2px 0 0;font-weight:600}
  :root[data-theme="dark"] .sk-form-ok{color:#5fd08a}
  .sk-prefer{color:var(--sk-muted);font-size:14px;margin:24px auto 0;max-width:60ch}
  .sk-prefer a,.sk-join{color:var(--sk-sky);font-weight:700}
  :root[data-theme="dark"] .sk-prefer a,:root[data-theme="dark"] .sk-join{color:var(--sk-sky-bright)}

  /* visit — live map card + shop details */
  .sk-visit{padding:70px 0 76px;background:var(--sk-band);text-align:center}
  .sk-visit h2{font-size:clamp(24px,3.6vw,34px)}
  .sk-visit-grid{display:grid;grid-template-columns:1.25fr 1fr;gap:20px;margin-top:32px;text-align:start}
  .sk-map-card{position:relative;border:1px solid var(--sk-line);border-radius:16px;overflow:hidden;
    background:var(--sk-band-alt);display:flex;min-height:380px}
  .sk-map-card iframe{border:0;width:100%;min-height:380px;flex:1;display:block}
  .sk-map-open{position:absolute;bottom:14px;inset-inline-start:14px;box-shadow:0 4px 14px rgba(7,22,52,.35)}
  .sk-visit-info{border:1px solid var(--sk-line);border-radius:16px;background:var(--sk-band-alt);
    padding:26px 24px;display:flex;flex-direction:column;gap:20px;justify-content:center}
  .sk-visit-row{display:flex;gap:12px}
  .sk-visit-ico{flex:none;width:20px;height:20px;color:var(--sk-sky);margin-top:3px}
  :root[data-theme="dark"] .sk-visit-ico{color:var(--sk-sky-bright)}
  .sk-visit-ico svg{width:100%;height:100%}
  .sk-visit-row strong{display:block;font-size:14.5px;margin-bottom:2px}
  .sk-visit-row p{margin:0;color:var(--sk-muted);font-size:14px;line-height:1.55}
  .sk-visit-row a{color:var(--sk-sky);font-weight:600}
  :root[data-theme="dark"] .sk-visit-row a{color:var(--sk-sky-bright)}

  /* footer — labelled columns */
  .sk-foot{background:var(--sk-band);border-top:1px solid var(--sk-line);padding:48px 0 40px}
  .sk-foot-grid{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:26px;align-items:start;text-align:start}
  .sk-foot-logo{height:36px;margin-bottom:12px}
  .sk-foot-brand p{margin:6px 0 0;color:var(--sk-muted);font-size:13.5px}
  .sk-foot-brand a{color:var(--sk-muted)}
  .sk-foot-brand a:hover{color:var(--sk-text)}
  .sk-foot-col{display:flex;flex-direction:column;gap:9px}
  .sk-foot-col strong{font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;
    color:var(--sk-text);margin-bottom:2px}
  .sk-foot-col a{color:var(--sk-muted);font-size:14px}
  .sk-foot-col a:hover{color:var(--sk-text)}
  .sk-foot-legal{color:var(--sk-muted);font-size:13px;margin:30px 0 0;padding-top:18px;
    border-top:1px solid var(--sk-line);line-height:1.7}

  /* reveal */
  .sk-reveal{opacity:0;transform:translateY(16px);transition:opacity .6s ease,transform .6s ease}
  .sk-reveal.in{opacity:1;transform:none}
  @media (prefers-reduced-motion:reduce){.sk-reveal{opacity:1;transform:none;transition:none}}

  @media (max-width:960px){ .sk-navlink{display:none} .sk-nav-phone{display:none} .sk-foot-grid{grid-template-columns:1fr 1fr} }
  /* Keep the nav's CTA clear of the fixed theme toggle on phones. */
  @media (max-width:640px){ .sk-nav{padding-inline-end:46px} }
  @media (max-width:820px){ .sk-grid{grid-template-columns:1fr} .sk-visit-grid{grid-template-columns:1fr} .sk-map-card{min-height:300px} .sk-map-card iframe{min-height:300px} }
`
