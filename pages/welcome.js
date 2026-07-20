import { useEffect, useState } from 'react'
import Head from 'next/head'
import ThemeToggle from '../components/ThemeToggle'
import AuthBackdrop from '../components/AuthBackdrop'
import { formatPhoneDisplay } from '../lib/ukPhone.mjs'
import {
  PlaneIcon, FlipPhoneIcon, SimIcon, GlobeIcon, TicketIcon, MusicIcon,
  WrenchIcon, BagIcon, ChatIcon, PhoneCallIcon, MailIcon, PinIcon,
} from '../components/kcIcons'

// The public face of KosherConnect — the owner's original site rebuilt on the
// app's design system, with the living globe scene behind it. His voice and
// lines ("Welcome to the Kosher World", "without compromise", the don't-overpay
// price story) carried forward; details updated to what the business is today.
// Copy leads with what the visitor gains or stops losing, backed by concrete
// numbers and honest promises — persuasion by straight talk, not noise.
//
// Two languages: English and lashon hakodesh — the same content, not a
// translation widget. RTL flips with the language.
// No auth: Sign in / My account link into the staff app and customer portal.

const ICONS = [PlaneIcon, FlipPhoneIcon, SimIcon, GlobeIcon, TicketIcon, MusicIcon, WrenchIcon, BagIcon, ChatIcon]

const PHONE_TEL = 'tel:+441615311386'
const PHONE_SHOWN = formatPhoneDisplay('01615311386')
const EMAIL = 'admin@kosher-connect.com'
const MAPS_URL = 'https://maps.google.com/?q=421+Bury+New+Road,+Salford+M7+4ED'

const T = {
  en: {
    dir: 'ltr', langLabel: 'EN',
    brandName: 'Kosher Connect',
    brandTag: 'Kosher Phones • Rentals & Travel • SIM Plans • Kol Torah Audio • Repairs',
    nav: { services: 'Services', contact: 'Contact', account: 'My account', signin: 'Staff sign in' },
    heroTitle: 'Welcome to the Kosher World',
    strap: 'Serving the Heimishe community — Manchester',
    heroBody: 'Kosher technology without compromise on quality, efficiency or service. Phones, SIMs, travel, repairs and Kol Torah audio — under one roof, and explained properly before you spend a penny.',
    quote: '“Technology should serve the people — not the other way around.”',
    ctaServices: 'See what we do', ctaContact: 'Ask us anything',
    mini1: { t: 'Straight answers', b: 'We recommend what fits your family and your pocket — even when it isn’t the dearest thing on the shelf.' },
    mini2: { t: 'Travel ready', b: 'USA · Canada · EU · Israel — phone and number working before you board.' },
    proof: [
      { v: '£35 → £18', c: 'what a typical monthly SIM bill becomes once the plan actually matches the usage' },
      { v: 'Shabbos & Yom Tov', c: 'never charged on any rental — on every trip, automatically' },
      { v: 'Same day', c: 'rentals, SIMs and international numbers working before you leave the shop' },
    ],
    servicesTitle: 'What we do',
    services: [
      { title: 'Travelling? Don’t pay roaming prices', body: 'Rent a kosher phone for the trip — USA and Israel lines ready the day you leave. You pay only for the days you use; Shabbos and Yom Tov are always free.' },
      { title: 'Kosher phones, properly set up', body: 'Reliable, tested handsets with the right kosher setup for your family — rent or buy, and walk out with it working.' },
      { title: 'Stop overpaying for your SIM', body: 'Most people are on the wrong plan. Bring us your bill — we’ll match the tariff to how you actually use it, international minutes included, and the monthly bill usually drops by half.' },
      { title: 'A local number for family abroad', body: 'An Israeli or USA number that rings on your phone in the UK — the family dials local, you answer here. Set up the same day.' },
      { title: 'Flights, booked and watched', body: 'We book the tickets and keep an eye on times and changes, so the trip is sorted before you start packing.' },
      { title: 'Kol Torah audio', body: 'Shiurim, music and children’s stories — on CD or as audio files, loaded onto your kosher phone or player while you wait.' },
      { title: 'Smashed screen? Bring it in', body: 'Screens, batteries, charging trouble — most repairs are done quickly, and we’ll tell you honestly if it isn’t worth fixing.' },
      { title: 'Accessories on the shelf', body: 'Chargers, cables and cases; MP3 players, power banks, SD cards and USB sticks; plug adapters, sat navs, USA SIM cards, replacement screens and batteries — pop in and pick up what you need.' },
      { title: 'Advice with no pressure', body: 'No jargon and no upsell. We lay out the options, you choose — and if we’re not the right answer, we’ll say so.' },
    ],
    contactTitle: 'Come in or call',
    contactLead: 'A phone, a plan, a repair, a trip — just ask. No obligation, and you’ll get a straight answer.',
    address: '421 Bury New Road, Salford M7 4ED (door left of Toy Zone, first floor up)',
    visitTitle: 'Visit the shop', directions: 'Get directions', hoursLabel: 'Open',
    callTitle: 'Call us', callBody: 'Whatever the question — you’ll get a straight answer.',
    emailTitle: 'Email us', emailBody: 'For anything that can wait for a written reply.',
    footExplore: 'Explore', footContact: 'Contact',
    footBlurb: 'Kosher phones, SIM plans, travel rentals, international numbers, Kol Torah audio and repairs — everything under one roof, explained properly.',
    rights: 'All rights reserved.', backTop: 'Back to top ↑',
  },
  he: {
    dir: 'rtl', langLabel: 'לשה״ק',
    brandName: 'כשר קונקט',
    brandTag: 'טלפונים כשרים • השכרות ונסיעות • תוכניות סים • קול תורה • תיקונים',
    nav: { services: 'שירותים', contact: 'יצירת קשר', account: 'החשבון שלי', signin: 'כניסה' },
    heroTitle: 'ברוכים הבאים לעולם הכשר',
    strap: 'משרתים את הקהילה החרדית — מנצ׳סטר',
    heroBody: 'טכנולוגיה כשרה ללא פשרות על איכות, יעילות ושירות. טלפונים, כרטיסי סים, נסיעות, תיקונים וקול תורה — הכל תחת קורת גג אחת, עם הסבר ברור לפני שמוציאים פרוטה.',
    quote: '„הטכנולוגיה צריכה לשרת את האדם — לא להפך.“',
    ctaServices: 'מה אנחנו עושים', ctaContact: 'שאלו אותנו',
    mini1: { t: 'תשובות ישרות', b: 'אנחנו ממליצים על מה שמתאים למשפחה ולכיס — גם כשזה לא הדבר היקר ביותר על המדף.' },
    mini2: { t: 'מוכנים לנסיעה', b: 'ארה״ב · קנדה · אירופה · ארץ ישראל — הטלפון והמספר עובדים עוד לפני ההמראה.' },
    proof: [
      { v: '£18 במקום £35', c: 'כך נראה חשבון סים חודשי טיפוסי אחרי שהתוכנית באמת מותאמת לשימוש' },
      { v: 'שבת ויום טוב', c: 'לעולם אינם מחויבים בהשכרה — בכל נסיעה, אוטומטית' },
      { v: 'באותו יום', c: 'השכרות, כרטיסי סים ומספרים בינלאומיים עובדים עוד לפני שיוצאים מהחנות' },
    ],
    servicesTitle: 'מה אנחנו עושים',
    services: [
      { title: 'נוסעים? אל תשלמו מחירי נדידה', body: 'שכרו טלפון כשר לנסיעה — קווים לארה״ב ולארץ ישראל מוכנים ביום היציאה. משלמים רק על הימים שבשימוש; שבת ויום טוב תמיד חינם.' },
      { title: 'טלפונים כשרים, מוגדרים כמו שצריך', body: 'מכשירים אמינים ובדוקים עם ההגדרה הכשרה המתאימה למשפחה — להשכרה או לקנייה, ויוצאים מהחנות עם טלפון שעובד.' },
      { title: 'תפסיקו לשלם יותר מדי על הסים', body: 'רוב האנשים על תוכנית לא נכונה. הביאו לנו את החשבון — נתאים את התוכנית לשימוש האמיתי, כולל דקות לחו״ל, והחשבון החודשי בדרך כלל יורד בחצי.' },
      { title: 'מספר מקומי למשפחה בחו״ל', body: 'מספר ישראלי או אמריקאי שמצלצל אצלכם במנצ׳סטר — המשפחה מחייגת מקומי, אתם עונים כאן. הפעלה באותו יום.' },
      { title: 'טיסות — מוזמנות ובהשגחה', body: 'אנחנו מזמינים את הכרטיסים ועוקבים אחרי הזמנים והשינויים, כך שהנסיעה מסודרת עוד לפני שאורזים.' },
      { title: 'קול תורה', body: 'שיעורים, מוזיקה וסיפורי ילדים — על דיסק או כקבצי שמע, מועברים לטלפון הכשר או לנגן עוד לפני שיוצאים מהחנות.' },
      { title: 'מסך שבור? תביאו אותו', body: 'מסכים, סוללות, בעיות טעינה — רוב התיקונים נגמרים מהר, ואם לא משתלם לתקן, נגיד ביושר.' },
      { title: 'אביזרים על המדף', body: 'מטענים, כבלים, כיסויים ודיסקים במלאי — נכנסים ולוקחים מה שצריך.' },
      { title: 'ייעוץ בלי לחץ', body: 'בלי מונחים טכניים ובלי דחיפה. אנחנו פורסים את האפשרויות, אתם בוחרים — ואם אנחנו לא הכתובת הנכונה, נגיד את זה.' },
    ],
    contactTitle: 'בואו או התקשרו',
    contactLead: 'טלפון, תוכנית, תיקון או נסיעה — שאלו. בלי התחייבות, ותקבלו תשובה ישרה.',
    address: '421 בורי ניו רואד (הכניסה משמאל ל־Toy Zone, קומה ראשונה)',
    visitTitle: 'בואו לחנות', directions: 'הוראות הגעה', hoursLabel: 'פתוח',
    callTitle: 'התקשרו', callBody: 'לא משנה מה השאלה — תקבלו תשובה ישרה.',
    emailTitle: 'כתבו לנו', emailBody: 'לכל דבר שיכול לחכות לתשובה בכתב.',
    footExplore: 'ניווט', footContact: 'יצירת קשר',
    footBlurb: 'טלפונים כשרים, תוכניות סים, השכרות לנסיעות, מספרים בינלאומיים, קול תורה ותיקונים — לקהילה החרדית, ממנצ׳סטר.',
    rights: 'כל הזכויות שמורות.', backTop: 'חזרה למעלה ↑',
  },
}

// LocalBusiness card for search engines — the honest basics only.
const LD_JSON = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'Kosher Connect',
  description: 'Kosher phones, SIM plans, travel phone rentals, international numbers, Kol Torah audio and repairs. Serving the Heimishe community.',
  telephone: '+441615311386',
  email: EMAIL,
  url: 'https://kosher-connect.com/welcome',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '421 Bury New Road, First Floor',
    addressLocality: 'Salford',
    addressRegion: 'Greater Manchester',
    postalCode: 'M7 4ED',
    addressCountry: 'GB',
  },
  openingHours: ['Su 14:00-18:30', 'Mo-Th 14:00-18:30'],
})

export default function Welcome() {
  const [lang, setLang] = useState('en')
  // Opening hours are owner-editable in the app's Settings; the page starts
  // with the current default and follows whatever the API says.
  const [hours, setHours] = useState('Sunday–Thursday, 2:00–6:30pm')
  useEffect(() => {
    try {
      const saved = localStorage.getItem('kcLang')
      if (saved && T[saved]) setLang(saved)
    } catch { /* default stays en */ }
    fetch('/api/public/info')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.openingHours) setHours(d.openingHours) })
      .catch(() => {})
  }, [])
  const pick = (l) => { setLang(l); try { localStorage.setItem('kcLang', l) } catch {} }
  const t = T[lang]

  useEffect(() => {
    const cards = document.querySelectorAll('.w-reveal:not(.w-show)')
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('w-show'); obs.unobserve(e.target) }
      })
    }, { threshold: 0.15 })
    cards.forEach((c) => obs.observe(c))
    return () => obs.disconnect()
  }, [lang])

  return (
    <>
      <Head>
        <title>Kosher Connect — Kosher phones, SIM plans, travel, repairs & international numbers</title>
        <meta name="description" content="Kosher Connect - Kosher phones, SIM plans, travel phones, repairs, and international numbers. Serving the Heimishe community from Manchester." />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Kosher Connect" />
        <meta property="og:title" content="Kosher Connect — Welcome to the Kosher World" />
        <meta property="og:description" content="Kosher phones, SIM plans, travel rentals, international numbers, Kol Torah audio and repairs — under one roof in Manchester." />
        <meta property="og:url" content="https://kosher-connect.com/welcome" />
        <meta property="og:image" content="https://kosher-connect.com/logo-full.png" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: LD_JSON }} />
      </Head>
      <div className="welcome-shell">
        <AuthBackdrop />
        <ThemeToggle style={{ position: 'fixed', top: 16, right: 16, zIndex: 10 }} />
        <div className="w-wrap" dir={t.dir} lang={lang === 'en' ? 'en' : lang}>
          <div className="w-topbar">
            <div className="w-brand">
              <img src="/logo-full.png" alt="Kosher Connect" />
              <div>
                <h1>{t.brandName}</h1>
                <p>{t.brandTag}</p>
              </div>
            </div>
            <nav className="w-pills" aria-label="Site">
              <div className="w-lang" role="group" aria-label="Language">
                {['en', 'he'].map((l) => (
                  <button key={l} type="button" lang={l === 'en' ? 'en' : l}
                    className={lang === l ? 'active' : ''} aria-pressed={lang === l}
                    onClick={() => pick(l)}>{T[l].langLabel}</button>
                ))}
              </div>
              <a href="#services" className="w-anchor">{t.nav.services}</a>
              <a href="#contact" className="w-anchor">{t.nav.contact}</a>
              <a href="/portal" className="w-pill-primary">{t.nav.account}</a>
              <a href="/login" className="w-staff">{t.nav.signin}</a>
            </nav>
          </div>

          <section className="w-hero" id="top">
            <div className="w-hero-inner">
              <div>
                <div className="w-strap">{t.strap}</div>
                <h2>{t.heroTitle}</h2>
                <p>{t.heroBody}</p>
                <div className="w-quote">{t.quote}</div>
                <div className="w-cta">
                  <a className="btn btn-primary" href="#services">{t.ctaServices}</a>
                  <a className="btn btn-outline" href="#contact">{t.ctaContact}</a>
                </div>
              </div>
              <div className="w-side">
                <div className="w-mini">
                  <span className="w-dot" style={{ background: 'var(--gold)' }} />
                  <div><b>{t.mini1.t}</b><span>{t.mini1.b}</span></div>
                </div>
                <div className="w-mini">
                  <span className="w-dot" style={{ background: 'var(--accent)' }} />
                  <div><b>{t.mini2.t}</b><span>{t.mini2.b}</span></div>
                </div>
              </div>
            </div>
          </section>

          {/* The proof strip — three concrete promises, stated as numbers, the
              way the shop actually talks. Every figure comes from the copy
              below; nothing invented for effect. */}
          <section className="w-proof" aria-label={t.servicesTitle}>
            {t.proof.map((p, i) => (
              <div className="w-proof-item" key={`${lang}-p${i}`}>
                <div className="w-proof-num">{p.v}</div>
                <div className="w-proof-cap">{p.c}</div>
              </div>
            ))}
          </section>

          <section className="w-section" id="services">
            <h3>{t.servicesTitle}</h3>
            <div className="w-grid">
              {t.services.map((s, i) => {
                const Icon = ICONS[i]
                return (
                  <div className="w-card w-reveal" key={`${lang}-${i}`}>
                    <div className="w-icon" aria-hidden="true"><Icon /></div>
                    <h4>{s.title}</h4>
                    <p>{s.body}</p>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="w-section" id="contact">
            <h3>{t.contactTitle}</h3>
            <p className="w-lead">{t.contactLead}</p>
            <div className="w-contact-grid">
              <div className="w-card w-show">
                <div className="w-icon" aria-hidden="true"><PinIcon /></div>
                <h4>{t.visitTitle}</h4>
                <p>{t.address}</p>
                <p className="w-hours"><strong>{t.hoursLabel}:</strong> {hours}</p>
                <a className="w-contact-link" href={MAPS_URL} target="_blank" rel="noopener noreferrer">{t.directions} ↗</a>
              </div>
              <div className="w-card w-show">
                <div className="w-icon" aria-hidden="true"><PhoneCallIcon /></div>
                <h4>{t.callTitle}</h4>
                <p>{t.callBody}</p>
                <a className="w-contact-link" href={PHONE_TEL} dir="ltr">{PHONE_SHOWN}</a>
              </div>
              <div className="w-card w-show">
                <div className="w-icon" aria-hidden="true"><MailIcon /></div>
                <h4>{t.emailTitle}</h4>
                <p>{t.emailBody}</p>
                <a className="w-contact-link" href={`mailto:${EMAIL}`} dir="ltr">{EMAIL}</a>
              </div>
            </div>
          </section>

          <footer className="w-footer2">
            <div className="w-footer-grid">
              <div>
                <div className="w-footer-brand">{t.brandName}</div>
                <p className="w-footer-blurb">{t.footBlurb}</p>
              </div>
              <nav aria-label={t.footExplore}>
                <h5>{t.footExplore}</h5>
                <a href="#services">{t.nav.services}</a>
                <a href="#contact">{t.nav.contact}</a>
                <a href="/portal">{t.nav.account}</a>
                <a href="/login">{t.nav.signin}</a>
              </nav>
              <div>
                <h5>{t.footContact}</h5>
                <p className="w-footer-line">{t.address}</p>
                <p className="w-footer-line">{t.hoursLabel}: {hours}</p>
                <a href={PHONE_TEL} dir="ltr">{PHONE_SHOWN}</a>
                <a href={`mailto:${EMAIL}`} dir="ltr">{EMAIL}</a>
              </div>
            </div>
            <div className="w-footer-bottom">
              <div>© {new Date().getFullYear()} {t.brandName}. {t.rights}</div>
              <div><a href="#top">{t.backTop}</a></div>
            </div>
          </footer>
        </div>
      </div>
    </>
  )
}
