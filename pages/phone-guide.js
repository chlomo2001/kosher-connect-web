import { legalIdentifier } from '../lib/company.mjs'
import { useEffect, useState } from 'react'
import Head from 'next/head'
import ThemeToggle from '../components/ThemeToggle'
import SkipLink from '../components/SkipLink'
import { FlipPhoneIcon } from '../components/kcIcons'
import { SCENES } from '../components/kcScenes'

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
    skip: 'Skip to content',
    dir: 'ltr',
    tag: 'The phone guide',
    back: '← Back to the main page', account: 'My account',
    homeAria: 'Kosher Connect — back to the main page',
    strap: 'Compared honestly — no favourites',
    h3: 'Which kosher phone is right for you?',
    lead1: 'Every handset below is one we sell, set up and stand behind. The specs answer what people actually ask in the shop',
    leadVerdicts: '; the pros and cons are our honest take',
    lead2: ' — and if the right phone for you is the cheapest one on the list, that’s the one we’ll recommend.',
    // ── Why a kosher phone (owner ask, 27 Aug) ──────────────────────────
    // Upstream of the guide below: this page answered "which one" to somebody
    // who had already decided, and said nothing to the person still deciding.
    //
    // Every row of the table is a fact about the handset that a customer can
    // check in the shop in ten seconds, which is the standard's rule — proof
    // is cheaper than persuasion and it survives being repeated by somebody
    // else. No superlatives, no urgency, and nothing here argues with anybody
    // about how they should live: it describes an object.
    whyStrap: 'Before you choose a handset',
    whyTitle: 'Why a kosher phone',
    whyLead: 'A kosher phone is a handset with no internet and no app store, and on most models no camera. It rings, it texts, and that is the whole of it. Everything below is what that means day to day — and none of it is something you have to take on trust. Come in and press the buttons.',
    cmpCaption: 'What actually differs',
    cmpCols: ['', 'A kosher phone', 'An ordinary smartphone'],
    cmpRows: [
      ['Calls and texts', 'Yes', 'Yes'],
      ['Internet browser', 'None on the handset', 'Yes'],
      ['App store', 'None', 'Yes'],
      ['Camera', 'None on most models', 'Yes'],
      ['Bank one-time codes', 'On some models — bank texts only', 'Yes'],
      ['Hebrew on screen', 'On some models', 'Yes'],
      ['A filter to set up and keep working', 'Not needed', 'Yes, and it needs maintaining'],
      ['Battery between charges', 'Days', 'About a day'],
      ['If it is lost', 'A phone number', 'A phone number, and everything on it'],
    ],
    cmpNote: 'Models differ, and the guide below says which is which for each handset. Not sure? Ring us and tell us who the phone is for.',
    livesTitle: 'Where it fits',
    lives: [
      { icon: 'shtender', title: 'In the beis medrash',
        body: 'It sits in a pocket and does nothing until somebody rings. Home can reach him; the phone cannot reach him with anything else.' },
      { icon: 'licht', title: 'Erev Shabbos',
        body: 'Nothing on it to put away — no downloads finishing, no notifications waiting. It goes in the drawer the way a phone used to.' },
      { icon: 'case', title: 'Away from home',
        body: 'Abroad, a phone has one job: work when you land. A kosher handset does that, and the line to go with it is what we rent.' },
      { icon: 'satchel', title: 'A first phone',
        body: 'A child can ring home and be reached. There is nothing else on it, so there is nothing for a parent to police.' },
    ],
    livesFoot: 'The handsets are below, with the price and the specs for each.',
    loading: 'Loading the guide…',
    empty1: 'The guide is being written — call us on', empty2: 'and we’ll talk you through the options.',
    specs: { dualSim: 'Dual SIM', yiddishText: 'Hebrew text', touchScreen: 'Touch-screen', texting: 'Texting' },
    yes: 'Yes', no: 'No',
    askInShop: 'Ask in shop',
    callAbout: 'Call us about the',
    prosAria: "What's good", consAria: 'Worth knowing',
    foot1: 'OTP texting means the phone can receive texts from the bank only — nothing else gets through.',
    foot2: 'Not every phone includes a warranty — please ask before purchase. Prices can change; the shop price on the day is the right one.',
    foot3a: 'Not sure? Come in, or call', foot3b: '— describe who the phone is for and we’ll tell you straight which one fits.',
    brandName: 'Kosher Connect', rights: 'All rights reserved.',
    tradingName: 'Kosher Connect is a trading name of',
  },
  he: {
    skip: 'דילוג לתוכן',
    dir: 'rtl',
    tag: 'מדריך הטלפונים',
    homeAria: 'כשר קונקט — חזרה לעמוד הראשי',
    back: '→ חזרה לעמוד הראשי', account: 'האזור האישי',
    strap: 'השוואה שקופה — בלי אותיות קטנות',
    h3: 'איזה טלפון כשר מתאים לכם?',
    lead1: 'המכשירים שמופיעים כאן הם אלו שאנחנו מוכרים, מגדירים ולוקחים עליהם אחריות. המפרט עונה על השאלות שלקוחות שואלים אותנו בחנות',
    leadVerdicts: '; היתרונות והחסרונות משקפים את דעתנו הכנה',
    lead2: ' — ואם הטלפון שהכי מתאים לכם הוא הזול ביותר ברשימה, זה בדיוק המכשיר שעליו נמליץ.',
    // The Hebrew of this section is a first pass and is worth a native eye
    // before it is treated as settled — the rest of the page's Hebrew came
    // back revised from the owner's own document (task #43).
    whyStrap: 'לפני שבוחרים מכשיר',
    whyTitle: 'למה טלפון כשר',
    whyLead: 'טלפון כשר הוא מכשיר בלי אינטרנט ובלי חנות אפליקציות, וברוב הדגמים גם בלי מצלמה. הוא מצלצל, הוא שולח הודעות, וזהו. כל מה שכתוב למטה הוא מה שזה אומר ביום-יום — ואין כאן שום דבר שצריך להאמין לנו עליו. בואו לחנות ותלחצו על הכפתורים.',
    cmpCaption: 'מה באמת שונה',
    cmpCols: ['', 'טלפון כשר', 'סמארטפון רגיל'],
    cmpRows: [
      ['שיחות והודעות', 'כן', 'כן'],
      ['דפדפן אינטרנט', 'אין במכשיר', 'יש'],
      ['חנות אפליקציות', 'אין', 'יש'],
      ['מצלמה', 'אין ברוב הדגמים', 'יש'],
      ['קודים חד-פעמיים מהבנק', 'בחלק מהדגמים — הודעות מהבנק בלבד', 'יש'],
      ['עברית על המסך', 'בחלק מהדגמים', 'יש'],
      ['סינון שצריך להתקין ולתחזק', 'לא נדרש', 'נדרש, וצריך לתחזק אותו'],
      ['סוללה בין טעינות', 'כמה ימים', 'בערך יום'],
      ['אם המכשיר אובד', 'מספר טלפון', 'מספר טלפון, וכל מה שהיה עליו'],
    ],
    cmpNote: 'הדגמים שונים זה מזה, והמדריך שלמטה מפרט לכל מכשיר מה יש בו. מתלבטים? התקשרו וספרו לנו למי הטלפון מיועד.',
    livesTitle: 'איפה זה משתלב',
    lives: [
      { icon: 'shtender', title: 'בבית המדרש',
        body: 'המכשיר יושב בכיס ולא עושה כלום עד שמישהו מצלצל. מהבית אפשר להשיג אותו; שום דבר אחר לא מגיע אליו.' },
      { icon: 'licht', title: 'ערב שבת',
        body: 'אין מה לסדר לפני ההדלקה — אין הורדות שמסתיימות ואין התראות שממתינות. המכשיר נכנס למגירה כמו שטלפון נהג פעם.' },
      { icon: 'case', title: 'הרחק מהבית',
        body: 'בחו״ל לטלפון יש תפקיד אחד: לעבוד ברגע שנוחתים. מכשיר כשר עושה את זה, והקו שמלווה אותו הוא מה שאנחנו משכירים.' },
      { icon: 'satchel', title: 'טלפון ראשון',
        body: 'ילד יכול לצלצל הביתה ואפשר להשיג אותו. אין על המכשיר שום דבר אחר, ולכן אין להורה על מה לפקח.' },
    ],
    livesFoot: 'המכשירים עצמם מופיעים למטה, עם המחיר והמפרט של כל אחד.',
    loading: 'המדריך נטען…',
    empty1: 'המדריך נמצא כעת בכתיבה — התקשרו אלינו:', empty2: 'ונעבור איתכם על האפשרויות.',
    specs: { dualSim: 'סים כפול (Dual SIM)', yiddishText: 'תמיכה בעברית', touchScreen: 'מסך מגע', texting: 'הודעות SMS' },
    yes: 'כן', no: 'לא',
    askInShop: 'שאלו בחנות',
    callAbout: 'התקשרו אלינו לגבי',
    prosAria: 'יתרונות', consAria: 'חסרונות / כדאי לדעת',
    foot1: 'תמיכה בהודעות OTP (סיסמה חד-פעמית) פירושה שהמכשיר מקבל הודעות מהבנק בלבד — שום דבר אחר לא נכנס.',
    foot2: 'לא לכל מכשיר מצורפת אחריות — אנא ודאו זאת טרם הקנייה. המחירים עשויים להשתנות; המחיר הקובע הוא המחיר בחנות ביום הרכישה.',
    foot3a: 'מתלבטים? קפצו לבקר, או התקשרו', foot3b: '— ספרו לנו למי מיועד הטלפון, ונגיד לכם מיד איזה מכשיר יתאים.',
    brandName: 'כשר קונקט', rights: 'כל הזכויות שמורות.',
    tradingName: 'כשר קונקט הוא שם מסחרי של',
  },
}

// `yiddishText` is a legacy field name (and `phone_models.yiddish_text` in the
// database). The spec it records is whether the handset displays the ALEPH
// BEIS — Hebrew characters — not whether it speaks Yiddish, so every label a
// person reads now says Hebrew. Renaming the column is a migration for its own
// day; until then the labels above are the truth and this key is just plumbing.
// A bare yes/no answer in the reader's own language; anything else is the
// owner's prose and is returned untouched (null → the caller keeps the raw
// value inside its <bdi>). Whitespace and case only — no fuzzy matching, so
// "Yes — OTP (bank texts only)" is never caught by this.
function specWord(value, t) {
  const v = String(value).trim().toLowerCase()
  if (v === 'yes') return t.yes
  if (v === 'no') return t.no
  return null
}

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
        <SkipLink>{t.skip}</SkipLink>
        {/* Physical side from the page language, not `right` — this button is
            outside the dir="rtl" wrapper, so in Hebrew the mirrored topbar puts
            the logo on the right and a right-pinned toggle lands on top of it. */}
        <ThemeToggle style={{ position: 'fixed', top: 16, [t.dir === 'rtl' ? 'left' : 'right']: 16, zIndex: 10 }} />
        <div className="w-wrap" dir={t.dir} lang={lang}>
          <div className="w-topbar">
            <a className="w-brand w-brand-link" href="/welcome" aria-label={t.homeAria}>
              {/* Wordmark artwork + the section tag only — see the note on
                  /repair: a text "Kosher Connect" beside a mark that already
                  says it is a repeat, and it cost this bar a second row. */}
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

          <section className="w-section pg-head" id="top">
            <div className="w-strap">{t.strap}</div>
            <h1 className="w-page-title w-show">{t.h3}</h1>
            {hasModels && (
              <p className="w-lead">
                {t.lead1}{hasVerdicts && t.leadVerdicts}{t.lead2}
              </p>
            )}
          </section>

          {/* The case for the thing, before the choice between versions of it.
              A table and four cards: the table is the checkable difference, the
              cards are where it lands in a day. Both sit ABOVE the models,
              because somebody who already knows they want one scrolls past in
              a second and somebody who does not would otherwise have been shown
              a price list as an answer to a question they had not asked. */}
          <section className="w-section pg-why" aria-labelledby="pg-why-h">
            <div className="w-strap">{t.whyStrap}</div>
            <h2 className="w-page-title w-show" id="pg-why-h">{t.whyTitle}</h2>
            <p className="w-lead">{t.whyLead}</p>

            {/* A real <table> with a real <caption>: this IS tabular data, and
                a screen reader announcing "column 2, A kosher phone" is the
                whole comparison working. On a narrow screen it scrolls inside
                its own box rather than pushing the page sideways. */}
            <div className="pg-cmp-scroll">
              <table className="pg-cmp">
                <caption>{t.cmpCaption}</caption>
                <thead>
                  <tr>
                    {t.cmpCols.map((c, i) => (
                      <th key={i} scope="col" className={i === 0 ? 'pg-cmp-what' : ''}>
                        {c || <span className="w-sr">{t.cmpCaption}</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {t.cmpRows.map((row, i) => (
                    <tr key={i}>
                      <th scope="row">{row[0]}</th>
                      <td className="pg-cmp-ours">{row[1]}</td>
                      <td>{row[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="pg-cmp-note">{t.cmpNote}</p>

            <h3 className="pg-lives-h">{t.livesTitle}</h3>
            <div className="pg-lives">
              {t.lives.map((l, i) => {
                const Scene = SCENES[l.icon]
                return (
                  <article className="w-card pg-life" key={`${lang}-l${i}`}>
                    <div className="pg-life-art" aria-hidden="true">{Scene ? <Scene /> : null}</div>
                    <h4>{l.title}</h4>
                    <p>{l.body}</p>
                  </article>
                )
              })}
            </div>
            <p className="pg-cmp-note">{t.livesFoot}</p>
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
                        <h2><bdi dir="ltr">{m.name}</bdi></h2>
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
                        //
                        // The exception is a bare Yes or No. Those are not
                        // prose, they are the two answers the form offers, and
                        // on the Hebrew page they were the only English left
                        // in a translated row: "מסך מגע  No". Translating a
                        // known token is not the same as translating somebody
                        // else's sentence, so ONLY the bare pair is swapped —
                        // "Yes — OTP (bank texts only)" stays exactly as
                        // written, because rewriting that would be inventing
                        // copy for the shop.
                        <div className="pg-spec" key={k}>
                          <dt>{t.specs[k]}</dt>
                          <dd>{m[k]
                            ? (specWord(m[k], t) ?? <bdi dir="ltr">{m[k]}</bdi>)
                            : <span className="pg-spec-none">—</span>}</dd>
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
              <div>© {new Date().getFullYear()} {t.brandName}. {t.rights}<span className="w-legal"> {t.tradingName} <bdi>{legalIdentifier()}</bdi></span></div>
              <div><a href="/welcome">kosher-connect.com</a></div>
            </div>
          </footer>
        </main>
        </div>
      </div>
    </>
  )
}
