import { useEffect, useState } from 'react'
import Head from 'next/head'
import ThemeToggle from '../components/ThemeToggle'
import AuthBackdrop from '../components/AuthBackdrop'

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

const FlipPhoneIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
    <rect x="7" y="1.5" width="10" height="9" rx="2" />
    <rect x="9.2" y="3.4" width="5.6" height="4.4" rx="0.8" />
    <line x1="6.2" y1="11.9" x2="17.8" y2="11.9" />
    <rect x="7" y="13.3" width="10" height="9.2" rx="2" />
    {[15.7, 17.8, 19.9].map((cy) =>
      [9.7, 12, 14.3].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="0.62" fill="currentColor" stroke="none" />)
    )}
  </svg>
)

const ICONS = ['✈️', <FlipPhoneIcon key="flip" />, '📶', '🌍', '🎟️', '🎵', '🛠️', '🛍️', '✅']

const T = {
  en: {
    dir: 'ltr', langLabel: 'EN',
    brandName: 'Kosher Connect',
    brandTag: 'Kosher Phones • Rentals & Travel • SIM Plans • Kol Torah Audio • Repairs',
    nav: { services: 'Services', contact: 'Contact', account: 'My account', signin: 'Sign in' },
    heroTitle: 'Welcome to the Kosher World',
    strap: 'Serving the Heimishe community — Manchester',
    heroBody: 'Kosher technology without compromise on quality, efficiency or service. Phones, SIMs, travel, repairs and Kol Torah audio — under one roof, and explained properly before you spend a penny.',
    quote: '“Technology should serve the people — not the other way around.”',
    ctaServices: 'See what we do', ctaContact: 'Ask us anything',
    mini1: { t: 'Straight answers', b: 'We recommend what fits your family and your pocket — even when it isn’t the dearest thing on the shelf.' },
    mini2: { t: 'Travel ready', b: 'USA · Canada · EU · Israel — phone and number working before you board.' },
    servicesTitle: 'What we do',
    services: [
      { title: 'Travelling? Don’t pay roaming prices', body: 'Rent a kosher phone for the trip — USA and Israel lines ready the day you leave. You pay only for the days you use; Shabbos and Yom Tov are always free.' },
      { title: 'Kosher phones, properly set up', body: 'Reliable, tested handsets with the right kosher setup for your family — rent or buy, and walk out with it working.' },
      { title: 'Stop overpaying for your SIM', body: 'Most people are on the wrong plan. Bring us your bill — £35 a month often turns into £18 for the same usage, international minutes included.' },
      { title: 'A local number for family abroad', body: 'An Israeli or USA number that rings on your phone in Manchester — the family dials local, you answer here. Set up the same day.' },
      { title: 'Flights, booked and watched', body: 'We book the tickets and keep an eye on times and changes, so the trip is sorted before you start packing.' },
      { title: 'Kol Torah audio', body: 'Shiurim, music and children’s stories — on CD or as audio files, loaded onto your kosher phone or player before you leave the shop.' },
      { title: 'Smashed screen? Bring it in', body: 'Screens, batteries, charging trouble — most repairs are done quickly, and we’ll tell you honestly if it isn’t worth fixing.' },
      { title: 'Accessories on the shelf', body: 'Chargers, cables, cases and CDs in stock — pop in and pick up what you need.' },
      { title: 'Advice with no pressure', body: 'No jargon and no upsell. We lay out the options, you choose — and if we’re not the right answer, we’ll say so.' },
    ],
    contactTitle: 'Come in or call',
    contactLead: 'A phone, a plan, a repair, a trip — just ask. No obligation, and you’ll get a straight answer.',
    address: '421 Bury New Road (door left of Toy Zone, first floor up)',
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
    servicesTitle: 'מה אנחנו עושים',
    services: [
      { title: 'נוסעים? אל תשלמו מחירי נדידה', body: 'שכרו טלפון כשר לנסיעה — קווים לארה״ב ולארץ ישראל מוכנים ביום היציאה. משלמים רק על הימים שבשימוש; שבת ויום טוב תמיד חינם.' },
      { title: 'טלפונים כשרים, מוגדרים כמו שצריך', body: 'מכשירים אמינים ובדוקים עם ההגדרה הכשרה המתאימה למשפחה — להשכרה או לקנייה, ויוצאים מהחנות עם טלפון שעובד.' },
      { title: 'תפסיקו לשלם יותר מדי על הסים', body: 'רוב האנשים על תוכנית לא נכונה. הביאו לנו את החשבון — £35 לחודש הופכים לא פעם ל־£18 על אותו שימוש, כולל דקות לחו״ל.' },
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
    rights: 'כל הזכויות שמורות.', backTop: 'חזרה למעלה ↑',
  },
}

export default function Welcome() {
  const [lang, setLang] = useState('en')
  useEffect(() => {
    try {
      const saved = localStorage.getItem('kcLang')
      if (saved && T[saved]) setLang(saved)
    } catch { /* default stays en */ }
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
              <a href="#services">{t.nav.services}</a>
              <a href="#contact">{t.nav.contact}</a>
              <a href="/portal">{t.nav.account}</a>
              <a href="/login" className="w-pill-primary">{t.nav.signin}</a>
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
                  <span className="w-dot" style={{ background: 'var(--success)' }} />
                  <div><b>{t.mini1.t}</b><span>{t.mini1.b}</span></div>
                </div>
                <div className="w-mini">
                  <span className="w-dot" style={{ background: 'var(--accent)' }} />
                  <div><b>{t.mini2.t}</b><span>{t.mini2.b}</span></div>
                </div>
              </div>
            </div>
          </section>

          <section className="w-section" id="services">
            <h3>{t.servicesTitle}</h3>
            <div className="w-grid">
              {t.services.map((s, i) => (
                <div className="w-card w-reveal" key={`${lang}-${i}`}>
                  <div className="w-icon" aria-hidden="true">{ICONS[i]}</div>
                  <h4>{s.title}</h4>
                  <p>{s.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="w-section" id="contact">
            <h3>{t.contactTitle}</h3>
            <div className="w-card w-show">
              <p style={{ marginBottom: 10 }}>{t.contactLead}</p>
              <p style={{ margin: '0 0 6px' }}>📍 {t.address}</p>
              <p style={{ margin: '0 0 6px' }}>📞 <a href="tel:01615311386" dir="ltr"><b>0161 531 1386</b></a></p>
              <p style={{ margin: 0 }}>✉️ <a href="mailto:admin@kosher-connect.com" dir="ltr"><b>admin@kosher-connect.com</b></a></p>
            </div>
          </section>

          <footer className="w-footer">
            <div>© {new Date().getFullYear()} {t.brandName}. {t.rights}</div>
            <div><a href="#top">{t.backTop}</a></div>
          </footer>
        </div>
      </div>
    </>
  )
}
