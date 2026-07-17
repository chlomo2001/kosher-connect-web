import { useEffect } from 'react'
import Head from 'next/head'
import ThemeToggle from '../components/ThemeToggle'
import AuthBackdrop from '../components/AuthBackdrop'

// The public face of KosherConnect — the owner's original site (website.html /
// index.html, "an old dream"), rebuilt on the app's design system with the
// living globe scene behind it. HIS vision and voice — welcome hero, friendly
// service cards, one contact line — with the details brought up to what the
// business actually is today (rentals first, travel, Kol Torah, shop).
// No auth: this page is for the world; Sign in / My account link into the
// staff app and the customer portal.

const SERVICES = [
  { icon: '✈️', title: 'Travelling? Don’t spend £££ on roaming', body: 'Rent a kosher phone for your trip — USA and Israel phones ready to go, charged only for the days you use (Shabbos and Yom Tov are free).' },
  { icon: '📱', title: 'High quality Kosher Phones', body: 'Reliable, tested devices with the right kosher setup for your lifestyle — to rent or to buy.' },
  { icon: '📶', title: 'Find the best SIM plan for your needs', body: 'We help you choose a plan that fits your usage — without overpaying. International minute bundles available.' },
  { icon: '🌍', title: 'Call global like a local', body: 'Get an Israeli or USA number connected to your phone today, and skip expensive international rates.' },
  { icon: '🎟️', title: 'Flights & travel bookings', body: 'We book your tickets and keep an eye on the details, so the whole trip is sorted in one place.' },
  { icon: '🎵', title: 'Kol Torah audio', body: 'Shiurim, music and children’s storytellers — on CD or as audio files, ready for your kosher phone or player.' },
  { icon: '🛠️', title: 'Phone smashed? Don’t worry! We can fix it', body: 'Screen repairs, charging issues, battery problems, and more — we’ll sort it.' },
  { icon: '🛍️', title: 'Accessories & more', body: 'Chargers, cables, cases and audio CDs — in the shop whenever you need them.' },
  { icon: '✅', title: 'Simple, clear guidance', body: 'No tech stress. We explain everything clearly and help you pick the best option.' },
]

export default function Welcome() {
  useEffect(() => {
    const cards = document.querySelectorAll('.w-reveal')
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('w-show'); obs.unobserve(e.target) }
      })
    }, { threshold: 0.15 })
    cards.forEach((c) => obs.observe(c))
    return () => obs.disconnect()
  }, [])

  return (
    <>
      <Head>
        <title>Kosher Connect — Kosher phones, SIM plans, travel, repairs & international numbers</title>
        <meta name="description" content="Kosher Connect - Kosher phones, SIM plans, travel phones, repairs, and international numbers." />
      </Head>
      <div className="welcome-shell">
        <AuthBackdrop />
        <ThemeToggle style={{ position: 'fixed', top: 16, right: 16, zIndex: 10 }} />
        <div className="w-wrap">
          <div className="w-topbar">
            <div className="w-brand">
              <img src="/logo-full.png" alt="Kosher Connect" />
              <div>
                <h1>Kosher Connect</h1>
                <p>Kosher Phones • Rentals &amp; Travel • SIM Plans • Kol Torah Audio • Repairs</p>
              </div>
            </div>
            <nav className="w-pills" aria-label="Site">
              <a href="#services">Services</a>
              <a href="#contact">Contact</a>
              <a href="/portal">My account</a>
              <a href="/login" className="w-pill-primary">Sign in</a>
            </nav>
          </div>

          <section className="w-hero" id="top">
            <div className="w-hero-inner">
              <div>
                <h2>Welcome to Kosher Connect</h2>
                <div className="w-strap">Your Kosher Mobile Store in Manchester</div>
                <p>
                  Everything you need for kosher phones — travel rentals, SIM plans, repairs,
                  flight bookings, Kol Torah audio, and Israeli/USA numbers on your device.
                </p>
                <div className="w-cta">
                  <a className="btn btn-primary" href="#services">View Services</a>
                  <a className="btn btn-outline" href="#contact">Get in touch</a>
                </div>
              </div>
              <div className="w-side">
                <div className="w-mini">
                  <span className="w-dot" style={{ background: 'var(--success)' }} />
                  <div><b>Fast &amp; Friendly</b>
                    <span>Quick help choosing the right device and plan for your needs.</span></div>
                </div>
                <div className="w-mini">
                  <span className="w-dot" style={{ background: 'var(--accent)' }} />
                  <div><b>Travel Ready</b>
                    <span>USA / Canada / EU / Israel kosher phone options available.</span></div>
                </div>
              </div>
            </div>
          </section>

          <section className="w-section" id="services">
            <h3>Our Services</h3>
            <div className="w-grid">
              {SERVICES.map((s) => (
                <div className="w-card w-reveal" key={s.title}>
                  <div className="w-icon" aria-hidden="true">{s.icon}</div>
                  <h4>{s.title}</h4>
                  <p>{s.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="w-section" id="contact">
            <h3>Contact</h3>
            <div className="w-card w-show">
              <p style={{ marginBottom: 10 }}>Want to ask about a phone, repair, SIM plan, or travel option?</p>
              <p style={{ margin: '0 0 6px' }}>📍 421 Bury New Road (door left of Toy Zone, first floor up)</p>
              <p style={{ margin: '0 0 6px' }}>📞 <a href="tel:01615311386"><b>0161 531 1386</b></a></p>
              <p style={{ margin: 0 }}>✉️ <a href="mailto:admin@kosher-connect.com"><b>admin@kosher-connect.com</b></a></p>
            </div>
          </section>

          <footer className="w-footer">
            <div>© {new Date().getFullYear()} Kosher Connect. All rights reserved.</div>
            <div><a href="#top">Back to top ↑</a></div>
          </footer>
        </div>
      </div>
    </>
  )
}
