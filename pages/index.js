import Head from 'next/head'
import Script from 'next/script'

export default function Home() {
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

      {/* SIDEBAR */}
      <div className="sidebar">
        <div className="logo">
          <img src="/logo.svg" alt="KosherConnect" style={{ background: '#fff', padding: 6 }} />
          <div className="logo-title">KosherConnect</div>
          <div className="logo-sub">Business Management System</div>
        </div>

        <div className="nav-item active" data-tab="dashboard"><span className="nav-icon">🏠</span> Dashboard</div>
        <div className="nav-item" data-tab="customers"><span className="nav-icon">👥</span> Customers</div>
        <div className="nav-item" data-tab="rentals"><span className="nav-icon">📱</span> Phone Rentals</div>
        <div className="nav-item" data-tab="sim"><span className="nav-icon">💳</span> SIM Plans</div>
        <div className="nav-item" data-tab="bookings"><span className="nav-icon">✈️</span> Tickets &amp; Flights</div>
        <div className="nav-item" data-tab="repairs"><span className="nav-icon">🔧</span> Repairs</div>
        <div className="nav-item" data-tab="virtual"><span className="nav-icon">🔢</span> Virtual Numbers</div>
        <div className="nav-item" data-tab="tasks"><span className="nav-icon">✅</span> Tasks</div>
        <div className="nav-item" data-tab="settings"><span className="nav-icon">⚙️</span> Settings</div>

        <div className="sidebar-bottom">
          <a href="#" onClick={(e) => { e.preventDefault(); fetch('/api/auth/logout', { method: 'POST' }).then(() => { window.location.href = '/login' }) }}
             style={{ color: 'inherit', textDecoration: 'none' }}>🚪 Sign out</a>
          <div>Version 1.0 · KosherConnect</div>
        </div>
      </div>

      {/* MAIN */}
      <div className="main">
        <div className="topbar">
          <div className="page-title" id="pageTitle">Customer <span>Management</span></div>
          <div className="topbar-actions">
            <input className="search-box" id="searchBox" type="text" placeholder="🔍  Search by name, phone, email..." />
            <button className="btn btn-primary" id="btnNewCustomer">+ New Customer</button>
          </div>
        </div>

        <div className="content" id="mainContent" />
      </div>

      {/* ADD / EDIT CUSTOMER MODAL */}
      <div className="modal-overlay hidden" id="customerModal">
        <div className="modal">
          <div className="modal-title" id="modalTitle">➕ Add New Customer</div>
          <input type="hidden" id="editId" />

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">First Name *</label>
              <input className="form-input" id="fFirstName" type="text" placeholder="Menachem" autoComplete="off" />
              <span className="form-error" id="errFirstName">Required</span>
            </div>
            <div className="form-group">
              <label className="form-label">Last Name *</label>
              <input className="form-input" id="fLastName" type="text" placeholder="Adler" autoComplete="off" />
              <span className="form-error" id="errLastName">Required</span>
            </div>

            <div className="form-group form-full">
              <label className="form-label">Phone *</label>
              <div className="phone-row">
                <select className="country-select" id="fCountryCode">
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
                />
              </div>
              <span className="form-error" id="errPhone">Required</span>
              <div className="form-warning" id="warnPhone">⚠️ This phone number already exists for another customer.</div>
            </div>

            <div className="form-group form-full">
              <label className="form-label">Email</label>
              <input className="form-input" id="fEmail" type="email" placeholder="example@gmail.com" autoComplete="off" />
              <div className="form-warning" id="warnEmail">⚠️ This email already exists for another customer.</div>
            </div>

            <div className="form-group form-full">
              <label className="form-label">Address</label>
              <input className="form-input" id="fAddress" type="text" placeholder="123 Baker Street, London" autoComplete="off" />
            </div>

            <div className="form-group form-full" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
              <input
                type="checkbox"
                id="fWhatsapp"
                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--accent)' }}
              />
              <label htmlFor="fWhatsapp" style={{ fontSize: '14px', cursor: 'pointer' }}>Customer has WhatsApp</label>
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

      <div id="toast-container" />

      <Script src="/main.js" strategy="afterInteractive" />
    </>
  )
}

// Login gate: when auth is enabled (tables mode), an unauthenticated browser
// goes to /login. This checks cookie PRESENCE only — every API call verifies
// the token properly, and main.js redirects to /login on any 401.
export async function getServerSideProps({ req }) {
  const { authEnabled } = await import('../lib/auth.js')
  if (authEnabled && !(req.headers.cookie || '').includes('kc_session=')) {
    return { redirect: { destination: '/login', permanent: false } }
  }
  return { props: {} }
}
