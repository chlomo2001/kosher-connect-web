import { useEffect, useState } from 'react'
import Head from 'next/head'
import ThemeToggle from '../components/ThemeToggle'
import {
  PlaneIcon, FlipPhoneIcon, SimIcon, GlobeIcon, TicketIcon, MusicIcon,
  WrenchIcon, BagIcon, ChatIcon, PhoneCallIcon, MailIcon, PinIcon,
} from '../components/kcIcons'

// The public face of Kosher Connect — the bold, telecom-first Sky layout from
// the approved artifact: dark punchy hero, product-category nav, alternating
// feature bands with real concept illustrations, then More / Our story /
// Contact. Bilingual (English + lashon hakodesh, RTL flips with it) with the
// dynamic opening hours, JSON-LD SEO and the sign-in / portal / join links kept.

const ICONS = [PlaneIcon, FlipPhoneIcon, SimIcon, GlobeIcon, TicketIcon, MusicIcon, WrenchIcon, BagIcon, ChatIcon]

const PHONE_TEL = 'tel:+441615311386'
// Shown in the shop's own local form (the community dials 0161…); the tel: link
// stays fully qualified so it dials correctly from any device.
const PHONE_SHOWN = '0161 531 1386'
const EMAIL = 'admin@kosher-connect.com'
const MAPS_URL = 'https://maps.google.com/?q=421+Bury+New+Road,+Salford+M7+4ED'

const BAND_IDS = ['mobile', 'travel', 'intl']

const T = {
  en: {
    dir: 'ltr', langLabel: 'EN',
    brandName: 'Kosher Connect',
    nav: { mobile: 'Mobile & SIM', travel: 'Travel phones', intl: 'International numbers', repairs: 'Repairs & more', visit: 'Visit us', message: 'Message us', account: 'My account', signin: 'Staff sign in', join: 'Join us' },
    joinCta: 'New to Kosher Connect? Leave your details →',
    heroEyebrow: 'Kosher Connect · Salford, Manchester',
    heroTitle: 'Your phone bill, halved.',
    heroBody: 'Most people are quietly on the wrong SIM. Bring us your last bill and we’ll match a plan to how you actually use your phone — same coverage, same number, far less money.',
    heroPill: 'Same network · same number · far less every month',
    ctaMessage: 'Message us', ctaCall: 'Call',
    heroSub: 'And whatever else a phone needs — travel phones, international numbers, repairs and Kol Torah audio — it’s all under one roof.',
    proof: [
      { v: '£35 → £18', c: 'what a typical monthly SIM bill becomes once the plan actually matches the usage' },
      { v: 'Shabbos & Yom Tov', c: 'never charged on any rental — on every trip, automatically' },
      { v: 'Same day', c: 'SIMs and international numbers, set up before you leave the shop' },
    ],
    bands: [
      {
        eyebrow: 'Mobile & SIM',
        title: 'Kosher SIM plans, matched to how you really use your phone',
        title2: 'Same network, less money',
        body: 'Most people are quietly on the wrong plan. Bring us your last bill and we’ll match the tariff to how you actually use your phone — international minutes included — and the monthly bill usually drops by half.',
        chips: ['Keep your number', 'Keep your phone', 'We do the switch for you'], cta: 'Bring us your bill',
      },
      {
        eyebrow: 'Travel phones',
        title: 'A kosher phone, sorted before you travel',
        title2: 'Nothing to arrange abroad',
        body: 'Off to the USA, Canada, Europe or Eretz Yisroel? Rent a kosher phone, set up with you in the shop before you go — so there’s nothing to arrange at a foreign airport. You pay only for the days you use, and Shabbos and Yom Tov are never charged.',
        chips: ['Set up before you travel', 'Only pay for days used', 'Shabbos never charged'], cta: 'Plan your trip',
      },
      {
        eyebrow: 'International numbers',
        title: 'A local number, on the phone you already carry',
        title2: 'Israel or the USA, ringing in your pocket',
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
    rights: 'All rights reserved.',
    tradingName: 'Kosher Connect is a trading name of Hatzluche Ltd.',
  },
  he: {
    dir: 'rtl', langLabel: 'HE',
    brandName: 'כשר קונקט',
    nav: { mobile: 'סים וטלפון', travel: 'טלפונים לנסיעות', intl: 'מספרים בינלאומיים', repairs: 'תיקונים ועוד', visit: 'בואו לחנות', message: 'דברו איתנו', account: 'החשבון שלי', signin: 'כניסת צוות', join: 'הצטרפות' },
    joinCta: 'חדשים אצלנו? השאירו פרטים ←',
    heroEyebrow: 'כשר קונקט · סלפורד, מנצ׳סטר',
    heroTitle: 'חשבון הטלפון שלכם — בחצי.',
    heroBody: 'רוב האנשים מחזיקים סים לא מתאים ומשלמים יותר מדי. הביאו את החשבון האחרון — נתאים תוכנית לשימוש האמיתי שלכם: אותה רשת, אותו מספר, הרבה פחות כסף.',
    heroPill: 'אותה רשת · אותו מספר · הרבה פחות כל חודש',
    ctaMessage: 'דברו איתנו', ctaCall: 'חייגו',
    heroSub: 'וכל מה שעוד צריך לטלפון — טלפונים לנסיעות, מספרים בינלאומיים, תיקונים וקול תורה — הכול תחת קורת גג אחת.',
    proof: [
      { v: '£18 במקום £35', c: 'כך נראה חשבון סים חודשי אצל רוב הלקוחות, ברגע שהתוכנית באמת מותאמת לשימוש' },
      { v: 'שבת ויום טוב', c: 'אף פעם לא בחשבון — בכל השכרה ובכל נסיעה, באופן אוטומטי' },
      { v: 'עוד באותו יום', c: 'כרטיסי סים ומספרים בינלאומיים — פועלים לפני שיצאתם מהחנות' },
    ],
    bands: [
      {
        eyebrow: 'סים וטלפון',
        title: 'תוכניות סים כשרות, מותאמות לשימוש האמיתי שלכם',
        title2: 'אותה רשת, פחות כסף',
        body: 'רוב האנשים מחזיקים תוכנית שלא מתאימה להם. הביאו את החשבון האחרון — נתאים את התוכנית לשימוש האמיתי, כולל דקות לחו״ל, ובדרך כלל החשבון החודשי יורד בחצי.',
        chips: ['שומרים על המספר', 'שומרים על הטלפון', 'אנחנו מבצעים את המעבר'], cta: 'הביאו את החשבון',
      },
      {
        eyebrow: 'טלפונים לנסיעות',
        title: 'טלפון כשר, מסודר עוד לפני הנסיעה',
        title2: 'אין מה לסדר בחו״ל',
        body: 'נוסעים לארה״ב, קנדה, אירופה או ארץ ישראל? טלפון כשר מושכר, מוגדר אתכם בחנות עוד לפני היציאה — כך שאין מה לסדר בשדה תעופה זר. משלמים רק על ימי השימוש, ושבת ויום טוב תמיד חינם.',
        chips: ['מסודר לפני הנסיעה', 'תשלום רק על ימי שימוש', 'שבת תמיד חינם'], cta: 'לתכנון הנסיעה',
      },
      {
        eyebrow: 'מספרים בינלאומיים',
        title: 'מספר מקומי, בטלפון שכבר בכיס שלכם',
        title2: 'ישראל או ארה״ב — מצלצל אצלכם',
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
    rights: 'כל הזכויות שמורות.',
    tradingName: 'כשר קונקט הוא שם מסחרי של Hatzluche Ltd.',
  },
}

// Concept illustrations for the three feature bands — the punchy artwork from
// the approved artifact, as self-contained inline SVG (no external assets).
// Decorative: each is aria-hidden and drawn on its own navy card.
function ArtSim() {
  return (
    <svg viewBox="0 0 400 300" className="sk-art" aria-hidden="true">
      <rect width="400" height="300" rx="22" fill="#0d1b3a" />
      {/* the bill */}
      <rect x="44" y="60" width="182" height="154" rx="13" fill="#ffffff" />
      <path d="M44 73 a13 13 0 0 1 13-13 h156 a13 13 0 0 1 13 13 v25 h-182 z" fill="#07639e" />
      <rect x="66" y="114" width="140" height="9" rx="4.5" fill="#c9d6ea" />
      <rect x="66" y="134" width="112" height="9" rx="4.5" fill="#dde5f2" />
      <rect x="66" y="154" width="132" height="9" rx="4.5" fill="#dde5f2" />
      <text x="120" y="197" fontSize="27" fontWeight="800" fill="#c19161" fontFamily="Arial, sans-serif" textAnchor="middle">£££</text>
      <ellipse cx="120" cy="188" rx="47" ry="27" fill="none" stroke="#e2574c" strokeWidth="3" />
      {/* arrow to the result */}
      <path d="M236 150 H318" stroke="#2f95d8" strokeWidth="4.5" fill="none" strokeLinecap="round" />
      <path d="M310 139 L326 150 L310 161 Z" fill="#2f95d8" />
      <rect x="300" y="116" width="76" height="68" rx="13" fill="#07639e" />
      <text x="338" y="150" fontSize="21" fontWeight="800" fill="#ffffff" fontFamily="Arial, sans-serif" textAnchor="middle">LESS</text>
      <text x="338" y="169" fontSize="10" fontWeight="700" fill="#8fd0ff" fontFamily="Arial, sans-serif" textAnchor="middle" letterSpacing="1.5">A MONTH</text>
      {/* SIM chip */}
      <rect x="52" y="238" width="54" height="42" rx="8" fill="none" stroke="#c19161" strokeWidth="2.6" />
      <path d="M52 254 H106 M52 264 H106 M71 238 V280 M87 238 V280" stroke="#c19161" strokeWidth="2.2" />
    </svg>
  )
}
function ArtTravel() {
  return (
    <svg viewBox="0 0 400 300" className="sk-art" aria-hidden="true">
      <rect width="400" height="300" rx="22" fill="#0d1b3a" />
      {/* globe */}
      <circle cx="306" cy="84" r="42" fill="#07639e" />
      <g stroke="#8fd0ff" strokeWidth="1.3" fill="none" opacity="0.5">
        <path d="M266 76 Q306 60 346 76 M266 92 Q306 108 346 92 M306 42 V126 M276 52 Q306 84 276 116 M336 52 Q306 84 336 116" />
      </g>
      {/* dotted flight path */}
      <path d="M64 214 Q186 118 300 116" stroke="#c19161" strokeWidth="2.6" strokeDasharray="2 8" strokeLinecap="round" fill="none" opacity="0.85" />
      {/* plane */}
      <g transform="translate(158 150) rotate(-34)">
        <path d="M0 0 L46 -6 L64 0 L46 6 Z" fill="#ffffff" />
        <path d="M20 -4 L32 -22 L40 -20 L30 -2 Z" fill="#8fd0ff" />
        <path d="M20 4 L32 22 L40 20 L30 2 Z" fill="#8fd0ff" />
      </g>
      {/* phone, ready */}
      <rect x="56" y="150" width="90" height="130" rx="17" fill="#12224a" stroke="#2f95d8" strokeWidth="2" />
      <rect x="69" y="167" width="64" height="88" rx="7" fill="#0a1734" />
      <circle cx="101" cy="198" r="18" fill="none" stroke="#5fd08a" strokeWidth="3.2" />
      <path d="M93 198 l6 7 l11 -14" stroke="#5fd08a" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="83" y="226" width="36" height="7" rx="3.5" fill="#2f95d8" opacity="0.7" />
      <circle cx="101" cy="268" r="5" fill="#2f95d8" />
    </svg>
  )
}
function ArtIntl() {
  return (
    <svg viewBox="0 0 400 300" className="sk-art" aria-hidden="true">
      <rect width="400" height="300" rx="22" fill="#0d1b3a" />
      <defs>
        <clipPath id="ilRound"><circle cx="86" cy="150" r="27" /></clipPath>
        <clipPath id="usRound"><circle cx="314" cy="150" r="27" /></clipPath>
      </defs>
      {/* incoming signal waves */}
      <g stroke="#8fd0ff" strokeWidth="2" fill="none" opacity="0.45">
        <path d="M126 106 q-15 44 0 88 M104 90 q-24 60 0 120" />
        <path d="M274 106 q15 44 0 88 M296 90 q24 60 0 120" />
      </g>
      {/* phone in your pocket */}
      <rect x="156" y="58" width="88" height="154" rx="18" fill="#12224a" stroke="#2f95d8" strokeWidth="2" />
      <rect x="169" y="76" width="62" height="106" rx="7" fill="#0a1734" />
      <path d="M186 108 q-4 -6 2 -10 l8 -3 6 11 -5 5 q6 12 18 18 l5 -5 11 6 -3 8 q-4 6 -10 3 -25 -10 -35 -36 z" fill="#5fd08a" opacity="0.92" />
      <circle cx="200" cy="196" r="4" fill="#2f95d8" />
      {/* Israel roundel */}
      <g clipPath="url(#ilRound)">
        <rect x="59" y="123" width="54" height="54" fill="#ffffff" />
        <rect x="59" y="133" width="54" height="7" fill="#0a5cc4" />
        <rect x="59" y="160" width="54" height="7" fill="#0a5cc4" />
        <path d="M86 143 l7 12 -14 0 z M86 157 l7 -12 -14 0 z" fill="none" stroke="#0a5cc4" strokeWidth="1.7" />
      </g>
      <circle cx="86" cy="150" r="27" fill="none" stroke="#26305c" strokeWidth="2" />
      {/* USA roundel */}
      <g clipPath="url(#usRound)">
        <rect x="287" y="123" width="54" height="54" fill="#ffffff" />
        <g fill="#e2574c"><rect x="287" y="123" width="54" height="6" /><rect x="287" y="135" width="54" height="6" /><rect x="287" y="147" width="54" height="6" /><rect x="287" y="159" width="54" height="6" /><rect x="287" y="171" width="54" height="6" /></g>
        <rect x="287" y="123" width="24" height="24" fill="#0a3a8a" />
      </g>
      <circle cx="314" cy="150" r="27" fill="none" stroke="#26305c" strokeWidth="2" />
    </svg>
  )
}
const BAND_ART = [ArtSim, ArtTravel, ArtIntl]

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
              <img className="sk-logo" src="/logo-full.png" alt="Kosher Connect" />
            </a>
            <nav className="sk-nav-links" aria-label="Site">
              <a href="#mobile" className="sk-navlink">{t.nav.mobile}</a>
              <a href="#travel" className="sk-navlink">{t.nav.travel}</a>
              <a href="#intl" className="sk-navlink">{t.nav.intl}</a>
              <a href="#services" className="sk-navlink">{t.nav.repairs}</a>
              <a href="#contact" className="sk-navlink">{t.nav.visit}</a>
              <div className="sk-lang" role="group" aria-label="Language">
                {['en', 'he'].map((l) => (
                  <button key={l} type="button" lang={l === 'en' ? 'en' : l}
                    className={lang === l ? 'on' : ''} aria-pressed={lang === l}
                    onClick={() => pick(l)}>{T[l].langLabel}</button>
                ))}
              </div>
              <a href={PHONE_TEL} className="sk-nav-phone" dir="ltr" aria-label="Call Kosher Connect">
                <strong>{PHONE_SHOWN}</strong>
              </a>
              <a href="#contact" className="sk-btn sk-btn-sky sk-btn-sm">{t.nav.message}</a>
            </nav>
          </div>
        </header>

        <section className="sk-hero" id="top">
          <div className="sk-wrap">
            <span className="sk-eyebrow">{t.heroEyebrow}</span>
            <h1>{t.heroTitle}</h1>
            <p className="sk-hero-body">{t.heroBody}</p>
            <span className="sk-pill">{t.heroPill}</span>
            <div className="sk-hero-cta">
              <a className="sk-btn sk-btn-sky sk-btn-lg" href="#contact">{t.ctaMessage}</a>
              <a className="sk-btn sk-btn-ghost sk-btn-lg" href={PHONE_TEL}>{t.ctaCall}{' '}<span dir="ltr">{PHONE_SHOWN}</span></a>
            </div>
            <p className="sk-hero-sub">{t.heroSub}</p>
          </div>
        </section>

        <section className="sk-proofstrip" aria-label="Why customers switch">
          <div className="sk-wrap">
            {t.proof.map((p, i) => (
              <div className="sk-proof-item" key={`${lang}-p${i}`}>
                <div className="sk-proof-num">{p.v}</div>
                <div className="sk-proof-cap">{p.c}</div>
              </div>
            ))}
          </div>
        </section>

        <div id="services" />
        {t.bands.map((b, i) => {
          const Art = BAND_ART[i] || BAND_ART[0]
          return (
            <section className={`sk-band ${i % 2 ? 'sk-flip sk-band-tint' : ''}`} id={BAND_IDS[i]} key={`${lang}-b${i}`}>
              <div className="sk-wrap sk-band-inner">
                <div className="sk-band-copy sk-reveal">
                  <span className="sk-eyebrow">{b.eyebrow}</span>
                  <h2>{b.title}<span className="sk-accent">{b.title2}</span></h2>
                  <p>{b.body}</p>
                  <div className="sk-chips">{b.chips.map((c, j) => <span key={j}>✓ {c}</span>)}</div>
                  <a className="sk-btn sk-btn-sky sk-btn-lg" href="#contact">{b.cta}</a>
                </div>
                <div className="sk-band-art sk-reveal"><Art /></div>
              </div>
            </section>
          )
        })}

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
                <a href="#mobile">{t.nav.mobile}</a>
                <a href="#travel">{t.nav.travel}</a>
                <a href="#intl">{t.nav.intl}</a>
                <a href="#contact">{t.nav.visit}</a>
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
  .sk-nav-wrap{position:sticky;top:0;z-index:50;background:color-mix(in srgb,var(--sk-paper) 88%,transparent);
    backdrop-filter:saturate(150%) blur(12px);border-bottom:1px solid var(--sk-line)}
  .sk-nav{display:flex;align-items:center;justify-content:space-between;height:66px;gap:14px}
  .sk-logo{height:30px;width:auto;display:block}
  :root[data-theme="dark"] .sk-logo{filter:brightness(0) invert(1)}
  @media (prefers-color-scheme:dark){:root:not([data-theme]) .sk-logo{filter:brightness(0) invert(1)}}
  .sk-nav-links{display:flex;align-items:center;gap:20px}
  .sk-navlink{color:var(--sk-muted);font-weight:600;font-size:14.5px;white-space:nowrap}
  .sk-navlink:hover{color:var(--sk-text)}
  .sk-lang{display:inline-flex;border:1px solid var(--sk-line);border-radius:999px;overflow:hidden}
  .sk-lang button{border:0;background:transparent;color:var(--sk-muted);font-weight:700;font-size:12.5px;
    padding:5px 11px;cursor:pointer}
  .sk-lang button.on{background:var(--sk-sky);color:#fff}
  .sk-nav-phone{color:var(--sk-text);font-size:15px;white-space:nowrap}
  .sk-nav-phone strong{font-weight:800;letter-spacing:-.01em}
  .sk-nav-phone:hover{color:var(--sk-sky)}
  :root[data-theme="dark"] .sk-nav-phone:hover{color:var(--sk-sky-bright)}

  /* buttons */
  .sk-btn{display:inline-flex;align-items:center;justify-content:center;font-weight:700;
    border-radius:999px;cursor:pointer;transition:transform .12s ease,filter .12s ease;white-space:nowrap}
  .sk-btn:hover{transform:translateY(-1px)}
  .sk-btn-sky{background:var(--sk-sky);color:#fff}
  .sk-btn-sky:hover{filter:brightness(1.08)}
  .sk-btn-ghost{background:transparent;color:var(--sk-sky);border:1.5px solid var(--sk-sky)}
  .sk-btn-sm{padding:9px 17px;font-size:14px}
  .sk-btn-lg{padding:13px 26px;font-size:15.5px}

  /* hero — always the dark Sky banner, both themes */
  .sk-hero{background:radial-gradient(130% 150% at 14% 0%,#123a6b 0%,#0b2350 42%,#071634 100%);
    color:#eaf2ff;padding:88px 0 76px;overflow:hidden;position:relative}
  .sk-hero .sk-eyebrow{color:#7db8e6}
  .sk-hero h1{font-size:clamp(38px,7vw,74px);max-width:15ch;color:#fff;letter-spacing:-.035em;line-height:1.0}
  .sk-hero-body{color:#c4d4ee;max-width:47ch;margin:22px 0 0;font-size:clamp(16.5px,2.2vw,20px)}
  .sk-pill{display:inline-block;margin-top:22px;border:1px solid rgba(255,255,255,.22);
    border-radius:999px;padding:9px 18px;font-size:13.5px;font-weight:600;color:#cfe0f6;background:rgba(255,255,255,.05)}
  .sk-hero-cta{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}
  .sk-hero .sk-btn-ghost{color:#fff;border-color:rgba(255,255,255,.5)}
  .sk-hero .sk-btn-ghost:hover{background:rgba(255,255,255,.08)}
  .sk-hero-sub{color:#9fb4d6;max-width:46ch;margin:24px 0 0;font-size:15px}

  /* proof strip */
  .sk-proofstrip{background:var(--sk-band-alt);border-bottom:1px solid var(--sk-line);padding:26px 0}
  .sk-proofstrip .sk-wrap{display:flex;gap:26px;flex-wrap:wrap;justify-content:center}
  .sk-proof-item{flex:1 1 250px;max-width:360px;text-align:center}
  .sk-proof-num{font-family:var(--sk-fdisp);font-weight:800;font-size:21px;color:var(--sk-sky);letter-spacing:-.02em}
  :root[data-theme="dark"] .sk-proof-num{color:var(--sk-sky-bright)}
  .sk-proof-cap{color:var(--sk-muted);font-size:13.5px;margin-top:7px;line-height:1.5}

  /* feature bands */
  .sk-band{padding:66px 0;border-bottom:1px solid var(--sk-line)}
  .sk-band-tint{background:var(--sk-band-alt)}
  .sk-band-inner{display:grid;grid-template-columns:1.02fr .98fr;gap:48px;align-items:center}
  .sk-flip .sk-band-copy{order:2}
  .sk-band-copy h2{font-size:clamp(26px,4vw,40px);margin:0 0 16px;line-height:1.06}
  .sk-accent{display:block;color:var(--sk-sky)}
  :root[data-theme="dark"] .sk-accent{color:var(--sk-sky-bright)}
  .sk-band-copy p{color:var(--sk-muted);margin:0 0 20px;font-size:16.5px}
  .sk-chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 24px}
  .sk-chips span{background:var(--sk-band);border:1px solid var(--sk-line);border-radius:999px;
    padding:7px 14px;font-size:13.5px;font-weight:600;color:var(--sk-text)}
  .sk-band-tint .sk-chips span{background:var(--sk-paper)}
  .sk-band-art{display:flex;justify-content:center}
  .sk-art{width:min(100%,440px);height:auto;border-radius:22px;
    box-shadow:0 24px 60px -28px rgba(6,18,44,.55),0 2px 10px -4px rgba(6,18,44,.4)}

  /* also grid */
  .sk-also{padding:66px 0;background:var(--sk-band)}
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
  .sk-visit{padding:66px 0;background:var(--sk-band)}
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

  @media (max-width:960px){
    .sk-navlink{display:none}
    .sk-nav-phone{display:none}
  }
  @media (max-width:820px){
    .sk-band-inner{grid-template-columns:1fr;gap:26px}
    .sk-flip .sk-band-copy{order:0}
    .sk-band-art{order:-1}
    .sk-grid,.sk-grid-3{grid-template-columns:1fr}
  }
`
