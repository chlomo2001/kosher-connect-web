import { useEffect, useState } from 'react'
import Head from 'next/head'
import ThemeToggle from '../components/ThemeToggle'
import AuthBackdrop from '../components/AuthBackdrop'
import { FlipPhoneIcon } from '../components/kcIcons'

// The public phone guide — every handset the shop stands behind, with price,
// the spec facts customers actually ask about (dual SIM? Hebrew text?
// touch-screen? texting?) and the owner's own pros/cons per model.
// Content comes from the phone_models table, edited in Settings → Phone guide;
// nothing on this page requires a code change to update.
// EN + Hebrew chrome sharing the kcLang preference (model content itself is
// owner-written English, bidi-isolated so it reads correctly in RTL).

const PHONE_TEL = 'tel:+441615311386'
const PHONE_SHOWN = '0161 531 1386'

const T = {
  en: {
    dir: 'ltr',
    tag: 'The phone guide',
    back: '← Back to the main page', account: 'My account',
    homeAria: 'Kosher Connect — back to the main page',
    strap: 'Compared honestly — no favourites',
    h3: 'Which kosher phone is right for you?',
    lead1: 'Every handset below is one we sell, set up and stand behind. The specs answer what people actually ask in the shop',
    leadVerdicts: '; the pros and cons are our honest take',
    lead2: ' — and if the right phone for you is the cheapest one on the list, that’s the one we’ll recommend.',
    loading: 'Loading the guide…',
    empty1: 'The guide is being written — call us on', empty2: 'and we’ll talk you through the options.',
    specs: { dualSim: 'Dual SIM', yiddishText: 'Hebrew text', touchScreen: 'Touch-screen', texting: 'Texting' },
    askInShop: 'Ask in shop',
    callAbout: 'Call us about the',
    prosAria: "What's good", consAria: 'Worth knowing',
    foot1: 'OTP texting means the phone can receive texts from the bank only — nothing else gets through.',
    foot2: 'Not every phone includes a warranty — please ask before purchase. Prices can change; the shop price on the day is the right one.',
    foot3a: 'Not sure? Come in, or call', foot3b: '— describe who the phone is for and we’ll tell you straight which one fits.',
    brandName: 'Kosher Connect', rights: 'All rights reserved.',
    tradingName: 'Kosher Connect is a trading name of Hatsluche Ltd.',
  },
  he: {
    dir: 'rtl',
    tag: 'מדריך הטלפונים',
    homeAria: 'כשר קונקט — חזרה לעמוד הראשי',
    back: '→ חזרה לעמוד הראשי', account: 'החשבון שלי',
    strap: 'השוואה הוגנת — בלי מועדפים',
    h3: 'איזה טלפון כשר מתאים לכם?',
    lead1: 'כל מכשיר ברשימה הוא מכשיר שאנחנו מוכרים, מגדירים ועומדים מאחוריו. המפרט עונה על מה שבאמת שואלים אצלנו בחנות',
    leadVerdicts: '; והיתרונות והחסרונות — דעתנו הכנה',
    lead2: ' — ואם הטלפון הנכון עבורכם הוא דווקא הזול ביותר ברשימה, עליו נמליץ.',
    loading: 'המדריך נטען…',
    empty1: 'המדריך עוד נכתב — התקשרו אלינו:', empty2: 'ונעבור איתכם על האפשרויות.',
    specs: { dualSim: 'שני כרטיסי סים', yiddishText: 'טקסט בעברית', touchScreen: 'מסך מגע', texting: 'הודעות' },
    askInShop: 'שאלו בחנות',
    callAbout: 'להתקשר בקשר ל־',
    prosAria: 'מה טוב', consAria: 'כדאי לדעת',
    foot1: 'טקסט OTP פירושו שהטלפון מקבל הודעות מהבנק בלבד — שום דבר אחר לא עובר.',
    foot2: 'לא לכל טלפון מצורפת אחריות — נא לשאול לפני הקנייה. המחירים יכולים להשתנות; המחיר בחנות ביום הקנייה הוא הקובע.',
    foot3a: 'לא בטוחים? קפצו אלינו, או התקשרו:', foot3b: '— ספרו למי הטלפון מיועד, ונגיד לכם ישר איזה מתאים.',
    brandName: 'כשר קונקט', rights: 'כל הזכויות שמורות.',
    tradingName: 'כשר קונקט הוא שם מסחרי של Hatsluche Ltd.',
  },
}

// `yiddishText` is a legacy field name (and `phone_models.yiddish_text` in the
// database). The spec it records is whether the handset displays the ALEPH
// BEIS — Hebrew characters — not whether it speaks Yiddish, so every label a
// person reads now says Hebrew. Renaming the column is a migration for its own
// day; until then the labels above are the truth and this key is just plumbing.
const SPEC_KEYS = ['dualSim', 'yiddishText', 'touchScreen', 'texting']

const lines = (s) => String(s || '').split('\n').map((l) => l.trim().replace(/^[-•]\s*/, '')).filter(Boolean)

export default function PhoneGuide() {
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

  const [models, setModels] = useState(null)
  // The lead only promises pros and cons once at least one model actually has
  // them — until the owner writes them, the promise stays off the page.
  const hasVerdicts = (models || []).some((m) => lines(m.pros).length > 0 || lines(m.cons).length > 0)
  // The API returns models:[] on any error too, so "no cards" and "the guide
  // isn't written yet" look identical from here — either way the page must
  // stop promising handsets it isn't showing.
  const hasModels = (models || []).length > 0

  useEffect(() => {
    fetch('/api/public/phone-guide')
      .then((r) => r.json())
      .then((d) => setModels(d.models || []))
      .catch(() => setModels([]))
  }, [])

  return (
    <>
      <Head>
        <title>Phone guide — Kosher Connect</title>
        <meta name="description" content="Every kosher handset we sell, compared honestly: price, dual SIM, Hebrew text, touch-screen and texting options — straight answers from the counter." />
        <link rel="canonical" href="https://www.kosher-connect.com/phone-guide" />
      </Head>
      <div className="welcome-shell">
        <AuthBackdrop />
        <ThemeToggle style={{ position: 'fixed', top: 16, right: 16, zIndex: 10 }} />
        <div className="w-wrap" dir={t.dir} lang={lang}>
          <div className="w-topbar">
            <a className="w-brand w-brand-link" href="/welcome" aria-label={t.homeAria}>
              <img src="/logo-full-tight.png" alt="Kosher Connect" />
              <div>
                <h1>Kosher Connect</h1>
                <p>{t.tag}</p>
              </div>
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

          <section className="w-section pg-head" id="top">
            <div className="w-strap">{t.strap}</div>
            <h2 className="w-show">{t.h3}</h2>
            {hasModels && (
              <p className="w-lead">
                {t.lead1}{hasVerdicts && t.leadVerdicts}{t.lead2}
              </p>
            )}
          </section>

          <section className="w-section pg-list-wrap" aria-label="Phone models">
            {models === null && <p className="pg-note">{t.loading}</p>}
            {models !== null && models.length === 0 && (
              <p className="pg-note">{t.empty1} <a href={PHONE_TEL} dir="ltr">{PHONE_SHOWN}</a> {t.empty2}</p>
            )}
            <div className="pg-list">
              {(models || []).map((m) => {
                const pros = lines(m.pros)
                const cons = lines(m.cons)
                return (
                  <article className="w-card pg-row" key={m.name}>
                    <header className="pg-row-head">
                      <div className="pg-name">
                        <span className="w-icon" aria-hidden="true"><FlipPhoneIcon /></span>
                        <h3><bdi dir="ltr">{m.name}</bdi></h3>
                      </div>
                      <div className="pg-price">{m.price != null ? `£${Number(m.price) % 1 === 0 ? Number(m.price) : Number(m.price).toFixed(2)}` : t.askInShop}</div>
                    </header>
                    <dl className="pg-specs">
                      {SPEC_KEYS.map((k) => (
                        // Always all four, always in the same order, so the
                        // eye can compare straight across the cards. A blank
                        // shows as "—" rather than vanishing, which used to
                        // make "no dual SIM" look like "not filled in".
                        // Spec values are owner-written English (e.g. "Yes —
                        // OTP (bank texts only)") — isolate so RTL can't
                        // shuffle the word order.
                        <div className="pg-spec" key={k}>
                          <dt>{t.specs[k]}</dt>
                          <dd>{m[k] ? <bdi dir="ltr">{m[k]}</bdi> : <span className="pg-spec-none">—</span>}</dd>
                        </div>
                      ))}
                    </dl>
                    {(pros.length > 0 || cons.length > 0) && (
                      <div className="pg-verdict">
                        {pros.length > 0 && (
                          <ul className="pg-pros" aria-label={t.prosAria}>
                            {pros.map((p, i) => <li key={i}><bdi>{p}</bdi></li>)}
                          </ul>
                        )}
                        {cons.length > 0 && (
                          <ul className="pg-cons" aria-label={t.consAria}>
                            {cons.map((c, i) => <li key={i}><bdi>{c}</bdi></li>)}
                          </ul>
                        )}
                      </div>
                    )}
                    <a className="pg-call" href={`tel:+441615311386`}>
                      {t.callAbout} <bdi dir="ltr">{m.name || ''}</bdi>
                    </a>
                  </article>
                )
              })}
            </div>
            {/* The OTP and warranty notes annotate the cards — with no cards
                they're footnotes to nothing. The call-us line always stays. */}
            <div className="pg-foot">
              {hasModels && <p>{t.foot1}</p>}
              {hasModels && <p>{t.foot2}</p>}
              <p>{t.foot3a} <a href={PHONE_TEL} dir="ltr">{PHONE_SHOWN}</a> {t.foot3b}</p>
            </div>
          </section>

          <footer className="w-footer2">
            <div className="w-footer-bottom">
              {/* Was hard-coded English on a page that flips to dir="rtl".
                  Left untranslated it also came out bidi-mangled in Hebrew —
                  "2026 ©" and ".Hatsluche Ltd" — because neutral characters
                  around Latin text reorder inside an RTL paragraph. */}
              <div>© {new Date().getFullYear()} {t.brandName}. {t.rights}<span className="w-legal"> {t.tradingName}</span></div>
              <div><a href="/welcome">kosher-connect.com</a></div>
            </div>
          </footer>
        </div>
      </div>
    </>
  )
}
