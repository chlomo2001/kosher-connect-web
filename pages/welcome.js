import { useEffect, useState } from 'react'
import Head from 'next/head'
import ThemeToggle from '../components/ThemeToggle'
import { formatPhoneDisplay } from '../lib/ukPhone.mjs'
import {
  PlaneIcon, FlipPhoneIcon, SimIcon, GlobeIcon, TicketIcon, MusicIcon,
  WrenchIcon, BagIcon, ChatIcon, PhoneCallIcon, MailIcon, PinIcon,
} from '../components/kcIcons'

// The public face of Kosher Connect — telecom-first, Sky-style layout (bold
// hero, alternating feature bands, clean light/dark surfaces), driven by the
// owner's own bilingual copy so nothing in Hebrew is lost. Preserves the
// dynamic opening hours, JSON-LD SEO and the sign-in / portal / join links.
// Two languages: English and lashon hakodesh — same content, RTL flips with it.

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
    nav: { services: 'Services', contact: 'Contact', join: 'Join us', account: 'My account', signin: 'Staff sign in' },
    joinCta: 'New to Kosher Connect? Leave your details →',
    heroTitle: 'Welcome to the Kosher World',
    strap: 'Serving the Heimishe community — Manchester',
    heroBody: 'Kosher technology without compromise on quality, efficiency or service. Phones, SIMs, travel, repairs and Kol Torah audio — under one roof, and explained properly before you spend a penny.',
    quote: '“Technology should serve the people — not the other way around.”',
    ctaServices: 'See what we do', ctaContact: 'Ask us anything',
    proof: [
      { v: '£35 → £18', c: 'what a typical monthly SIM bill becomes once the plan actually matches the usage' },
      { v: 'Shabbos & Yom Tov', c: 'never charged on any rental — on every trip, automatically' },
      { v: 'Same day', c: 'SIMs and international numbers, set up before you leave the shop' },
    ],
    // The three headline products get their own feature band.
    bands: [
      {
        eyebrow: 'Mobile & SIM', title: 'Stop overpaying for your SIM',
        body: 'Most people are quietly on the wrong plan. Bring us your last bill and we’ll match the tariff to how you actually use your phone — international minutes included — and the monthly bill usually drops by half.',
        chips: ['Keep your number', 'Keep your phone', 'We do the switch for you'], cta: 'Bring us your bill',
      },
      {
        eyebrow: 'Travel phones', title: 'A kosher phone, sorted before you travel',
        body: 'Off to the USA, Canada, Europe or Eretz Yisroel? Rent a kosher phone, set up with you in the shop before you go — so there’s nothing to arrange at a foreign airport. You pay only for the days you use, and Shabbos and Yom Tov are never charged.',
        chips: ['Set up before you travel', 'Only pay for days used', 'Shabbos never charged'], cta: 'Plan your trip',
      },
      {
        eyebrow: 'International numbers', title: 'An Israeli or USA number that rings on your UK phone',
        body: 'Family in Israel? Business in the States? Get a local number that rings straight through to the phone already in your pocket — no second handset, and no roaming charges for the people calling you.',
        chips: ['Rings on your own phone', 'Israeli or USA number', 'No roaming for callers'], cta: 'Get your number',
      },
    ],
    moreTitle: 'More at Kosher Connect',
    moreLead: 'One shop for the phone and everything around it — so you’re not sent from place to place.',
    more: [
      { title: 'Kosher phones, properly set up', body: 'Reliable, tested handsets with the right kosher setup for your family — rent or buy, and walk out with it working.' },
      { title: 'Flights, booked and watched', body: 'We book the tickets and keep an eye on times and changes, so the trip is sorted before you start packing.' },
      { title: 'Kol Torah audio', body: 'Shiurim, music and children’s stories — on CD or as audio files, loaded onto your kosher phone or player while you wait.' },
      { title: 'Smashed screen? Bring it in', body: 'Screens, batteries, charging trouble — most repairs are done quickly, and we’ll tell you honestly if it isn’t worth fixing.' },
      { title: 'Accessories on the shelf', body: 'Chargers, cables and cases; MP3 players, power banks, SD cards and USB sticks; plug adapters, sat navs, USA SIM cards, replacement screens and batteries.' },
      { title: 'Advice with no pressure', body: 'No jargon and no upsell. We recommend what fits your family and your pocket — even when it isn’t the dearest thing on the shelf.' },
    ],
    phoneGuideCta: 'Choosing a handset? See the phone guide →',
    storyTitle: 'Why Kosher Connect exists',
    story1: 'It started with watching people overpay — badly. Good families tied into multi-year SIM contracts through reseller companies, where every minute past the allowance cost a small fortune. That needed an end.',
    story2: 'So it began with guiding friends straight to the network that actually fit them — no contract, no company in the middle, no catch. From there it grew into everything the community needs from kosher technology: phones, travel, numbers, Kol Torah audio and repairs — under one roof, explained straight.',
    contactTitle: 'Come in, call or email',
    contactLead: 'A phone, a plan, a repair, a trip — just ask. No obligation, and you’ll get a straight answer.',
    address: '421 Bury New Road, Salford M7 4ED — the door left of Toy Zone (MMR Group sign), ring bell 5, one floor up',
    visitTitle: 'Visit the shop', directions: 'Get directions', hoursLabel: 'Open',
    callTitle: 'Call us', callBody: 'Whatever the question — you’ll get a straight answer.',
    emailTitle: 'Email us', emailBody: 'For anything that can wait for a written reply.',
    footExplore: 'Explore', footContact: 'Contact',
    footBlurb: 'Kosher phones, SIM plans, travel rentals, international numbers, Kol Torah audio and repairs — everything under one roof, explained properly.',
    rights: 'All rights reserved.', backTop: 'Back to top ↑',
    tradingName: 'Kosher Connect is a trading name of Hatzluche Ltd.',
  },
  he: {
    dir: 'rtl', langLabel: 'HE',
    brandName: 'כשר קונקט',
    brandTag: 'טלפונים כשרים • השכרות ונסיעות • תוכניות סים • קול תורה • תיקונים',
    nav: { services: 'שירותים', contact: 'יצירת קשר', join: 'הצטרפות', account: 'החשבון שלי', signin: 'כניסת צוות' },
    joinCta: 'חדשים אצלנו? השאירו פרטים ←',
    heroTitle: 'ברוכים הבאים לעולם הכשר',
    strap: 'לשירות הקהילה החרדית — מנצ׳סטר והסביבה',
    heroBody: 'טכנולוגיה כשרה בלי פשרות — לא באיכות, לא בשירות ולא במחיר. טלפונים כשרים, כרטיסי סים, השכרות לנסיעות, מספרים בינלאומיים, קול תורה ותיקונים — הכול תחת קורת גג אחת, מוסבר בסבלנות לפני שמוציאים פרוטה.',
    quote: '„הטכנולוגיה צריכה לשמש את האדם — ולא האדם את הטכנולוגיה.“',
    ctaServices: 'מה תמצאו אצלנו', ctaContact: 'דברו איתנו',
    proof: [
      { v: '£18 במקום £35', c: 'כך נראה חשבון סים חודשי אצל רוב הלקוחות, ברגע שהתוכנית באמת מותאמת לשימוש' },
      { v: 'שבת ויום טוב', c: 'אף פעם לא בחשבון — בכל השכרה ובכל נסיעה, באופן אוטומטי' },
      { v: 'עוד באותו יום', c: 'כרטיסי סים ומספרים בינלאומיים — פועלים לפני שיצאתם מהחנות' },
    ],
    bands: [
      {
        eyebrow: 'סים וטלפון', title: 'די לשלם יותר מדי על הסים',
        body: 'רוב האנשים מחזיקים תוכנית שלא מתאימה להם. הביאו את החשבון האחרון — נתאים את התוכנית לשימוש האמיתי, כולל דקות לחו״ל, ובדרך כלל החשבון החודשי יורד בחצי.',
        chips: ['שומרים על המספר', 'שומרים על הטלפון', 'אנחנו מבצעים את המעבר'], cta: 'הביאו את החשבון',
      },
      {
        eyebrow: 'טלפונים לנסיעות', title: 'טלפון כשר, מסודר עוד לפני הנסיעה',
        body: 'נוסעים לארה״ב, קנדה, אירופה או ארץ ישראל? טלפון כשר מושכר, מוגדר אתכם בחנות עוד לפני היציאה — כך שאין מה לסדר בשדה תעופה זר. משלמים רק על ימי השימוש, ושבת ויום טוב תמיד חינם.',
        chips: ['מסודר לפני הנסיעה', 'תשלום רק על ימי שימוש', 'שבת תמיד חינם'], cta: 'לתכנון הנסיעה',
      },
      {
        eyebrow: 'מספרים בינלאומיים', title: 'מספר ישראלי או אמריקאי שמצלצל בטלפון שלכם',
        body: 'משפחה בישראל? עסקים בארה״ב? מספר מקומי שמצלצל ישירות אל הטלפון שכבר בכיס שלכם — בלי מכשיר שני, ובלי חיובי נדידה למי שמתקשר אליכם.',
        chips: ['מצלצל בטלפון שלכם', 'מספר ישראלי או אמריקאי', 'בלי נדידה למתקשרים'], cta: 'קבלו מספר',
      },
    ],
    moreTitle: 'עוד בכשר קונקט',
    moreLead: 'חנות אחת לטלפון ולכל מה שסביבו — כדי שלא ישלחו אתכם ממקום למקום.',
    more: [
      { title: 'טלפונים כשרים, מסודרים כמו שצריך', body: 'מכשירים אמינים ובדוקים, עם ההגדרות הכשרות המתאימות לכל משפחה — לקנייה או להשכרה. יוצאים עם טלפון שעובד.' },
      { title: 'טיסות — מוזמנות ותחת השגחה', body: 'אנחנו מזמינים את הכרטיסים ושומרים עין על הזמנים ועל השינויים, כך שהנסיעה מסודרת הרבה לפני שמתחילים לארוז.' },
      { title: 'קול תורה', body: 'שיעורים, ניגונים וסיפורי ילדים — על דיסק או כקבצי שמע, מועברים לטלפון הכשר או לנגן בזמן שאתם מחכים.' },
      { title: 'המסך נשבר? תביאו אותו', body: 'מסכים, סוללות, בעיות טעינה — רוב התיקונים מסתיימים מהר. ואם לא משתלם לתקן — נאמר לכם ביושר.' },
      { title: 'אביזרים על המדף', body: 'מטענים, כבלים וכיסויים; נגני MP3, סוללות ניידות, כרטיסי זיכרון והחסני USB; מתאמי חשמל, מכשירי ניווט, כרטיסי סים לארה״ב, מסכים וסוללות.' },
      { title: 'ייעוץ בלי שום לחץ', body: 'בלי מונחים מסובכים ובלי מכירה בכוח. ממליצים רק על מה שבאמת מתאים למשפחה ולכיס — גם כשזה לא הפריט היקר ביותר.' },
    ],
    phoneGuideCta: 'בוחרים מכשיר? למדריך הטלפונים ←',
    storyTitle: 'למה קיים כשר קונקט',
    story1: 'הכול התחיל מלראות אנשים משלמים הרבה יותר מדי. משפחות טובות כבולות בחוזי סים לשנים דרך חברות מתווכות, כשכל דקה מעבר למכסה עולה הון קטן. לזה היה צריך לשים סוף.',
    story2: 'אז זה התחיל בלכוון חברים ישירות לרשת שבאמת מתאימה להם — בלי חוזה, בלי חברה באמצע ובלי אותיות קטנות. ומשם זה צמח לכל מה שהקהילה צריכה מטכנולוגיה כשרה: טלפונים, נסיעות, מספרים, קול תורה ותיקונים — תחת קורת גג אחת.',
    contactTitle: 'בואו, התקשרו, כתבו',
    contactLead: 'טלפון, תוכנית, תיקון או נסיעה — כל שאלה מתקבלת בסבר פנים יפות. בלי שום התחייבות, ועם תשובה ישרה.',
    address: '421 בורי ניו רואד, סלפורד M7 4ED — הדלת משמאל ל־Toy Zone (שלט MMR Group), לצלצל בפעמון 5, קומה ראשונה',
    visitTitle: 'בואו לחנות', directions: 'הוראות הגעה', hoursLabel: 'שעות פתיחה',
    callTitle: 'התקשרו אלינו', callBody: 'כל שאלה שהיא — ותצאו עם תשובה ברורה.',
    emailTitle: 'כתבו לנו', emailBody: 'לכל דבר שיכול להמתין לתשובה מסודרת בכתב.',
    footExplore: 'ניווט מהיר', footContact: 'יצירת קשר',
    footBlurb: 'טלפונים כשרים, תוכניות סים, השכרות לנסיעות, מספרים בינלאומיים, קול תורה ותיקונים — הכול תחת קורת גג אחת.',
    rights: 'כל הזכויות שמורות.', backTop: 'חזרה למעלה ↑',
    tradingName: 'כשר קונקט הוא שם מסחרי של Hatzluche Ltd.',
  },
}

const LD_JSON = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'Kosher Connect',
  legalName: 'Hatzluche Ltd',
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
  const [hours, setHours] = useState('Sunday–Thursday, 2:00–6:30pm')
  useEffect(() => {
    try { const saved = localStorage.getItem('kcLang'); if (saved && T[saved]) setLang(saved) } catch {}
    fetch('/api/public/info')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.openingHours) setHours(d.openingHours) })
      .catch(() => {})
  }, [])
  const pick = (l) => { setLang(l); try { localStorage.setItem('kcLang', l) } catch {} }
  const t = T[lang]

  useEffect(() => {
    const els = document.querySelectorAll('.sk-reveal:not(.in)')
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target) } })
    }, { threshold: 0.12 })
    els.forEach((c) => obs.observe(c))
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
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: LD_JSON }} />
      </Head>
      <style dangerouslySetInnerHTML={{ __html: SKY_CSS }} />
      <ThemeToggle style={{ position: 'fixed', top: 14, insetInlineEnd: 14, zIndex: 60 }} />

      <div className="sk" dir={t.dir} lang={lang === 'en' ? 'en' : lang}>
        <header className="sk-nav-wrap">
          <div className="sk-wrap sk-nav">
            <a className="sk-brand" href="#top">
              <img className="sk-logo" src="/logo-full.png" alt="Kosher Connect" />
            </a>
            <nav className="sk-nav-links" aria-label="Site">
              <a href="#services" className="sk-navlink">{t.nav.services}</a>
              <a href="#contact" className="sk-navlink">{t.nav.contact}</a>
              <div className="sk-lang" role="group" aria-label="Language">
                {['en', 'he'].map((l) => (
                  <button key={l} type="button" lang={l === 'en' ? 'en' : l}
                    className={lang === l ? 'on' : ''} aria-pressed={lang === l}
                    onClick={() => pick(l)}>{T[l].langLabel}</button>
                ))}
              </div>
              <a href="/portal" className="sk-btn sk-btn-sky sk-btn-sm">{t.nav.account}</a>
              <a href="/login" className="sk-staff">{t.nav.signin}</a>
            </nav>
          </div>
        </header>

        <section className="sk-hero" id="top">
          <div className="sk-wrap">
            <span className="sk-eyebrow">{t.strap}</span>
            <h1>{t.heroTitle}</h1>
            <p className="sk-hero-body">{t.heroBody}</p>
            <div className="sk-quote">{t.quote}</div>
            <div className="sk-hero-cta">
              <a className="sk-btn sk-btn-sky sk-btn-lg" href="#services">{t.ctaServices}</a>
              <a className="sk-btn sk-btn-ghost sk-btn-lg" href="#contact">{t.ctaContact}</a>
            </div>
            <div className="sk-proof">
              {t.proof.map((p, i) => (
                <div className="sk-proof-item" key={`${lang}-p${i}`}>
                  <div className="sk-proof-num">{p.v}</div>
                  <div className="sk-proof-cap">{p.c}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div id="services" />
        {t.bands.map((b, i) => (
          <section className={`sk-band ${i % 2 ? 'sk-flip' : ''}`} key={`${lang}-b${i}`}>
            <div className="sk-wrap sk-band-inner">
              <div className="sk-band-copy sk-reveal">
                <span className="sk-eyebrow">{b.eyebrow}</span>
                <h2>{b.title}</h2>
                <p>{b.body}</p>
                <div className="sk-chips">{b.chips.map((c, j) => <span key={j}>✓ {c}</span>)}</div>
                <a className="sk-btn sk-btn-sky sk-btn-lg" href="#contact">{b.cta}</a>
              </div>
              <div className="sk-band-art sk-reveal" aria-hidden="true">
                <svg viewBox="0 0 320 256"><defs><radialGradient id={`orb${i}`} cx="40%" cy="32%" r="75%">
                  <stop offset="0%" stopColor="#5cb4e8" /><stop offset="55%" stopColor="#0a5c93" /><stop offset="100%" stopColor="#0a2f5e" />
                </radialGradient></defs>
                  <ellipse cx="160" cy="128" rx="108" ry="48" fill="none" stroke="#c19161" strokeWidth="1.6" opacity=".5" transform={`rotate(${i % 2 ? 18 : -18} 160 128)`} />
                  <circle cx="160" cy="128" r="72" fill={`url(#orb${i})`} />
                  <circle cx="160" cy="128" r="72" fill="none" stroke="#8fd0ff" strokeWidth="1.4" opacity=".22" />
                  <circle cx="238" cy="86" r="5" fill="#c19161" />
                </svg>
              </div>
            </div>
          </section>
        ))}

        <section className="sk-also">
          <div className="sk-wrap">
            <h2 className="sk-reveal">{t.moreTitle}</h2>
            <p className="sk-also-lead sk-reveal">{t.moreLead}</p>
            <div className="sk-grid">
              {t.more.map((m, i) => {
                const Icon = ICONS[(i + 3) % ICONS.length]
                return (
                  <div className="sk-tile sk-reveal" key={`${lang}-m${i}`}>
                    <div className="sk-tile-ico" aria-hidden="true"><Icon /></div>
                    <h4>{m.title}</h4>
                    <p>{m.body}</p>
                  </div>
                )
              })}
            </div>
            <p className="sk-guide"><a href="/phone-guide">{t.phoneGuideCta}</a></p>
          </div>
        </section>

        <section className="sk-story">
          <div className="sk-wrap sk-reveal">
            <span className="sk-eyebrow">{t.storyTitle}</span>
            <div className="sk-story-panel">
              <p>{t.story1}</p>
              <p>{t.story2}</p>
            </div>
          </div>
        </section>

        <section className="sk-visit" id="contact">
          <div className="sk-wrap">
            <h2 className="sk-reveal">{t.contactTitle}</h2>
            <p className="sk-also-lead sk-reveal">{t.contactLead} <a className="sk-join" href="/join">{t.joinCta}</a></p>
            <div className="sk-grid sk-grid-3">
              <div className="sk-tile sk-reveal">
                <div className="sk-tile-ico" aria-hidden="true"><PinIcon /></div>
                <h4>{t.visitTitle}</h4>
                <p>{t.address}</p>
                <p className="sk-hours"><strong>{t.hoursLabel}:</strong> {hours}</p>
                <a className="sk-tilelink" href={MAPS_URL} target="_blank" rel="noopener noreferrer">{t.directions} ↗</a>
              </div>
              <div className="sk-tile sk-reveal">
                <div className="sk-tile-ico" aria-hidden="true"><PhoneCallIcon /></div>
                <h4>{t.callTitle}</h4>
                <p>{t.callBody}</p>
                <a className="sk-tilelink" href={PHONE_TEL} dir="ltr">{PHONE_SHOWN}</a>
              </div>
              <div className="sk-tile sk-reveal">
                <div className="sk-tile-ico" aria-hidden="true"><MailIcon /></div>
                <h4>{t.emailTitle}</h4>
                <p>{t.emailBody}</p>
                <a className="sk-tilelink" href={`mailto:${EMAIL}`} dir="ltr">{EMAIL}</a>
              </div>
            </div>
          </div>
        </section>

        <footer className="sk-foot">
          <div className="sk-wrap">
            <div className="sk-foot-top">
              <img className="sk-logo sk-foot-logo" src="/logo-full.png" alt="Kosher Connect" />
              <nav className="sk-foot-links" aria-label="Footer">
                <a href="#services">{t.nav.services}</a>
                <a href="#contact">{t.nav.contact}</a>
                <a href="/join">{t.nav.join}</a>
                <a href="/portal">{t.nav.account}</a>
                <a href="/login">{t.nav.signin}</a>
                <a href="/privacy">Privacy</a>
                <a href="/terms">Terms</a>
                <a href="/refund">Refunds</a>
              </nav>
            </div>
            <p className="sk-foot-legal">
              © {new Date().getFullYear()} {t.brandName}. {t.rights} {t.tradingName}<br />
              421 Bury New Road, Salford M7 4ED · <a href={PHONE_TEL} dir="ltr">{PHONE_SHOWN}</a> · <a href={`mailto:${EMAIL}`} dir="ltr">{EMAIL}</a>
            </p>
          </div>
        </footer>
      </div>
    </>
  )
}

const SKY_CSS = `
  :root{
    --sk-ink:#0d1526; --sk-sky:#07639e; --sk-sky-bright:#2f95d8; --sk-gold:#c19161;
    --sk-text:#0d1526; --sk-muted:#566079; --sk-line:#dbe3f0;
    --sk-paper:#ffffff; --sk-canvas:#f4f7fc; --sk-band:#ffffff; --sk-band-alt:#f4f7fc;
    --sk-maxw:1180px;
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
  html,body{height:auto;overflow-x:hidden;overflow-y:auto}
  #__next{display:block;height:auto;overflow:visible}
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
  .sk-nav-wrap{position:sticky;top:0;z-index:50;background:color-mix(in srgb,var(--sk-paper) 86%,transparent);
    backdrop-filter:saturate(150%) blur(12px);border-bottom:1px solid var(--sk-line)}
  .sk-nav{display:flex;align-items:center;justify-content:space-between;height:64px;gap:16px}
  .sk-logo{height:30px;width:auto;display:block}
  :root[data-theme="dark"] .sk-logo{filter:brightness(0) invert(1)}
  @media (prefers-color-scheme:dark){:root:not([data-theme]) .sk-logo{filter:brightness(0) invert(1)}}
  .sk-nav-links{display:flex;align-items:center;gap:18px}
  .sk-navlink{color:var(--sk-muted);font-weight:600;font-size:14.5px}
  .sk-navlink:hover{color:var(--sk-text)}
  .sk-lang{display:inline-flex;border:1px solid var(--sk-line);border-radius:999px;overflow:hidden}
  .sk-lang button{border:0;background:transparent;color:var(--sk-muted);font-weight:700;font-size:12.5px;
    padding:5px 11px;cursor:pointer}
  .sk-lang button.on{background:var(--sk-sky);color:#fff}
  .sk-staff{color:var(--sk-muted);font-size:13.5px;font-weight:600}
  .sk-staff:hover{color:var(--sk-text)}

  /* buttons */
  .sk-btn{display:inline-flex;align-items:center;justify-content:center;font-weight:700;
    border-radius:999px;cursor:pointer;transition:transform .12s ease,filter .12s ease;white-space:nowrap}
  .sk-btn:hover{transform:translateY(-1px)}
  .sk-btn-sky{background:var(--sk-sky);color:#fff}
  .sk-btn-sky:hover{filter:brightness(1.06)}
  .sk-btn-ghost{background:transparent;color:var(--sk-sky);border:1.5px solid var(--sk-sky)}
  :root[data-theme="dark"] .sk-btn-ghost{color:var(--sk-sky-bright);border-color:var(--sk-sky-bright)}
  .sk-btn-sm{padding:8px 16px;font-size:14px}
  .sk-btn-lg{padding:13px 26px;font-size:15.5px}

  /* hero */
  .sk-hero{background:linear-gradient(180deg,var(--sk-canvas),var(--sk-paper));padding:74px 0 58px;text-align:center;
    border-bottom:1px solid var(--sk-line)}
  .sk-hero h1{font-size:clamp(34px,6vw,60px);margin:0 auto;max-width:14ch}
  .sk-hero-body{color:var(--sk-muted);max-width:60ch;margin:20px auto 0;font-size:clamp(16px,2.2vw,19px)}
  .sk-quote{color:var(--sk-gold);font-style:italic;margin:18px auto 0;max-width:52ch}
  .sk-hero-cta{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:28px}
  .sk-proof{display:flex;gap:18px;flex-wrap:wrap;justify-content:center;margin-top:44px}
  .sk-proof-item{flex:1 1 240px;max-width:320px;background:var(--sk-band);border:1px solid var(--sk-line);
    border-radius:16px;padding:20px 18px;text-align:center}
  .sk-proof-num{font-family:var(--sk-fdisp);font-weight:800;font-size:22px;color:var(--sk-sky);letter-spacing:-.02em}
  :root[data-theme="dark"] .sk-proof-num{color:var(--sk-sky-bright)}
  .sk-proof-cap{color:var(--sk-muted);font-size:14px;margin-top:8px;line-height:1.5}

  /* feature bands */
  .sk-band{padding:64px 0;border-bottom:1px solid var(--sk-line)}
  .sk-band:nth-child(odd){background:var(--sk-band-alt)}
  .sk-band-inner{display:grid;grid-template-columns:1.05fr .95fr;gap:44px;align-items:center}
  .sk-flip .sk-band-copy{order:2}
  .sk-band-copy h2{font-size:clamp(26px,4vw,38px);margin:0 0 14px}
  .sk-band-copy p{color:var(--sk-muted);margin:0 0 18px}
  .sk-chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 22px}
  .sk-chips span{background:var(--sk-band);border:1px solid var(--sk-line);border-radius:999px;
    padding:7px 13px;font-size:13.5px;font-weight:600;color:var(--sk-text)}
  .sk-band-art{display:flex;justify-content:center}
  .sk-band-art svg{width:min(100%,360px);height:auto}

  /* also grid */
  .sk-also{padding:64px 0;background:var(--sk-band)}
  .sk-also h2{font-size:clamp(24px,3.6vw,34px);text-align:center}
  .sk-also-lead{color:var(--sk-muted);text-align:center;max-width:60ch;margin:12px auto 34px}
  .sk-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
  .sk-grid-3{grid-template-columns:repeat(3,1fr)}
  .sk-tile{background:var(--sk-band-alt);border:1px solid var(--sk-line);border-radius:16px;padding:22px}
  .sk-tile-ico{width:40px;height:40px;color:var(--sk-sky);margin-bottom:12px}
  :root[data-theme="dark"] .sk-tile-ico{color:var(--sk-sky-bright)}
  .sk-tile-ico svg{width:100%;height:100%}
  .sk-tile h4{font-size:18px;margin:0 0 8px}
  .sk-tile p{color:var(--sk-muted);font-size:14.5px;margin:0}
  .sk-tilelink{display:inline-block;margin-top:12px;color:var(--sk-sky);font-weight:700;font-size:14px}
  :root[data-theme="dark"] .sk-tilelink{color:var(--sk-sky-bright)}
  .sk-guide{text-align:center;margin-top:28px}
  .sk-guide a{color:var(--sk-sky);font-weight:700}
  :root[data-theme="dark"] .sk-guide a{color:var(--sk-sky-bright)}

  /* story */
  .sk-story{padding:60px 0;background:var(--sk-band-alt)}
  .sk-story-panel{background:var(--sk-band);border:1px solid var(--sk-line);border-inline-start:4px solid var(--sk-gold);
    border-radius:16px;padding:28px 30px;max-width:820px}
  .sk-story-panel p{color:var(--sk-muted);margin:0 0 14px}
  .sk-story-panel p:last-child{margin:0}

  /* visit */
  .sk-visit{padding:64px 0;background:var(--sk-band)}
  .sk-visit h2{font-size:clamp(24px,3.6vw,34px);text-align:center}
  .sk-join{color:var(--sk-sky);font-weight:700;white-space:nowrap}
  :root[data-theme="dark"] .sk-join{color:var(--sk-sky-bright)}
  .sk-hours{font-size:14px;color:var(--sk-muted);margin:10px 0 0}

  /* footer */
  .sk-foot{background:var(--sk-band-alt);border-top:1px solid var(--sk-line);padding:44px 0 40px}
  .sk-foot-top{display:flex;flex-wrap:wrap;gap:22px;justify-content:space-between;align-items:center}
  .sk-foot-logo{height:34px}
  .sk-foot-links{display:flex;gap:18px;flex-wrap:wrap}
  .sk-foot-links a{color:var(--sk-muted);font-size:14px}
  .sk-foot-links a:hover{color:var(--sk-text)}
  .sk-foot-legal{color:var(--sk-muted);font-size:13px;margin:22px 0 0;line-height:1.7}
  .sk-foot-legal a{color:var(--sk-muted)}
  .sk-foot-legal a:hover{color:var(--sk-text)}

  /* reveal */
  .sk-reveal{opacity:0;transform:translateY(16px);transition:opacity .6s ease,transform .6s ease}
  .sk-reveal.in{opacity:1;transform:none}
  @media (prefers-reduced-motion:reduce){.sk-reveal{opacity:1;transform:none;transition:none}}

  @media (max-width:820px){
    .sk-band-inner{grid-template-columns:1fr;gap:22px}
    .sk-flip .sk-band-copy{order:0}
    .sk-band-art{order:-1}
    .sk-grid,.sk-grid-3{grid-template-columns:1fr}
    .sk-navlink{display:none}
  }
`
