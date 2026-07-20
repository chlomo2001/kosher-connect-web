import { useEffect, useState } from 'react'
import Head from 'next/head'
import ThemeToggle from '../components/ThemeToggle'
import AuthBackdrop from '../components/AuthBackdrop'
import { FlipPhoneIcon } from '../components/kcIcons'

// The public phone guide — every handset the shop stands behind, with price,
// the spec facts customers actually ask about (dual SIM? Yiddish text?
// touch-screen? texting?) and the owner's own pros/cons per model.
// Content comes from the phone_models table, edited in Settings → Phone guide;
// nothing on this page requires a code change to update.

const PHONE_TEL = 'tel:+441615311386'
const PHONE_SHOWN = '0161 531 1386'

const SPEC_LABELS = [
  ['dualSim', 'Dual SIM'],
  ['yiddishText', 'Yiddish text'],
  ['touchScreen', 'Touch-screen'],
  ['texting', 'Texting'],
]

const lines = (s) => String(s || '').split('\n').map((l) => l.trim().replace(/^[-•]\s*/, '')).filter(Boolean)

export default function PhoneGuide() {
  const [models, setModels] = useState(null)

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
        <meta name="description" content="Every kosher handset we sell, compared honestly: price, dual SIM, Yiddish text, touch-screen and texting options — with straight pros and cons." />
      </Head>
      <div className="welcome-shell">
        <AuthBackdrop />
        <ThemeToggle style={{ position: 'fixed', top: 16, right: 16, zIndex: 10 }} />
        <div className="w-wrap" dir="ltr" lang="en">
          <div className="w-topbar">
            <div className="w-brand">
              <img src="/logo-full.png" alt="Kosher Connect" />
              <div>
                <h1>Kosher Connect</h1>
                <p>The phone guide</p>
              </div>
            </div>
            <nav className="w-pills" aria-label="Site">
              <a href="/welcome" className="w-anchor">← Back to the shop</a>
              <a href="/portal" className="w-pill-primary">My account</a>
            </nav>
          </div>

          <section className="w-section pg-head" id="top">
            <div className="w-strap">Compared honestly — no favourites</div>
            <h3>Which kosher phone is right for you?</h3>
            <p className="w-lead">
              Every handset below is one we sell, set up and stand behind. The specs answer
              what people actually ask in the shop; the pros and cons are our honest take —
              and if the right phone for you is the cheapest one on the list, that&rsquo;s the
              one we&rsquo;ll recommend.
            </p>
          </section>

          <section className="w-section pg-list-wrap" aria-label="Phone models">
            {models === null && <p className="pg-note">Loading the guide…</p>}
            {models !== null && models.length === 0 && (
              <p className="pg-note">The guide is being written — call us on <a href={PHONE_TEL} dir="ltr">{PHONE_SHOWN}</a> and we&rsquo;ll talk you through the options.</p>
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
                        <h4>{m.name}</h4>
                      </div>
                      <div className="pg-price">{m.price != null ? `£${Number(m.price) % 1 === 0 ? Number(m.price) : Number(m.price).toFixed(2)}` : 'Ask in shop'}</div>
                    </header>
                    <dl className="pg-specs">
                      {SPEC_LABELS.map(([k, label]) => m[k] ? (
                        <div className="pg-spec" key={k}><dt>{label}</dt><dd>{m[k]}</dd></div>
                      ) : null)}
                    </dl>
                    {(pros.length > 0 || cons.length > 0) && (
                      <div className="pg-verdict">
                        {pros.length > 0 && (
                          <ul className="pg-pros" aria-label="What's good">
                            {pros.map((p, i) => <li key={i}>{p}</li>)}
                          </ul>
                        )}
                        {cons.length > 0 && (
                          <ul className="pg-cons" aria-label="Worth knowing">
                            {cons.map((c, i) => <li key={i}>{c}</li>)}
                          </ul>
                        )}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
            <div className="pg-foot">
              <p>OTP texting means the phone can receive texts from the bank only — nothing else gets through.</p>
              <p>Not every phone includes a warranty — please ask before purchase. Prices can change; the shop price on the day is the right one.</p>
              <p>Not sure? Come in, or call <a href={PHONE_TEL} dir="ltr">{PHONE_SHOWN}</a> — describe who the phone is for and we&rsquo;ll tell you straight which one fits.</p>
            </div>
          </section>

          <footer className="w-footer2">
            <div className="w-footer-bottom">
              <div>© {new Date().getFullYear()} Kosher Connect. All rights reserved.<span className="w-legal"> Kosher Connect is a trading name of Hatzluche Ltd.</span></div>
              <div><a href="/welcome">kosher-connect.com</a></div>
            </div>
          </footer>
        </div>
      </div>
    </>
  )
}
