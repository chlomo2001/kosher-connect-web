import Head from 'next/head'
import Script from 'next/script'
import { Fragment } from 'react'

/* Monochrome line icons (Feather-style, 20px, 1.6 stroke, currentColor) —
   they inherit the nav item's colour, so they light up on hover/active
   like real product chrome. No emoji. */
function I({ children }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}
const ICONS = {
  dashboard: <I><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></I>,
  customers: <I><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></I>,
  rentals: <I><rect x="5" y="2" width="14" height="20" rx="2.5" /><line x1="11" y1="18" x2="13" y2="18" /></I>,
  sim: <I><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></I>,
  bookings: <I><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></I>,
  wallet: <I><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4z" /></I>,
  repairs: <I><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></I>,
  services: <I><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></I>,
  shop: <I><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></I>,
  koltorah: <I><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="2.5" /><path d="M12 5.5a6.5 6.5 0 0 0-6.5 6.5" /></I>,
  virtual: <I><line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /><line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" /></I>,
  tasks: <I><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></I>,
  settings: <I><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></I>,
  signout: <I><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></I>,
}
// #20 — grouped sections (People / Counter / Connectivity / Travel / Manage),
// not a flat list of 12 peers; Dashboard + Manage stay pinned at the ends.
const NAV = [
  { items: [['dashboard', 'Dashboard']] },
  { label: 'People', items: [['customers', 'Customers'], ['wallet', 'Wallet']] },
  { label: 'Counter', items: [['rentals', 'Phone Rentals'], ['repairs', 'Repairs'], ['services', 'Online & Print'], ['shop', 'Shop'], ['koltorah', 'Kol Torah']] },
  { label: 'Connectivity', items: [['sim', 'SIM Plans'], ['virtual', 'Virtual Numbers']] },
  { label: 'Travel', items: [['bookings', 'Tickets & Flights']] },
  { label: 'Manage', items: [['tasks', 'Tasks'], ['settings', 'Settings']] },
]

// Every routable tab id — the single source used by pages/[tab].js to accept
// /rentals, /customers … and reject anything else. Derived from NAV so adding a
// section item automatically makes its URL valid.
export const TAB_IDS = NAV.flatMap((s) => s.items.map(([id]) => id))

// The whole operator app is one shell driven by /main.js. It renders under two
// routes — pages/index.js (dashboard, "/") and pages/[tab].js ("/rentals" …) —
// so every screen has its own URL. `initialTab` just decides which nav item is
// marked active on the server so there's no flash before main.js reads the URL.
export default function AppShell({ initialTab = 'dashboard' }) {
  return (
    <>
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>KosherConnect – Customer Management</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;700;900&display=swap"
          rel="stylesheet"
        />
      </Head>

      {/* Full-page boot loader — shows from first paint until the first tab
          renders, then fades out (removed by initApp / the safety timeout). */}
      <div id="kcBoot" className="kc-boot">
        <span className="kc-logo-loader kc-boot-mark"><img src="/logo.png" alt="" width="56" height="56" /></span>
        <div className="kc-boot-title">KosherConnect</div>
        <div className="kc-boot-sub">Loading your business…</div>
      </div>

      {/* SIDEBAR */}
      <div className="sidebar">
        <div className="logo">
          <img src="/logo.png" alt="KosherConnect" style={{ background: '#fff', padding: 5 }} />
          <div className="logo-title">KosherConnect</div>
          <div className="logo-sub">Business Management System</div>
        </div>

        {/* #20 grouped sections, with monochrome SVG line icons (no emoji). */}
        {NAV.map((section, si) => (
          <Fragment key={si}>
            {section.label && <div className="nav-group-label">{section.label}</div>}
            {section.items.map(([tab, label]) => (
              <div key={tab} className={'nav-item' + (tab === initialTab ? ' active' : '')} data-tab={tab}>
                <span className="nav-icon">{ICONS[tab]}</span> {label}
              </div>
            ))}
          </Fragment>
        ))}

        <div className="sidebar-bottom">
          {/* Converter tools live on their own pages (not SPA tabs) — plain
              links under their own group label so the footer reads like the
              nav above it, with one consistent row rhythm. */}
          <div className="sb-label">Tools</div>
          <a className="sb-row" href="/tools/contacts">
            <span className="nav-icon"><I><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><polyline points="16 11 18 13 22 9" /></I></span> Contacts converter</a>
          <a className="sb-row" href="/tools/transfer">
            <span className="nav-icon"><I><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></I></span> Phone transfer</a>
          {/* Who's signed in — filled by main.js once /api/auth/me resolves
              (auth is client-side, so the server can't render it). Hidden until
              then, and stays hidden when auth is disabled. */}
          <div className="sidebar-user" id="sidebarUser" hidden />
          <a className="sb-row" href="#" onClick={(e) => { e.preventDefault(); fetch('/api/auth/logout', { method: 'POST' }).then(() => { window.location.href = '/login' }) }}>
            <span className="nav-icon">{ICONS.signout}</span> Sign out</a>
          <div className="sb-version">Version 1.0 · KosherConnect</div>
        </div>
      </div>

      {/* MAIN */}
      <div className="main">
        <div className="topbar">
          <div className="page-title" id="pageTitle">Customer <span>Management</span></div>
          <div className="topbar-actions">
            <input className="search-box" id="searchBox" type="text" placeholder="Search by name, phone, email…" />
            <button className="btn btn-primary" id="btnNewCustomer">+ New Customer</button>
            {/* Persistent theme toggle — uses the app's toggleTheme() so it and
                every other [data-theme-btn] (palette, settings, till) stay in
                sync. updateThemeBtns() sets the right icon once main.js loads. */}
            <button
              className="theme-toggle" data-theme-btn suppressHydrationWarning
              onClick={() => window.toggleTheme && window.toggleTheme()}
              title="Light / dark mode" aria-label="Toggle light or dark mode"
            >🌙</button>
          </div>
        </div>

        <div className="content" id="mainContent" />
      </div>

      {/* ADD / EDIT CUSTOMER MODAL */}
      <div className="modal-overlay hidden" id="customerModal">
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
          <div className="modal-title" id="modalTitle">➕ Add New Customer</div>
          <input type="hidden" id="editId" />

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="fFirstName">First Name *</label>
              <input className="form-input" id="fFirstName" type="text" placeholder="Menachem" autoComplete="off" aria-describedby="errFirstName" />
              <span className="form-error" id="errFirstName">Required</span>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="fLastName">Last Name *</label>
              <input className="form-input" id="fLastName" type="text" placeholder="Adler" autoComplete="off" aria-describedby="errLastName" />
              <span className="form-error" id="errLastName">Required</span>
            </div>

            <div className="form-group form-full">
              <label className="form-label" htmlFor="fPhoneNumber">Phone *</label>
              <div className="phone-row">
                <select className="country-select" id="fCountryCode" aria-label="Country dialing code">
                  <option value="+44">🇬🇧 +44</option>
                  <option value="+1">🇺🇸 +1</option>
                  <option value="+972">🇮🇱 +972</option>
                  <option value="+33">🇫🇷 +33</option>
                  <option value="+49">🇩🇪 +49</option>
                  <option value="+43">🇦🇹 +43</option>
                  <option value="+41">🇨🇭 +41</option>
                  <option value="+32">🇧🇪 +32</option>
                  <option value="+31">🇳🇱 +31</option>
                  <option value="+1-CA">🇨🇦 +1</option>
                  <option value="+61">🇦🇺 +61</option>
                  <option value="+55">🇧🇷 +55</option>
                  <option value="+52">🇲🇽 +52</option>
                  <option value="+54">🇦🇷 +54</option>
                  <option value="+27">🇿🇦 +27</option>
                </select>
                <input
                  className="form-input"
                  id="fPhoneNumber"
                  type="text"
                  placeholder="7911 123456"
                  style={{ flex: 1 }}
                  autoComplete="off"
                  aria-describedby="errPhone warnPhone"
                />
              </div>
              <span className="form-error" id="errPhone">Required</span>
              <div className="form-warning" id="warnPhone">⚠️ This phone number already exists for another customer.</div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="fEmail">✉️ Contact email <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(the customer&apos;s own)</span></label>
              <input className="form-input" id="fEmail" type="email" placeholder="customer@gmail.com" autoComplete="off" aria-describedby="warnEmail" />
              <div className="form-warning" id="warnEmail">⚠️ This email already exists for another customer.</div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="fAccountEmail">⚙️ Account email <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(our login for Lebara etc.)</span></label>
              <input className="form-input" id="fAccountEmail" type="email" placeholder="kosherconnect+levi@gmail.com" autoComplete="off" />
            </div>

            <div className="form-group form-full">
              <label className="form-label" htmlFor="fAddress">Address</label>
              <input className="form-input" id="fAddress" type="text" placeholder="123 Baker Street, London" autoComplete="off" />
            </div>

            <div className="form-group form-full">
              <label className="form-label" htmlFor="fNotes">📝 Notes <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(preferences, who they&apos;re related to, anything to remember)</span></label>
              <textarea className="form-input" id="fNotes" rows={2} placeholder="e.g. prefers the £20 US plan · pays end of month · brother of Yossi Adler" style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.4 }}></textarea>
            </div>

            <div className="form-group form-full">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" id="fPassportOnFile" style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
                🛂 Passport photocopy held
              </label>
            </div>

            <div className="form-warning form-full" id="warnName">
              ⚠️ A customer with this name already exists. Please verify this is a different person.
            </div>
          </div>

          <div className="modal-actions">
            <button className="btn btn-outline" id="btnCancelModal">Cancel</button>
            <button className="btn btn-primary" id="btnSaveCustomer">Save Customer</button>
          </div>
        </div>
      </div>

      <div id="toast-container" role="status" aria-live="polite" aria-atomic="false" />

      <Script src="/main.js" strategy="afterInteractive" />
      {/* Safety net: if main.js never loads (bad network), don't trap the user
          behind the splash — fade it out after 12s regardless. */}
      <Script id="kc-boot-safety" strategy="afterInteractive">
        {`setTimeout(function(){var b=document.getElementById('kcBoot');if(b&&!b.classList.contains('kc-boot-hide')){b.classList.add('kc-boot-hide');setTimeout(function(){b&&b.remove()},450);}},12000);`}
      </Script>
    </>
  )
}
