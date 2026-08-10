// ─── API Bridge: replaces Electron IPC with fetch calls ───────────────────────

// Session-aware fetch: a 401 means the staff session ended — go sign in.
// (Returns a never-resolving promise during the redirect so callers don't
// try to render an error state that's about to be navigated away.)
function kcFetch(url, opts) {
  return fetch(url, opts).then(r => {
    if (r.status === 401) {
      window.location.href = '/login';
      return new Promise(() => {});
    }
    return r;
  });
}

// Idempotency token for money writes: a stable id sent with the request so a
// replayed / retried POST dedupes server-side (the ledger charge_reference is unique).
function kcRef() {
  try { if (self.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch {}
  return 'r-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

// Re-entrancy guard: stops a second concurrent submit of the same action (the
// double-click that would otherwise fire two charges) while the first is in flight.
const _kcInFlight = new Set();
function kcBeginWrite(key) { if (_kcInFlight.has(key)) return false; _kcInFlight.add(key); return true; }
function kcEndWrite(key) { _kcInFlight.delete(key); }

window.api = {
  getAllCustomers: () => kcFetch('/api/customers').then(r => r.json()),

  addCustomer: (c) => kcFetch('/api/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(c),
  }).then(r => r.json()),

  updateCustomer: (c) => kcFetch('/api/customers', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(c),
  }).then(r => r.json()),

  deleteCustomer: (id) => kcFetch('/api/customers?id=' + id, { method: 'DELETE' }).then(r => r.json()),

  confirmDelete: (msg) => Promise.resolve(window.confirm(msg)),

  exportCSV: () => kcFetch('/api/export-csv').then(async r => {
    if (!r.ok) return { success: false };
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customers.csv';
    a.click();
    URL.revokeObjectURL(url);
    return { success: true };
  }),

  // Whole-array save. `deletedIds` names the ids the user actually removed;
  // the server deletes ONLY those (nothing is wiped just for being absent).
  saveAllRentals: (data, deletedIds = []) => kcFetch('/api/rentals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: data, deletedIds }),
  }).then(r => r.json()),

  saveAllPhones: (data, deletedIds = []) => kcFetch('/api/phones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: data, deletedIds }),
  }).then(r => r.json()),

  saveAllSims: (data, deletedIds = []) => kcFetch('/api/sims', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: data, deletedIds }),
  }).then(r => r.json()),
  // Post one SIM charge to the wallet ledger (debit). Idempotent server-side.
  chargeSim: (p) => kcFetch('/api/sims', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'charge', ...p }),
  }).then(r => r.json()),

  addBooking: (b) => kcFetch('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(b),
  }).then(r => r.json()),
  updateBooking: (b) => kcFetch('/api/bookings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(b),
  }).then(r => r.json()),
  deleteBooking: (id) => kcFetch('/api/bookings', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  }).then(r => r.json()),

  getTravelReqView: (bookingId) =>
    kcFetch(`/api/travel-auth?bookingId=${encodeURIComponent(bookingId)}`)
      .then(r => (r.ok ? r.json() : { success: false, error: 'Travel view unavailable.' })),
  saveTravelAuth: (a) => kcFetch('/api/travel-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(a),
  }).then(r => r.json()),
  deleteTravelAuth: (id) => kcFetch(`/api/travel-auth?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }).then(r => r.json()),

  getRepairs: () => kcFetch('/api/repairs').then(r => r.ok ? r.json() : []),
  addRepair: (r) => kcFetch('/api/repairs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(r),
  }).then(r => r.json()),
  updateRepair: (r) => kcFetch('/api/repairs', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(r),
  }).then(r => r.json()),
  getServiceMenu: (category) => kcFetch('/api/services' + (category ? '?category=' + category : '')).then(r => r.ok ? r.json() : []),
  getServiceOrders: () => kcFetch('/api/service-orders').then(r => r.ok ? r.json() : []),
  addServiceOrder: (o) => kcFetch('/api/service-orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(o),
  }).then(r => r.json()),

  getTasks: () => kcFetch('/api/tasks').then(r => r.ok ? r.json() : []),
  addTask: (t) => kcFetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(t),
  }).then(r => r.json()),
  updateTask: (t) => kcFetch('/api/tasks', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(t),
  }).then(r => r.json()),

  getVirtualNumbers: () => kcFetch('/api/virtual-numbers').then(r => r.ok ? r.json() : []),
  addVirtualNumber: (v) => kcFetch('/api/virtual-numbers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(v),
  }).then(r => r.json()),
  updateVirtualNumber: (v) => kcFetch('/api/virtual-numbers', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(v),
  }).then(r => r.json()),
  deleteVirtualNumber: (id) => kcFetch('/api/virtual-numbers?id=' + encodeURIComponent(id), { method: 'DELETE' }).then(r => r.json()),

  getSettings: () => kcFetch('/api/settings').then(r => r.ok ? r.json() : null),
  updateSetting: (p) => kcFetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(p),
  }).then(r => r.json()),
  addSetting: (p) => kcFetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(p),
  }).then(r => r.json()),
  deleteSetting: (table, key) => kcFetch(`/api/settings?table=${encodeURIComponent(table)}&key=${encodeURIComponent(key)}`,
    { method: 'DELETE' }).then(r => r.json()),

  getLedger: (customerId) => kcFetch('/api/ledger?customerId=' + encodeURIComponent(customerId)).then(r => r.json()),
  addLedgerEntry: (e) => kcFetch('/api/ledger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(e),
  }).then(r => r.json()),
};

// ─────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────
let customers = [];
let filteredCustomers = [];
// Phone numbers for HUMANS — display-only grouping; storage stays canonical
// (+447974924585). Mirrors lib/ukPhone.mjs formatPhoneDisplay: UK mobiles
// 4-3-3 (+44 7974 924 585), UK landlines 3-3-4, +972 and +1 their usual
// shapes, sender IDs / short codes untouched. Use at every render site;
// never feed the output back into a save.
function fmtPhone(raw) {
  const s = String(raw == null ? '' : raw).trim();
  if (!s) return '';
  if (/[A-Za-z]/.test(s)) return s;
  let n = s.replace(/[\s().\-]/g, '');
  if (n.startsWith('00')) n = '+' + n.slice(2);
  const digits = n.replace(/\D/g, '');
  if (!n.startsWith('+')) {
    if (n.startsWith('44') && digits.length >= 11) n = '+' + n;
    else if (n.startsWith('0') && digits.length >= 10 && digits.length <= 12) n = '+44' + n.slice(1);
    // Bare international digits — the rental inventory stores handsets this
    // way ("17185998801"), so US/Canada/Israel numbers were rendering raw on
    // the availability calendar. Mirrors formatPhoneDisplay in lib/ukPhone.mjs;
    // change both together. Only an explicit country code with the right digit
    // count is promoted — a bare 10-digit number stays as it is, because it is
    // genuinely ambiguous.
    else if (/^1\d{10}$/.test(digits)) n = '+' + digits;
    else if (/^972\d{8,9}$/.test(digits)) n = '+' + digits;
    else return s;
  }
  const cc = ['+972', '+44', '+1'].find(c => n.startsWith(c));
  if (!cc) return n;
  const rest = n.slice(cc.length).replace(/\D/g, '');
  const group = (str, sizes) => {
    const out = []; let i = 0;
    for (const sz of sizes) { if (i >= str.length) break; out.push(str.slice(i, i + sz)); i += sz; }
    if (i < str.length) out.push(str.slice(i));
    return out.join(' ');
  };
  if (cc === '+44' && rest.length === 10) return '+44 ' + (rest[0] === '7' ? group(rest, [4, 3, 3]) : group(rest, [3, 3, 4]));
  if (cc === '+972' && rest.length === 9) return '+972 ' + group(rest, [2, 3, 4]);
  if (cc === '+972' && rest.length === 8) return '+972 ' + group(rest, [1, 3, 4]);
  if (cc === '+1' && rest.length === 10) return '+1 ' + group(rest, [3, 3, 4]);
  return cc + ' ' + rest;
}

// Mirror of WHATSAPP_ENABLED in lib/flags.js — main.js is a plain script and
// cannot import it. Change both together. Off = waLink() returns '' , which
// removes every "Open in WhatsApp" button (they are all guarded on it).
const WHATSAPP_ENABLED = false;

// WhatsApp deep link for a customer's phone. Only builds a wa.me URL — staff
// press send inside WhatsApp themselves, so this stays within the app's
// nothing-is-auto-sent discipline. Returns '' when there's no usable phone.
function waPhoneDigits(phone) {
  const s = String(phone == null ? '' : phone).trim();
  let d = s.replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '44' + d.slice(1); // UK local format
  else if (!s.startsWith('+') && d.length <= 10) d = '44' + d; // no country code
  return d;
}
function waLink(customer, text) {
  if (!WHATSAPP_ENABLED) return '';
  const digits = waPhoneDigits(customer && customer.phone);
  if (!digits) return '';
  return `https://wa.me/${digits}${text ? '?text=' + encodeURIComponent(text) : ''}`;
}

// Phone search that survives formatting: "07871 385566" must find a customer
// stored as "+44 7871385566". Engages only when the query holds 3+ digits;
// callers keep their name/email matching and OR this in.
function phoneDigitsMatch(query, customer) {
  const qd = String(query || '').replace(/\D/g, '');
  if (qd.length < 3 || !customer) return false;
  const hay = String(customer.phone || '').replace(/\D/g, '');
  if (!hay) return false;
  if (hay.includes(qd)) return true;
  return qd.startsWith('0') && hay.includes('44' + qd.slice(1));
}

// The master customers array stays sorted A–Z (first name, then surname) at
// all times: every picker in the app — rentals, bookings, SIMs, repairs,
// services, POS, VN, Kol Torah, tasks — renders straight off this array, so
// sorting here once beats sorting at nine call sites. The Customers tab still
// applies its own explicit sort (customerSort) on top when rendering rows.
// localeCompare so Hebrew/Yiddish names collate properly alongside English.
function sortCustomersAZ() {
  customers.sort((a, b) =>
    `${a.firstName || ''} ${a.lastName || ''}`.trim().localeCompare(
      `${b.firstName || ''} ${b.lastName || ''}`.trim(), undefined, { sensitivity: 'base' }));
}
let selectedId = null;
let currentTab = 'customers';
// Customer-360 page state: non-null while the full-page profile
// (/customers/<id>) is what the content column is showing. The card overlay
// and the page never show the same customer at once — renderDetailPanel
// redirects to the page when it's up.
let customerPageId = null;
let customerPageTab = 'overview'; // overview | activity
let customerPageCat = 'all';      // activity-log category filter
let searchTerm = '';
let customerSort = 'name'; // name | name_desc | owed | recent | services
let customerFilter = 'all'; // all | rental | flight | sim | vn | repair | arrears | passport

// ─────────────────────────────────────────────
//  INIT — called directly since script loads after DOM is ready
// ─────────────────────────────────────────────
// Which whole-array-saved collections failed to load. CRITICAL: rentals,
// phones and sims persist by POSTing the ENTIRE in-memory array — the server
// deletes any row not present. So if a load fails and we silently treat it as
// an empty list, the next whole-array save would DELETE every real row. We
// track the failure and hard-block those saves until a clean reload.
let loadFailed = {};

// Load an array endpoint safely: a rejected fetch, a non-OK status, or a body
// that isn't an array all count as FAILURE (not "empty") — recorded so saves
// are blocked. Returns [] for rendering either way.
async function safeLoadArray(key, url) {
  try {
    const r = await kcFetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    if (!Array.isArray(j)) throw new Error('not an array');
    loadFailed[key] = false;
    return j;
  } catch (e) {
    loadFailed[key] = true;
    return [];
  }
}

async function initApp() {
  // Everything loads in PARALLEL — one round-trip of wall-clock time instead
  // of ten. The three whole-array-saved collections (rentals/phones/sims) go
  // through safeLoadArray so a failed load can't masquerade as "empty" and
  // trigger a fleet-wide delete on the next save.
  const arr = v => (Array.isArray(v) ? v : []);
  loadFailed = {};
  const [cust, rent, ph, sm, bk, vn, rp, so, cfg, menu, me] = await Promise.all([
    // Customers and bookings go through safeLoadArray too. They aren't
    // whole-array saved, so this isn't about delete-protection — it's that a
    // failed load used to return [] indistinguishably from "none", and the
    // customers tab then said "No customers yet." over 751 real records.
    safeLoadArray('customers', '/api/customers'),
    safeLoadArray('rentals', '/api/rentals'),
    safeLoadArray('phones', '/api/phones'),
    safeLoadArray('sims', '/api/sims'),
    safeLoadArray('bookings', '/api/bookings'),
    window.api.getVirtualNumbers().catch(() => []),
    // Repairs + service orders load up-front too, so customer badges/services
    // reflect them before their tabs are ever opened (same as bookings/SIMs).
    window.api.getRepairs().catch(() => []),
    window.api.getServiceOrders().catch(() => []),
    window.api.getSettings().catch(() => null),
    window.api.getServiceMenu('sim').catch(() => []),
    kcFetch('/api/auth/me').then(r => r.json()).catch(() => null),
  ]);
  customers = arr(cust);
  sortCustomersAZ();
  filteredCustomers = [...customers];
  rentals = arr(rent);
  phones = arr(ph);
  sims = arr(sm);
  bookings = arr(bk);
  virtualNumbers = arr(vn);
  repairs = arr(rp);
  serviceOrders = arr(so);
  pricingConfig = cfg;
  // #42 — if the pricing settings didn't load, every price silently uses a
  // built-in fallback. Never silent: warn prominently so nobody charges at
  // the wrong rate.
  if (!cfg) {
    console.warn('[settings] pricing config failed to load — using built-in fallback rates');
    showReloadBanner('Couldn’t load your pricing settings — prices may be using built-in defaults. Reload before charging.');
  }
  simMenu = arr(menu);
  if (me?.success && me.authEnabled) {
    currentStaff = me.staff || null;
    allowedTabs = Array.isArray(me.allowedTabs) ? me.allowedTabs : null;
  }
  renderSidebarUser();
  // A failed load of a whole-array collection: warn, block saves, offer reload.
  const failedKeys = Object.keys(loadFailed).filter(k => loadFailed[k]);
  if (failedKeys.length) {
    // Only the whole-array collections have their saves paused (saveBlocked).
    // Customers and bookings save per row, so promising a pause that isn't
    // happening would be its own false statement.
    const paused = failedKeys.filter(k => ['rentals', 'phones', 'sims'].includes(k));
    showReloadBanner(`Couldn’t load ${failedKeys.join(', ')} — some data is missing.` +
      (paused.length ? ' Saving is paused to protect your records.' : ' Reload before relying on what you see.'));
  }
  if (allowedTabs && allowedTabs.length === 0) {
    document.getElementById('mainContent').innerHTML = `<div class="empty-state">
      <div class="emoji">🔒</div>
      <p>No areas are enabled for your account.</p>
      <small>Ask the owner to set them under Settings → Team, then sign in again.</small></div>`;
    return;
  }
  applyTabVisibility();
  reconcilePhoneStatuses();
  // Open the tab named in the URL (/rentals …), defaulting to the dashboard.
  // A path a helper isn't allowed drops to their first permitted tab.
  let startTab = tabFromPath();
  if (allowedTabs && !allowedTabs.includes(startTab)) {
    startTab = allowedTabs.includes('dashboard') ? 'dashboard' : allowedTabs[0];
  }
  syncNavActive(startTab);
  // /customers/<id> deep-link: open the full-page profile, not the list.
  // (startTab already passed the allowedTabs gate above, so a helper without
  // the Customers tab never reaches the profile either.)
  const startCustomer = startTab === 'customers' ? customerIdFromPath() : null;
  if (startCustomer) {
    renderCustomerPage(startCustomer);
    pushCustomerUrl(startCustomer, true);
  } else {
    pushTabUrl(startTab, true); // canonicalise the address bar without a history entry
    renderTab(startTab);
  }
  hideBootLoader(); // first tab painted — reveal the app

  setupNav();
  setupSearch();
  setupModal();
  setupTopbarButtons();
  updateThemeBtns(); // sync the persistent topbar toggle's icon to the saved theme
  updateTextSizeBtns(); // …and the Simple Mode button's label to the saved size
  document.addEventListener('click', e => {
    if (!e.target.closest('.cs-wrap')) {
      document.querySelectorAll('.cs-list.open').forEach(el => el.classList.remove('open'));
    }
  });
  // Same-day ⏰ reminders: check every 20s while the app is open.
  checkLocalReminders();
  setInterval(checkLocalReminders, 20000);
}

function reconcilePhoneStatuses() {
  // NEVER reconcile on incomplete data: if rentals or phones failed to load,
  // the derived statuses would be wrong and a save would persist a fleet-wide
  // wipe. This read used to trigger a destructive whole-fleet write on init.
  if (loadFailed.rentals || loadFailed.phones) return;
  const activePhoneIds = new Set(
    rentals.filter(r => r.status === 'active' || r.status === 'overdue').map(r => r.phoneId)
  );
  // A line imported from the rental sheet is 'rented' because the sheet said
  // so: the rental itself predates the app and has NO record here. Without
  // this guard the loop below reads "rented but no active rental" as "must
  // have been returned" and frees the phone — on the 114-line import that is
  // 77 phones marked available on first page load, saved, in one pass, with
  // no way to tell which. Only lines the app itself tracks get reconciled.
  const tracked = new Set(rentals.map(r => r.phoneId));
  let changed = false;
  phones.forEach(p => {
    const shouldBeRented = activePhoneIds.has(p.id);
    if (shouldBeRented && p.status !== 'rented') {
      p.status = 'rented';
      changed = true;
    } else if (!shouldBeRented && p.status === 'rented') {
      if (p.importSource && !tracked.has(p.id)) return;   // held off-system
      p.status = 'available';
      changed = true;
    }
  });
  if (changed) window.api.saveAllPhones(phones);
}

// Prominent, dismiss-proof banner when critical data failed to load. Saving
// stays blocked until the operator reloads and everything loads cleanly.
function showReloadBanner(msg) {
  if (document.getElementById('kcReloadBanner')) return;
  const b = document.createElement('div');
  b.id = 'kcReloadBanner';
  b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:6000;background:var(--danger-solid);color:#fff;padding:11px 18px;text-align:center;font-size:var(--fs-ui);font-weight:500;box-shadow:0 2px 8px rgba(0,0,0,.2);';
  b.innerHTML = `⚠️ ${escHtml(msg)} <button onclick="location.reload()" style="margin-left:12px;background:#fff;color:var(--danger-solid);border:none;border-radius:7px;padding:5px 14px;cursor:pointer;font-weight:700;">↻ Reload</button>`;
  document.body.appendChild(b);
}

// The three whole-array savers refuse to write while that collection's load
// failed — the save would delete every row the server still holds.
function saveBlocked(key) {
  if (loadFailed[key]) {
    toast(`${key} didn’t load fully — reload before saving so nothing is lost.`, 'error');
    showReloadBanner(`Couldn’t load ${key} — saving is paused to protect your records.`);
    return true;
  }
  return false;
}

// ─────────────────────────────────────────────
//  NAVIGATION
// ─────────────────────────────────────────────
// ── URL ⇄ tab (deep-linkable screens) ─────────────────────────────────────
// Each tab has its own path: /rentals, /customers … and the dashboard at "/".
// pages/[tab].js serves the same shell for those paths, so a refresh or a
// shared link opens the right screen. Here we keep the address bar in step as
// the operator navigates, and honour the browser Back / Forward buttons.
function tabFromPath() {
  const seg = (location.pathname || '/').replace(/^\/+|\/+$/g, '').split('/')[0].toLowerCase();
  return TAB_META[seg] ? seg : 'dashboard';
}
function tabUrl(tab) { return tab === 'dashboard' ? '/' : '/' + tab; }
function pushTabUrl(tab, replace) {
  const url = tabUrl(tab);
  if (location.pathname === url) return; // already there — no duplicate entry
  try { history[replace ? 'replaceState' : 'pushState']({ kcTab: tab }, '', url); }
  catch { /* history API blocked (e.g. sandboxed) — navigation still works */ }
}
// The Customer-360 page lives one segment deeper: /customers/<id>.
// pages/customers/[id].js serves the same shell for it, so a refresh or a
// link pasted to a colleague lands on the profile, not the list.
function customerIdFromPath() {
  const parts = (location.pathname || '/').replace(/^\/+|\/+$/g, '').split('/');
  return parts[0] === 'customers' && parts[1] ? decodeURIComponent(parts[1]) : null;
}
function pushCustomerUrl(id, replace) {
  const url = '/customers/' + encodeURIComponent(id);
  if (location.pathname === url) return; // already there — no duplicate entry
  try { history[replace ? 'replaceState' : 'pushState']({ kcTab: 'customers', kcCustomer: String(id) }, '', url); }
  catch { /* history API blocked (e.g. sandboxed) — navigation still works */ }
}
function syncNavActive(tab) {
  document.querySelectorAll('.nav-item').forEach(n => {
    const on = n.dataset.tab === tab;
    n.classList.toggle('active', on);
    // The active tab was carried by colour alone; aria-current states it.
    if (on) n.setAttribute('aria-current', 'page'); else n.removeAttribute('aria-current');
  });
}

// Small "signed in as" identity in the sidebar footer. Handy when staff share
// a counter — it makes clear who the communication log / cash-up will attribute
// actions to. Stays hidden when auth is disabled (no staff to show).
function renderSidebarUser() {
  const el = document.getElementById('sidebarUser');
  if (!el) return;
  const name = (currentStaff && String(currentStaff.full_name || currentStaff.email || '').trim()) || '';
  if (!name) { el.hidden = true; el.innerHTML = ''; return; }
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || name[0].toUpperCase();
  const role = currentStaff.role === 'owner' ? 'Admin' : 'Helper';
  el.innerHTML = `
    <span class="su-avatar">${escHtml(initials)}</span>
    <span class="su-meta">
      <span class="su-name" title="${escHtml(name)}">${escHtml(name)}</span>
      <span class="su-role">${escHtml(role)}</span>
    </span>`;
  el.hidden = false;
}

function setupNav() {
  document.querySelectorAll('.nav-item').forEach(item => {
    // These are <div>s — give them real button semantics so Tab/Enter/Space work. U11.
    if (!item.hasAttribute('role')) item.setAttribute('role', 'button');
    if (!item.hasAttribute('tabindex')) item.tabIndex = 0;
    item.addEventListener('click', () => {
      const tab = item.dataset.tab;
      syncNavActive(tab);
      currentTab = tab;
      renderTab(tab);
      pushTabUrl(tab); // reflect the screen in the address bar (new history entry)
    });
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); item.click(); }
    });
  });
  // B8 — phone drawer. The burger slides the sidebar in; the scrim, Escape,
  // or choosing any destination slides it back out.
  // On desktop the same burger instead collapses the sidebar to an icon rail
  // (body.nav-collapsed, ⌘B/Ctrl+B too), remembered per browser. Two good
  // states — full or rail — no drag-to-resize by design.
  const burger = document.getElementById('navBurger');
  const scrim = document.getElementById('navScrim');
  const isPhone = () => window.matchMedia('(max-width: 820px)').matches;
  const setNavOpen = (open) => {
    document.body.classList.toggle('nav-open', open);
    burger?.setAttribute('aria-expanded', String(open));
  };
  const setCollapsed = (on) => {
    document.body.classList.toggle('nav-collapsed', on);
    burger?.setAttribute('aria-label', on ? 'Expand menu' : 'Collapse menu');
    // Rail rows show icons only — surface each label as a native tooltip.
    document.querySelectorAll('.sidebar .nav-item, .sidebar .nav-link, .sidebar .sb-row').forEach(el => {
      if (on) el.title = el.textContent.trim();
      else el.removeAttribute('title');
    });
    try { localStorage.setItem('kcNavCollapsed', on ? '1' : '0'); } catch { /* private mode */ }
  };
  window.kcToggleNav = () => {
    if (isPhone()) setNavOpen(!document.body.classList.contains('nav-open'));
    else setCollapsed(!document.body.classList.contains('nav-collapsed'));
  };
  try {
    if (!isPhone() && localStorage.getItem('kcNavCollapsed') === '1') setCollapsed(true);
  } catch { /* private mode */ }
  burger?.addEventListener('click', window.kcToggleNav);
  scrim?.addEventListener('click', () => setNavOpen(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('nav-open')) setNavOpen(false);
  });
  document.getElementById('appSidebar')?.addEventListener('click', (e) => {
    if (e.target.closest('.nav-item, .nav-link, .sb-row')) setNavOpen(false);
  });
  // U15 — click-only chips (equipment toggles, click-to-copy values) carry
  // role=button tabindex=0 in their markup; activate them on Enter/Space too.
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target?.matches?.('.eq-btn, .copy-val')) {
      e.preventDefault();
      e.target.click();
    }
  });
  // A focused type=number field takes wheel events and silently changes the
  // figure — on a trackpad, scrolling past a filled-in payment box edits the
  // amount with no keystroke and no undo. Blur instead, so the scroll scrolls.
  // Passive: we never preventDefault, the page must keep scrolling normally.
  document.addEventListener('wheel', (e) => {
    const el = document.activeElement;
    if (el && el.type === 'number' && el === e.target) el.blur();
  }, { passive: true });
  // Back / Forward: re-open whatever tab the URL now points at.
  window.addEventListener('popstate', () => {
    const tab = tabFromPath();
    if (allowedTabs && !allowedTabs.includes(tab)) {
      // Back/Forward landed on a tab this helper can't see. Don't leave the URL
      // pointing at forbidden content while the pane still shows the previous tab —
      // re-render an allowed tab and replaceState the URL to match it. audit C22.
      const safe = (allowedTabs.includes(currentTab) ? currentTab : allowedTabs[0]) || 'dashboard';
      syncNavActive(safe);
      currentTab = safe;
      renderTab(safe);
      pushTabUrl(safe, true); // replaceState — keep URL and content in step
      return;
    }
    syncNavActive(tab);
    currentTab = tab;
    // Back/Forward can land on a profile URL (/customers/<id>) as well as a
    // tab — re-open whichever the address now names.
    const cid = tab === 'customers' ? customerIdFromPath() : null;
    if (cid) renderCustomerPage(cid);
    else renderTab(tab);
  });
}

// ── Helper visibility ─────────────────────────────────────────────────────
let currentStaff = null;   // { id, role, full_name, email }
let allowedTabs = null;    // null = everything (owner / auth off)

function applyTabVisibility() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.style.display = (allowedTabs && !allowedTabs.includes(item.dataset.tab)) ? 'none' : '';
  });
  // A group heading names the rows beneath it, so it has to go when they all
  // do. Hiding the items alone left a helper looking at "SERVICES" with
  // nothing under it and the next heading directly below — a label for an
  // empty set. Walk the list in order: each heading owns every row until the
  // next heading, and survives only if one of them is still on screen.
  let label = null, kept = false;
  const settle = () => { if (label) label.style.display = kept ? '' : 'none'; };
  for (const el of document.querySelectorAll('.sidebar-nav > *')) {
    if (el.classList.contains('nav-group-label')) { settle(); label = el; kept = false; }
    else if (el.style.display !== 'none') kept = true;
  }
  settle();
}

// #49 / #58 — ONE source of truth per destination: its human label, its page
// title, its render fn, whether the search box shows, and (optionally) its
// create action. The sidebar, the <title>, the palette navigate list and the
// topbar's context primary button all read this map, so a rename happens once.
const TAB_META = {
  dashboard: { label: 'Dashboard',         title: 'Business <span>Dashboard</span>',    render: () => renderDashboardTab(), search: false },
  customers: { label: 'Customers',         title: 'Customer <span>Management</span>',   render: () => renderCustomersTab(), search: true,  primary: { label: '+ New Customer', run: () => openAddModal() } },
  rentals:   { label: 'Phone Rentals',     title: 'Phone <span>Rentals</span>',         render: () => renderRentalsTab(),   search: false, primary: { label: '+ New Rental',   run: () => openNewRentalModal() } },
  sim:       { label: 'SIM Plans',         title: 'SIM <span>Plans</span>',             render: () => renderSimsTab(),      search: false, primary: { label: '+ New SIM Plan', run: () => openAddSimModal() } },
  bookings:  { label: 'Tickets & Flights', title: 'Tickets <span>&amp; Flights</span>', render: () => renderBookingsTab(),  search: false, primary: { label: '+ New Booking',  run: () => openNewBookingModal() } },
  wallet:    { label: 'Wallet',            title: 'Wallet <span>&amp; Ledger</span>',   render: () => renderWalletTab(),    search: false },
  repairs:   { label: 'Repairs',           title: 'Phone <span>Repairs</span>',         render: () => renderRepairsTab(),   search: false, primary: { label: '+ New Repair',   run: () => openNewRepairModal() } },
  services:  { label: 'Online & Print',    title: 'Online <span>&amp; Print</span>',    render: () => renderServicesTab(),  search: false, primary: { label: '+ New Service',  run: () => openNewServiceModal() } },
  shop:      { label: 'Shop',              title: 'Shop <span>&amp; Stock</span>',      render: () => renderShopTab(),      search: false },
  koltorah:  { label: 'Kol Torah',         title: 'Kol <span>Torah</span>',             render: () => renderKolTorahTab(),  search: false, primary: { label: '+ New Job',      run: () => ktFocusNewJob() } },
  tasks:     { label: 'Tasks',             title: 'Task <span>List</span>',             render: () => renderTasksTab(),     search: false },
  virtual:   { label: 'Virtual Numbers',   title: 'Virtual <span>Numbers</span>',       render: () => renderVirtualTab(),   search: false, primary: { label: '+ New Number',   run: () => openNewVNModal() } },
  settings:  { label: 'Settings',          title: 'System <span>Settings</span>',       render: () => renderSettingsTab(),  search: false },
};
let tabPrimaryAction = null; // #58 — what the topbar primary button does on this tab

// Content never pops in on a single frame — each tab paint re-runs a quiet
// fade + 5px rise on the content column (DESIGN.md §Motion, "Enter"). A
// keyframe restart so rapid tab-hopping always plays from the top; the
// reduced-motion umbrella makes it effectively instant.
function kcContentEnter() {
  const el = document.getElementById('mainContent');
  if (!el) return;
  el.classList.remove('tab-enter');
  void el.offsetWidth; // reflush so re-adding the class restarts the animation
  el.classList.add('tab-enter');
}

function renderTab(tab) {
  if (allowedTabs && !allowedTabs.includes(tab)) {
    toast('That area is not enabled for your account.', 'warning');
    return;
  }
  // #6 — keep currentTab in sync no matter how we got here (nav click OR a
  // direct renderTab() on first load), so async repaints (the dashboard's
  // fresh-money pass) don't skip because currentTab still said 'customers'.
  currentTab = tab;
  // Leaving the full-page profile via any nav: drop the page state AND the
  // selection — otherwise renderCustomersTab would see selectedId and pop the
  // card overlay open the moment the list renders.
  if (customerPageId) { customerPageId = null; selectedId = null; }
  document.body.classList.remove('pos-mode'); // leaving the till via any nav
  const searchBox = document.getElementById('searchBox');
  const btnNew = document.getElementById('btnNewCustomer');
  const meta = TAB_META[tab] || TAB_META.customers; // unknown ids fall back to Customers

  document.getElementById('pageTitle').innerHTML = meta.title;
  if (searchBox) searchBox.style.display = meta.search ? '' : 'none';
  // #58 — the one topbar primary button becomes this tab's create action
  // instead of hiding on every tab but Customers.
  if (btnNew) {
    if (meta.primary) {
      btnNew.style.display = '';
      btnNew.textContent = meta.primary.label;
      tabPrimaryAction = meta.primary.run;
    } else {
      btnNew.style.display = 'none';
      tabPrimaryAction = null;
    }
  }
  kcContentEnter();
  meta.render();
}

// ─────────────────────────────────────────────
//  DATE FORMAT HELPER
// ─────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  // Accept a plain date (YYYY-MM-DD) or a full ISO timestamp
  // (2026-07-13T16:03:02.6+00:00) — take just the date part either way.
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  if (!y || !m || !d) return '—';
  // "5 Aug 2026", not "05/08/2026". Two formats were in play across the app —
  // this function at 78 call sites (including the customer-facing SMS drafts)
  // and a long-form one in SIM history, the wallet and the portal. Converging
  // here converges all 78, and the unambiguous form is the right one to send a
  // customer: 05/08 and 08/05 are different days on either side of the Atlantic.
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mi = parseInt(m, 10) - 1;
  if (!(mi >= 0 && mi < 12)) return '—';
  return String(parseInt(d, 10)) + ' ' + MONTHS[mi] + ' ' + y;
}

// "Thu 2 Apr" — fmtDate minus the year, plus the weekday. Used inside a date
// range that already states the year, where the weekday is the load-bearing
// part: on a rental breakdown you are checking that the free day really is the
// Saturday, and "2 Apr 2026" does not let you.
function fmtDayDate(iso) {
  if (!iso) return '—';
  const d = parseLocalDate(iso);
  if (isNaN(d)) return '—';
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// ── Charge Gate (client mirror) ───────────────────────────────────────────
// Mirrors lib/chargeGate.mjs EXACTLY. That module is the canonical, unit-tested
// statement of the rules and the server enforces it in syncRentals; this is the
// same logic again because the browser has no bundler to import it — the same
// arrangement priceFromDays has with lib/rentalMath.mjs. Change both together.
//
// The gate asks the questions that must be answered before a rental can be
// closed and charged. It is here rather than only on the server so the operator
// finds out while the customer is still at the counter, which is the only
// moment the questions can actually be answered.
const GATE_BLOCK = 'block', GATE_VERIFY = 'verify', GATE_PASS = 'pass';
const GATE_ITEM_LABELS = { phone: 'the phone', sim: 'the SIM', charger: 'the charger' };

function gateItemStatus(r, key) {
  const st = r.itemStatus || {}, legacy = r.returnedItems || {};
  if (key === 'charger') {
    const parts = ['plug', 'cable'].map(k =>
      st[k] !== undefined ? st[k] : (legacy[k] === true ? 'returned' : 'undecided'));
    if (parts.includes('undecided')) return 'undecided';
    return parts.includes('lost') ? 'lost' : 'returned';
  }
  if (st[key] !== undefined) return st[key];
  return legacy[key] === true ? 'returned' : 'undecided';
}

function gateWasGiven(r, key) {
  const eq = r.equipmentGiven;
  if (!eq) return true;
  if (key === 'charger') return (eq.plug ?? false) || (eq.cable ?? false);
  return eq[key] ?? false;
}

function gateLostAmount(r, key) {
  const lost = r.lostCharges || {};
  if (key === 'charger') return Number(lost.plug) || Number(lost.cable) || 0;
  return Number(lost[key]) || 0;
}

function gateFor(rental, { today, verifications = [] } = {}) {
  const r = rental || {};
  const signed = new Set(verifications);
  const checks = [];
  const add = (id, state, label, detail) => checks.push({ id, state, label, detail });
  const round2 = v => Math.round(((Number(v) || 0) + Number.EPSILON) * 100) / 100;

  const undecided = [], unpriced = [];
  for (const key of ['phone', 'sim', 'charger']) {
    if (!gateWasGiven(r, key)) continue;
    const st = gateItemStatus(r, key);
    if (st === 'undecided') undecided.push(GATE_ITEM_LABELS[key]);
    else if (st === 'lost' && !(gateLostAmount(r, key) > 0)) unpriced.push(GATE_ITEM_LABELS[key]);
  }
  if (undecided.length) add('equipment', GATE_BLOCK, 'Equipment accounted for',
    `Still undecided: ${undecided.join(', ')}. Mark each one returned or lost.`);
  else if (unpriced.length) add('equipment', GATE_BLOCK, 'Equipment accounted for',
    `Marked lost with no charge: ${unpriced.join(', ')}. Put a figure on it, or £0 if you are waiving it.`);
  else add('equipment', GATE_PASS, 'Equipment accounted for', 'Every item that went out is settled.');

  if (r.fromDate && r.toDate && r.toDate < r.fromDate)
    add('dates', GATE_BLOCK, 'Dates make sense', 'The return date is before the pickup date.');
  else if (today && r.toDate && r.toDate > today)
    add('dates', GATE_VERIFY, 'Dates make sense',
      `Closing a rental that runs until ${fmtDate(r.toDate)}. Confirm the phone is back early.`);
  else add('dates', GATE_PASS, 'Dates make sense', 'Pickup and return dates are in order.');

  const deposit = Number(r.depositHeld) || 0;
  if (deposit > 0 && !r.depositSettled)
    add('deposit', GATE_BLOCK, 'Deposit settled',
      `${fmtGbp(deposit)} is still held. Refund it or apply it to the bill.`);
  else if (deposit > 0) add('deposit', GATE_PASS, 'Deposit settled', 'The deposit has been refunded or applied.');
  else add('deposit', GATE_PASS, 'Deposit settled', 'No deposit was taken.');

  const owed = round2((Number(r.price) || 0) + (Number(r.lateFee) || 0) +
    (Number(r.lostChargesTotal) || 0) - (Number(r.amountPaid) || 0));
  if (owed > 0) add('balance', signed.has('balance') ? GATE_PASS : GATE_VERIFY, 'Balance agreed',
    `${fmtGbp(owed)} will stay on the customer's account.`);
  else if (owed < 0) add('balance', signed.has('balance') ? GATE_PASS : GATE_VERIFY, 'Balance agreed',
    `${fmtGbp(Math.abs(owed))} overpaid — it will sit as credit on the account.`);
  else add('balance', GATE_PASS, 'Balance agreed', 'Paid in full.');

  for (const c of checks) if (c.state === GATE_VERIFY && signed.has(c.id)) c.state = GATE_PASS;

  const blockers = checks.filter(c => c.state === GATE_BLOCK);
  const needsVerification = checks.filter(c => c.state === GATE_VERIFY);
  return { checks, blockers, needsVerification, canClose: !blockers.length && !needsVerification.length };
}

// Sign-offs given in this Manage session, cleared when the modal opens. They
// are per-rental and deliberately not persisted client-side: a sign-off is
// about the numbers in front of you, so reopening the modal asks again.
let mgGateVerified = new Set();
let mgGateRentalId = null;

// The rental as the operator is ABOUT TO SAVE it — not as it is stored. The
// gate has to judge the pending edit, or it approves the previous state and
// blocks nothing.
function mgDraftRental(rentalId) {
  const r = rentals.find(x => x.id === rentalId);
  if (!r) return null;
  const lost = mgComputeLostCharges();
  const draft = {
    ...r,
    fromDate: document.getElementById('mgFrom')?.value || r.fromDate,
    toDate: document.getElementById('mgTo')?.value || r.toDate,
    price: parseFloat(document.getElementById('mgPrice')?.value) || 0,
    amountPaid: parseFloat(document.getElementById('mgPaid')?.value) || 0,
    lateFee: mgComputeLateFee(),
    lostChargesTotal: lost.total,
    depositSettled: document.getElementById('mgDepositSettled')?.checked || r.depositSettled || false,
    itemStatus: {},
    lostCharges: {},
    equipmentGiven: {
      phone: document.getElementById('mgGivenPhone')?.dataset.given === '1',
      sim: document.getElementById('mgGivenSim')?.dataset.given === '1',
      plug: document.getElementById('mgGivenCharger')?.dataset.given === '1',
      cable: document.getElementById('mgGivenCharger')?.dataset.given === '1',
    },
  };
  // Same charger fan-out the save does: one UI control, two stored keys.
  MG_UI_ITEMS.forEach(item => {
    const st = document.getElementById('mgItemStatus_' + item)?.value || 'undecided';
    const amt = st === 'lost' ? (parseFloat(document.getElementById('mgLostAmt_' + item)?.value) || null) : null;
    if (item === 'charger') {
      draft.itemStatus.plug = st; draft.itemStatus.cable = st;
      draft.lostCharges.plug = amt; draft.lostCharges.cable = null;
    } else {
      draft.itemStatus[item] = st;
      draft.lostCharges[item] = amt;
    }
  });
  return draft;
}

const GATE_ICON = { block: '⛔', verify: '✍️', pass: '✓' };

// The panel. Shown only while the Returned toggle is on — the gate is about
// closing, and a rental still running has nothing to answer for yet.
function mgRenderGate(rentalId) {
  const box = document.getElementById('mgGateBox');
  const btn = document.getElementById('mgSaveBtn');
  if (!box) return;
  const closing = document.getElementById('mgReturned')?.value === '1';
  if (!closing) {
    box.innerHTML = '';
    box.style.display = 'none';
    if (btn) { btn.disabled = false; btn.title = ''; }
    return;
  }
  const draft = mgDraftRental(rentalId);
  const gate = gateFor(draft, { today: localISO(), verifications: [...mgGateVerified] });
  box.style.display = 'block';
  box.innerHTML = `
    <div class="kc-gate-head">${gate.canClose
      ? '✓ Ready to close'
      : gate.blockers.length ? '⛔ Not ready to close' : '✍️ Needs a sign-off'}</div>
    ${gate.checks.map(c => `
      <div class="kc-gate-row is-${c.state}">
        <span class="kc-gate-icon" aria-hidden="true">${GATE_ICON[c.state]}</span>
        <span class="kc-gate-text"><strong>${escHtml(c.label)}</strong>
          <span class="kc-gate-detail">${escHtml(c.detail)}</span></span>
        ${c.state === GATE_VERIFY ? `<button type="button" class="btn btn-outline btn-sm kc-gate-sign"
          onclick="mgSignGate('${escHtml(rentalId)}','${escHtml(c.id)}')">Sign off</button>` : ''}
      </div>`).join('')}`;
  if (btn) {
    btn.disabled = !gate.canClose;
    btn.title = gate.canClose ? '' : (gate.blockers[0] || gate.needsVerification[0])?.detail || '';
  }
}

function mgSignGate(rentalId, checkId) {
  mgGateVerified.add(checkId);
  mgRenderGate(rentalId);
}

// ── Device chip ───────────────────────────────────────────────────────────
// One way to show a rental handset, everywhere one appears.
//
// The same device was being rendered several different ways on one screen. The
// Rentals table printed the raw stored string — "+15185550101" — while the
// Phone Inventory table two sections below it printed "+1 518 555 0101" for
// the same handset, because one call site ran fmtPhone and the other did not.
// The model, which is what staff actually say out loud at the counter ("the
// Nokia"), appeared on the inventory row and nowhere else. And the country was
// a flag emoji built by a ternary chain written out three separate times.
//
// A chip fixes all of that by being the only thing that knows how to draw a
// device: number formatted once, model attached, country named. Nothing here is
// new information — it is the same fields, said the same way twice.
const COUNTRY_FLAGS = { USA: '🇺🇸', Israel: '🇮🇱', UK: '🇬🇧', Canada: '🇨🇦', EU: '🇪🇺' };

// Flags are decoration: they read as a blank or as "regional indicator symbol"
// to a screen reader, so the country always travels as text beside them.
function countryFlag(country) {
  return COUNTRY_FLAGS[country] || '🌍';
}

// `device` is a phone object, or a bare number string — the rental record
// carries phoneNumber but the inventory carries the whole handset, and both
// call sites want the same chip. A string is looked up so it gains the model
// and country the record never had; an unknown number still renders, formatted.
function deviceChip(device, { flag = true, model = true, stacked = false, extra = '' } = {}) {
  const p = (device && typeof device === 'object')
    ? device
    : ((typeof phones !== 'undefined' && phones) || []).find(x => x.number === device) || { number: device };
  const number = fmtPhone(p.number) || '—';
  const country = p.country || '';
  return `<span class="kc-device${stacked ? ' is-stacked' : ''}">` +
    `<span class="kc-device-num">` +
      (flag && country ? `<span aria-hidden="true">${countryFlag(country)}</span> ` : '') +
      escHtml(number) +
      (flag && country ? `<span class="kc-sr-only"> (${escHtml(country)})</span>` : '') +
    `</span>` +
    (model && p.model ? `<span class="kc-device-model">${escHtml(p.model)}</span>` : '') +
    (extra ? `<span class="kc-device-model">${extra}</span>` : '') +
    `</span>`;
}

// The chip for a rental's handset.
//
// The NUMBER always comes from the rental. It is that rental's record of which
// handset actually went out, it survives the phone being edited or deleted from
// stock, and a contract that quietly starts naming a different device than the
// one handed over is worse than one with an out-of-date model on it.
//
// The inventory is consulted only to add the model and the country, and only
// when it still agrees about the number: a phoneId whose record now reads
// differently is a line that was re-keyed or a handset that was replaced, and
// borrowing its model would put the wrong device on the row. (The offline seed
// has exactly this shape by accident — three rentals, three numbers, one
// phoneId — which is how the rule got written down.)
function rentalDeviceChip(rental, opts = {}) {
  const live = ((typeof phones !== 'undefined' && phones) || [])
    .find(x => x.id === rental.phoneId && x.number === rental.phoneNumber);
  return deviceChip({
    number: rental.phoneNumber,
    country: live?.country || rental.country,
    model: live?.model,
  }, opts);
}

// ── DateStamp ─────────────────────────────────────────────────────────────
// A date, plus — when there is one — the reason it was left out of a charge.
//
// The rental breakdown could previously say "3 free days (Shabbos / Yom Tov)"
// and not one word more, so nobody at the counter could check the arithmetic:
// not which three days, not why, not whether the calendar behind it was even
// right. It was not. Every yom tov in the shipped table sat a day early (see
// the DIASPORA_YOM_TOV header) and no screen in the app could have shown it,
// because no screen in the app ever printed the dates it was excluding.
//
// So this is the primitive that makes an exclusion legible: struck-through
// date, reason beside it, and a title for the pointer. Returns HTML —
// everything here is innerHTML — and escapes its own reason.
function dateStamp(iso, { excluded = false, reason = '', weekday = true } = {}) {
  const label = weekday ? fmtDayDate(iso) : fmtDate(iso);
  const why = String(reason || '');
  return `<span class="kc-datestamp${excluded ? ' is-excluded' : ''}"${why ? ` title="${escHtml(why)}"` : ''}>` +
    `<span class="kc-ds-date">${escHtml(label)}</span>` +
    (why ? `<span class="kc-ds-why">${escHtml(why)}</span>` : '') +
    `</span>`;
}

// The free days of a rental window, rendered as a wrapped row of DateStamps.
// Returns '' when nothing was excluded, so callers can drop it in unguarded.
function freeDayStamps(fromDate, toDate) {
  const days = freeDaysIn(fromDate, toDate);
  if (!days.length) return '';
  return `<div class="kc-ds-list">${days
    .map(d => dateStamp(d.iso, { excluded: true, reason: d.reason }))
    .join('')}</div>`;
}

// ─────────────────────────────────────────────
//  HEBREW DATE HELPER
// ─────────────────────────────────────────────
function numToHebrew(n) {
  const ones  = ['','א','ב','ג','ד','ה','ו','ז','ח','ט'];
  const tens  = ['','י','כ','ל','מ','נ','ס','ע','פ','צ'];
  const hunds = ['','ק','ר','ש','ת','תק','תר','תש','תת','תתק'];
  let result = '';
  const h = Math.floor(n/100); n %= 100;
  result += hunds[h] || '';
  if (n === 15) return result + 'ט״ו';
  if (n === 16) return result + 'ט״ז';
  const t = Math.floor(n/10); const o = n%10;
  const mid = (tens[t]||'') + (ones[o]||'');
  if (mid.length > 1) result += mid.slice(0,-1) + '״' + mid.slice(-1);
  else if (mid.length === 1) result += mid + '׳';
  return result;
}

function showHebrewDate(inputId, labelId) {
  const val = document.getElementById(inputId)?.value;
  const el  = document.getElementById(labelId);
  if (!el) return;
  if (!val) { el.textContent = ''; return; }
  try {
    const d = new Date(val + 'T12:00:00');
    const parts = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
      day: 'numeric', month: 'long', year: 'numeric'
    }).formatToParts(d);
    const dayNum   = parseInt(parts.find(p=>p.type==='day')?.value || '0');
    const monthStr = parts.find(p=>p.type==='month')?.value || '';
    const yearNum  = parseInt(parts.find(p=>p.type==='year')?.value || '0');
    el.textContent = numToHebrew(dayNum) + ' ' + monthStr + ' ' + numToHebrew(yearNum);
  } catch(e) { el.textContent = ''; }
}

// ─────────────────────────────────────────────
//  CUSTOMER SEARCH DROPDOWN (rental modal)
// ─────────────────────────────────────────────
let selectedRentalCustomerId = '';

function filterCustomerDropdown() {
  const input = document.getElementById('rCustomerSearch');
  const dropdown = document.getElementById('rCustomerDropdown');
  const hiddenInput = document.getElementById('rCustomer');
  const selectedDiv = document.getElementById('rCustomerSelected');
  if (!input || !dropdown) return;

  const term = input.value.trim().toLowerCase();
  selectedRentalCustomerId = '';
  hiddenInput.value = '';
  selectedDiv.textContent = '';

  if (!term) { dropdown.classList.remove('open'); return; }

  const matches = customers.filter(c =>
    (`${c.firstName} ${c.lastName}`).toLowerCase().includes(term) ||
    (c.phone || '').toLowerCase().includes(term) ||
    (c.email || '').toLowerCase().includes(term) ||
    phoneDigitsMatch(term, c)
  ).slice(0, 10);

  if (matches.length === 0) {
    dropdown.innerHTML = '<div class="customer-dropdown-empty">No customers found</div>';
  } else {
    dropdown.innerHTML = matches.map(c => `
      <div class="customer-dropdown-item" onclick="selectRentalCustomer('${c.id}')">
        <strong>${nameHtml(`${c.firstName || ''} ${c.lastName || ''}`.trim())}</strong>
        <span style="color:var(--muted);font-size:var(--fs-micro);margin-left:8px;">${escHtml(fmtPhone(c.phone||''))} ${c.email ? '· '+escHtml(c.email) : ''}</span>
      </div>`).join('');
  }
  dropdown.classList.add('open');
}

// Enter commits the one visible match — the same bargain posScanEnter already
// makes at the till. With several matches it does nothing rather than guess,
// because guessing here attaches a rental to the wrong person.
function rentalPickerKey(e) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const items = document.querySelectorAll('#rCustomerDropdown .customer-dropdown-item');
  if (items.length === 1) items[0].click();
}

function selectRentalCustomer(id) {
  const c = customers.find(x => x.id === id);
  if (!c) return;
  document.getElementById('rCustomer').value = id;
  document.getElementById('rCustomerSearch').value = `${c.firstName} ${c.lastName}`;
  document.getElementById('rCustomerSelected').textContent = `✓ ${fmtPhone(c.phone || '')}`;
  document.getElementById('rCustomerDropdown').classList.remove('open');
  selectedRentalCustomerId = id;
  updateRentalCalc(); // customer drives the multi-phone (3rd+) auto-discount
}

document.addEventListener('click', e => {
  if (!e.target.closest('.customer-search-wrap')) {
    const dd = document.getElementById('rCustomerDropdown');
    if (dd) dd.classList.remove('open');
  }
});

// ═══════════════════════════════════════════════════════
//  RENTALS MODULE
// ═══════════════════════════════════════════════════════

// Auto-generated by scripts/generate-holidays.mjs — DO NOT EDIT
// Covers Gregorian years 2020–2125
// Full (diaspora) 2-day yom tov for ALL rentals, Israel included — renters
// travelling to Eretz Yisroel keep both days (decision 12 Jul 2026; the
// 1-day Israel calendar lives in the DB holidays table if ever needed).
// Shabbos is a day-of-week check, so it is not listed here.
//
// REGENERATED 9 Aug 2026, and the old table was WRONG. Every yom tov in it sat
// one day early — the generator formatted hebcal's local-midnight dates with
// toISOString(), and on a machine in British Summer Time that reads back as the
// previous day. Only the festivals either side of a clock change escaped. So
// the app was giving erev yom tov away free and charging for yom tov itself;
// where yom tov fell on a Sunday the free day landed on the Shabbos that was
// already free and the renter lost the day outright. Same class of bug as the
// C10 audit finding in lib/rentalMath.mjs, and the reason that module counts
// days from local components and never from an ISO round-trip.
//
// Each entry is YYYY-MM-DD with a one-letter name code appended. The codes add
// about 1.4KB and buy the app the ability to say WHICH yom tov a free day was,
// rather than only how many there were.

const YOM_TOV_NAMES = {
  a: 'Pesach — 1st day',
  b: 'Pesach — 2nd day',
  c: 'Pesach — 7th day',
  d: 'Pesach — 8th day',
  e: 'Shavuos — 1st day',
  f: 'Shavuos — 2nd day',
  g: 'Rosh Hashanah — 1st day',
  h: 'Rosh Hashanah — 2nd day',
  i: 'Yom Kippur',
  j: 'Succos — 1st day',
  k: 'Succos — 2nd day',
  l: 'Shemini Atzeres',
  m: 'Simchas Torah',
};

const DIASPORA_YOM_TOV = [
  '2020-04-09a','2020-04-10b','2020-04-15c','2020-04-16d','2020-05-29e','2020-05-30f',
  '2020-09-19g','2020-09-20h','2020-09-28i','2020-10-03j','2020-10-04k','2020-10-10l',
  '2020-10-11m','2021-03-28a','2021-03-29b','2021-04-03c','2021-04-04d','2021-05-17e',
  '2021-05-18f','2021-09-07g','2021-09-08h','2021-09-16i','2021-09-21j','2021-09-22k',
  '2021-09-28l','2021-09-29m','2022-04-16a','2022-04-17b','2022-04-22c','2022-04-23d',
  '2022-06-05e','2022-06-06f','2022-09-26g','2022-09-27h','2022-10-05i','2022-10-10j',
  '2022-10-11k','2022-10-17l','2022-10-18m','2023-04-06a','2023-04-07b','2023-04-12c',
  '2023-04-13d','2023-05-26e','2023-05-27f','2023-09-16g','2023-09-17h','2023-09-25i',
  '2023-09-30j','2023-10-01k','2023-10-07l','2023-10-08m','2024-04-23a','2024-04-24b',
  '2024-04-29c','2024-04-30d','2024-06-12e','2024-06-13f','2024-10-03g','2024-10-04h',
  '2024-10-12i','2024-10-17j','2024-10-18k','2024-10-24l','2024-10-25m','2025-04-13a',
  '2025-04-14b','2025-04-19c','2025-04-20d','2025-06-02e','2025-06-03f','2025-09-23g',
  '2025-09-24h','2025-10-02i','2025-10-07j','2025-10-08k','2025-10-14l','2025-10-15m',
  '2026-04-02a','2026-04-03b','2026-04-08c','2026-04-09d','2026-05-22e','2026-05-23f',
  '2026-09-12g','2026-09-13h','2026-09-21i','2026-09-26j','2026-09-27k','2026-10-03l',
  '2026-10-04m','2027-04-22a','2027-04-23b','2027-04-28c','2027-04-29d','2027-06-11e',
  '2027-06-12f','2027-10-02g','2027-10-03h','2027-10-11i','2027-10-16j','2027-10-17k',
  '2027-10-23l','2027-10-24m','2028-04-11a','2028-04-12b','2028-04-17c','2028-04-18d',
  '2028-05-31e','2028-06-01f','2028-09-21g','2028-09-22h','2028-09-30i','2028-10-05j',
  '2028-10-06k','2028-10-12l','2028-10-13m','2029-03-31a','2029-04-01b','2029-04-06c',
  '2029-04-07d','2029-05-20e','2029-05-21f','2029-09-10g','2029-09-11h','2029-09-19i',
  '2029-09-24j','2029-09-25k','2029-10-01l','2029-10-02m','2030-04-18a','2030-04-19b',
  '2030-04-24c','2030-04-25d','2030-06-07e','2030-06-08f','2030-09-28g','2030-09-29h',
  '2030-10-07i','2030-10-12j','2030-10-13k','2030-10-19l','2030-10-20m','2031-04-08a',
  '2031-04-09b','2031-04-14c','2031-04-15d','2031-05-28e','2031-05-29f','2031-09-18g',
  '2031-09-19h','2031-09-27i','2031-10-02j','2031-10-03k','2031-10-09l','2031-10-10m',
  '2032-03-27a','2032-03-28b','2032-04-02c','2032-04-03d','2032-05-16e','2032-05-17f',
  '2032-09-06g','2032-09-07h','2032-09-15i','2032-09-20j','2032-09-21k','2032-09-27l',
  '2032-09-28m','2033-04-14a','2033-04-15b','2033-04-20c','2033-04-21d','2033-06-03e',
  '2033-06-04f','2033-09-24g','2033-09-25h','2033-10-03i','2033-10-08j','2033-10-09k',
  '2033-10-15l','2033-10-16m','2034-04-04a','2034-04-05b','2034-04-10c','2034-04-11d',
  '2034-05-24e','2034-05-25f','2034-09-14g','2034-09-15h','2034-09-23i','2034-09-28j',
  '2034-09-29k','2034-10-05l','2034-10-06m','2035-04-24a','2035-04-25b','2035-04-30c',
  '2035-05-01d','2035-06-13e','2035-06-14f','2035-10-04g','2035-10-05h','2035-10-13i',
  '2035-10-18j','2035-10-19k','2035-10-25l','2035-10-26m','2036-04-12a','2036-04-13b',
  '2036-04-18c','2036-04-19d','2036-06-01e','2036-06-02f','2036-09-22g','2036-09-23h',
  '2036-10-01i','2036-10-06j','2036-10-07k','2036-10-13l','2036-10-14m','2037-03-31a',
  '2037-04-01b','2037-04-06c','2037-04-07d','2037-05-20e','2037-05-21f','2037-09-10g',
  '2037-09-11h','2037-09-19i','2037-09-24j','2037-09-25k','2037-10-01l','2037-10-02m',
  '2038-04-20a','2038-04-21b','2038-04-26c','2038-04-27d','2038-06-09e','2038-06-10f',
  '2038-09-30g','2038-10-01h','2038-10-09i','2038-10-14j','2038-10-15k','2038-10-21l',
  '2038-10-22m','2039-04-09a','2039-04-10b','2039-04-15c','2039-04-16d','2039-05-29e',
  '2039-05-30f','2039-09-19g','2039-09-20h','2039-09-28i','2039-10-03j','2039-10-04k',
  '2039-10-10l','2039-10-11m','2040-03-29a','2040-03-30b','2040-04-04c','2040-04-05d',
  '2040-05-18e','2040-05-19f','2040-09-08g','2040-09-09h','2040-09-17i','2040-09-22j',
  '2040-09-23k','2040-09-29l','2040-09-30m','2041-04-16a','2041-04-17b','2041-04-22c',
  '2041-04-23d','2041-06-05e','2041-06-06f','2041-09-26g','2041-09-27h','2041-10-05i',
  '2041-10-10j','2041-10-11k','2041-10-17l','2041-10-18m','2042-04-05a','2042-04-06b',
  '2042-04-11c','2042-04-12d','2042-05-25e','2042-05-26f','2042-09-15g','2042-09-16h',
  '2042-09-24i','2042-09-29j','2042-09-30k','2042-10-06l','2042-10-07m','2043-04-25a',
  '2043-04-26b','2043-05-01c','2043-05-02d','2043-06-14e','2043-06-15f','2043-10-05g',
  '2043-10-06h','2043-10-14i','2043-10-19j','2043-10-20k','2043-10-26l','2043-10-27m',
  '2044-04-12a','2044-04-13b','2044-04-18c','2044-04-19d','2044-06-01e','2044-06-02f',
  '2044-09-22g','2044-09-23h','2044-10-01i','2044-10-06j','2044-10-07k','2044-10-13l',
  '2044-10-14m','2045-04-02a','2045-04-03b','2045-04-08c','2045-04-09d','2045-05-22e',
  '2045-05-23f','2045-09-12g','2045-09-13h','2045-09-21i','2045-09-26j','2045-09-27k',
  '2045-10-03l','2045-10-04m','2046-04-21a','2046-04-22b','2046-04-27c','2046-04-28d',
  '2046-06-10e','2046-06-11f','2046-10-01g','2046-10-02h','2046-10-10i','2046-10-15j',
  '2046-10-16k','2046-10-22l','2046-10-23m','2047-04-11a','2047-04-12b','2047-04-17c',
  '2047-04-18d','2047-05-31e','2047-06-01f','2047-09-21g','2047-09-22h','2047-09-30i',
  '2047-10-05j','2047-10-06k','2047-10-12l','2047-10-13m','2048-03-29a','2048-03-30b',
  '2048-04-04c','2048-04-05d','2048-05-18e','2048-05-19f','2048-09-08g','2048-09-09h',
  '2048-09-17i','2048-09-22j','2048-09-23k','2048-09-29l','2048-09-30m','2049-04-17a',
  '2049-04-18b','2049-04-23c','2049-04-24d','2049-06-06e','2049-06-07f','2049-09-27g',
  '2049-09-28h','2049-10-06i','2049-10-11j','2049-10-12k','2049-10-18l','2049-10-19m',
  '2050-04-07a','2050-04-08b','2050-04-13c','2050-04-14d','2050-05-27e','2050-05-28f',
  '2050-09-17g','2050-09-18h','2050-09-26i','2050-10-01j','2050-10-02k','2050-10-08l',
  '2050-10-09m','2051-03-28a','2051-03-29b','2051-04-03c','2051-04-04d','2051-05-17e',
  '2051-05-18f','2051-09-07g','2051-09-08h','2051-09-16i','2051-09-21j','2051-09-22k',
  '2051-09-28l','2051-09-29m','2052-04-14a','2052-04-15b','2052-04-20c','2052-04-21d',
  '2052-06-03e','2052-06-04f','2052-09-24g','2052-09-25h','2052-10-03i','2052-10-08j',
  '2052-10-09k','2052-10-15l','2052-10-16m','2053-04-03a','2053-04-04b','2053-04-09c',
  '2053-04-10d','2053-05-23e','2053-05-24f','2053-09-13g','2053-09-14h','2053-09-22i',
  '2053-09-27j','2053-09-28k','2053-10-04l','2053-10-05m','2054-04-23a','2054-04-24b',
  '2054-04-29c','2054-04-30d','2054-06-12e','2054-06-13f','2054-10-03g','2054-10-04h',
  '2054-10-12i','2054-10-17j','2054-10-18k','2054-10-24l','2054-10-25m','2055-04-13a',
  '2055-04-14b','2055-04-19c','2055-04-20d','2055-06-02e','2055-06-03f','2055-09-23g',
  '2055-09-24h','2055-10-02i','2055-10-07j','2055-10-08k','2055-10-14l','2055-10-15m',
  '2056-04-01a','2056-04-02b','2056-04-07c','2056-04-08d','2056-05-21e','2056-05-22f',
  '2056-09-11g','2056-09-12h','2056-09-20i','2056-09-25j','2056-09-26k','2056-10-02l',
  '2056-10-03m','2057-04-19a','2057-04-20b','2057-04-25c','2057-04-26d','2057-06-08e',
  '2057-06-09f','2057-09-29g','2057-09-30h','2057-10-08i','2057-10-13j','2057-10-14k',
  '2057-10-20l','2057-10-21m','2058-04-09a','2058-04-10b','2058-04-15c','2058-04-16d',
  '2058-05-29e','2058-05-30f','2058-09-19g','2058-09-20h','2058-09-28i','2058-10-03j',
  '2058-10-04k','2058-10-10l','2058-10-11m','2059-03-29a','2059-03-30b','2059-04-04c',
  '2059-04-05d','2059-05-18e','2059-05-19f','2059-09-08g','2059-09-09h','2059-09-17i',
  '2059-09-22j','2059-09-23k','2059-09-29l','2059-09-30m','2060-04-15a','2060-04-16b',
  '2060-04-21c','2060-04-22d','2060-06-04e','2060-06-05f','2060-09-25g','2060-09-26h',
  '2060-10-04i','2060-10-09j','2060-10-10k','2060-10-16l','2060-10-17m','2061-04-05a',
  '2061-04-06b','2061-04-11c','2061-04-12d','2061-05-25e','2061-05-26f','2061-09-15g',
  '2061-09-16h','2061-09-24i','2061-09-29j','2061-09-30k','2061-10-06l','2061-10-07m',
  '2062-04-25a','2062-04-26b','2062-05-01c','2062-05-02d','2062-06-14e','2062-06-15f',
  '2062-10-05g','2062-10-06h','2062-10-14i','2062-10-19j','2062-10-20k','2062-10-26l',
  '2062-10-27m','2063-04-14a','2063-04-15b','2063-04-20c','2063-04-21d','2063-06-03e',
  '2063-06-04f','2063-09-24g','2063-09-25h','2063-10-03i','2063-10-08j','2063-10-09k',
  '2063-10-15l','2063-10-16m','2064-04-01a','2064-04-02b','2064-04-07c','2064-04-08d',
  '2064-05-21e','2064-05-22f','2064-09-11g','2064-09-12h','2064-09-20i','2064-09-25j',
  '2064-09-26k','2064-10-02l','2064-10-03m','2065-04-21a','2065-04-22b','2065-04-27c',
  '2065-04-28d','2065-06-10e','2065-06-11f','2065-10-01g','2065-10-02h','2065-10-10i',
  '2065-10-15j','2065-10-16k','2065-10-22l','2065-10-23m','2066-04-10a','2066-04-11b',
  '2066-04-16c','2066-04-17d','2066-05-30e','2066-05-31f','2066-09-20g','2066-09-21h',
  '2066-09-29i','2066-10-04j','2066-10-05k','2066-10-11l','2066-10-12m','2067-03-31a',
  '2067-04-01b','2067-04-06c','2067-04-07d','2067-05-20e','2067-05-21f','2067-09-10g',
  '2067-09-11h','2067-09-19i','2067-09-24j','2067-09-25k','2067-10-01l','2067-10-02m',
  '2068-04-17a','2068-04-18b','2068-04-23c','2068-04-24d','2068-06-06e','2068-06-07f',
  '2068-09-27g','2068-09-28h','2068-10-06i','2068-10-11j','2068-10-12k','2068-10-18l',
  '2068-10-19m','2069-04-06a','2069-04-07b','2069-04-12c','2069-04-13d','2069-05-26e',
  '2069-05-27f','2069-09-16g','2069-09-17h','2069-09-25i','2069-09-30j','2069-10-01k',
  '2069-10-07l','2069-10-08m','2070-03-27a','2070-03-28b','2070-04-02c','2070-04-03d',
  '2070-05-16e','2070-05-17f','2070-09-06g','2070-09-07h','2070-09-15i','2070-09-20j',
  '2070-09-21k','2070-09-27l','2070-09-28m','2071-04-14a','2071-04-15b','2071-04-20c',
  '2071-04-21d','2071-06-03e','2071-06-04f','2071-09-24g','2071-09-25h','2071-10-03i',
  '2071-10-08j','2071-10-09k','2071-10-15l','2071-10-16m','2072-04-03a','2072-04-04b',
  '2072-04-09c','2072-04-10d','2072-05-23e','2072-05-24f','2072-09-13g','2072-09-14h',
  '2072-09-22i','2072-09-27j','2072-09-28k','2072-10-04l','2072-10-05m','2073-04-22a',
  '2073-04-23b','2073-04-28c','2073-04-29d','2073-06-11e','2073-06-12f','2073-10-02g',
  '2073-10-03h','2073-10-11i','2073-10-16j','2073-10-17k','2073-10-23l','2073-10-24m',
  '2074-04-12a','2074-04-13b','2074-04-18c','2074-04-19d','2074-06-01e','2074-06-02f',
  '2074-09-22g','2074-09-23h','2074-10-01i','2074-10-06j','2074-10-07k','2074-10-13l',
  '2074-10-14m','2075-03-31a','2075-04-01b','2075-04-06c','2075-04-07d','2075-05-20e',
  '2075-05-21f','2075-09-10g','2075-09-11h','2075-09-19i','2075-09-24j','2075-09-25k',
  '2075-10-01l','2075-10-02m','2076-04-18a','2076-04-19b','2076-04-24c','2076-04-25d',
  '2076-06-07e','2076-06-08f','2076-09-28g','2076-09-29h','2076-10-07i','2076-10-12j',
  '2076-10-13k','2076-10-19l','2076-10-20m','2077-04-08a','2077-04-09b','2077-04-14c',
  '2077-04-15d','2077-05-28e','2077-05-29f','2077-09-18g','2077-09-19h','2077-09-27i',
  '2077-10-02j','2077-10-03k','2077-10-09l','2077-10-10m','2078-03-29a','2078-03-30b',
  '2078-04-04c','2078-04-05d','2078-05-18e','2078-05-19f','2078-09-08g','2078-09-09h',
  '2078-09-17i','2078-09-22j','2078-09-23k','2078-09-29l','2078-09-30m','2079-04-16a',
  '2079-04-17b','2079-04-22c','2079-04-23d','2079-06-05e','2079-06-06f','2079-09-26g',
  '2079-09-27h','2079-10-05i','2079-10-10j','2079-10-11k','2079-10-17l','2079-10-18m',
  '2080-04-04a','2080-04-05b','2080-04-10c','2080-04-11d','2080-05-24e','2080-05-25f',
  '2080-09-14g','2080-09-15h','2080-09-23i','2080-09-28j','2080-09-29k','2080-10-05l',
  '2080-10-06m','2081-04-24a','2081-04-25b','2081-04-30c','2081-05-01d','2081-06-13e',
  '2081-06-14f','2081-10-04g','2081-10-05h','2081-10-13i','2081-10-18j','2081-10-19k',
  '2081-10-25l','2081-10-26m','2082-04-14a','2082-04-15b','2082-04-20c','2082-04-21d',
  '2082-06-03e','2082-06-04f','2082-09-24g','2082-09-25h','2082-10-03i','2082-10-08j',
  '2082-10-09k','2082-10-15l','2082-10-16m','2083-04-03a','2083-04-04b','2083-04-09c',
  '2083-04-10d','2083-05-23e','2083-05-24f','2083-09-13g','2083-09-14h','2083-09-22i',
  '2083-09-27j','2083-09-28k','2083-10-04l','2083-10-05m','2084-04-20a','2084-04-21b',
  '2084-04-26c','2084-04-27d','2084-06-09e','2084-06-10f','2084-09-30g','2084-10-01h',
  '2084-10-09i','2084-10-14j','2084-10-15k','2084-10-21l','2084-10-22m','2085-04-10a',
  '2085-04-11b','2085-04-16c','2085-04-17d','2085-05-30e','2085-05-31f','2085-09-20g',
  '2085-09-21h','2085-09-29i','2085-10-04j','2085-10-05k','2085-10-11l','2085-10-12m',
  '2086-03-30a','2086-03-31b','2086-04-05c','2086-04-06d','2086-05-19e','2086-05-20f',
  '2086-09-09g','2086-09-10h','2086-09-18i','2086-09-23j','2086-09-24k','2086-09-30l',
  '2086-10-01m','2087-04-17a','2087-04-18b','2087-04-23c','2087-04-24d','2087-06-06e',
  '2087-06-07f','2087-09-27g','2087-09-28h','2087-10-06i','2087-10-11j','2087-10-12k',
  '2087-10-18l','2087-10-19m','2088-04-06a','2088-04-07b','2088-04-12c','2088-04-13d',
  '2088-05-26e','2088-05-27f','2088-09-16g','2088-09-17h','2088-09-25i','2088-09-30j',
  '2088-10-01k','2088-10-07l','2088-10-08m','2089-03-26a','2089-03-27b','2089-04-01c',
  '2089-04-02d','2089-05-15e','2089-05-16f','2089-09-05g','2089-09-06h','2089-09-14i',
  '2089-09-19j','2089-09-20k','2089-09-26l','2089-09-27m','2090-04-15a','2090-04-16b',
  '2090-04-21c','2090-04-22d','2090-06-04e','2090-06-05f','2090-09-25g','2090-09-26h',
  '2090-10-04i','2090-10-09j','2090-10-10k','2090-10-16l','2090-10-17m','2091-04-03a',
  '2091-04-04b','2091-04-09c','2091-04-10d','2091-05-23e','2091-05-24f','2091-09-13g',
  '2091-09-14h','2091-09-22i','2091-09-27j','2091-09-28k','2091-10-04l','2091-10-05m',
  '2092-04-22a','2092-04-23b','2092-04-28c','2092-04-29d','2092-06-11e','2092-06-12f',
  '2092-10-02g','2092-10-03h','2092-10-11i','2092-10-16j','2092-10-17k','2092-10-23l',
  '2092-10-24m','2093-04-11a','2093-04-12b','2093-04-17c','2093-04-18d','2093-05-31e',
  '2093-06-01f','2093-09-21g','2093-09-22h','2093-09-30i','2093-10-05j','2093-10-06k',
  '2093-10-12l','2093-10-13m','2094-04-01a','2094-04-02b','2094-04-07c','2094-04-08d',
  '2094-05-21e','2094-05-22f','2094-09-11g','2094-09-12h','2094-09-20i','2094-09-25j',
  '2094-09-26k','2094-10-02l','2094-10-03m','2095-04-19a','2095-04-20b','2095-04-25c',
  '2095-04-26d','2095-06-08e','2095-06-09f','2095-09-29g','2095-09-30h','2095-10-08i',
  '2095-10-13j','2095-10-14k','2095-10-20l','2095-10-21m','2096-04-07a','2096-04-08b',
  '2096-04-13c','2096-04-14d','2096-05-27e','2096-05-28f','2096-09-17g','2096-09-18h',
  '2096-09-26i','2096-10-01j','2096-10-02k','2096-10-08l','2096-10-09m','2097-03-28a',
  '2097-03-29b','2097-04-03c','2097-04-04d','2097-05-17e','2097-05-18f','2097-09-07g',
  '2097-09-08h','2097-09-16i','2097-09-21j','2097-09-22k','2097-09-28l','2097-09-29m',
  '2098-04-17a','2098-04-18b','2098-04-23c','2098-04-24d','2098-06-06e','2098-06-07f',
  '2098-09-27g','2098-09-28h','2098-10-06i','2098-10-11j','2098-10-12k','2098-10-18l',
  '2098-10-19m','2099-04-05a','2099-04-06b','2099-04-11c','2099-04-12d','2099-05-25e',
  '2099-05-26f','2099-09-15g','2099-09-16h','2099-09-24i','2099-09-29j','2099-09-30k',
  '2099-10-06l','2099-10-07m','2100-04-24a','2100-04-25b','2100-04-30c','2100-05-01d',
  '2100-06-13e','2100-06-14f','2100-10-04g','2100-10-05h','2100-10-13i','2100-10-18j',
  '2100-10-19k','2100-10-25l','2100-10-26m','2101-04-14a','2101-04-15b','2101-04-20c',
  '2101-04-21d','2101-06-03e','2101-06-04f','2101-09-24g','2101-09-25h','2101-10-03i',
  '2101-10-08j','2101-10-09k','2101-10-15l','2101-10-16m','2102-04-04a','2102-04-05b',
  '2102-04-10c','2102-04-11d','2102-05-24e','2102-05-25f','2102-09-14g','2102-09-15h',
  '2102-09-23i','2102-09-28j','2102-09-29k','2102-10-05l','2102-10-06m','2103-04-22a',
  '2103-04-23b','2103-04-28c','2103-04-29d','2103-06-11e','2103-06-12f','2103-10-02g',
  '2103-10-03h','2103-10-11i','2103-10-16j','2103-10-17k','2103-10-23l','2103-10-24m',
  '2104-04-10a','2104-04-11b','2104-04-16c','2104-04-17d','2104-05-30e','2104-05-31f',
  '2104-09-20g','2104-09-21h','2104-09-29i','2104-10-04j','2104-10-05k','2104-10-11l',
  '2104-10-12m','2105-03-31a','2105-04-01b','2105-04-06c','2105-04-07d','2105-05-20e',
  '2105-05-21f','2105-09-10g','2105-09-11h','2105-09-19i','2105-09-24j','2105-09-25k',
  '2105-10-01l','2105-10-02m','2106-04-20a','2106-04-21b','2106-04-26c','2106-04-27d',
  '2106-06-09e','2106-06-10f','2106-09-30g','2106-10-01h','2106-10-09i','2106-10-14j',
  '2106-10-15k','2106-10-21l','2106-10-22m','2107-04-09a','2107-04-10b','2107-04-15c',
  '2107-04-16d','2107-05-29e','2107-05-30f','2107-09-19g','2107-09-20h','2107-09-28i',
  '2107-10-03j','2107-10-04k','2107-10-10l','2107-10-11m','2108-03-27a','2108-03-28b',
  '2108-04-02c','2108-04-03d','2108-05-16e','2108-05-17f','2108-09-06g','2108-09-07h',
  '2108-09-15i','2108-09-20j','2108-09-21k','2108-09-27l','2108-09-28m','2109-04-16a',
  '2109-04-17b','2109-04-22c','2109-04-23d','2109-06-05e','2109-06-06f','2109-09-26g',
  '2109-09-27h','2109-10-05i','2109-10-10j','2109-10-11k','2109-10-17l','2109-10-18m',
  '2110-04-05a','2110-04-06b','2110-04-11c','2110-04-12d','2110-05-25e','2110-05-26f',
  '2110-09-15g','2110-09-16h','2110-09-24i','2110-09-29j','2110-09-30k','2110-10-06l',
  '2110-10-07m','2111-04-23a','2111-04-24b','2111-04-29c','2111-04-30d','2111-06-12e',
  '2111-06-13f','2111-10-03g','2111-10-04h','2111-10-12i','2111-10-17j','2111-10-18k',
  '2111-10-24l','2111-10-25m','2112-04-12a','2112-04-13b','2112-04-18c','2112-04-19d',
  '2112-06-01e','2112-06-02f','2112-09-22g','2112-09-23h','2112-10-01i','2112-10-06j',
  '2112-10-07k','2112-10-13l','2112-10-14m','2113-04-01a','2113-04-02b','2113-04-07c',
  '2113-04-08d','2113-05-21e','2113-05-22f','2113-09-11g','2113-09-12h','2113-09-20i',
  '2113-09-25j','2113-09-26k','2113-10-02l','2113-10-03m','2114-04-21a','2114-04-22b',
  '2114-04-27c','2114-04-28d','2114-06-10e','2114-06-11f','2114-10-01g','2114-10-02h',
  '2114-10-10i','2114-10-15j','2114-10-16k','2114-10-22l','2114-10-23m','2115-04-09a',
  '2115-04-10b','2115-04-15c','2115-04-16d','2115-05-29e','2115-05-30f','2115-09-19g',
  '2115-09-20h','2115-09-28i','2115-10-03j','2115-10-04k','2115-10-10l','2115-10-11m',
  '2116-03-28a','2116-03-29b','2116-04-03c','2116-04-04d','2116-05-17e','2116-05-18f',
  '2116-09-07g','2116-09-08h','2116-09-16i','2116-09-21j','2116-09-22k','2116-09-28l',
  '2116-09-29m','2117-04-17a','2117-04-18b','2117-04-23c','2117-04-24d','2117-06-06e',
  '2117-06-07f','2117-09-27g','2117-09-28h','2117-10-06i','2117-10-11j','2117-10-12k',
  '2117-10-18l','2117-10-19m','2118-04-07a','2118-04-08b','2118-04-13c','2118-04-14d',
  '2118-05-27e','2118-05-28f','2118-09-17g','2118-09-18h','2118-09-26i','2118-10-01j',
  '2118-10-02k','2118-10-08l','2118-10-09m','2119-04-25a','2119-04-26b','2119-05-01c',
  '2119-05-02d','2119-06-14e','2119-06-15f','2119-10-05g','2119-10-06h','2119-10-14i',
  '2119-10-19j','2119-10-20k','2119-10-26l','2119-10-27m','2120-04-13a','2120-04-14b',
  '2120-04-19c','2120-04-20d','2120-06-02e','2120-06-03f','2120-09-23g','2120-09-24h',
  '2120-10-02i','2120-10-07j','2120-10-08k','2120-10-14l','2120-10-15m','2121-04-03a',
  '2121-04-04b','2121-04-09c','2121-04-10d','2121-05-23e','2121-05-24f','2121-09-13g',
  '2121-09-14h','2121-09-22i','2121-09-27j','2121-09-28k','2121-10-04l','2121-10-05m',
  '2122-04-21a','2122-04-22b','2122-04-27c','2122-04-28d','2122-06-10e','2122-06-11f',
  '2122-10-01g','2122-10-02h','2122-10-10i','2122-10-15j','2122-10-16k','2122-10-22l',
  '2122-10-23m','2123-04-11a','2123-04-12b','2123-04-17c','2123-04-18d','2123-05-31e',
  '2123-06-01f','2123-09-21g','2123-09-22h','2123-09-30i','2123-10-05j','2123-10-06k',
  '2123-10-12l','2123-10-13m','2124-03-30a','2124-03-31b','2124-04-05c','2124-04-06d',
  '2124-05-19e','2124-05-20f','2124-09-09g','2124-09-10h','2124-09-18i','2124-09-23j',
  '2124-09-24k','2124-09-30l','2124-10-01m','2125-04-19a','2125-04-20b','2125-04-25c',
  '2125-04-26d','2125-06-08e','2125-06-09f','2125-09-29g','2125-09-30h','2125-10-08i',
  '2125-10-13j','2125-10-14k','2125-10-20l','2125-10-21m'
];

// ISO date → the yom tov's name. Kept as a Map, not a Set beside a lookup
// table: `.has()` is the hot path — every day of every rental window walks
// through it — and a Map answers that as fast while also carrying the name.
const DIASPORA_HOLIDAYS = new Map(
  DIASPORA_YOM_TOV.map(s => [s.slice(0, 10), YOM_TOV_NAMES[s.slice(10)]])
);


// ── Local-time date helpers ──────────────────────────────────────────────
// All chargeable-day / late-fee / overdue logic must use the SHOP'S local
// calendar date. toISOString() is UTC: during British Summer Time it lags an
// hour behind, so between 00:00 and 01:00 local "today" was still yesterday —
// shifting overdue flips, late-fee day counts, and Shabbat classification.

// Local calendar date of a Date (default: now) as YYYY-MM-DD.
function localISO(d = new Date()) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

// Parse a YYYY-MM-DD string to LOCAL midnight (new Date(str) would anchor to
// UTC midnight, desynchronising getDay()/localISO from the intended date).
function parseLocalDate(v) {
  if (v instanceof Date) return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(v);
}

function isShabbatOrHoliday(date, country) {
  const d = date instanceof Date ? date : parseLocalDate(date);
  if (d.getDay() === 6) return true;
  return DIASPORA_HOLIDAYS.has(localISO(d));
}

// WHY a day is free, in words. '' means it is a chargeable day. A yom tov that
// falls on Shabbos names both, because the renter asking "why wasn't the 3rd
// charged" is owed the whole answer, not the first half of it.
function freeDayReason(date) {
  const d = date instanceof Date ? date : parseLocalDate(date);
  const parts = [];
  if (d.getDay() === 6) parts.push('Shabbos');
  const yomTov = DIASPORA_HOLIDAYS.get(localISO(d));
  if (yomTov) parts.push(yomTov);
  return parts.join(' · ');
}

// Every free day in [from, to] inclusive, in order, each with its reason.
//
// Deliberately the same walk as calcRentalPrice — same parseLocalDate, same
// setDate step, same inclusive end — so the list can never disagree with the
// count it is explaining. If the two ever drift, the screen shows four named
// days beside the number 3 and somebody notices, which is the entire point of
// naming them.
function freeDaysIn(fromDate, toDate) {
  const out = [];
  if (!fromDate || !toDate) return out;
  const cur = parseLocalDate(fromDate);
  const end = parseLocalDate(toDate);
  if (!(cur <= end)) return out;
  while (cur <= end) {
    const reason = freeDayReason(cur);
    if (reason) out.push({ iso: localISO(cur), reason });
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

// ── Pricing configuration ────────────────────────────────────────────────
// Rates come from the database (Settings tab edits them); the hardcoded
// values below are only the offline fallback and MUST mirror the seed.
let pricingConfig = null;

// Values follow the customer price list (30 Jun 2026): "Monthly" = the cap,
// and the virtual-number add-on is per-country (£5/£10 USA+Canada,
// £7/£15 Israel+UK).
const FALLBACK_RATES = {
  'USA':       { ratePerDay: 3, minCharge: 20, cap: 50, capPeriodDays: 30, vnWeekly: 5, vnPer30Days: 10 },
  'USA-NoSIM': { ratePerDay: 2, minCharge: 15, cap: 30, capPeriodDays: 30, vnWeekly: 5, vnPer30Days: 10 },
  'UK-UKmins': { ratePerDay: 2, minCharge: 20, cap: 35, capPeriodDays: 30, vnWeekly: 7, vnPer30Days: 15 },
  'UK-Intl':   { ratePerDay: 2, minCharge: 25, cap: 40, capPeriodDays: 30, vnWeekly: 7, vnPer30Days: 15 },
  'Israel':    { ratePerDay: 3, minCharge: 20, cap: 50, capPeriodDays: 30, vnWeekly: 7, vnPer30Days: 15 },
  'Canada':    { ratePerDay: 3, minCharge: 25, cap: 50, capPeriodDays: 30, vnWeekly: 5, vnPer30Days: 10 },
  'EU':        { ratePerDay: 3, minCharge: 20, cap: 45, capPeriodDays: 30, vnWeekly: 5, vnPer30Days: 10 },
};

// App country + phone plan → priced country code (same mapping as the
// server-side lib/mappers.js rentalCountryCode). A USA phone rented WITHOUT
// a SIM prices on the cheaper no-SIM row (price list: £2/day, min £15,
// monthly £30) — driven by the SIM toggle in the equipment-given row.
function pricedCountryCode(country, ukPlan, simGiven = true) {
  if (country === 'UK') return ukPlan === 'unlimited' ? 'UK-Intl' : 'UK-UKmins';
  if (country === 'USA' && !simGiven) return 'USA-NoSIM';
  if (FALLBACK_RATES[country]) return country;
  return 'USA';
}

function rateFor(country, ukPlan, simGiven = true) {
  const code = pricedCountryCode(country, ukPlan, simGiven);
  const dbRate = pricingConfig?.rentalRates?.find(r => r.countryCode === code && r.active !== false);
  return dbRate || FALLBACK_RATES[code];
}

function settingNum(key, fallback) {
  const s = pricingConfig?.settings?.find(x => x.key === key);
  return (s && Number.isFinite(s.numValue)) ? s.numValue : fallback;
}

// ── Stat-card thresholds ──────────────────────────────────────────────────
// When a number on a stat card stops being neutral and starts being a warning.
//
// Every one of these was `> 0`, which is not a threshold — it is "any at all".
// Outstanding went red the moment a single pound was owed, so in a shop where
// some arrears are always in flight the card was red every day of the year. A
// card that is always red is a card nobody reads, and the day it means
// something it gets ignored along with all the others.
//
// Where "normal" stops is a question about this shop's trading rather than
// about software, so the steps are owner-editable (Settings → Dashboard,
// seeded by 20260809120000_dashboard_stat_thresholds.sql). The numbers below
// are the offline fallback and MUST mirror that migration — same rule as
// FALLBACK_RATES.
//
// `lowerIsWorse` inverts the comparison for the counts where running out is
// the problem: three phones left is worse than thirty.
const STAT_BANDS = {
  arrears:   { amber: 'dash_arrears_amber',   red: 'dash_arrears_red',   amberDefault: 250, redDefault: 1000 },
  overdue:   { amber: 'dash_overdue_amber',   red: 'dash_overdue_red',   amberDefault: 1,   redDefault: 3 },
  highTasks: { amber: 'dash_tasks_amber',     red: 'dash_tasks_red',     amberDefault: 1,   redDefault: 5 },
  returning: { amber: 'dash_returning_amber', red: 'dash_returning_red', amberDefault: 1,   redDefault: 6 },
  phonesFree:{ amber: 'dash_phones_amber',    red: 'dash_phones_red',    amberDefault: 3,   redDefault: 1, lowerIsWorse: true },
};

// '' (neutral) | 'clear' | 'amber' | 'red'.
function statBand(name, value) {
  const b = STAT_BANDS[name];
  if (!b) return '';
  const n = Number(value) || 0;
  const amber = settingNum(b.amber, b.amberDefault);
  const red = settingNum(b.red, b.redDefault);
  if (b.lowerIsWorse) {
    if (n <= red) return 'red';
    if (n <= amber) return 'amber';
    return '';
  }
  if (n >= red) return 'red';
  if (n >= amber) return 'amber';
  // Nothing owed, nothing overdue, nothing waiting: worth saying so in green.
  // Only reachable when the amber step is above zero — an owner who sets it to
  // 0 has asked for the warning to be permanent, and gets it.
  return n === 0 ? 'clear' : '';
}

const STAT_BAND_INK = { clear: 'var(--success)', amber: 'var(--gold)', red: 'var(--danger-ink)' };

// Inline style for a stat value, or '' to leave it the default navy ink.
function statBandStyle(name, value) {
  const ink = STAT_BAND_INK[statBand(name, value)];
  return ink ? `color:${ink};` : '';
}

// The owner-managed IVR / VN provider list (settings key ivr_platforms,
// feature #10). Falls back to the built-in defaults before settings load.
function ivrPlatforms() {
  const s = pricingConfig?.settings?.find(x => x.key === 'ivr_platforms');
  const list = String(s?.textValue || '').split(',').map(x => x.trim()).filter(Boolean);
  return list.length ? list : ['elid', 'FreePBX', 'Other'];
}

// #47 — the pricing FORMULA, isolated as its own pure function. This mirrors
// lib/rentalMath.mjs::priceFromDays exactly (that module is the canonical,
// unit-tested statement of the maths — see test/rentalMath.test.mjs). Kept as
// a mirror here only because the browser has no bundler to import the module.
// Round half away from zero with an epsilon to defeat the IEEE-754 half-penny
// boundary — mirrors round2 in lib/rentalMath.mjs exactly (change both
// together; test/pricingMirror.test.mjs holds the pair to the penny).
function round2(v) {
  const n = Number(v) || 0;
  return (n < 0 ? -1 : 1) * Math.round(Math.abs(n) * 100 + 1e-7) / 100;
}

function priceFromDays(chargeableDays, totalDays, rate) {
  let price = chargeableDays * rate.ratePerDay;
  if (chargeableDays > 0 && price < rate.minCharge) price = rate.minCharge;
  // Cap scales per calendar window (default 30 days): chargeable days set the
  // £, calendar days set how many cap periods the rental spans — so a 60-day
  // rental caps at 2× cap, not 1×.
  if (rate.cap != null) {
    const capTotal = rate.cap * Math.max(1, Math.ceil(totalDays / (rate.capPeriodDays || 30)));
    if (price > capTotal) price = capTotal;
  }
  return round2(price);
}

function calcRentalPrice(fromDate, toDate, country = 'USA', ukPlan = 'standard', simGiven = true) {
  let chargeableDays = 0;
  let totalDays = 0;
  const cur = parseLocalDate(fromDate);
  const end = parseLocalDate(toDate);
  while (cur <= end) {
    totalDays++;
    if (!isShabbatOrHoliday(cur, country)) chargeableDays++;
    cur.setDate(cur.getDate() + 1);
  }
  const price = priceFromDays(chargeableDays, totalDays, rateFor(country, ukPlan, simGiven));
  return { chargeableDays, totalDays, price };
}

// Price list: "Third phone and more — 15% Off". A rental counts as a 3rd+
// phone when the customer already has 2+ other non-returned rentals whose
// dates overlap the new one. Pure (rentals passed in) so it's unit-testable.
function multiPhoneDiscountPct(allRentals, customerId, from, to, excludeId = null) {
  if (!customerId || !from || !to) return 0;
  const concurrent = allRentals.filter(r =>
    r.customerId === customerId &&
    r.id !== excludeId &&
    r.status !== 'returned' &&
    r.fromDate && r.toDate &&
    r.fromDate <= to && r.toDate >= from
  ).length;
  // Discount applies from the Nth concurrent phone (settings-driven; the
  // price list says the 3rd, so the customer needs N-1 others already).
  const from_ = Math.max(2, settingNum('multi_phone_discount_from', 3));
  return (concurrent + 1) >= from_ ? settingNum('multi_phone_discount_pct', 15) : 0;
}

// Ticket-service fee for N passengers (price list tiers):
//   passenger 1 → single price; passengers 2–5 → repeatPrice each;
//   passengers 6+ → bulkPrice each. Flat services (repeatPrice null, e.g.
//   the start fee) charge the single price once regardless of N.
function ticketFeeFor(svc, passengers) {
  const n = Math.max(1, Math.floor(Number(passengers)) || 1);
  const single = Number(svc.price) || 0;
  if (svc.repeatPrice === null || svc.repeatPrice === undefined) return round2(single);
  const upTo5 = Math.min(n - 1, 4) * Number(svc.repeatPrice);
  const from6 = Math.max(n - 5, 0) * Number(svc.bulkPrice ?? svc.repeatPrice);
  return round2(single + upTo5 + from6);
}

// Price list: "3 or more plans — 10% Off" (SIM setup). Applies to the
// monthly/annual prefills in the charge modal.
function multiSimDiscountPct(allSims, customerId) {
  const active = allSims.filter(s => s.customerId === customerId && s.status === 'active').length;
  const from_ = Math.max(2, settingNum('multi_sim_discount_from', 3));
  return active >= from_ ? settingNum('multi_sim_discount_pct', 10) : 0;
}

// ── USA pool optimiser (ported from legacy PoolOptimiser.gs) ────────────
// When choosing a USA phone for a rental returning on `to`, rank the pooled
// phones by how well the pool's expiry lines up with the return: expiring
// 0–3 days after return is ideal (minimal idle pool time); expiring BEFORE
// return risks the customer losing service mid-trip; expiring long after
// wastes pool life. Already-live pool lines get a bonus (saves the
// activation fee). Pure (takes phones/rentals) so it's unit-testable.
const POOL_ACTIVATION_FEE = 8; // £ saved by reusing an already-active line

function poolScore(overlap, alreadyActive) {
  let s;
  if (overlap < 0) s = -1000 + overlap * 10;      // expires before return — bad
  else if (overlap <= 3) s = 100 - overlap;        // 97–100, minimal waste
  else s = 90 - (overlap - 3) * 1.5;               // idle pool time, light penalty
  if (alreadyActive) s += POOL_ACTIVATION_FEE;
  return s;
}

function poolReason(overlap, alreadyActive) {
  let p1;
  if (overlap < 0) p1 = `Pool expires ${Math.abs(overlap)} day(s) BEFORE return — risky, service may cut out mid-trip.`;
  else if (overlap <= 3) p1 = `Pool expires ${overlap} day(s) after return — minimal waste.`;
  else p1 = `Pool expires ${overlap} days after return — some idle pool time.`;
  return `${p1} ${alreadyActive ? 'Line already active (saves the activation fee).' : 'Needs activating first.'}`;
}

// Rank USA pooled phones that are free for [from,to]; best first.
function poolPhoneSuggestions(phones, rentals, from, to, todayISO) {
  const today = todayISO || localISO();
  return phones
    .filter(p => (p.country || '').toUpperCase() === 'USA' && p.pool && !p.maintenance &&
      phoneConflicts(rentals, p.id, from, to, today).length === 0)
    .map(p => {
      const alreadyActive = !!(p.poolExpiry && p.poolExpiry >= today);
      const overlap = p.poolExpiry
        ? Math.round((parseLocalDate(p.poolExpiry) - parseLocalDate(to)) / 86400000)
        : 999; // no expiry known → treat as lots of idle time
      return { phone: p, overlap, alreadyActive, score: poolScore(overlap, alreadyActive),
        reason: p.poolExpiry ? poolReason(overlap, alreadyActive) : 'No pool expiry on record.' };
    })
    .sort((a, b) => b.score - a.score || a.overlap - b.overlap);
}

function countChargeableDays(fromDate, toDate, country = 'USA') {
  let days = 0;
  const cur = parseLocalDate(fromDate);
  const end = parseLocalDate(toDate);
  while (cur <= end) {
    if (!isShabbatOrHoliday(cur, country)) days++;
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

// Returns the late fee in £ (chargeable late days × late_fee_per_day, which
// is £1 by default so the value doubles as the day count in displays).
function calcLateFeeDays(rental) {
  const today = localISO();
  if (rental.status === 'returned' || rental.toDate >= today) return 0;
  const lateDayStart = parseLocalDate(rental.toDate);
  lateDayStart.setDate(lateDayStart.getDate() + 1);
  const days = countChargeableDays(localISO(lateDayStart), today, rental.country || 'USA');
  return days * settingNum('late_fee_per_day', 1);
}

// Canonical money formulas — single source of truth for every debt display.
// Returned rentals use the late fee frozen at save time; live rentals compute it.
function rentalGrandTotal(r) {
  const lateFee = r.status === 'returned' ? (r.lateFee || 0) : calcLateFeeDays(r);
  return (r.price || 0) + lateFee + (r.lostChargesTotal || 0);
}

function rentalDebt(r) {
  return Math.max(0, rentalGrandTotal(r) - (r.amountPaid || 0));
}

function saveRentals(data, deletedIds = []) {
  if (saveBlocked('rentals')) return Promise.resolve({ success: false, blocked: true });
  rentals = data;
  return reportSave('rentals', window.api.saveAllRentals(data, deletedIds));
}
function savePhones(data, deletedIds = []) {
  if (saveBlocked('phones')) return Promise.resolve({ success: false, blocked: true });
  phones = data;
  return reportSave('phones', window.api.saveAllPhones(data, deletedIds));
}

// Surface a failed background save instead of leaving the operator to believe
// it worked (the toast at the call site fires optimistically). Returns the
// server result so destructive callers can await it before saying "done".
function reportSave(label, promise) {
  return promise
    .then(res => {
      if (!res || res.success === false) {
        toast(`Couldn’t save ${label} — reload to check nothing was lost.`, 'error');
      } else if (res.conflicts && res.conflicts.length) {
        // #8 — the server caught a double-booking a racing tab slipped past.
        const c = res.conflicts[0];
        toast(`⚠️ Double-booking: ${c.a?.customer || 'a rental'} and ${c.b?.customer || 'another'} overlap on the same phone. Check the rentals list.`, 'error');
      }
      return res || { success: false };
    })
    .catch(() => {
      toast(`Couldn’t save ${label} — check your connection and reload.`, 'error');
      return { success: false };
    });
}

let rentals  = [];
let phones   = [];
let sims     = [];
let bookings = [];
let simMenu  = []; // 'sim'-category service menu (SIM-only monthlies, TomTom)
let rentalSearchTerm = '';

function csToggle(wrapId) {
  const wrap = document.getElementById(wrapId);
  if (!wrap) return;
  const list = wrap.querySelector('.cs-list');
  const isOpen = list.classList.contains('open');
  document.querySelectorAll('.cs-list.open').forEach(el => el.classList.remove('open'));
  if (!isOpen) list.classList.add('open');
}
function csPick(wrapId, value, label, cb) {
  const wrap = document.getElementById(wrapId);
  if (wrap) {
    wrap.querySelector('.cs-btn span').textContent = label;
    wrap.querySelector('.cs-list').classList.remove('open');
    wrap.querySelectorAll('.cs-item').forEach(el => el.classList.toggle('cs-active', el.dataset.value === value));
  }
  if (cb) cb(value);
}
function clearRentalFilters() {
  // Reset the shared control's dimensions; repaint the whole tab so the
  // <select>s show their defaults again (sort choice is left alone).
  kcView('rentals').dims = { balance: 'all', status: 'all' };
  renderRentalsTab();
}
function mgComputeLateFee() {
  // Already-returned rental: the late fee was frozen at the return date — keep
  // it, don't re-accrue to today (re-opening/re-saving would inflate it).
  if (document.getElementById('mgWasReturned')?.value === '1') {
    return Number(document.getElementById('mgFrozenLateFee')?.value) || 0;
  }
  const to = document.getElementById('mgTo')?.value;
  if (!to) return 0;
  const today = localISO();
  if (to >= today) return 0;
  const country = document.getElementById('mgCountry')?.value || 'USA';
  const lateDayStart = parseLocalDate(to);
  lateDayStart.setDate(lateDayStart.getDate() + 1);
  return countChargeableDays(localISO(lateDayStart), today, country) * settingNum('late_fee_per_day', 1);
}

// The charger is ONE item to the business (the T&C prices "Charger: £10" —
// no separate cable fee), but historically it was stored as two keys
// (plug + cable). The UI now shows a single 🔌 Charger toggle/row that
// drives BOTH stored keys together; old rentals that recorded plug and
// cable separately still read correctly (worst status wins, charges sum).
const MG_UI_ITEMS = ['phone', 'sim', 'charger'];
function eqKeysFor(item) { return item === 'charger' ? ['plug', 'cable'] : [item]; }
function chargerGiven(r) { return (r.equipmentGiven?.plug ?? false) || (r.equipmentGiven?.cable ?? false); }
// Worst status across the stored keys of a UI item: lost > undecided > returned.
// Considers given keys PLUS any key recorded 'lost' even if its given-toggle
// was later switched off — a lost item carries a £ charge, and hiding it would
// silently drop that charge on the next save (verify finding 07-17).
function uiItemStatus(r, item) {
  const keys = eqKeysFor(item);
  const considered = item === 'charger'
    ? keys.filter(k => (r.equipmentGiven?.[k] ?? false) || getItemStatus(r, k) === 'lost')
    : keys;
  const sts = (considered.length ? considered : keys).map(k => getItemStatus(r, k));
  if (sts.includes('lost')) return 'lost';
  if (sts.includes('undecided')) return 'undecided';
  return 'returned';
}
function uiItemLostAmt(r, item) {
  const sum = eqKeysFor(item).reduce((s, k) => s + (parseFloat(r.lostCharges?.[k]) || 0), 0);
  return sum > 0 ? sum : '';
}

// Returns lost-item charges entered in the modal: { total, items: [{label, amount}] }
function mgComputeLostCharges() {
  const LABELS = { phone: 'Phone', sim: 'SIM card', charger: 'Charger' };
  const items = [];
  let total = 0;
  MG_UI_ITEMS.forEach(item => {
    if (document.getElementById('mgItemStatus_' + item)?.value !== 'lost') return;
    const amt = parseFloat(document.getElementById('mgLostAmt_' + item)?.value) || 0;
    if (amt > 0) { items.push({ label: LABELS[item], amount: amt }); total += amt; }
  });
  return { total, items };
}

// Grand total shown in the breakdown: rental price + late fee + lost charges
function mgComputeTotal() {
  const price = parseFloat(document.getElementById('mgPrice')?.value) || 0;
  return price + mgComputeLateFee() + mgComputeLostCharges().total;
}

function mgToggleGiven(item) {
  const id = 'mgGiven' + item.charAt(0).toUpperCase() + item.slice(1);
  const el = document.getElementById(id);
  if (!el) return;
  const isNowGiven = el.dataset.given !== '1';
  el.dataset.given = isNowGiven ? '1' : '0';
  const eqRow = document.getElementById('mgEqRow_' + item);
  if (eqRow) eqRow.style.display = isNowGiven ? 'flex' : 'none';
  // A USA phone without a SIM prices on the cheaper no-SIM row.
  if (item === 'sim') mgUpdateCalc();
}

// Toggle item status. Clicking the active side again → undecided (pending).
function mgSetItemStatus(item, newStatus) {
  const hiddenEl = document.getElementById('mgItemStatus_' + item);
  if (!hiddenEl) return;
  const resolved = hiddenEl.value === newStatus ? 'undecided' : newStatus;
  mgApplyItemStatus(item, resolved);
}

// Reset an item to undecided (called by the × clear button).
function mgClearItemStatus(item) { mgApplyItemStatus(item, 'undecided'); }

function mgApplyItemStatus(item, resolved) {
  const hiddenEl = document.getElementById('mgItemStatus_' + item);
  if (hiddenEl) hiddenEl.value = resolved;

  const track   = document.getElementById('mgSlide_'        + item);
  const badge   = document.getElementById('mgPendingBadge_' + item);
  const clearBtn= document.getElementById('mgClearItem_'    + item);
  const lostAmt = document.getElementById('mgLostAmt_'      + item);

  if (track)    track.dataset.status     = resolved;
  const pending = resolved === 'undecided';
  if (badge)    badge.style.display      = pending ? 'inline-block' : 'none';
  if (clearBtn) clearBtn.style.display   = pending ? 'none' : 'inline-flex';

  if (lostAmt) {
    const show = resolved === 'lost';
    lostAmt.style.display = show ? 'inline-block' : 'none';
    if (!show) lostAmt.value = '';
  }
  mgUpdateCalc();
}
function nrToggleGiven(item) {
  const el = document.getElementById('nrGiven_' + item);
  if (!el) return;
  el.dataset.given = el.dataset.given === '1' ? '0' : '1';
  el.dataset.touched = '1'; // a manual choice wins over date-driven defaults
  // A USA phone without a SIM prices on the cheaper no-SIM row.
  if (item === 'sim') updateRentalCalc();
}
// A walk-in (From = today or earlier) hands the phone + charger over now, so
// they default to given; a future From is a reservation (mirrors the
// isReservation rule at save) and nothing has been handed over yet. Toggles
// the user has touched are left alone.
function nrSetGivenDefaults() {
  const from = document.getElementById('rFrom')?.value || localISO();
  const given = from <= localISO() ? '1' : '0';
  for (const item of ['phone', 'charger']) {
    const el = document.getElementById('nrGiven_' + item);
    if (el && el.dataset.touched !== '1') el.dataset.given = given;
  }
}

function renderRentalsTab() {
  const content = document.getElementById('mainContent');
  const today0  = localISO();
  const activeRentals   = rentals.filter(r => r.status === 'active').length;
  const availablePhones = phones.filter(p => p.status === 'available' && !p.maintenance).length;
  const returningToday  = rentals.filter(r => r.status === 'active' && r.toDate === today0).length;
  const outstandingDebt = rentals.reduce((s, r) => s + rentalDebt(r), 0);
  // Only shown once there is something to review, so the card doesn't sit at
  // zero forever after the import is worked through.
  const needsReviewCount = reviewQueue().length;

  // B5 — the last tab predating the shared control: balance + status are now
  // kcFilterSort dimensions, so Rentals reads like every other list tab.
  const rentalBar = kcFilterSort('rentals', [
    { dim: 'balance', title: 'Balance', options: [
      { value: 'all', label: 'Balance: all' },
      { value: 'paid', label: 'Fully paid', test: r => (r.amountPaid || 0) >= rentalGrandTotal(r) },
      { value: 'debt', label: 'Has debt', test: r => (r.amountPaid || 0) < rentalGrandTotal(r) },
    ] },
    { dim: 'status', title: 'Status', options: [
      { value: 'all', label: 'Status: all' },
      { value: 'active', label: 'Active', test: r => getComputedStatus(r, localISO()) === 'active' },
      { value: 'overdue', label: 'Overdue', test: r => getComputedStatus(r, localISO()) === 'overdue' },
      { value: 'returned', label: 'Returned', test: r => getComputedStatus(r, localISO()) === 'returned' },
      { value: 'returned_incomplete', label: 'Returned ⚠️', test: r => getComputedStatus(r, localISO()) === 'returned_incomplete' },
    ] },
  ], [
    { value: 'default', label: 'Sort: Default' },
    { value: 'name', label: 'Customer A–Z', cmp: kcCmpStr(r => r.customerName) },
    { value: 'due', label: 'Due date (soonest)', cmp: (a, b) => String(a.toDate || '9999').localeCompare(String(b.toDate || '9999')) },
    { value: 'owed', label: 'Most owed', cmp: kcCmpNum(r => rentalGrandTotal(r) - (r.amountPaid || 0)) },
    { value: 'price', label: 'Price (high–low)', cmp: kcCmpNum(r => r.price || 0) },
  ], renderRentalRows);

  content.innerHTML = `
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">Active Rentals</div>
        <div class="stat-value green">${activeRentals}</div>
        <div class="stat-sub">Currently out</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Available Phones</div>
        <div class="stat-value" style="${statBandStyle('phonesFree', availablePhones)}">${availablePhones}</div>
        <div class="stat-sub">Ready to rent</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Returning Today</div>
        <div class="stat-value" style="${statBandStyle('returning', returningToday)}">${returningToday}</div>
        <div class="stat-sub">Expected back</div>
      </div>
      ${needsReviewCount > 0 ? `
      <div class="stat-card" role="button" tabindex="0" style="cursor:pointer;"
        onclick="openReviewQueueModal()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openReviewQueueModal()}"
        title="Lines the imported sheet couldn't tell us for certain">
        <div class="stat-label">Needs a look</div>
        <div class="stat-value gold">${needsReviewCount}</div>
        <div class="stat-sub">From the imported sheet</div>
      </div>` : ''}
      <div class="stat-card">
        <div class="stat-label">Outstanding Debt</div>
        <div class="stat-value" style="${statBandStyle('arrears', outstandingDebt)}">${fmtGbp(outstandingDebt)}</div>
        <div class="stat-sub">Unpaid balances</div>
      </div>
    </div>

    <div style="display:flex; gap:10px; margin-bottom:20px; flex-wrap:wrap;">
      <button class="btn btn-primary" onclick="openNewRentalModal()">📱 New Rental</button>
      <button class="btn btn-outline" onclick="openManagePhonesModal()">⚙️ Manage phones</button>
      <button class="btn ${rentalView === 'calendar' ? 'btn-primary' : 'btn-outline'}"
        onclick="rentalView = rentalView === 'calendar' ? 'list' : 'calendar'; renderRentalsTab();">📅 Availability</button>
      <input class="search-box" style="width:280px;" type="text" id="rentalScan"
        inputmode="numeric" autocomplete="off"
        placeholder="📷 Scan IMEI — out or back"
        title="Scan the handset: if it's out it comes back, if it's free it goes out"
        aria-label="Scan a handset IMEI to check it out or return it"
        onkeydown="if(event.key==='Enter'){event.preventDefault();kcRentalScanEnter()}">
      <input class="search-box" style="width:280px;" type="text" id="rentalSearch"
        placeholder="Search customer or phone…"
        value="${rentalSearchTerm}"
        oninput="rentalSearchTerm=this.value; renderRentalRows()">
    </div>

    ${rentalView === 'calendar' ? availabilityCalendarHtml() : ''}

    <div class="rentals-split" style="${rentalView === 'calendar' ? 'display:none;' : ''}">
      <div class="rentals-split-col">
        <div class="section-header">
          <div class="section-title">Active & Recent Rentals</div>
        </div>
        <div class="rentals-filter-row" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          ${rentalBar}
          <button class="btn btn-outline" style="font-size:var(--fs-small);padding:5px 12px;" onclick="clearRentalFilters()">Clear</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th><th>Phone</th><th>From → To</th>
                <th>Days</th><th>Price</th><th>Balance</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody id="rentalTableBody"></tbody>
          </table>
        </div>
      </div>
      <div class="rentals-split-col">
        <div class="section-header">
          <div class="section-title">Phone Inventory</div>
        </div>
        <div class="rentals-filter-row rentals-inv-spacer" aria-hidden="true"></div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Number</th><th>Country</th><th>Pool</th>
                <th>Expires</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody id="phoneTableBody"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  renderRentalRows();
  renderPhoneRows();
}

// ── Availability calendar (rental-industry pattern) ─────────────────────
// Month grid: one row per phone, one narrow cell per day. Colours: indigo =
// out (active), gold = reserved, red = overdue, grey = Shabbat/YT, white =
// free. Click a free cell to reserve that phone from that day; click an
// occupied one to manage the rental.

let rentalView = 'list';
let calMonth = null; // 'YYYY-MM'; defaults to the current month

function calShift(delta) {
  const [y, m] = (calMonth || localISO().slice(0, 7)).split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  calMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  renderRentalsTab();
}

function calQuickReserve(phoneId, iso) {
  openNewRentalModal();
  setTimeout(() => {
    const fromEl = document.getElementById('rFrom');
    if (fromEl) { fromEl.value = iso; showHebrewDate('rFrom', 'rFromHeb'); }
    refreshRentalPhoneOptions();
    const sel = document.getElementById('rPhone');
    if (sel && [...sel.options].some(o => o.value === phoneId)) {
      sel.value = phoneId;
      updateRentalPhoneInfo();
    }
  }, 60);
}

function availabilityCalendarHtml() {
  const today = localISO();
  if (!calMonth) calMonth = today.slice(0, 7);
  const [y, m] = calMonth.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const monthName = new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const iso = (d) => `${calMonth}-${String(d).padStart(2, '0')}`;

  // Precompute each phone's blocking intervals once.
  const blocks = new Map(phones.map(p => [p.id,
    rentals.filter(r => r.phoneId === p.id && r.status !== 'returned' && r.fromDate && r.toDate)
      .map(r => ({ r, end: (r.status !== 'booked' && r.toDate < today) ? today : r.toDate }))]));

  const dayHead = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    const dow = new Date(y, m - 1, d).getDay();
    return `<th scope="col" class="cal-day${dow === 6 ? ' cal-shabbat' : ''}${iso(d) === today ? ' cal-today' : ''}">${d}</th>`;
  }).join('');

  const rows = phones.map(p => {
    const cells = Array.from({ length: daysInMonth }, (_, i) => {
      const dIso = iso(i + 1);
      const hit = (blocks.get(p.id) || []).find(b => b.r.fromDate <= dIso && b.end >= dIso);
      const dow = new Date(y, m - 1, i + 1).getDay();
      if (!hit) {
        return `<td class="cal-cell cal-free${dow === 6 ? ' cal-shabbat' : ''}${dIso === today ? ' cal-today' : ''}"
          title="Free — click to reserve ${escHtml(p.number)} from ${fmtDate(dIso)}"
          aria-label="${fmtDate(dIso)}: free"
          onclick="calQuickReserve('${p.id}','${dIso}')"></td>`;
      }
      const state = hit.r.status === 'booked' ? 'booked'
        : (hit.r.status !== 'returned' && hit.r.toDate < today) ? 'overdue' : 'active';
      // The fill used to be the ONLY signal, so gold "reserved" and red
      // "overdue" were the same cell to anyone with a colour-vision
      // deficiency — and the <td> was empty, so the whole grid read as blank
      // to a screen reader. Each state now also differs in texture or glyph
      // (see .cal-booked / .cal-overdue in globals.css) and carries a label.
      const word = { active: 'out', booked: 'reserved', overdue: 'overdue' }[state];
      const mark = state === 'overdue' ? '<span class="cal-mark" aria-hidden="true">!</span>' : '';
      return `<td class="cal-cell cal-${state}${dIso === today ? ' cal-today' : ''}"
        title="${escName(hit.r.customerName || '')} · ${fmtDate(hit.r.fromDate)} → ${fmtDate(hit.r.toDate)}${hit.r.status === 'booked' ? ' (reserved)' : ''}"
        aria-label="${fmtDate(dIso)}: ${word} — ${escName(hit.r.customerName || 'no name')}"
        onclick="openManageRentalModal('${hit.r.id}')">${mark}</td>`;
    }).join('');
    // th+scope, not td: it makes the phone the row header, so a screen reader
    // announces "07… , 14" for a cell instead of an unplaced date.
    return `<tr>
      <th scope="row" class="cal-phone"><strong>${escHtml(fmtPhone(p.number))}</strong><div class="customer-email">${escHtml(p.country)}${p.ukPlan === 'unlimited' ? ' intl' : ''}</div></th>
      ${cells}
    </tr>`;
  }).join('');

  return `
    <div class="table-card" style="margin-bottom:20px;padding-bottom:10px;">
      <div style="display:flex;align-items:center;gap:12px;padding:12px 14px 4px;flex-wrap:wrap;">
        <button class="btn btn-outline btn-sm" aria-label="Previous month" onclick="calShift(-1)">←</button>
        <strong style="min-width:150px;text-align:center;">${monthName}</strong>
        <button class="btn btn-outline btn-sm" aria-label="Next month" onclick="calShift(1)">→</button>
        <span style="margin-left:auto;font-size:var(--fs-micro);color:var(--muted);">
          <span style="white-space:nowrap;"><span class="cal-key cal-active"></span> out</span>
          <span style="white-space:nowrap;"><span class="cal-key cal-booked"></span> reserved (striped)</span>
          <span style="white-space:nowrap;"><span class="cal-key cal-overdue"></span> overdue (!)</span>
          <span style="white-space:nowrap;"><span class="cal-key cal-shabbat"></span> Shabbos</span>
          · click a free day to reserve</span>
      </div>
      <div style="overflow-x:auto;padding:0 14px 6px;">
        <table class="cal-table">
          <thead><tr><th class="cal-phone">Phone</th>${dayHead}</tr></thead>
          <tbody>${rows.length ? rows : `<tr><td colspan="${daysInMonth + 1}" style="color:var(--muted);padding:14px;">No phones in the fleet yet.</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;
}

// Returns per-item status ('undecided' | 'returned' | 'lost'), with backwards-compat for old returnedItems boolean shape
function getItemStatus(r, item) {
  if (r.itemStatus?.[item] !== undefined) return r.itemStatus[item];
  if (r.returnedItems?.[item] === true) return 'returned';
  return 'undecided';
}

function getComputedStatus(r, today) {
  if (r.status === 'booked') return 'booked'; // reservation — not picked up yet
  if (r.status !== 'returned') return r.toDate < today ? 'overdue' : 'active';
  const eq = r.equipmentGiven || { phone: true, sim: true, plug: true, cable: true };
  // Plug+cable are judged as ONE charger item (same merged semantics as the
  // manage modal), so the ⚠️ badge can never point at a key the UI can't show.
  const incomplete =
    ['phone', 'sim'].some(k => (eq[k] ?? true) && getItemStatus(r, k) === 'undecided') ||
    (((eq.plug ?? true) || (eq.cable ?? true)) && uiItemStatus(r, 'charger') === 'undecided');
  return incomplete ? 'returned_incomplete' : 'returned';
}

// All rentals blocking a phone over [from,to]. Overdue rentals keep blocking
// until today (the handset is still out); returned ones never block.
function phoneConflicts(allRentals, phoneId, from, to, todayISO, excludeId = null) {
  return allRentals.filter(r => {
    if (r.phoneId !== phoneId || r.id === excludeId || r.status === 'returned') return false;
    if (!r.fromDate || !r.toDate) return false;
    const blockEnd = (r.status !== 'booked' && r.toDate < todayISO) ? todayISO : r.toDate;
    return r.fromDate <= to && blockEnd >= from;
  });
}

function renderRentalRows() {
  const tbody = document.getElementById('rentalTableBody');
  if (!tbody) return;
  const today = localISO();

  const term = rentalSearchTerm.toLowerCase();
  let filtered = rentals;
  if (term) {
    filtered = filtered.filter(r =>
      (r.customerName || '').toLowerCase().includes(term) ||
      (r.phoneNumber  || '').toLowerCase().includes(term)
    );
  }
  // Balance + status now live in the shared control's dimensions (B5).
  filtered = kcViewApply('rentals', filtered);

  if (filtered.length === 0) {
    // "No rentals yet" was shown even with a full pool behind an active
    // filter — the one message a busy shop would read as data loss.
    const narrowed = rentals.length > 0;
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="emoji">📱</div>
      <p>${narrowed ? 'No rentals match this view.' : 'No rentals yet.'}</p>
      <small>${narrowed ? '' : 'Click "New Rental" to get started.'}</small>
      ${narrowed ? kcClearFiltersBtn('rentals') : ''}</div></td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    const computedStatus = getComputedStatus(r, today);
    let statusBadge;
    if      (computedStatus === 'booked')               statusBadge = `<span class="badge" style="background:var(--canvas-cream);color:var(--gold);">📅 Reserved${r.fromDate <= today ? ' — pickup due' : ''}</span>`;
    else if (computedStatus === 'active' && r.toDate === today) statusBadge = `<span class="badge badge-sim">Due Today</span>`;
    else if (computedStatus === 'active')               statusBadge = `<span class="badge badge-rental">Active</span>`;
    else if (computedStatus === 'overdue')              statusBadge = `<span class="badge" style="background:rgba(239,68,68,0.15);color:var(--danger-ink);">Overdue ⚠️</span>`;
    else if (computedStatus === 'returned')             statusBadge = `<span class="badge badge-active">Returned</span>`;
    else                                                statusBadge = `<span class="badge" style="background:var(--canvas-cream);color:var(--gold);">Returned ⚠️</span>`;

    const paid = r.amountPaid || 0;
    const totalOwed = rentalGrandTotal(r) - paid;
    const debtColor = totalOwed > 0 ? 'color:var(--danger-ink);' : 'color:var(--success);';
    return `<tr style="cursor:pointer;" onclick="if(!event.target.closest('.action-btn'))openManageRentalModal('${r.id}')">
      <td>
        <div class="customer-name">${nameHtml(r.customerName || '—')}</div>
        <div class="customer-email" style="font-size:var(--fs-micro);">${r.vn ? '🔢 +'+escHtml(r.vnPrefix || '') : ''}</div>
      </td>
      <td class="kc-phone">${rentalDeviceChip(r, { stacked: true })}</td>
      <td class="kc-date" style="font-size:var(--fs-micro);">${fmtDate(r.fromDate)}<br>${fmtDate(r.toDate)}</td>
      <td style="text-align:center;">${r.chargeableDays}d</td>
      <td style="color:var(--success);font-weight:700;">${fmtGbp(r.price)}</td>
      <td class="kc-money" style="font-weight:700;${debtColor}">${totalOwed > 0 ? '£'+totalOwed+' owed' : '✓ Paid'}</td>
      <td>${statusBadge}</td>
      <td>
        <div class="row-actions">
          ${computedStatus === 'booked' ? `<button class="action-btn" style="color:var(--success);font-weight:600;" onclick="startReservation('${r.id}')">▶ Start</button>` : ''}
          <button class="action-btn" onclick="openRemindModal('rental','${r.id}')" title="Remind me">⏰</button>
          <button class="action-btn" onclick="openRentalSmsModal('${r.id}')" title="Draft a status SMS (does not send)">✉️</button>
          <button class="action-btn" onclick="openManageRentalModal('${r.id}')">⚙ Manage</button>
          <button class="action-btn danger" onclick="deleteRental('${r.id}')">Delete</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function renderPhoneRows() {
  const tbody = document.getElementById('phoneTableBody');
  if (!tbody) return;

  if (phones.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="emoji">📋</div><p>No phones in inventory.</p><small>Click "Manage Phones" to add phones.</small></div></td></tr>`;
    return;
  }

  const today = localISO();
  tbody.innerHTML = phones.map(p => {
    const poolExpired = p.poolExpiry && p.poolExpiry < today;
    let statusBadge;
    if (p.status === 'rented')         statusBadge = `<span class="badge badge-rental">Rented</span>`;
    else if (p.maintenance)            statusBadge = `<span class="badge" style="background:rgba(217,119,6,0.14);color:var(--gold);" title="${escHtml(p.maintenanceNote || 'Out of service')}">🔧 Maintenance</span>`;
    else if (p.status === 'available' && p.poolExpiry && !poolExpired)
                                        statusBadge = `<span class="badge badge-sim">Available (active pool)</span>`;
    else if (poolExpired)               statusBadge = `<span class="badge" style="background:rgba(107,114,128,0.15);color:var(--muted);">Pool Expired</span>`;
    else                                statusBadge = `<span class="badge badge-active">Available</span>`;

    const isUSA = p.country === 'USA';
    const poolDisplay   = isUSA ? (p.pool || '—') : 'N/A';
    const expiryDisplay = isUSA ? (p.poolExpiry || '—') : 'N/A';
    return `<tr style="cursor:pointer;" onclick="if(!event.target.closest('.action-btn'))openEditPhoneModal('${p.id}')">
      ${/* No flag on the chip here — this table gives the country its own
            column right beside it, and the same fact twice in two cells reads
            as two facts. */''}
      <td class="kc-phone">${deviceChip(p, { flag: false, stacked: true })}</td>
      <td>${countryFlag(p.country)} ${escHtml(p.country)}</td>
      <td style="font-size:var(--fs-small);color:${isUSA?'':'var(--muted)'};">${isUSA ? escHtml(poolDisplay) : poolDisplay}</td>
      <td style="font-size:var(--fs-micro);color:${poolExpired?'var(--danger-ink)':isUSA?'var(--muted)':'var(--muted)'};">${isUSA ? expiryDisplay : '<span style="color:var(--muted);">N/A</span>'}</td>
      <td>${statusBadge}</td>
      <td>
        <div class="row-actions">
          <button class="action-btn" onclick="openEditPhoneModal('${p.id}')">Edit</button>
          <button class="action-btn danger" onclick="deletePhone('${p.id}')">Delete</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ══ NEW RENTAL MODAL ══
// Phones offerable for a date range — DATE-aware, not status-aware, so a
// phone that's out today can still be reserved for future dates.
function phoneOptionsFor(from, to) {
  const today = localISO();
  // A phone under maintenance is never offerable, whatever the dates say.
  // "Not rented" is not the same as "rentable". A permanent line is in a
  // customer's pocket by arrangement, a not_working one is broken, and an
  // unknown one hasn't been read yet — none of them have a rental record, so
  // the conflict check alone would happily offer all three out.
  const inService = phones.filter(p => !p.maintenance && p.status === 'available');
  const list = (from && to && to >= from)
    ? inService.filter(p => phoneConflicts(rentals, p.id, from, to, today).length === 0)
    : inService;
  return list
    .map(p => `<option value="${p.id}">${escHtml(fmtPhone(p.number))} · ${escHtml(p.country)} · ${escHtml(p.company||'')} ${p.pool ? '(Pool: '+escHtml(p.pool)+')' : ''}</option>`)
    .join('');
}

// Dates changed → rebuild the phone list for that window, keeping the
// current pick if it's still free.
function refreshRentalPhoneOptions() {
  const sel = document.getElementById('rPhone');
  if (!sel) return;
  const from = document.getElementById('rFrom')?.value;
  const to = document.getElementById('rTo')?.value;
  const prev = sel.value;
  sel.innerHTML = `<option value="">— Select phone —</option>` + phoneOptionsFor(from, to);
  if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev;
  else if (prev) { sel.value = ''; toast('That phone is not free for these dates — pick another.', 'warning'); }
  const hint = document.getElementById('rPhoneHint');
  if (hint && from && to && to >= from) {
    hint.textContent = `(${sel.options.length - 1} free ${fmtDate(from)} → ${fmtDate(to)})`;
  }
}

// ── Scan to check out / return ────────────────────────────────────────────
// One scan of the handset decides which half of the rental cycle you are in:
// a phone that is out comes back, a phone that is free goes out.
//
// This mirrors lib/rentalScan.mjs::resolveRentalScan exactly (that module is
// the canonical, unit-tested statement of the decision — see
// test/rentalScan.test.mjs). Kept as a mirror here only because the browser
// has no bundler to import the module. Change both together.
//
// The scan never writes. A return carries a late fee and possible lost-item
// charges, so 'return' only lands the operator on Manage Rental with the
// Returned toggle flipped and the charge breakdown in front of them — the
// Save is still theirs.
function kcRentalScanResolve(raw, phoneList = [], rentalList = []) {
  const q = String(raw || '').trim();
  if (!q) return { action: 'none', message: '' };
  const digits = q.replace(/\D/g, '');
  const tail = s => String(s || '').replace(/\D/g, '').slice(-10);

  // IMEI is the barcode printed on the handset, so it wins. The number is the
  // fallback for a phone whose IMEI was never recorded. Both compare on the
  // last 10 digits, so 07…, 447… and 00447… all meet — the same rule the
  // Gmail sweep used. The 6/9-digit floors stop a short stray scan matching.
  const phone = (digits.length >= 6 && phoneList.find(p => tail(p.imei) && tail(p.imei) === tail(digits)))
    || (digits.length >= 9 && phoneList.find(p => tail(p.number) && tail(p.number) === tail(digits)))
    || null;
  if (!phone) return { action: 'none', message: `Nothing matches “${q}”. Scan the IMEI on the handset, or type the number.` };

  const label = [phone.model, phone.number].filter(Boolean).join(' · ') || phone.imei || 'phone';
  // An open rental wins over every other state. A phone that is out is out,
  // even if its inventory row drifted — the customer is standing there with it.
  const open = rentalList.find(r => r.phoneId === phone.id && r.status !== 'returned');
  if (open) {
    return {
      action: 'return', phoneId: phone.id, rentalId: open.id,
      message: `${label} — back from ${open.customerName || 'the customer'}. Check the charges, then save.`,
    };
  }
  if (phone.maintenance) {
    return {
      action: 'blocked', phoneId: phone.id,
      message: `${label} is on maintenance hold${phone.maintenanceReason ? ` (${phone.maintenanceReason})` : ''} — clear the hold before renting it out.`,
    };
  }
  if (phone.status && phone.status !== 'available') {
    return { action: 'blocked', phoneId: phone.id, message: `${label} is marked ${phone.status}, not available to rent.` };
  }
  return { action: 'checkout', phoneId: phone.id, message: `${label} is free — starting a new rental.` };
}

function kcRentalScanEnter() {
  const el = document.getElementById('rentalScan');
  if (!el) return;
  const res = kcRentalScanResolve(el.value, phones, rentals);
  if (res.action === 'none') { if (res.message) toast(res.message, 'warning'); return; }
  if (res.action === 'blocked') { toast(res.message, 'warning'); el.value = ''; return; }
  el.value = '';

  if (res.action === 'checkout') { openNewRentalModal(null, res.phoneId); toast(res.message, 'success'); return; }

  openManageRentalModal(res.rentalId);
  // The modal is built synchronously above, so its controls are here now.
  const hidden = document.getElementById('mgReturned');
  if (hidden && hidden.value !== '1') toggleReturned();
  const anchor = document.getElementById('mgReturnedToggle')?.closest('.form-group');
  if (anchor) {
    const note = document.createElement('div');
    note.setAttribute('role', 'status');
    note.style.cssText = 'margin-top:8px;font-size:var(--fs-small);color:var(--muted);background:var(--bg-secondary);border-radius:6px;padding:7px 9px;';
    note.textContent = '📷 Scanned in — marked returned for you. Check the charges below before saving.';
    anchor.appendChild(note);
  }
  toast(res.message, 'success');
}

function openNewRentalModal(preselectCustomerId = null, preselectPhoneId = null) {
  const availablePhoneOptions = phoneOptionsFor(null, null);

  showDynamicModal(`
    <div class="modal-title">📱 New Rental</div>
    <div class="form-grid">
      <div class="form-group form-full">
        <label class="form-label">Customer *</label>
        <div class="customer-search-wrap">
          <!-- #79 — ONE type-ahead control; rCustomer is now the hidden value it fills -->
          <input type="hidden" id="rCustomer">
          <input class="form-input" type="text" id="rCustomerSearch"
            placeholder="Type a name or number…" autocomplete="off"
            oninput="filterCustomerDropdown()" onfocus="filterCustomerDropdown()"
            onkeydown="rentalPickerKey(event)">
          <div class="customer-dropdown" id="rCustomerDropdown"></div>
        </div>
        <div id="rCustomerSelected" style="font-size:var(--fs-small);color:var(--success);margin-top:4px;"></div>
      </div>

      <div class="form-group form-full">
        <label class="form-label">Phone * <span style="color:var(--muted);font-weight:400;" id="rPhoneHint">(pick dates to see availability)</span></label>
        <select class="form-input" id="rPhone" onchange="updateRentalPhoneInfo(); updateRentalCalc();">
          <option value="">— Select phone —</option>
          ${availablePhoneOptions}
        </select>
        <div id="rPhoneInfo" style="font-size:var(--fs-small);color:var(--muted);margin-top:4px;"></div>
      </div>

      <div class="form-group">
        <label class="form-label">From Date *</label>
        <input class="form-input" type="date" id="rFrom" onchange="refreshRentalPhoneOptions(); updateRentalCalc(); nrSetGivenDefaults(); showHebrewDate('rFrom','rFromHeb')">
        <div class="hebrew-date-label" id="rFromHeb"></div>
      </div>
      <div class="form-group">
        <label class="form-label">To Date * (inclusive)</label>
        <input class="form-input" type="date" id="rTo" onchange="refreshRentalPhoneOptions(); updateRentalCalc(); showHebrewDate('rTo','rToHeb')">
        <div class="hebrew-date-label" id="rToHeb"></div>
      </div>

      <div class="form-group form-full" id="rCalcBox" style="display:none;">
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px 16px;font-size:var(--fs-body);">
          <div id="rCalcText"></div>
        </div>
      </div>

      <div class="form-group form-full" style="flex-direction:row;align-items:center;gap:10px;">
        <input type="checkbox" id="rAddVN" style="width:16px;height:16px;cursor:pointer;accent-color:var(--accent);"
          onchange="document.getElementById('rVNSection').style.display=this.checked?'contents':'none'">
        <label for="rAddVN" style="font-size:var(--fs-ui);cursor:pointer;">🔢 Add Virtual Number</label>
      </div>

      <div id="rVNSection" style="display:none;" class="form-full">
        <div class="form-grid" style="margin-top:0;">
          <div class="form-group">
            <label class="form-label">Prefix / City</label>
            <select class="form-input" id="rVNPrefix">
              <option value="718">718 – Brooklyn, NY</option>
              <option value="347">347 – Brooklyn, NY</option>
              <option value="212">212 – Manhattan, NY</option>
              <option value="646">646 – Manhattan, NY</option>
              <option value="323">323 – Los Angeles, CA</option>
              <option value="312">312 – Chicago, IL</option>
              <option value="410">410 – Baltimore, MD</option>
              <option value="732">732 – Lakewood, NJ</option>
              <option value="848">848 – Lakewood, NJ</option>
              <option value="845">845 – Monsey, NY</option>
              <option value="011972">011972 – Israel</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Subscription</label>
            <select class="form-input" id="rVNSub" onchange="updateVNPrice()">
              <option value="weekly">Weekly (£5/week)</option>
              <option value="monthly">Monthly / 30 days (£10)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">VN Price (£)</label>
            <input class="form-input" type="number" id="rVNPrice" value="5" readonly style="background:var(--bg-secondary);cursor:default;color:var(--muted);">
          </div>
        </div>
      </div>

      <div class="form-group form-full">
        <div class="section-divider" style="margin-bottom:8px;">Equipment given to customer</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <div class="eq-btn" tabindex="0" role="button" id="nrGiven_phone" data-given="0" onclick="nrToggleGiven('phone')">📱 Phone</div>
          <div class="eq-btn" tabindex="0" role="button" id="nrGiven_sim"   data-given="1" onclick="nrToggleGiven('sim')">💳 SIM</div>
          <div class="eq-btn" tabindex="0" role="button" id="nrGiven_charger" data-given="0" onclick="nrToggleGiven('charger')">🔌 Charger</div>
        </div>
        <div style="font-size:var(--fs-micro);color:var(--muted);margin-top:6px;">Tap to toggle — bright = given</div>
      </div>

      <div class="form-group form-full" id="rDiscountRow">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:var(--fs-body);">
          <input type="checkbox" id="rAddDiscount" style="accent-color:var(--accent);"
            onchange="document.getElementById('rDiscountBox').style.display=this.checked?'flex':'none'; updateRentalCalc()">
          🏷️ Apply discount
        </label>
        <div id="rDiscountBox" style="display:none;gap:8px;align-items:center;margin-top:8px;">
          <select class="form-input" id="rDiscountType" style="width:100px;padding:7px 10px;" onchange="updateRentalCalc()">
            <option value="percent">% off</option>
            <option value="fixed">£ off</option>
          </select>
          <input class="form-input" type="number" id="rDiscountValue" value="0" min="0" step="0.5"
            style="width:90px;padding:7px 10px;" oninput="updateRentalCalc()">
        </div>
      </div>

      <div class="form-group form-full">
        <label class="form-label">Notes</label>
        <input class="form-input" type="text" id="rNotes" placeholder="Any notes...">
      </div>

      <div class="form-group form-full">
        <div class="section-divider" style="margin-bottom:8px;">Payment</div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <select class="form-input" id="rPay" style="width:210px;" onchange="rPayMethodChange()">
            <option value="account">Put on account (wallet)</option>
            <option value="cash">Paid now — 💵 Cash</option>
            <option value="card">Paid now — 💳 Card</option>
            <option value="bank_transfer">Paid now — 🏦 Transfer</option>
          </select>
          <span id="rPayAmountWrap" style="display:none;align-items:center;gap:6px;font-size:var(--fs-body);">
            £<input class="form-input" type="number" id="rPayAmount" step="0.01" min="0" style="width:100px;" oninput="this.dataset.touched='1'">
            <button type="button" class="btn btn-outline btn-sm" style="font-size:var(--fs-micro);padding:4px 10px;" onclick="rPayFull()">Full total</button>
          </span>
        </div>
        <div style="font-size:var(--fs-micro);color:var(--muted);margin-top:4px;">"Paid now" settles the rental immediately — leave on account to bill it to the wallet.</div>
      </div>

      <div class="form-group form-full">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:var(--fs-body);">
          <input type="checkbox" id="rDeposit" style="accent-color:var(--accent);"
            onchange="document.getElementById('rDepositBox').style.display=this.checked?'flex':'none'">
          🔒 Hold a refundable deposit
        </label>
        <div id="rDepositBox" style="display:none;gap:8px;align-items:center;margin-top:8px;">
          £<input class="form-input" type="number" id="rDepositAmount" min="0" step="1" style="width:100px;" placeholder="e.g. 50">
          <span style="font-size:var(--fs-micro);color:var(--muted);">Recorded as held; refunded on a clean return. Not billed to the wallet.</span>
        </div>
      </div>

      <div class="form-group form-full">
        <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;font-size:var(--fs-body);">
          <input type="checkbox" id="rTerms" style="accent-color:var(--accent);margin-top:2px;"
            onchange="document.getElementById('rTermsName').style.display=this.checked?'block':'none'">
          <span>📝 Customer acknowledged the loss &amp; late-return terms at pickup</span>
        </label>
        <input class="form-input" id="rTermsName" style="display:none;margin-top:8px;width:260px;"
          placeholder="Type the customer's name to sign">
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeDynamicModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveNewRental()">💾 Save rental</button>
    </div>
  `);

  if (preselectCustomerId) selectRentalCustomer(preselectCustomerId); // #79 fills the one picker
  const today = localISO();
  const next7 = localISO(new Date(Date.now() + 7*86400000));
  document.getElementById('rFrom').value = today;
  document.getElementById('rTo').value   = next7;
  // Arrived by scan: the handset is in the operator's hand, so pick it. Only if
  // the date-filtered picker actually offers it — a phone booked out over these
  // dates must stay unpickable, scan or no scan.
  if (preselectPhoneId) {
    const sel = document.getElementById('rPhone');
    if (sel && [...sel.options].some(o => o.value === preselectPhoneId)) {
      sel.value = preselectPhoneId;
      updateRentalPhoneInfo();
    } else {
      toast('That phone is not free for these dates — pick the dates first.', 'warning');
    }
  }
  nrSetGivenDefaults();
  updateRentalCalc();
  showHebrewDate('rFrom','rFromHeb');
  showHebrewDate('rTo','rToHeb');
}

function updateRentalPhoneInfo() {
  const sel = document.getElementById('rPhone');
  const p   = phones.find(x => x.id === sel.value);
  const box = document.getElementById('rPhoneInfo');
  if (!p) { box.textContent = ''; return; }
  if (p.poolExpiry) {
    box.textContent = `Pool expires: ${p.poolExpiry}`;
    box.style.color = 'var(--gold)';
  } else {
    box.textContent = '';
  }
}

// BUSINESS_RULES §1.3: weekly virtual number is PER WEEK (minimum 1 week)
// and PER COUNTRY — £5/wk £10/30d for USA & Canada, £7/wk £15/30d for
// Israel & UK (customer price list, 30 Jun 2026). Weeks are counted over the
// rental's total calendar days, rounded up. Global settings keys remain the
// fallback when a country has no override.
function calcVNPrice(vnSub, fromDate, toDate, country = 'USA', ukPlan = 'standard') {
  const rate = rateFor(country, ukPlan);
  if (vnSub === 'monthly') return rate.vnPer30Days ?? settingNum('vn_per_30_days', 10);
  let weeks = 1;
  if (fromDate && toDate && toDate > fromDate) {
    const days = Math.round((parseLocalDate(toDate) - parseLocalDate(fromDate)) / 86400000) + 1;
    weeks = Math.max(1, Math.ceil(days / 7));
  }
  return (rate.vnWeekly ?? settingNum('vn_weekly', 5)) * weeks;
}

function updateVNPrice() {
  const priceEl = document.getElementById('rVNPrice');
  if (!priceEl) return;
  const vnSub = document.getElementById('rVNSub')?.value || 'weekly';
  const from  = document.getElementById('rFrom')?.value;
  const to    = document.getElementById('rTo')?.value;
  const selPhone = document.getElementById('rPhone');
  const phone = selPhone ? phones.find(p => p.id === selPhone.value) : null;
  const country = phone?.country || 'USA';
  const ukPlan  = phone?.ukPlan || 'standard';
  // Option labels carry the per-country figures (£7/£15 Israel & UK, £5/£10
  // elsewhere) so the dropdown never contradicts the computed price.
  const sub = document.getElementById('rVNSub');
  if (sub && sub.options.length >= 2) {
    const rate = rateFor(country, ukPlan);
    sub.options[0].textContent = `Weekly (£${rate.vnWeekly ?? settingNum('vn_weekly', 5)}/week)`;
    sub.options[1].textContent = `Monthly / 30 days (£${rate.vnPer30Days ?? settingNum('vn_per_30_days', 10)})`;
  }
  priceEl.value = calcVNPrice(vnSub, from, to, country, ukPlan);
}

let rLastTotal = 0; // #25 — the live rental total, so the payment row can pre-fill it

function updateRentalCalc() {
  updateVNPrice(); // rental dates drive the weekly VN price
  const from = document.getElementById('rFrom')?.value;
  const to   = document.getElementById('rTo')?.value;
  const box  = document.getElementById('rCalcBox');
  const txt  = document.getElementById('rCalcText');
  if (!from || !to || to <= from) { box.style.display='none'; return; }
  const selPhone = document.getElementById('rPhone');
  const phone    = selPhone ? phones.find(p => p.id === selPhone.value) : null;
  const country  = phone?.country || 'USA';
  const ukPlan   = phone?.ukPlan  || 'standard';
  const simGiven = document.getElementById('nrGiven_sim')?.dataset.given !== '0';
  const { chargeableDays, totalDays, price } = calcRentalPrice(from, to, country, ukPlan, simGiven);
  const excluded = totalDays - chargeableDays;
  const rate = rateFor(country, ukPlan, simGiven);
  const capTotal = rate.cap == null ? Infinity
    : rate.cap * Math.max(1, Math.ceil(totalDays / (rate.capPeriodDays || 30)));
  let finalPrice = price;
  let discountLine = '';
  const addDiscount = document.getElementById('rAddDiscount')?.checked;
  if (addDiscount) {
    const dtype = document.getElementById('rDiscountType')?.value || 'percent';
    const dval  = parseFloat(document.getElementById('rDiscountValue')?.value) || 0;
    finalPrice  = dtype === 'percent' ? Math.max(0, price * (1 - dval / 100)) : Math.max(0, price - dval);
    if (dval > 0) discountLine = ` &nbsp;|&nbsp; <span style="color:var(--gold);font-size:var(--fs-small);">-${dtype==='percent'?dval+'%':'£'+dval} discount → <strong>${fmtGbp(finalPrice)}</strong></span>`;
  } else {
    // Auto multi-phone discount (3rd+ concurrent phone); a manual discount
    // replaces it — staff choice wins.
    const autoPct = multiPhoneDiscountPct(rentals, document.getElementById('rCustomer')?.value, from, to);
    if (autoPct > 0) {
      finalPrice = Math.max(0, price * (1 - autoPct / 100));
      discountLine = ` &nbsp;|&nbsp; <span style="color:var(--gold);font-size:var(--fs-small);">3rd phone+ −${autoPct}% → <strong>${fmtGbp(finalPrice)}</strong></span>`;
    }
  }
  box.style.display = 'block';
  // Full reasoning: rate math, which days were dropped for Shabbat/Yom Tov,
  // and whether the minimum or the cap kicked in.
  const raw = chargeableDays * rate.ratePerDay;
  const capPeriods = rate.cap == null ? 0 : Math.max(1, Math.ceil(totalDays / (rate.capPeriodDays || 30)));
  const steps = [
    `${chargeableDays} chargeable day${chargeableDays === 1 ? '' : 's'} × £${rate.ratePerDay}/day = ${fmtGbp(raw)}`,
  ];
  if (rate.minCharge && chargeableDays > 0 && raw < rate.minCharge)
    steps.push(`below the £${rate.minCharge} minimum → £${rate.minCharge}`);
  if (rate.cap != null && price >= capTotal)
    steps.push(`capped at £${rate.cap}${capPeriods > 1 ? ` × ${capPeriods} periods (${rate.capPeriodDays || 30}d each) = £${capTotal}` : ''}`);
  if (country === 'USA' && !simGiven) steps.push('no-SIM rate applied');
  // USA pool suggestion: recommend the phone whose pool expiry best fits the
  // return date, unless the chosen phone is already the top pick.
  let poolLine = '';
  if (country === 'USA') {
    const ranked = poolPhoneSuggestions(phones, rentals, from, to, localISO());
    const best = ranked[0];
    if (best && best.phone.id !== (phone && phone.id)) {
      poolLine = `<div style="margin-top:6px;font-size:var(--fs-micro);line-height:1.5;">
        💡 <span style="color:var(--accent);font-weight:600;">Best pool match:</span> ${deviceChip(best.phone)}
        <button type="button" class="btn btn-outline" style="padding:1px 8px;font-size:var(--fs-micro);margin-left:4px;"
          onclick="document.getElementById('rPhone').value='${best.phone.id}';updateRentalPhoneInfo();updateRentalCalc();">Use</button>
        <br><span style="color:var(--muted);">${escHtml(best.reason)}</span></div>`;
    }
  }
  txt.innerHTML = `
    <span style="color:var(--muted);">Total days:</span> ${totalDays} &nbsp;|&nbsp;
    <span style="color:var(--muted);">Shabbos/Yom Tov excluded:</span> <span style="color:var(--gold);">${excluded}</span> &nbsp;|&nbsp;
    <span style="color:var(--muted);">Chargeable days:</span> ${chargeableDays} &nbsp;|&nbsp;
    <strong style="color:var(--success);font-size:var(--fs-ui);">${fmtGbp(price)}</strong>${discountLine}
    <div style="margin-top:6px;font-size:var(--fs-micro);color:var(--muted);line-height:1.6;">
      🧮 ${steps.join(' → ')}
      ${excluded > 0 ? `<br>📅 ${excluded} free day${excluded === 1 ? '' : 's'} — the phone is kept over these at no charge:${freeDayStamps(from, to)}` : ''}
    </div>${poolLine}
  `;
  // #25 — keep the payment row's default in step with the live total.
  // #29 — a monthly add-on VN bills on the VN path, so it isn't part of the
  // rental total the payment row defaults to (only a weekly one-off is).
  const vnMonthly = document.getElementById('rVNSub')?.value === 'monthly';
  const vnAmt = (document.getElementById('rAddVN')?.checked && !vnMonthly)
    ? (parseFloat(document.getElementById('rVNPrice')?.value) || 0) : 0;
  rLastTotal = Math.round((finalPrice + vnAmt) * 100) / 100;
  const payAmt = document.getElementById('rPayAmount');
  if (payAmt && document.getElementById('rPay')?.value !== 'account' && payAmt.dataset.touched !== '1') {
    payAmt.value = rLastTotal.toFixed(2);
  }
}

// #25 — the New-Rental payment row: choosing a "paid now" method reveals the
// amount (defaulted to the full total); "Full total" re-fills it.
function rPayMethodChange() {
  const method = document.getElementById('rPay')?.value;
  const wrap = document.getElementById('rPayAmountWrap');
  const amt = document.getElementById('rPayAmount');
  if (!wrap) return;
  if (method === 'account') { wrap.style.display = 'none'; }
  else { wrap.style.display = 'inline-flex'; if (amt && !amt.value) amt.value = (rLastTotal || 0).toFixed(2); }
}
function rPayFull() {
  const amt = document.getElementById('rPayAmount');
  if (amt) { amt.value = (rLastTotal || 0).toFixed(2); amt.dataset.touched = '1'; }
}

async function saveNewRental() {
  const customerId = document.getElementById('rCustomer').value;
  const phoneId    = document.getElementById('rPhone').value;
  const from       = document.getElementById('rFrom').value;
  const to         = document.getElementById('rTo').value;
  const notes      = document.getElementById('rNotes').value.trim();
  const addVN      = document.getElementById('rAddVN').checked;

  if (!customerId) { toast('Please select a customer.', 'error'); return; }
  if (!phoneId)    { toast('Please select a phone.', 'error'); return; }
  if (!from || !to || to <= from) { toast('Please enter valid dates.', 'error'); return; }

  // Hard double-booking guard — a phone can hold one rental per date window.
  const clash = phoneConflicts(rentals, phoneId, from, to, localISO())[0];
  if (clash) {
    toast(`That phone is taken ${fmtDate(clash.fromDate)} → ${fmtDate(clash.toDate)} (${clash.customerName}${clash.status === 'booked' ? ', reserved' : ''}).`, 'error');
    return;
  }
  // Future start = a reservation: the phone stays free until pickup.
  const isReservation = from > localISO();

  const customer = customers.find(c => c.id === customerId);
  const phone    = phones.find(p => p.id === phoneId);
  // One 🔌 Charger toggle drives both stored keys (plug + cable) — the
  // business treats the charger as a single item (T&C: "Charger: £10").
  const nrCharger = document.getElementById('nrGiven_charger')?.dataset.given === '1';
  const equipmentGiven = {
    phone: document.getElementById('nrGiven_phone')?.dataset.given === '1',
    sim:   document.getElementById('nrGiven_sim')?.dataset.given   === '1',
    plug:  nrCharger,
    cable: nrCharger,
  };
  const { chargeableDays, totalDays, price } =
    calcRentalPrice(from, to, phone.country, phone.ukPlan || 'standard', equipmentGiven.sim);

  let vnPrice = 0, vnPrefix = '', vnSub = '';
  if (addVN) {
    vnPrefix = document.getElementById('rVNPrefix').value;
    vnSub    = document.getElementById('rVNSub').value;
    vnPrice  = parseFloat(document.getElementById('rVNPrice').value) || 0;
  }

  const addDiscount = document.getElementById('rAddDiscount').checked;
  // Manual discount wins; otherwise the multi-phone rule applies itself
  // (price list: 3rd concurrent phone and more, 15% off).
  const autoPct       = addDiscount ? 0 : multiPhoneDiscountPct(rentals, customerId, from, to);
  const discountType  = addDiscount ? document.getElementById('rDiscountType').value : 'percent';
  const discountValue = addDiscount ? (parseFloat(document.getElementById('rDiscountValue').value) || 0) : autoPct;
  const discountedRental = discountValue > 0
    ? (discountType === 'percent' ? Math.max(0, price * (1 - discountValue / 100)) : Math.max(0, price - discountValue))
    : price;
  if (autoPct > 0) toast(`Multi-phone discount applied — 3rd phone and more, ${autoPct}% off.`, 'success');

  // #29 — one money model for virtual numbers. A MONTHLY add-on VN is now
  // provisioned as a real standalone virtual_numbers record and billed on the
  // recurring VN path (VN-<id>-<month>), so it is NOT baked into the rental
  // charge. A WEEKLY add-on has no monthly-sweep equivalent, so it stays a
  // one-off line inside the rental exactly as before.
  const vnRecurs = addVN && vnSub === 'monthly';
  const vnOnRental = addVN && !vnRecurs ? vnPrice : 0;
  const totalPrice = discountedRental + vnOnRental;
  // #25 — capture payment at rental time. "On account" = wallet debt (the old
  // behaviour); a "paid now" method settles some/all of it immediately.
  const payMethod = document.getElementById('rPay')?.value || 'account';
  const paidNow = payMethod !== 'account';
  let payAmt = paidNow ? (parseFloat(document.getElementById('rPayAmount')?.value) || 0) : 0;
  if (payAmt < 0) payAmt = 0;
  if (payAmt > totalPrice) payAmt = totalPrice; // never overpay the rental here
  if (!(await kcConfirm({
    title: isReservation ? 'Confirm reservation' : 'Confirm rental charge',
    body: `<strong>${escName(customer.firstName)} ${escName(customer.lastName)}</strong><br>
      ${escHtml(phone.number)} (${escHtml(phone.country)}) · ${fmtDate(from)} → ${fmtDate(to)} · ${chargeableDays} chargeable days${addVN ? '<br>+ virtual number' : ''}${discountValue > 0 ? '<br>discount applied' : ''}`,
    amount: totalPrice,
    okLabel: isReservation ? 'Reserve & charge' : 'Charge rental',
  }))) return;
  const rental = {
    id:           uid(),
    customerId,
    customerName: `${customer.firstName} ${customer.lastName}`,
    customerPhone: customer.phone || '',
    phoneId,
    phoneNumber:  phone.number,
    country:      phone.country,
    ukPlan:       phone.ukPlan || 'standard',
    fromDate:     from,
    toDate:       to,
    chargeableDays,
    totalDays,
    price:        totalPrice,
    basePrice:    price,
    discountValue,
    discountType,
    rentalPrice:  price,
    vn:           addVN,
    vnPrefix,
    vnSub,
    vnPrice,
    notes,
    amountPaid:   payAmt, // #25
    // #26 — optional refundable deposit, tracked as held (not a wallet charge).
    depositHeld:  document.getElementById('rDeposit')?.checked
                    ? (parseFloat(document.getElementById('rDepositAmount')?.value) || 0) : 0,
    // #84 — lightweight signed acknowledgment of the loss/late terms at pickup.
    termsAck:     !!document.getElementById('rTerms')?.checked,
    termsAckName: document.getElementById('rTerms')?.checked
                    ? (document.getElementById('rTermsName')?.value.trim() || '') : '',
    termsAckAt:   document.getElementById('rTerms')?.checked ? new Date().toISOString() : '',
    status:       isReservation ? 'booked' : 'active',
    createdAt:    new Date().toISOString(),
    equipmentGiven,
  };

  rentals.push(rental);
  // Await the persist and only continue if it actually saved — otherwise we'd
  // create a VN for a rental that doesn't exist and toast success on a lost save.
  const saveRes = await saveRentals(rentals);
  if (!saveRes || saveRes.success === false) {
    const idx = rentals.indexOf(rental);
    if (idx >= 0) rentals.splice(idx, 1); // undo the optimistic push
    renderRentalsTab();
    return; // reportSave already surfaced the error
  }

  // #73 — persist the phone status ONLY when it actually changed. A future-
  // dated reservation leaves the phone free, so it needs no phones write.
  if (!isReservation) {
    phone.status        = 'rented';
    phone.currentRental = rental.id;
    savePhones(phones);
  }

  // #73 — no more c.history / c.totalPaid / c.services write for a rental. The
  // append-only ledger and the rental record are the single source of truth
  // (the card's balance is ledger-derived, its timeline is built from the
  // rentals array, and c.services rental entries were filtered out anyway), so
  // that third network round-trip and its parallel money mirror are dropped.

  // #29 — provision the add-on VN as a real virtual_numbers record. A monthly
  // one recurs on the VN path (billing enabled, first bill on the rental start
  // date); a weekly one is tracked but its single period was charged on the
  // rental above. Either way the number now exists as a proper VN record.
  if (addVN) {
    await window.api.addVirtualNumber({
      number: `${vnPrefix} — pending`,
      customerId,
      platform: 'Other',
      notes: `Auto-created with rental ${phone.number} · ${vnSub} · from ${fmtDate(from)}`,
      ...(vnRecurs ? {
        billingEnabled: true,
        monthlyPrice: vnPrice,
        nextBillingDate: from,
        bundleLabel: `Rental add-on +${vnPrefix}`,
      } : {}),
    }).catch(() => null);
  }

  // #25/#33/#38 — the counter payment is recorded through ONE channel: the
  // rental's amountPaid, which trueUpRentalLedger posts as PAY-RENTAL-<uuid>
  // (a 'payment' on the wallet ledger). We deliberately do NOT also post a
  // separate wallet payment here — that would double-count the same money.
  closeDynamicModal();
  // Owner-defined auto extras for rentals (posted once, keyed on the rental).
  const extraMsg = await applyExtraCharges('rental', rental.id, customerId, false);
  const payLine = paidNow && payAmt > 0
    ? (payAmt >= totalPrice ? ' Paid in full.' : ` ${fmtGbp(payAmt)} paid, ${fmtGbp((totalPrice - payAmt))} on account.`)
    : '';
  toast(isReservation
    ? `Reserved for ${customer.firstName} — pickup ${fmtDate(from)}. Press ▶ Start at handover.`
    : `Rental saved! ${fmtGbp(totalPrice)} charged to ${customer.firstName}.${payLine}${extraMsg}`, 'success');
  renderRentalsTab();
}

// Post any auto "extra charges" for a freshly-created rental/SIM (their money
// doesn't go through a single server charge, so the client triggers it).
// Returns a short message fragment for the success toast.
async function applyExtraCharges(appliesTo, refBase, customerId, paidNow) {
  const res = await kcFetch('/api/custom-charges', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'apply', appliesTo, refBase, customerId, paidNow }),
  }).then(r => r.json()).catch(() => null);
  if (res?.success && res.extras?.length) {
    return ` Incl. ${res.extras.map(e => `${e.label} ${fmtGbp(e.amount)}`).join(', ')}.`;
  }
  return '';
}

// Reservation pickup: the customer is here, the phone goes out.
function startReservation(rentalId) {
  const r = rentals.find(x => x.id === rentalId);
  if (!r || r.status !== 'booked') return;
  const phone = phones.find(p => p.id === r.phoneId);
  if (phone && phone.status === 'rented') {
    toast(`${phone.number} is still out on another rental — return it first.`, 'error');
    return;
  }
  r.status = 'active';
  saveRentals(rentals);
  if (phone) {
    phone.status = 'rented';
    phone.currentRental = r.id;
    savePhones(phones);
  }
  toast(`Rental started — ${r.customerName} has ${r.phoneNumber} until ${fmtDate(r.toDate)}.`, 'success');
  renderRentalsTab();
}

// ══ MANAGE PHONES MODAL ══
function openManagePhonesModal() {
  showDynamicModal(`
    <div class="modal-title">⚙️ Manage phones</div>
    <div class="section-divider">Add New Phone</div>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Phone Number *</label>
        <input class="form-input" id="pNumber" type="tel" inputmode="tel" dir="ltr" placeholder="+1 718 555 0101">
      </div>
      <div class="form-group">
        <label class="form-label">Country *</label>
        <select class="form-input" id="pCountry" onchange="document.getElementById('pUKPlanGroup').style.display=this.value==='UK'?'block':'none'; document.getElementById('pPoolGroup').style.display=this.value==='USA'?'contents':'none';">
          <option value="USA">🇺🇸 USA</option>
          <option value="UK">🇬🇧 UK</option>
          <option value="Israel">🇮🇱 Israel</option>
          <option value="EU">🇪🇺 EU</option>
          <option value="Canada">🇨🇦 Canada</option>
        </select>
      </div>
      <div class="form-group" id="pUKPlanGroup" style="display:none;">
        <label class="form-label">UK Plan Type</label>
        <select class="form-input" id="pUKPlan">
          <option value="standard">Standard (UK minutes) – £2/day</option>
          <option value="unlimited">Unlimited International – £2/day</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Company</label>
        <input class="form-input" id="pCompany" type="text" placeholder="USMobile, Lebara...">
      </div>
      <div class="form-group">
        <label class="form-label">Phone Model <span style="color:var(--muted);font-weight:400;">(optional)</span></label>
        <input class="form-input" id="pModel" type="text" placeholder="e.g. Nokia 105, FIG Core">
      </div>
      <div id="pPoolGroup" style="display:contents;">
      <div class="form-group">
        <label class="form-label">Pool Name (USA)</label>
        <input class="form-input" id="pPool" type="text" placeholder="Pool 24">
      </div>
      <div class="form-group">
        <label class="form-label">Pool Expiry Date</label>
        <input class="form-input" id="pPoolExpiry" type="date">
      </div>
      </div>
      <div class="form-group">
        <label class="form-label">SIM Card ID</label>
        <input class="form-input" id="pSIMID" type="text" inputmode="numeric" dir="ltr" placeholder="ICCID...">
      </div>
      <div class="form-group">
        <label class="form-label">IMEI <span style="color:var(--muted);font-weight:400;">(scan the barcode)</span></label>
        <input class="form-input" id="pIMEI" type="text" inputmode="numeric" placeholder="Scan or type 15 digits">
      </div>
      <div class="form-group">
        <label class="form-label">Registered Email</label>
        <input class="form-input" id="pEmail" type="email" placeholder="kosherconnect+sim@gmail.com">
      </div>
    </div>
    <div style="margin-top:14px;">
      <button class="btn btn-primary" onclick="saveNewPhone()">➕ Add phone</button>
    </div>
    <div class="section-divider" style="margin-top:20px;">Current Inventory (${phones.length})</div>
    <div style="max-height:200px;overflow-y:auto;">
      ${phones.length === 0 ? '<p style="color:var(--muted);font-size:var(--fs-body);">No phones yet.</p>' :
        phones.map(p => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:var(--fs-body);">
            <span style="font-weight:600;">${escHtml(fmtPhone(p.number))}</span>
            <span style="color:var(--muted);">${escHtml(p.country)} · ${escHtml(p.company||'—')}</span>
            <span class="badge ${p.status==='rented'?'badge-rental':'badge-active'}">${p.status}</span>
          </div>`).join('')}
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeDynamicModal()">Close</button>
    </div>
  `);
}

function saveNewPhone() {
  const number = document.getElementById('pNumber').value.trim();
  if (!number) { toast('Phone number is required.', 'error'); return; }
  const pCountryVal = document.getElementById('pCountry').value;
  const phone = {
    id:         uid(),
    number,
    country:    pCountryVal,
    ukPlan:     pCountryVal === 'UK' ? document.getElementById('pUKPlan').value : undefined,
    company:    document.getElementById('pCompany').value.trim(),
    model:      document.getElementById('pModel').value.trim(),
    pool:       document.getElementById('pPool').value.trim(),
    poolExpiry: document.getElementById('pPoolExpiry').value || null,
    simId:      document.getElementById('pSIMID').value.trim(),
    imei:       document.getElementById('pIMEI').value.trim(),
    email:      document.getElementById('pEmail').value.trim(),
    status:     'available',
    currentRental: null,
  };
  phones.push(phone);
  savePhones(phones);
  toast(`Phone ${number} added! ✅`, 'success');
  closeDynamicModal();
  renderRentalsTab();
}

// ── Needs-review queue ───────────────────────────────────────────────────
// Where the rental-pool import puts everything it could not read confidently
// (docs/RENTAL-POOL-MIGRATION.md). The importer never rejects a row, so the
// cleanup happens HERE — in the app, next to the customer records that can
// actually resolve it — instead of in a spreadsheet before the migration.
//
// Mirror of REVIEW_LABEL in lib/rentalPoolImport.mjs. main.js is a plain
// browser script and cannot import it; test/rentalPoolImport.test.mjs asserts
// the two stay identical. Change both together.
const REVIEW_LABELS = {
  'holder-uncertain': 'Who has this was recorded with a question mark',
  'holder-missing': 'Marked rented but nobody is named',
  'due-date-missing': 'Marked rented with no return date',
  'due-date-past': 'Return date has already passed',
  'status-unknown': 'Status was not a word we recognise',
  'number-ambiguous': 'Phone number has no country code',
  'iccid-unclear': 'SIM number column held something else',
  'imei-unclear': 'IMEI column held something else',
  'account-unclear': 'Provider account is not an email address',
  'note-unparsed': 'A note we could not file anywhere',
  'carrier-unknown': 'Carrier is not one we know',
};

function reviewQueue() {
  return phones.filter(p => p.needsReview && (p.reviewReasons || []).length);
}

let reviewFilter = 'all';

function openReviewQueueModal(filter = 'all') {
  reviewFilter = filter;
  showDynamicModal(`
    <div class="modal-title">🔍 Lines needing a look</div>
    <div style="font-size:var(--fs-small);color:var(--muted);margin-bottom:12px;">
      Imported from the rental sheet. Nothing here is wrong — it's what the sheet
      couldn't tell us for certain. Work through it whenever; the pool is usable
      meanwhile.
    </div>
    <div id="reviewBody"></div>
  `);
  renderReviewQueue();
}

function renderReviewQueue() {
  const el = document.getElementById('reviewBody');
  if (!el) return;
  const all = reviewQueue();
  if (!all.length) {
    el.innerHTML = `<div style="padding:28px;text-align:center;color:var(--muted);">
      Nothing left to review. 🎉</div>`;
    return;
  }
  // Count by reason across the whole queue, not the filtered view — the chips
  // have to keep showing what's left behind the one you're looking at.
  const counts = {};
  for (const p of all) for (const r of p.reviewReasons) counts[r] = (counts[r] || 0) + 1;
  const shown = reviewFilter === 'all' ? all : all.filter(p => p.reviewReasons.includes(reviewFilter));

  const chip = (val, label, n) => `<button class="btn ${reviewFilter === val ? 'btn-primary' : 'btn-outline'}"
    style="font-size:var(--fs-small);padding:5px 12px;" onclick="reviewFilter='${val}';renderReviewQueue()">${escHtml(label)} (${n})</button>`;

  el.innerHTML = `
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;">
      ${chip('all', 'Everything', all.length)}
      ${Object.entries(counts).sort((a, b) => b[1] - a[1])
        .map(([r, n]) => chip(r, REVIEW_LABELS[r] || r, n)).join('')}
    </div>
    <div style="max-height:52vh;overflow:auto;display:flex;flex-direction:column;gap:8px;">
      ${shown.map(reviewRowHtml).join('')}
    </div>`;
}

function reviewRowHtml(p) {
  const who = p.heldByNote || p.lastHeldByNote || '';
  const raw = (p.importSource && p.importSource.raw || []).filter(Boolean).join(' · ');
  return `
    <div style="border:1px solid var(--border);border-radius:10px;padding:12px 14px;">
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:baseline;">
        <div>
          <strong style="font-size:var(--fs-ui);">${escHtml(fmtPhone(p.number || '—'))}</strong>
          <span style="color:var(--muted);font-size:var(--fs-body);">
            ${escHtml(p.company || '')}${p.subBrand ? ' · ' + escHtml(p.subBrand) : ''}
            ${p.country ? ' · ' + escHtml(p.country) : ''}
            ${p.assetTag ? ' · ' + escHtml(p.assetTag) : ''}
          </span>
        </div>
        <span class="badge badge-${p.status === 'rented' ? 'rental' : 'sim'}">${escHtml(p.status)}</span>
      </div>
      ${who ? `<div style="font-size:var(--fs-body);margin-top:5px;">
        ${p.heldByNote ? 'With' : 'Last with'}: <strong>${escHtml(who)}</strong>
        ${p.holderUncertain ? '<span style="color:var(--gold);"> (not certain)</span>' : ''}
        ${p.dueDate ? ` · due <strong>${escHtml(p.dueDate)}</strong>` : ''}
      </div>` : ''}
      <div style="margin-top:7px;display:flex;gap:5px;flex-wrap:wrap;">
        ${p.reviewReasons.map(r => `<span class="badge badge-warning" style="font-size:var(--fs-micro);">${escHtml(REVIEW_LABELS[r] || r)}</span>`).join('')}
      </div>
      ${p.notes ? `<div style="font-size:var(--fs-small);color:var(--muted);margin-top:6px;">${escHtml(p.notes)}</div>` : ''}
      <details style="margin-top:6px;"><summary style="font-size:var(--fs-small);color:var(--muted);cursor:pointer;">Original sheet row ${p.importSource ? p.importSource.row : ''}</summary>
        <div style="font-size:var(--fs-small);color:var(--muted);margin-top:4px;word-break:break-word;">${escHtml(raw)}</div>
      </details>
      <div style="margin-top:9px;display:flex;gap:6px;flex-wrap:wrap;">
        ${p.status === 'rented' || p.status === 'permanent'
          ? `<button class="btn btn-outline" style="font-size:var(--fs-small);padding:4px 11px;" onclick="reviewMarkBack('${escHtml(p.id)}')">📥 It's back</button>` : ''}
        <button class="btn btn-outline" style="font-size:var(--fs-small);padding:4px 11px;" onclick="reviewOpenPhone('${escHtml(p.id)}')">✏️ Edit line</button>
        <button class="btn btn-outline" style="font-size:var(--fs-small);padding:4px 11px;" onclick="reviewDismiss('${escHtml(p.id)}')">✓ Looks right</button>
      </div>
    </div>`;
}

// "It's back" is the one-tap answer to the biggest group in the queue: a line
// the sheet still calls rented, whose return date passed months ago. Frees the
// phone, keeps the holder as history.
async function reviewMarkBack(phoneId) {
  const p = phones.find(x => x.id === phoneId);
  if (!p) return;
  p.lastHeldByNote = p.heldByNote || p.lastHeldByNote || '';
  p.heldByNote = '';
  p.status = 'available';
  p.dueDate = null;
  clearReviewFlags(p, ['due-date-past', 'due-date-missing', 'holder-missing', 'holder-uncertain']);
  await savePhones(phones);
  renderReviewQueue();
  renderRentalsTab();
  toast(`${fmtPhone(p.number)} is back in stock.`, 'success');
}

// Dismissing says "the sheet was right, I've read it" — it clears the flags
// without touching the data. Deliberately not a bulk action: the whole point
// of the queue is that a person looked at each one.
async function reviewDismiss(phoneId) {
  const p = phones.find(x => x.id === phoneId);
  if (!p) return;
  p.needsReview = false;
  p.reviewReasons = [];
  await savePhones(phones);
  renderReviewQueue();
  renderRentalsTab();
}

function reviewOpenPhone(phoneId) {
  closeDynamicModal();
  openEditPhoneModal(phoneId);
}

function clearReviewFlags(p, codes) {
  p.reviewReasons = (p.reviewReasons || []).filter(r => !codes.includes(r));
  p.needsReview = p.reviewReasons.length > 0;
}

function openEditPhoneModal(phoneId) {
  const p = phones.find(x => x.id === phoneId);
  if (!p) return;
  const activeRental = rentals.find(r => r.phoneId === phoneId && (r.status === 'active' || r.status === 'overdue'));
  const renterInfo = activeRental
    ? `<div style="margin-top:6px;font-size:var(--fs-body);color:var(--muted);">Rented to: <strong style="color:var(--text);">${escName(activeRental.customerName)}</strong> &nbsp;<button class="btn btn-outline" style="padding:3px 10px;font-size:var(--fs-small);" onclick="closeDynamicModal();openManageRentalModal('${activeRental.id}')">Manage rental</button></div>`
    : '';
  const statusColor = p.status === 'rented' ? 'var(--accent)' : p.maintenance ? 'var(--gold)' : 'var(--success)';
  const statusLabel = p.status === 'rented' ? '🔴 Rented' : p.maintenance ? '🔧 Maintenance' : '🟢 Available';
  showDynamicModal(`
    <div class="modal-title">✏️ Edit Phone — ${escHtml(fmtPhone(p.number))}</div>
    <div class="form-grid">
      ${p.country === 'USA' ? `
      <div class="form-group">
        <label class="form-label">Pool Name</label>
        <input class="form-input" id="epPool" type="text" value="${escHtml(p.pool||'')}">
      </div>
      <div class="form-group">
        <label class="form-label">Pool Expiry</label>
        <input class="form-input" id="epExpiry" type="date" value="${escHtml(p.poolExpiry||'')}">
      </div>` : ''}
      <div class="form-group">
        <label class="form-label">Company</label>
        <input class="form-input" id="epCompany" type="text" value="${escHtml(p.company||'')}">
      </div>
      <div class="form-group">
        <label class="form-label">Phone Model <span style="color:var(--muted);font-weight:400;">(optional)</span></label>
        <input class="form-input" id="epModel" type="text" value="${escHtml(p.model||'')}" placeholder="e.g. Nokia 105">
      </div>
      <div class="form-group">
        <label class="form-label">IMEI <span style="color:var(--muted);font-weight:400;">(scan)</span></label>
        <input class="form-input" id="epIMEI" type="text" inputmode="numeric" value="${escHtml(p.imei||'')}" placeholder="Scan or type">
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <div style="font-size:var(--fs-body);font-weight:600;color:${statusColor};padding:8px 0;">${statusLabel}</div>
        ${renterInfo}
      </div>
      <div class="form-group form-full">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:var(--fs-body);">
          <input type="checkbox" id="epMaint" ${p.maintenance ? 'checked' : ''} style="accent-color:var(--gold);">
          <span>🔧 Under maintenance — hidden from New Rental until cleared</span>
        </label>
        <input class="form-input" id="epMaintNote" type="text" value="${escHtml(p.maintenanceNote || '')}"
          placeholder="Why? e.g. cracked screen, battery on order (optional)" style="margin-top:6px;">
      </div>
      ${p.country === 'UK' ? `
      <div class="form-group">
        <label class="form-label">UK Plan Type</label>
        <select class="form-input" id="epUKPlan">
          <option value="standard" ${(p.ukPlan||'standard')==='standard'?'selected':''}>Standard (UK minutes) – £2/day</option>
          <option value="unlimited" ${p.ukPlan==='unlimited'?'selected':''}>Unlimited International – £2/day</option>
        </select>
      </div>` : ''}
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeDynamicModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveEditPhone('${phoneId}')">Save</button>
    </div>
  `);
}

function saveEditPhone(phoneId) {
  const p = phones.find(x => x.id === phoneId);
  if (!p) return;
  if (p.country === 'USA') {
    p.pool       = document.getElementById('epPool')?.value.trim() || '';
    p.poolExpiry = document.getElementById('epExpiry')?.value || null;
  }
  p.company = document.getElementById('epCompany').value.trim();
  const epModel = document.getElementById('epModel');
  if (epModel) p.model = epModel.value.trim();
  const epIMEI = document.getElementById('epIMEI');
  if (epIMEI) p.imei = epIMEI.value.trim();
  const epUKPlan = document.getElementById('epUKPlan');
  if (epUKPlan) p.ukPlan = epUKPlan.value;
  const epMaint = document.getElementById('epMaint');
  if (epMaint) {
    p.maintenance = epMaint.checked;
    p.maintenanceNote = epMaint.checked ? (document.getElementById('epMaintNote')?.value.trim() || '') : '';
  }
  savePhones(phones);
  toast('Phone updated!', 'success');
  closeDynamicModal();
  renderRentalsTab();
}

// ══ MANAGE RENTAL MODAL ══
function openManageRentalModal(rentalId) {
  const r = rentals.find(x => x.id === rentalId);
  if (!r) return;
  const paid = r.amountPaid || 0;
  const debt = Math.max(0, r.price - paid);
  const mgLateFee = calcLateFeeDays(r);

  // Build per-item status rows — three-position sliding toggle (A2).
  // Charger is one UI row driving the stored plug+cable pair (see eqKeysFor).
  const EQ_LABELS   = { phone: '📱 Phone handset', sim: '💳 SIM card', charger: '🔌 Charger' };
  const EQ_DEFAULTS = { phone: false, sim: true, charger: false };
  const eqRows = MG_UI_ITEMS.map(item => {
    const given   = item === 'charger' ? chargerGiven(r) : (r.equipmentGiven?.[item] ?? EQ_DEFAULTS[item]);
    const status  = item === 'charger' ? uiItemStatus(r, item) : getItemStatus(r, item);
    const lostAmt = item === 'charger' ? uiItemLostAmt(r, item) : (r.lostCharges?.[item] ?? '');
    const pending = status === 'undecided';
    return `
      <div id="mgEqRow_${item}" style="display:${given ? 'flex' : 'none'};align-items:center;gap:8px;flex-wrap:wrap;padding:3px 0;">
        <input type="hidden" id="mgItemStatus_${item}" value="${status}">
        <span style="font-size:var(--fs-body);min-width:130px;">${EQ_LABELS[item]}</span>
        <div class="eq-slide-track" id="mgSlide_${item}" data-status="${status}">
          <div class="eq-slide-zone eq-slide-zone-left"  onclick="mgSetItemStatus('${item}','returned')"></div>
          <div class="eq-slide-zone eq-slide-zone-right" onclick="mgSetItemStatus('${item}','lost')"></div>
          <span class="eq-slide-lbl eq-slide-lbl-n eq-slide-lbl-n-ret">Returned</span>
          <span class="eq-slide-lbl eq-slide-lbl-n eq-slide-lbl-n-lost">Lost</span>
          <span class="eq-slide-lbl eq-slide-lbl-a eq-slide-lbl-a-ret">✓ Returned</span>
          <span class="eq-slide-lbl eq-slide-lbl-a eq-slide-lbl-a-lost">✗ Lost</span>
          <div class="eq-slide-knob"></div>
        </div>
        <span id="mgPendingBadge_${item}" class="eq-item-pending" style="display:${pending?'inline-block':'none'};">Pending</span>
        <button type="button" id="mgClearItem_${item}" class="eq-item-clear" onclick="mgClearItemStatus('${item}')"
          style="display:${pending?'none':'inline-flex'};" title="Reset to pending">×</button>
        <input type="number" id="mgLostAmt_${item}" class="form-input" min="0" step="0.01" placeholder="£ amount"
          style="display:${status==='lost'?'inline-block':'none'};width:110px;padding:4px 10px;font-size:var(--fs-small);border-radius:20px;"
          value="${lostAmt}" oninput="mgUpdateCalc()">
      </div>`;
  }).join('');

  showDynamicModal(`
    ${/* The device gets its own line rather than an em dash, which dangled at
          the end of the title whenever the chip wrapped — which at 390px is
          every time. A deliberate second line reads the same at both widths. */''}
    <div class="modal-title">⚙ Manage Rental<span class="kc-title-device">${rentalDeviceChip(r)}</span></div>
    <div style="color:var(--muted);font-size:var(--fs-body);margin-bottom:16px;">
      Customer: <strong style="color:var(--text);">${escName(r.customerName)}</strong>
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">From Date</label>
        <input class="form-input" type="date" id="mgFrom" value="${r.fromDate}" onchange="mgUpdateCalc(); mgCheckConflict('${escJs(r.id)}')">
        <div class="hebrew-date-label" id="mgFromHeb"></div>
      </div>
      <div class="form-group">
        <label class="form-label">To Date (inclusive)</label>
        <input class="form-input" type="date" id="mgTo" value="${r.toDate}" onchange="mgUpdateCalc(); mgCheckConflict('${escJs(r.id)}')">
        <div class="hebrew-date-label" id="mgToHeb"></div>
      </div>
      <div class="form-group form-full" id="mgConflictWarn" role="alert" style="display:none;background:rgba(220,38,38,0.08);border:1px solid rgba(220,38,38,0.35);border-radius:8px;padding:10px 14px;font-size:var(--fs-body);color:var(--danger-ink);"></div>
      <div class="form-group form-full" id="mgCalcBox">
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px 14px;font-size:var(--fs-body);">
          <div id="mgCalcText"></div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Total Price (£)</label>
        <input class="form-input" type="number" id="mgPrice" value="${r.price}" min="0" step="0.5" oninput="mgUpdateDebt()">
      </div>
      <div class="form-group form-full">
        <label class="form-label">Return Status</label>
        <div style="display:flex;align-items:center;gap:14px;margin-top:4px;">
          <div class="toggle-wrap" onclick="toggleReturned()" id="mgReturnedToggle"
            style="width:52px;height:28px;border-radius:14px;cursor:pointer;transition:background 0.2s;position:relative;background:${r.status==='returned'?'var(--success)':'var(--border)'};">
            <div id="mgToggleKnob" style="position:absolute;top:3px;left:${r.status==='returned'?'25px':'3px'};width:22px;height:22px;border-radius:50%;background:#fff;transition:left 0.2s;"></div>
          </div>
          <span id="mgReturnedLabel" style="font-size:var(--fs-ui);font-weight:600;color:${r.status==='returned'?'var(--success)':'var(--muted)'};">
            ${r.status==='returned' ? 'Returned ✅' : 'Not returned yet'}
          </span>
        </div>
        <input type="hidden" id="mgReturned" value="${r.status==='returned'?'1':'0'}">
      </div>
    </div>

    <div class="section-divider" style="margin-top:12px;">Payment</div>
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:16px;">
      <div id="mgChargeBreakdown" style="margin-bottom:10px;"></div>
      <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px;">
        <span style="font-size:var(--fs-body);color:var(--muted);white-space:nowrap;">Amount paid: £</span>
        <input class="form-input" type="number" id="mgPaid" value="${paid}" min="0" step="0.5"
          style="width:100px;padding:7px 10px;" oninput="mgUpdateDebt()">
      </div>
      <div style="margin-bottom:8px;">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:var(--fs-body);">
          <input type="checkbox" id="mgFullyPaid" style="accent-color:var(--accent);"
            onchange="if(this.checked){document.getElementById('mgPaid').value=mgComputeTotal().toFixed(2);mgUpdateDebt();}else{document.getElementById('mgPaid').value='';mgUpdateDebt();}">
          Mark as fully paid
        </label>
      </div>
      <div id="mgDebtDisplay" style="font-size:var(--fs-body);font-weight:600;color:${debt>0?'var(--danger-ink)':'var(--success)'};">
        ${debt > 0 ? 'Remaining debt: £'+debt : '✓ Fully paid'}
      </div>
    </div>

    <div class="section-divider" style="margin-top:12px;">Equipment</div>
    <div style="margin-bottom:8px;">
      <div style="font-size:var(--fs-small);color:var(--muted);margin-bottom:6px;">Given to customer — tap to toggle</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
        <div class="eq-btn" tabindex="0" role="button" id="mgGivenPhone" data-given="${(r.equipmentGiven?.phone??false)?'1':'0'}" onclick="mgToggleGiven('phone')">📱 Phone</div>
        <div class="eq-btn" tabindex="0" role="button" id="mgGivenSim"   data-given="${(r.equipmentGiven?.sim??true)?'1':'0'}"   onclick="mgToggleGiven('sim')">💳 SIM</div>
        <div class="eq-btn" tabindex="0" role="button" id="mgGivenCharger" data-given="${chargerGiven(r)?'1':'0'}" onclick="mgToggleGiven('charger')">🔌 Charger</div>
      </div>
      <div style="font-size:var(--fs-small);color:var(--muted);margin-bottom:6px;">Item status — tap Returned or Lost for each item given</div>
      <div style="display:flex;flex-direction:column;gap:4px;">${eqRows}</div>
    </div>

    <div class="section-divider" style="margin-top:12px;">Discount</div>
    <div style="margin-bottom:16px;">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:var(--fs-body);">
        <input type="checkbox" id="mgAddDiscount" style="accent-color:var(--accent);" ${(r.discountValue||0)>0?'checked':''} onchange="document.getElementById('mgDiscountBox').style.display=this.checked?'flex':'none'; mgUpdateCalc()">
        🏷️ Apply discount
      </label>
      <div id="mgDiscountBox" style="display:${(r.discountValue||0)>0?'flex':'none'};gap:8px;align-items:center;margin-top:8px;">
        <div class="cs-wrap" id="csDiscountType">
          <div class="cs-btn" onclick="csToggle('csDiscountType')"><span>${(r.discountType||'percent')==='fixed'?'£ off':'% off'}</span></div>
          <div class="cs-list">
            <div class="cs-item ${(r.discountType||'percent')==='percent'?'cs-active':''}" data-value="percent" onclick="csPick('csDiscountType','percent','% off',v=>{document.getElementById('mgDiscountType').value=v;mgUpdateCalc();})">% off</div>
            <div class="cs-item ${r.discountType==='fixed'?'cs-active':''}" data-value="fixed" onclick="csPick('csDiscountType','fixed','£ off',v=>{document.getElementById('mgDiscountType').value=v;mgUpdateCalc();})">£ off</div>
          </div>
        </div>
        <input type="hidden" id="mgDiscountType" value="${r.discountType||'percent'}">
        <input type="number" id="mgDiscountValue" value="${r.discountValue||0}" min="0" step="0.5"
          style="width:80px;padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-secondary);color:var(--text);font-size:var(--fs-body);" oninput="mgUpdateCalc()">
      </div>
    </div>

    <div class="form-group" style="margin-bottom:16px;">
      <label class="form-label">Notes</label>
      <input class="form-input" type="text" id="mgNotes" value="${escHtml(r.notes||'')}">
    </div>

    <input type="hidden" id="mgCountry" value="${r.country || 'USA'}">
    <input type="hidden" id="mgUKPlan" value="${r.ukPlan || 'standard'}">
    <input type="hidden" id="mgBasePrice" value="${r.basePrice || r.price}">
    <input type="hidden" id="mgVnPrice" value="${(r.vn && r.vnSub !== 'monthly' ? r.vnPrice : 0) || 0}">
    <input type="hidden" id="mgWasReturned" value="${r.status === 'returned' ? '1' : '0'}">
    <input type="hidden" id="mgFrozenLateFee" value="${r.lateFee || 0}">
    ${/* Deposit: money the shop is holding that belongs to somebody else. The
         gate blocks the close until this is answered, so the answer needs a
         control — the field only appears when there is actually one held. */''}
    ${(Number(r.depositHeld) || 0) > 0 ? `
    <div class="form-group" style="margin-bottom:16px;">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:var(--fs-body);">
        <input type="checkbox" id="mgDepositSettled" style="accent-color:var(--accent);"
          ${r.depositSettled ? 'checked' : ''} onchange="mgUpdateCalc()">
        🔒 The ${escHtml(fmtGbp(r.depositHeld))} deposit has been refunded or put against the bill
      </label>
    </div>` : ''}
    ${/* The Charge Gate. Empty and hidden until the Returned toggle goes on —
         a rental still running has nothing to answer for yet. */''}
    <div id="mgGateBox" class="kc-gate" style="display:none;"></div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeDynamicModal()">Cancel</button>
      <button class="btn btn-primary" id="mgSaveBtn" onclick="saveManageRental('${rentalId}')">💾 Save changes</button>
    </div>
  `);
  // Sign-offs are per Manage session: reopening asks again, because a sign-off
  // is a statement about the numbers currently in front of you.
  mgGateVerified = new Set();
  mgGateRentalId = rentalId;

  showHebrewDate('mgFrom','mgFromHeb');
  showHebrewDate('mgTo','mgToHeb');
  mgUpdateCalc();
}

// Availability pre-warn in Manage Rental: extending/shifting the dates can
// collide with ANOTHER rental (or future reservation) of the same handset.
// Warn inline, don't block — the server-side overlap guard stays authoritative.
function mgCheckConflict(rentalId) {
  const el = document.getElementById('mgConflictWarn');
  const r = rentals.find(x => x.id === rentalId);
  if (!el || !r) return;
  const from = document.getElementById('mgFrom')?.value;
  const to = document.getElementById('mgTo')?.value;
  let clash = null;
  if (from && to && to >= from && r.phoneId) {
    clash = phoneConflicts(rentals, r.phoneId, from, to, localISO(), r.id)[0];
  }
  if (clash) {
    el.style.display = 'block';
    el.textContent = `⚠ This phone is also booked ${fmtDate(clash.fromDate)} → ${fmtDate(clash.toDate)}`
      + (clash.customerName ? ` for ${clash.customerName}` : '')
      + '. Saving these dates would double-book it.';
  } else {
    el.style.display = 'none';
    el.textContent = '';
  }
}

function mgUpdateCalc() {
  const from = document.getElementById('mgFrom')?.value;
  const to   = document.getElementById('mgTo')?.value;
  showHebrewDate('mgFrom','mgFromHeb');
  showHebrewDate('mgTo','mgToHeb');
  if (!from || !to || to < from) return;
  const country = document.getElementById('mgCountry')?.value || 'USA';
  const ukPlan  = document.getElementById('mgUKPlan')?.value  || 'standard';
  const simGiven = document.getElementById('mgGivenSim')?.dataset.given !== '0';
  const { chargeableDays, totalDays, price } = calcRentalPrice(from, to, country, ukPlan, simGiven);
  const excl = totalDays - chargeableDays;

  let discountedBase = price;
  let discountLine = '';
  const addDiscount = document.getElementById('mgAddDiscount')?.checked;
  if (addDiscount) {
    const dtype = document.getElementById('mgDiscountType')?.value || 'percent';
    const dval  = parseFloat(document.getElementById('mgDiscountValue')?.value) || 0;
    discountedBase = dtype === 'percent' ? Math.max(0, price * (1 - dval / 100)) : Math.max(0, price - dval);
    if (dval > 0) discountLine = ` &nbsp;|&nbsp; -${dtype==='percent'?dval+'%':'£'+dval} → <strong style="color:var(--accent);">${fmtGbp(discountedBase)}</strong>`;
  }
  // Fold the add-on virtual number back in — it's part of r.price (and the
  // rental's ledger charge). The base-only recompute must not drop it, or
  // saving Manage silently refunds the VN.
  const vnPrice = Number(document.getElementById('mgVnPrice')?.value) || 0;
  const finalPrice = discountedBase + vnPrice;

  const lateFee  = mgComputeLateFee();
  document.getElementById('mgCalcText').innerHTML =
    `Total: ${totalDays}d &nbsp;|&nbsp; Shabbos/YT excluded: <span style="color:var(--gold);">${excl}</span> &nbsp;|&nbsp; Chargeable: ${chargeableDays}d &nbsp;|&nbsp; <strong style="color:var(--success);">${fmtGbp(price)}</strong>${discountLine}${vnPrice > 0 ? ` &nbsp;+&nbsp; VN ${fmtGbp(vnPrice)}` : ''}` +
    // Manage is where a rental gets argued about, so it names the free days
    // too — the count alone is what a customer disputes and staff cannot check.
    freeDayStamps(from, to);
  document.getElementById('mgPrice').value    = finalPrice.toFixed(2);
  document.getElementById('mgBasePrice').value = price;
  // Every edit that can move the gate — dates, price, paid, item states, the
  // deposit — funnels through here, so this is the one place it re-runs.
  if (mgGateRentalId) mgRenderGate(mgGateRentalId);

  // Build itemised charge breakdown (A3)
  const lostInfo   = mgComputeLostCharges();
  const grandTotal = finalPrice + lateFee + lostInfo.total;
  const row = (label, amount, colour) =>
    `<div style="display:flex;justify-content:space-between;font-size:var(--fs-body);margin-bottom:3px;">
      <span style="color:${colour||'var(--muted)'};">${label}</span>
      <span style="color:${colour||'var(--text)'};">${fmtGbp(amount)}</span>
    </div>`;
  let html = row('Rental', discountedBase);
  if (vnPrice > 0)     html += row('Virtual number', vnPrice, 'var(--accent)');
  if (lateFee > 0)     html += row('Late fee', lateFee, 'var(--gold)');
  lostInfo.items.forEach(({ label, amount }) => {
    html += row(label + ' — lost', amount, 'var(--danger-ink)');
  });
  html += `<div style="display:flex;justify-content:space-between;font-size:var(--fs-body);font-weight:700;
              margin-top:6px;padding-top:6px;border-top:1px solid var(--border);">
             <span>Total</span>
             <span id="mgTotalChargeValue">${fmtGbp(grandTotal)}</span>
           </div>`;
  const breakdown = document.getElementById('mgChargeBreakdown');
  if (breakdown) breakdown.innerHTML = html;

  mgUpdateDebt();
}

function toggleReturned() {
  const hidden = document.getElementById('mgReturned');
  const toggle = document.getElementById('mgReturnedToggle');
  const knob   = document.getElementById('mgToggleKnob');
  const label  = document.getElementById('mgReturnedLabel');
  const isNowReturned = hidden.value !== '1';
  hidden.value = isNowReturned ? '1' : '0';
  toggle.style.background = isNowReturned ? 'var(--success)' : 'var(--border)';
  knob.style.left = isNowReturned ? '25px' : '3px';
  label.style.color = isNowReturned ? 'var(--success)' : 'var(--muted)';
  label.textContent = isNowReturned ? 'Returned ✅' : 'Not returned yet';
  // The Charge Gate is about closing, so it appears with the toggle.
  if (typeof mgGateRentalId !== 'undefined' && mgGateRentalId) mgRenderGate(mgGateRentalId);
}

function mgUpdateDebt() {
  const total = mgComputeTotal();
  const paid  = parseFloat(document.getElementById('mgPaid')?.value) || 0;
  const diff  = total - paid;
  const el    = document.getElementById('mgDebtDisplay');
  if (!el) return;
  if (diff > 0.005) {
    el.style.color = 'var(--danger-ink)';
    el.textContent = 'Remaining debt: ' + fmtGbp(diff);
  } else if (diff < -0.005) {
    el.style.color = 'var(--warning)';
    el.textContent = '⚠ Paid ' + fmtGbp(Math.abs(diff)) + ' over total — reconcile manually';
  } else {
    el.style.color = 'var(--success)';
    el.textContent = '✓ Fully paid';
  }
}

async function saveManageRental(rentalId) {
  const r = rentals.find(x => x.id === rentalId);
  if (!r) return;

  const newFrom    = document.getElementById('mgFrom').value;
  const newTo      = document.getElementById('mgTo').value;
  const isReturned = document.getElementById('mgReturned').value === '1';
  const newPrice   = parseFloat(document.getElementById('mgPrice').value) || 0;
  const newPaid    = parseFloat(document.getElementById('mgPaid').value)  || 0;
  const { chargeableDays, totalDays } = calcRentalPrice(newFrom, newTo, r.country, r.ukPlan || 'standard');

  // The Charge Gate. This used to read "No hard block on undecided items —
  // undecided items show ⚠️ badge", which is the whole reason the gate exists:
  // a rental could be closed with the charger neither returned nor written off,
  // and the ambiguity was recorded as a badge on a row nobody goes back to.
  //
  // The button is already disabled when the gate is not satisfied; this is the
  // check behind it, because a disabled button is a hint and not a rule. (The
  // rule is on the server, in syncRentals — this is the third layer, and the
  // one that can explain itself.)
  if (isReturned) {
    const gate = gateFor(mgDraftRental(rentalId), {
      today: localISO(), verifications: [...mgGateVerified],
    });
    if (!gate.canClose) {
      const first = gate.blockers[0] || gate.needsVerification[0];
      toast(first ? `${first.label}: ${first.detail}` : 'This rental is not ready to close.', 'error');
      mgRenderGate(rentalId);
      return;
    }
  }

  const today = localISO();
  let newStatus;
  if (isReturned) newStatus = 'returned';
  else if (newTo < today) newStatus = 'overdue';
  else newStatus = 'active';

  // Capture late fee and lost charges at time of saving
  const savedLateFee    = mgComputeLateFee();
  const lostInfo        = mgComputeLostCharges();
  const grandTotal      = newPrice + savedLateFee + lostInfo.total;

  // Money changed → confirm before it lands on the customer.
  const oldGrand = (r.price || 0) + (r.lateFee || 0) + (r.lostChargesTotal || 0);
  if (grandTotal !== oldGrand && !(await kcConfirm({
    title: 'Confirm rental charge change',
    body: `<strong>${escName(r.customerName || 'Customer')}</strong><br>
      Rental ${fmtGbp(newPrice)}${savedLateFee > 0 ? ` + late fee ${fmtGbp(savedLateFee)}` : ''}${lostInfo.total > 0 ? ` + lost items ${fmtGbp(lostInfo.total)}` : ''}<br>
      <span style="color:var(--muted);font-size:var(--fs-small);">was ${fmtGbp(oldGrand)}</span>`,
    amount: grandTotal,
    okLabel: 'Apply charges',
  }))) return;

  const oldPrice   = r.price;
  r.fromDate       = newFrom;
  r.toDate         = newTo;
  r.status         = newStatus;
  r.price          = newPrice;           // rental price (after discount)
  r.lateFee        = savedLateFee;       // late fee locked at save time
  r.lostChargesTotal = lostInfo.total;   // sum of lost-item charges
  r.amountPaid     = newPaid;
  r.debt           = Math.max(0, grandTotal - newPaid);
  r.chargeableDays = chargeableDays;
  r.totalDays      = totalDays;
  r.notes          = document.getElementById('mgNotes').value.trim();
  // The deposit answer, and the sign-offs, ride along to the server: syncRentals
  // re-runs the same gate and will undo the close if they do not add up there.
  // Recorded on the rental rather than sent as a side-channel, so a close and
  // the reasons it was allowed can never be separated.
  r.depositSettled = document.getElementById('mgDepositSettled')?.checked || r.depositSettled || false;
  r.gateVerifications = isReturned ? [...mgGateVerified] : [];
  // Per-item status and per-item loss amounts (A1 data model). The single
  // charger UI row fans out to the stored plug+cable pair — but ONLY when the
  // operator actually changed it: an untouched charger keeps the genuine
  // per-key history (a cable recorded 'returned' next to a lost plug stays
  // 'returned'), so a price-only re-save can't rewrite the forensic record.
  const prevChargerSt  = uiItemStatus(r, 'charger');
  const prevChargerAmt = parseFloat(uiItemLostAmt(r, 'charger')) || null;
  const prevStatus     = r.itemStatus  || {};
  const prevLost       = r.lostCharges || {};
  const prevEq         = r.equipmentGiven || {};
  const mgCharger      = document.getElementById('mgGivenCharger')?.dataset.given === '1';
  r.itemStatus  = {};
  r.lostCharges = {};
  MG_UI_ITEMS.forEach(item => {
    const st  = document.getElementById('mgItemStatus_' + item)?.value || 'undecided';
    const amt = st === 'lost' ? (parseFloat(document.getElementById('mgLostAmt_' + item)?.value) || null) : null;
    if (item === 'charger') {
      if (st === prevChargerSt && (amt || null) === (prevChargerAmt || null) && mgCharger === ((prevEq.plug ?? false) || (prevEq.cable ?? false))) {
        r.itemStatus.plug  = prevStatus.plug  ?? st;
        r.itemStatus.cable = prevStatus.cable ?? st;
        r.lostCharges.plug  = prevLost.plug  ?? null;
        r.lostCharges.cable = prevLost.cable ?? null;
      } else {
        r.itemStatus.plug = st; r.itemStatus.cable = st;
        r.lostCharges.plug = amt; r.lostCharges.cable = null;
      }
    } else {
      r.itemStatus[item]  = st;
      r.lostCharges[item] = amt;
    }
  });
  const chargerUntouched = mgCharger === ((prevEq.plug ?? false) || (prevEq.cable ?? false));
  r.equipmentGiven = {
    phone: document.getElementById('mgGivenPhone')?.dataset.given === '1',
    sim:   document.getElementById('mgGivenSim')?.dataset.given   === '1',
    plug:  chargerUntouched ? (prevEq.plug ?? mgCharger)  : mgCharger,
    cable: chargerUntouched ? (prevEq.cable ?? mgCharger) : mgCharger,
  };
  const mgAddDiscount   = document.getElementById('mgAddDiscount')?.checked || false;
  const mgDiscountType  = document.getElementById('mgDiscountType')?.value  || 'percent';
  const mgDiscountValue = parseFloat(document.getElementById('mgDiscountValue')?.value) || 0;
  r.basePrice    = parseFloat(document.getElementById('mgBasePrice')?.value) || newPrice;
  r.discountValue = mgAddDiscount ? mgDiscountValue : 0;
  r.discountType  = mgDiscountType;

  const phone = phones.find(p => p.id === r.phoneId);
  if (phone) {
    phone.status = (newStatus === 'active' || newStatus === 'overdue') ? 'rented' : 'available';
    savePhones(phones);
  }
  saveRentals(rentals);

  const c = customers.find(x => x.id === r.customerId);
  if (c) {
    const priceDelta = newPrice - oldPrice;
    if (priceDelta !== 0) c.totalPaid = (c.totalPaid || 0) + priceDelta;
    await window.api.updateCustomer(c);
  }

  closeDynamicModal();
  toast('Rental updated! ✅', 'success');
  renderRentalsTab();
}

async function deleteRental(id) {
  const r = rentals.find(x => x.id === id);
  // #64 — a money-affecting delete: show what its wallet charge reverses to,
  // via the same amount-showing confirm used for adjustments (not a bare
  // native confirm that hides the consequence).
  if (!(await kcConfirm({
    title: 'Delete rental?',
    body: `<strong>${escHtml(r?.customerName || 'Rental')}</strong>${r?.phoneNumber ? ' · ' + escHtml(r.phoneNumber) : ''}<br>Its wallet charge is reversed to £0. This can’t be undone.`,
    amount: r ? (Number(r.price) || 0) : 0,
    okLabel: 'Delete rental',
  }))) return;
  if (r && r.status === 'active') {
    const phone = phones.find(p => p.id === r.phoneId);
    if (phone) { phone.status = 'available'; phone.currentRental = null; savePhones(phones); }
  }
  rentals = rentals.filter(r => r.id !== id);
  const res = await saveRentals(rentals, [id]);
  renderRentalsTab();
  if (res && res.success === false) return; // reportSave already warned
  toast('Rental deleted.', 'warning');
}

async function deletePhone(id) {
  const idx = phones.findIndex(x => x.id === id);
  const p = phones[idx];
  if (!p) return;
  if (p.status === 'rented') { toast('Cannot delete a phone that is currently rented.', 'error'); return; }
  // Undo-toast instead of a confirm dialog: the row disappears immediately,
  // but the server delete is held for the undo window (kcUndoable).
  phones.splice(idx, 1);
  renderRentalsTab();
  kcUndoable({
    label: `Phone ${p.model || p.imei || ''} removed.`.replace('  ', ' '),
    restore: () => {
      phones.splice(Math.min(idx, phones.length), 0, p);
      if (currentTab === 'rentals') renderRentalsTab();
    },
    commit: async () => {
      const res = await savePhones(phones, [id]);
      if (res && res.success === false) { // reportSave already warned — put it back
        phones.splice(Math.min(idx, phones.length), 0, p);
        if (currentTab === 'rentals') renderRentalsTab();
      }
    },
  });
}

// ══ DYNAMIC MODAL (shared) ══
function showDynamicModal(html) {
  let overlay = document.getElementById('dynamicModal');
  let wasOpen = false;
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'dynamicModal';
    overlay.className = 'modal-overlay';
    // Close on a backdrop click — but only when the press STARTED on the
    // backdrop too. A drag that merely ends there (pulling the resize corner
    // past the edge, selecting text and overshooting) still fires a click with
    // the overlay as target, and treating that as "close" throws away a
    // half-filled form.
    overlay.addEventListener('pointerdown', e => { overlay._pressedOnBackdrop = e.target === overlay; });
    overlay.addEventListener('click', e => { if (e.target === overlay && overlay._pressedOnBackdrop) closeDynamicModal(); });
    document.body.appendChild(overlay);
  } else {
    wasOpen = !overlay.classList.contains('hidden');
  }
  overlay.innerHTML = `<div class="modal" role="dialog" aria-modal="true" style="width:560px;"><button type="button" class="modal-x" aria-label="Close" title="Close (Esc)" onclick="closeDynamicModal()">✕</button>${html}</div>`;
  // Name the dialog from the title the payload already renders. Without this
  // all 49 call sites announce as an unnamed dialog — and because focus jumps
  // straight into the first field, the visible title is never read aloud.
  const dlg = overlay.querySelector('.modal');
  const dlgTitle = dlg && dlg.querySelector('.modal-title');
  if (dlg && dlgTitle) {
    if (!dlgTitle.id) dlgTitle.id = 'kcDynModalTitle';
    dlg.setAttribute('aria-labelledby', dlgTitle.id);
  }
  // Content swaps inside an already-open dialog (wizard steps, post-save
  // repaints) are responses, and responses snap (DESIGN.md §Motion) — the
  // enter animation would otherwise replay because innerHTML re-creates .modal.
  if (wasOpen) overlay.firstElementChild.style.animation = 'none';
  kcSaveReturnFocus('dynamicModal');
  overlay.classList.remove('hidden');
  suppressCardScrim(true);
  autofocusFirstField(overlay);
}

// #56 — when an action modal opens from the customer card, drop the card's own
// backdrop so the screen isn't dimmed twice (three scrim layers deep). The
// card box stays put behind the action modal; only one scrim shows. Restored
// when the action modal closes.
function suppressCardScrim(on) {
  const card = document.getElementById('customerCard');
  if (card && !card.classList.contains('hidden')) card.classList.toggle('scrim-off', on);
}

// Put the cursor in the first real field so a form is ready to type — the
// counter's biggest per-action time saver. Skipped on touch devices (so it
// doesn't pop the on-screen keyboard on display/manage modals) and any modal
// can opt out with a data-autofocus="off" element.
function autofocusFirstField(overlay) {
  if ('ontouchstart' in window) return;
  const modal = overlay.querySelector('.modal') || overlay;
  if (modal.querySelector('[data-autofocus="off"]')) return;
  const first = modal.querySelector('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([readonly]):not([disabled]), textarea, select');
  if (first) { try { first.focus({ preventScroll: true }); } catch { first.focus(); } }
}
// Remember what had focus when a modal opened, so closing it returns focus
// THERE instead of dumping a keyboard / screen-reader user at the top of the
// page. Keyed by overlay id so stacked modals (confirm over an action modal)
// each restore to the right place. Save BEFORE the modal moves focus.
const kcModalReturnFocus = {};
function kcSaveReturnFocus(id) {
  const a = document.activeElement;
  if (a && a !== document.body) kcModalReturnFocus[id] = a;
}
function kcRestoreReturnFocus(id) {
  const el = kcModalReturnFocus[id];
  delete kcModalReturnFocus[id];
  if (el && document.contains(el) && typeof el.focus === 'function') {
    try { el.focus({ preventScroll: true }); } catch { el.focus(); }
  }
}

function closeDynamicModal() {
  const overlay = document.getElementById('dynamicModal');
  if (overlay) overlay.classList.add('hidden');
  suppressCardScrim(false);
  kcRestoreReturnFocus('dynamicModal');
}

// ── Charge confirmation ──────────────────────────────────────────────────
// Promise-based "are you sure?" that stacks ON TOP of any open modal (own
// overlay, higher z-index). Runs before anything that posts a charge to a
// customer's wallet. The POS till is deliberately exempt — its 💷 Charge
// button IS the confirmation on the shopfloor.
let kcConfirmResolve = null;
function kcConfirm({ title = 'Confirm charge', body = '', okLabel = 'Confirm charge', amount = null }) {
  return new Promise(resolve => {
    kcConfirmResolve = resolve;
    kcSaveReturnFocus('kcConfirm');
    let el = document.getElementById('kcConfirm');
    if (!el) {
      el = document.createElement('div');
      el.id = 'kcConfirm';
      el.className = 'modal-overlay';
      el.style.zIndex = '3000';
      el.addEventListener('click', e => { if (e.target === el) kcConfirmDone(false); });
      document.body.appendChild(el);
    }
    el.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="kcConfirmTitle" style="width:430px;">
        <div class="modal-title" id="kcConfirmTitle">${escHtml(title)}</div>
        <div style="font-size:var(--fs-ui);line-height:1.65;margin:4px 0 10px;color:var(--text);">${body}</div>
        ${amount !== null ? `<div style="font-size:var(--fs-h1);font-weight:700;margin:0 0 16px;font-feature-settings:'tnum';">${fmtGbp(Number(amount))}</div>` : ''}
        <div class="modal-actions">
          <button class="btn btn-outline" onclick="kcConfirmDone(false)">Cancel</button>
          <button class="btn btn-primary" onclick="kcConfirmDone(true)">✓ ${escHtml(okLabel)}</button>
        </div>
      </div>`;
    el.classList.remove('hidden');
    // Focus Cancel, not Confirm: this dialog opens over the trigger button, and
    // an un-moved focus would let a stray Enter re-fire that trigger (orphaning
    // this promise) or confirm a charge the user hadn't read. Cancel is the safe
    // default landing spot.
    const cancelBtn = el.querySelector('.btn-outline');
    if (cancelBtn) { try { cancelBtn.focus({ preventScroll: true }); } catch { cancelBtn.focus(); } }
  });
}
function kcConfirmDone(ok) {
  const el = document.getElementById('kcConfirm');
  if (el) el.classList.add('hidden');
  const r = kcConfirmResolve; kcConfirmResolve = null;
  kcRestoreReturnFocus('kcConfirm');
  if (r) r(ok);
}

// ─────────────────────────────────────────────
//  SHARED FILTER + SORT  (feature #4)
// ─────────────────────────────────────────────
// A reusable version of the Customers-tab filter/sort control so every list
// tab reads the same way. Each tab registers a config — an array of filter
// predicates and an array of sort comparators. The chosen filter/sort persist
// in-memory per tab, so they survive the re-render a selection triggers.
const kcViewState = {};   // tabKey -> { filter, sort }
const kcViewCfg = {};     // tabKey -> { filters, sorts, render }

function kcView(key) {
  return kcViewState[key] || (kcViewState[key] = { filter: '', sort: '' });
}

// filters/sorts: [{ value, label, test?(item), cmp?(a,b) }].
//   filters[0] is the default ("everything"); sorts[0] is the default order.
// B5 — a tab may instead pass filter DIMENSIONS: [{ dim, title, options }, …],
// one <select> per dimension, all applied together (Rentals: balance × status).
// Dimension state lives in kcView(key).dims so palette views can preset it
// before the tab has ever rendered.
// render() repaints the tab after any change. Returns the <select> controls
// as HTML (the flat filter select is shown only when there's >1 option).
const kcFsDims = (filters) => (filters.length && Array.isArray(filters[0].options)) ? filters : null;
function kcFilterSort(key, filters, sorts, render) {
  kcViewCfg[key] = { filters, sorts, render };
  const st = kcView(key);
  const dims = kcFsDims(filters);
  if (dims) {
    st.dims = st.dims || {};
    for (const d of dims) {
      if (!d.options.some(o => o.value === st.dims[d.dim])) st.dims[d.dim] = d.options[0].value;
    }
  } else if (!filters.some(f => f.value === st.filter)) st.filter = filters[0].value;
  if (!sorts.some(s => s.value === st.sort)) st.sort = sorts[0].value;
  const opts = (list, cur) => list.map(o =>
    `<option value="${escHtml(o.value)}" ${o.value === cur ? 'selected' : ''}>${escHtml(o.label)}</option>`).join('');
  const filterSelects = dims
    ? dims.map(d => `<select class="form-input kc-fs-sel" title="${escHtml(d.title || 'Filter')}"
        onchange="kcViewSetDim('${key}','${d.dim}',this.value)">${opts(d.options, st.dims[d.dim])}</select>`).join('')
    : (filters.length > 1 ? `<select class="form-input kc-fs-sel" title="Filter"
        onchange="kcViewSet('${key}','filter',this.value)">${opts(filters, st.filter)}</select>` : '');
  const views = kcSavedViews(key);
  const viewChips = views.map((v, i) => `
      <span class="kc-view-chip ${kcViewMatches(key, v) ? 'on' : ''}">
        <button type="button" class="kc-view-apply" title="Apply this view"
          onclick="kcViewApplySaved('${key}',${i})">${escHtml(v.name)}</button>
        <button type="button" class="kc-view-del" title="Delete this view"
          aria-label="Delete view ${escHtml(v.name)}"
          onclick="kcViewDeleteSaved('${key}',${i},event)">×</button>
      </span>`).join('');
  return `
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
      ${filterSelects}
      <select class="form-input kc-fs-sel" title="Sort by"
        onchange="kcViewSet('${key}','sort',this.value)">${opts(sorts, st.sort)}</select>
      ${viewChips}
      <button type="button" class="kc-view-save" title="Save the current filter &amp; sort as a named view"
        onclick="kcViewSaveCurrent('${key}')">☆ Save view</button>
    </div>`;
}

// Saved views — named filter+sort presets per list tab (Linear/Notion pattern).
// Pure view state in localStorage (kc_saved_views: { tabKey: [{name, filter,
// sort, dims}] }), capped at 6 per tab. Applying one goes through the normal
// kcFilterSort re-validation, so a preset that references a since-removed
// option safely falls back to the default.
const SAVED_VIEWS_KEY = 'kc_saved_views';
function kcSavedViews(key) {
  try {
    const all = JSON.parse(localStorage.getItem(SAVED_VIEWS_KEY) || '{}');
    return Array.isArray(all[key]) ? all[key] : [];
  } catch { return []; }
}
function kcSavedViewsSet(key, list) {
  try {
    const all = JSON.parse(localStorage.getItem(SAVED_VIEWS_KEY) || '{}');
    all[key] = list;
    localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(all));
  } catch { /* private mode / full */ }
}
function kcViewSnapshot(key) {
  const st = kcView(key);
  return { filter: st.filter || '', sort: st.sort || '', dims: st.dims ? { ...st.dims } : null };
}
function kcViewMatches(key, v) {
  const cur = kcViewSnapshot(key);
  if ((v.sort || '') !== cur.sort) return false;
  if (v.dims || cur.dims) {
    const a = v.dims || {}, b = cur.dims || {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if ((a[k] || '') !== (b[k] || '')) return false;
    }
    return true;
  }
  return (v.filter || '') === cur.filter;
}
function kcViewSaveCurrent(key) {
  const name = (prompt('Name this view (e.g. "Overdue", "This week"):') || '').trim().slice(0, 24);
  if (!name) return;
  const list = kcSavedViews(key).filter(v => v.name !== name); // same name = overwrite
  list.unshift({ name, ...kcViewSnapshot(key) });
  kcSavedViewsSet(key, list.slice(0, 6));
  const cfg = kcViewCfg[key];
  if (cfg && cfg.render) cfg.render();
}
function kcViewApplySaved(key, i) {
  const v = kcSavedViews(key)[i];
  if (!v) return;
  const st = kcView(key);
  if (v.sort) st.sort = v.sort;
  if (v.dims) st.dims = { ...v.dims };
  else st.filter = v.filter || '';
  const cfg = kcViewCfg[key];
  if (cfg && cfg.render) cfg.render();
}
function kcViewDeleteSaved(key, i, ev) {
  if (ev) ev.stopPropagation();
  const list = kcSavedViews(key);
  list.splice(i, 1);
  kcSavedViewsSet(key, list);
  const cfg = kcViewCfg[key];
  if (cfg && cfg.render) cfg.render();
}

function kcViewSet(key, kind, value) {
  kcView(key)[kind] = value;
  const cfg = kcViewCfg[key];
  if (cfg && cfg.render) cfg.render();
}
function kcViewSetDim(key, dim, value) {
  const st = kcView(key);
  st.dims = st.dims || {};
  st.dims[dim] = value;
  const cfg = kcViewCfg[key];
  if (cfg && cfg.render) cfg.render();
}

// A filtered-to-empty list is a dead end: the rows are gone, so the thing you
// would click to get them back is the one control still on screen, and it is a
// <select> you have to know to reset — dimension by dimension. These give the
// empty state itself a way out.
//
// "Is anything narrowed?" is answered against the CONFIG, not a remembered
// default, so a tab that later reorders its options can't leave this lying.
function kcViewIsFiltered(key) {
  const cfg = kcViewCfg[key];
  if (!cfg) return false;
  const st = kcView(key);
  const dims = kcFsDims(cfg.filters);
  if (dims) return dims.some(d => (st.dims || {})[d.dim] !== d.options[0].value);
  return !!cfg.filters.length && st.filter !== cfg.filters[0].value;
}
function kcViewReset(key) {
  const cfg = kcViewCfg[key];
  if (!cfg) return;
  const st = kcView(key);
  const dims = kcFsDims(cfg.filters);
  if (dims) { st.dims = {}; for (const d of dims) st.dims[d.dim] = d.options[0].value; }
  else if (cfg.filters.length) st.filter = cfg.filters[0].value;
  // Sort deliberately survives: it isn't why the list is empty, and silently
  // reordering what comes back would be a second surprise.
  if (cfg.render) cfg.render();
}
// The button for a filtered-empty list. Returns '' when nothing is narrowed,
// so callers can drop it straight into their existing <small>.
function kcClearFiltersBtn(key) {
  return kcViewIsFiltered(key)
    ? `<button type="button" class="btn btn-outline btn-sm" style="margin-top:10px;"
        onclick="kcViewReset('${key}')">↺ Clear filters</button>`
    : '';
}

// Apply the active filter + sort for a tab to a list (returns a new array).
function kcViewApply(key, list) {
  const cfg = kcViewCfg[key];
  const st = kcView(key);
  let out = Array.isArray(list) ? list.slice() : [];
  if (!cfg) return out;
  const dims = kcFsDims(cfg.filters);
  if (dims) {
    for (const d of dims) {
      const o = d.options.find(x => x.value === (st.dims || {})[d.dim]);
      if (o && o.test) out = out.filter(o.test);
    }
  } else {
    const f = cfg.filters.find(x => x.value === st.filter);
    if (f && f.test) out = out.filter(f.test);
  }
  const s = cfg.sorts.find(x => x.value === st.sort);
  if (s && s.cmp) out.sort(s.cmp);
  return out;
}

// Small shared comparators for the sort configs above.
const kcCmpStr = (fn) => (a, b) => String(fn(a) || '').toLowerCase().localeCompare(String(fn(b) || '').toLowerCase());
const kcCmpNum = (fn) => (a, b) => (Number(fn(b)) || 0) - (Number(fn(a)) || 0);       // high → low
const kcCmpDate = (fn, dir = 1) => (a, b) => dir * String(fn(a) || '').localeCompare(String(fn(b) || ''));

// ─────────────────────────────────────────────
//  CUSTOMERS TAB
// ─────────────────────────────────────────────
// Authoritative wallet balances (legacy customer id → balance; negative = owes),
// loaded from the ledger so the Balance column + arrears filter reflect ALL money
// (bookings, services, SIM/VN, shop — not just rentals). null until loaded. audit U9.
let customerLedgerBal = null;

function renderCustomersTab() {
  applySearch();
  // Refresh the authoritative balances; falls back to rental math until it lands
  // (or stays on the fallback if the wallet tab isn't permitted for this staff).
  kcFetch('/api/ledger').then(r => r.ok ? r.json() : null).then(d => {
    if (!d || !d.success) return;
    const m = new Map();
    for (const b of (d.arrears || [])) if (b.customerId != null) m.set(String(b.customerId), Number(b.balance));
    for (const b of (d.credits || [])) if (b.customerId != null) m.set(String(b.customerId), Number(b.balance));
    customerLedgerBal = m;
    if (currentTab === 'customers') renderTableRows();
  }).catch(() => {});
  const content = document.getElementById('mainContent');
  const totalPaid = rentals.reduce((s, r) => s + (r.amountPaid || 0), 0);

  content.innerHTML = `
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">Total Customers</div>
        <div class="stat-value blue" id="statTotal">${customers.length}</div>
        <div class="stat-sub">Registered</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Active Rentals</div>
        <div class="stat-value green">${rentals.filter(r => r.status === 'active').length}</div>
        <div class="stat-sub">Currently out</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Active SIM Plans</div>
        <div class="stat-value sim">${sims.filter(s => s.status === 'active').length}</div>
        <div class="stat-sub">Running now</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Revenue</div>
        <div class="stat-value purple">${fmtGbp(totalPaid)}</div>
        <div class="stat-sub">All time</div>
      </div>
    </div>

    <div class="section-header">
      <div class="section-title">Customer List</div>
      <div style="display:flex;gap:8px;align-items:center;">
        <select class="form-input" style="width:180px;padding:6px 10px;font-size:var(--fs-body);min-height:0;"
          onchange="customerFilter=this.value; renderTableRows()">
          <option value="all" ${customerFilter==='all'?'selected':''}>Filter: everyone</option>
          <option value="rental" ${customerFilter==='rental'?'selected':''}>📱 Active rental</option>
          <option value="flight" ${customerFilter==='flight'?'selected':''}>✈️ Upcoming flight</option>
          <option value="sim" ${customerFilter==='sim'?'selected':''}>💳 SIM plan</option>
          <option value="vn" ${customerFilter==='vn'?'selected':''}>🔢 Virtual number</option>
          <option value="repair" ${customerFilter==='repair'?'selected':''}>🔧 Open repair</option>
          <option value="arrears" ${customerFilter==='arrears'?'selected':''}>💰 In arrears</option>
          <option value="passport" ${customerFilter==='passport'?'selected':''}>🛂 Passport on file</option>
        </select>
        <select class="form-input" style="width:170px;padding:6px 10px;font-size:var(--fs-body);min-height:0;"
          onchange="customerSort=this.value; renderTableRows()">
          <option value="name" ${customerSort==='name'?'selected':''}>Sort: Name A–Z</option>
          <option value="name_desc" ${customerSort==='name_desc'?'selected':''}>Name Z–A</option>
          <option value="owed" ${customerSort==='owed'?'selected':''}>Most owed first</option>
          <option value="recent" ${customerSort==='recent'?'selected':''}>Recently added</option>
          <option value="services" ${customerSort==='services'?'selected':''}>Most services</option>
        </select>
        <button class="btn btn-outline" id="btnExportCSV">Export CSV</button>
      </div>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Customer Name</th>
            <th>Phone</th>
            <th>Active Services</th>
            <th>Balance</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="customersTableBody"></tbody>
      </table>
    </div>
    <div id="detailPanelContainer"></div>
  `;

  renderTableRows();

  document.getElementById('btnExportCSV').addEventListener('click', async () => {
    const res = await window.api.exportCSV();
    if (res.success) toast('CSV exported successfully!', 'success');
  });
}

// The customer's authoritative wallet balance (negative = owes), or null until the
// ledger has loaded / when it isn't available to this staff member. audit U9.
function customerLedgerBalance(c) {
  if (!customerLedgerBal) return null;
  return customerLedgerBal.has(String(c.id)) ? customerLedgerBal.get(String(c.id)) : 0;
}

// Live debt per customer, used for the arrears filter and the "most owed" sort.
// Prefers the ledger balance; falls back to rental-only math before it loads.
function customerOwed(c) {
  const bal = customerLedgerBalance(c);
  if (bal !== null) return bal < 0 ? -bal : 0;
  return rentals.filter(r => r.customerId === c.id).reduce((s, r) => s + rentalDebt(r), 0);
}
// Bookings that are still upcoming — booked/ticketed and NOT flown yet
// (travel date today or later, or no date set). Cancelled/Completed excluded.
function customerUpcomingBookings(c) {
  const today = localISO();
  return bookings.filter(b => b.customerId === c.id
    && b.status !== 'Cancelled' && b.status !== 'Completed'
    && (!b.travelDate || b.travelDate >= today));
}
function customerServiceCount(c) {
  return rentals.filter(r => r.customerId === c.id && (r.status === 'active' || r.status === 'overdue')).length
    + customerUpcomingBookings(c).length
    + sims.filter(s => s.customerId === c.id && s.status === 'active').length
    + virtualNumbers.filter(v => v.customerId === c.id && v.status === 'Active').length
    + repairs.filter(r => r.customerId === c.id && r.status !== 'Collected' && r.status !== 'Cancelled').length;
}
function sortCustomers(list) {
  const nm = c => `${c.firstName || ''} ${c.lastName || ''}`.trim().toLowerCase();
  const arr = [...list];
  switch (customerSort) {
    case 'name_desc': arr.sort((a, b) => nm(b).localeCompare(nm(a))); break;
    case 'owed':      arr.sort((a, b) => customerOwed(b) - customerOwed(a)); break;
    case 'recent':    arr.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))); break;
    case 'services':  arr.sort((a, b) => customerServiceCount(b) - customerServiceCount(a)); break;
    default:          arr.sort((a, b) => nm(a).localeCompare(nm(b))); // name A–Z
  }
  return arr;
}

// Passport-on-file is AUTOMATIC and honest: a customer counts as having a
// passport on file only when real passport details are actually stored for one
// of their bookings. hasPassportDetails is computed server-side (a role-safe
// yes/no — the passport number itself is owner-only on reads), so this is
// accurate for every staff role. The old manual `passportOnFile` checkbox no
// longer fakes a green tick; it now only surfaces as a "marked but no details
// entered" note on the trip card.
function customerHasPassport(c) {
  return bookings.some(b => b.customerId === c.id && b.hasPassportDetails);
}

function customerMatchesFilter(c) {
  switch (customerFilter) {
    case 'rental':   return rentals.some(r => r.customerId === c.id && (r.status === 'active' || r.status === 'overdue'));
    case 'flight':   return customerUpcomingBookings(c).length > 0;
    case 'sim':      return sims.some(s => s.customerId === c.id && s.status === 'active');
    case 'vn':       return virtualNumbers.some(v => v.customerId === c.id && v.status === 'Active');
    case 'repair':   return repairs.some(r => r.customerId === c.id && r.status !== 'Collected' && r.status !== 'Cancelled');
    case 'arrears':  return customerOwed(c) > 0;
    case 'passport': return customerHasPassport(c);
    default:         return true;
  }
}

function renderTableRows() {
  const tbody = document.getElementById('customersTableBody');
  if (!tbody) return;
  // #51 — derive the shown list; never re-filter filteredCustomers in place
  // (that narrowed the search result cumulatively on every render/filter change).
  const shown = sortCustomers(filteredCustomers.filter(customerMatchesFilter));

  // A failed load must never read as "No customers yet." — with 751 real
  // records behind it that invites a panicked re-entry of data that already
  // exists. Say what actually happened and offer the retry.
  if (loadFailed.customers) {
    tbody.innerHTML = `<tr><td colspan="5">${errorHtml('Couldn’t load your customers')}</td></tr>`;
    return;
  }

  if (shown.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="5">
        <div class="empty-state">
          <div class="emoji">👥</div>
          <p>${searchTerm ? 'No customers match your search.' : 'No customers yet.'}</p>
          <small>${searchTerm ? '' : 'Click "+ New Customer" to add your first customer.'}</small>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = shown.map(c => {
    const selected = c.id === selectedId ? 'selected' : '';
    const activeCustomerRentals = rentals.filter(r => r.customerId === c.id && (r.status === 'active' || r.status === 'overdue'));
    // Real linked services (not just legacy embedded ones) — same fix as the
    // detail panel so SIMs/VNs/repairs aren't invisible in the list either.
    const cSimCount = sims.filter(s => s.customerId === c.id && s.status === 'active').length;
    const cVnCount = virtualNumbers.filter(v => v.customerId === c.id && v.status === 'Active').length;
    const cOpenRepairs = repairs.filter(r => r.customerId === c.id && r.status !== 'Collected' && r.status !== 'Cancelled').length;
    const cUpcomingFlights = customerUpcomingBookings(c).length;
    const otherServices = (c.services || []).filter(s => s.type !== 'rental' && s.type !== 'sim' && s.type !== 'vn');
    const services = [
      ...activeCustomerRentals.map(r => `<span class="badge badge-rental">Rental ${countryFlag(r.country)}</span>`),
      ...(cUpcomingFlights ? [`<span class="badge badge-booking">✈️ Flight${cUpcomingFlights > 1 ? ' ×' + cUpcomingFlights : ''}</span>`] : []),
      ...(cSimCount ? [`<span class="badge badge-sim">💳 SIM${cSimCount > 1 ? ' ×' + cSimCount : ''}</span>`] : []),
      ...(cVnCount ? [`<span class="badge badge-vn">🔢 VN${cVnCount > 1 ? ' ×' + cVnCount : ''}</span>`] : []),
      ...(cOpenRepairs ? [`<span class="badge badge-repair">🔧 Repair${cOpenRepairs > 1 ? ' ×' + cOpenRepairs : ''}</span>`] : []),
      ...otherServices.map(s => `<span class="badge badge-${s.type}">${escHtml(s.label)}</span>`),
    ].join('');

    // Prefer the authoritative ledger balance; fall back to rental-only math until
    // it loads (or if the wallet tab isn't permitted for this staff member). U9.
    const ledgerBal = customerLedgerBalance(c);
    const customerDebt = ledgerBal !== null
      ? (ledgerBal < 0 ? -ledgerBal : 0)
      : rentals.filter(r => r.customerId === c.id).reduce((sum, r) => sum + rentalDebt(r), 0);
    const customerCredit = ledgerBal !== null && ledgerBal > 0 ? ledgerBal : 0;
    const customerPaid = rentals
      .filter(r => r.customerId === c.id)
      .reduce((sum, r) => sum + (r.amountPaid || 0), 0);

    return `
    <tr class="${selected}" data-id="${c.id}">
      <td>
        <div class="customer-name">${nameHtml(`${c.firstName || ''} ${c.lastName || ''}`.trim())}${customerHasPassport(c) ? ' <span title="Passport on file">🛂</span>' : ''}</div>
        <div class="customer-email">${escHtml(c.email || '')}${c.accountEmail ? `${c.email ? '<br>' : ''}<span title="Account/login email (Lebara etc.) — not for contacting the customer" style="color:var(--muted);">⚙️ ${escHtml(c.accountEmail)}</span>` : ''}</div>
      </td>
      <td class="kc-phone">${c.phone ? escHtml(fmtPhone(c.phone)) : '—'}</td>
      <td>${services || '<span style="color:var(--muted);font-size:var(--fs-small);">None</span>'}</td>
      <td class="kc-money" style="color: ${customerDebt > 0 ? 'var(--danger-ink)' : (customerCredit > 0 ? 'var(--accent)' : 'var(--success)')}; font-weight: 700;">${
        customerDebt > 0 ? `${fmtGbp(customerDebt)} debt`
        : customerCredit > 0 ? `${fmtGbp(customerCredit)} credit`
        : ledgerBal !== null ? 'Settled'
        : `${fmtGbp(customerPaid)}`}</td>
      <td>
        <div class="row-actions">
          <button class="action-btn" data-action="edit" data-id="${c.id}">Edit</button>
          <button class="action-btn" data-action="details" data-id="${c.id}">Details</button>
          <button class="action-btn danger" data-action="delete" data-id="${c.id}">Delete</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('tr[data-id]').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.action-btn')) return;
      toggleDetail(row.dataset.id);
    });
  });

  tbody.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const { action, id } = btn.dataset;
      if (action === 'edit') openEditModal(id);
      else if (action === 'details') toggleDetail(id);
      else if (action === 'delete') deleteCustomer(id);
    });
  });

  if (selectedId && filteredCustomers.find(c => c.id === selectedId)) {
    renderDetailPanel(selectedId);
  }
}

// ─────────────────────────────────────────────
//  DETAIL PANEL
// ─────────────────────────────────────────────
function toggleDetail(id) {
  if (selectedId === id) {
    selectedId = null;
    closeCustomerCard();
    document.querySelectorAll('tr.selected').forEach(r => r.classList.remove('selected'));
  } else {
    selectedId = id;
    renderDetailPanel(id);
    document.querySelectorAll('tr[data-id]').forEach(r => {
      r.classList.toggle('selected', r.dataset.id === id);
    });
  }
}

// Customer 360 — one chronological timeline of EVERYTHING this customer has
// done (every rental, flight, SIM, virtual number, repair and service),
// newest first, built from the in-memory records the card already loaded.
function buildCustomerTimeline(c) {
  const cid = c.id;
  const ev = [];
  // Every row carries {fn, id} for its record's manage/edit surface, so the
  // timeline is a way IN to each record (edit, delete), not just a listing —
  // before this, imported history was visible here but unreachable.
  for (const r of rentals.filter(x => x.customerId === cid)) {
    ev.push({ date: r.fromDate || r.createdAt, icon: '📱', cat: 'Rental',
      title: `Rental${r.phoneNumber ? ' — ' + r.phoneNumber : r.country ? ' — ' + r.country : ''}`,
      sub: `${r.status}${r.fromDate ? ' · ' + fmtDate(r.fromDate) + (r.toDate ? ' → ' + fmtDate(r.toDate) : '') : ''}`,
      amount: rentalGrandTotal(r), open: { fn: 'openManageRentalModal', id: r.id } });
  }
  for (const b of bookings.filter(x => x.customerId === cid)) {
    ev.push({ date: b.travelDate || b.createdAt, icon: '✈️', cat: 'Flight',
      title: `${b.route || 'Flight'}${b.passenger ? ' — ' + b.passenger : ''}`,
      sub: `${b.status || ''}${b.travelDate ? ' · ' + fmtDate(b.travelDate) : ''}`,
      amount: Number(b.price || b.total || 0), open: { fn: 'openEditBookingModal', id: b.id } });
  }
  for (const s of sims.filter(x => x.customerId === cid)) {
    ev.push({ date: s.createdAt || s.renewalDate, icon: '📶', cat: 'SIM',
      title: `SIM — ${s.provider || 'plan'}${s.simNumber ? ' · ' + s.simNumber : ''}`,
      sub: `${s.status || ''}${s.renewalDate ? ' · renews ' + fmtDate(s.renewalDate) : ''}`,
      open: { fn: 'openManageSimModal', id: s.id } });
  }
  for (const v of virtualNumbers.filter(x => x.customerId === cid)) {
    ev.push({ date: v.createdAt, icon: '🔢', cat: 'Virtual number',
      title: `VN ${fmtPhone(v.number || '')}`.trim(), sub: v.status || '',
      open: { fn: 'openVNBillingModal', id: v.id } });
  }
  for (const r of repairs.filter(x => x.customerId === cid)) {
    ev.push({ date: r.openedAt || r.createdAt, icon: '🔧', cat: 'Repair',
      title: `Repair${r.device ? ' — ' + r.device : ''}`, sub: r.status || '',
      amount: Number(r.total || 0), open: { fn: 'goToTab', id: 'repairs' } });
  }
  for (const o of serviceOrders.filter(x => x.customerId === cid)) {
    ev.push({ date: o.createdAt, icon: '🖨️', cat: 'Service',
      title: o.serviceName || 'Service', sub: o.createdAt ? fmtDate(o.createdAt) : '',
      amount: Number(o.total || 0) });
  }
  // #60 — logged calls/notes and auto-logged sent emails share the timeline.
  for (const m of (c.commLog || [])) {
    ev.push({ date: m.at, icon: m.icon || '💬', cat: 'Contact',
      title: m.text || m.type || 'Note', sub: m.by ? 'by ' + m.by : '' });
  }
  ev.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  return ev;
}

// #81 — a derived lifecycle stage. No schema change: it reads the customer's
// own in-memory activity so the operator sees at a glance who is new, a
// regular, active right now, or gone quiet. Purely a display signal.
function customerLifecycle(c) {
  const cid = c.id;
  const timeline = buildCustomerTimeline(c);
  const spend = timeline.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const hasLive =
    rentals.some(r => r.customerId === cid && (r.status === 'active' || r.status === 'overdue')) ||
    sims.some(s => s.customerId === cid && s.status === 'active') ||
    virtualNumbers.some(v => v.customerId === cid && v.status === 'Active') ||
    repairs.some(r => r.customerId === cid && r.status !== 'Collected' && r.status !== 'Cancelled') ||
    customerUpcomingBookings(c).length > 0;
  const lastMs = timeline.length ? new Date(timeline[0].date || 0).getTime()
    : (c.createdAt ? new Date(c.createdAt).getTime() : 0);
  const daysSince = lastMs ? Math.floor((Date.now() - lastMs) / 86400000) : Infinity;
  if (spend >= 500 || timeline.length >= 12) return { key: 'regular', label: 'Regular', emoji: '⭐', color: 'var(--accent2)' };
  if (hasLive) return { key: 'active', label: 'Active', emoji: '🟢', color: 'var(--success)' };
  if (timeline.length <= 1 && daysSince < 60) return { key: 'new', label: 'New', emoji: '✨', color: 'var(--accent)' };
  if (daysSince > 180) return { key: 'dormant', label: 'Dormant', emoji: '💤', color: 'var(--muted)' };
  return { key: 'past', label: 'Past', emoji: '·', color: 'var(--muted)' };
}

// #82 — Next best action, generalized past flights. The single most pressing
// thing to do for this customer right now, or null. Ordered by urgency; the
// wallet balance is passed in once it has loaded so the arrears case is exact.
function customerNextBestAction(c, balance) {
  const cid = c.id;
  const today = localISO();
  if (typeof balance === 'number' && balance < -0.005) {
    return { icon: '💰', text: `Owes ${fmtGbp(Math.abs(balance))}`,
      btn: `<button class="btn btn-primary btn-sm" onclick="openWalletModal('${cid}', ${balance})">Take payment</button>` };
  }
  const ready = repairs.find(r => r.customerId === cid && r.status === 'Ready');
  if (ready) {
    return { icon: '🔧', text: `Repair ready — ${escHtml(ready.device || 'device')} waiting for collection`,
      btn: `<button class="btn btn-outline btn-sm" onclick="openCollectRepairModal('${ready.id}')">Collect</button>` };
  }
  const trip = bookings.filter(b => b.customerId === cid && b.status !== 'Cancelled' && b.travelDate && b.travelDate >= today)
    .sort((a, b) => a.travelDate.localeCompare(b.travelDate))[0];
  if (trip) {
    const phoneCover = rentals.find(r => r.customerId === cid && r.status !== 'returned'
      && r.fromDate && r.toDate && r.fromDate <= trip.travelDate && r.toDate >= trip.travelDate);
    if (!phoneCover) {
      return { icon: '✈️', text: `Flies ${fmtDate(trip.travelDate)} — no phone booked yet`,
        btn: `<button class="btn btn-rental btn-sm" onclick="openNewRentalModal('${cid}')">Book a phone</button>` };
    }
  }
  const overdue = rentals.find(r => r.customerId === cid && r.status === 'overdue');
  if (overdue) {
    return { icon: '⏰', text: `Rental overdue since ${fmtDate(overdue.toDate)}`, btn: '' };
  }
  return null;
}

// Everything the profile shows, built once and worn two ways: mode 'card' is
// the pop-over the list opens (compact, full history folded into <details>),
// mode 'page' is the Customer-360 page at /customers/<id> — same header and
// stats, then Overview | Activity sub-tabs, and no ✕ (the breadcrumb above
// the panel is the way back).
function buildCustomerPanelHtml(c, mode = 'card') {
  const isPage = mode === 'page';
  const lifecycle = customerLifecycle(c);

  const initials = ((c.firstName || '?')[0] + (c.lastName || '?')[0]).toUpperCase();
  const since = c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : '—';
  const addr = c.address ? `· ${escHtml(c.address)}` : '';

  const history = c.history || [];
  const totalPaid = c.totalPaid || 0;
  const totalDebt = rentals
    .filter(r => r.customerId === c.id)
    .reduce((sum, r) => sum + rentalDebt(r), 0);
  const customerPaid = rentals
    .filter(r => r.customerId === c.id)
    .reduce((sum, r) => sum + (r.amountPaid || 0), 0);
  const cActiveRentals = rentals.filter(r => r.customerId === c.id && (r.status === 'active' || r.status === 'overdue'));
  // Real linked SIMs and virtual numbers (the global lists), not the legacy
  // embedded c.services — those seeded plans were being missed entirely.
  const cSims = sims.filter(s => s.customerId === c.id && s.status === 'active');
  const cVNs = virtualNumbers.filter(v => v.customerId === c.id && v.status === 'Active');
  const cOpenRepairs = repairs.filter(r => r.customerId === c.id && r.status !== 'Collected' && r.status !== 'Cancelled');
  const otherServices = (c.services || []).filter(s => s.type !== 'rental' && s.type !== 'sim' && s.type !== 'vn' && s.type !== 'repair');
  const activeVNs = cVNs.length;

  const dotColor = { rental: 'dot-blue', vn: 'dot-purple', sim: 'dot-sim', payment: 'dot-green' };

  const historyHTML = history.length === 0
    ? `<div style="color:var(--muted);font-size:var(--fs-body);padding:10px 0;">No history yet.</div>`
    : history.slice().reverse().map(h => `
        <div class="history-item">
          <div class="history-main">
            <div class="history-dot ${dotColor[h.type] || 'dot-blue'}"></div>
            <div class="history-desc">${escHtml(h.desc)}</div>
          </div>
          <div class="history-date" style="margin:0 16px;">${escHtml(h.date || '')}</div>
          <div class="history-amount">${fmtGbp(h.amount)}</div>
        </div>`).join('');

  const cUpcoming = customerUpcomingBookings(c);
  const allActiveServices = [
    ...cActiveRentals.map(r => ({ type: 'rental', label: `Rental ${countryFlag(r.country)}${r.depositHeld > 0 ? ' · 🔒£' + Number(r.depositHeld).toFixed(0) : ''}${r.termsAck ? ' · ✍️' : ''}` })),
    ...cUpcoming.map(b => ({ type: 'booking', label: `✈️ ${b.route}${b.travelDate ? ' · ' + fmtDate(b.travelDate) : ''}` })),
    ...cSims.map(s => ({ type: 'sim', simId: s.id, label: `SIM · ${s.provider || 'plan'}${s.simNumber ? ' · ' + s.simNumber : ''}` })),
    ...cVNs.map(v => ({ type: 'vn', label: `VN ${fmtPhone(v.number || '')}` })),
    ...cOpenRepairs.map(r => ({ type: 'repair', label: `🔧 Repair — ${r.status}` })),
    // Recent one-off online/print services (last 90 days, newest first).
    ...serviceOrders
      .filter(o => o.customerId === c.id && o.createdAt
        && (Date.now() - new Date(o.createdAt).getTime()) < 90 * 86400000)
      .slice(0, 3)
      .map(o => ({ type: 'sim', label: `🖨️ ${o.serviceName || 'Service'} · ${fmtDate(o.createdAt)}` })),
    ...otherServices,
  ];
  const servicesHTML = allActiveServices.length === 0
    ? `<span style="color:var(--muted);font-size:var(--fs-body);">No active services yet — add one from “New Service” below.</span>`
    : allActiveServices.map(s => s.simId
        // SIM badges open the manage modal (it stacks above this card overlay).
        ? `<button class="badge badge-${s.type}" style="font-size:var(--fs-small);padding:5px 12px;border:0;cursor:pointer;font-family:inherit;" onclick="openManageSimModal('${escHtml(String(s.simId))}')" title="Open this SIM plan">${escHtml(s.label)}</button>`
        : `<span class="badge badge-${s.type}" style="font-size:var(--fs-small);padding:5px 12px;">${escHtml(s.label)}</span>`).join('');

  // ── Trip bundle: the next flight as a unit — flight + phone + SIM + VN,
  // with what's missing flagged (travel-agent pattern).
  const today2 = localISO();
  const nextTrip = bookings
    .filter(b => b.customerId === c.id && b.status !== 'Cancelled' && b.travelDate && b.travelDate >= today2)
    .sort((a, b) => a.travelDate.localeCompare(b.travelDate))[0];
  let tripHtml = '';
  if (nextTrip) {
    const phoneCover = rentals.find(r => r.customerId === c.id && r.status !== 'returned' &&
      r.fromDate && r.toDate && r.fromDate <= nextTrip.travelDate && r.toDate >= nextTrip.travelDate);
    const simCover = sims.find(s => s.customerId === c.id && s.status === 'active');
    const vnCover = virtualNumbers.find(v => v.customerId === c.id && v.status === 'Active');
    const item = (ok, okLabel, missingLabel, fixHtml) => `
      <div style="display:flex;align-items:center;gap:8px;font-size:var(--fs-body);padding:4px 0;">
        <span>${ok ? '✅' : '⚠️'}</span>
        <span style="flex:1;">${ok ? okLabel : missingLabel}</span>
        ${!ok ? fixHtml : ''}
      </div>`;
    tripHtml = `
      <div class="section-divider">✈️ Next trip — ${escHtml(nextTrip.route)} on ${fmtDate(nextTrip.travelDate)}${nextTrip.departureTime ? ' · ' + escHtml(nextTrip.departureTime) : ''}</div>
      <div style="background:var(--bg-secondary);border-radius:10px;padding:10px 14px;margin-bottom:18px;">
        ${item(true, `Flight booked${nextTrip.airline ? ' — ' + escHtml(nextTrip.airline) : ''}${nextTrip.bookingReference ? ' (' + escHtml(nextTrip.bookingReference) + ')' : ''}`, '', '')}
        ${item(!!phoneCover,
          `Phone covered — ${phoneCover ? rentalDeviceChip(phoneCover) : ''} until ${fmtDate(phoneCover?.toDate)}`,
          'No rental phone covering the travel date',
          `<button class="btn btn-outline btn-sm" style="font-size:var(--fs-micro);padding:3px 10px;" onclick="openNewRentalModal('${c.id}')">📱 Book a phone</button>`)}
        ${item(!!simCover,
          `SIM plan active — ${escHtml(simCover?.provider || '')}`,
          'No active SIM plan',
          `<span style="color:var(--muted);font-size:var(--fs-micro);">add via SIM Plans tab</span>`)}
        ${item(!!vnCover,
          `Virtual number — ${escHtml(fmtPhone(vnCover?.number || ''))}`,
          'No virtual number (family cannot call locally)',
          `<button class="btn btn-outline btn-sm" style="font-size:var(--fs-micro);padding:3px 10px;" onclick="openNewVNModal('${c.id}')">🔢 Add a number</button>`)}
        ${item(nextTrip.hasPassportDetails,
          'Passport details on file',
          nextTrip.passportOnFile ? 'Passport marked on file — but no details entered' : 'Passport not on file',
          `<button class="btn btn-outline btn-sm" style="font-size:var(--fs-micro);padding:3px 10px;" onclick="openPassengersModal('${nextTrip.id}')">🛂 Add details</button>`)}
      </div>`;
  }

  // Notes + this customer's open reminders/tasks (Force E — the record was a
  // stub: notes weren't shown and reminders saved to the customer never
  // surfaced on the card).
  const notesHtml = c.notes ? `
      <div style="background:var(--bg-secondary);border-left:3px solid var(--gold);border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:var(--fs-body);color:var(--text);white-space:pre-wrap;">
        <span style="color:var(--muted);font-size:var(--fs-micro);display:block;margin-bottom:2px;">📝 Notes</span>${escHtml(c.notes)}
      </div>` : '';
  const custTasks = (tasksList || []).filter(t => t.customerId === c.id && !t.done)
    .sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')));
  const tasksHtml = custTasks.length ? `
      <div class="section-divider">⏰ Open reminders & tasks</div>
      <div style="margin-bottom:16px;">
        ${custTasks.slice(0, 6).map(t => `
          <div style="display:flex;align-items:center;gap:8px;font-size:var(--fs-body);padding:5px 0;border-bottom:1px solid var(--border);">
            <span>${t.priority === 'High' ? '🔴' : t.priority === 'Medium' ? '🟡' : '⚪'}</span>
            <span style="flex:1;min-width:0;">${escHtml(t.title || '')}</span>
            ${t.dueDate ? `<span style="color:var(--muted);font-size:var(--fs-micro);white-space:nowrap;">${fmtDate(t.dueDate)}</span>` : ''}
          </div>`).join('')}
      </div>` : '';

  // Full activity timeline (Customer 360). One row builder serves both the
  // card's folded history (no date column — the card is narrow) and the
  // page's Activity tab (with the date: a log without dates isn't a log).
  const timeline = buildCustomerTimeline(c);
  const catCounts = timeline.reduce((m, e) => (m[e.cat] = (m[e.cat] || 0) + 1, m), {});
  const timelineSummary = Object.entries(catCounts).map(([k, n]) => `${n} ${k.toLowerCase()}${n === 1 ? '' : 's'}`).join(' · ');
  const lifetimeSpend = timeline.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const timelineRow = (e, withDate) => `
        <div class="history-item${e.open ? ' dash-link' : ''}" style="align-items:flex-start;gap:8px;${e.open ? 'cursor:pointer;' : ''}"
          ${e.open ? `onclick="${e.open.fn}('${escHtml(String(e.open.id))}')" title="Open this ${escHtml(e.cat.toLowerCase())}"` : ''}>
          <span style="width:20px;flex-shrink:0;text-align:center;">${e.icon}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:var(--fs-body);color:var(--text);">${escHtml(e.title)}</div>
            <div style="font-size:var(--fs-micro);color:var(--muted);">${escHtml(e.cat)}${e.sub ? ' · ' + escHtml(e.sub) : ''}</div>
          </div>
          ${withDate && e.date ? `<span style="font-size:var(--fs-micro);color:var(--muted);white-space:nowrap;">${fmtDate(e.date)}</span>` : ''}
          ${e.amount ? `<span style="font-size:var(--fs-small);color:var(--muted);white-space:nowrap;">${fmtGbp(Number(e.amount))}</span>` : ''}
        </div>`;
  const timelineHtml = timeline.length === 0
    ? `<div style="color:var(--muted);font-size:var(--fs-body);padding:6px 0;">No activity yet.</div>`
    : timeline.map(e => timelineRow(e, false)).join('');

  const headerHtml = `
      <div class="detail-header">
        <div class="avatar">${initials}</div>
        <div class="detail-headline">
          <div class="detail-name">${nameHtml(`${c.firstName || ''} ${c.lastName || ''}`.trim())}${customerHasPassport(c) ? ' <span title="Passport on file" style="font-size:var(--fs-lead);">🛂</span>' : ''} <span class="lifecycle-chip" title="Relationship stage (auto)" style="color:${lifecycle.color};border:1px solid ${lifecycle.color};">${lifecycle.emoji} ${lifecycle.label}</span></div>
          <div class="detail-meta">${c.phone ? `<a href="tel:${escHtml(c.phone.replace(/\s/g, ''))}" style="color:inherit;text-decoration:none;border-bottom:1px dotted var(--muted);" title="Call">${escHtml(fmtPhone(c.phone))}</a>` : '—'}${waLink(c, '') ? ` <a href="${escHtml(waLink(c, `Hi ${c.firstName || 'there'},`))}" target="_blank" rel="noopener" title="Message on WhatsApp" aria-label="Message on WhatsApp" style="text-decoration:none;">💬</a>` : ''} · ✉️ ${c.email && !isOwnAccountEmail(c.email) ? `<a href="mailto:${escHtml(c.email)}" style="color:inherit;text-decoration:none;border-bottom:1px dotted var(--muted);" title="Email">${escHtml(c.email)}</a>` : escHtml(c.email || 'no contact email')}${c.accountEmail ? ` · <span title="Account/login email (Lebara etc.) — not the customer’s real contact address" style="color:var(--gold);">⚙️ ${escHtml(c.accountEmail)}</span>` : ''} ${addr} · Since ${since}</div>
        </div>
        <!-- Grouped by what the button DOES, not by the order they were added.
             Nine identical squares in a row made the operator read every icon
             every time; three small families are scannable. Reach them (talk
             to the customer) · Money (take payment) · Manage (my own admin).
             The groups are labelled for screen readers too, which a flat row
             could not be. -->
        <div class="card-tools">
          <span class="card-tool-group" role="group" aria-label="Contact this customer"><span class="card-tool-cap" aria-hidden="true">Contact</span>
            <button class="card-tool" onclick="openDraftReminderModal('${c.id}')" title="Draft a reminder message (does not send)" aria-label="Draft reminder">✉️</button>
            <button class="card-tool" onclick="openAiReplyModal('${c.id}')" title="Draft an AI reply to a customer message (does not send)" aria-label="AI reply">💬</button>
            <button class="card-tool" onclick="openLogCommModal('${c.id}')" title="Log a call or note" aria-label="Log call or note">📞</button>
          </span>
          <span class="card-tool-group" role="group" aria-label="Money"><span class="card-tool-cap" aria-hidden="true">Money</span>
            <button class="card-tool" onclick="chargeCardOnFile('${c.id}')" title="Charge the customer's saved card on file (Stripe)" aria-label="Charge saved card">💳</button>
            <button class="card-tool" onclick="openPaymentLinkModal('${c.id}')" title="Create a Stripe payment link tagged to this customer" aria-label="Create payment link">🔗</button>
          </span>
          <span class="card-tool-group" role="group" aria-label="Manage"><span class="card-tool-cap" aria-hidden="true">Manage</span>
            <button class="card-tool" onclick="openRemindModal('customer','${c.id}')" title="Remind me about this customer" aria-label="Set reminder">⏰</button>
            ${(!currentStaff || currentStaff.role === 'owner') ? `<button class="card-tool" onclick="openElidModal('${c.id}')" title="Look up this customer's ELID (telecom) balance & status" aria-label="ELID lookup">📡</button>` : ''}
            <button class="card-tool" onclick="openEditModal('${c.id}')" title="Edit customer" aria-label="Edit customer">✏️</button>
            ${isPage ? '' : `<button class="card-tool" onclick="openCustomerPage('${c.id}')" title="Open as a full page — own link, refresh-safe, shareable with a colleague" aria-label="Open full profile page">⤢</button>`}
          </span>
          ${isPage ? '' : `<button class="card-close" onclick="dismissCustomerCard()" title="Close" aria-label="Close">✕</button>`}
        </div>
      </div>`;

  const statsHtml = `
      <div class="detail-stats">
        <div class="detail-stat">
          <div class="detail-stat-label" id="cardBalanceLabel">Wallet balance</div>
          <div class="detail-stat-value" id="cardBalanceStat" style="color:var(--muted);">…</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-label">Active Rentals</div>
          <div class="detail-stat-value" style="color:var(--accent);">${cActiveRentals.length}</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-label">Virtual Numbers</div>
          <div class="detail-stat-value" style="color:var(--vn);">${activeVNs}</div>
        </div>
      </div>`;

  const overviewHtml = `
      <div id="nbaStrip-${c.id}"></div>
      ${tripHtml}
      ${notesHtml}
      ${tasksHtml}

      <div class="section-divider">Active Services</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px;">${servicesHTML}</div>

      <div class="section-divider">💰 Wallet</div>
      <div id="walletSection-${c.id}" style="margin-bottom:18px;">
        <div style="color:var(--muted);font-size:var(--fs-body);padding:6px 0;">Loading wallet…</div>
      </div>

      <div class="section-divider">📄 Documents</div>
      <div id="docsSection-${c.id}" style="margin-bottom:18px;">
        <div style="color:var(--muted);font-size:var(--fs-body);padding:6px 0;">Loading documents…</div>
      </div>`;

  const historyDetailsHtml = `
      <details style="margin-top:18px;margin-bottom:6px;">
        <summary style="cursor:pointer;font-weight:600;color:var(--text);font-size:var(--fs-body);padding:6px 0;border-top:1px solid var(--border);">
          📋 Full history — ${timeline.length} record${timeline.length === 1 ? '' : 's'}${lifetimeSpend > 0 ? ` · ${fmtGbp(lifetimeSpend)} lifetime` : ''}
          ${timelineSummary ? `<div style="font-weight:400;color:var(--muted);font-size:var(--fs-micro);margin-top:2px;">${escHtml(timelineSummary)}</div>` : ''}
        </summary>
        <div style="max-height:300px;overflow-y:auto;margin-top:8px;">${timelineHtml}</div>
      </details>`;

  const newServiceHtml = `
      <div class="section-divider" style="margin-top:18px;">New Service</div>
      <div class="card-action-grid">
        <button class="card-action" onclick="openNewRentalModal('${c.id}')"><span class="ca-icon">📱</span> Rental</button>
        <button class="card-action" onclick="openAddSimModal('${c.id}')"><span class="ca-icon">💳</span> SIM Plan</button>
        <button class="card-action" onclick="openNewBookingModal('${c.id}')"><span class="ca-icon">✈️</span> Flight</button>
        <button class="card-action" onclick="openNewVNModal('${c.id}')"><span class="ca-icon">🔢</span> Virtual number</button>
        <button class="card-action" onclick="(async()=>{repairMenu=await window.api.getServiceMenu('repair');openNewRepairModal('${c.id}')})()"><span class="ca-icon">🔧</span> Repair</button>
        <button class="card-action" onclick="openNewServiceModal('${c.id}')"><span class="ca-icon">🖨️</span> Print / Online</button>
      </div>`;

  if (!isPage) {
    return `
    <div class="detail-panel" id="detailPanel">
      ${headerHtml}
      ${statsHtml}
      ${overviewHtml}
      ${historyDetailsHtml}
      ${newServiceHtml}
    </div>`;
  }

  // ── Page mode: Overview | Activity sub-tabs under the stats row ──
  const onActivity = customerPageTab === 'activity';
  const subtabsHtml = `
      <div class="kc-subtabs" role="tablist" aria-label="Customer profile sections">
        <button class="kc-subtab${onActivity ? '' : ' on'}" role="tab" aria-selected="${!onActivity}" onclick="kcCustomerPageTab('overview')">Overview</button>
        <button class="kc-subtab${onActivity ? ' on' : ''}" role="tab" aria-selected="${onActivity}" onclick="kcCustomerPageTab('activity')">Activity <span class="n">${timeline.length}</span></button>
      </div>`;
  let bodyHtml;
  if (onActivity) {
    // The activity log unfolded: every record with its date, filterable by
    // category — the answer to "what have we ever done for this customer".
    const cats = Object.keys(catCounts);
    const cat = cats.includes(customerPageCat) ? customerPageCat : 'all';
    const shown = cat === 'all' ? timeline : timeline.filter(e => e.cat === cat);
    const chip = (key, label, n) => `<button class="kc-cat-chip${cat === key ? ' on' : ''}" onclick="kcCustomerPageCat('${escHtml(key)}')">${escHtml(label)} <span style="opacity:.7;">${n}</span></button>`;
    bodyHtml = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
        <div class="kc-cat-chips">${[chip('all', 'All', timeline.length), ...cats.map(k => chip(k, k, catCounts[k]))].join('')}</div>
        ${lifetimeSpend > 0 ? `<span style="font-size:var(--fs-small);color:var(--muted);white-space:nowrap;">${fmtGbp(lifetimeSpend)} lifetime</span>` : ''}
      </div>
      ${shown.length === 0
        ? `<div style="color:var(--muted);font-size:var(--fs-body);padding:6px 0;">No activity ${cat === 'all' ? 'yet' : 'in this category yet'}.</div>`
        : shown.map(e => timelineRow(e, true)).join('')}`;
  } else {
    bodyHtml = overviewHtml + newServiceHtml;
  }
  return `
    <div class="detail-panel kc-cpage" id="detailPanel">
      ${headerHtml}
      ${statsHtml}
      ${subtabsHtml}
      ${bodyHtml}
    </div>`;
}

function renderDetailPanel(id) {
  const c = customers.find(x => x.id === id);
  if (!c) return;
  // "Refresh the open customer" must repaint whichever surface is showing.
  // Every save handler calls this — when the full-page profile is up, repaint
  // that; never pop the card overlay over it.
  if (customerPageId === c.id) { renderCustomerPage(c.id); return; }
  const container = document.getElementById('detailPanelContainer');
  if (!container) return;

  // The card opens as a POP-UP over the page — a real "separate card", no
  // page scrolling. Its own overlay sits BELOW the action modals (New Rental,
  // Edit, …) so those stack on top of it. z-index 90 < the 100 of #dynamicModal
  // and #customerModal.
  let overlay = document.getElementById('customerCard');
  let wasOpen = false;
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'customerCard';
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '90';
    overlay.addEventListener('click', e => { if (e.target === overlay) dismissCustomerCard(); });
    document.body.appendChild(overlay);
  } else {
    wasOpen = !overlay.classList.contains('hidden');
  }
  // Named by the customer, so a screen reader announces WHOSE card opened.
  const cardName = `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Customer';
  overlay.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${escHtml(cardName)}" style="width:720px;max-width:94vw;max-height:90vh;overflow-y:auto;">${buildCustomerPanelHtml(c, 'card')}</div>`;
  // Save-handler repaints of the open card snap — only a fresh open animates
  // (innerHTML re-creates .modal, which would otherwise replay the enter).
  if (wasOpen) overlay.firstElementChild.style.animation = 'none';
  // Focus bookkeeping is gated on a FRESH open. renderDetailPanel is also the
  // repaint path — every save handler re-enters it — so doing this
  // unconditionally would overwrite the return-focus record mid-edit and yank
  // focus back to the card on every save.
  if (!wasOpen) kcSaveReturnFocus('customerCard');
  overlay.classList.remove('hidden');
  if (!wasOpen) {
    const card = overlay.firstElementChild;
    if (card) { card.setAttribute('tabindex', '-1'); card.focus({ preventScroll: true }); }
  }
  if (container) container.innerHTML = ''; // legacy inline container stays empty
  loadWalletSection(c.id);
  loadDocsSection(c.id);
}

// ─────────────────────────────────────────────
//  CUSTOMER-360 PAGE  (/customers/<id>)
// ─────────────────────────────────────────────
// The card's big brother (Stripe pattern): the same profile as a real page
// with its own URL — refresh-safe, shareable with another staff member,
// browser Back returns to wherever you came from — plus an Activity tab that
// unfolds the full timeline the card keeps inside a <details>.
function renderCustomerPage(id) {
  if (allowedTabs && !allowedTabs.includes('customers')) { renderTab(currentTab || 'dashboard'); return; }
  const main = document.getElementById('mainContent');
  if (!main) return;
  // Entering the page animates like a tab; repaints of the page already on
  // screen (sub-tab switch, filter chips, save handlers) are responses and
  // snap — replaying the fade would blink the whole column on every click.
  const entering = customerPageId !== id;
  if (entering) { customerPageTab = 'overview'; customerPageCat = 'all'; } // new customer, fresh tabs
  document.body.classList.remove('pos-mode');
  currentTab = 'customers';
  syncNavActive('customers');
  closeCustomerCard(); // the page replaces the overlay, never sits under it
  // Topbar chrome: profile title, no list search, no create button.
  document.getElementById('pageTitle').innerHTML = 'Customer <span>Profile</span>';
  const searchBox = document.getElementById('searchBox');
  if (searchBox) searchBox.style.display = 'none';
  const btnNew = document.getElementById('btnNewCustomer');
  if (btnNew) btnNew.style.display = 'none';
  tabPrimaryAction = null;
  const crumb = `<button class="kc-crumb" onclick="closeCustomerPage()">← All customers</button>`;
  if (entering) kcContentEnter(); // the profile page enters like any tab
  const c = customers.find(x => String(x.id) === String(id));
  if (!c) {
    customerPageId = null;
    main.innerHTML = `${crumb}
      <div class="detail-panel" style="text-align:center;padding:40px 20px;">
        <div style="font-size:var(--fs-hero);margin-bottom:8px;">👤</div>
        <div style="font-weight:500;margin-bottom:4px;">Customer not found</div>
        <div style="color:var(--muted);font-size:var(--fs-body);">This link may be old, or the record was merged or deleted.</div>
      </div>`;
    return;
  }
  customerPageId = c.id;
  selectedId = c.id; // ⌘K context verbs act on the profile being viewed
  main.innerHTML = crumb + buildCustomerPanelHtml(c, 'page');
  // The wallet fetch also fills the headline balance stat, so it runs on both
  // sub-tabs; the documents box only exists on Overview.
  loadWalletSection(c.id);
  if (customerPageTab !== 'activity') loadDocsSection(c.id);
}
function openCustomerPage(id) {
  closeCustomerCard(); // arriving from the card's ⤢ — the page takes over
  renderCustomerPage(id);
  pushCustomerUrl(id);
}
function closeCustomerPage() {
  renderTab('customers'); // clears customerPageId + selectedId itself
  pushTabUrl('customers');
}
function kcCustomerPageTab(t) {
  if (!customerPageId) return;
  customerPageTab = t;
  renderCustomerPage(customerPageId);
}
function kcCustomerPageCat(cat) {
  if (!customerPageId) return;
  customerPageCat = cat;
  renderCustomerPage(customerPageId);
}

// ── Customer documents (operator side) ─────────────────────────────────────
// Staff share files with a customer (visible in their portal) and review any
// files the customer uploaded back (which arrive as "pending"). Loaded lazily
// like the wallet section; degrades quietly if storage isn't configured.
async function loadDocsSection(custId) {
  const el = document.getElementById(`docsSection-${custId}`);
  if (!el) return;
  try {
    const r = await kcFetch(`/api/documents?customerId=${encodeURIComponent(custId)}`);
    const d = await r.json();
    if (!d.success) { el.innerHTML = `<div style="color:var(--muted);font-size:var(--fs-body);">${escHtml(d.error || 'Documents unavailable.')}</div>`; return; }
    renderDocsSection(custId, d.documents || []);
  } catch { el.innerHTML = `<div style="color:var(--muted);font-size:var(--fs-body);">Couldn’t load documents.</div>`; }
}
function renderDocsSection(custId, docs) {
  const el = document.getElementById(`docsSection-${custId}`);
  if (!el) return;
  const pending = docs.filter(d => d.source === 'customer' && d.status === 'pending');
  const others = docs.filter(d => !(d.source === 'customer' && d.status === 'pending'));
  const dl = (id) => `window.open('/api/documents/download?id=${encodeURIComponent(id)}','_blank')`;
  const row = (d) => `
    <div id="doc-row-${escHtml(d.id)}" style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:var(--fs-body);">
      <span style="flex:1;">${escHtml(d.filename)}
        <span style="color:var(--muted);font-size:var(--fs-micro);"> · ${d.source === 'customer' ? 'from customer' : 'shared'}${d.status !== 'published' ? ` · ${escHtml(d.status)}` : ''}${d.status === 'rejected' && d.note ? ` — “${escHtml(d.note)}”` : ''}</span></span>
      ${d.status === 'rejected' ? '' : `<button class="action-btn" title="Download" onclick="${dl(d.id)}">⬇︎</button>`}
      <button class="action-btn danger" title="Delete" onclick="deleteCustomerDoc('${custId}','${d.id}')">✕</button>
    </div>`;
  const pendingHtml = pending.length ? `
    <div style="background:rgba(245,158,11,0.10);border:1px solid rgba(245,158,11,0.3);border-radius:8px;padding:8px 10px;margin-bottom:8px;">
      <div style="font-size:var(--fs-micro);font-weight:600;color:var(--gold);text-transform:uppercase;letter-spacing:0.3px;margin-bottom:4px;">⏳ Customer uploads — awaiting review</div>
      ${pending.map(d => `
        <div style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:var(--fs-body);">
          <span style="flex:1;">${escHtml(d.filename)}</span>
          <button class="action-btn" title="View" onclick="${dl(d.id)}">👁</button>
          <button class="btn btn-primary btn-sm" style="font-size:var(--fs-micro);padding:3px 10px;" onclick="reviewCustomerDoc('${custId}','${d.id}','approve')">✓ Approve</button>
          <button class="btn btn-outline btn-sm" style="font-size:var(--fs-micro);padding:3px 10px;" onclick="reviewCustomerDoc('${custId}','${d.id}','reject')">Reject</button>
        </div>`).join('')}
    </div>` : '';
  const listHtml = others.length ? others.map(row).join('')
    : (pending.length ? '' : `<div style="color:var(--muted);font-size:var(--fs-body);padding:4px 0;">No documents yet.</div>`);
  el.innerHTML = pendingHtml + listHtml + `
    <div style="margin-top:10px;" id="docStage-${custId}">
      <input type="file" id="docUpload-${custId}" accept="image/*,application/pdf" style="display:none;" onchange="stageCustomerDoc('${custId}', this)">
      <button class="btn btn-outline btn-sm" onclick="document.getElementById('docUpload-${custId}').click()">⬆︎ Upload &amp; share</button>
      <span id="docMsg-${custId}" style="font-size:var(--fs-micro);color:var(--muted);margin-left:8px;"></span>
    </div>`;
}
// Picking a file only STAGES it — same contract as the customer's portal
// form: nothing uploads (and nothing is shared) until the explicit Share
// click. Owner-reported 08-04: staff side used to fire on file-pick.
const kcStagedDoc = {}; // custId → File awaiting the confirm click
function stageCustomerDoc(custId, input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  kcStagedDoc[custId] = file;
  const st = document.getElementById(`docStage-${custId}`);
  if (!st) return;
  st.innerHTML = `
    <span style="font-size:var(--fs-body);">${escHtml(file.name)}
      <span style="color:var(--muted);font-size:var(--fs-micro);"> · ${Math.max(1, Math.round(file.size / 1024))} KB</span></span>
    <button class="btn btn-primary btn-sm" style="margin-left:8px;" onclick="uploadCustomerDoc('${custId}')">✓ Share with customer</button>
    <button class="btn btn-outline btn-sm" onclick="delete kcStagedDoc['${custId}']; loadDocsSection('${custId}')">Cancel</button>
    <span id="docMsg-${custId}" style="font-size:var(--fs-micro);color:var(--muted);margin-left:8px;"></span>`;
}
async function uploadCustomerDoc(custId) {
  const file = kcStagedDoc[custId];
  if (!file) return;
  // Unstage while in flight (a double-click mustn't fire twice), but re-stage
  // on ANY failure — the '✓ Share' button is still on screen, and it must
  // retry rather than silently no-op on a file that's already gone.
  delete kcStagedDoc[custId];
  const msg = document.getElementById(`docMsg-${custId}`);
  if (msg) msg.textContent = 'Uploading…';
  try {
    const dataBase64 = await new Promise((res, rej) => {
      const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(file);
    });
    const r = await kcFetch('/api/documents', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: custId, filename: file.name, contentType: file.type, dataBase64 }),
    });
    const d = await r.json();
    if (!d.success) { kcStagedDoc[custId] = file; if (msg) msg.textContent = d.error || 'Upload failed — ✓ tries again.'; toast(d.error || 'Upload failed.', 'error'); }
    else { toast('Document shared ✔', 'success'); loadDocsSection(custId); }
  } catch { kcStagedDoc[custId] = file; if (msg) msg.textContent = 'Upload failed — ✓ tries again.'; }
}
async function reviewCustomerDoc(custId, id, action) {
  // A reject keeps the record and shows the customer why — the note lands in
  // their portal next to a "Not accepted" badge. Escape backs out entirely.
  let note;
  if (action === 'reject') {
    note = prompt('Why is it not accepted? This note shows in the customer’s portal (optional):');
    if (note === null) return;
    note = note.trim();
  }
  try {
    const r = await kcFetch('/api/documents/review', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, ...(note ? { note } : {}) }),
    });
    const d = await r.json();
    if (d.success) { toast(action === 'approve' ? 'Approved ✔' : 'Rejected — the customer sees this in their portal', 'success'); loadDocsSection(custId); }
    else toast(d.error || 'Failed.', 'error');
  } catch { toast('Failed.', 'error'); }
}
// Charge a customer's saved card-on-file off-session (owner action). The server
// requires a stored card and reports clearly when there isn't one, or when the
// bank needs the customer present to re-authorise (SCA).
// One idempotency token per (customer, amount), reused across retries until a
// charge confirms. The server turns clientRef into Stripe's Idempotency-Key, so
// a retry after an AMBIGUOUS failure (504 "status unknown") must carry the SAME
// token or Stripe treats it as a fresh charge and bills twice. Minting a new
// kcRef() each press was exactly that bug.
const cardChargeRefs = {};

async function chargeCardOnFile(custId) {
  const amtStr = prompt('Charge the card on file — amount in £:');
  if (amtStr == null) return;
  const amount = parseFloat(amtStr);
  if (!(amount > 0)) { toast('Enter a valid amount.', 'warning'); return; }
  const guardKey = 'chargecard:' + custId;
  if (!kcBeginWrite(guardKey)) return;
  const refKey = custId + ':' + amount.toFixed(2);
  if (!cardChargeRefs[refKey]) cardChargeRefs[refKey] = kcRef();
  const clientRef = cardChargeRefs[refKey];
  try {
    const r = await kcFetch('/api/charge-card', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: custId, amount, clientRef }),
    });
    const d = await r.json();
    if (d.success && d.status === 'succeeded') {
      // Confirmed charged — retire the token so a later, deliberate charge of the
      // same amount is a genuinely new operation with its own key.
      delete cardChargeRefs[refKey];
      toast(`Charged £${amount.toFixed(2)} to card on file ✔`, 'success'); loadWalletSection(custId);
    }
    // Processing or any failure: KEEP the token so a retry reuses it and Stripe
    // dedupes rather than double-charging.
    // Processing is an OUTCOME the operator has to follow up, not a status
    // flash — as a warning it now stays until dismissed, names where the answer
    // will appear, and the wallet is refreshed so a fast settlement shows.
    else if (d.success) {
      toast(d.note || 'Payment processing — the card issuer hasn’t answered yet. Check this customer’s wallet in a minute; don’t charge again.', 'warning');
      loadWalletSection(custId);
    }
    else toast(d.error || 'Charge failed.', 'error');
  } catch { toast('Charge failed.', 'error'); }
  finally { kcEndWrite(guardKey); }
}

// Create a Stripe payment link tagged to this customer, so when they pay it
// lands on their wallet automatically. Staff copy the link and send it by text
// or email (no message is sent from here). This is the tracked alternative to
// making a link in the Stripe dashboard.
function openPaymentLinkModal(custId) {
  const c = customers.find(x => x.id === custId);
  if (!c) return;
  showDynamicModal(`
    <div class="modal-title">🔗 Payment link — ${escName(c.firstName)} ${escName(c.lastName)}</div>
    <div style="font-size:var(--fs-small);color:var(--muted);margin-bottom:12px;">Creates a Stripe pay-by-card link tied to this customer. When they pay, it's credited to their wallet automatically. Copy it and send it however you message this customer.</div>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Amount (£)</label>
        <input class="form-input" id="plAmount" type="number" step="0.01" min="0.01" placeholder="0.00">
      </div>
      <div class="form-group">
        <label class="form-label">What it's for (optional)</label>
        <input class="form-input" id="plDesc" type="text" maxlength="120" placeholder="e.g. SIM top-up">
      </div>
    </div>
    <div class="form-group form-full" id="plResultWrap" style="display:none;">
      <label class="form-label">Payment link <span style="color:var(--muted);font-weight:400;">— copy &amp; send</span></label>
      <input class="form-input" id="plResult" readonly onclick="this.select()" style="font-family:monospace;font-size:var(--fs-small);">
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeDynamicModal()">Close</button>
      <button class="btn btn-outline" id="plGo" onclick="createPaymentLink('${escHtml(String(custId))}')">Create link</button>
      ${waLink(c, '') ? `<button class="btn btn-outline" id="plWa" style="display:none;" onclick="waPaymentLink('${escHtml(String(custId))}')">💬 Open in WhatsApp</button>` : ''}
      <button class="btn btn-primary" id="plCopy" style="display:none;" onclick="copyPaymentLink()">📋 Copy link</button>
    </div>
  `);
}
async function createPaymentLink(custId) {
  const amount = Number(document.getElementById('plAmount')?.value);
  if (!(amount > 0)) { toast('Enter an amount greater than £0.', 'error'); return; }
  const description = document.getElementById('plDesc')?.value || '';
  const guard = 'plink:' + custId;
  if (!kcBeginWrite(guard)) { toast('Already creating a link…', 'warning'); return; }
  const btn = document.getElementById('plGo');
  if (btn) { btn.disabled = true; btn.textContent = 'Creating…'; }
  try {
    const r = await kcFetch('/api/payment-link', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: custId, amount, description, clientRef: kcRef() }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.success) { toast(j.error || 'Could not create the link.', 'error'); return; }
    const out = document.getElementById('plResult'); if (out) out.value = j.url;
    const wrap = document.getElementById('plResultWrap'); if (wrap) wrap.style.display = '';
    const copy = document.getElementById('plCopy'); if (copy) copy.style.display = '';
    const wa = document.getElementById('plWa'); if (wa) wa.style.display = '';
    if (btn) btn.textContent = 'New link';
    recordComm(custId, { type: 'note', text: `Payment link created — ${fmtGbp(amount)}` });
  } catch {
    toast('Could not reach the payment-link service.', 'error');
  } finally {
    if (btn) { btn.disabled = false; if (btn.textContent === 'Creating…') btn.textContent = 'Create link'; }
    kcEndWrite(guard);
  }
}
async function copyPaymentLink() {
  const url = document.getElementById('plResult')?.value || '';
  if (!url) return;
  try { await navigator.clipboard.writeText(url); toast('Link copied — send it to the customer.', 'success'); }
  catch { toast('Select the link and copy it manually.', 'warning'); }
}
function waPaymentLink(custId) {
  const c = customers.find(x => x.id === custId);
  const link = document.getElementById('plResult')?.value || '';
  if (!c || !link) return;
  const desc = document.getElementById('plDesc')?.value.trim() || '';
  const text = `Hi ${c.firstName || 'there'}, here is your Kosher Connect payment link${desc ? ' for ' + desc : ''}: ${link}`;
  const url = waLink(c, text);
  if (!url) { toast('No usable phone number for WhatsApp.', 'warning'); return; }
  window.open(url, '_blank');
  recordComm(custId, { type: 'message', text: 'Payment link opened in WhatsApp' });
}

// Per-customer ELID (telecom switch) lookup — owner-only, read-only. Shows the
// customer's live ELID balance + account status. ELID has no link back to a KC
// customer, so staff confirm the ELID username once (prefilled from the name);
// the confirmed link is saved on the customer record (elidUsername, persisted
// via legacy_extras) so it's shared across staff and auto-loads next time.
function elidGuessUsername(c) { return `${c.firstName || ''}${c.lastName || ''}`.toLowerCase().replace(/[^a-z0-9]/g, ''); }
// All ELID lines linked to a customer — primary (elidUsername) first, then any
// extra lines (elidUsernames[]), deduped case-insensitively. A customer can
// hold several ELID accounts (e.g. a main line + a calling-card).
function elidLinesOf(c) {
  const seen = new Set(), out = [];
  for (const u of [c && c.elidUsername, ...((c && Array.isArray(c.elidUsernames)) ? c.elidUsernames : [])]) {
    const v = String(u || '').trim(); if (!v) continue;
    const k = v.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(v); }
  }
  return out;
}
async function elidPersistLines(c) {
  try { await window.api.updateCustomer({ id: c.id, elidUsername: c.elidUsername || '', elidUsernames: c.elidUsernames || [] }); } catch {}
}
function openElidModal(customerId) {
  const c = customers.find(x => x.id === customerId);
  if (!c) return;
  const guess = elidLinesOf(c).length ? '' : elidGuessUsername(c);
  const cid = escHtml(String(customerId));
  showDynamicModal(`
    <div class="modal-title">📡 ELID accounts — ${escName(c.firstName)} ${escName(c.lastName)}</div>
    <div style="font-size:var(--fs-small);color:var(--muted);margin-bottom:10px;">Live balance &amp; status on the ELID telecom switch. Read-only. A customer can have more than one line (e.g. a main line and a calling-card) — the ★ primary is summarised on the card.</div>
    <div id="elidLines"></div>
    <div style="display:flex;gap:8px;align-items:flex-end;margin-top:12px;">
      <div class="form-group form-full" style="flex:1;margin:0;">
        <label class="form-label">Add a line (ELID username)</label>
        <input class="form-input" id="elidUser" value="${escHtml(guess)}" placeholder="e.g. babbygrinfeld" onkeydown="if(event.key==='Enter')elidAddLine('${cid}')">
      </div>
      <button class="btn btn-primary" id="elidGo" onclick="elidAddLine('${cid}')">Add &amp; look up</button>
    </div>
    <div id="elidAddMsg" style="font-size:var(--fs-body);margin-top:6px;"></div>
    <div class="modal-actions"><button class="btn btn-outline" onclick="closeDynamicModal()">Close</button></div>
  `);
  renderElidLines(customerId);
}
function renderElidLines(customerId) {
  const c = customers.find(x => x.id === customerId);
  const wrap = document.getElementById('elidLines');
  if (!c || !wrap) return;
  const lines = elidLinesOf(c);
  if (!lines.length) { wrap.innerHTML = '<div style="color:var(--muted);font-size:var(--fs-body);">No ELID line linked yet — add one below.</div>'; return; }
  const cid = escHtml(String(customerId));
  wrap.innerHTML = lines.map((u, i) => `
    <div class="elid-line" data-u="${escHtml(u)}" style="border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <div style="min-width:0;"><code>${escHtml(u)}</code> ${i === 0
          ? '<span title="Primary — summarised on the customer card" style="color:var(--gold);font-size:var(--fs-micro);white-space:nowrap;">★ primary</span>'
          : `<button style="font-size:var(--fs-micro);background:none;border:0;color:var(--accent);cursor:pointer;padding:0;" onclick="elidSetPrimary('${cid}','${escHtml(u)}')">make primary</button>`}</div>
        <button class="card-tool" style="width:28px;height:28px;font-size:var(--fs-body);" title="Unlink this line" aria-label="Unlink line" onclick="elidRemoveLine('${cid}','${escHtml(u)}')">✕</button>
      </div>
      <div class="elid-bal" style="margin-top:8px;font-size:var(--fs-body);color:var(--muted);">Looking up…</div>
    </div>`).join('');
  lines.forEach(u => elidLoadLine(customerId, u));
}
async function elidLoadLine(customerId, u) {
  const wrap = document.getElementById('elidLines'); if (!wrap) return;
  const line = [...wrap.querySelectorAll('.elid-line')].find(el => el.getAttribute('data-u') === u);
  const cell = line && line.querySelector('.elid-bal'); if (!cell) return;
  try {
    const r = await kcFetch('/api/elid/user?username=' + encodeURIComponent(u));
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.success) { cell.innerHTML = `<span style="color:var(--danger-ink);">${escHtml(j.error || 'Lookup failed')}</span>`; return; }
    const a = j.account;
    const owes = (a.balance != null && a.balance < 0);
    const balTxt = a.balance == null ? '—' : `${owes ? '−' : ''}${fmtGbp(Math.abs(a.balance))}`;
    const balColor = a.balance == null ? 'var(--muted)' : owes ? 'var(--danger-ink)' : 'var(--success)';
    const status = a.blocked ? '<span style="color:var(--danger-ink);">Blocked</span>' : a.active ? '<span style="color:var(--success);">Active</span>' : 'Inactive';
    cell.innerHTML = `<span style="font-size:var(--fs-title);font-weight:700;color:${balColor};">${balTxt}</span> <span style="font-size:var(--fs-micro);color:var(--muted);">${a.balance == null ? '' : owes ? 'owing' : 'in credit'}</span> · ${status} · ${escHtml(a.account || '—')} · tariff ${escHtml(String(a.tariffId || '—'))} <span style="color:var(--muted);">· ELID #${escHtml(String(a.userid || '—'))}</span>`;
  } catch { cell.innerHTML = `<span style="color:var(--danger-ink);">Could not reach ELID.</span>`; }
}
async function elidAddLine(customerId) {
  const c = customers.find(x => x.id === customerId); if (!c) return;
  const input = document.getElementById('elidUser'); const uname = input && input.value.trim();
  const msg = document.getElementById('elidAddMsg');
  if (!uname) { toast('Enter an ELID username.', 'error'); return; }
  const btn = document.getElementById('elidGo'); if (btn) { btn.disabled = true; btn.textContent = '…'; }
  if (msg) msg.textContent = '';
  try {
    const r = await kcFetch('/api/elid/user?username=' + encodeURIComponent(uname));
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.success) { if (msg) msg.innerHTML = `<span style="color:var(--danger-ink);">${escHtml(j.error || 'That username was not found on ELID.')}</span>`; return; }
    const lines = elidLinesOf(c);
    if (lines.some(x => x.toLowerCase() === uname.toLowerCase())) { if (msg) msg.textContent = 'That line is already linked.'; }
    else {
      lines.push(uname);
      c.elidUsernames = lines;
      if (!c.elidUsername) c.elidUsername = lines[0];
      await elidPersistLines(c);
      if (input) input.value = '';
    }
    renderElidLines(customerId);
  } finally { if (btn) { btn.disabled = false; btn.textContent = 'Add & look up'; } }
}
async function elidSetPrimary(customerId, u) {
  const c = customers.find(x => x.id === customerId); if (!c) return;
  c.elidUsername = u;
  c.elidUsernames = elidLinesOf(c); // u now sorts first
  await elidPersistLines(c);
  renderElidLines(customerId);
}
async function elidRemoveLine(customerId, u) {
  const c = customers.find(x => x.id === customerId); if (!c) return;
  if (!confirm(`Unlink ELID account “${u}” from this customer? (The ELID account itself is untouched.)`)) return;
  const remaining = elidLinesOf(c).filter(x => x.toLowerCase() !== u.toLowerCase());
  c.elidUsernames = remaining;
  if (!c.elidUsername || c.elidUsername.toLowerCase() === u.toLowerCase()) c.elidUsername = remaining[0] || '';
  await elidPersistLines(c);
  renderElidLines(customerId);
}

// Bulk-link every customer to their ELID account by name (owner tool). The
// server only links when live ELID confirms the account and the name matches,
// so nothing is mislinked; unmatched customers are left alone. Runs in slices
// with a progress readout and can be stopped.
let elidMatchStop = false;
function openElidMatchModal() {
  elidMatchStop = false;
  showDynamicModal(`
    <div class="modal-title">🔗 Match customers to ELID</div>
    <div style="font-size:var(--fs-small);color:var(--muted);margin-bottom:12px;">Goes through every customer, guesses their ELID username from the name, and — <strong>only when ELID confirms the account and the name matches</strong> — saves the link on the customer. Read-only against ELID; nothing is mislinked and no new customers are created. Safe to stop anytime.</div>
    <div id="emProg" style="font-size:var(--fs-body);margin-bottom:8px;">Ready when you are.</div>
    <div id="emList" style="max-height:220px;overflow:auto;font-size:var(--fs-body);border:1px solid var(--border);border-radius:8px;padding:8px 10px;display:none;"></div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="elidMatchStop=true;closeDynamicModal()">Close</button>
      <button class="btn btn-primary" id="emGo" onclick="runElidMatch()">Start matching</button>
    </div>
  `);
}
async function runElidMatch() {
  const go = document.getElementById('emGo');
  const prog = document.getElementById('emProg');
  const list = document.getElementById('emList');
  if (go) { go.disabled = true; go.textContent = 'Matching…'; }
  elidMatchStop = false;
  let offset = 0, total = 0, matched = 0;
  const found = [];
  try {
    while (!elidMatchStop) {
      let j;
      try {
        const r = await kcFetch('/api/elid/match', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ offset, limit: 12 }) });
        j = await r.json().catch(() => ({}));
        if (!r.ok || !j.success) { if (prog) prog.textContent = j.error || 'Match failed.'; break; }
      } catch { if (prog) prog.textContent = 'Could not reach the server.'; break; }
      total = j.total; matched += j.matched;
      (j.linked || []).forEach((l) => {
        found.push(l);
        const cc = customers.find((x) => x.id === l.id);
        if (cc) cc.elidUsername = l.username; // reflect the new link in memory
      });
      offset = j.nextOffset;
      if (prog) prog.textContent = `Checked ${Math.min(offset, total)} of ${total} · linked ${matched}`;
      if (list && found.length) {
        list.style.display = '';
        list.innerHTML = found.slice(-250).map((l) =>
          `<div style="display:flex;justify-content:space-between;gap:10px;padding:3px 0;border-bottom:1px solid var(--border);">
            <span>${escHtml(l.name)} → <code>${escHtml(l.username)}</code></span>
            <span style="color:${l.balance != null && l.balance < 0 ? 'var(--danger-ink)' : 'var(--muted)'};">${l.balance != null ? fmtGbp(l.balance) : ''}</span>
          </div>`).join('');
      }
      if (j.done) break;
    }
    if (prog && !elidMatchStop) prog.textContent = `Done — linked ${matched} customer${matched === 1 ? '' : 's'} to ELID (checked ${total}).`;
    if (elidMatchStop && prog) prog.textContent = `Stopped — linked ${matched} so far.`;
  } finally {
    if (go) { go.disabled = false; go.textContent = elidMatchStop ? 'Resume' : 'Run again'; }
  }
}

// Import/review ELID accounts that aren't in KC yet (owner tool). Buckets the
// roster into already-linked, likely-existing (offer to LINK), and new (offer to
// CREATE). Creation pulls each account's real name live from ELID, so imported
// customers are named correctly; internal/test accounts are pre-unticked.
async function openElidImportModal() {
  showDynamicModal(`<div class="modal-title">📥 Import ELID accounts</div><div id="eiBody" style="font-size:var(--fs-body);color:var(--muted);">Loading ELID accounts…</div>`);
  try {
    const r = await kcFetch('/api/elid/accounts');
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.success) { const b = document.getElementById('eiBody'); if (b) b.innerHTML = escHtml(j.error || 'Could not load.'); return; }
    renderElidImport(j.accounts || []);
  } catch { const b = document.getElementById('eiBody'); if (b) b.textContent = 'Could not reach the server.'; }
}
// Levenshtein edit distance (small; for spelling-variant name matching).
function elidLev(a, b) {
  a = String(a); b = String(b);
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[n];
}
// Coarse phonetic key that collapses the common Heimishe transliteration
// variants (taitelbaum≈teitelbaum, ck≈k, tz≈ts, w≈v, ei≈ai≈i …) so the same
// person spelled two ways still lands on the same key.
function elidCanon(t) {
  let x = String(t).toLowerCase().replace(/[^a-z]/g, '');
  if (!x) return '';
  x = x.replace(/sch/g, 'sh').replace(/ck/g, 'k').replace(/ph/g, 'f')
    .replace(/tz/g, 'ts').replace(/th/g, 't').replace(/ch/g, 'k').replace(/sh/g, 's')
    .replace(/w/g, 'v').replace(/y/g, 'i')
    .replace(/ei|ie|ai|ay|ey|ee|ea/g, 'i').replace(/ou|oo|au|oi/g, 'o')
    .replace(/(.)\1+/g, '$1');
  return x;
}
// Tokens dropped before matching — titles, places, line-type words — so they
// don't count as (or block) a name match.
const ELID_NAME_STOP = new Set(['mr', 'mrs', 'reb', 'rav', 'harav', 'new', 'home', 'rental', 'rentals', 'phone', 'usa', 'us', 'uk', 'london', 'antwerp', 'manchester', 'mcr', 'playground', 'callingcard', 'callcard', 'zone', 'work', 'corner', 'company', 'test', 'kosher', 'connect']);
function elidToks(s) {
  return String(s || '').toLowerCase().split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !/^\d+$/.test(t) && !ELID_NAME_STOP.has(t));
}
function elidTokHit(u, c) {
  const uc = elidCanon(u), cc = elidCanon(c);
  if (!uc || !cc) return { hit: false, strong: false };
  const strong = uc === cc || (Math.min(uc.length, cc.length) >= 4 && elidLev(uc, cc) <= 1);
  const hit = strong || uc.startsWith(cc) || cc.startsWith(uc) ||
    (Math.min(uc.length, cc.length) >= 4 && elidLev(uc, cc) <= 2);
  return { hit, strong };
}
// Best fuzzy customer match for an ELID username, by token overlap. Requires two
// matching name tokens (or one strong single-token) so a shared first name alone
// never creates a false link. Returns { c, strong } or null.
function elidBestMatch(username, unlinked) {
  const uToks = elidToks(username);
  if (!uToks.length) return null;
  let best = null;
  for (const x of unlinked) {
    const cToks = elidToks(`${x.c.firstName} ${x.c.lastName}`);
    if (!cToks.length) continue;
    let matched = 0, strong = 0;
    for (const ut of uToks) {
      let hitAny = false, strongAny = false;
      for (const ct of cToks) { const r = elidTokHit(ut, ct); if (r.hit) hitAny = true; if (r.strong) strongAny = true; }
      if (hitAny) matched++;
      if (strongAny) strong++;
    }
    const ok = (uToks.length >= 2 && matched >= 2 && strong >= 1) || (uToks.length === 1 && strong >= 1);
    if (ok) { const score = strong * 10 + matched; if (!best || score > best.score) best = { c: x.c, score, strong }; }
  }
  return best;
}
function renderElidImport(accounts) {
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const linkedSet = new Set(customers.flatMap((c) => elidLinesOf(c)).map((u) => u.toLowerCase()));
  const unlinked = customers.filter((c) => !elidLinesOf(c).length).map((c) => ({ c, n: norm(`${c.firstName} ${c.lastName}`) })).filter((x) => x.n.length >= 3);
  const linked = [], exact = [], fuzzy = [], fresh = [];
  for (const a of accounts) {
    if (linkedSet.has(a.username.toLowerCase())) { linked.push(a); continue; }
    const nu = norm(a.username);
    const m = unlinked.find((x) => nu === x.n || nu.startsWith(x.n) || x.n.startsWith(nu));
    if (m) { exact.push({ ...a, match: m.c }); continue; }
    const fb = elidBestMatch(a.username, unlinked);
    if (fb) fuzzy.push({ ...a, match: fb.c }); else fresh.push(a);
  }
  const possible = exact.length + fuzzy.length;
  const linkRow = (a, checked, hint) =>
    `<label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:var(--fs-body);">
      <input type="checkbox" class="ei-link" data-u="${escHtml(a.username)}" data-cid="${escHtml(String(a.match.id))}" ${checked ? 'checked' : ''}>
      <span style="flex:1;"><code>${escHtml(a.username)}</code> → ${escName(a.match.firstName || '')} ${escName(a.match.lastName || '')}${hint ? ` <span style="color:var(--warning,#b7791f);font-size:var(--fs-micro);">${hint}</span>` : ''}</span>
    </label>`;
  const exactRows = exact.map((a) => linkRow(a, true, '')).join('');
  const fuzzyRows = fuzzy.map((a) => linkRow(a, false, 'similar — check')).join('');
  const possRows = (exactRows + fuzzyRows) || '<div style="color:var(--muted);font-size:var(--fs-small);">None.</div>';
  const freshRows = fresh.map((a) =>
    `<label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:var(--fs-body);">
      <input type="checkbox" class="ei-new" data-u="${escHtml(a.username)}" ${a.internal ? '' : 'checked'}>
      <span style="flex:1;">${escHtml(a.username)}</span>${a.internal ? '<span style="font-size:var(--fs-micro);color:var(--warning,#b7791f);">internal?</span>' : ''}
    </label>`).join('') || '<div style="color:var(--muted);font-size:var(--fs-small);">None — every new account is either linked or matched.</div>';
  showDynamicModal(`
    <div class="modal-title">📥 Import ELID accounts</div>
    <div style="font-size:var(--fs-small);color:var(--muted);margin-bottom:12px;">${linked.length} already linked · ${possible} likely existing (${exact.length} same spelling + ${fuzzy.length} similar) · ${fresh.length} new. Nothing happens until you press a button. Names for new customers are pulled live from ELID.</div>
    <div class="section-divider" style="margin:6px 0;">Likely already a customer — link instead <span style="color:var(--muted);font-weight:400;">(${possible})</span></div>
    <div style="font-size:var(--fs-small);color:var(--muted);margin:0 0 6px;">Exact matches are pre-ticked; “similar — check” are spelling-variant guesses left un-ticked — tick the ones that are really the same person.</div>
    <div style="max-height:150px;overflow:auto;">${possRows}</div>
    ${possible ? '<button class="btn btn-outline" style="margin:8px 0 14px;" onclick="applyElidLinks()">Link ticked</button>' : ''}
    <div class="section-divider" style="margin:6px 0;">New — create as customers <span style="color:var(--muted);font-weight:400;">(${fresh.length})</span></div>
    <div style="font-size:var(--fs-small);color:var(--muted);margin:0 0 6px;">Only tick genuine new people — untick anyone you spot who’s already a customer above.</div>
    <div style="max-height:190px;overflow:auto;">${freshRows}</div>
    <div id="eiResult" style="font-size:var(--fs-body);margin-top:8px;"></div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeDynamicModal()">Close</button>
      <button class="btn btn-primary" id="eiCreate" onclick="applyElidCreate()">Create ticked</button>
    </div>
  `);
}
async function applyElidLinks() {
  const boxes = [...document.querySelectorAll('.ei-link:checked')];
  if (!boxes.length) { toast('Tick some to link first.', 'warning'); return; }
  let n = 0;
  for (const b of boxes) {
    const u = b.getAttribute('data-u');
    const cc = customers.find((x) => String(x.id) === b.getAttribute('data-cid'));
    if (cc) {
      const lines = elidLinesOf(cc);
      if (!lines.some((x) => x.toLowerCase() === u.toLowerCase())) lines.push(u);
      cc.elidUsernames = lines;
      if (!cc.elidUsername) cc.elidUsername = lines[0]; // first link becomes primary; extra lines add on
      try { await window.api.updateCustomer({ id: cc.id, elidUsername: cc.elidUsername, elidUsernames: cc.elidUsernames }); n++; } catch {}
    }
    const lbl = b.closest('label'); if (lbl) lbl.style.opacity = '0.5';
  }
  toast(`Linked ${n} customer${n === 1 ? '' : 's'} to ELID.`, 'success');
}
async function applyElidCreate() {
  const boxes = [...document.querySelectorAll('.ei-new:checked')];
  if (!boxes.length) { toast('Tick some accounts to create first.', 'warning'); return; }
  const usernames = boxes.map((b) => b.getAttribute('data-u'));
  const btn = document.getElementById('eiCreate');
  const out = document.getElementById('eiResult');
  if (btn) { btn.disabled = true; btn.textContent = 'Creating…'; }
  let created = 0; const skipped = [];
  try {
    for (let i = 0; i < usernames.length; i += 20) {
      const chunk = usernames.slice(i, i + 20);
      const r = await kcFetch('/api/elid/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usernames: chunk }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.success) { if (out) out.innerHTML = `<span style="color:var(--danger-ink);">${escHtml(j.error || 'Import failed.')}</span>`; break; }
      created += (j.created || []).length;
      (j.skipped || []).forEach((s) => skipped.push(s));
      if (out) out.textContent = `Created ${created}${skipped.length ? ` · skipped ${skipped.length}` : ''}…`;
    }
    if (out) out.innerHTML = `Created <strong>${created}</strong> customer${created === 1 ? '' : 's'}${skipped.length ? ` · skipped ${skipped.length}` : ''}.`;
    try { const cs = await window.api.getAllCustomers(); if (Array.isArray(cs)) { customers.length = 0; customers.push(...cs); if (typeof renderTableRows === 'function') renderTableRows(); } } catch {}
    toast(`Imported ${created} customer${created === 1 ? '' : 's'} from ELID.`, 'success');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Create ticked'; }
  }
}

// Open a customer's card by id from anywhere (e.g. the duplicate scanner).
function openCustomerById(id) {
  closeDynamicModal();
  goToTab('customers');
  selectedId = id;
  setTimeout(() => {
    renderDetailPanel(id);
    document.querySelectorAll('tr[data-id]').forEach((r) => r.classList.toggle('selected', r.dataset.id === id));
  }, 60);
}

// Duplicate-customer scanner (owner tool). Fuzzy-matches the ELID-imported
// customers against the whole book and lists likely-duplicate pairs to review.
// Read-only — nothing merges; click a name to open that customer.
async function openDupScanModal() {
  showDynamicModal(`<div class="modal-title">👥 Find duplicate customers</div><div id="dupBody" style="font-size:var(--fs-body);color:var(--muted);">Scanning the ELID-imported customers against the whole book…</div>`);
  try {
    const r = await kcFetch('/api/customers/duplicates');
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.success) { const b = document.getElementById('dupBody'); if (b) b.innerHTML = escHtml(j.error || 'Could not scan.'); return; }
    renderDupScan(j);
  } catch { const b = document.getElementById('dupBody'); if (b) b.textContent = 'Could not reach the server.'; }
}
function renderDupScan(j) {
  const tag = (x) => `${escHtml(x.name)}`
    + (x.imported ? ' <span style="font-size:var(--fs-micro);color:var(--gold);">ELID-new</span>' : '')
    + (x.elid && x.elid.length ? ` <span style="font-size:var(--fs-micro);color:var(--muted);">📡${x.elid.length}</span>` : '')
    + (x.phone ? ` <span style="font-size:var(--fs-micro);color:var(--muted);">${escHtml(x.phone)}</span>` : '');
  const mBtn = (from, to, label) =>
    `<button style="font-size:var(--fs-small);background:none;border:1px solid var(--border);border-radius:999px;padding:3px 10px;color:var(--accent);cursor:pointer;" onclick="mergeElidDup('${escHtml(from)}','${escHtml(to)}')">${label}</button>`;
  const rows = (j.pairs || []).map((p) => {
    // Only an ELID-import can be the one deleted. Offer to keep the non-import
    // side; if both are imports, let the owner choose which to keep.
    let merge = '';
    if (p.a.imported && p.b.imported) {
      merge = `${mBtn(p.b.id, p.a.id, '⌫ merge → keep ' + escHtml(p.a.name))} ${mBtn(p.a.id, p.b.id, '⌫ merge → keep ' + escHtml(p.b.name))}`;
    } else if (p.a.imported) {
      merge = mBtn(p.a.id, p.b.id, '⌫ merge → keep ' + escHtml(p.b.name));
    } else if (p.b.imported) {
      merge = mBtn(p.b.id, p.a.id, '⌫ merge → keep ' + escHtml(p.a.name));
    }
    return `<div style="padding:8px 0;border-bottom:1px solid var(--border);">
      <div style="display:flex;align-items:center;gap:8px;font-size:var(--fs-body);">
        <button style="flex:1;text-align:start;background:none;border:0;color:var(--accent);cursor:pointer;padding:0;" onclick="openCustomerById('${escHtml(p.a.id)}')">${tag(p.a)}</button>
        <span style="color:var(--muted);">⇄</span>
        <button style="flex:1;text-align:start;background:none;border:0;color:var(--accent);cursor:pointer;padding:0;" onclick="openCustomerById('${escHtml(p.b.id)}')">${tag(p.b)}</button>
      </div>
      ${merge ? `<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;">${merge}</div>` : ''}
    </div>`;
  }).join('') || '<div style="color:var(--success);font-size:var(--fs-body);">No likely duplicates found. 🎉</div>';
  showDynamicModal(`
    <div class="modal-title">👥 Find duplicate customers</div>
    <div style="font-size:var(--fs-small);color:var(--muted);margin-bottom:10px;">${j.count} possible duplicate pair${j.count === 1 ? '' : 's'} among the ${j.seeds} ELID-imported customers. Click a name to open the customer. <strong>Merge</strong> moves the ELID line onto the record you keep and deletes the empty import — only offered when one side is an ELID import, and never for a record with money history.</div>
    <div style="max-height:360px;overflow:auto;">${rows}</div>
    <div class="modal-actions"><button class="btn btn-outline" onclick="closeDynamicModal()">Close</button></div>
  `);
}
async function mergeElidDup(fromId, toId) {
  if (!confirm('Merge these two? The ELID import will be deleted and its ELID line(s) moved onto the customer you keep.')) return;
  try {
    const r = await kcFetch('/api/customers/merge-elid', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fromId, toId }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.success) { toast(j.error || 'Merge failed.', 'error'); return; }
    const fi = customers.findIndex((c) => String(c.id) === String(fromId));
    if (fi >= 0) customers.splice(fi, 1);
    const to = customers.find((c) => String(c.id) === String(toId));
    if (to && j.kept) { to.elidUsernames = j.kept.elid || to.elidUsernames; to.elidUsername = (j.kept.elid || [])[0] || to.elidUsername; }
    toast(`Merged — kept ${j.kept?.name || 'customer'}.`, 'success');
    if (typeof renderTableRows === 'function') renderTableRows();
    openDupScanModal(); // refresh the list (merged pair drops out)
  } catch { toast('Could not reach the server.', 'error'); }
}

async function deleteCustomerDoc(custId, id) {
  // Undo-toast instead of a confirm dialog: hide the row immediately, hold the
  // server delete for the undo window (kcUndoable).
  const row = document.getElementById(`doc-row-${id}`);
  if (row) row.style.display = 'none';
  kcUndoable({
    label: 'Document deleted.',
    restore: () => { if (row) row.style.display = ''; },
    commit: async () => {
      try {
        const r = await kcFetch(`/api/documents?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        const d = await r.json();
        if (!d.success) { toast(d.error || 'Delete failed.', 'error'); loadDocsSection(custId); }
      } catch { toast('Delete failed.', 'error'); loadDocsSection(custId); }
    },
  });
}

function closeCustomerCard() {
  const overlay = document.getElementById('customerCard');
  if (overlay) overlay.classList.add('hidden');
  // Hand focus back to whatever opened the card — usually the table row.
  kcRestoreReturnFocus('customerCard');
}

// Always closes, whatever the selection state (✕ button + backdrop click).
function dismissCustomerCard() {
  selectedId = null;
  closeCustomerCard();
  document.querySelectorAll('tr.selected').forEach(r => r.classList.remove('selected'));
}

// ─────────────────────────────────────────────
//  WALLET (append-only ledger; balance always derived)
// ─────────────────────────────────────────────

// Last-loaded ledger per customer, so the per-row ✉️ receipt buttons can
// rebuild the entry they belong to at click time.
const walletEntriesCache = {};

const LEDGER_TYPE_LABELS = {
  payment: '💷 Payment', top_up: '➕ Top-up', refund: '↩️ Refund',
  refund_payout: '↩️ Refund paid out',
  manual_adjustment: '✏️ Adjustment', booking: '✈️ Flight', rental: '📱 Rental',
  rental_adjustment: '📱 Rental adj.', rental_loss: '📱 Loss', rental_void: '📱 Void credit',
  repair: '🔧 Repair', online_service: '🖨️ Service', sim_annual: '💳 SIM annual',
  sim_additional: '💳 SIM extra', sim_replacement: '💳 SIM replacement',
  sim_service: '💳 SIM service', phone_sale: '📦 Phone sale', stock_sale: '📦 Sale',
  virtual_number: '🔢 Virtual number', extra_charge: '➕ Extra charge',
};

async function loadWalletSection(customerId) {
  const el = document.getElementById(`walletSection-${customerId}`);
  // The page's Activity tab has no wallet box, but the headline balance stat
  // above the sub-tabs still renders — fetch and fill that even without it.
  if (!el && !(customerPageId === customerId && document.getElementById('cardBalanceStat'))) return;
  let data;
  try { data = await window.api.getLedger(customerId); }
  catch { data = null; }
  if (!data || !data.success) {
    if (el) el.innerHTML = `<div style="color:var(--muted);font-size:var(--fs-small);">Wallet unavailable${data?.error ? ' — ' + escHtml(data.error) : ''}.</div>`;
    return;
  }
  const bal = data.balance || 0;
  const balColor = bal < 0 ? 'var(--danger-ink)' : 'var(--success)';
  const balLabel = bal < 0 ? `owes ${fmtGbp(Math.abs(bal))}` : `${fmtGbp(bal)} in credit`;
  // #7/#16/#70 — the card headline used to show a rental-only "Total Debt"
  // that contradicted this true ledger balance. Fill the headline stat from
  // the ledger (all services), so the two figures can't disagree.
  const stat = document.getElementById('cardBalanceStat');
  const statLbl = document.getElementById('cardBalanceLabel');
  if (stat) {
    stat.textContent = bal < 0 ? `−${fmtGbp(Math.abs(bal))}` : `${fmtGbp(bal)}`;
    stat.style.color = bal < 0 ? 'var(--danger-ink)' : bal > 0 ? 'var(--success)' : 'var(--muted)';
  }
  if (statLbl) statLbl.textContent = bal < 0 ? 'Owes (wallet)' : bal > 0 ? 'In credit' : 'Wallet balance';
  // Receiptable rows get an ✉️ action: sales re-send an itemised receipt,
  // payments/top-ups a payment confirmation — so a receipt can be issued (or
  // re-issued) any time from the card, not only in the moment on the till.
  walletEntriesCache[customerId] = { entries: data.entries, balance: bal };
  if (!el) return; // Activity tab: headline stat filled — no wallet box on screen
  const RECEIPTABLE = { phone_sale: 'sale', stock_sale: 'sale', payment: 'payment', top_up: 'payment' };
  const entriesHtml = data.entries.length === 0
    ? `<div style="color:var(--muted);font-size:var(--fs-body);padding:6px 0;">No wallet activity yet — record a payment or charge to start the ledger.</div>`
    : data.entries.slice(0, 8).map((e, i) => `
        <div class="history-item">
          <div class="history-main">
            <div class="history-dot ${e.amount >= 0 ? 'dot-green' : 'dot-blue'}"></div>
            <div class="history-desc">${LEDGER_TYPE_LABELS[e.type] || escHtml(e.type)}${e.description ? ' · ' + escHtml(e.description) : ''}</div>
          </div>
          <div class="history-date" style="margin:0 16px;">${fmtDate(e.at)}</div>
          <div class="history-amount" style="color:${e.amount >= 0 ? 'var(--success)' : 'var(--danger-ink)'};">
            ${e.amount >= 0 ? '+' : '−'}${fmtGbp(Math.abs(e.amount))}</div>
          ${RECEIPTABLE[e.type] && Math.abs(e.amount) >= 0.005 ? `<button class="btn btn-secondary" style="font-size:var(--fs-micro);padding:3px 8px;margin-left:10px;"
            title="Email a receipt for this entry" onclick="emailLedgerReceipt(this, '${escHtml(customerId)}', ${i})">✉️</button>` : ''}
          ${e.type === 'payment' && e.method === 'card' && typeof e.reference === 'string' && /^STRIPE-pi_/.test(e.reference) ? `<button class="btn btn-secondary" style="font-size:var(--fs-micro);padding:3px 8px;margin-left:6px;"
            title="Refund this card payment back to the card" onclick="openRefundModal('${escHtml(customerId)}', ${i})">↩️ Refund</button>` : ''}
        </div>`).join('');

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;flex-wrap:wrap;">
      <span class="badge" style="font-size:var(--fs-ui);padding:7px 16px;white-space:nowrap;background:${bal < 0 ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)'};color:${balColor};">
        Balance: ${balLabel}</span>
      <button class="btn btn-primary" style="font-size:var(--fs-small);padding:6px 14px;"
        onclick="openWalletModal('${escHtml(customerId)}', ${Number(bal) || 0})">💰 Record payment / credit</button>
      ${data.entries.length > 8 ? `<span style="color:var(--muted);font-size:var(--fs-micro);">showing 8 of ${data.entries.length}</span>` : ''}
    </div>
    <div class="history-list">${entriesHtml}</div>`;
  renderNextBestAction(customerId, bal);
}

// Email a receipt for one ledger entry from the customer card. Sales send the
// itemised 'sale' template (one line rebuilt from the entry's description);
// payments/top-ups send the 'payment' confirmation with the current balance.
// The server decides the destination (email on file) and the HOLD/TEST/LIVE
// gate — this is only a trigger, same as the till button.
async function emailLedgerReceipt(btn, customerId, idx) {
  const cached = walletEntriesCache[customerId];
  const e = cached && cached.entries ? cached.entries[idx] : null;
  if (!e) { toast('Reload the card and try again.', 'error'); return; }
  const abs = Math.abs(Number(e.amount) || 0);
  const body = e.type === 'payment' || e.type === 'top_up'
    ? { kind: 'payment', customerId, amount: abs, method: e.method || null, note: e.description || null, balance: cached.balance }
    : { kind: 'sale', customerId, lines: [{ name: e.description || 'Purchase', qty: 1, total: abs }], total: abs, method: e.method || null };
  // Confirm before sending. This leaves the building the moment it is clicked
  // and cannot be recalled, so it gets the same "are you sure?" as anything
  // that touches a customer's money — and it names the recipient, because the
  // mistake worth catching is the right receipt sent to the wrong person.
  const cust = customers.find(x => x.id === customerId);
  const to = (cust && cust.email) || '';
  // isOwnAccountEmail: some rows carry OUR provider login (Lebara etc.) in the
  // email field rather than the customer's own address. Sending a customer
  // receipt there mails it to the shop, so say so plainly in the dialog.
  const ours = to && isOwnAccountEmail(to);
  if (!(await kcConfirm({
    title: '✉️ Email this receipt?',
    body: `Sends a receipt for <strong>${escHtml(e.description || e.type)}</strong> to ${
      to ? `<strong>${escHtml(to)}</strong>` : 'the address on this customer’s record'
    }.${ours ? ' <strong style="color:var(--gold);">That is a shop account login, not the customer’s own address.</strong>' : ''} An email cannot be unsent.`,
    okLabel: 'Send receipt',
    amount: abs,
  }))) return;
  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  const res = await kcFetch('/api/email', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then(r => r.json()).catch(() => null);
  if (res && res.success && res.held) {
    toast(res.note || 'Email is on hold — receipt not sent.', 'warning');
    if (btn) { btn.disabled = false; btn.textContent = '✉️'; }
  } else if (res && res.success && res.redirected) {
    toast(res.note || `Test mode — sent to ${res.sentTo}.`, 'warning');
    if (btn) btn.textContent = '✅';
  } else if (res && res.success) {
    toast(`Receipt emailed to ${res.sentTo}.`, 'success');
    recordComm(customerId, { type: 'email', text: `Receipt emailed — ${fmtGbp(abs)} ${e.type}` });
    if (btn) btn.textContent = '✅';
  } else {
    toast(res?.error || 'Could not send the receipt.', 'error');
    if (btn) { btn.disabled = false; btn.textContent = '✉️'; }
  }
}

// Refund a card payment back to the card (owner-only server-side). Reverses the
// wallet credit the payment made. Full by default; the amount can be trimmed for
// a partial refund. Opens from the ↩️ on a card-payment wallet row.
function openRefundModal(customerId, idx) {
  const cached = walletEntriesCache[customerId];
  const e = cached && cached.entries ? cached.entries[idx] : null;
  if (!e || !/^STRIPE-pi_/.test(e.reference || '')) { toast('Reload the card and try again.', 'error'); return; }
  const max = Math.abs(Number(e.amount) || 0);
  showDynamicModal(`
    <div class="modal-title">↩️ Refund card payment</div>
    <div style="font-size:var(--fs-small);color:var(--muted);margin-bottom:12px;">Refunds money back to the customer's card via Stripe and removes the matching wallet credit. Original payment: <strong>${fmtGbp(max)}</strong>${e.description ? ' · ' + escHtml(e.description) : ''}.</div>
    <div class="form-group form-full">
      <label class="form-label">Amount to refund</label>
      <input class="form-input" id="rfAmount" type="number" step="0.01" min="0.01" max="${max}" value="${max.toFixed(2)}">
      <span style="font-size:var(--fs-micro);color:var(--muted);">Up to ${fmtGbp(max)}. Leave as-is for a full refund.</span>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeDynamicModal()">Cancel</button>
      <button class="btn btn-primary" id="rfGo" onclick="submitRefund('${escHtml(String(customerId))}', ${idx})">Refund to card</button>
    </div>
  `);
}
async function submitRefund(customerId, idx) {
  const cached = walletEntriesCache[customerId];
  const e = cached && cached.entries ? cached.entries[idx] : null;
  if (!e) { toast('Reload the card and try again.', 'error'); return; }
  const max = Math.abs(Number(e.amount) || 0);
  const amount = Number(document.getElementById('rfAmount')?.value);
  if (!(amount > 0) || amount > max + 0.005) { toast(`Enter an amount between £0 and ${fmtGbp(max)}.`, 'error'); return; }
  const guard = `refund-${e.reference}`;
  if (!kcBeginWrite(guard)) { toast('Refund already in progress.', 'warning'); return; }
  const btn = document.getElementById('rfGo');
  if (btn) { btn.disabled = true; btn.textContent = 'Refunding…'; }
  try {
    const r = await kcFetch('/api/refund-card', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, reference: e.reference, amount, clientRef: kcRef() }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.success) { toast(j.error || 'Refund failed.', 'error'); if (btn) { btn.disabled = false; btn.textContent = 'Refund to card'; } return; }
    toast(`Refunded ${fmtGbp(j.amount || amount)} to the card.`, 'success');
    recordComm(customerId, { type: 'note', text: `Card refund ${fmtGbp(j.amount || amount)}` });
    closeDynamicModal();
    loadWalletSection(customerId);
  } catch {
    toast('Could not reach the refund service.', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Refund to card'; }
  } finally {
    kcEndWrite(guard);
  }
}

// #82 — paint the "next best action" strip once the true balance is known.
function renderNextBestAction(customerId, balance) {
  const strip = document.getElementById(`nbaStrip-${customerId}`);
  if (!strip) return;
  const c = customers.find(x => x.id === customerId);
  if (!c) { strip.innerHTML = ''; return; }
  const nba = customerNextBestAction(c, balance);
  if (!nba) { strip.innerHTML = ''; return; }
  strip.innerHTML = `
    <div class="nba-strip">
      <span class="nba-icon">${nba.icon}</span>
      <span class="nba-text">${nba.text}</span>
      ${nba.btn || ''}
    </div>`;
}

// #60 — communication log. A shared writer appends to c.commLog so both the
// manual "log a call/note" button and auto events (a sent receipt) land on the
// same customer timeline.
const COMM_ICONS = { call_in: '📞', call_out: '📲', message: '💬', note: '📝', email: '✉️' };
function logComm(c, { type, text, icon }) {
  if (!c.commLog) c.commLog = [];
  c.commLog.push({
    at: new Date().toISOString(), type: type || 'note', text: text || '',
    icon: icon || COMM_ICONS[type] || '💬',
    by: (currentStaff && (currentStaff.full_name || currentStaff.email)) || 'staff',
  });
}
async function recordComm(customerId, entry) {
  const c = customers.find(x => x.id === customerId);
  if (!c) return;
  logComm(c, entry);
  await window.api.updateCustomer(c).catch(() => null);
  const idx = customers.findIndex(x => x.id === customerId);
  if (idx !== -1) customers[idx] = c;
  if (selectedId === customerId) renderDetailPanel(customerId);
}
function openLogCommModal(customerId) {
  const c = customers.find(x => x.id === customerId);
  showDynamicModal(`
    <div class="modal-title">📞 Log a call / note${c ? ' — ' + escName(c.firstName) + ' ' + escName(c.lastName) : ''}</div>
    <div class="form-grid">
      <div class="form-group form-full">
        <label class="form-label">Type</label>
        <select class="form-input" id="clType">
          <option value="call_in">📞 Call — incoming</option>
          <option value="call_out">📲 Call — outgoing</option>
          <option value="message">💬 Message${WHATSAPP_ENABLED ? ' (WhatsApp / SMS)' : ' (SMS)'}</option>
          <option value="note">📝 Note</option>
        </select>
      </div>
      <div class="form-group form-full">
        <label class="form-label">What happened</label>
        <textarea class="form-input" id="clText" rows="3" placeholder="e.g. Called about the overdue phone — will return Sunday"></textarea>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeDynamicModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveCommLog('${escHtml(String(customerId))}')">Save to timeline</button>
    </div>
  `);
}
async function saveCommLog(customerId) {
  const text = document.getElementById('clText')?.value.trim();
  if (!text) { toast('Add a short note first.', 'error'); return; }
  const type = document.getElementById('clType')?.value || 'note';
  await recordComm(customerId, { type, text });
  closeDynamicModal();
  toast('Logged to the customer timeline.', 'success');
}

// #27 — customer-facing reminders, drafted not sent. The daily sweep already
// knows who to chase; this composes the actual message (balance due, phone
// overdue, SIM renewing, flight soon) so staff can copy it into whatever
// channel they use. It deliberately never emails — real addresses stay
// untouched until the owner turns sending on.
function buildReminderDraft(c) {
  const today = localISO();
  const lines = [`Hi ${c.firstName || 'there'},`, ''];
  let any = false;
  const owed = customerOwed(c);
  if (owed > 0) { lines.push(`Our records show an outstanding balance of ${fmtGbp(owed)} on your account. This balance is now due — please arrange payment within 7 days, either in store, by bank transfer, or through your online account. If payment has already been made, or you'd like to discuss the balance, please contact us right away.`); any = true; }
  const overdue = rentals.filter(r => r.customerId === c.id && r.status === 'overdue');
  for (const r of overdue) { lines.push(`Your rental phone ${r.phoneNumber || ''} was due back on ${fmtDate(r.toDate)} — please return it to avoid extra charges.`); any = true; }
  const soon = localISO(new Date(Date.now() + 7 * 86400000));
  for (const s of sims.filter(s => s.customerId === c.id && s.status === 'active' && s.renewalDate && s.renewalDate >= today && s.renewalDate <= soon)) {
    lines.push(`Your SIM plan${s.provider ? ' (' + s.provider + ')' : ''} renews on ${fmtDate(s.renewalDate)}.`); any = true;
  }
  for (const b of customerUpcomingBookings(c).filter(b => b.travelDate && b.travelDate >= today && b.travelDate <= soon)) {
    lines.push(`Reminder: your flight ${b.route || ''} is on ${fmtDate(b.travelDate)}.`); any = true;
  }
  if (!any) lines.push(`Just checking in — let us know if you need anything.`);
  lines.push('', 'Thank you,', 'Kosher Connect');
  return lines.join('\n');
}
function openDraftReminderModal(customerId) {
  const c = customers.find(x => x.id === customerId);
  if (!c) return;
  const draft = buildReminderDraft(c);
  showDynamicModal(`
    <div class="modal-title">✉️ Draft reminder — ${escName(c.firstName)} ${escName(c.lastName)}</div>
    <div style="font-size:var(--fs-small);color:var(--muted);margin-bottom:10px;">Built from what this customer currently owes / has coming up. Edit it, then copy — <strong>nothing is sent</strong>.</div>
    <textarea class="form-input" id="drText" rows="9" style="font-family:inherit;">${escHtml(draft)}</textarea>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeDynamicModal()">Close</button>
      ${waLink(c, '') ? `<button class="btn btn-outline" onclick="waReminderDraft('${escHtml(String(customerId))}')">💬 Open in WhatsApp</button>` : ''}
      <button class="btn btn-primary" onclick="copyReminderDraft('${escHtml(String(customerId))}')">📋 Copy message</button>
    </div>
  `);
}
async function copyReminderDraft(customerId) {
  const text = document.getElementById('drText')?.value || '';
  try { await navigator.clipboard.writeText(text); toast('Message copied — paste it wherever you message this customer.', 'success'); }
  catch { toast('Select the text and copy it manually.', 'warning'); return; }
  // Log that a reminder was drafted/copied, so the timeline shows the contact.
  recordComm(customerId, { type: 'message', text: 'Reminder drafted & copied' });
  closeDynamicModal();
}
function waReminderDraft(customerId) {
  const c = customers.find(x => x.id === customerId);
  const text = document.getElementById('drText')?.value || '';
  const url = c && waLink(c, text);
  if (!url) { toast('No usable phone number for WhatsApp.', 'warning'); return; }
  window.open(url, '_blank');
  recordComm(customerId, { type: 'message', text: 'Reminder drafted — opened in WhatsApp' });
  closeDynamicModal();
}
// One-tap chase from a task card: the standard reminder draft (balance owed,
// overdue phone…) straight into a WhatsApp compose window.
function waChaseCustomer(customerId) {
  const c = customers.find(x => x.id === customerId);
  if (!c) return;
  const url = waLink(c, buildReminderDraft(c));
  if (!url) { toast('No usable phone number for WhatsApp.', 'warning'); return; }
  window.open(url, '_blank');
  recordComm(customerId, { type: 'message', text: 'Chase message opened in WhatsApp' });
}

// AI reply drafter — staff paste what a customer wrote; Gemini drafts a reply in
// the shop's voice, informed by the same live account facts the reminder builder
// uses. Nothing is sent — the draft is for staff to read, edit and copy. The
// message text goes to Google (same privacy note as the AI Scan Reader).
function customerContextForAi(c) {
  const today = localISO();
  const soon = localISO(new Date(Date.now() + 7 * 86400000));
  const lines = [];
  const owed = customerOwed(c);
  if (owed > 0.005) lines.push(`Outstanding balance owed to the shop: ${fmtGbp(owed)}.`);
  else if (owed < -0.005) lines.push(`Customer is in credit: ${fmtGbp(-owed)}.`);
  for (const r of rentals.filter(r => r.customerId === c.id && r.status === 'overdue')) {
    lines.push(`Rental phone ${r.phoneNumber || ''} is OVERDUE (was due back ${fmtDate(r.toDate)}).`);
  }
  for (const r of rentals.filter(r => r.customerId === c.id && (r.status === 'out' || r.status === 'booked'))) {
    lines.push(`Has a rental phone ${r.phoneNumber || ''} (${getComputedStatus(r)}) due back ${fmtDate(r.toDate)}.`);
  }
  for (const s of sims.filter(s => s.customerId === c.id && s.status === 'active' && s.renewalDate && s.renewalDate >= today && s.renewalDate <= soon)) {
    lines.push(`SIM plan${s.provider ? ' (' + s.provider + ')' : ''} renews ${fmtDate(s.renewalDate)}.`);
  }
  for (const b of customerUpcomingBookings(c).filter(b => b.travelDate && b.travelDate >= today && b.travelDate <= soon)) {
    lines.push(`Upcoming flight ${b.route || ''} on ${fmtDate(b.travelDate)}.`);
  }
  return lines.join('\n');
}
function openAiReplyModal(customerId) {
  const c = customers.find(x => x.id === customerId);
  if (!c) return;
  showDynamicModal(`
    <div class="modal-title">💬 Draft a reply — ${escName(c.firstName)} ${escName(c.lastName)}</div>
    <div style="font-size:var(--fs-small);color:var(--muted);margin-bottom:10px;">Paste what the customer wrote and the AI drafts a reply in the shop's voice, using their account facts. <strong>Nothing is sent</strong> — read it, edit it, then copy. Don't paste passport/ID numbers (the text goes to Google).</div>
    <div class="form-group form-full">
      <label class="form-label">Customer's message</label>
      <textarea class="form-input" id="airIn" rows="4" placeholder="Paste the ${WHATSAPP_ENABLED ? 'WhatsApp / ' : ''}SMS or email the customer sent…"></textarea>
    </div>
    <div class="form-grid" style="margin:4px 0 2px;">
      <div class="form-group">
        <label class="form-label">Tone</label>
        <select class="form-input" id="airTone">
          <option value="friendly">Friendly</option>
          <option value="formal">Formal</option>
          <option value="brief">Brief</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Language</label>
        <select class="form-input" id="airLang">
          <option value="auto">Match the customer</option>
          <option value="en">English</option>
          <option value="he">Hebrew</option>
          <option value="yi">Yiddish</option>
        </select>
      </div>
    </div>
    <div class="form-group form-full" id="airOutWrap" style="display:none;">
      <label class="form-label">Drafted reply <span style="color:var(--muted);font-weight:400;">— edit before copying</span></label>
      <textarea class="form-input" id="airOut" rows="7" style="font-family:inherit;"></textarea>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeDynamicModal()">Close</button>
      <button class="btn btn-outline" id="airGoBtn" onclick="runAiReply('${escHtml(String(customerId))}')">✨ Draft reply</button>
      <button class="btn btn-primary" id="airCopyBtn" style="display:none;" onclick="copyAiReply('${escHtml(String(customerId))}')">📋 Copy reply</button>
    </div>
  `);
}
async function runAiReply(customerId) {
  const c = customers.find(x => x.id === customerId);
  const incoming = document.getElementById('airIn')?.value.trim();
  if (!c || !incoming) { toast('Paste the customer’s message first.', 'error'); return; }
  const btn = document.getElementById('airGoBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Drafting…'; }
  try {
    const r = await kcFetch('/api/ai-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        incoming,
        context: customerContextForAi(c),
        customerName: `${c.firstName || ''} ${c.lastName || ''}`.trim(),
        tone: document.getElementById('airTone')?.value || 'friendly',
        lang: document.getElementById('airLang')?.value || 'auto',
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.success) { toast(j.error || 'Could not draft a reply.', 'error'); return; }
    const out = document.getElementById('airOut');
    if (out) out.value = j.draft || '';
    const wrap = document.getElementById('airOutWrap'); if (wrap) wrap.style.display = '';
    const copyBtn = document.getElementById('airCopyBtn'); if (copyBtn) copyBtn.style.display = '';
    if (btn) btn.textContent = '✨ Redraft';
  } catch {
    toast('Could not reach the reply drafter.', 'error');
  } finally {
    if (btn) { btn.disabled = false; if (btn.textContent === 'Drafting…') btn.textContent = '✨ Draft reply'; }
  }
}
async function copyAiReply(customerId) {
  const text = document.getElementById('airOut')?.value || '';
  if (!text.trim()) { toast('Nothing to copy yet.', 'warning'); return; }
  try { await navigator.clipboard.writeText(text); toast('Reply copied — paste it wherever you message this customer.', 'success'); }
  catch { toast('Select the text and copy it manually.', 'warning'); return; }
  recordComm(customerId, { type: 'message', text: 'AI reply drafted & copied' });
  closeDynamicModal();
}

// Status SMS for a single rental, drafted not sent (same HOLD as reminders:
// staff copy it into their own SMS/WhatsApp; the app never messages anyone).
// The message tracks where the rental actually is in its lifecycle.
function buildRentalSms(r) {
  const first = (r.customerName || '').split(' ')[0] || 'there';
  const today = localISO();
  const tomorrow = localISO(new Date(Date.now() + 86400000));
  const owed = Math.max(0, rentalGrandTotal(r) - (r.amountPaid || 0));
  const owedLine = owed > 0.005 ? ` ${fmtGbp(owed)} is still open on this rental.` : '';
  const status = getComputedStatus(r);
  let body;
  if (status === 'booked') {
    body = `your ${r.country || ''} phone is reserved and ready — pickup ${fmtDate(r.fromDate)}. See you then!`;
  } else if (status === 'overdue') {
    body = `your rental phone ${r.phoneNumber || ''} was due back ${fmtDate(r.toDate)}. Please return it, or reply to extend — late fees may apply.`;
  } else if (r.status === 'returned') {
    body = `thanks for returning the phone!${owedLine || ' All settled — see you next trip!'}`;
  } else if (r.toDate === today) {
    body = `a quick reminder — your rental phone ${r.phoneNumber || ''} is due back today.`;
  } else if (r.toDate === tomorrow) {
    body = `a quick reminder — your rental phone ${r.phoneNumber || ''} is due back tomorrow (${fmtDate(r.toDate)}).`;
  } else {
    body = `your rental of ${r.phoneNumber || 'the phone'} runs until ${fmtDate(r.toDate)}.${owedLine}`;
  }
  return `Hi ${first}, ${body}\n— Kosher Connect`;
}
function openRentalSmsModal(rentalId) {
  const r = rentals.find(x => x.id === rentalId);
  if (!r) return;
  const waC = customers.find(x => x.id === r.customerId) || { phone: r.customerPhone };
  showDynamicModal(`
    <div class="modal-title">✉️ Status SMS — ${escName(r.customerName || '')}</div>
    <div style="font-size:var(--fs-small);color:var(--muted);margin-bottom:10px;">
      Drafted from the rental's current status${r.customerPhone ? ` · 📞 <span class="copy-val">${escHtml(fmtPhone(r.customerPhone))}</span>` : ''}.
      Edit it, then copy — or send it directly once Twilio is connected.</div>
    <textarea class="form-input" id="rsmsText" rows="5" style="font-family:inherit;">${escHtml(buildRentalSms(r))}</textarea>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeDynamicModal()">Close</button>
      <button class="btn btn-outline" onclick="sendRentalSms('${escHtml(String(rentalId))}')">📤 Send SMS</button>
      ${waLink(waC, '') ? `<button class="btn btn-outline" onclick="waRentalSms('${escHtml(String(rentalId))}')">💬 Open in WhatsApp</button>` : ''}
      <button class="btn btn-primary" onclick="copyRentalSms('${escHtml(String(rentalId))}')">📋 Copy message</button>
    </div>
  `);
}
async function sendRentalSms(rentalId) {
  const r = rentals.find(x => x.id === rentalId);
  const text = document.getElementById('rsmsText')?.value || '';
  if (!r || !text.trim()) return;
  const res = await kcFetch('/api/sms', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId: r.customerId, text }),
  }).then(x => x.json()).catch(() => ({ success: false, error: 'Network error.' }));
  if (!res.success) { toast(res.error || 'Could not send.', 'error'); return; }
  if (res.held) { toast(res.note, 'warning'); }
  else if (res.redirected) { toast(res.note, 'warning'); }
  else { toast(`SMS sent to ${r.customerName || 'the customer'} ✔`, 'success'); }
  if (r.customerId) recordComm(r.customerId, { type: 'message', text: res.held ? `Status SMS built (HOLD, not sent)` : res.redirected ? `Status SMS sent to test number` : `Status SMS sent (${getComputedStatus(r)})` });
  closeDynamicModal();
}
async function copyRentalSms(rentalId) {
  const r = rentals.find(x => x.id === rentalId);
  const text = document.getElementById('rsmsText')?.value || '';
  try { await navigator.clipboard.writeText(text); toast('SMS copied — paste it into your messaging app.', 'success'); }
  catch { toast('Select the text and copy it manually.', 'warning'); return; }
  if (r?.customerId) recordComm(r.customerId, { type: 'message', text: `Status SMS drafted & copied (${getComputedStatus(r)})` });
  closeDynamicModal();
}
function waRentalSms(rentalId) {
  const r = rentals.find(x => x.id === rentalId);
  if (!r) return;
  const text = document.getElementById('rsmsText')?.value || '';
  const c = customers.find(x => x.id === r.customerId) || { phone: r.customerPhone };
  const url = waLink(c, text);
  if (!url) { toast('No usable phone number for WhatsApp.', 'warning'); return; }
  window.open(url, '_blank');
  if (r.customerId) recordComm(r.customerId, { type: 'message', text: `Status SMS opened in WhatsApp (${getComputedStatus(r)})` });
  closeDynamicModal();
}

function openWalletModal(customerId, balance = null) {
  const c = customers.find(x => x.id === customerId);
  // #61 — if they owe, offer "Pay full £X" so nobody reads the balance and
  // hand-types it. Owed = negative balance.
  const owed = balance != null && balance < 0 ? Math.round(Math.abs(balance) * 100) / 100 : 0;
  const payFullBtn = owed > 0
    ? `<button type="button" class="btn btn-outline btn-sm" style="font-size:var(--fs-micro);padding:4px 10px;margin-top:6px;"
        onclick="document.getElementById('wlKind').value='payment';document.getElementById('wlMethodWrap').style.display='block';document.getElementById('wlAmount').value='${owed.toFixed(2)}'">Pay full ${fmtGbp(owed)}</button>`
    : '';
  showDynamicModal(`
    <div class="modal-title">💰 Record payment / credit — ${c ? escName(c.firstName) + ' ' + escName(c.lastName) : ''}</div>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Type</label>
        <select class="form-input" id="wlKind"
          onchange="document.getElementById('wlMethodWrap').style.display=['payment','top_up','refund_payout'].includes(this.value)?'block':'none'">
          <option value="payment">💷 Payment (settles what they owe)</option>
          <option value="top_up">➕ Top-up (credit in advance)</option>
          <option value="refund">↩️ Refund (credit to wallet — we owe them)</option>
          <option value="refund_payout">↩️ Refund paid out (money handed back)</option>
          <option value="adjustment">✏️ Adjustment (correction, ± allowed)</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Amount (£)</label>
        <input class="form-input" type="number" step="0.01" id="wlAmount" placeholder="0.00">
        ${payFullBtn}
      </div>
      <div class="form-group" id="wlMethodWrap">
        <label class="form-label">Method</label>
        <select class="form-input" id="wlMethod">
          <option value="cash">💵 Cash</option>
          <option value="card">💳 Card</option>
          <option value="bank_transfer">🏦 Bank transfer</option>
          <option value="voucher">🎟️ Voucher</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div class="form-group form-full">
        <label class="form-label">Note</label>
        <input class="form-input" id="wlNote" placeholder="What is this for?">
      </div>
      ${c && c.email && !isOwnAccountEmail(c.email) ? `<div class="form-group form-full">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:var(--fs-body);">
          <input type="checkbox" id="wlEmail"> ✉️ Email a receipt to ${escHtml(c.email)}
        </label>
      </div>` : ''}
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeDynamicModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveWalletEntry('${escHtml(customerId)}')">💰 Record</button>
    </div>
  `);
}

async function saveWalletEntry(customerId) {
  const kind = document.getElementById('wlKind').value;
  const amount = parseFloat(document.getElementById('wlAmount').value);
  if (!Number.isFinite(amount) || amount === 0) { toast('Enter a non-zero amount.', 'error'); return; }
  const method = document.getElementById('wlMethod').value;
  const note = document.getElementById('wlNote').value.trim();
  const wantEmail = !!document.getElementById('wlEmail')?.checked;
  // Stop a double-click from recording the money twice while the first save is in
  // flight; the clientRef makes any retry idempotent server-side too.
  const guardKey = 'wallet:' + customerId;
  if (!kcBeginWrite(guardKey)) return;
  let res;
  try {
    // A negative adjustment is a charge in disguise — confirm it like one.
    if (kind === 'adjustment' && amount < 0) {
      const wlCust = customers.find(x => x.id === customerId);
      if (!(await kcConfirm({
        title: 'Confirm adjustment (charge)',
        body: `<strong>${wlCust ? escName(wlCust.firstName) + ' ' + escName(wlCust.lastName) : 'Customer'}</strong><br>${note ? escHtml(note) : 'Manual adjustment — reduces their balance'}`,
        amount: Math.abs(amount),
        okLabel: 'Apply adjustment',
      }))) return;
    }
    // Money handed back is money leaving the drawer — confirm it like a charge.
    if (kind === 'refund_payout') {
      const wlCust = customers.find(x => x.id === customerId);
      if (!(await kcConfirm({
        title: 'Confirm refund paid out',
        body: `<strong>${wlCust ? escName(wlCust.firstName) + ' ' + escName(wlCust.lastName) : 'Customer'}</strong><br>${note ? escHtml(note) : 'Money handed back — uses up the credit they were owed'}`,
        amount: Math.abs(amount),
        okLabel: 'Record payout',
      }))) return;
    }
    // Only tendered kinds carry a till method; a refund credit or adjustment must
    // NOT carry the (hidden, still-'cash') method, or it inflates the Z-report's
    // expected drawer cash. A payout does carry one — it lowers the drawer by the
    // same rule, which is why cash-up nets cash rows by sign.
    const tenderMethod = ['payment', 'top_up', 'refund_payout'].includes(kind) ? method : null;
    res = await window.api.addLedgerEntry({ customerId, kind, amount, method: tenderMethod, note, clientRef: kcRef() });
  } finally {
    kcEndWrite(guardKey);
  }
  if (!res.success) { toast(res.error || 'Could not record it.', 'error'); return; }
  closeDynamicModal();
  toast(`Recorded — wallet balance now ${fmtGbp(res.balance)}.`, 'success');
  // The receipt template says "payment received", so it only fits money coming
  // in. A payout going the other way would thank them for money they were given.
  if (wantEmail && amount > 0 && (kind === 'payment' || kind === 'top_up')) {
    kcFetch('/api/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'payment',
        customerId,
        amount,
        method: (kind === 'payment' || kind === 'top_up') ? method : null,
        note,
        balance: res.balance,
      }),
    }).then(r => r.json()).then(er => {
      if (er && er.success && er.held) toast(er.note || 'Email is on hold — receipt not sent.', 'warning');
      else if (er && er.success && er.redirected) toast(er.note || `Test mode — sent to ${er.sentTo}.`, 'warning');
      else if (er && er.success) {
        toast(`Receipt emailed to ${er.sentTo}.`, 'success');
        // #60 — a genuinely-sent receipt is logged on the customer timeline.
        recordComm(customerId, { type: 'email', text: `Receipt emailed — ${fmtGbp(Math.abs(amount))} ${kind}` });
      }
      else toast(er?.error || 'Payment saved, but the receipt email failed.', 'error');
    }).catch(() => toast('Payment saved, but the receipt email failed.', 'error'));
  }
  loadWalletSection(customerId); // no-ops unless the detail panel is open
  if (currentTab === 'wallet') renderWalletTab();
}

// ─────────────────────────────────────────────
//  WALLET TAB (business-wide ledger view)
// ─────────────────────────────────────────────
// The per-customer wallet lives in the customer detail panel; this tab is
// the shop-wide view: today's money, who owes / who's in credit, and the
// full recent ledger feed. Same append-only /api/ledger underneath.

async function renderWalletTab() {
  const content = document.getElementById('mainContent');
  content.innerHTML = skeletonHtml('wallet');

  const today = localISO();
  const data = await kcFetch(`/api/ledger?since=${today}&recent=50`)
    .then(r => r.ok ? r.json() : null).catch(() => null);
  if (!data || !data.success) {
    content.innerHTML = `<div class="empty-state"><div class="emoji">💰</div>
      <p>Wallet unavailable${data?.error ? ' — ' + escHtml(data.error) : ''}.</p></div>`;
    return;
  }

  const arrears = data.arrears || [];
  const credits = data.credits || [];
  const arrearsTotal = Math.abs(data.arrearsTotal || 0);
  const creditsTotal = data.creditsTotal || 0;

  const balanceRow = (b, negative) => `
    <div class="feed-item${b.customerId ? ' dash-link' : ''}"${b.customerId
      ? ` onclick="goToTab('customers',{customerId:'${escHtml(String(b.customerId))}'})" title="Open customer"` : ''}>
      <span class="feed-icon">${negative ? '🔴' : '🟢'}</span>
      <span class="feed-label"><strong>${escName(b.customerName)}</strong></span>
      <span style="font-feature-settings:'tnum';color:${negative ? 'var(--danger-ink)' : 'var(--success)'};font-weight:600;">
        ${negative ? '−' : '+'}${fmtGbp(Math.abs(b.balance))}</span>
      ${b.customerId ? `<button class="btn btn-outline btn-sm" style="margin-left:10px;font-size:var(--fs-micro);padding:4px 10px;"
        onclick="event.stopPropagation();openWalletModal('${escHtml(String(b.customerId))}', ${Number(b.balance) || 0})">💰 ${negative ? 'Take payment' : 'Record'}</button>` : ''}
      <span class="feed-go">›</span>
    </div>`;

  const arrearsHtml = arrears.length === 0
    ? `<div style="color:var(--muted);font-size:var(--fs-body);padding:8px 0;">Nobody owes money. 🎉</div>`
    : arrears.map(b => balanceRow(b, true)).join('');
  const creditsHtml = credits.length === 0
    ? `<div style="color:var(--muted);font-size:var(--fs-body);padding:8px 0;">No prepaid credit held.</div>`
    : credits.map(b => balanceRow(b, false)).join('');

  const feedHtml = (data.recent || []).length === 0
    ? `<div style="color:var(--muted);font-size:var(--fs-body);padding:8px 0;">No wallet activity yet.</div>`
    : data.recent.map(e => `
        <div class="history-item history-flat${e.customerId ? ' dash-link' : ''}"
          ${e.customerId ? `onclick="goToTab('customers',{customerId:'${escHtml(String(e.customerId))}'})" title="Open customer"` : ''}>
          <div class="history-main">
            <div class="history-dot ${e.amount >= 0 ? 'dot-green' : 'dot-blue'}"></div>
            <div class="history-desc kc-clamp-2">
              <strong>${escName(e.customerName || '—')}</strong> · ${LEDGER_TYPE_LABELS[e.type] || escHtml(e.type)}${e.description ? ' · ' + escHtml(e.description) : ''}${e.method ? ` <span style="color:var(--muted);">(${escHtml(e.method.replace('_', ' '))})</span>` : ''}</div>
          </div>
          <div class="history-date" style="margin:0 12px;">${fmtDate(e.at)}</div>
          <div class="history-amount" style="color:${e.amount >= 0 ? 'var(--success)' : 'var(--text)'};font-feature-settings:'tnum';">
            ${e.amount >= 0 ? '+' : '−'}${fmtGbp(Math.abs(e.amount))}</div>
          ${e.customerId ? '<span class="feed-go">›</span>' : ''}
        </div>`).join('');

  const customerOptions = [...customers]
    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
    .map(c => `<option value="${escHtml(c.id)}">${escName(c.firstName)} ${escName(c.lastName)}</option>`)
    .join('');

  content.innerHTML = `
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">Money In Today</div>
        <div class="stat-value" style="color:var(--success);">${fmtGbp((data.todayIn || 0))}</div></div>
      <div class="stat-card"><div class="stat-label">Charged Out Today</div>
        <div class="stat-value">${fmtGbp(Math.abs(data.todayOut || 0))}</div></div>
      <div class="stat-card"><div class="stat-label">Outstanding</div>
        <div class="stat-value" style="${statBandStyle('arrears', arrearsTotal)}">${fmtGbp(arrearsTotal)}</div>
        <div class="stat-sub">${arrears.length} customer${arrears.length === 1 ? '' : 's'} in arrears</div></div>
      <div class="stat-card"><div class="stat-label">Credit Held</div>
        <div class="stat-value">${fmtGbp(creditsTotal)}</div>
        <div class="stat-sub">${credits.length} customer${credits.length === 1 ? '' : 's'} in credit</div></div>
    </div>

    <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;align-items:center;">
      <select class="form-input" id="wtCustomer" style="width:260px;min-height:0;padding:8px 12px;font-size:var(--fs-body);">
        <option value="">Choose a customer…</option>${customerOptions}
      </select>
      <button class="btn btn-primary" onclick="(()=>{const id=document.getElementById('wtCustomer').value;
        if(!id){toast('Choose a customer first.','error');return;}openWalletModal(id)})()">💰 Record payment / credit</button>
      <button class="btn btn-outline" onclick="openCashupModal()" style="margin-left:auto;">🧾 Cash-up</button>
      ${(!currentStaff || currentStaff.role === 'owner')
        ? `<button class="btn btn-outline" onclick="renderBankRecon()">🏦 Bank statements</button>` : ''}
    </div>

    <div class="dash-cols">
      <div class="table-card" style="padding:8px 18px 14px;">
        <div class="section-divider" style="margin-top:12px;">Owes money</div>
        ${arrearsHtml}
        <div class="section-divider" style="margin-top:16px;">In credit</div>
        ${creditsHtml}
      </div>
      <div class="table-card" style="padding:8px 18px 14px;">
        <div class="section-divider" style="margin-top:12px;">Recent activity <span style="color:var(--muted);font-weight:400;">· last ${(data.recent || []).length}</span></div>
        <div>${feedHtml}</div>
      </div>
    </div>`;
}

// ── End-of-day cash-up (the Z-report) ────────────────────────────────────

const METHOD_LABELS = {
  cash: '💵 Cash', card: '💳 Card', bank_transfer: '🏦 Bank transfer',
  voucher: '🎟️ Voucher', wallet: '👛 Wallet', other: 'Other', unspecified: '— no method recorded',
};

async function openCashupModal(dateISO) {
  const today = dateISO || localISO();
  const isToday = today === localISO();
  const prevDay = new Date(`${today}T12:00:00`);
  prevDay.setDate(prevDay.getDate() - 1);
  const prevISO = prevDay.toISOString().slice(0, 10);
  const nextDay = new Date(`${today}T12:00:00`);
  nextDay.setDate(nextDay.getDate() + 1);
  const nextISO = nextDay.toISOString().slice(0, 10);
  const data = await kcFetch(`/api/cashup?date=${today}`).then(r => r.json()).catch(() => null);
  if (!data || !data.success) { toast(data?.error || 'Cash-up unavailable.', 'error'); return; }

  const methodRows = Object.entries(data.methods)
    .sort((a, b) => b[1] - a[1])
    .map(([m, amt]) => `
      <div style="display:flex;justify-content:space-between;font-size:var(--fs-body);padding:5px 0;border-bottom:1px solid var(--border);">
        <span>${METHOD_LABELS[m] || escHtml(m)}</span>
        <strong style="font-feature-settings:'tnum';">${fmtGbp(amt)}</strong>
      </div>`).join('') ||
    `<div style="color:var(--muted);font-size:var(--fs-body);padding:6px 0;">No money in yet today.</div>`;

  showDynamicModal(`
    <div class="modal-title" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <span>🧾 Cash-up — ${fmtDate(today)}</span>
      <span style="display:flex;gap:6px;">
        <button class="btn btn-outline btn-sm" onclick="openCashupModal('${prevISO}')" title="Count an earlier day">‹ ${fmtDate(prevISO)}</button>
        ${isToday ? '' : `<button class="btn btn-outline btn-sm" onclick="openCashupModal('${nextISO}')" title="Later day">${fmtDate(nextISO)} ›</button>`}
      </span>
    </div>
    ${isToday ? '' : `<div class="p-linkerr" role="status" style="margin-bottom:12px;">Counting an earlier day — today’s figures are not shown.</div>`}
    <div style="margin-bottom:14px;">${methodRows}
      <div style="display:flex;justify-content:space-between;font-size:var(--fs-body);padding:7px 0;color:var(--muted);">
        <span>Charged out today</span><span style="font-feature-settings:'tnum';">−${fmtGbp(Math.abs(data.totalOut))}</span>
      </div>
    </div>
    <div style="background:var(--bg-secondary);border-radius:10px;padding:12px 14px;margin-bottom:14px;">
      ${data.openingFloat ? `<div style="display:flex;justify-content:space-between;font-size:var(--fs-body);padding-bottom:6px;color:var(--muted);">
        <span>Opening float</span><span style="font-feature-settings:'tnum';">${fmtGbp(Number(data.openingFloat))}</span>
      </div>` : ''}
      <div style="display:flex;justify-content:space-between;font-size:var(--fs-ui);font-weight:600;">
        <span>Expected cash in till</span><span>${fmtGbp(data.expectedCash)}</span>
      </div>
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Counted cash (£)</label>
        <input class="form-input" type="number" min="0" step="0.01" id="cuCounted"
          value="${data.count ? data.count.counted.toFixed(2) : ''}" placeholder="0.00"
          oninput="cuUpdateVariance(this, ${data.expectedCash})"
          onkeydown="if(event.key==='Enter'){event.preventDefault();saveCashup('${today}');}">
        <div id="cuVariance" style="font-size:var(--fs-small);margin-top:4px;font-weight:600;">
          ${data.count ? (data.count.variance === 0 ? '✓ Till balances' : `${data.count.variance > 0 ? '+' : '−'}${fmtGbp(Math.abs(data.count.variance))} ${data.count.variance > 0 ? 'over' : 'short'}`) : ''}</div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <input class="form-input" id="cuNotes" value="${escHtml(data.count?.notes || '')}" placeholder="e.g. £5 float top-up">
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeDynamicModal()">Close</button>
      <button class="btn btn-primary" onclick="saveCashup('${today}')">🧾 Save count</button>
    </div>
  `);
}

function cuUpdateVariance(inputEl, expected) {
  const el = document.getElementById('cuVariance');
  const v = parseFloat(inputEl.value);
  if (!el) return;
  if (!Number.isFinite(v)) { el.textContent = ''; return; }
  const d = +(v - expected).toFixed(2);
  el.textContent = d === 0 ? '✓ Till balances'
    : `${d > 0 ? '+' : '−'}${fmtGbp(Math.abs(d))} ${d > 0 ? 'over' : 'short'}`;
  el.style.color = d === 0 ? 'var(--success)' : 'var(--danger-ink)';
}

async function saveCashup(date) {
  const counted = parseFloat(document.getElementById('cuCounted').value);
  if (!Number.isFinite(counted) || counted < 0) { toast('Enter the counted amount.', 'error'); return; }
  const res = await kcFetch('/api/cashup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, counted, notes: document.getElementById('cuNotes').value.trim() }),
  }).then(r => r.json()).catch(() => null);
  if (!res || !res.success) { toast(res?.error || 'Could not save the count.', 'error'); return; }
  closeDynamicModal();
  const v = res.variance;
  toast(v === 0 ? 'Till counted — balances exactly. ✓'
    : `Till counted — ${v > 0 ? '+' : '−'}${fmtGbp(Math.abs(v))} ${v > 0 ? 'over' : 'short'}.`,
    v === 0 ? 'success' : 'warning');
}

// ── Bank reconciliation (owner-only; lives under the Wallet tab) ─────────
// A statement upload proposes matches; a person confirms each one. Nothing
// posts by itself — the API refuses it and lib/bankMatch.mjs can't express it.
// Multiple accounts are just labels: each upload says which account it is.

let bankData = null;
let bankAccountFilter = '';           // '' = every account
let bankStateFilter = 'open';         // open (unmatched+proposed) | confirmed | ignored

// Refetch and repaint WITHOUT the skeleton, keeping the scroll position. Used
// after an action that has already been reflected optimistically in bankData —
// the proposal window still has to come from the server, but the operator
// shouldn't lose their place waiting for it.
async function bankRefreshQuiet() {
  const data = await kcFetch('/api/bank').then(r => r.json()).catch(() => null);
  if (!data || !data.success) return;
  const y = window.scrollY;
  bankData = data;
  bankPaint();
  window.scrollTo(0, y);
}

// Reflect a state change locally so the row updates on the spot.
function bankPatchRow(txnId, patch) {
  const t = (bankData?.transactions || []).find(x => x.id === txnId);
  if (!t) return;
  const was = t.matchState || 'unmatched';
  Object.assign(t, patch);
  const now = t.matchState || 'unmatched';
  if (bankData.counts && was !== now) {
    bankData.counts[was] = Math.max(0, (bankData.counts[was] || 0) - 1);
    bankData.counts[now] = (bankData.counts[now] || 0) + 1;
  }
}

async function renderBankRecon() {
  const content = document.getElementById('mainContent');
  document.getElementById('pageTitle').innerHTML = 'Bank <span>Reconciliation</span>';
  content.innerHTML = skeletonHtml('bank');
  const data = await kcFetch('/api/bank').then(r => r.json()).catch(() => null);
  if (!data || !data.success) {
    content.innerHTML = `<div class="empty-state"><div class="emoji">🏦</div>
      <p>${escHtml(data?.error || 'Bank reconciliation is unavailable.')}</p>
      <button class="btn btn-outline" onclick="renderTab('wallet')">← Back to Wallet</button></div>`;
    return;
  }
  bankData = data;
  bankPaint();
}

function bankPaint() {
  const content = document.getElementById('mainContent');
  const d = bankData;
  const counts = d.counts || {};
  const open = (counts.unmatched || 0) + (counts.proposed || 0);

  const inFilter = (t) =>
    (!bankAccountFilter || t.accountRef === bankAccountFilter) &&
    (bankStateFilter === 'open' ? (t.state === 'unmatched' || t.state === 'proposed') : t.state === bankStateFilter);
  const shown = (d.transactions || []).filter(inFilter);

  const accountOptions = (d.accounts || []).map(a =>
    `<option value="${escHtml(a.ref)}" ${a.ref === bankAccountFilter ? 'selected' : ''}>${escHtml(a.ref)} (${a.open} open)</option>`).join('');

  const stateBtn = (key, label, n) => `
    <button class="btn ${bankStateFilter === key ? 'btn-primary' : 'btn-outline'} btn-sm"
      onclick="bankStateFilter='${key}';bankPaint()">${label}${n != null ? ` · ${n}` : ''}</button>`;

  const CONF_BADGE = {
    strong:   'background:var(--success-bg,rgba(34,160,90,.12));color:var(--success);',
    possible: 'background:var(--warning-bg,rgba(200,140,20,.12));color:var(--warning,#b07d10);',
    weak:     'background:var(--bg-secondary);color:var(--muted);',
  };

  const row = (t) => {
    const isIn = t.amount >= 0;
    const best = t.match && t.match.proposals && t.match.proposals[0];
    const proposalHtml = (t.state === 'unmatched' || t.state === 'proposed') ? (
      best ? `
        <div class="bank-proposal">
          ${t.match.ambiguous ? `<div style="font-size:var(--fs-small);color:var(--warning,#b07d10);margin-bottom:4px;">⚠ Two candidates score alike — read the reasons before confirming.</div>` : ''}
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span style="font-size:var(--fs-small);color:var(--muted);">Looks like</span>
            <strong>${escHtml(best.name)}</strong>
            <span style="font-size:var(--fs-micro);padding:2px 8px;border-radius:99px;${CONF_BADGE[best.confidence] || CONF_BADGE.weak}">${escHtml(best.confidence)}</span>
            ${isIn ? `<button class="btn btn-primary btn-sm" style="font-size:var(--fs-small);padding:4px 12px;"
              onclick="bankConfirm('${escHtml(t.id)}','${escHtml(String(best.customerId ?? ''))}','${escHtml(best.name).replace(/'/g, '&#39;')}')">✓ Confirm match</button>` : ''}
          </div>
          <div style="font-size:var(--fs-small);color:var(--muted);margin-top:3px;">${best.reasons.map(escHtml).join(' · ')}</div>
        </div>` : `
        <div class="bank-proposal" style="color:var(--muted);font-size:var(--fs-small);">
          No candidate found${isIn ? ' — pick the customer yourself if you recognise it' : ''}.</div>`
    ) : '';

    const actions = (t.state === 'unmatched' || t.state === 'proposed') ? `
      ${isIn ? `<button class="btn btn-outline btn-sm" style="font-size:var(--fs-small);" onclick="bankPick('${escHtml(t.id)}')">Choose customer…</button>` : ''}
      <button class="btn btn-outline btn-sm" style="font-size:var(--fs-small);" onclick="bankIgnore('${escHtml(t.id)}')">Not customer money</button>`
      : t.state === 'confirmed' ? `
      <span style="font-size:var(--fs-small);color:var(--success);">✓ On the ledger</span>
      <button class="btn btn-outline btn-sm" style="font-size:var(--fs-small);" onclick="bankUndo('${escHtml(t.id)}')">Undo</button>`
      : `
      <span style="font-size:var(--fs-small);color:var(--muted);">Ignored${t.note ? ' — ' + escHtml(t.note) : ''}</span>
      <button class="btn btn-outline btn-sm" style="font-size:var(--fs-small);" onclick="bankReopen('${escHtml(t.id)}')">Reopen</button>`;

    return `
      <div class="history-item history-flat" style="flex-wrap:wrap;align-items:flex-start;gap:6px 12px;">
        <div style="display:flex;align-items:baseline;gap:10px;flex:1;min-width:220px;">
          <span class="history-date" style="min-width:78px;">${fmtDate(t.bookedAt)}</span>
          <span style="font-size:var(--fs-micro);padding:2px 8px;border-radius:99px;background:var(--bg-secondary);color:var(--muted);white-space:nowrap;">${escHtml(t.accountRef)}</span>
          <span class="kc-truncate" style="flex:1;font-size:var(--fs-body);">
            ${t.counterparty ? `<strong>${escHtml(t.counterparty)}</strong> · ` : ''}${escHtml(t.description || '—')}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px 10px;margin-left:auto;flex-wrap:wrap;justify-content:flex-end;max-width:100%;min-width:0;">
          <span style="font-weight:600;font-feature-settings:'tnum';color:${isIn ? 'var(--success)' : 'var(--text)'};">
            ${isIn ? '+' : '−'}${fmtGbp(Math.abs(t.amount))}</span>
          ${actions}
        </div>
        ${proposalHtml ? `<div style="flex-basis:100%;">${proposalHtml}</div>` : ''}
      </div>`;
  };

  content.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
      <button class="btn btn-outline btn-sm" onclick="renderTab('wallet')">← Wallet</button>
      <span style="color:var(--muted);font-size:var(--fs-body);">Upload a statement export; confirm each match yourself — nothing posts on its own.</span>
    </div>

    <div class="table-card" style="padding:16px 18px;margin-bottom:16px;">
      <div class="section-divider" style="margin:0 0 10px;">Import a statement</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">
        <div class="form-group" style="margin:0;">
          <label class="form-label">Account label</label>
          <input class="form-input" id="bankAccLabel" list="bankAccKnown" placeholder="e.g. Revolut main"
            style="width:200px;min-height:0;padding:8px 12px;font-size:var(--fs-body);" value="${escHtml(bankAccountFilter)}">
          <datalist id="bankAccKnown">${(d.accounts || []).map(a => `<option value="${escHtml(a.ref)}">`).join('')}</datalist>
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label">CSV export</label>
          <input class="form-input" id="bankCsvFile" type="file" accept=".csv,text/csv"
            style="min-height:0;padding:7px 12px;font-size:var(--fs-body);">
        </div>
        <button class="btn btn-primary" id="bankUploadBtn" onclick="bankUpload()">⬆ Import</button>
        <span style="font-size:var(--fs-small);color:var(--muted);flex-basis:100%;">Re-importing an overlapping window is safe — rows already seen are absorbed, never doubled. One label per bank account.</span>
      </div>
      <div id="bankUploadNote" style="font-size:var(--fs-small);margin-top:6px;"></div>
    </div>

    <div style="display:flex;gap:8px;align-items:center;margin-bottom:14px;flex-wrap:wrap;">
      ${stateBtn('open', 'Needs review', open)}
      ${stateBtn('confirmed', 'Confirmed', counts.confirmed || 0)}
      ${stateBtn('ignored', 'Ignored', counts.ignored || 0)}
      <select class="form-input" style="width:auto;min-height:0;padding:6px 10px;font-size:var(--fs-body);margin-left:auto;"
        onchange="bankAccountFilter=this.value;bankPaint()">
        <option value="">All accounts</option>${accountOptions}
      </select>
    </div>
    ${d.proposeCapped ? `<div style="font-size:var(--fs-small);color:var(--muted);margin-bottom:10px;">Showing proposals for the newest rows — ${d.proposeCapped} older open row${d.proposeCapped === 1 ? '' : 's'} will get theirs as these are worked through.</div>` : ''}

    <div class="table-card" style="padding:6px 18px 12px;">
      ${shown.length ? shown.map(row).join('') : `
        <div class="empty-state" style="padding:32px 0;"><div class="emoji">🏦</div>
          <p>${(d.transactions || []).length === 0
            ? 'No bank rows yet — import a statement above to start.'
            : 'Nothing in this view.'}</p></div>`}
    </div>`;
}

async function bankUpload() {
  const label = document.getElementById('bankAccLabel').value.trim();
  const fileEl = document.getElementById('bankCsvFile');
  const note = document.getElementById('bankUploadNote');
  if (!label) { toast('Give the account a label first — e.g. "Revolut main".', 'error'); return; }
  if (!fileEl.files || !fileEl.files[0]) { toast('Choose the CSV export to import.', 'error'); return; }
  const btn = document.getElementById('bankUploadBtn');
  btn.disabled = true;
  try {
    const csv = await fileEl.files[0].text();
    const res = await kcFetch('/api/bank', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'upload', accountLabel: label, csv }),
    }).then(r => r.json()).catch(() => null);
    if (!res || !res.success) {
      toast(res?.error || 'Import failed.', 'error');
      if (note && res?.warnings?.length) note.innerHTML = res.warnings.map(w => `⚠ ${escHtml(w)}`).join('<br>');
      return;
    }
    toast(`Imported ${res.inserted} new row${res.inserted === 1 ? '' : 's'}${res.duplicates ? ` (${res.duplicates} already known)` : ''}.`, 'success');
    if (note) note.innerHTML = (res.warnings || []).map(w => `⚠ ${escHtml(w)}`).join('<br>');
    bankAccountFilter = '';
    await renderBankRecon();
  } finally { btn.disabled = false; }
}

async function bankConfirm(txnId, customerId, name) {
  const t = (bankData?.transactions || []).find(x => x.id === txnId);
  if (!t || !customerId) return;
  if (!(await kcConfirm({
    title: 'Confirm bank match',
    body: `<strong>${escHtml(name)}</strong><br>${escHtml(t.counterparty || t.description || 'Bank credit')} · ${fmtDate(t.bookedAt)} · ${escHtml(t.accountRef)}<br>Posts as a payment (bank transfer) on their wallet.`,
    amount: Math.abs(t.amount),
    okLabel: 'Confirm match',
  }))) return;
  const res = await kcFetch('/api/bank', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'confirm', txnId, customerId, clientRef: kcRef() }),
  }).then(r => r.json()).catch(() => null);
  if (!res || !res.success) { toast(res?.error || 'Could not confirm it.', 'error'); return; }
  toast('Matched — payment is on the ledger.', 'success');
  bankPatchRow(txnId, { matchState: 'confirmed', matchedCustomerId: customerId, matchedName: name });
  bankPaint();
  bankRefreshQuiet();
}

function bankPick(txnId) {
  const t = (bankData?.transactions || []).find(x => x.id === txnId);
  if (!t) return;
  showDynamicModal(`
    <div class="modal-title">Who sent this?</div>
    <div style="font-size:var(--fs-body);color:var(--muted);margin-bottom:10px;">
      ${escHtml(t.counterparty || t.description || '')} · ${fmtDate(t.bookedAt)} ·
      <strong style="color:var(--text);">+${fmtGbp(Math.abs(t.amount))}</strong></div>
    <input class="form-input" id="bankPickSearch" placeholder="Type a name…" autocomplete="off"
      oninput="bankPickList('${escHtml(txnId)}')">
    <div id="bankPickResults" style="max-height:300px;overflow:auto;margin-top:8px;"></div>
    <div class="modal-actions"><button class="btn btn-outline" onclick="closeDynamicModal()">Cancel</button></div>
  `);
  const s = document.getElementById('bankPickSearch');
  if (s) { s.focus(); }
  bankPickList(txnId);
}

function bankPickList(txnId) {
  const q = (document.getElementById('bankPickSearch')?.value || '').trim().toLowerCase();
  const box = document.getElementById('bankPickResults');
  if (!box) return;
  const hits = (bankData?.customers || [])
    .filter(c => c.customerId && (!q || c.name.toLowerCase().includes(q)))
    .slice(0, 30);
  box.innerHTML = hits.length ? hits.map(c => `
    <div class="feed-item dash-link" onclick="closeDynamicModal();bankConfirm('${escHtml(txnId)}','${escHtml(String(c.customerId))}','${escHtml(c.name).replace(/'/g, '&#39;')}')">
      <span class="feed-label">${escHtml(c.name)}</span><span class="feed-go">›</span>
    </div>`).join('')
    : `<div style="color:var(--muted);font-size:var(--fs-body);padding:10px 0;">No customer matches “${escHtml(q)}”.</div>`;
}

async function bankIgnore(txnId) {
  const res = await kcFetch('/api/bank', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'ignore', txnId, note: 'Not customer money' }),
  }).then(r => r.json()).catch(() => null);
  if (!res || !res.success) { toast(res?.error || 'Could not update it.', 'error'); return; }
  bankPatchRow(txnId, { matchState: 'ignored' });
  bankPaint();
  bankRefreshQuiet();
}

async function bankReopen(txnId) {
  const res = await kcFetch('/api/bank', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'reopen', txnId }),
  }).then(r => r.json()).catch(() => null);
  if (!res || !res.success) { toast(res?.error || 'Could not update it.', 'error'); return; }
  bankPatchRow(txnId, { matchState: 'unmatched', matchedCustomerId: null, matchedName: null });
  bankPaint();
  bankRefreshQuiet();
}

async function bankUndo(txnId) {
  const t = (bankData?.transactions || []).find(x => x.id === txnId);
  if (!t) return;
  if (!(await kcConfirm({
    title: 'Undo this match?',
    body: `The ledger is append-only, so this posts an equal-and-opposite correction and reopens the bank row. Both entries stay visible on the customer's statement.`,
    amount: Math.abs(t.amount),
    okLabel: 'Undo match',
  }))) return;
  const res = await kcFetch('/api/bank', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'undo', txnId, clientRef: kcRef() }),
  }).then(r => r.json()).catch(() => null);
  if (!res || !res.success) { toast(res?.error || 'Could not undo it.', 'error'); return; }
  toast('Undone — correction posted, row reopened.', 'success');
  bankPatchRow(txnId, { matchState: 'unmatched', matchedCustomerId: null, matchedName: null });
  bankPaint();
  bankRefreshQuiet();
}

async function addPayment(id) {
  const c = customers.find(x => x.id === id);
  if (!c) return;
  const type = document.getElementById(`payType-${id}`).value;
  const desc = document.getElementById(`payDesc-${id}`).value.trim();
  const amt  = parseFloat(document.getElementById(`payAmt-${id}`).value) || 0;
  if (!desc) { toast('Please enter a description.', 'error'); return; }
  if (amt <= 0) { toast('Please enter an amount greater than 0.', 'error'); return; }
  if (!c.history) c.history = [];
  c.history.push({
    type, desc, amount: amt,
    date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
  });
  c.totalPaid = (c.totalPaid || 0) + amt;
  await window.api.updateCustomer(c);
  const idx = customers.findIndex(x => x.id === id);
  if (idx !== -1) customers[idx] = c;
  toast(`${fmtGbp(amt)} added to ${c.firstName}'s history!`, 'success');
  renderDetailPanel(id);
  renderTableRows();
}

// ─────────────────────────────────────────────
//  SEARCH
// ─────────────────────────────────────────────
function setupSearch() {
  document.getElementById('searchBox').addEventListener('input', e => {
    searchTerm = e.target.value.trim().toLowerCase();
    applySearch();
    // On any other tab the term would land nowhere visible — jump to the
    // Customers list, which is what this box filters.
    if (searchTerm && currentTab !== 'customers') { goToTab('customers'); return; }
    renderTableRows();
  });
}

function applySearch() {
  if (!searchTerm) {
    filteredCustomers = [...customers];
    return;
  }
  filteredCustomers = customers.filter(c => {
    const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
    return fullName.includes(searchTerm)
      || (c.phone || '').toLowerCase().includes(searchTerm)
      || (c.email || '').toLowerCase().includes(searchTerm)
      || phoneDigitsMatch(searchTerm, c);
  });
}

// ─────────────────────────────────────────────
//  TOPBAR BUTTONS
// ─────────────────────────────────────────────
function setupTopbarButtons() {
  // #58 — dispatches to the current tab's create action (set by renderTab),
  // falling back to New Customer before any tab has rendered.
  document.getElementById('btnNewCustomer').addEventListener('click', () => (tabPrimaryAction || openAddModal)());
  // Discoverable entry to the command palette (Ctrl/Cmd+K also opens it).
  const btnNew = document.getElementById('btnNewCustomer');
  if (btnNew && !document.getElementById('btnPalette')) {
    const b = document.createElement('button');
    b.id = 'btnPalette';
    b.className = 'btn btn-outline';
    b.style.cssText = 'font-size:var(--fs-small);padding:8px 12px;margin-right:8px;';
    b.title = 'Search everything (Ctrl+K)';
    b.setAttribute('aria-label', 'Search everything');
    // The word is in a span so phones can drop it and keep the icon — the
    // topbar was wrapping to three rows at 390px just to say "Ask"/"Search".
    b.innerHTML = '🔍<span class="kc-btn-label"> Search</span><span class="kc-chord">Ctrl K</span>';
    b.addEventListener('click', openPalette);
    btnNew.parentElement.insertBefore(b, btnNew);
  }
  // The AI assistant gets its own visible button — a palette-only entry meant
  // knowing Ctrl+K was the price of admission.
  if (btnNew && !document.getElementById('btnAssistant')) {
    const a = document.createElement('button');
    a.id = 'btnAssistant';
    a.className = 'btn btn-outline';
    a.style.cssText = 'font-size:var(--fs-small);padding:8px 12px;margin-right:8px;';
    a.title = 'Ask Kosher Connect — questions or actions, in plain words';
    a.setAttribute('aria-label', 'Ask Kosher Connect');
    a.innerHTML = '🤖<span class="kc-btn-label"> Ask</span>';
    a.addEventListener('click', () => openAssistantModal());
    btnNew.parentElement.insertBefore(a, document.getElementById('btnPalette'));
  }
}

// ─────────────────────────────────────────────
//  MODAL
// ─────────────────────────────────────────────
function setupModal() {
  document.getElementById('btnCancelModal').addEventListener('click', closeModal);
  document.getElementById('btnCloseCustomerModal').addEventListener('click', closeModal);
  // Same started-on-backdrop guard as the dynamic modal: a resize-corner or
  // text-selection drag that ends on the backdrop must not close the form.
  const custOverlay = document.getElementById('customerModal');
  custOverlay.addEventListener('pointerdown', e => { custOverlay._pressedOnBackdrop = e.target === custOverlay; });
  custOverlay.addEventListener('click', e => { if (e.target === custOverlay && custOverlay._pressedOnBackdrop) closeModal(); });
  document.getElementById('btnSaveCustomer').addEventListener('click', saveCustomer);
  document.getElementById('fPhoneNumber').addEventListener('blur', checkPhoneDuplicate);
  document.getElementById('fEmail').addEventListener('blur', checkEmailDuplicate);
  document.getElementById('fFirstName').addEventListener('blur', checkNameDuplicate);
  document.getElementById('fLastName').addEventListener('blur', checkNameDuplicate);
  // Google address autocomplete on the Address field (no-op if the key/helper
  // isn't loaded — the field stays a plain text box).
  if (window.kcAddressAutocomplete) {
    window.kcAddressAutocomplete(document.getElementById('fAddress'));
  }
}

function openAddModal() {
  clearModal();
  document.getElementById('modalTitle').textContent = '➕ Add New Customer';
  document.getElementById('editId').value = '';
  document.getElementById('btnSaveCustomer').textContent = 'Save Customer';
  showModal();
}

function openEditModal(id) {
  const c = customers.find(x => x.id === id);
  if (!c) return;
  clearModal();
  document.getElementById('modalTitle').textContent = '✏️ Edit Customer';
  document.getElementById('editId').value = id;
  document.getElementById('btnSaveCustomer').textContent = 'Update Customer';

  const codes = ['+972', '+44', '+1-CA', '+1', '+33', '+49', '+43', '+41', '+32', '+31', '+61', '+55', '+52', '+54', '+27'];
  let code = '+44', phoneNum = c.phone || '';
  for (const cc of codes) {
    const plain = cc.replace('-CA', '');
    if (phoneNum.startsWith(plain)) {
      code = cc;
      phoneNum = phoneNum.slice(plain.length).trim();
      break;
    }
  }

  document.getElementById('fFirstName').value = c.firstName || '';
  document.getElementById('fLastName').value  = c.lastName  || '';
  document.getElementById('fCountryCode').value = code;
  document.getElementById('fPhoneNumber').value = phoneNum;
  document.getElementById('fEmail').value   = c.email   || '';
  const aeEl = document.getElementById('fAccountEmail');
  if (aeEl) aeEl.value = c.accountEmail || '';
  document.getElementById('fAddress').value = c.address || '';
  { const n = document.getElementById('fNotes'); if (n) n.value = c.notes || ''; }
  { const hw = document.getElementById('fHasWhatsapp'); if (hw) hw.checked = !!c.hasWhatsapp; }
  document.getElementById('fPassportOnFile').checked = !!c.passportOnFile;
  showModal();
}

// The business's OWN Gmail bases. Any dot/plus variant of these (including
// the bare address) is one of Shloime's carrier-login addresses — an
// "account email", never the customer's contact address. No guessing beyond
// this exact list.
// Every word in a name gets a capital first letter ("moshe chaim" →
// "Moshe Chaim", "cohen-levi" → "Cohen-Levi"). Only lowercase first letters
// are touched, so "McDonald" and all-caps entries stay as typed.
// Kept in step with lib/mappers' capName, which is the enforcement copy that
// runs on every write — test/nameCase.test.mjs holds the two to the same
// answers. The apostrophe only breaks a word when two or more letters follow,
// so "o'brien" capitalises but the "m" in "I'm" does not.
function capName(s) {
  return String(s || '').trim()
    .replace(/(^|[\s\-])([a-zà-ÿ])/g, (m, sep, ch) => sep + ch.toUpperCase())
    .replace(/(['’])([a-zà-ÿ])(?=[a-zà-ÿ])/g, (m, sep, ch) => sep + ch.toUpperCase());
}

const OWN_EMAIL_BASES = ['gittbilig', 'kosherconnect', 'ch7023518'];
function isOwnAccountEmail(email) {
  const m = String(email || '').toLowerCase().trim().match(/^([^@]+)@(gmail|googlemail)\.com$/);
  if (!m) return false;
  const local = m[1].split('+')[0].replace(/\./g, '');
  return OWN_EMAIL_BASES.includes(local);
}

function clearModal() {
  ['fFirstName','fLastName','fPhoneNumber','fEmail','fAddress'].forEach(id => {
    const el = document.getElementById(id);
    el.value = '';
    el.classList.remove('error');
  });
  const pf = document.getElementById('fPassportOnFile'); if (pf) pf.checked = false;
  const hw = document.getElementById('fHasWhatsapp'); if (hw) hw.checked = false;
  const ae = document.getElementById('fAccountEmail'); if (ae) ae.value = '';
  const nt = document.getElementById('fNotes'); if (nt) nt.value = '';
  document.getElementById('fCountryCode').value = '+44';
  ['errFirstName','errLastName','errPhone'].forEach(id => document.getElementById(id).classList.remove('visible'));
  ['warnPhone','warnEmail','warnName'].forEach(id => document.getElementById(id).classList.remove('visible'));
}

function showModal() { const m = document.getElementById('customerModal'); kcSaveReturnFocus('customerModal'); m.classList.remove('hidden'); suppressCardScrim(true); autofocusFirstField(m); }
function closeModal() { document.getElementById('customerModal').classList.add('hidden'); suppressCardScrim(false); kcRestoreReturnFocus('customerModal'); }

function normalizeEmail(email) {
  if (!email) return '';
  const [local, domain] = email.toLowerCase().split('@');
  if (!domain) return local;
  const cleanLocal = local.replace(/\./g, '').replace(/\+.*$/, '');
  return `${cleanLocal}@${domain}`;
}

function getFullPhone() {
  const code = document.getElementById('fCountryCode').value.replace('-CA', '');
  const num = document.getElementById('fPhoneNumber').value.trim().replace(/\s/g, '');
  return num ? `${code}${num}` : '';
}

function checkPhoneDuplicate() {
  const editId = document.getElementById('editId').value;
  const phone = getFullPhone();
  const warn = document.getElementById('warnPhone');
  if (!phone) { warn.classList.remove('visible'); return; }
  const dup = customers.find(c => c.id !== editId && c.phone && c.phone.replace(/\s/g,'') === phone.replace(/\s/g,''));
  warn.classList.toggle('visible', !!dup);
}

function checkEmailDuplicate() {
  const editId = document.getElementById('editId').value;
  const email = document.getElementById('fEmail').value.trim();
  const warn = document.getElementById('warnEmail');
  if (!email) { warn.classList.remove('visible'); return; }
  const norm = normalizeEmail(email);
  const dup = customers.find(c => c.id !== editId && c.email && normalizeEmail(c.email) === norm);
  warn.classList.toggle('visible', !!dup);
}

function checkNameDuplicate() {
  const editId = document.getElementById('editId').value;
  const first = document.getElementById('fFirstName').value.trim().toLowerCase();
  const last  = document.getElementById('fLastName').value.trim().toLowerCase();
  const warn = document.getElementById('warnName');
  if (!first || !last) { warn.classList.remove('visible'); return; }
  const dup = customers.find(c => c.id !== editId
    && c.firstName.toLowerCase() === first
    && c.lastName.toLowerCase() === last);
  warn.classList.toggle('visible', !!dup);
}

async function saveCustomer() {
  let valid = true;
  const firstName = capName(document.getElementById('fFirstName').value);
  const lastName  = capName(document.getElementById('fLastName').value);
  const phoneNum  = document.getElementById('fPhoneNumber').value.trim();
  const code      = document.getElementById('fCountryCode').value.replace('-CA', '');
  const email     = document.getElementById('fEmail').value.trim();
  const address   = document.getElementById('fAddress').value.trim();
  const notes     = document.getElementById('fNotes')?.value.trim() || '';
  const editId    = document.getElementById('editId').value;

  if (!firstName) { setErr('errFirstName', true); setInputErr('fFirstName', true); valid = false; }
  else { setErr('errFirstName', false); setInputErr('fFirstName', false); }

  if (!lastName) { setErr('errLastName', true); setInputErr('fLastName', true); valid = false; }
  else { setErr('errLastName', false); setInputErr('fLastName', false); }

  if (!phoneNum) { setErr('errPhone', 'Phone number is required'); setInputErr('fPhoneNumber', true); valid = false; }
  else { setErr('errPhone', false); setInputErr('fPhoneNumber', false); }

  if (!valid) return;

  const fullPhone = `${code} ${phoneNum}`;
  const phoneDup = customers.find(c => c.id !== editId && c.phone && c.phone.replace(/\s/g,'') === fullPhone.replace(/\s/g,''));
  if (phoneDup) {
    setErr('errPhone', '❌ This phone number is already registered.');
    setInputErr('fPhoneNumber', true);
    document.getElementById('warnPhone').classList.add('visible');
    return;
  }

  // Soft-warn on a same-name customer (schema build rule: block on email/phone
  // duplicates, WARN on name — two Moshe Katzes are legal but usually a slip).
  const nameKey = `${firstName} ${lastName}`.toLowerCase().replace(/\s+/g, ' ');
  const nameDup = customers.find(c => c.id !== editId &&
    `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase().replace(/\s+/g, ' ').trim() === nameKey);
  if (nameDup) {
    const proceed = await window.api.confirmDelete(
      `A customer named "${firstName} ${lastName}" already exists (${nameDup.phone || 'no phone'}).\n\nSave anyway as a separate customer?`
    );
    if (!proceed) return;
  }

  let accountEmail = document.getElementById('fAccountEmail')?.value.trim() || '';
  // Known own-address typed into the CONTACT field → offer to file it right.
  let contactEmail = email;
  if (contactEmail && isOwnAccountEmail(contactEmail)) {
    const move = await window.api.confirmDelete(
      `"${contactEmail}" is one of the business's own Gmail addresses (dot/plus variant).\n\nSave it as the ACCOUNT email instead of the customer's contact email?`
    );
    if (move) { if (!accountEmail) accountEmail = contactEmail; contactEmail = ''; }
  }

  const payload = { firstName, lastName, phone: fullPhone, email: contactEmail, address, notes,
    accountEmail,
    // Only sent when the field is on screen — the PUT merges over the stored
    // row, so omitting it while the WhatsApp channel is off preserves whatever
    // was already recorded instead of silently clearing it.
    ...(document.getElementById('fHasWhatsapp')
      ? { hasWhatsapp: document.getElementById('fHasWhatsapp').checked }
      : {}),
    passportOnFile: document.getElementById('fPassportOnFile').checked };

  // Both branches must survive a rejected fetch as well as {success:false} —
  // window.api.* does r.json() with no catch, so a dropped connection rejects
  // here rather than returning a body. Failure keeps the modal open with the
  // typed data intact (the convention deleteCustomer/saveCashup/reportSave
  // already follow); only success falls through to closeModal().
  const saveFailed = (res) => {
    toast((res && res.error) || 'Could not save the customer — nothing was changed. Check your connection and try again.', 'error');
  };
  if (editId) {
    payload.id = editId;
    const res = await window.api.updateCustomer(payload).catch(() => null);
    if (res && res.success) {
      const idx = customers.findIndex(c => c.id === editId);
      if (idx !== -1) customers[idx] = res.customer;
      sortCustomersAZ();  // a rename may change where they sit in A–Z
      toast('Customer updated!', 'success');

      const updated = customers.find(c => c.id === editId);
      if (updated) {
        const newName = `${updated.firstName} ${updated.lastName}`;
        let changed = false;
        rentals.forEach(r => {
          if (r.customerId === editId) {
            r.customerName  = newName;
            r.customerPhone = updated.phone || '';
            changed = true;
          }
        });
        if (changed) saveRentals(rentals);
        // #44/#71 — SIM rows carry a denormalized customerName too; keep it
        // fresh on rename (previously only rentals were patched, so SIM rows
        // kept the stale name forever).
        let simChanged = false;
        sims.forEach(s => {
          if (s.customerId === editId) { s.customerName = newName; simChanged = true; }
        });
        if (simChanged) saveSims(sims);
      }
    } else { saveFailed(res); return; }
  } else {
    const res = await window.api.addCustomer(payload).catch(() => null);
    if (res && res.success) {
      customers.push(res.customer);
      sortCustomersAZ();
      toast('Customer added!', 'success');
    } else { saveFailed(res); return; }
  }

  closeModal();
  applySearch();
  renderTableRows();
  const statEl = document.getElementById('statTotal');
  if (statEl) statEl.textContent = customers.length;
}

async function deleteCustomer(id) {
  const c = customers.find(x => x.id === id);
  if (!c) return;
  const today = localISO();
  // Block deletion unless every rental is returned with all given items decided
  // (returned or lost) — uses the same itemStatus model as the rentals tab.
  const hasUnreturned = rentals.some(r =>
    r.customerId === id && getComputedStatus(r, today) !== 'returned'
  );
  if (hasUnreturned) {
    toast('Cannot delete a customer who still has an unreturned rental.', 'error');
    return;
  }
  const confirmed = await window.api.confirmDelete(`Delete "${c.firstName} ${c.lastName}"?\n\nThis cannot be undone.`);
  if (!confirmed) return;
  // Ask the server FIRST — a customer with ledger money history is not
  // deletable (append-only wallet), and nothing local should change then.
  const res = await window.api.deleteCustomer(id);
  if (!res || res.success === false) {
    toast(res?.error || 'Could not delete this customer.', 'error');
    return;
  }
  rentals.filter(r => r.customerId === id && r.status !== 'returned').forEach(r => {
    const phone = phones.find(p => p.id === r.phoneId);
    if (phone) { phone.status = 'available'; phone.currentRental = null; }
  });
  rentals = rentals.filter(r => r.customerId !== id);
  sims    = sims.filter(s => s.customerId !== id);
  savePhones(phones);
  saveRentals(rentals);
  saveSims(sims);
  customers = customers.filter(x => x.id !== id);
  if (selectedId === id) {
    selectedId = null;
    closeCustomerCard();
  }
  applySearch();
  renderTableRows();
  const statEl = document.getElementById('statTotal');
  if (statEl) statEl.textContent = customers.length;
  toast('Customer deleted.', 'warning');
}

// ═══════════════════════════════════════════════════════
//  SIM PLANS MODULE
// ═══════════════════════════════════════════════════════

function saveSims(data, deletedIds = []) {
  if (saveBlocked('sims')) return Promise.resolve({ success: false, blocked: true });
  sims = data;
  return reportSave('sims', window.api.saveAllSims(data, deletedIds));
}

let simSearchTerm = '';
let simFilterPay = 'all';     // all | through-me | direct
let simFilterStatus = 'all';  // all | active | renewing

// Provider badge — the provider column is a wall of identical grey text, and
// a quiet tint per provider lets the eye sweep for "the Lebara ones" without
// reading every row (owner, 9 Aug 2026). Same colour for the same provider
// everywhere, however it was typed ("Lebara"/"lebara"): the providers the shop
// actually deals with carry a fixed colour and tidy label; anything new hashes
// into the same 8-tint palette (.kc-prov in the stylesheet). App-palette tints
// on purpose, not the brands' own logo colours — a column of loud brand reds
// would fight the flat design and falsely read as trouble.
const KNOWN_PROVIDERS = {
  lebara: ['Lebara', 0], '1pmobile': ['1pMobile', 1], o2: ['O2', 2],
  vodafone: ['Vodafone', 3], ee: ['EE', 4], three: ['Three', 5],
  giffgaff: ['giffgaff', 6], lycamobile: ['Lycamobile', 7],
};
function providerBadge(name) {
  const raw = String(name || '').trim();
  if (!raw) return '—';
  const norm = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  const known = KNOWN_PROVIDERS[norm];
  let tint, label;
  if (known) { [label, tint] = known; }
  else {
    let h = 0;
    for (let i = 0; i < norm.length; i++) h = (h * 31 + norm.charCodeAt(i)) >>> 0;
    tint = h % 8;
    label = raw[0].toUpperCase() + raw.slice(1);
  }
  return `<span class="kc-prov kc-prov-${tint}">${escHtml(label)}</span>`;
}

function renderSimsTab() {
  const content  = document.getElementById('mainContent');
  const today    = localISO();
  const tomorrow = localISO(new Date(Date.now() + 86400000));

  const active   = sims.filter(s => s.status === 'active').length;
  const renewing = sims.filter(s => s.status === 'active' && (s.renewalDate === today || s.renewalDate === tomorrow));
  const totalRev = sims.reduce((sum, s) => sum + (s.history || []).reduce((a, h) => a + (h.amount || 0), 0), 0);

  const bannerHtml = renewing.length > 0 ? `
    <div class="renewal-banner">
      <span style="font-size:var(--fs-title);">⚠️</span>
      <span><strong>${renewing.length} SIM${renewing.length > 1 ? 's' : ''} renewing ${renewing.some(s => s.renewalDate === today) ? 'TODAY' : 'TOMORROW'}:</strong>
      ${renewing.map(s => `<span style="margin-left:8px;">· ${escHtml(capName(s.customerName))} (${escHtml(s.simNumber)})</span>`).join('')}</span>
    </div>` : '';

  const simBar = kcFilterSort('sim', [
    { value: 'all', label: 'All plans' },
  ], [
    { value: 'name', label: 'Sort: Customer A–Z', cmp: kcCmpStr(s => s.customerName) },
    { value: 'renewal', label: 'Renewal (soonest)', cmp: (a, b) => String(a.renewalDate || '9999').localeCompare(String(b.renewalDate || '9999')) },
    { value: 'renewal_desc', label: 'Renewal (latest)', cmp: (a, b) => String(b.renewalDate || '').localeCompare(String(a.renewalDate || '')) },
    { value: 'provider', label: 'Provider A–Z', cmp: kcCmpStr(s => s.provider) },
    { value: 'recent', label: 'Recently added', cmp: kcCmpDate(s => s.createdAt || '', -1) },
  ], renderSimRows);

  content.innerHTML = `
    ${bannerHtml}
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">Total SIMs</div>
        <div class="stat-value blue">${sims.length}</div>
        <div class="stat-sub">All plans</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Active</div>
        <div class="stat-value green">${active}</div>
        <div class="stat-sub">Running now</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Renewing Soon</div>
        <div class="stat-value ${renewing.length > 0 ? 'gold' : 'purple'}">${renewing.length}</div>
        <div class="stat-sub">Today / Tomorrow</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Revenue</div>
        <div class="stat-value purple">${fmtGbp(totalRev)}</div>
        <div class="stat-sub">All charges</div>
      </div>
    </div>

    <div style="display:flex; gap:10px; margin-bottom:20px; flex-wrap:wrap; align-items:center;">
      <button class="btn btn-primary" onclick="openAddSimModal()">+ New SIM Plan</button>
      <input class="search-box" style="width:260px;" type="text" id="simSearch"
        placeholder="Search customer, number, provider…"
        value="${escHtml(simSearchTerm)}"
        oninput="simSearchTerm=this.value; renderSimRows()">
      <select class="form-input" style="width:160px;" onchange="simFilterPay=this.value; renderSimRows()">
        <option value="all" ${simFilterPay==='all'?'selected':''}>Who pays: all</option>
        <option value="through-me" ${simFilterPay==='through-me'?'selected':''}>🔄 I pay / through me</option>
        <option value="direct" ${simFilterPay==='direct'?'selected':''}>👤 Customer pays direct</option>
      </select>
      <select class="form-input" style="width:150px;" onchange="simFilterStatus=this.value; renderSimRows()">
        <option value="all" ${simFilterStatus==='all'?'selected':''}>Status: all</option>
        <option value="active" ${simFilterStatus==='active'?'selected':''}>Active only</option>
        <option value="renewing" ${simFilterStatus==='renewing'?'selected':''}>Renewing (today/tomorrow)</option>
        <option value="week" ${simFilterStatus==='week'?'selected':''}>Renews this week</option>
      </select>
      ${simBar}
      <span id="simCount" style="font-size:var(--fs-small);color:var(--muted);"></span>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Customer</th><th>Provider</th><th>SIM Number</th><th>Plan</th>
            <th>Renewal</th><th>Payment</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody id="simTableBody"></tbody>
      </table>
    </div>`;

  renderSimRows();
}

function renderSimRows() {
  const tbody = document.getElementById('simTableBody');
  if (!tbody) return;
  const today    = localISO();
  const tomorrow = localISO(new Date(Date.now() + 86400000));
  const in7      = localISO(new Date(Date.now() + 7 * 86400000));
  const term     = simSearchTerm.toLowerCase();

  const filtered = sims.filter(s => {
    if (term &&
      !(s.customerName || '').toLowerCase().includes(term) &&
      !(s.simNumber    || '').toLowerCase().includes(term) &&
      !(s.provider     || '').toLowerCase().includes(term) &&
      !(s.iccid        || '').toLowerCase().includes(term) &&
      !phoneDigitsMatch(term, customers.find(c => c.id === s.customerId))) return false;
    if (simFilterPay === 'direct' && s.paymentType !== 'direct') return false;
    if (simFilterPay === 'through-me' && s.paymentType === 'direct') return false;
    if (simFilterStatus === 'active' && s.status !== 'active') return false;
    if (simFilterStatus === 'renewing' && !(s.renewalDate === today || s.renewalDate === tomorrow)) return false;
    if (simFilterStatus === 'week' && !(s.status === 'active' && s.renewalDate && s.renewalDate >= today && s.renewalDate <= in7)) return false;
    return true;
  });

  const sorted = kcViewApply('sim', filtered);

  const countEl = document.getElementById('simCount');
  if (countEl) countEl.textContent = `${sorted.length} of ${sims.length}`;

  if (sorted.length === 0) {
    // Same trap as Rentals: with 800+ SIMs on file, "No SIM plans yet" reads
    // as the list having been wiped rather than filtered.
    const narrowed = sims.length > 0;
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="emoji">💳</div>
      <p>${narrowed ? 'No SIM plans match this view.' : 'No SIM plans yet.'}</p>
      <small>${narrowed ? '' : 'Click "+ New SIM Plan" to add one.'}</small>
      ${narrowed ? kcClearFiltersBtn('sim') : ''}</div></td></tr>`;
    return;
  }

  tbody.innerHTML = sorted.map(s => {
    const statusBadge =
      s.status === 'active'    ? `<span class="badge badge-active">Active</span>` :
      s.status === 'suspended' ? `<span class="badge badge-suspended">Suspended</span>` :
                                 `<span class="badge badge-cancelled">Cancelled</span>`;

    const isRenewingToday    = s.renewalDate === today;
    const isRenewingTomorrow = s.renewalDate === tomorrow;
    const renewalClass = isRenewingToday ? 'color:var(--danger-ink);font-weight:700;' :
                         isRenewingTomorrow ? 'color:var(--warning);font-weight:700;' : '';
    const renewalLabel = isRenewingToday ? ' ⚠️ Today!' : isRenewingTomorrow ? ' ⚠️ Tomorrow' : '';

    return `<tr style="cursor:pointer;" onclick="if(!event.target.closest('button,select,a'))openManageSimModal('${s.id}')" title="Open SIM">
      <td><div class="customer-name">${escHtml(capName(s.customerName) || '—')}</div></td>
      <td>${providerBadge(s.provider)}</td>
      <td style="font-weight:600;font-size:var(--fs-small);">${escHtml(s.simNumber || '—')}</td>
      <td style="font-size:var(--fs-small);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(s.plan || '—')}</td>
      <td class="kc-date" style="font-size:var(--fs-small);${renewalClass}">${fmtDate(s.renewalDate)}${renewalLabel}</td>
      <td style="font-size:var(--fs-small);">${s.paymentType === 'direct' ? '👤 Direct' : '🔄 Through me'}</td>
      <td>${statusBadge}</td>
      <td>
        <div class="row-actions">
          <button class="action-btn" onclick="openRemindModal('sim','${s.id}')" title="Remind me">⏰</button>
          <button class="action-btn" onclick="openManageSimModal('${s.id}')">⚙ Manage</button>
          <button class="action-btn danger" onclick="deleteSim('${s.id}')">Delete</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function openAddSimModal(preselectCustomerId = null) { openSimFormModal(null, preselectCustomerId); }
function openEditSimModal(id) { openSimFormModal(id); }

function openSimFormModal(id, preselectCustomerId = null) {
  const s = id ? sims.find(x => x.id === id) : null;
  const isEdit = !!s;
  const preselect = s ? s.customerId : preselectCustomerId;

  const customerOptions = customers.map(c =>
    `<option value="${c.id}" ${preselect === c.id ? 'selected' : ''}>${escHtml(c.firstName + ' ' + c.lastName)}</option>`
  ).join('');

  showDynamicModal(`
    <div class="modal-title">${isEdit ? '✏️ Edit SIM Plan' : '➕ New SIM Plan'}</div>
    <div class="form-grid">
      <div class="form-group form-full">
        <label class="form-label">Customer *</label>
        <select class="form-input" id="simCustomer">
          <option value="">— Select customer —</option>
          ${customerOptions}
        </select>
        <span class="form-error" id="errSimCustomer">Required</span>
      </div>
      <div class="form-group">
        <label class="form-label">Provider *</label>
        <input class="form-input" id="simProvider" type="text" placeholder="Lebara, O2, Vodafone..."
          value="${escHtml(s?.provider || '')}" autocomplete="off">
        <span class="form-error" id="errSimProvider">Required</span>
      </div>
      <div class="form-group">
        <label class="form-label">SIM Phone Number</label>
        <input class="form-input" id="simNumber" type="tel" inputmode="tel" dir="ltr" placeholder="+44 7700 900000"
          value="${escHtml(s?.simNumber || '')}" autocomplete="off">
      </div>
      <div class="form-group">
        <label class="form-label">ICCID</label>
        <input class="form-input" id="simIccid" type="text" placeholder="89441234567890123456"
          value="${escHtml(s?.iccid || '')}" autocomplete="off">
      </div>
      <div class="form-group">
        <label class="form-label">Email at Provider</label>
        <input class="form-input" id="simEmail" type="email" placeholder="kosherconnect+name@gmail.com"
          value="${escHtml(s?.email || '')}" autocomplete="off">
      </div>
      <div class="form-group form-full">
        <label class="form-label">Active Plan (description)</label>
        <input class="form-input" id="simPlan" type="text" placeholder="Unlimited calls + data, EU roaming"
          value="${escHtml(s?.plan || '')}" autocomplete="off">
      </div>
      <div class="form-group">
        <label class="form-label">Next Renewal Date</label>
        <input class="form-input" id="simRenewal" type="date" value="${s?.renewalDate || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Payment Type</label>
        <select class="form-input" id="simPayment" onchange="const show=this.value!=='direct';document.getElementById('simDdGroup').style.display=show?'block':'none';document.getElementById('simCostGroup').style.display=show?'block':'none';">
          <option value="through-me" ${!s || s.paymentType === 'through-me' ? 'selected' : ''}>🔄 Through me</option>
          <option value="direct" ${s?.paymentType === 'direct' ? 'selected' : ''}>👤 Customer pays directly</option>
        </select>
      </div>
      <div class="form-group" id="simDdGroup" style="display:${(!s || s.paymentType !== 'direct') ? 'block' : 'none'};">
        <label class="form-label">DD Collection Day</label>
        <input class="form-input" id="simDdDate" type="number" min="1" max="31" placeholder="1" value="${s?.ddDate || 1}">
        <span style="font-size:var(--fs-micro);color:var(--muted);">Day of month DD is collected (e.g. 1 = 1st of each month)</span>
      </div>
      <div class="form-group" id="simCostGroup" style="display:${(!s || s.paymentType !== 'direct') ? 'block' : 'none'};">
        <label class="form-label">Provider Monthly Cost (£)</label>
        <input class="form-input" id="simMonthlyCost" type="number" min="0" step="0.01" placeholder="0.00" value="${s?.simMonthlyCost || ''}">
        <span style="font-size:var(--fs-micro);color:var(--muted);">What you pay the provider — DD charge = this + 10% (min £2)</span>
      </div>
      <div class="form-group form-full">
        <label class="form-label">Status</label>
        <select class="form-input" id="simStatus">
          <option value="active"    ${(!s || s.status === 'active')    ? 'selected' : ''}>Active</option>
          <option value="suspended" ${s?.status === 'suspended' ? 'selected' : ''}>Suspended</option>
          <option value="cancelled" ${s?.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
        </select>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeDynamicModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveSimForm('${id || ''}')">💾 Save</button>
    </div>
  `);
}

async function saveSimForm(editId) {
  const customerId = document.getElementById('simCustomer').value;
  const provider   = document.getElementById('simProvider').value.trim();

  let valid = true;
  if (!customerId) { document.getElementById('errSimCustomer').classList.add('visible'); valid = false; }
  else              { document.getElementById('errSimCustomer').classList.remove('visible'); }
  if (!provider)   { document.getElementById('errSimProvider').classList.add('visible'); valid = false; }
  else              { document.getElementById('errSimProvider').classList.remove('visible'); }
  if (!valid) return;

  const customer = customers.find(c => c.id === customerId);
  const paymentType = document.getElementById('simPayment').value;
  const fields = {
    customerId,
    customerName:   customer ? `${customer.firstName} ${customer.lastName}` : '',
    provider,
    simNumber:      document.getElementById('simNumber').value.trim(),
    iccid:          document.getElementById('simIccid').value.trim(),
    email:          document.getElementById('simEmail').value.trim(),
    plan:           document.getElementById('simPlan').value.trim(),
    renewalDate:    document.getElementById('simRenewal').value,
    paymentType,
    status:         document.getElementById('simStatus').value,
    ddDate:         paymentType !== 'direct' ? Math.min(31, Math.max(1, parseInt(document.getElementById('simDdDate')?.value) || 1)) : null,
    simMonthlyCost: paymentType !== 'direct' ? (parseFloat(document.getElementById('simMonthlyCost')?.value) || 0) : 0,
  };

  let newSimId = null;
  let setupHistoryId = null;
  let setupFee = 0;
  if (editId) {
    const idx = sims.findIndex(s => s.id === editId);
    if (idx !== -1) sims[idx] = { ...sims[idx], ...fields };
  } else {
    setupFee = simChargePrice('activation'); // settings-driven, £20 fallback
    if (!(await kcConfirm({
      title: 'Confirm SIM setup charge',
      body: `<strong>${customer ? escName(customer.firstName) + ' ' + escName(customer.lastName) : 'Customer'}</strong><br>
        ${escHtml(provider)} SIM — initial setup`,
      amount: setupFee,
      okLabel: 'Charge setup',
    }))) return;
    const setupDate = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
    newSimId = uid();
    setupHistoryId = uid();
    sims.push({
      id: newSimId,
      ...fields,
      history: [{
        id: setupHistoryId,
        type: 'activation',
        desc: 'Initial SIM Setup',
        amount: setupFee,
        date: setupDate,
      }],
      createdAt: new Date().toISOString(),
    });
  }

  saveSims(sims);
  // Bill the setup fee to the wallet ledger (same append-only path as every
  // other charge). Idempotent via SIM-<simId>-<historyId>; a soft failure only
  // warns — the SIM record and its history blob are already saved.
  if (newSimId && setupFee > 0) {
    window.api.chargeSim({ simId: newSimId, customerId, historyId: setupHistoryId, amount: setupFee, description: 'Initial SIM Setup' })
      .then(res => { if (!res?.success) toast(res?.error || 'SIM saved, but the setup fee was not billed to the wallet.', 'error'); })
      .catch(() => toast('SIM saved, but the setup fee was not billed to the wallet.', 'error'));
  }
  closeDynamicModal();
  let extraMsg = '';
  if (newSimId) extraMsg = await applyExtraCharges('sim', newSimId, customerId, false);
  toast(`${editId ? 'SIM plan updated ✅' : 'SIM plan added ✅'}${extraMsg}`, 'success');
  renderSimsTab();
}

function openManageSimModal(id) {
  const s = sims.find(x => x.id === id);
  if (!s) return;
  const history = s.history || [];
  const totalCharged = history.reduce((sum, h) => sum + (h.amount || 0), 0);

  const historyHtml = history.length === 0
    ? `<div style="color:var(--muted);font-size:var(--fs-body);padding:10px 0;">No history yet.</div>`
    : history.slice().reverse().map(h => `
        <div class="history-item">
          <span class="history-dot dot-blue"></span>
          <span class="history-desc">${escHtml(h.desc)}</span>
          <span class="history-date">${escHtml(h.date || '')}</span>
          <span class="history-amount">${h.amount > 0 ? '£'+h.amount : '—'}</span>
          <button class="action-btn danger" style="margin-left:8px;padding:3px 8px;font-size:var(--fs-micro);"
            aria-label="Delete this charge" onclick="deleteSimCharge('${id}','${h.id}')">✕</button>
        </div>`).join('');

  showDynamicModal(`
    <div class="modal-title">💳 ${escHtml(capName(s.customerName))} ${providerBadge(s.provider)}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;font-size:var(--fs-body);">
      <div style="color:var(--muted);">SIM Number</div><div style="font-weight:600;">${escHtml(s.simNumber||'—')}</div>
      <div style="color:var(--muted);">ICCID</div><div style="font-size:var(--fs-micro);">${escHtml(s.iccid||'—')}</div>
      <div style="color:var(--muted);">Email</div><div style="font-size:var(--fs-micro);">${escHtml(s.email||'—')}</div>
      <div style="color:var(--muted);">Plan</div><div>${escHtml(s.plan||'—')}</div>
      <div style="color:var(--muted);">Renewal</div><div>${fmtDate(s.renewalDate)}</div>
      <div style="color:var(--muted);">Payment</div><div>${s.paymentType === 'direct' ? '👤 Direct' : '🔄 Through me'}</div>
      ${s.paymentType !== 'direct' ? `
      <div style="color:var(--muted);">DD Day</div><div style="font-weight:600;">${s.ddDate ? `${s.ddDate}${s.ddDate===1?'st':s.ddDate===2?'nd':s.ddDate===3?'rd':'th'} of each month` : '—'}</div>
      <div style="color:var(--muted);">Next DD Amount</div><div style="font-weight:700;color:var(--success);">${s.simMonthlyCost ? fmtGbp(ddMonthlyAmount(s.simMonthlyCost)) : '—'}</div>
      ` : ''}
      <div style="color:var(--muted);">Status</div><div>${s.status}</div>
    </div>

    <div class="section-divider">Service History</div>
    <div class="history-list" id="simHistoryList">${historyHtml}</div>

    <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:16px;">
      <div class="section-divider" style="margin-top:0;">Add Charge</div>
      ${multiSimDiscountPct(sims, s.customerId) > 0
        ? `<div style="font-size:var(--fs-small);color:var(--gold);margin-bottom:8px;">🏷️ 3+ active plans — ${multiSimDiscountPct(sims, s.customerId)}% off applied to monthly/annual prefills.</div>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;">
        <div style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:160px;">
          <label style="font-size:var(--fs-micro);color:var(--muted);font-weight:600;">Type</label>
          <select class="form-input" id="simChargeType" onchange="onSimChargeTypeChange('${id}')" style="font-size:var(--fs-body);">
            <option value="activation">🟢 Initial Setup — £${simChargePrice('activation')}</option>
            <!-- Service is the default: setup was already charged when the SIM was created. -->
            <option value="service" selected>🔧 Service (roaming/swap/reactivation) — £${simChargePrice('service')}</option>
            <option value="sim-replacement">📦 SIM Replacement — £${simChargePrice('sim-replacement')}</option>
            <option value="monthly">${s.paymentType !== 'direct' && s.simMonthlyCost ? `📅 Monthly DD — ${fmtGbp(ddMonthlyAmount(s.simMonthlyCost))}` : '📅 Monthly Subscription'}</option>
            <option value="annual">📅 Annual Subscription — £${simChargePrice('annual')}</option>
            ${simMenu.map(m => `<option value="menu:${escHtml(String(m.id))}">🛒 ${escHtml(m.name)} — ${fmtGbp(m.price)}</option>`).join('')}
            <option value="custom">✏️ Custom</option>
          </select>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;width:80px;">
          <label style="font-size:var(--fs-micro);color:var(--muted);font-weight:600;">Amount £</label>
          <input class="form-input" id="simChargeAmount" type="number" value="${simChargePrice('service')}" min="0" step="0.5" style="font-size:var(--fs-body);">
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;flex:2;min-width:140px;">
          <label style="font-size:var(--fs-micro);color:var(--muted);font-weight:600;">Note (optional)</label>
          <input class="form-input" id="simChargeNote" type="text" placeholder="e.g. SIM swapped to new number" style="font-size:var(--fs-body);">
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;width:150px;">
          <label style="font-size:var(--fs-micro);color:var(--muted);font-weight:600;">Paid now?</label>
          <select class="form-input" id="simChargePay" style="font-size:var(--fs-body);">
            <option value="account">On account</option>
            <option value="cash">💵 Cash</option>
            <option value="card">💳 Card</option>
            <option value="bank_transfer">🏦 Bank transfer</option>
          </select>
        </div>
        <button class="btn btn-primary btn-sm" onclick="addSimCharge('${id}')">+ Add</button>
      </div>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
      <span style="font-size:var(--fs-body);color:var(--muted);">Total charged: <strong style="color:var(--success);">${fmtGbp(totalCharged)}</strong></span>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-outline btn-sm" onclick="openEditSimModal('${id}');void(0)">✏️ Edit details</button>
        <button class="btn btn-outline btn-sm" onclick="closeDynamicModal()">Close</button>
      </div>
    </div>
  `);
}

// SIM charge prices come from Settings (BUSINESS_RULES §2); numbers here are
// only the offline fallback and MUST mirror the seed.
function simChargePrice(type) {
  switch (type) {
    case 'activation':      return settingNum('sim_activation_fee', 20);
    case 'service':         return settingNum('sim_service_fee', 5);
    case 'sim-replacement': return settingNum('sim_replacement_fee', 10);
    case 'annual':          return settingNum('sim_annual_fee', 20);
    default:                return undefined;
  }
}

// Monthly DD through-me price: provider cost + max(pct%, £min).
function ddMonthlyAmount(cost) {
  // #30 — the SIM DD surcharge is a service fee for running the direct debit,
  // with its own keys. (The old rental "Pay later" surcharge was removed — a
  // charge for paying later is ribis — so there is no fallback to it now.)
  const pct = settingNum('sim_dd_surcharge_pct', 10) / 100;
  const min = settingNum('sim_dd_surcharge_min', 2);
  return round2(cost + Math.max(cost * pct, min));
}

const SIM_CHARGE_DESCS  = {
  activation: 'Initial SIM Setup',
  service: 'Service (roaming / swap / reactivation)',
  'sim-replacement': 'SIM Replacement',
  monthly: 'Monthly DD',
  annual: 'Annual Subscription',
};

function onSimChargeTypeChange(simId) {
  const type  = document.getElementById('simChargeType').value;
  const amtEl = document.getElementById('simChargeAmount');
  const s = simId ? sims.find(x => x.id === simId) : null;
  // Menu products (SIM-only monthlies, TomTom): prefill the menu price.
  if (type.startsWith('menu:')) {
    const m = simMenu.find(x => String(x.id) === type.slice(5));
    amtEl.value = m ? m.price : 0;
    return;
  }
  // 3+ active plans → 10% off the recurring (monthly/annual) prefills.
  const multiOff = s && (type === 'monthly' || type === 'annual')
    ? 1 - multiSimDiscountPct(sims, s.customerId) / 100 : 1;
  if (type === 'monthly') {
    if (s && s.paymentType !== 'direct' && s.simMonthlyCost) {
      amtEl.value = (ddMonthlyAmount(s.simMonthlyCost) * multiOff).toFixed(2);
    } else {
      amtEl.value = 0;
    }
  } else if (simChargePrice(type) !== undefined) {
    amtEl.value = type === 'annual'
      ? +(simChargePrice(type) * multiOff).toFixed(2)
      : simChargePrice(type);
  } else {
    amtEl.value = 0;
  }
}

async function addSimCharge(simId) {
  const s = sims.find(x => x.id === simId);
  if (!s) return;
  const type   = document.getElementById('simChargeType').value;
  const amount = parseFloat(document.getElementById('simChargeAmount').value) || 0;
  if (amount <= 0) { toast('Amount must be greater than £0', 'error'); return; }
  const note   = document.getElementById('simChargeNote').value.trim();
  const payMethod = document.getElementById('simChargePay')?.value || 'account';
  const payLabel = { cash: 'cash', card: 'card', bank_transfer: 'bank transfer' }[payMethod] || '';
  const menuItem = type.startsWith('menu:') ? simMenu.find(x => String(x.id) === type.slice(5)) : null;
  const baseDesc = menuItem?.name || SIM_CHARGE_DESCS[type] || 'Custom charge';
  const desc   = note ? `${baseDesc} — ${note}` : baseDesc;
  if (!(await kcConfirm({
    title: 'Confirm SIM charge',
    body: `<strong>${escName(s.customerName || 'Customer')}</strong><br>${escHtml(desc)}${payLabel ? `<br>Paid now — ${payLabel}` : ''}`,
    amount,
    okLabel: 'Add charge',
  }))) return;
  if (!s.history) s.history = [];
  const historyId = uid();
  s.history.push({
    id:     historyId,
    type, desc, amount,
    date: new Date().toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }),
  });
  if (type === 'monthly' && s.renewalDate) {
    const d = parseLocalDate(s.renewalDate);
    d.setMonth(d.getMonth() + 1);
    s.renewalDate = localISO(d);
  }
  saveSims(sims);
  // Post the charge to the wallet ledger (SIM money now shows in the balance
  // and arrears). "Paid now" then posts the matching payment — same mechanism
  // as the rental/repair flows — so the two rows net out at the counter.
  window.api.chargeSim({ simId: s.id, customerId: s.customerId, historyId, amount, description: desc })
    .then(res => {
      if (!res?.success) { toast(res?.error || 'Charge saved, but not billed to the wallet.', 'error'); return; }
      if (payMethod !== 'account') {
        return window.api.addLedgerEntry({ customerId: s.customerId, kind: 'payment', amount, method: payMethod, note: `Paid at counter — ${desc}`, clientRef: kcRef() })
          .then(pr => { if (!pr?.success) toast(pr?.error || 'Charge billed, but the payment was not recorded.', 'error'); });
      }
    })
    .catch(() => toast('Charge saved, but not billed to the wallet.', 'error'));
  toast(`Charge of ${fmtGbp(amount)} added${payMethod !== 'account' ? ` — settled by ${payLabel}` : ''} ✅`, 'success');
  openManageSimModal(simId);
}

function deleteSimCharge(simId, chargeId) {
  const s = sims.find(x => x.id === simId);
  if (!s) return;
  s.history = (s.history || []).filter(h => h.id !== chargeId);
  saveSims(sims);
  toast('Charge removed.', 'warning');
  openManageSimModal(simId);
}

async function deleteSim(id) {
  const s = sims.find(x => x.id === id);
  if (!s) return;
  // #64 — money-affecting delete: confirm through the amount-aware modal.
  if (!(await kcConfirm({
    title: 'Delete SIM plan?',
    body: `<strong>${escHtml(capName(s.customerName) || 'SIM plan')}</strong>${s.provider ? ' · ' + escHtml(s.provider) : ''}<br>Any SIM charges on the wallet are reversed. This can’t be undone.`,
    okLabel: 'Delete SIM plan',
  }))) return;
  sims = sims.filter(x => x.id !== id);
  const res = await saveSims(sims, [id]);
  renderSimsTab();
  if (res && res.success === false) return; // reportSave already warned
  toast('SIM plan deleted.', 'warning');
}

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
function setErr(id, msgOrFalse) {
  const el = document.getElementById(id);
  if (msgOrFalse) {
    el.textContent = typeof msgOrFalse === 'string' ? msgOrFalse : el.dataset.default || 'Required';
    el.classList.add('visible');
  } else {
    el.classList.remove('visible');
  }
}
function setInputErr(id, isErr) {
  const el = document.getElementById(id);
  el.classList.toggle('error', isErr);
  // Announce the invalid state to assistive tech; the field's aria-describedby
  // already points at its error text, so the reason is read out too.
  if (isErr) el.setAttribute('aria-invalid', 'true');
  else el.removeAttribute('aria-invalid');
}

// Placeholders get written for the desk, where the field is wide. On a phone
// the same box is a third of the width and the long ones are cut mid-word —
// the till's scan box showed "🔍 Scan a barc", which reads as a broken field
// rather than a hint. Ask for the short form when the screen is narrow.
// Evaluated when the field renders, which is when these two are opened.
function kcHint(long, short) {
  return window.matchMedia('(max-width: 640px)').matches ? short : long;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// escHtml for people's names: also tidies capitals ("elishe halbershtam" →
// "Elishe Halbershtam"). The sheet/ELID imports stored names as the
// spreadsheets had them, and capName only runs when a name is SAVED through
// the form — so every table and title that echoes a stored name goes through
// this instead of plain escHtml. Display-only; the stored data is untouched.
function escName(str) {
  return escHtml(capName(str));
}

// Escape a name AND isolate its text direction. <bdi> stops a mixed
// Hebrew/Latin name (RTL) from visually reordering against adjacent LTR
// content — a badge, phone number, date or parenthetical. Inert for plain
// Latin names (no visual change), so it's safe to use everywhere a person's
// name is shown.
function nameHtml(str) { return `<bdi>${escHtml(str)}</bdi>`; }

// Escape a value placed inside a single-quoted JS string in an inline handler
// (onclick="fn('...')"). HTML-encoding ALONE is not enough there — the parser
// decodes entities before the JS runs, so a ' in the value would still break out.
// JS-escape backslash + quote first, then HTML-escape so it also survives the
// attribute. Use for every user-controlled value passed to an inline handler. U8.
function escJs(str) {
  return escHtml(String(str == null ? '' : str).replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
}

// Skeleton loading — the wait mirrors the incoming layout instead of
// announcing itself (DESIGN.md §Loading). 'stats' ghosts the usual
// stats-row + table page; 'columns' ghosts a two-column card tab.
// Each tab passes its OWN shape. A skeleton is only worth having if it is the
// silhouette of the thing arriving — otherwise it is a second layout that
// flashes and is replaced, which reads as the page changing its mind. The two
// fixed shapes this used to offer meant Tasks (four cards, a toolbar and two
// columns) ghosted as three cards over one list, so nothing landed where the
// ghost had put it. TAB_SKELETON below carries the measured shape of every
// tab; passing a string still works for the two legacy kinds.
const TAB_SKELETON = {
  wallet:   { cards: 4, toolbar: true, cols: 2 },
  repairs:  { cards: 4, toolbar: true, cols: 1 },
  services: { cards: 3, toolbar: true, cols: 2 },
  shop:     { cards: 4, toolbar: true, cols: 1 },
  koltorah: { cards: 0, toolbar: true, cols: 1 },
  tasks:    { cards: 4, toolbar: true, cols: 2 },
  virtual:  { cards: 2, toolbar: true, cols: 1 },
  settings: { cards: 0, toolbar: true, cols: 1 },
  bank:     { cards: 0, toolbar: true, cols: 1 },
};

function skeletonHtml(shape = 'stats') {
  // The ghosts are aria-hidden noise, so a real (visually hidden) "Loading…"
  // rides along — the spinner it replaced announced itself as text, and a
  // screen reader must not land on an empty main region.
  const sr = `<span class="kc-sr-only" role="status">Loading…</span>`;
  const rows = (n, panel = '') =>
    `<div class="kc-skel-panel">${panel}${'<div class="kc-skel"></div>'.repeat(n)}</div>`;
  const card = `<div class="kc-skel-card"><div class="kc-skel kc-skel-label"></div><div class="kc-skel kc-skel-big"></div></div>`;
  const title = '<div class="kc-skel kc-skel-title"></div>';

  const cfg = typeof shape === 'string'
    ? (TAB_SKELETON[shape] || (shape === 'columns'
        ? { cards: 0, toolbar: false, cols: 2 }
        : { cards: 3, toolbar: false, cols: 1 }))
    : shape;

  const stats = cfg.cards ? `<div class="stats-row">${card.repeat(cfg.cards)}</div>` : '';
  const bar = cfg.toolbar ? '<div class="kc-skel kc-skel-bar"></div>' : '';
  const body = cfg.cols === 2
    ? `<div class="kc-skel-cols">${rows(5, title)}${rows(5, title)}</div>`
    : rows(7, title);
  return `${sr}<div aria-hidden="true">${stats}${bar}${body}</div>`;
}

// An error state with a Retry — never a dead-end, and never a reassuring
// empty shell when the backend is actually unreachable. Retry re-renders the
// current tab.
function errorHtml(label = 'Couldn’t load this') {
  return `<div style="text-align:center;padding:48px 30px;color:var(--muted);">
    <div style="font-size:30px;margin-bottom:8px;">⚠️</div>
    <div style="font-size:var(--fs-lead);color:var(--text);margin-bottom:4px;">${escHtml(label)}</div>
    <div style="font-size:var(--fs-body);margin-bottom:16px;">Couldn’t reach the server. Your data is safe — this is just the view.</div>
    <button class="btn btn-primary" onclick="renderTab(currentTab)">↻ Try again</button>
  </div>`;
}

// Collision-safe id (#45): Date.now() alone collides when two records are
// minted in the same millisecond (unique legacy_id then rejects one).
//
// This mirrors lib/uid.mjs::uid exactly (canonical + unit-tested — see
// test/uid.test.mjs). Kept as a mirror here only because the browser has no
// bundler. Change both together — including the digit width, which is 6 and
// not 3 because a bulk import mints far more than two rows per millisecond.
function uid() {
  return String(Date.now()) + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
}

// Money with thousands separators — "£13,135.00", not "£13135.00".
function fmtGbp(v) {
  return '£' + (Number(v) || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Light/dark theme. Applied pre-paint by an inline script in _document.js;
// this just flips + persists. Any toggle button re-labels via updateThemeBtns.
function toggleTheme() {
  const el = document.documentElement;
  const dark = el.getAttribute('data-theme') === 'dark';
  // 'light' is set, not removed: an absent attribute means "no choice yet",
  // which is what the OS-dark palettes on /welcome and the legal pages key on.
  if (dark) { el.setAttribute('data-theme', 'light'); try { localStorage.setItem('kcTheme', 'light'); } catch {} }
  else { el.setAttribute('data-theme', 'dark'); try { localStorage.setItem('kcTheme', 'dark'); } catch {} }
  updateThemeBtns();
}
function updateThemeBtns() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.querySelectorAll('[data-theme-btn]').forEach(b => { b.textContent = dark ? '☀️' : '🌙'; });
}

// Simple Mode — text size. Three steps of one multiplier (--fs-scale in
// globals.css), which scales the whole type ramp and therefore the whole app,
// rather than a handful of hand-picked "make these bigger" rules that leave
// 15px body copy sitting beside 11px badges.
//
// A device preference like the theme, not an account setting: the counter
// tablet and the owner's laptop want different answers, and the same person
// signs in on both.
const TEXT_SIZES = [
  { key: 'standard', label: 'Standard', mark: '' },
  { key: 'large', label: 'Large', mark: 'large' },
  { key: 'largest', label: 'Largest', mark: 'largest' },
];

function currentTextSize() {
  const mark = document.documentElement.getAttribute('data-fs') || '';
  return TEXT_SIZES.find(s => s.mark === mark) || TEXT_SIZES[0];
}

// Cycles rather than opening a menu. Three steps is few enough that pressing
// through them is faster than choosing from a list, and the whole app resizing
// under the press is its own preview.
function cycleTextSize() {
  const next = TEXT_SIZES[(TEXT_SIZES.indexOf(currentTextSize()) + 1) % TEXT_SIZES.length];
  if (next.mark) document.documentElement.setAttribute('data-fs', next.mark);
  else document.documentElement.removeAttribute('data-fs');
  try { localStorage.setItem('kcTextSize', next.key); } catch {}
  updateTextSizeBtns();
  toast(`Text size: ${next.label}`, 'success');
}

function updateTextSizeBtns() {
  const size = currentTextSize();
  document.querySelectorAll('[data-textsize-btn]').forEach(b => {
    b.title = `Text size: ${size.label}`;
    // The label names the state, not the action, because the action is "cycle"
    // and "cycle text size" tells a screen-reader user nothing about where they
    // currently are.
    b.setAttribute('aria-label', `Text size: ${size.label}. Press to change.`);
    b.dataset.size = size.key;
  });
}

// Copy text to the clipboard with a confirmation toast. Used by the
// check-in passport details (airline forms need each value pasted).
function copyText(text, label) {
  const t = String(text == null ? '' : text);
  const done = () => toast(`Copied ${label || ''}`.trim() + (t.length < 30 ? ` — ${t}` : ''), 'success');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(t).then(done).catch(() => fallbackCopy(t, done));
  } else fallbackCopy(t, done);
}
function fallbackCopy(t, done) {
  const ta = document.createElement('textarea');
  ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); done(); } catch { toast('Copy failed', 'error'); }
  ta.remove();
}

function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  const body = document.createElement('span');
  body.textContent = msg;
  el.appendChild(body);
  // Errors AND warnings announce assertively (role=alert) and stay until
  // dismissed — the money-critical ones are warnings ("card machine approved
  // after the till gave up — re-ring the SAME items"), and a 3s clock threw
  // those away before they could be read. Success/info stay polite and
  // auto-clear, but on a timer that scales with reading time (~60ms/char)
  // instead of a flat 3s that truncated the long ones mid-sentence.
  const sticky = type === 'error' || type === 'warning';
  el.setAttribute('role', sticky ? 'alert' : 'status');
  // A real button, not just a click handler on the div: dismissal has to be
  // reachable from the keyboard, and one control here serves every call site.
  const x = document.createElement('button');
  x.type = 'button';
  x.className = 'toast-x';
  x.setAttribute('aria-label', 'Dismiss');
  x.textContent = '✕';
  x.addEventListener('click', (e) => { e.stopPropagation(); el.remove(); });
  el.appendChild(x);
  el.title = 'Click to dismiss';
  el.style.cursor = 'pointer';
  el.addEventListener('click', () => el.remove());
  if (!sticky) setTimeout(() => el.remove(), Math.min(12000, Math.max(3000, 900 + msg.length * 60)));
  container.appendChild(el);
}

// ── Undo toast (Gmail pattern) ──
// One pending destructive action at a time: the UI updates optimistically and
// the server call is HELD for a few seconds while a toast offers Undo. Undo →
// restore() puts the row back and nothing was ever sent. Timeout, starting a
// second undoable action, or leaving the page → commit() runs for real.
let kcUndoPending = null; // { timer, commit, el }
function kcUndoFlush() {
  const p = kcUndoPending;
  if (!p) return;
  kcUndoPending = null;
  clearTimeout(p.timer);
  if (p.el) p.el.remove();
  try { p.commit(); } catch { /* commit paths surface their own errors */ }
}
window.addEventListener('pagehide', kcUndoFlush);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') kcUndoFlush();
});

function kcUndoable({ label, commit, restore, seconds = 6 }) {
  kcUndoFlush(); // at most one pending — a second action commits the first
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast toast-warning kc-undo-toast';
  el.setAttribute('role', 'status');
  const txt = document.createElement('span');
  txt.textContent = label;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'kc-undo-btn';
  btn.textContent = 'Undo';
  el.appendChild(txt);
  el.appendChild(btn);
  container.appendChild(el);
  const timer = setTimeout(kcUndoFlush, seconds * 1000);
  kcUndoPending = { timer, commit, el };
  btn.addEventListener('click', () => {
    if (kcUndoPending && kcUndoPending.el === el) {
      clearTimeout(kcUndoPending.timer);
      kcUndoPending = null;
    }
    el.remove();
    try { restore(); } catch { /* view re-renders on next action */ }
  });
}

// ─────────────────────────────────────────────
//  TICKETS & FLIGHTS (bookings)
// ─────────────────────────────────────────────
// Tables-native: rows live in the relational bookings table and creating a
// booking posts a BOOKING-<id> wallet charge to the append-only ledger.

const BOOKING_STATUSES = ['Booked', 'Ticketed', 'Completed', 'Cancelled'];

function bookingStatusBadge(status) {
  // Route through the themed .badge-* classes (each has a dark override) instead
  // of inline hex — inline colours didn't flip for dark theme, so "Booked" went
  // dark-on-dark in the evening. These four all clear AA in both themes.
  const cls = {
    Booked:    'badge-booking',
    Ticketed:  'badge-vn',
    Completed: 'badge-active',
    Cancelled: 'badge-cancelled',
  };
  // For flights, "Completed" reads more naturally as "Flown".
  const label = status === 'Completed' ? '✈️ Flown' : status;
  return `<span class="badge ${cls[status] || 'badge-booking'}">${escHtml(label)}</span>`;
}

function renderBookingsTab() {
  const content = document.getElementById('mainContent');
  const today = localISO();
  const active = bookings.filter(b => b.status !== 'Cancelled');
  const upcoming = active.filter(b => b.travelDate && b.travelDate >= today).length;
  const feesEarned = active.reduce((s, b) => s + (b.bookingFee || 0), 0);
  const totalCharged = active.reduce((s, b) => s + (b.price || 0) + (b.bookingFee || 0), 0);

  const bkBar = kcFilterSort('bookings', [
    { value: 'all', label: 'Filter: all bookings' },
    { value: 'upcoming', label: '✈️ Upcoming travel', test: b => b.status !== 'Cancelled' && b.status !== 'Completed' && (!b.travelDate || b.travelDate >= today) },
    { value: 'completed', label: '✓ Completed', test: b => b.status === 'Completed' },
    { value: 'cancelled', label: '✕ Cancelled', test: b => b.status === 'Cancelled' },
  ], [
    { value: 'travel', label: 'Sort: Travel (soonest)', cmp: (a, b) => String(a.travelDate || '9999').localeCompare(String(b.travelDate || '9999')) },
    { value: 'travel_desc', label: 'Travel (latest)', cmp: (a, b) => String(b.travelDate || '').localeCompare(String(a.travelDate || '')) },
    { value: 'name', label: 'Customer A–Z', cmp: kcCmpStr(b => b.customerName) },
    { value: 'recent', label: 'Recently added', cmp: kcCmpDate(b => b.createdAt || '', -1) },
    { value: 'price', label: 'Price (high–low)', cmp: kcCmpNum(b => (b.price || 0) + (b.bookingFee || 0)) },
  ], renderBookingsTab);
  const bkShown = kcViewApply('bookings', bookings);
  const rows = loadFailed.bookings
    ? `<tr><td colspan="9">${errorHtml('Couldn’t load your bookings')}</td></tr>`
    : bkShown.length === 0
    ? `<tr><td colspan="9"><div class="empty-state"><div class="emoji">✈️</div><p>${bookings.length ? 'No bookings match this filter.' : 'No bookings yet.'}</p><small>${bookings.length ? 'Change the filter above.' : 'Click "New Booking" to add the first one.'}</small>${kcClearFiltersBtn('bookings')}</div></td></tr>`
    : bkShown.map(b => `
      <tr style="cursor:pointer;" onclick="if(!event.target.closest('button,select,a'))openEditBookingModal('${escHtml(b.id)}')" title="Open booking">
        <td><div class="customer-name">${escName(b.customerName || '—')}</div>
            <div class="customer-email">${escName(b.passenger || '')}${(b.passengers || []).length ? ` · 👥 ${b.passengers.length}` : ''}</div></td>
        <td style="white-space:nowrap;">${escHtml(b.route)}</td>
        <td>${escHtml(b.airline || '—')}<div class="customer-email">${escHtml(b.bookingReference || '')}</div></td>
        <td class="kc-date">${b.travelDate ? fmtDate(b.travelDate) : '—'}
            <div class="customer-email">${escHtml(b.departureTime || '')}${b.arrivalTime ? ' → ' + escHtml(b.arrivalTime) : ''}</div></td>
        <td>${fmtGbp((b.price || 0))}</td>
        <td>${fmtGbp((b.bookingFee || 0))}</td>
        <td>${bookingStatusBadge(b.status)}</td>
        <td style="cursor:pointer;" onclick="openCheckinModal('${escHtml(b.id)}')" title="Set check-in">${checkinChip(b)}</td>
        <td>
          <div class="row-actions">
          <button class="action-btn" onclick="openCheckinModal('${escHtml(b.id)}')" title="Online check-in">🛫</button>
          <button class="action-btn" onclick="openPassengersModal('${escHtml(b.id)}')" title="Passengers (DOB, passport)">👥</button>
          <button class="action-btn danger" onclick="deleteBookingRow('${escHtml(b.id)}')" title="Delete booking" aria-label="Delete booking">✕</button>
          <button class="action-btn" onclick="openRemindModal('booking','${escHtml(b.id)}')" title="Remind me">⏰</button>
          <select class="form-input" style="width:110px;padding:5px 8px;font-size:var(--fs-small);"
            aria-label="Status for ${escHtml(b.customerName || b.bookingRef || 'this booking')}"
            onchange="changeBookingStatus('${escHtml(b.id)}', this.value)">
            ${BOOKING_STATUSES.map(s => `<option value="${s}" ${b.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
          </div>
        </td>
      </tr>`).join('');

  content.innerHTML = `
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">Total Bookings</div><div class="stat-value">${bookings.length}</div></div>
      <div class="stat-card"><div class="stat-label">Upcoming Travel</div><div class="stat-value">${upcoming}</div></div>
      <div class="stat-card"><div class="stat-label">Booking Fees</div><div class="stat-value">${fmtGbp(feesEarned)}</div></div>
      <div class="stat-card"><div class="stat-label">Total Charged</div><div class="stat-value">${fmtGbp(totalCharged)}</div></div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
      ${bkBar}
      <button class="btn btn-primary" onclick="openNewBookingModal()">+ New booking</button>
    </div>
    <div class="table-card">
      <table>
        <thead><tr>
          <th>Customer</th><th>Route</th><th>Airline / Ref</th><th>Travel</th>
          <th>Price</th><th>Fee</th><th>Status</th><th>Check-in</th><th></th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

let ticketsMenu = [];

// ── Passengers editor (shared by New Booking + the 👥 modal) ──
// Working copy lives in bkPassengers while a modal is open; inputs write
// straight into it so re-renders (add/remove row) never lose typing.
// Passport fields are owner-only on reads: helpers can type them in, but
// existing values come back blank for them (blank = unchanged on save).
let bkPassengers = [];

// One card per passenger — everything the airline check-in form asks for.
// Passport № is hidden from helpers in this editor (they can still see it on
// the check-in screen); the merge-on-save keeps a blank from erasing it.
function paxEditorHtml() {
  const helperMasked = currentStaff && currentStaff.role !== 'owner';
  const fld = (label, inner) => `<label style="display:flex;flex-direction:column;gap:2px;font-size:var(--fs-micro);color:var(--muted);">${label}${inner}</label>`;
  return bkPassengers.map((p, i) => `
    <div style="border:1px solid var(--border);border-radius:8px;padding:8px 10px;margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <strong style="font-size:var(--fs-small);">Passenger ${i + 1}</strong>
        <button type="button" class="action-btn" onclick="bkRemovePax(${i})" title="Remove">✕</button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${fld('Full name (as on passport)', `<input class="form-input" value="${escName(p.fullName || '')}" oninput="bkPassengers[${i}].fullName=this.value" autocomplete="off" style="width:200px;">`)}
        ${fld('Date of birth', `<input class="form-input" type="date" value="${escHtml(p.dob || '')}" onchange="bkPassengers[${i}].dob=this.value" autocomplete="off" style="width:150px;">`)}
        ${fld('Nationality', `<input class="form-input" value="${escHtml(p.nationality || '')}" oninput="bkPassengers[${i}].nationality=this.value" autocomplete="off" placeholder="e.g. British" style="width:140px;">`)}
        ${fld('Passport №', `<input class="form-input" value="${escHtml(p.passportNumber || '')}" oninput="bkPassengers[${i}].passportNumber=this.value" autocomplete="off" placeholder="${helperMasked ? 'hidden — check-in screen' : ''}" style="width:150px;">`)}
        ${fld('Passport expiry', `<input class="form-input" type="date" value="${escHtml(p.passportExpiry || '')}" onchange="bkPassengers[${i}].passportExpiry=this.value" style="width:150px;">`)}
        ${fld('Issue date', `<input class="form-input" type="date" value="${escHtml(p.passportIssueDate || '')}" onchange="bkPassengers[${i}].passportIssueDate=this.value" style="width:150px;">`)}
        ${fld('Issuing country', `<input class="form-input" value="${escHtml(p.issuingCountry || '')}" oninput="bkPassengers[${i}].issuingCountry=this.value" placeholder="e.g. UK" style="width:140px;">`)}
      </div>
    </div>`).join('');
}

function bkRenderPax() {
  const el = document.getElementById('bkPaxEditor');
  if (el) el.innerHTML = paxEditorHtml();
  // Keep the fee calculator's passenger count in step with the rows.
  const pax = document.getElementById('bkPax');
  if (pax) { pax.value = Math.max(1, bkPassengers.length); bkCalcFee(); }
}

function bkAddPax() { bkPassengers.push({}); bkRenderPax(); }
function bkRemovePax(i) { bkPassengers.splice(i, 1); if (!bkPassengers.length) bkPassengers.push({}); bkRenderPax(); }

// #48 — a family flies twice a year; don't retype six passports. When a
// customer is chosen, offer to reuse the passenger list from their most recent
// booking that had one. Only offered while the editor is still untouched
// (single blank row), so it never clobbers data already entered.
function bkLastTripPassengers(customerId) {
  const prior = bookings
    .filter(b => b.customerId === customerId && Array.isArray(b.passengers) && b.passengers.some(p => p && p.fullName))
    .sort((a, b) => String(b.travelDate || b.createdAt || '').localeCompare(String(a.travelDate || a.createdAt || '')));
  return prior.length ? prior[0] : null;
}
function bkOnCustomerChange() {
  const wrap = document.getElementById('bkReuseWrap');
  if (!wrap) return;
  const cid = document.getElementById('bkCustomer')?.value;
  const editorEmpty = bkPassengers.length <= 1 && !(bkPassengers[0] && bkPassengers[0].fullName);
  const last = cid ? bkLastTripPassengers(cid) : null;
  if (!last || !editorEmpty) { wrap.innerHTML = ''; return; }
  const n = last.passengers.filter(p => p && p.fullName).length;
  wrap.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;background:rgba(83,58,253,0.06);border:1px solid var(--primary-subdued);border-radius:8px;padding:7px 12px;font-size:var(--fs-small);">
      <span style="flex:1;">↻ Reuse ${n} passenger${n === 1 ? '' : 's'} from their last trip${last.route ? ' (' + escHtml(last.route) + ')' : ''}?</span>
      <button type="button" class="btn btn-outline btn-sm" style="font-size:var(--fs-micro);padding:4px 10px;" onclick="bkReuseLastTrip('${escHtml(String(cid))}')">Reuse passengers</button>
    </div>`;
}
function bkReuseLastTrip(customerId) {
  const last = bkLastTripPassengers(customerId);
  if (!last) return;
  // Deep copy so edits here never mutate the previous booking's records.
  bkPassengers = last.passengers.filter(p => p && p.fullName).map(p => ({ ...p }));
  if (!bkPassengers.length) bkPassengers = [{}];
  bkRenderPax();
  const wrap = document.getElementById('bkReuseWrap');
  if (wrap) wrap.innerHTML = `<div style="font-size:var(--fs-micro);color:var(--success);padding:2px 0;">✓ Reused ${bkPassengers.length} passenger${bkPassengers.length === 1 ? '' : 's'} — check passport expiry dates.</div>`;
}

// Post-creation editor: the 👥 button on each booking row.
function openPassengersModal(bookingId) {
  const b = bookings.find(x => x.id === bookingId);
  if (!b) return;
  bkPassengers = (b.passengers || []).map(p => ({ ...p }));
  if (!bkPassengers.length) bkPassengers.push({});
  showDynamicModal(`
    <div class="modal-title">👥 Passengers — ${escHtml(b.route)} ${b.travelDate ? fmtDate(b.travelDate) : ''}</div>
    <div id="bkPaxEditor">${paxEditorHtml()}</div>
    <button type="button" class="btn btn-outline" onclick="bkAddPax()"
      style="padding:5px 12px;font-size:var(--fs-small);margin-top:2px;">+ Add passenger</button>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeDynamicModal()">Cancel</button>
      <button class="btn btn-primary" onclick="savePassengers('${escHtml(bookingId)}')">Save passengers</button>
    </div>
  `);
}

async function savePassengers(bookingId) {
  bkPassengers.forEach(p => { if (p.fullName) p.fullName = capName(p.fullName); });
  const res = await window.api.updateBooking({ id: bookingId, passengers: bkPassengers });
  if (!res.success) { toast(res.error || 'Could not save passengers.', 'error'); return; }
  const idx = bookings.findIndex(x => x.id === bookingId);
  if (idx !== -1) bookings[idx] = res.booking;
  closeDynamicModal();
  toast('Passengers saved.', 'success');
  renderBookingsTab();
}

async function openNewBookingModal(preselectCustomerId = null) {
  bkPassengers = [{}];
  if (!ticketsMenu.length) {
    ticketsMenu = await window.api.getServiceMenu('tickets').catch(() => []);
    if (!Array.isArray(ticketsMenu)) ticketsMenu = [];
  }
  const customerOptions = customers.map(c =>
    `<option value="${c.id}" ${c.id === preselectCustomerId ? 'selected' : ''}>${escName(c.firstName)} ${escName(c.lastName)} · ${escHtml(fmtPhone(c.phone || ''))}</option>`
  ).join('');
  const startFee = ticketsMenu.find(s => /start fee/i.test(s.name));
  const svcOptions = ticketsMenu
    .filter(s => !/start fee/i.test(s.name))
    .map(s => `<option value="${escHtml(s.id)}">${escHtml(s.name)} — ${fmtGbp(s.price)}</option>`)
    .join('');
  showDynamicModal(`
    <div class="modal-title">✈️ New booking</div>
    <div class="form-grid">
      <div class="form-group form-full">
        <label class="form-label">Customer *</label>
        <select class="form-input" id="bkCustomer" onchange="bkOnCustomerChange()">
          <option value="">Select customer…</option>${customerOptions}
        </select>
      </div>
      <div class="form-group form-full">
        <label class="form-label">Passengers <span style="color:var(--muted);font-weight:400;">(name · date of birth · passport)</span></label>
        <div id="bkReuseWrap" style="margin-bottom:8px;"></div>
        <div id="bkPaxEditor">${paxEditorHtml()}</div>
        <button type="button" class="btn btn-outline" onclick="bkAddPax()"
          style="padding:5px 12px;font-size:var(--fs-small);margin-top:2px;">+ Add passenger</button>
      </div>
      <div class="form-group">
        <label class="form-label">Route *</label>
        <input class="form-input" id="bkRoute" placeholder="e.g. LTN → TLV">
      </div>
      <div class="form-group">
        <label class="form-label">Airline</label>
        <input class="form-input" id="bkAirline" placeholder="e.g. Wizz Air">
      </div>
      <div class="form-group">
        <label class="form-label">Booking Reference</label>
        <input class="form-input" id="bkRef" placeholder="Airline ref (may come later)">
      </div>
      <div class="form-group">
        <label class="form-label">Travel Date *</label>
        <input class="form-input" type="date" id="bkTravelDate" onchange="showHebrewDate('bkTravelDate','bkTravelHeb')">
        <div class="hebrew-date" id="bkTravelHeb"></div>
      </div>
      <div class="form-group">
        <label class="form-label">Departure / Arrival</label>
        <div style="display:flex;gap:6px;">
          <input class="form-input" type="time" id="bkDep">
          <input class="form-input" type="time" id="bkArr">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Ticket Price (£) *</label>
        <input class="form-input" type="number" min="0" step="0.01" id="bkPrice">
      </div>
      <div class="form-group">
        <label class="form-label">Booking Fee (£)</label>
        <input class="form-input" type="number" min="0" step="0.01" id="bkFee" value="10">
      </div>
      <div class="form-group form-full">
        <label class="form-label">Payment</label>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <select class="form-input" id="bkPay" style="width:200px;">
            <option value="account">Put on account (wallet)</option>
            <option value="cash">Paid now — 💵 Cash</option>
            <option value="card">Paid now — 💳 Card</option>
            <option value="card_on_file">Paid now — card on file (Stripe)</option>
            <option value="bank_transfer">Paid now — 🏦 Transfer</option>
          </select>
          <span style="font-size:var(--fs-micro);color:var(--muted);">"Paid now" settles it immediately — no wallet debt.</span>
        </div>
      </div>
      ${svcOptions ? `
      <div class="form-group form-full">
        <label class="form-label">Fee calculator <span style="color:var(--muted);font-weight:400;">(passenger tiers — fills Booking Fee)</span></label>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <select class="form-input" id="bkSvc" onchange="bkCalcFee()" style="flex:2;min-width:200px;">
            <option value="">Choose service…</option>${svcOptions}
          </select>
          <input class="form-input" type="number" id="bkPax" value="1" min="1" step="1"
            oninput="bkCalcFee()" title="Passengers" style="width:80px;">
          ${startFee ? `<label style="display:flex;align-items:center;gap:6px;font-size:var(--fs-small);cursor:pointer;">
            <input type="checkbox" id="bkStartFee" onchange="bkCalcFee()"> + start fee ${fmtGbp(startFee.price)}
          </label>` : ''}
        </div>
        <div id="bkFeeBreakdown" style="font-size:var(--fs-micro);color:var(--muted);margin-top:4px;"></div>
      </div>` : ''}
      <div class="form-group">
        <label class="form-label">Passport photocopy held?</label>
        <div style="display:flex;gap:8px;align-items:center;">
          <input type="checkbox" id="bkPassport" onchange="document.getElementById('bkPassportExpiryWrap').style.display=this.checked?'block':'none'">
          <div id="bkPassportExpiryWrap" style="display:none;flex:1;">
            <input class="form-input" type="date" id="bkPassportExpiry" title="Passport expiry">
          </div>
        </div>
      </div>
      <div class="form-group form-full">
        <label class="form-label">Online check-in</label>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <select class="form-input" id="bkCheckinBy" style="width:180px;" onchange="bkCheckinToggle()">
            <option value="customer">Customer does check-in</option>
            <option value="us">We do check-in</option>
          </select>
          <label style="display:flex;align-items:center;gap:6px;font-size:var(--fs-body);cursor:pointer;">
            <input type="checkbox" id="bkCheckinDone"> already done
          </label>
          <span id="bkCheckinDateWrap" style="display:none;align-items:center;gap:6px;">
            <span style="font-size:var(--fs-small);color:var(--muted);">do it on</span>
            <input class="form-input" type="date" id="bkCheckinDate" style="width:150px;">
          </span>
        </div>
        <div style="font-size:var(--fs-micro);color:var(--muted);margin-top:4px;">"We do check-in" + a date raises a task reminder for that day.</div>
      </div>
      <div class="form-group form-full">
        <label class="form-label">Notes</label>
        <input class="form-input" id="bkNotes">
      </div>
    </div>
    <div style="margin-top:8px;padding:10px;border-radius:8px;background:var(--bg-secondary);font-size:var(--fs-small);color:var(--muted);">
      Saving posts one wallet charge of <strong>price + fee</strong> to the customer's ledger (reference <code>BOOKING-…</code>).
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeDynamicModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveNewBooking()">✈️ Save booking</button>
    </div>
  `);
  if (preselectCustomerId) bkOnCustomerChange(); // #48 — offer passenger reuse straight away
}

// Fee calculator: tiered service fee × passengers (+ optional start fee)
// → fills the Booking Fee field (still editable afterwards).
function bkCalcFee() {
  const svcId = document.getElementById('bkSvc')?.value;
  if (!svcId) { const bd = document.getElementById('bkFeeBreakdown'); if (bd) bd.textContent = ''; return; }
  const svc = ticketsMenu.find(s => String(s.id) === String(svcId));
  if (!svc) return;
  const n = Math.max(1, parseInt(document.getElementById('bkPax')?.value, 10) || 1);
  const startFee = document.getElementById('bkStartFee')?.checked
    ? (ticketsMenu.find(s => /start fee/i.test(s.name))?.price || 0) : 0;
  const fee = ticketFeeFor(svc, n) + startFee;
  document.getElementById('bkFee').value = fee.toFixed(2);
  const parts = [`1 × ${fmtGbp(svc.price)}`];
  if (n > 1 && svc.repeatPrice !== null) parts.push(`${Math.min(n - 1, 4)} × ${fmtGbp(Number(svc.repeatPrice))}`);
  if (n > 5 && svc.repeatPrice !== null) parts.push(`${n - 5} × ${fmtGbp(Number(svc.bulkPrice ?? svc.repeatPrice))}`);
  if (startFee) parts.push(`start ${fmtGbp(startFee)}`);
  document.getElementById('bkFeeBreakdown').textContent =
    `${n} passenger${n === 1 ? '' : 's'}: ${parts.join(' + ')} = ${fmtGbp(fee)}`;
}

// Show the check-in date only when WE do the check-in; default it to the day
// before travel (online check-in typically opens ~24h out).
function bkCheckinToggle() {
  const us = document.getElementById('bkCheckinBy')?.value === 'us';
  const wrap = document.getElementById('bkCheckinDateWrap');
  if (wrap) wrap.style.display = us ? 'inline-flex' : 'none';
  const dateEl = document.getElementById('bkCheckinDate');
  if (us && dateEl && !dateEl.value) {
    const travel = document.getElementById('bkTravelDate')?.value;
    if (travel) { const d = parseLocalDate(travel); d.setDate(d.getDate() - 1); dateEl.value = localISO(d); }
  }
}

async function saveNewBooking() {
  const paxList = bkPassengers.filter(p => (p.fullName || '').trim());
  paxList.forEach(p => { p.fullName = capName(p.fullName); });
  const payload = {
    customerId:       document.getElementById('bkCustomer').value,
    passenger:        paxList.map(p => p.fullName).join(', '),
    passengers:       paxList,
    route:            document.getElementById('bkRoute').value.trim(),
    airline:          document.getElementById('bkAirline').value.trim(),
    bookingReference: document.getElementById('bkRef').value.trim(),
    travelDate:       document.getElementById('bkTravelDate').value,
    departureTime:    document.getElementById('bkDep').value,
    arrivalTime:      document.getElementById('bkArr').value,
    price:            parseFloat(document.getElementById('bkPrice').value),
    bookingFee:       parseFloat(document.getElementById('bkFee').value) || 0,
    passportOnFile:   document.getElementById('bkPassport').checked,
    passportExpiry:   document.getElementById('bkPassport').checked
                        ? document.getElementById('bkPassportExpiry').value : '',
    payment:          document.getElementById('bkPay').value,
    checkinBy:        document.getElementById('bkCheckinBy').value,
    checkinDone:      document.getElementById('bkCheckinDone').checked,
    checkinDate:      document.getElementById('bkCheckinBy').value === 'us'
                        ? document.getElementById('bkCheckinDate').value : '',
    notes:            document.getElementById('bkNotes').value.trim(),
  };
  if (!payload.customerId) { toast('Select a customer.', 'error'); return; }
  if (!payload.route)      { toast('Route is required.', 'error'); return; }
  if (!payload.travelDate) { toast('Travel date is required.', 'error'); return; }
  if (!Number.isFinite(payload.price) || payload.price < 0) { toast('Enter a valid ticket price.', 'error'); return; }

  // Idempotent booking: one token for this submit (dedupes a retry server-side) and
  // an in-flight guard so a double-click can't create two bookings / two charges.
  payload.clientRef = kcRef();
  const guardKey = 'booking:' + payload.customerId + ':' + payload.route + ':' + payload.travelDate;
  if (!kcBeginWrite(guardKey)) return;
  let res;
  try {
    const bkCust = customers.find(c => c.id === payload.customerId);
    if (!(await kcConfirm({
      title: 'Confirm booking charge',
      body: `<strong>${bkCust ? escName(bkCust.firstName) + ' ' + escName(bkCust.lastName) : 'Customer'}</strong><br>
        ${escHtml(payload.route)}${payload.airline ? ' · ' + escHtml(payload.airline) : ''} · ${fmtDate(payload.travelDate)}<br>
        Ticket ${fmtGbp(payload.price)}${payload.bookingFee ? ` + fee ${fmtGbp(payload.bookingFee)}` : ''}${payload.payment === 'paid' ? ' · paid now' : ' · on account'}`,
      amount: payload.price + (payload.bookingFee || 0),
      okLabel: 'Charge booking',
    }))) return;
    res = await window.api.addBooking(payload);
  } finally {
    kcEndWrite(guardKey);
  }
  if (!res.success) { toast(res.error || 'Could not save the booking.', 'error'); return; }
  if (res.duplicate) {
    closeDynamicModal();
    if (res.booking && !bookings.some(x => x.id === res.booking.id)) bookings.unshift(res.booking);
    toast('Already booked — no double charge.', 'info');
    renderBookingsTab();
    return;
  }

  bookings.unshift(res.booking);
  await maybeCheckinTask(res.booking);
  closeDynamicModal();
  let chargeMsg = '';
  if (res.chargePosted) {
    chargeMsg = res.paidNow
      ? ` ${fmtGbp(res.charged)} paid in full.`
      : ` ${fmtGbp(res.charged)} on account — wallet balance ${fmtGbp(res.balance)}.`;
  }
  if (res.extras?.length) chargeMsg += ` Incl. ${res.extras.map(e => `${e.label} ${fmtGbp(e.amount)}`).join(', ')}.`;
  toast(`Booking saved!${chargeMsg}`, 'success');
  renderBookingsTab();
}

// When WE own an unfinished check-in with a date, raise a High task on that
// day so it isn't forgotten. Idempotent-ish: keyed note so re-saves don't
// spam (best-effort — the tasks API dedups on nothing, so we only call this
// on explicit save/toggle).
async function maybeCheckinTask(b) {
  if (!b || b.checkinBy !== 'us' || b.checkinDone || !b.checkinDate) return;
  await window.api.addTask({
    title: `🛫 Check in ${b.customerName || b.passenger || ''} — ${b.route}`.trim(),
    dueDate: b.checkinDate,
    priority: 'High',
    notes: `Online check-in for flight ${b.route}${b.airline ? ' (' + b.airline + ')' : ''} on ${fmtDate(b.travelDate)}. Booking ref ${b.bookingReference || '—'}.`,
    customerId: b.customerId || null,
    snoozedUntil: b.checkinDate,
  }).catch(() => null);
}

async function openCheckinModal(bookingId) {
  const b = bookings.find(x => x.id === bookingId);
  if (!b) return;
  // Pull the full, unmasked passenger details for the check-in itself.
  const detail = await kcFetch('/api/bookings?checkin=' + encodeURIComponent(bookingId))
    .then(r => r.json()).catch(() => null);
  const pax = detail?.success ? (detail.booking.passengers || []) : (b.passengers || []);
  // Each value is a click-to-copy chip (airline forms need them pasted one
  // by one), plus a "Copy all" that grabs the whole passenger block.
  // The copied value defaults to exactly what's shown (WYSIWYG) — pass `raw`
  // only when the copy should differ from the label. Dates therefore copy as
  // the displayed DD/MM/YYYY, never the raw ISO (YYYY-MM-DD).
  const cell = (lbl, val, raw) => val ? `
    <div style="display:flex;align-items:center;gap:6px;">
      <span style="color:var(--muted);">${lbl}:</span>
      <strong class="copy-val" tabindex="0" role="button" title="Click to copy ${lbl}"
        onclick="copyText('${escHtml(String(raw != null ? raw : val)).replace(/'/g, "\\'")}','${lbl}')">${escHtml(val)}</strong>
    </div>` : '';
  const paxAll = (p) => [
    p.fullName && `Name: ${p.fullName}`, p.dob && `DOB: ${fmtDate(p.dob)}`, p.nationality && `Nationality: ${p.nationality}`,
    p.passportNumber && `Passport: ${p.passportNumber}`, p.passportExpiry && `Expiry: ${fmtDate(p.passportExpiry)}`,
    p.passportIssueDate && `Issued: ${fmtDate(p.passportIssueDate)}`, p.issuingCountry && `Issuing country: ${p.issuingCountry}`,
  ].filter(Boolean).join('\n');
  const paxHtml = pax.length ? `
    <div class="section-divider" style="margin:4px 0 8px;">Passenger details <span style="color:var(--muted);font-weight:400;font-size:var(--fs-micro);">— click any value to copy</span></div>
    <div style="max-height:260px;overflow-y:auto;margin-bottom:12px;">
      ${pax.map((p, i) => `
        <div style="border:1px solid var(--border);border-radius:8px;padding:8px 10px;margin-bottom:8px;font-size:var(--fs-small);line-height:1.7;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong class="copy-val" tabindex="0" role="button" style="font-size:var(--fs-body);" title="Click to copy name" onclick="copyText('${escJs(p.fullName || '')}','name')">${escName(p.fullName || '(no name)')}</strong>
            <button type="button" class="btn btn-outline btn-sm" style="font-size:var(--fs-micro);padding:3px 10px;"
              onclick="copyText(paxCopyBlocks[${i}],'all details')">📋 Copy all</button>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 16px;margin-top:4px;">
            ${cell('DOB', p.dob && fmtDate(p.dob))}
            ${cell('Nationality', p.nationality)}
            ${cell('Passport №', p.passportNumber)}
            ${cell('Expiry', p.passportExpiry && fmtDate(p.passportExpiry))}
            ${cell('Issued', p.passportIssueDate && fmtDate(p.passportIssueDate))}
            ${cell('Issuing country', p.issuingCountry)}
          </div>
          ${(!p.passportNumber && !p.dob) ? '<div style="color:var(--warning);margin-top:4px;">⚠️ Missing details — open 👥 Passengers to fill them in.</div>' : ''}
        </div>`).join('')}
    </div>` : `<div style="font-size:var(--fs-small);color:var(--muted);margin-bottom:12px;">No passenger details yet — add them via the 👥 button.</div>`;
  // Stash the copy-all text keyed by index (avoids quoting a multi-line
  // string into an inline handler).
  window.paxCopyBlocks = pax.map(paxAll);
  showDynamicModal(`
    <div class="modal-title">🛫 Check-in — ${escHtml(b.route)} ${b.travelDate ? fmtDate(b.travelDate) : ''}</div>
    ${paxHtml}
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Who checks in?</label>
        <select class="form-input" id="ciBy" onchange="document.getElementById('ciDateWrap').style.display=this.value==='us'?'block':'none'">
          <option value="customer" ${b.checkinBy !== 'us' ? 'selected' : ''}>Customer does it</option>
          <option value="us" ${b.checkinBy === 'us' ? 'selected' : ''}>We do it</option>
        </select>
      </div>
      <div class="form-group" id="ciDateWrap" style="display:${b.checkinBy === 'us' ? 'block' : 'none'};">
        <label class="form-label">Do it on</label>
        <input class="form-input" type="date" id="ciDate" value="${escHtml(b.checkinDate || '')}">
      </div>
      <div class="form-group form-full">
        <label style="display:flex;align-items:center;gap:8px;font-size:var(--fs-ui);cursor:pointer;">
          <input type="checkbox" id="ciDone" ${b.checkinDone ? 'checked' : ''}>
          ✅ Check-in is done
        </label>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeDynamicModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveCheckin('${escHtml(bookingId)}')">Save</button>
    </div>
  `);
}

async function saveCheckin(bookingId) {
  const by = document.getElementById('ciBy').value;
  const res = await window.api.updateBooking({
    id: bookingId,
    checkinBy: by,
    checkinDone: document.getElementById('ciDone').checked,
    checkinDate: by === 'us' ? document.getElementById('ciDate').value : '',
  });
  if (!res.success) { toast(res.error || 'Could not save check-in.', 'error'); return; }
  const idx = bookings.findIndex(x => x.id === bookingId);
  if (idx !== -1) bookings[idx] = res.booking;
  await maybeCheckinTask(res.booking);
  closeDynamicModal();
  toast('Check-in updated.', 'success');
  renderBookingsTab();
}

// Small status chip for a booking's check-in state.
function checkinChip(b) {
  if (b.checkinDone) return `<span class="badge badge-active" title="Check-in done">✅ In</span>`;
  if (b.checkinBy === 'us') return `<span class="badge badge-rental" title="We check in${b.checkinDate ? ' on ' + fmtDate(b.checkinDate) : ''}">🛫 us${b.checkinDate ? ' ' + fmtDate(b.checkinDate).slice(0, 5) : ''}</span>`;
  if (b.checkinBy === 'customer') return `<span class="badge" style="background:rgba(148,163,184,0.15);color:var(--muted);" title="Customer checks in">👤 cust</span>`;
  return `<span class="badge" style="background:rgba(234,179,8,0.15);color:var(--warning-ink);" title="Check-in not set">⚠️ ?</span>`;
}

async function changeBookingStatus(id, status) {
  const res = await window.api.updateBooking({ id, status });
  if (!res.success) { toast(res.error || 'Could not update status.', 'error'); renderBookingsTab(); return; }
  const idx = bookings.findIndex(b => b.id === id);
  if (idx !== -1) bookings[idx] = res.booking;
  renderBookingsTab();
  toast(`Booking marked ${status}.`, 'success');
}

// Open a booking to edit its flight details. Money (price + fee) is shown
// read-only — corrections go through a wallet adjustment so the ledger
// stays honest. Passengers and check-in have their own dedicated editors.
// Delete a booking outright — for rows that should never have existed
// (imported junk, duplicates, typos). Real charged bookings are protected:
// the server refuses when wallet charges are linked and points at Cancelled,
// which reverses the money. Same undo-toast pattern as deletePhone: the row
// vanishes immediately, the server delete waits out the undo window.
function deleteBookingRow(id) {
  const idx = bookings.findIndex(x => x.id === id);
  const b = bookings[idx];
  if (!b) return;
  const putBack = () => {
    bookings.splice(Math.min(idx, bookings.length), 0, b);
    if (currentTab === 'bookings') renderBookingsTab();
  };
  bookings.splice(idx, 1);
  if (currentTab === 'bookings') renderBookingsTab();
  kcUndoable({
    label: `Booking ${b.route || ''} deleted.`.replace('  ', ' '),
    restore: putBack,
    commit: async () => {
      const res = await window.api.deleteBooking(id);
      if (!res || !res.success) {
        toast((res && res.error) || 'Could not delete the booking.', 'error');
        putBack();
      }
    },
  });
}

function openEditBookingModal(id) {
  const b = bookings.find(x => x.id === id);
  if (!b) return;
  showDynamicModal(`
    <div class="modal-title">✈️ ${escName(b.customerName || 'Booking')} — ${escHtml(b.route || '')}</div>
    <div class="form-grid">
      <div class="form-group form-full">
        <label class="form-label">Passenger(s) summary</label>
        <input class="form-input" id="ebPassenger" value="${escName(b.passenger || '')}" placeholder="Names">
      </div>
      <div class="form-group"><label class="form-label">Route *</label>
        <input class="form-input" id="ebRoute" value="${escHtml(b.route || '')}"></div>
      <div class="form-group"><label class="form-label">Airline</label>
        <input class="form-input" id="ebAirline" value="${escHtml(b.airline || '')}"></div>
      <div class="form-group"><label class="form-label">Booking reference</label>
        <input class="form-input" id="ebRef" value="${escHtml(b.bookingReference || '')}"></div>
      <div class="form-group"><label class="form-label">Travel date</label>
        <input class="form-input" type="date" id="ebTravel" value="${escHtml(b.travelDate || '')}"></div>
      <div class="form-group"><label class="form-label">Departure / Arrival</label>
        <div style="display:flex;gap:6px;">
          <input class="form-input" type="time" id="ebDep" value="${escHtml(b.departureTime || '')}">
          <input class="form-input" type="time" id="ebArr" value="${escHtml(b.arrivalTime || '')}">
        </div></div>
      <div class="form-group"><label class="form-label">Status</label>
        <select class="form-input" id="ebStatus">
          ${BOOKING_STATUSES.map(s => `<option value="${s}" ${b.status === s ? 'selected' : ''}>${s === 'Completed' ? 'Completed / Flown' : s}</option>`).join('')}
        </select></div>
      <div class="form-group"><label class="form-label">Passport photocopy held?</label>
        <div style="display:flex;gap:8px;align-items:center;">
          <input type="checkbox" id="ebPassport" ${b.passportOnFile ? 'checked' : ''}
            onchange="document.getElementById('ebPExpWrap').style.display=this.checked?'block':'none'">
          <div id="ebPExpWrap" style="display:${b.passportOnFile ? 'block' : 'none'};flex:1;">
            <input class="form-input" type="date" id="ebPExp" value="${escHtml(b.passportExpiry || '')}" title="Passport expiry">
          </div>
        </div></div>
      <div class="form-group form-full"><label class="form-label">Notes</label>
        <textarea class="form-input" id="ebNotes" rows="2">${escHtml(b.notes || '')}</textarea></div>
    </div>
    <div style="margin-top:8px;padding:10px;border-radius:8px;background:var(--bg-secondary);font-size:var(--fs-small);color:var(--muted);">
      💷 Price <strong>${fmtGbp((b.price || 0))}</strong> + fee <strong>${fmtGbp((b.bookingFee || 0))}</strong> (read-only — adjust money via the customer's wallet).
      &nbsp;·&nbsp; <a href="#" onclick="closeDynamicModal();openPassengersModal('${escHtml(b.id)}');return false;">👥 Passengers</a>
      &nbsp;·&nbsp; <a href="#" onclick="closeDynamicModal();openCheckinModal('${escHtml(b.id)}');return false;">🛫 Check-in</a>
      &nbsp;·&nbsp; <a href="#" onclick="closeDynamicModal();openTravelReqModal('${escHtml(b.id)}');return false;">🛂 Travel requirements</a>
    </div>
    <div class="modal-actions" style="justify-content:space-between;">
      <button class="btn btn-outline" style="color:var(--danger);border-color:color-mix(in srgb, var(--danger) 40%, var(--border));"
        onclick="closeDynamicModal();deleteBookingRow('${escHtml(b.id)}')">🗑 Delete</button>
      <span style="display:flex;gap:10px;">
        <button class="btn btn-outline" onclick="closeDynamicModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveEditBooking('${escHtml(b.id)}')">💾 Save</button>
      </span>
    </div>
  `);
}

async function saveEditBooking(id) {
  const route = document.getElementById('ebRoute').value.trim();
  if (!route) { toast('Route is required.', 'error'); return; }
  const passportOnFile = document.getElementById('ebPassport').checked;
  const res = await window.api.updateBooking({
    id,
    passenger: document.getElementById('ebPassenger').value.trim(),
    route,
    airline: document.getElementById('ebAirline').value.trim(),
    bookingReference: document.getElementById('ebRef').value.trim(),
    travelDate: document.getElementById('ebTravel').value,
    departureTime: document.getElementById('ebDep').value,
    arrivalTime: document.getElementById('ebArr').value,
    status: document.getElementById('ebStatus').value,
    passportOnFile,
    passportExpiry: passportOnFile ? document.getElementById('ebPExp').value : '',
    notes: document.getElementById('ebNotes').value.trim(),
  });
  if (!res.success) { toast(res.error || 'Could not save the booking.', 'error'); return; }
  const idx = bookings.findIndex(x => x.id === id);
  if (idx !== -1) bookings[idx] = res.booking;
  closeDynamicModal();
  toast('Booking updated.', 'success');
  renderBookingsTab();
}

// ─────────────────────────────────────────────
//  TRAVEL REQUIREMENTS  (🛂)
// ─────────────────────────────────────────────
// Per-booking panel: for each passenger, what entry authorisation is needed
// (ESTA / eTA / ETA-IL / visa / none) given their nationality + the trip's
// destination, whether the passport is valid long enough, and whether a
// recorded authorisation covers the trip. The rules run server-side
// (lib/travelRules.mjs) — this only renders. Actions are DIY: an official
// link + a draft message for the customer. GUIDANCE ONLY — the panel always
// tells staff to confirm on the official site.

const KC_DEST_NAMES = { US: 'USA', IL: 'Israel', CA: 'Canada', EU: 'Europe (Schengen)', UK: 'United Kingdom' };
const KC_RECORDABLE = new Set(['ESTA', 'ETA_CA', 'ETA_IL', 'ETIAS', 'ETA_UK']);

// Badge text colour is ALWAYS a token, never a literal — a literal cannot flip
// for the dark theme, and a translucent wash over a dark card leaves dark text
// on a dark background. These five chips were #07639e (2.32:1 in dark) and the
// CHECK chip's brown-on-cream missed AA in *light* too, at 3.97:1 on 11px text.
function travelReqBadge(code, label) {
  const styles = {
    ESTA:   'background:rgba(7,99,158,0.14);color:var(--accent);',
    ETA_CA: 'background:rgba(7,99,158,0.14);color:var(--accent);',
    ETA_IL: 'background:rgba(7,99,158,0.14);color:var(--accent);',
    ETIAS:  'background:rgba(7,99,158,0.14);color:var(--accent);',
    ETA_UK: 'background:rgba(7,99,158,0.14);color:var(--accent);',
    VISA:   'background:rgba(239,68,68,0.14);color:var(--danger-ink);',
    NONE:   'background:rgba(34,197,94,0.15);color:var(--success-ink);',
    CHECK:  'background:var(--canvas-cream);color:var(--gold);',
  };
  return `<span class="badge" style="${styles[code] || styles.CHECK}">${escHtml(label)}</span>`;
}

async function openTravelReqModal(bookingId) {
  const res = await window.api.getTravelReqView(bookingId).catch(() => null);
  if (!res || !res.success) {
    toast((res && res.error) || 'Could not load travel requirements.', 'error');
    return;
  }
  const destSel = ['', 'US', 'IL', 'CA', 'EU', 'UK'].map(code =>
    `<option value="${code}" ${res.destination === code ? 'selected' : ''}>${code ? KC_DEST_NAMES[code] : '— choose destination —'}</option>`
  ).join('');
  const destName = KC_DEST_NAMES[res.destination] || '';

  const paxHtml = (res.passengers || []).filter(p => p.name).map((p, i) => {
    const r = p.requirement || {};
    const cov = p.coverage || {};
    const auth = (res.authorisations || []).find(a =>
      a.travellerName.trim().toLowerCase() === p.name.trim().toLowerCase() && a.type === r.code);
    // passport readiness line
    let pass = '';
    if (p.passport.ok === true) pass = `<span style="color:var(--success);">✓ Passport valid long enough</span>`;
    else if (p.passport.ok === false) pass = `<span style="color:var(--danger-ink);">⚠ ${escHtml(p.passport.note)}</span>`;
    else pass = `<span style="color:var(--muted);">Passport expiry not on file</span>`;

    // coverage + actions
    let cover = '';
    const validity = r.validityMonths ? ` · valid ~${Math.round(r.validityMonths / 12)} yr${r.validityMonths >= 24 ? 's' : ''}` : '';
    const link = r.url ? `<a href="${escHtml(r.url)}" target="_blank" rel="noopener">Open official site ↗</a>` : '';
    const draftBtn = r.code !== 'NONE'
      ? `<a href="#" onclick="copyTravelDraft(${JSON.stringify(destName)},${JSON.stringify(r.label)},${JSON.stringify(r.url || '')});return false;">✉️ Copy draft for customer</a>` : '';

    if (cov.status === 'not-needed') {
      cover = `<div style="color:var(--success);font-size:var(--fs-body);">No entry authorisation needed — passport only.</div>`;
    } else if (cov.status === 'check') {
      cover = `<div style="font-size:var(--fs-body);color:var(--gold);">${escHtml(r.note || 'Confirm the requirement on the official site before travel.')} ${link}</div>`;
    } else if (KC_RECORDABLE.has(r.code)) {
      const covLine = cov.status === 'covered'
        ? `<span style="color:var(--success);">✓ ${escHtml(r.label)} on file — valid until ${escHtml(cov.validUntil || '')}</span>`
        : cov.status === 'expiring'
          ? `<span style="color:var(--gold);">⚠ ${escHtml(r.label)} ${cov.expiresBeforeTravel ? 'expires BEFORE this trip' : 'expiring soon'} — valid until ${escHtml(cov.validUntil || '')}</span>`
          : `<span style="color:var(--danger-ink);">Not recorded yet — ${escHtml(r.label)} needed${validity}</span>`;
      cover = `
        <div style="font-size:var(--fs-body);margin-bottom:6px;">${covLine}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
          <input class="form-input" id="traUntil_${i}" type="date" value="${escHtml(auth ? auth.validUntil : '')}" title="Approved until" style="width:150px;">
          <input class="form-input" id="traRef_${i}" value="${escHtml(auth ? auth.reference : '')}" placeholder="Reference no." style="width:150px;">
          <button class="btn btn-outline btn-sm" style="font-size:var(--fs-small);padding:4px 10px;"
            onclick="recordTravelAuth('${escHtml(bookingId)}','${escHtml(res.customerId)}',${i},${JSON.stringify(p.name)},'${r.code}','${escHtml(res.destination)}')">
            ${auth ? 'Update' : 'Record'} approved-until</button>
          ${auth ? `<button class="btn btn-outline btn-sm" style="font-size:var(--fs-small);padding:4px 10px;color:var(--danger-ink);" onclick="deleteTravelAuthRow('${escHtml(bookingId)}','${escHtml(auth.id)}')">Remove</button>` : ''}
        </div>
        <div style="font-size:var(--fs-small);margin-top:6px;">${link} ${link && draftBtn ? '&nbsp;·&nbsp;' : ''} ${draftBtn}</div>`;
    } else {
      cover = `<div style="font-size:var(--fs-body);">${link} ${draftBtn}</div>`;
    }

    return `
      <div style="border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
          <strong>${escHtml(p.name)}</strong>
          <span style="font-size:var(--fs-small);color:var(--muted);">${escHtml(p.nationality || 'nationality not set')}</span>
        </div>
        <div style="margin-bottom:6px;">${travelReqBadge(r.code, r.label)}${r.note && cov.status !== 'check' ? `<span style="font-size:var(--fs-small);color:var(--muted);margin-left:8px;">${escHtml(r.note)}</span>` : ''}</div>
        <div style="font-size:var(--fs-body);margin-bottom:8px;">${pass}</div>
        ${cover}
      </div>`;
  }).join('');

  showDynamicModal(`
    <div class="modal-title">🛂 Travel requirements${res.route ? ` — ${escHtml(res.route)}` : ''}</div>
    <div class="form-group form-full">
      <label class="form-label">Destination</label>
      <select class="form-input" onchange="saveBookingDestination('${escHtml(bookingId)}', this.value)">${destSel}</select>
    </div>
    ${!res.destination ? `<div style="color:var(--muted);font-size:var(--fs-body);margin:6px 0 4px;">Choose the destination to see what each passenger needs.</div>` : ''}
    ${res.destination && !paxHtml ? `<div style="color:var(--muted);font-size:var(--fs-body);margin:6px 0;">No passengers on this booking yet — add them under 👥 Passengers.</div>` : ''}
    <div style="margin-top:10px;">${paxHtml}</div>
    <div style="font-size:var(--fs-small);color:var(--muted);background:var(--bg-secondary);border-radius:8px;padding:8px 10px;margin-top:4px;">
      ℹ️ Guidance based on the rules we've set for common routes — <strong>always confirm on the official site</strong> before travel. Requirements can change.
    </div>
    <div class="modal-actions">
      <button class="btn btn-primary" onclick="closeDynamicModal();openEditBookingModal('${escHtml(bookingId)}')">← Back to booking</button>
    </div>
  `);
}

async function saveBookingDestination(bookingId, value) {
  const res = await window.api.updateBooking({ id: bookingId, destinationCountry: value });
  if (!res.success) { toast(res.error || 'Could not save destination.', 'error'); return; }
  const idx = bookings.findIndex(x => x.id === bookingId);
  if (idx !== -1) bookings[idx] = res.booking;
  openTravelReqModal(bookingId);
}

async function recordTravelAuth(bookingId, customerId, i, name, type, country) {
  const validUntil = document.getElementById(`traUntil_${i}`)?.value || '';
  const reference = document.getElementById(`traRef_${i}`)?.value.trim() || '';
  if (!validUntil) { toast('Enter the “approved until” date.', 'error'); return; }
  const res = await window.api.saveTravelAuth({ customerId, travellerName: name, type, country, validUntil, reference });
  if (!res.success) { toast(res.error || 'Could not save the record.', 'error'); return; }
  toast('Saved ✓', 'success');
  openTravelReqModal(bookingId);
}

async function deleteTravelAuthRow(bookingId, id) {
  if (!confirm('Remove this recorded authorisation?')) return;
  const res = await window.api.deleteTravelAuth(id);
  if (!res.success) { toast(res.error || 'Could not remove it.', 'error'); return; }
  toast('Removed.', 'success');
  openTravelReqModal(bookingId);
}

function copyTravelDraft(destName, label, url) {
  const lines = [
    `Hi,`,
    ``,
    `For your trip${destName ? ` to ${destName}` : ''} you'll need ${label} before you travel.`,
    url ? `You can apply here (official site): ${url}` : `Please apply on the official government site before you travel.`,
    `It usually only takes a few minutes. Once it's approved, please let us know.`,
    ``,
    `Thank you,`,
    `Kosher Connect`,
  ];
  const text = lines.join('\n');
  navigator.clipboard.writeText(text).then(
    () => toast('Draft copied — paste it to the customer.', 'success'),
    () => toast('Could not copy — select and copy manually.', 'error'),
  );
}

// ─────────────────────────────────────────────
//  REPAIRS
// ─────────────────────────────────────────────
// Tables-native. Prices freeze into the ticket at open time; the wallet
// charge (REPAIR-<id>) posts once, when the repair is marked Collected.

let repairs = [];
let repairMenu = [];
const REPAIR_STATUSES = ['Open', 'In Progress', 'Ready', 'Collected', 'Cancelled'];

function repairStatusBadge(status) {
  const styles = {
    // Was #4434d4 on a 45% lavender wash — 1.39:1 in dark, effectively invisible.
    'Open':        'background:rgba(0,96,168,0.10);color:var(--accent);',
    'In Progress': 'background:var(--canvas-cream);color:var(--gold);',
    'Ready':       'background:rgba(124,58,237,0.13);color:var(--vn);',
    'Collected':   'background:rgba(34,197,94,0.15);color:var(--success-ink);',
    'Cancelled':   'background:rgba(239,68,68,0.15);color:var(--danger-ink);',
  };
  return `<span class="badge" style="${styles[status] || styles.Open}">${escHtml(status)}</span>`;
}

async function renderRepairsTab() {
  const content = document.getElementById('mainContent');
  content.innerHTML = skeletonHtml('repairs');
  try {
    [repairs, repairMenu] = await Promise.all([
      window.api.getRepairs(),
      window.api.getServiceMenu('repair'),
    ]);
  } catch { content.innerHTML = errorHtml('Couldn’t load repairs'); return; }
  if (!Array.isArray(repairs)) repairs = [];

  const open = repairs.filter(r => r.status === 'Open' || r.status === 'In Progress');
  const ready = repairs.filter(r => r.status === 'Ready');
  const revenue = repairs.filter(r => r.status === 'Collected').reduce((s, r) => s + (r.total || 0), 0);

  const repBar = kcFilterSort('repairs', [
    { value: 'all', label: 'Filter: all tickets' },
    { value: 'active', label: '🔧 Open / in progress', test: r => r.status === 'Open' || r.status === 'In Progress' },
    { value: 'ready', label: '📦 Waiting for collection', test: r => r.status === 'Ready' },
    { value: 'collected', label: '✓ Collected', test: r => r.status === 'Collected' },
    { value: 'cancelled', label: '✕ Cancelled', test: r => r.status === 'Cancelled' },
  ], [
    { value: 'recent', label: 'Sort: Recently opened', cmp: kcCmpDate(r => r.openedAt || '', -1) },
    { value: 'oldest', label: 'Oldest first', cmp: kcCmpDate(r => r.openedAt || '', 1) },
    { value: 'name', label: 'Customer A–Z', cmp: kcCmpStr(r => r.customerName) },
    { value: 'total', label: 'Total (high–low)', cmp: kcCmpNum(r => r.total || 0) },
    { value: 'status', label: 'Status', cmp: kcCmpStr(r => r.status) },
  ], renderRepairsTab);
  const shown = kcViewApply('repairs', repairs);
  const emptyMsg = repairs.length ? 'No repairs match this filter.' : 'No repairs yet.';
  const rows = shown.length === 0
    ? `<tr><td colspan="7"><div class="empty-state"><div class="emoji">🔧</div><p>${emptyMsg}</p><small>${repairs.length ? 'Change the filter above.' : 'Click "New Repair" to open the first ticket.'}</small>${kcClearFiltersBtn('repairs')}</div></td></tr>`
    : shown.map(r => `
      <tr>
        <td><div class="customer-name">${escName(r.customerName || '—')}</div></td>
        <td>${escHtml(r.device || '—')}${r.kcPurchase ? ' <span class="badge" style="background:rgba(0, 96, 168,0.1);color:var(--accent);font-size:var(--fs-micro);">KC phone</span>' : ''}</td>
        <td style="font-size:var(--fs-small);">${r.services.map(s => escHtml(s.name)).join('<br>') || '—'}</td>
        <td><strong>${fmtGbp((r.total || 0))}</strong></td>
        <td class="kc-date">${r.openedAt ? fmtDate(r.openedAt) : '—'}</td>
        <td>${repairStatusBadge(r.status)}</td>
        <td style="white-space:nowrap;">
          ${r.status === 'Ready' ? `<button class="action-btn" onclick="openRepairSmsModal('${escHtml(r.id)}')" title="Ready-to-collect message">💬</button>` : ''}
          <button class="action-btn" onclick="openRemindModal('repair','${escHtml(r.id)}')" title="Remind me">⏰</button>
          <select class="form-input" style="width:120px;padding:5px 8px;font-size:var(--fs-small);"
            aria-label="Status for ${escHtml([r.customerName, r.device].filter(Boolean).join(' — ') || 'this repair')}"
            onchange="changeRepairStatus('${escHtml(r.id)}', this.value)">
            ${REPAIR_STATUSES.map(s => `<option value="${s}" ${r.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </td>
      </tr>`).join('');

  content.innerHTML = `
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">Open Tickets</div><div class="stat-value">${open.length}</div></div>
      <div class="stat-card"><div class="stat-label">Ready to Collect</div><div class="stat-value">${ready.length}</div></div>
      <div class="stat-card"><div class="stat-label">Repairs Revenue</div><div class="stat-value">${fmtGbp(revenue)}</div></div>
      <div class="stat-card"><div class="stat-label">Total Tickets</div><div class="stat-value">${repairs.length}</div></div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
      ${repBar}
      <button class="btn btn-primary" onclick="openNewRepairModal()">+ New repair</button>
    </div>
    <div class="table-card">
      <table>
        <thead><tr>
          <th>Customer</th><th>Device</th><th>Services</th><th>Total</th><th>Opened</th><th>Status</th><th></th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function openNewRepairModal(preselectCustomerId = null) {
  const customerOptions = customers.map(c =>
    `<option value="${c.id}" ${preselectCustomerId === c.id ? 'selected' : ''}>${escName(c.firstName)} ${escName(c.lastName)} · ${escHtml(fmtPhone(c.phone || ''))}</option>`
  ).join('');
  const serviceChecks = repairMenu.map(m => `
    <label style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:var(--fs-body);cursor:pointer;">
      <input type="checkbox" class="rpService" value="${escHtml(m.id)}"
        data-price="${m.price}" data-reg="${m.price}" data-kc="${m.kcPrice ?? ''}"
        onchange="updateRepairTotal()">
      <span style="flex:1;">${escHtml(m.name)}</span>
      <strong class="rpPriceLbl">${fmtGbp(m.price)}</strong>
    </label>`).join('');
  showDynamicModal(`
    <div class="modal-title">🔧 New Repair</div>
    <div class="form-grid">
      <div class="form-group form-full">
        <label class="form-label">Customer *</label>
        <select class="form-input" id="rpCustomer">
          <option value="">Select customer…</option>${customerOptions}
        </select>
      </div>
      <div class="form-group form-full">
        <label class="form-label">Device</label>
        <input class="form-input" id="rpDevice" placeholder="e.g. QIN F21, black">
      </div>
      <div class="form-group form-full" style="flex-direction:row;align-items:center;gap:10px;">
        <input type="checkbox" id="rpKC" onchange="rpKCToggle()"
          style="width:16px;height:16px;cursor:pointer;accent-color:var(--accent);">
        <label for="rpKC" style="font-size:var(--fs-body);cursor:pointer;">
          🏷️ Phone purchased at Kosher Connect — discounted prices
        </label>
      </div>
      <div class="form-group form-full">
        <label class="form-label">Services * <span style="color:var(--muted);font-weight:400;">(prices frozen at open)</span></label>
        <div style="max-height:220px;overflow-y:auto;padding:0 4px;">${serviceChecks ||
          '<div style="color:var(--muted);font-size:var(--fs-body);">Price list unavailable.</div>'}</div>
      </div>
      <div class="form-group form-full">
        <label class="form-label">Notes</label>
        <input class="form-input" id="rpNotes">
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
      <div style="font-size:var(--fs-ui);">Total: <strong id="rpTotal" style="color:var(--success);">£0.00</strong>
        <span style="color:var(--muted);font-size:var(--fs-micro);">— charged to wallet on collection</span></div>
      <div class="modal-actions" style="margin:0;">
        <button class="btn btn-outline" onclick="closeDynamicModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveNewRepair()">🔧 Open Ticket</button>
      </div>
    </div>
  `);
}

function updateRepairTotal() {
  const total = [...document.querySelectorAll('.rpService:checked')]
    .reduce((s, el) => s + (parseFloat(el.dataset.price) || 0), 0);
  document.getElementById('rpTotal').textContent = `${fmtGbp(total)}`;
}

// Swap the whole menu between regular and "Purchased at KC" prices. Jobs
// without a KC tier (e.g. FIG Touch Mini) keep the regular price.
function rpKCToggle() {
  const kc = document.getElementById('rpKC')?.checked;
  document.querySelectorAll('.rpService').forEach(el => {
    const useKc = kc && el.dataset.kc !== '';
    el.dataset.price = useKc ? el.dataset.kc : el.dataset.reg;
    const lbl = el.parentElement.querySelector('.rpPriceLbl');
    if (lbl) {
      const eff = parseFloat(el.dataset.price) || 0;
      const reg = parseFloat(el.dataset.reg) || 0;
      lbl.innerHTML = useKc
        ? `<span style="color:var(--muted);text-decoration:line-through;font-weight:400;">${fmtGbp(reg)}</span> ${fmtGbp(eff)}`
        : `${fmtGbp(reg)}`;
    }
  });
  updateRepairTotal();
}

async function saveNewRepair() {
  const customerId = document.getElementById('rpCustomer').value;
  const serviceIds = [...document.querySelectorAll('.rpService:checked')].map(el => el.value);
  if (!customerId) { toast('Select a customer.', 'error'); return; }
  if (!serviceIds.length) { toast('Pick at least one service.', 'error'); return; }
  const rpCust = customers.find(c => c.id === customerId);
  const rpTotal = [...document.querySelectorAll('.rpService:checked')]
    .reduce((s, el) => s + (parseFloat(el.dataset.price) || 0), 0);
  if (!(await kcConfirm({
    title: 'Confirm repair charge',
    body: `<strong>${rpCust ? escName(rpCust.firstName) + ' ' + escName(rpCust.lastName) : 'Customer'}</strong><br>
      ${serviceIds.length} service${serviceIds.length === 1 ? '' : 's'} · payable on collection`,
    amount: rpTotal,
    okLabel: 'Open ticket & charge',
  }))) return;
  const res = await window.api.addRepair({
    customerId,
    device: document.getElementById('rpDevice').value.trim(),
    serviceIds,
    kcPurchase: !!document.getElementById('rpKC')?.checked,
    notes: document.getElementById('rpNotes').value.trim(),
  });
  if (!res.success) { toast(res.error || 'Could not open the ticket.', 'error'); return; }
  closeDynamicModal();
  toast(`Repair ticket opened — ${fmtGbp(res.repair.total)} on collection.`, 'success');
  renderRepairsTab();
}

async function changeRepairStatus(id, status) {
  // Collecting = charging: ask how it's paid so a repair settled at the
  // counter doesn't sit as wallet debt (same pattern as tickets).
  if (status === 'Collected') {
    const r = repairs.find(x => x.id === id);
    if ((r?.total || 0) > 0) { openCollectRepairModal(id); renderRepairsTab(); return; }
  }
  const res = await window.api.updateRepair({ id, status });
  if (!res.success) { toast(res.error || 'Could not update status.', 'error'); renderRepairsTab(); return; }
  toast(`Repair marked ${status}.`, 'success');
  renderRepairsTab();
  // Ready = time to tell the customer — draft the collect message straight away.
  if (status === 'Ready') openRepairSmsModal(id);
}

// Ready-to-collect message for a repair, drafted not sent (same HOLD
// discipline as the rental status SMS: staff copy it or open WhatsApp and
// press send themselves).
function buildRepairSms(r) {
  const first = (r.customerName || '').split(' ')[0] || 'there';
  const total = r.total || 0;
  return `Hi ${first}, Kosher Connect: your ${r.device || 'phone'} is repaired and ready to collect.${total > 0.005 ? ` ${fmtGbp(total)} on collection.` : ''} 0161 531 1386`;
}
function openRepairSmsModal(repairId) {
  const r = repairs.find(x => x.id === repairId);
  if (!r) return;
  const c = customers.find(x => x.id === r.customerId);
  showDynamicModal(`
    <div class="modal-title">✉️ Ready to collect — ${escName(r.customerName || '')}</div>
    <div style="font-size:var(--fs-small);color:var(--muted);margin-bottom:10px;">Edit it, then ${WHATSAPP_ENABLED ? 'copy or open WhatsApp' : 'copy it into your messages'} — <strong>nothing is sent</strong> from here.</div>
    <textarea class="form-input" id="rpsmsText" rows="4" style="font-family:inherit;">${escHtml(buildRepairSms(r))}</textarea>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeDynamicModal()">Close</button>
      ${c && waLink(c, '') ? `<button class="btn btn-outline" onclick="waRepairSms('${escHtml(String(repairId))}')">💬 Open in WhatsApp</button>` : ''}
      <button class="btn btn-primary" onclick="copyRepairSms('${escHtml(String(repairId))}')">📋 Copy message</button>
    </div>
  `);
}
async function copyRepairSms(repairId) {
  const r = repairs.find(x => x.id === repairId);
  const text = document.getElementById('rpsmsText')?.value || '';
  try { await navigator.clipboard.writeText(text); toast('Message copied — paste it into your messaging app.', 'success'); }
  catch { toast('Select the text and copy it manually.', 'warning'); return; }
  if (r?.customerId) recordComm(r.customerId, { type: 'message', text: 'Repair-ready message drafted & copied' });
  closeDynamicModal();
}
function waRepairSms(repairId) {
  const r = repairs.find(x => x.id === repairId);
  if (!r) return;
  const text = document.getElementById('rpsmsText')?.value || '';
  const c = customers.find(x => x.id === r.customerId);
  const url = c && waLink(c, text);
  if (!url) { toast('No usable phone number for WhatsApp.', 'warning'); return; }
  window.open(url, '_blank');
  if (r.customerId) recordComm(r.customerId, { type: 'message', text: 'Repair-ready message opened in WhatsApp' });
  closeDynamicModal();
}

function openCollectRepairModal(id) {
  const r = repairs.find(x => x.id === id);
  if (!r) return;
  showDynamicModal(`
    <div class="modal-title">🔧 Collect repair — ${escName(r.customerName || '')}</div>
    <div style="font-size:var(--fs-ui);margin-bottom:12px;">${escHtml(r.device || 'device')} · total <strong>${fmtGbp((r.total || 0))}</strong></div>
    <div class="form-group">
      <label class="form-label">Payment</label>
      <select class="form-input" id="rcPay">
        <option value="account">Put on account (wallet)</option>
        <option value="cash">Paid now — 💵 Cash</option>
        <option value="card">Paid now — 💳 Card</option>
        <option value="card_on_file">Paid now — card on file (Stripe)</option>
        <option value="bank_transfer">Paid now — 🏦 Transfer</option>
      </select>
      <div style="font-size:var(--fs-micro);color:var(--muted);margin-top:4px;">"Paid now" settles it immediately — no wallet debt.</div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeDynamicModal()">Cancel</button>
      <button class="btn btn-primary" onclick="confirmCollectRepair('${escHtml(id)}')">✅ Collect</button>
    </div>
  `);
}

async function confirmCollectRepair(id) {
  const res = await window.api.updateRepair({ id, status: 'Collected', payment: document.getElementById('rcPay').value });
  if (!res.success) { toast(res.error || 'Could not collect.', 'error'); return; }
  closeDynamicModal();
  if (res.chargePosted) {
    toast(res.paidNow
      ? `Collected — ${fmtGbp(res.repair.total)} paid in full.`
      : `Collected — ${fmtGbp(res.repair.total)} on account. Balance ${fmtGbp(res.balance)}.`, 'success');
  } else {
    toast('Repair collected.', 'success');
  }
  renderRepairsTab();
}

// ─────────────────────────────────────────────
//  ONLINE SERVICES (charging screen)
// ─────────────────────────────────────────────
// One order = one wallet charge (SVC-<uuid>), optionally paid on the spot
// (PAY-SVC-<uuid>). Repeat-application pricing per the customer price list.

let serviceOrders = [];
let onlineMenu = [];

// Price list rule (updated list: "First Application / 4 or more"): units
// below the threshold at the single price, units from the Nth at
// repeatPrice. The threshold lives in Settings (online_repeat_from, now 4 —
// it was 2 on the old list). Services without a repeat price charge every
// unit at the single price.
const onlineRepeatFrom = () => Math.max(2, settingNum('online_repeat_from', 4));
function onlineServiceTotal(svc, qty) {
  const n = Math.max(1, Math.floor(Number(qty)) || 1);
  const single = Number(svc.price) || 0;
  const rep = svc.repeatPrice === null || svc.repeatPrice === undefined
    ? single : Number(svc.repeatPrice);
  const from = onlineRepeatFrom();
  const atSingle = Math.min(n, from - 1);
  return atSingle * single + (n - atSingle) * rep;
}

// ── Help timer (Regular online service is billed per hour, min 10 min) ──
// Pausable: `elapsedMs` banks time already counted; `runningSince` is when
// the current run started (null while paused). Total = elapsedMs + (now −
// runningSince). Backwards-compatible with the old {startedAt} shape.
let svcTimerInterval = null;
const svcTimerState = () => { try { return JSON.parse(localStorage.getItem('kcSvcTimer')); } catch { return null; } };
const svcTimerSet = (s) => s ? localStorage.setItem('kcSvcTimer', JSON.stringify(s)) : localStorage.removeItem('kcSvcTimer');

function svcTimerElapsedMs(t) {
  if (!t) return 0;
  if (t.startedAt && t.elapsedMs === undefined) return Date.now() - t.startedAt; // legacy
  return (t.elapsedMs || 0) + (t.runningSince ? Date.now() - t.runningSince : 0);
}

function svcTimerCharge(t) {
  const minutes = Math.max(10, Math.ceil(svcTimerElapsedMs(t) / 60000)); // 10-minute minimum
  const rate = settingNum('online_hourly_rate', 45);
  return { minutes, amount: Math.round((minutes / 60) * rate * 100) / 100 };
}

function svcTimerStart() {
  const sel = document.getElementById('svcTimerCustomer');
  if (!sel?.value) { toast('Pick who you are helping.', 'error'); return; }
  const c = customers.find(x => x.id === sel.value);
  svcTimerSet({ customerId: sel.value, customerName: c ? `${c.firstName} ${c.lastName}` : '',
    elapsedMs: 0, runningSince: Date.now() });
  renderServicesTab();
}

function svcTimerPause() {
  const t = svcTimerState();
  if (!t || !t.runningSince) return;
  t.elapsedMs = (t.elapsedMs || 0) + (Date.now() - t.runningSince);
  t.runningSince = null;
  svcTimerSet(t);
  renderServicesTab();
}

function svcTimerResume() {
  const t = svcTimerState();
  if (!t || t.runningSince) return;
  t.runningSince = Date.now();
  svcTimerSet(t);
  renderServicesTab();
}

function svcTimerDiscard() {
  svcTimerSet(null);
  toast('Timer discarded — nothing charged.', 'warning');
  renderServicesTab();
}

function svcTimerStop() {
  const t = svcTimerState();
  if (!t) return;
  const { minutes, amount } = svcTimerCharge(t);
  svcTimerSet(null);
  openNewServiceModal();
  setTimeout(() => {
    const cust = document.getElementById('svCustomer');
    if (cust && [...cust.options].some(o => o.value === t.customerId)) cust.value = t.customerId;
    const svcSel = document.getElementById('svService');
    const hourly = onlineMenu.find(m => /per hour|hourly|regular online/i.test(m.name));
    if (svcSel && hourly) svcSel.value = String(hourly.id);
    document.getElementById('svTotal').value = amount.toFixed(2);
    document.getElementById('svNotes').value = `Timed help — ${minutes} min`;
    const bd = document.getElementById('svBreakdown');
    if (bd) bd.innerHTML = `⏱ ${minutes} min at £${settingNum('online_hourly_rate', 45)}/hr (10-min minimum) = <strong>${fmtGbp(amount)}</strong> — editable.`;
  }, 60);
}

// ── Floating help-timer chip ──────────────────────────────────────────────
// A running (or paused) session stays visible in the bottom-right corner on
// EVERY tab, ticking once a second, so staff never lose a live timer behind
// another screen. Hidden on the Services tab itself (the full controls live
// there). Clicking the chip jumps to Services; the inline buttons pause/stop
// without leaving the current screen.
function svcTimerFloatFrame(t) {
  const paused = !t.runningSince;
  return `
    <div class="svc-float-main" onclick="if(!document.getElementById('svcTimerFloat')?.dataset.dragged)goToTab('services')" title="Open Services (drag to move)">
      <span class="svc-float-icon">${paused ? '⏸' : '⏱'}</span>
      <div class="svc-float-info">
        <div class="svc-float-name">${escName(t.customerName || 'customer')}</div>
        <div class="svc-float-time"><b id="svcFloatElapsed">0:00</b><span id="svcFloatProj" class="svc-float-proj"></span></div>
      </div>
    </div>
    <div class="svc-float-btns">
      ${paused
        ? `<button class="svc-float-btn" title="Resume" onclick="event.stopPropagation();svcTimerResume()">▶</button>`
        : `<button class="svc-float-btn" title="Pause" onclick="event.stopPropagation();svcTimerPause()">⏸</button>`}
      <button class="svc-float-btn svc-float-stop" title="Stop &amp; charge" onclick="event.stopPropagation();svcTimerStop()">⏹</button>
    </div>`;
}

function svcTimerFloatTick() {
  const t = svcTimerState();
  let el = document.getElementById('svcTimerFloat');
  // Hidden with no session, outside the portal (login/portal-less), or on
  // Services where the full timer card already shows.
  if (!t || currentTab === 'services' || !document.getElementById('mainContent')) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement('div'); el.id = 'svcTimerFloat'; el.className = 'svc-float';
    svcFloatRestorePos(el);
    el.addEventListener('pointerdown', svcFloatDragStart);
    document.body.appendChild(el);
  }
  const sig = `${t.customerId}|${t.runningSince ? 'run' : 'pause'}`;
  if (el.dataset.sig !== sig) {            // only rebuild the frame on a state change
    el.dataset.sig = sig;
    el.classList.toggle('paused', !t.runningSince);
    el.innerHTML = svcTimerFloatFrame(t);
  }
  const secs = Math.floor(svcTimerElapsedMs(t) / 1000);
  const e = document.getElementById('svcFloatElapsed');
  if (e) e.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  const p = document.getElementById('svcFloatProj');
  if (p) { const { minutes, amount } = svcTimerCharge(t); p.textContent = `~${fmtGbp(amount)} · ${minutes}m`; }
}

function startSvcTimerFloat() {
  svcTimerFloatTick();
  if (!window.__svcFloat) window.__svcFloat = setInterval(svcTimerFloatTick, 1000);
}

// The chip can cover exactly the corner you need to read — so it's draggable.
// Grab anywhere that isn't a button; the spot sticks per browser. A plain
// click (under 5px of movement) still opens Services.
function svcFloatRestorePos(el) {
  try {
    const pos = JSON.parse(localStorage.getItem('kcTimerPos') || 'null');
    if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
      el.style.left = `${Math.min(Math.max(0, pos.x), window.innerWidth - 90)}px`;
      el.style.top = `${Math.min(Math.max(0, pos.y), window.innerHeight - 44)}px`;
      el.style.right = 'auto'; el.style.bottom = 'auto';
    }
  } catch { /* default bottom-right */ }
}
function svcFloatDragStart(e) {
  if (e.target.closest('button')) return;
  const el = document.getElementById('svcTimerFloat');
  if (!el) return;
  const r = el.getBoundingClientRect();
  const offX = e.clientX - r.left, offY = e.clientY - r.top;
  const startX = e.clientX, startY = e.clientY;
  let moved = false;
  const move = (ev) => {
    if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;
    moved = true;
    el.style.left = `${Math.min(Math.max(0, ev.clientX - offX), window.innerWidth - r.width)}px`;
    el.style.top = `${Math.min(Math.max(0, ev.clientY - offY), window.innerHeight - r.height)}px`;
    el.style.right = 'auto'; el.style.bottom = 'auto';
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    if (moved) {
      const r2 = el.getBoundingClientRect();
      try { localStorage.setItem('kcTimerPos', JSON.stringify({ x: r2.left, y: r2.top })); } catch { /* not fatal */ }
      el.dataset.dragged = '1';                    // swallow the click that follows the drop
      setTimeout(() => { delete el.dataset.dragged; }, 0);
    }
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

async function renderServicesTab() {
  const content = document.getElementById('mainContent');
  content.innerHTML = skeletonHtml('services');
  if (svcTimerInterval) { clearInterval(svcTimerInterval); svcTimerInterval = null; }
  try {
    [serviceOrders, onlineMenu] = await Promise.all([
      window.api.getServiceOrders(),
      window.api.getServiceMenu('online'),
    ]);
  } catch { content.innerHTML = errorHtml('Couldn’t load services'); return; }
  if (!Array.isArray(serviceOrders)) serviceOrders = [];
  if (!Array.isArray(onlineMenu)) onlineMenu = [];

  const today = localISO();
  const todays = serviceOrders.filter(o => (o.createdAt || '').slice(0, 10) === today);
  const revenue = serviceOrders.reduce((s, o) => s + (o.total || 0), 0);

  const svcWeekAgo = localISO(new Date(Date.now() - 7 * 86400000));
  const svcBar = kcFilterSort('services', [
    { value: 'all', label: 'Filter: all orders' },
    { value: 'today', label: '📅 Today', test: o => (o.createdAt || '').slice(0, 10) === today },
    { value: 'week', label: '🗓️ Last 7 days', test: o => (o.createdAt || '').slice(0, 10) >= svcWeekAgo },
  ], [
    { value: 'recent', label: 'Sort: Most recent', cmp: kcCmpDate(o => o.createdAt || '', -1) },
    { value: 'oldest', label: 'Oldest first', cmp: kcCmpDate(o => o.createdAt || '', 1) },
    { value: 'name', label: 'Customer A–Z', cmp: kcCmpStr(o => o.customerName) },
    { value: 'total', label: 'Total (high–low)', cmp: kcCmpNum(o => o.total || 0) },
    { value: 'service', label: 'Service A–Z', cmp: kcCmpStr(o => o.serviceName) },
  ], renderServicesTab);
  const svcShown = kcViewApply('services', serviceOrders);
  const orderRows = svcShown.length === 0
    ? `<tr><td colspan="5"><div class="empty-state"><div class="emoji">🖨️</div><p>${serviceOrders.length ? 'No orders match this filter.' : 'No services charged yet.'}</p>${kcClearFiltersBtn('services')}</div></td></tr>`
    : svcShown.map(o => `
      <tr>
        <td><div class="customer-name">${escName(o.customerName || '—')}</div></td>
        <td>${escHtml(o.serviceName)}${o.qty > 1 ? ` <span style="color:var(--muted);">× ${o.qty}</span>` : ''}</td>
        <td><strong>${fmtGbp((o.total || 0))}</strong></td>
        <td class="kc-date">${o.createdAt ? fmtDate(o.createdAt) : '—'}</td>
        <td style="font-size:var(--fs-small);color:var(--muted);">${escHtml(o.notes || '')}</td>
      </tr>`).join('');

  const menuRows = onlineMenu.map(m => `
    <tr>
      <td>${escHtml(m.name)}</td>
      <td>${fmtGbp(m.price)}</td>
      <td>${m.repeatPrice === null ? '—' : fmtGbp(m.repeatPrice)}</td>
    </tr>`).join('');

  content.innerHTML = `
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">Charged Today</div>
        <div class="stat-value">${fmtGbp(todays.reduce((s, o) => s + (o.total || 0), 0))}</div>
        <div class="stat-sub">${todays.length} service${todays.length === 1 ? '' : 's'}</div></div>
      <div class="stat-card"><div class="stat-label">All-Time Revenue</div>
        <div class="stat-value">${fmtGbp(revenue)}</div></div>
      <div class="stat-card"><div class="stat-label">Orders</div><div class="stat-value">${serviceOrders.length}</div></div>
    </div>
    ${(() => {
      const t = svcTimerState();
      if (t) {
        const paused = !t.runningSince;
        return `
        <div class="table-card" style="margin-bottom:14px;padding:14px 18px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;${paused ? 'border-color:var(--gold);' : ''}">
          <span style="font-size:20px;">${paused ? '⏸' : '⏱'}</span>
          <div style="flex:1;min-width:180px;">
            <div style="font-weight:600;">Helping ${escName(t.customerName || 'customer')}</div>
            <div style="font-size:var(--fs-small);color:${paused ? 'var(--gold)' : 'var(--muted)'};">${paused ? 'paused — resume to keep counting' : 'running'}</div>
          </div>
          <strong id="svcTimerElapsed" style="font-size:var(--fs-h1);font-feature-settings:'tnum';">0:00</strong>
          <span id="svcTimerProj" style="font-size:var(--fs-body);color:var(--muted);"></span>
          ${paused
            ? `<button class="btn btn-outline" onclick="svcTimerResume()">▶ Resume</button>`
            : `<button class="btn btn-outline" onclick="svcTimerPause()">⏸ Pause</button>`}
          <button class="btn btn-primary" onclick="svcTimerStop()">⏹ Stop &amp; charge</button>
          <button class="btn btn-outline btn-sm" onclick="svcTimerDiscard()">✕ Discard</button>
        </div>`;
      }
      const opts = [...customers]
        .sort((a, b) => `${a.firstName || ''} ${a.lastName || ''}`.trim()
          .localeCompare(`${b.firstName || ''} ${b.lastName || ''}`.trim(), undefined, { sensitivity: 'base' }))
        .map(c => `<option value="${c.id}">${escName(c.firstName)} ${escName(c.lastName)}</option>`).join('');
      return `
        <div class="table-card" style="margin-bottom:14px;padding:14px 18px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <span style="font-size:20px;">⏱</span>
          <span style="font-size:var(--fs-body);color:var(--muted);">Hourly help timer (£${settingNum('online_hourly_rate', 45)}/hr, 10-min minimum)</span>
          <select class="form-input" id="svcTimerCustomer" style="flex:1;min-width:180px;min-height:0;padding:8px 12px;">
            <option value="">Who are you helping?</option>${opts}
          </select>
          <button class="btn btn-primary" onclick="svcTimerStart()">▶ Start timer</button>
        </div>`;
    })()}
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
      ${svcBar}
      <button class="btn btn-primary" onclick="openNewServiceModal()">+ Charge a Service</button>
    </div>
    <div class="dash-cols">
      <div class="table-card">
        <div class="section-divider" style="margin:12px 14px 4px;">Recent orders</div>
        <table>
          <thead><tr><th>Customer</th><th>Service</th><th>Total</th><th>Date</th><th>Notes</th></tr></thead>
          <tbody>${orderRows}</tbody>
        </table>
      </div>
      <div class="table-card">
        <div class="section-divider" style="margin:12px 14px 4px;">Price list <span style="color:var(--muted);font-weight:400;">· first / ${onlineRepeatFrom()} or more</span></div>
        <table>
          <thead><tr><th>Service</th><th>First</th><th>${onlineRepeatFrom()}+</th></tr></thead>
          <tbody>${menuRows}</tbody>
        </table>
      </div>
    </div>`;

  // Live tick for the help timer (cleared on every tab re-render). Shows the
  // banked time even while paused; only advances when running.
  const running = svcTimerState();
  if (running) {
    const tick = () => {
      const el = document.getElementById('svcTimerElapsed');
      if (!el) { clearInterval(svcTimerInterval); svcTimerInterval = null; return; }
      const secs = Math.floor(svcTimerElapsedMs(running) / 1000);
      el.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
      const { minutes, amount } = svcTimerCharge(running);
      const p = document.getElementById('svcTimerProj');
      if (p) p.textContent = `≈ ${fmtGbp(amount)} (${minutes} min, 10-min minimum)`;
    };
    tick();
    if (running.runningSince) svcTimerInterval = setInterval(tick, 1000); // frozen while paused
  }
}

async function openNewServiceModal(preselectCustomerId = null) {
  // Callable from the customer card too — make sure the menu is loaded.
  if (!onlineMenu.length) {
    onlineMenu = await window.api.getServiceMenu('online').catch(() => []);
    if (!Array.isArray(onlineMenu)) onlineMenu = [];
  }
  const customerOptions = customers.map(c =>
    `<option value="${c.id}" ${preselectCustomerId === c.id ? 'selected' : ''}>${escName(c.firstName)} ${escName(c.lastName)} · ${escHtml(fmtPhone(c.phone || ''))}</option>`).join('');
  const svcOptions = onlineMenu.map(m =>
    `<option value="${escHtml(String(m.id))}">${escHtml(m.name)} — ${fmtGbp(m.price)}${m.repeatPrice !== null ? ` (${onlineRepeatFrom()}+ ${fmtGbp(m.repeatPrice)})` : ''}</option>`).join('');
  showDynamicModal(`
    <div class="modal-title">🖨️ Charge a Service</div>
    <div class="form-grid">
      <div class="form-group form-full">
        <label class="form-label">Customer *</label>
        <select class="form-input" id="svCustomer"><option value="">Select customer…</option>${customerOptions}</select>
      </div>
      <div class="form-group form-full">
        <label class="form-label">Service *</label>
        <select class="form-input" id="svService" onchange="svUpdateTotal()">
          <option value="">Select service…</option>${svcOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Quantity / applications</label>
        <input class="form-input" type="number" id="svQty" value="1" min="1" step="1" oninput="svUpdateTotal()">
      </div>
      <div class="form-group">
        <label class="form-label">Total (£)</label>
        <input class="form-input" type="number" id="svTotal" min="0" step="0.01" value="0">
      </div>
      <div class="form-group">
        <label class="form-label">Paid now?</label>
        <div style="display:flex;gap:8px;align-items:center;">
          <input type="checkbox" id="svPaid" checked
            onchange="document.getElementById('svMethod').style.display=this.checked?'':'none'"
            style="cursor:pointer;">
          <select class="form-input" id="svMethod" style="flex:1;">
            <option value="cash">💵 Cash</option>
            <option value="card">💳 Card</option>
            <option value="bank_transfer">🏦 Bank transfer</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div class="form-group form-full">
        <label class="form-label">Notes</label>
        <input class="form-input" id="svNotes" placeholder="e.g. passport ref, printout pages">
      </div>
    </div>
    <div style="margin-top:8px;padding:10px;border-radius:8px;background:var(--bg-secondary);font-size:var(--fs-small);color:var(--muted);" id="svBreakdown">
      The charge posts to the customer's wallet (reference <code>SVC-…</code>); ticking "paid now" records the payment alongside.
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeDynamicModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveNewServiceOrder()">🖨️ Charge</button>
    </div>
  `);
}

function svUpdateTotal() {
  const svc = onlineMenu.find(m => String(m.id) === document.getElementById('svService')?.value);
  if (!svc) return;
  const qty = Math.max(1, parseInt(document.getElementById('svQty')?.value, 10) || 1);
  const total = onlineServiceTotal(svc, qty);
  document.getElementById('svTotal').value = total.toFixed(2);
  const bd = document.getElementById('svBreakdown');
  if (!bd) return;
  const atSingle = Math.min(qty, onlineRepeatFrom() - 1);
  const atRepeat = qty - atSingle;
  bd.innerHTML = atRepeat > 0 && svc.repeatPrice !== null
    ? `${qty} applications: ${atSingle} × ${fmtGbp(svc.price)} + ${atRepeat} × ${fmtGbp(Number(svc.repeatPrice))} = <strong>${fmtGbp(total)}</strong>`
    : `${qty} × ${fmtGbp(svc.price)} = <strong>${fmtGbp(total)}</strong>`;
}

async function saveNewServiceOrder() {
  const customerId = document.getElementById('svCustomer').value;
  const serviceId = document.getElementById('svService').value;
  if (!customerId) { toast('Select a customer.', 'error'); return; }
  if (!serviceId) { toast('Select a service.', 'error'); return; }
  const svCust = customers.find(c => c.id === customerId);
  const svTotal = parseFloat(document.getElementById('svTotal').value);
  const svPaid = document.getElementById('svPaid').checked;
  const svLabel = document.getElementById('svService').selectedOptions[0]?.textContent || 'Service';
  // One token per submit (server dedupes a retry) + an in-flight guard against a
  // double-click posting the service charge twice.
  const guardKey = 'svc:' + customerId + ':' + serviceId;
  if (!kcBeginWrite(guardKey)) return;
  let res;
  try {
    if (!(await kcConfirm({
      title: 'Confirm service charge',
      body: `<strong>${svCust ? escName(svCust.firstName) + ' ' + escName(svCust.lastName) : 'Customer'}</strong><br>
        ${escHtml(svLabel.trim())}${svPaid ? ' · paid now' : ' · on account'}`,
      amount: Number.isFinite(svTotal) ? svTotal : 0,
      okLabel: 'Charge service',
    }))) return;
    res = await window.api.addServiceOrder({
      customerId,
      serviceId,
      qty: Math.max(1, parseInt(document.getElementById('svQty').value, 10) || 1),
      total: parseFloat(document.getElementById('svTotal').value),
      paidNow: document.getElementById('svPaid').checked,
      method: document.getElementById('svMethod').value,
      notes: document.getElementById('svNotes').value.trim(),
      clientRef: kcRef(),
    });
  } finally {
    kcEndWrite(guardKey);
  }
  if (!res.success) { toast(res.error || 'Could not charge the service.', 'error'); return; }
  closeDynamicModal();
  if (res.duplicate) { toast('Already charged — no double charge.', 'info'); renderServicesTab(); return; }
  const extraMsg = res.extras?.length ? ` Incl. ${res.extras.map(e => `${e.label} ${fmtGbp(e.amount)}`).join(', ')}.` : '';
  toast(`Charged ${fmtGbp(res.order.total)} — wallet balance ${fmtGbp(res.balance)}.${extraMsg}`, 'success');
  renderServicesTab();
}

// ─────────────────────────────────────────────
//  SHOP & STOCK (selling devices/accessories — separate from the rental fleet)
// ─────────────────────────────────────────────

let shopItems = [];
let shopSales = [];
// Buy side v1 — suppliers + returns going back to them (RMA).
let suppliers = [];
let supplierReturns = [];
const SUPPLIER_RETURN_STATUS = {
  awaiting_send: { label: '📦 To send',     color: 'var(--danger-ink)' },
  sent:          { label: '📮 Sent',        color: 'var(--warning-ink)' },
  credited:      { label: '✅ Credited',    color: 'var(--success-ink)' },
  replaced:      { label: '🔁 Replaced',    color: 'var(--success-ink)' },
  written_off:   { label: '🗑 Written off', color: 'var(--muted)' },
};
const SUPPLIER_RETURN_OPEN = ['awaiting_send', 'sent'];
// Goods-in v2 — deliveries + the lightweight per-supplier balance
// (unpaid invoices minus credit notes; the shop's only AP record for now).
let goodsIn = [];
let goodsInBalances = {};

const STOCK_CATEGORY_LABELS = { phone: '📱 Phone', accessory: '🔌 Accessory', sim: '💳 SIM', other: '📦 Other' };
// What the shelf actually carries (owner's list) — offered as type-ahead
// suggestions when adding stock, so new items land with consistent names.
const STOCK_TYPE_SUGGESTIONS = [
  'MP3 player', 'Power bank', 'SD card', 'USB stick', 'Charger plug', 'Charging cable',
  'Phone case', 'International plug adapter', 'Air-con pay-as-you-go switch unit',
  'TomTom sat nav', 'Waze auto device', 'Tello SIM (USA)', 'US Mobile SIM (USA)',
  'Replacement screen', 'Phone battery', 'CD',
];

async function renderShopTab() {
  const content = document.getElementById('mainContent');
  content.innerHTML = skeletonHtml('shop');
  const [data, retData, giData] = await Promise.all([
    kcFetch('/api/shop').then(r => r.json()).catch(() => null),
    // Returns and goods-in are additive: if either fetch fails the shop still renders.
    kcFetch('/api/supplier-returns').then(r => r.json()).catch(() => null),
    kcFetch('/api/goods-in').then(r => r.json()).catch(() => null),
  ]);
  if (!data || !data.success) {
    content.innerHTML = errorHtml(data?.error || 'Couldn’t load the shop');
    return;
  }
  shopItems = data.items; shopSales = data.sales;
  if (retData?.success) { suppliers = retData.suppliers; supplierReturns = retData.returns; }
  if (giData?.success) { goodsIn = giData.deliveries; goodsInBalances = giData.balances; }

  const today = localISO();
  const active = shopItems.filter(i => i.active);
  const inStock = active.reduce((s, i) => s + i.quantity, 0);
  const low = active.filter(i => i.quantity <= i.lowStockAt);
  const todaySales = shopSales.filter(s => (s.createdAt || '').slice(0, 10) === today);
  const revenue = shopSales.reduce((s, x) => s + x.total, 0);

  const lowBanner = low.length ? `
    <div class="banner-lowstock">
      ⚠️ <strong>Low stock:</strong> ${low.map(i => `${escHtml(i.model)} (${i.quantity} left)`).join(' · ')}
    </div>` : '';

  const shopBar = kcFilterSort('shop', [
    { value: 'all', label: 'Filter: all stock' },
    { value: 'low', label: '⚠️ Low / out of stock', test: i => i.quantity <= i.lowStockAt },
    { value: 'instock', label: '📦 In stock', test: i => i.quantity > 0 },
  ], [
    { value: 'name', label: 'Sort: Name A–Z', cmp: kcCmpStr(i => [i.company, i.model].filter(Boolean).join(' ')) },
    { value: 'qty_asc', label: 'Qty (low→high)', cmp: (a, b) => (a.quantity || 0) - (b.quantity || 0) },
    { value: 'qty_desc', label: 'Qty (high→low)', cmp: kcCmpNum(i => i.quantity || 0) },
    { value: 'price', label: 'Price (high–low)', cmp: kcCmpNum(i => i.sellingPrice || 0) },
    { value: 'profit', label: 'Profit (high–low)', cmp: kcCmpNum(i => i.profit || 0) },
  ], renderShopTab);
  const shopShown = kcViewApply('shop', active);
  const itemRows = shopShown.length === 0
    ? `<tr><td colspan="7"><div class="empty-state"><div class="emoji">🛍️</div><p>${active.length ? 'No stock matches this filter.' : 'No stock yet — add your first item.'}</p>${kcClearFiltersBtn('shop')}</div></td></tr>`
    : shopShown.map(i => `
      <tr class="${i.quantity <= i.lowStockAt ? 'row-lowstock' : ''}">
        <td><strong>${escHtml([i.company, i.model].filter(Boolean).join(' '))}</strong>
          <div class="customer-email">${escHtml(i.code || '')}</div></td>
        <td>${STOCK_CATEGORY_LABELS[i.category] || escHtml(i.category)}</td>
        <td style="color:var(--muted);">${i.netPrice === null ? '—' : fmtGbp(i.netPrice)}</td>
        <td><strong>${fmtGbp((i.sellingPrice || 0))}</strong></td>
        <td style="color:${i.profit === null ? 'var(--muted)' : i.profit >= 0 ? 'var(--success)' : 'var(--danger-ink)'};">
          ${i.profit === null ? '—' : fmtGbp(i.profit)}</td>
        <td style="font-weight:700;${i.quantity <= i.lowStockAt ? 'color:var(--danger-ink);' : ''}">${i.quantity}</td>
        <td style="white-space:nowrap;">
          <button class="action-btn" onclick="openSaleModal('${i.id}')">💷 Sell</button>
          <button class="action-btn" aria-label="Edit ${escHtml(i.name || 'item')}" onclick="openStockItemModal('${i.id}')">✏️</button>
        </td>
      </tr>`).join('');

  // Returns to supplier: open ones first (the bag by the counter), then the
  // last few settled ones for reference. Money shown is a claim, not ledger.
  const openReturns = supplierReturns.filter(r => SUPPLIER_RETURN_OPEN.includes(r.status));
  const doneReturns = supplierReturns.filter(r => !SUPPLIER_RETURN_OPEN.includes(r.status));
  const openClaim = openReturns.reduce((s, r) => s + (r.claimedValue || 0), 0);
  const returnRow = (r) => {
    const st = SUPPLIER_RETURN_STATUS[r.status] || { label: r.status, color: 'var(--muted)' };
    return `
      <div class="history-item history-flat">
        <div style="flex:1;min-width:0;">
          <div class="history-desc"><strong>${escHtml(r.supplierName || '?')}</strong> — ${escHtml(r.items)}</div>
          <div style="font-size:var(--fs-micro);color:var(--muted);">
            <span style="color:${st.color};font-weight:600;">${st.label}</span>
            ${r.sentAt ? ' · sent ' + fmtDate(r.sentAt) : ''}${r.resolvedAt ? ' · settled ' + fmtDate(r.resolvedAt) : ''}
            ${r.notes ? ' · ' + escHtml(r.notes) : ''}
          </div>
        </div>
        <div class="history-amount" style="margin:0 10px;">${r.claimedValue === null ? '—' : fmtGbp(r.claimedValue)}</div>
        <button class="action-btn" aria-label="Manage return to ${escHtml(r.supplierName || 'supplier')}"
          onclick="openSupplierReturnModal('${r.id}')">✏️</button>
      </div>`;
  };
  const returnRows = supplierReturns.length === 0
    ? `<div style="color:var(--muted);font-size:var(--fs-body);padding:8px 0;">Nothing waiting to go back. When defective stock has to return to a wholesaler, record it here so it isn't forgotten.</div>`
    : openReturns.map(returnRow).join('') + doneReturns.slice(0, 5).map(returnRow).join('');

  // Goods in: recent deliveries with a paid/unpaid toggle, headed by the
  // per-supplier balance line ("we owe" = unpaid invoices − credit notes).
  const oweEntries = suppliers
    .map(s => ({ name: s.name, owed: goodsInBalances[s.id] || 0 }))
    .filter(e => Math.abs(e.owed) >= 0.005);
  const totalOwed = oweEntries.reduce((s, e) => s + e.owed, 0);
  const balanceLine = oweEntries.length
    ? `<div style="font-size:var(--fs-small);margin:2px 0 8px;color:var(--muted);">
        ${oweEntries.map(e => `${escHtml(e.name)}: <strong style="color:${e.owed > 0 ? 'var(--danger-ink)' : 'var(--success-ink)'};">${e.owed > 0 ? fmtGbp(e.owed) + ' owed' : fmtGbp(-e.owed) + ' credit'}</strong>`).join(' · ')}
      </div>` : '';
  const deliveryRow = (d) => `
    <div class="history-item history-flat">
      <div style="flex:1;min-width:0;">
        <div class="history-desc"><strong>${escHtml(d.supplierName || '?')}</strong>${d.invoiceRef ? ' — ' + escHtml(d.invoiceRef) : ''}
          — ${d.lines.map(l => `${l.qty}× ${escHtml(l.description)}`).join(', ')}</div>
        <div style="font-size:var(--fs-micro);color:var(--muted);">
          ${fmtDate(d.deliveryDate)}${d.paid ? ` · <span style="color:var(--success-ink);font-weight:600;">✅ Paid${d.paidAt ? ' ' + fmtDate(d.paidAt) : ''}</span>` : d.invoiceTotal !== null ? ' · <span style="color:var(--warning-ink);font-weight:600;">⏳ Unpaid</span>' : ''}
          ${d.notes ? ' · ' + escHtml(d.notes) : ''}
        </div>
      </div>
      <div class="history-amount" style="margin:0 10px;">${d.invoiceTotal === null ? '—' : fmtGbp(d.invoiceTotal)}</div>
      ${d.invoiceTotal !== null ? `<button class="action-btn" aria-label="Mark delivery from ${escHtml(d.supplierName || 'supplier')} ${d.paid ? 'unpaid' : 'paid'}"
        onclick="markGoodsInPaid('${d.id}', ${d.paid ? 'false' : 'true'})">${d.paid ? '↩️' : '💷 Pay'}</button>` : ''}
    </div>`;
  const goodsRows = goodsIn.length === 0
    ? `<div style="color:var(--muted);font-size:var(--fs-body);padding:8px 0;">No deliveries recorded yet. When stock arrives from a wholesaler, record it here — quantities and cost prices update themselves.</div>`
    : goodsIn.slice(0, 8).map(deliveryRow).join('');
  const unpaidCount = goodsIn.filter(d => !d.paid && d.invoiceTotal !== null).length;

  const saleRows = shopSales.length === 0
    ? `<div style="color:var(--muted);font-size:var(--fs-body);padding:8px 0;">No sales recorded yet.</div>`
    : shopSales.slice(0, 25).map(s => `
      <div class="history-item history-flat">
        <div style="flex:1;min-width:0;">
          <div class="history-desc"><strong>${escHtml(s.item)}</strong>${s.qty > 1 ? ` × ${s.qty}` : ''} — ${escName(s.customerName || 'Walk-in')}</div>
          <div style="font-size:var(--fs-micro);color:var(--muted);">${s.imei ? 'IMEI ' + escHtml(s.imei) + ' · ' : ''}${escHtml(s.notes || '')}</div>
        </div>
        <div class="history-date" style="margin:0 12px;">${fmtDate(s.createdAt)}</div>
        <div class="history-amount">${fmtGbp(s.total)}</div>
      </div>`).join('');

  content.innerHTML = `
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">Units In Stock</div><div class="stat-value">${inStock}</div></div>
      <div class="stat-card"><div class="stat-label">Low Stock</div>
        <div class="stat-value" style="color:${low.length ? 'var(--danger-ink)' : 'var(--success)'};">${low.length}</div></div>
      <div class="stat-card"><div class="stat-label">Sold Today</div>
        <div class="stat-value">${fmtGbp(todaySales.reduce((s, x) => s + x.total, 0))}</div>
        <div class="stat-sub">${todaySales.length} sale${todaySales.length === 1 ? '' : 's'}</div></div>
      <div class="stat-card"><div class="stat-label">All-Time Sales</div><div class="stat-value">${fmtGbp(revenue)}</div></div>
    </div>
    ${lowBanner}
    <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;">
      <button class="btn btn-primary" onclick="openSaleModal()">🧾 Open Till</button>
      <button class="btn btn-outline" onclick="openCashupModal()">💰 Cash up</button>
      <button class="btn btn-outline" onclick="openStockItemModal()">➕ Add item</button>
      <button class="btn btn-outline" onclick="openSupplierReturnModal()">↩️ Return to supplier</button>
      <button class="btn btn-outline" onclick="openGoodsInModal()">📦 Goods in</button>
    </div>
    <div class="dash-cols dash-cols-table">
      <div class="table-card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;padding:0 14px;">
          <div class="section-divider" style="margin:12px 0 4px;">Inventory</div>
          ${shopBar}
        </div>
        <table>
          <thead><tr><th>Item</th><th>Category</th><th>Cost</th><th>Price</th><th>Profit</th><th>Qty</th><th></th></tr></thead>
          <tbody>${itemRows}</tbody>
        </table>
      </div>
      <div>
        <div class="table-card" style="padding:8px 18px 14px;margin-bottom:14px;">
          <div class="section-divider" style="margin-top:12px;">Returns to supplier${openReturns.length
            ? ` <span style="color:var(--danger-ink);font-weight:600;">· ${openReturns.length} open${openClaim ? ' · ' + fmtGbp(openClaim) + ' claimed' : ''}</span>` : ''}</div>
          <div>${returnRows}</div>
        </div>
        <div class="table-card" style="padding:8px 18px 14px;margin-bottom:14px;">
          <div class="section-divider" style="margin-top:12px;">Goods in${totalOwed > 0.005
            ? ` <span style="color:var(--danger-ink);font-weight:600;">· ${fmtGbp(totalOwed)} owed${unpaidCount ? ` · ${unpaidCount} invoice${unpaidCount === 1 ? '' : 's'}` : ''}</span>` : ''}</div>
          ${balanceLine}
          <div>${goodsRows}</div>
        </div>
        <div class="table-card" style="padding:8px 18px 14px;">
          <div class="section-divider" style="margin-top:12px;">Recent sales</div>
          <div>${saleRows}</div>
        </div>
      </div>
    </div>`;
}

// ── Returns to supplier (RMA) — create + manage in one modal ──
function openSupplierReturnModal(retId = null) {
  const r = retId ? supplierReturns.find(x => x.id === retId) : null;
  const supplierOptions = suppliers.filter(s => s.active || (r && s.id === r.supplierId))
    .map(s => `<option value="${s.id}" ${r?.supplierId === s.id ? 'selected' : ''}>${escHtml(s.name)}</option>`).join('');
  showDynamicModal(`
    <div class="modal-title">${r ? '📤 Manage Return' : '📤 Return to Supplier'}</div>
    <div class="form-grid">
      <div class="form-group form-full">
        <label class="form-label">Supplier *</label>
        <select class="form-input" id="srSupplier" onchange="document.getElementById('srNewSupplierWrap').style.display = this.value === '__new' ? '' : 'none'">
          ${supplierOptions}
          <option value="__new" ${suppliers.length === 0 ? 'selected' : ''}>➕ New supplier…</option>
        </select>
      </div>
      <div class="form-group form-full" id="srNewSupplierWrap" style="${suppliers.length === 0 && !r ? '' : 'display:none;'}">
        <label class="form-label">New supplier name *</label>
        <input class="form-input" id="srNewSupplier" placeholder="e.g. TechTrade Wholesale">
      </div>
      <div class="form-group form-full">
        <label class="form-label">What's going back *</label>
        <textarea class="form-input" id="srItems" rows="2"
          placeholder="e.g. 6× Nokia 105, screens dead">${escHtml(r?.items || '')}</textarea>
      </div>
      <div class="form-group form-full">
        <label class="form-label">IMEIs <span style="color:var(--muted);font-weight:400;">(optional, one per line)</span></label>
        <textarea class="form-input" id="srImeis" rows="2" style="direction:ltr;">${escHtml(r?.imeis || '')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Claimed value £</label>
        <input class="form-input" type="number" step="0.01" min="0" id="srValue" value="${r?.claimedValue ?? ''}">
      </div>
      ${r ? `
      <div class="form-group">
        <label class="form-label">Status</label>
        <select class="form-input" id="srStatus">
          ${Object.entries(SUPPLIER_RETURN_STATUS).map(([k, v]) =>
            `<option value="${k}" ${r.status === k ? 'selected' : ''}>${v.label}</option>`).join('')}
        </select>
      </div>` : `
      <div class="form-group">
        <label class="form-label">&nbsp;</label>
        <div style="font-size:var(--fs-small);color:var(--muted);padding-top:8px;">Starts as “📦 To send”.</div>
      </div>`}
      <div class="form-group form-full">
        <label class="form-label">Notes</label>
        <input class="form-input" id="srNotes" value="${escHtml(r?.notes || '')}" placeholder="courier ref, who agreed the return…">
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeDynamicModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveSupplierReturn(${r ? `'${r.id}'` : 'null'})">💾 Save</button>
    </div>
  `);
}

async function saveSupplierReturn(retId) {
  let supplierId = document.getElementById('srSupplier').value;
  if (supplierId === '__new') {
    const name = document.getElementById('srNewSupplier').value.trim();
    if (!name) { toast('Give the new supplier a name.', 'error'); return; }
    const res = await kcFetch('/api/supplier-returns', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'supplier', name }),
    }).then(r => r.json()).catch(() => null);
    if (!res || !res.success) { toast(res?.error || 'Could not add the supplier.', 'error'); return; }
    supplierId = res.supplier.id;
  }
  const payload = {
    op: 'return',
    supplierId,
    items: document.getElementById('srItems').value.trim(),
    imeis: document.getElementById('srImeis').value.trim(),
    claimedValue: document.getElementById('srValue').value === '' ? null : parseFloat(document.getElementById('srValue').value),
    notes: document.getElementById('srNotes').value.trim(),
  };
  if (!payload.items) { toast('Say what is going back.', 'error'); return; }
  if (retId) {
    payload.id = retId;
    payload.status = document.getElementById('srStatus').value;
    delete payload.supplierId; // v1: a return stays with the supplier it was recorded against
  }
  const res = await kcFetch('/api/supplier-returns', {
    method: retId ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(r => r.json()).catch(() => null);
  if (!res || !res.success) { toast(res?.error || 'Could not save the return.', 'error'); return; }
  closeDynamicModal();
  toast(retId ? 'Return updated.' : 'Return recorded — it will nag from the dashboard until settled.', 'success');
  renderShopTab();
}

// ── Goods in — record a delivery; linked lines bump stock + cost ──
function giLineRowHtml(idx) {
  const itemOptions = shopItems.filter(i => i.active)
    .map(i => `<option value="${i.id}">${escHtml([i.company, i.model].filter(Boolean).join(' '))}</option>`).join('');
  return `
    <div class="gi-line" style="display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap;">
      <select class="form-input" data-gi="item" style="flex:2;min-width:130px;" aria-label="Stock item for line ${idx + 1}"
        onchange="giItemPicked(this)">
        <option value="">✍️ Not in stock list</option>
        ${itemOptions}
      </select>
      <input class="form-input" data-gi="desc" style="flex:3;min-width:140px;" placeholder="What arrived *" aria-label="Description for line ${idx + 1}">
      <input class="form-input" data-gi="qty" type="number" min="1" step="1" value="1" style="width:64px;" aria-label="Quantity for line ${idx + 1}">
      <input class="form-input" data-gi="cost" type="number" min="0" step="0.01" placeholder="£/unit" style="width:88px;" aria-label="Unit cost for line ${idx + 1}">
    </div>`;
}

function giItemPicked(sel) {
  const item = shopItems.find(i => i.id === sel.value);
  const row = sel.closest('.gi-line');
  const desc = row.querySelector('[data-gi="desc"]');
  const cost = row.querySelector('[data-gi="cost"]');
  if (item) {
    if (!desc.value.trim()) desc.value = [item.company, item.model].filter(Boolean).join(' ');
    if (!cost.value && item.netPrice !== null) cost.value = item.netPrice;
  }
}

function giAddLine() {
  const wrap = document.getElementById('giLines');
  wrap.insertAdjacentHTML('beforeend', giLineRowHtml(wrap.querySelectorAll('.gi-line').length));
}

function openGoodsInModal() {
  const supplierOptions = suppliers.filter(s => s.active)
    .map(s => `<option value="${s.id}">${escHtml(s.name)}</option>`).join('');
  showDynamicModal(`
    <div class="modal-title">📥 Goods In</div>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Supplier *</label>
        <select class="form-input" id="giSupplier" onchange="document.getElementById('giNewSupplierWrap').style.display = this.value === '__new' ? '' : 'none'">
          ${supplierOptions}
          <option value="__new" ${suppliers.length === 0 ? 'selected' : ''}>➕ New supplier…</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Delivery date</label>
        <input class="form-input" type="date" id="giDate" value="${localISO()}">
      </div>
      <div class="form-group form-full" id="giNewSupplierWrap" style="${suppliers.length === 0 ? '' : 'display:none;'}">
        <label class="form-label">New supplier name *</label>
        <input class="form-input" id="giNewSupplier" placeholder="e.g. TechTrade Wholesale">
      </div>
      <div class="form-group form-full">
        <label class="form-label">Lines * <span style="color:var(--muted);font-weight:400;">(pick a stock item to update its quantity and cost, or free-type)</span></label>
        <div id="giLines">${giLineRowHtml(0)}</div>
        <button type="button" class="btn btn-outline" style="padding:4px 10px;font-size:var(--fs-small);" onclick="giAddLine()">➕ Add line</button>
      </div>
      <div class="form-group">
        <label class="form-label">Invoice ref</label>
        <input class="form-input" id="giRef" placeholder="INV-1234">
      </div>
      <div class="form-group">
        <label class="form-label">Invoice total £</label>
        <input class="form-input" type="number" step="0.01" min="0" id="giTotal">
      </div>
      <div class="form-group form-full">
        <label class="form-label" style="display:flex;align-items:center;gap:8px;">
          <input type="checkbox" id="giPaid"> Already paid
        </label>
      </div>
      <div class="form-group form-full">
        <label class="form-label">Notes</label>
        <input class="form-input" id="giNotes" placeholder="who delivered, part-order…">
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeDynamicModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveGoodsIn()">💾 Save</button>
    </div>
  `);
}

async function saveGoodsIn() {
  let supplierId = document.getElementById('giSupplier').value;
  if (supplierId === '__new') {
    const name = document.getElementById('giNewSupplier').value.trim();
    if (!name) { toast('Give the new supplier a name.', 'error'); return; }
    const res = await kcFetch('/api/supplier-returns', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'supplier', name }),
    }).then(r => r.json()).catch(() => null);
    if (!res || !res.success) { toast(res?.error || 'Could not add the supplier.', 'error'); return; }
    supplierId = res.supplier.id;
  }
  const lines = [...document.querySelectorAll('#giLines .gi-line')].map(row => ({
    itemId: row.querySelector('[data-gi="item"]').value || null,
    description: row.querySelector('[data-gi="desc"]').value.trim(),
    qty: row.querySelector('[data-gi="qty"]').value,
    unitCost: row.querySelector('[data-gi="cost"]').value === '' ? null : parseFloat(row.querySelector('[data-gi="cost"]').value),
  })).filter(l => l.description);
  if (!lines.length) { toast('Add at least one line — what arrived?', 'error'); return; }
  const res = await kcFetch('/api/goods-in', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      supplierId,
      deliveryDate: document.getElementById('giDate').value,
      invoiceRef: document.getElementById('giRef').value.trim(),
      invoiceTotal: document.getElementById('giTotal').value === '' ? null : parseFloat(document.getElementById('giTotal').value),
      paid: document.getElementById('giPaid').checked,
      notes: document.getElementById('giNotes').value.trim(),
      lines,
    }),
  }).then(r => r.json()).catch(() => null);
  if (!res || !res.success) { toast(res?.error || 'Could not save the delivery.', 'error'); return; }
  closeDynamicModal();
  toast(res.warning || 'Delivery recorded — stock and costs updated.', res.warning ? 'error' : 'success');
  renderShopTab();
}

async function markGoodsInPaid(id, paid) {
  const res = await kcFetch('/api/goods-in', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, paid }),
  }).then(r => r.json()).catch(() => null);
  if (!res || !res.success) { toast(res?.error || 'Could not update the invoice.', 'error'); return; }
  toast(paid ? 'Marked paid.' : 'Marked unpaid.', 'success');
  renderShopTab();
}

function openStockItemModal(itemId = null) {
  const i = itemId ? shopItems.find(x => x.id === itemId) : null;
  showDynamicModal(`
    <div class="modal-title">${i ? '✏️ Edit Item' : '➕ Add Stock Item'}</div>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Category</label>
        <select class="form-input" id="siCategory">
          ${Object.entries(STOCK_CATEGORY_LABELS).map(([k, l]) =>
            `<option value="${k}" ${i?.category === k ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Code</label>
        <input class="form-input" id="siCode" value="${escHtml(i?.code || '')}" placeholder="e.g. AC-01">
      </div>
      <div class="form-group form-full">
        <label class="form-label">Barcode <span style="color:var(--muted);font-weight:400;">(click, then scan the packaging)</span></label>
        <input class="form-input" id="siBarcode" value="${escHtml(i?.barcode || '')}" placeholder="EAN / UPC"
          inputmode="numeric" autocomplete="off">
      </div>
      <div class="form-group">
        <label class="form-label">Brand / company</label>
        <input class="form-input" id="siCompany" value="${escHtml(i?.company || '')}" placeholder="e.g. Anker">
      </div>
      <div class="form-group">
        <label class="form-label">Model / name *</label>
        <input class="form-input" id="siModel" value="${escHtml(i?.model || '')}" placeholder="e.g. Powerbank 10000" list="siModelList">
        <datalist id="siModelList">${STOCK_TYPE_SUGGESTIONS.map(s => `<option value="${s}">`).join('')}</datalist>
      </div>
      <div class="form-group">
        <label class="form-label">Cost (net) £</label>
        <input class="form-input" type="number" step="0.01" min="0" id="siNet" value="${i?.netPrice ?? ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Selling price £ *</label>
        <input class="form-input" type="number" step="0.01" min="0" id="siSell" value="${i?.sellingPrice ?? ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Quantity</label>
        <input class="form-input" type="number" step="1" min="0" id="siQty" value="${i?.quantity ?? 0}">
      </div>
      <div class="form-group">
        <label class="form-label">Warn when below</label>
        <input class="form-input" type="number" step="1" min="0" id="siLow" value="${i?.lowStockAt ?? 1}">
      </div>
    </div>
    <div class="modal-actions" style="justify-content:space-between;">
      <span>${i ? `<button class="btn btn-outline" onclick="retireStockItem('${i.id}')">🗑 Retire</button>` : ''}</span>
      <span style="display:flex;gap:8px;">
        <button class="btn btn-outline" onclick="closeDynamicModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveStockItem(${i ? `'${i.id}'` : 'null'})">💾 Save</button>
      </span>
    </div>
  `);
}

async function saveStockItem(itemId) {
  const payload = {
    op: 'item',
    category: document.getElementById('siCategory').value,
    code: document.getElementById('siCode').value.trim(),
    barcode: document.getElementById('siBarcode').value.trim(),
    company: document.getElementById('siCompany').value.trim(),
    model: document.getElementById('siModel').value.trim(),
    netPrice: document.getElementById('siNet').value === '' ? undefined : parseFloat(document.getElementById('siNet').value),
    sellingPrice: parseFloat(document.getElementById('siSell').value),
    quantity: parseInt(document.getElementById('siQty').value, 10) || 0,
    lowStockAt: parseInt(document.getElementById('siLow').value, 10) || 0,
  };
  if (!payload.model) { toast('Model / name is required.', 'error'); return; }
  if (!Number.isFinite(payload.sellingPrice)) { toast('Enter a selling price.', 'error'); return; }
  const res = await kcFetch('/api/shop', {
    method: itemId ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(itemId ? { ...payload, id: itemId } : payload),
  }).then(r => r.json()).catch(() => null);
  if (!res || !res.success) { toast(res?.error || 'Could not save the item.', 'error'); return; }
  closeDynamicModal();
  toast('Item saved.', 'success');
  renderShopTab();
}

async function retireStockItem(itemId) {
  const ok = await window.api.confirmDelete('Retire this item?\n\nIt disappears from the shop but past sales keep their history.');
  if (!ok) return;
  const res = await kcFetch('/api/shop', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'item', id: itemId, active: false }),
  }).then(r => r.json()).catch(() => null);
  if (!res || !res.success) { toast(res?.error || 'Could not retire the item.', 'error'); return; }
  closeDynamicModal();
  toast('Item retired.', 'warning');
  renderShopTab();
}

// ── POS (shopfloor till): full-screen till — scan/tap → receipt → tender ──
let posBasket = []; // [{itemId, qty, imei}]
let posCat = 'all';
let posMethod = 'cash';
let posWallet = 0;  // £ of the sale drawn from the customer's wallet credit (split tender)
// One idempotency token per HANDOVER, minted on the first Charge press and kept
// through failed attempts — a re-ring after a lost response replays the SAME
// token, so the server can dedupe instead of double-charging. Cleared only on
// success/duplicate (and when the till opens fresh).
let posSaleRef = null;
let posLastSale = null; // { total, change } — shown as a banner until the next action

function openSaleModal(preselectItemId = null) { // name kept: every Sell button calls it
  const sellable = shopItems.filter(i => i.active && i.quantity > 0);
  if (!sellable.length) { toast('Nothing in stock to sell — add quantities first.', 'warning'); return; }
  posBasket = preselectItemId ? [{ itemId: preselectItemId, qty: 1, imei: '' }] : [];
  posCat = 'all';
  posMethod = 'cash';
  posWallet = 0;
  posSaleRef = null;   // fresh till session = fresh handover token
  posLastSale = null;
  kcEposProbe();       // learn (once) whether the cloud terminal lane is on
  renderPosView();
}


function closePosView() {
  document.body.classList.remove('pos-mode');
  renderShopTab();
}

function renderPosView() {
  const content = document.getElementById('mainContent');
  // Full-screen takeover: hide the sidebar/topbar so the till fills the
  // display like a real POS. Any tab switch clears it (renderTab guard).
  document.body.classList.add('pos-mode');
  const customerOptions = customers.map(c =>
    `<option value="${c.id}">${escName(c.firstName)} ${escName(c.lastName)}</option>`).join('');
  const cats = [...new Set(shopItems.filter(i => i.active && i.quantity > 0).map(i => i.category))];
  const parkedN = posParkedCount();
  content.innerHTML = `
    <div class="pos-shell">
      <div id="posParkedMenu" hidden></div>
      <div class="pos-main">
        <div style="display:flex;gap:8px;align-items:center;">
          <button class="btn btn-outline" onclick="closePosView()" style="white-space:nowrap;">← Exit till</button>
          <button id="posParkedBtn" class="btn btn-outline" onclick="posToggleParked()" title="Resume a held sale"
            style="white-space:nowrap;${parkedN ? '' : 'display:none;'}">⏸ Parked (<span id="posParkedN">${parkedN}</span>)</button>
          <input class="form-input pos-scan" id="posScan" placeholder="${kcHint('🔍 Scan a barcode, or type to search…', '🔍 Scan or search')}"
            autocomplete="off" oninput="posRenderTiles()"
            onkeydown="if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();saveSale();}else if(event.key==='Enter'){event.preventDefault();posScanEnter();}">
          <button class="theme-toggle" data-theme-btn onclick="toggleTheme()" title="Light / dark mode"
            aria-label="Toggle light or dark mode">${document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙'}</button>
          <button class="theme-toggle kc-textsize" data-textsize-btn onclick="cycleTextSize()"
            data-size="${escHtml(currentTextSize().key)}" title="Text size: ${escHtml(currentTextSize().label)}"
            aria-label="Text size: ${escHtml(currentTextSize().label)}. Press to change.">Aa</button>
        </div>
        <div class="pos-cats">
          <button class="pos-cat${posCat === 'all' ? ' on' : ''}" onclick="posSetCat('all')">All</button>
          ${cats.map(c => `<button class="pos-cat${posCat === c ? ' on' : ''}" onclick="posSetCat('${c}')">
            ${STOCK_CATEGORY_LABELS[c] || escHtml(c)}</button>`).join('')}
        </div>
        <div id="posTiles" class="pos-tiles pos-tiles-full"></div>
      </div>
      <div class="pos-side">
        <div class="pos-receipt-head">🧾 Current sale</div>
        <div id="posLastSale"></div>
        <div id="posBasket" class="pos-receipt"></div>
        <div class="pos-summary">
          <select class="form-input" id="posCustomer" onchange="posCustomerChange()" style="width:100%;min-height:0;padding:8px 12px;margin-bottom:8px;">
            <option value="walkin">🚶 Walk-in</option>
            ${customerOptions}
          </select>
          <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;">
            <label style="display:flex;align-items:center;gap:6px;font-size:var(--fs-body);cursor:pointer;flex-shrink:0;">
              <input type="checkbox" id="posPaid" checked onchange="posRenderTender()"> Paid now</label>
            <div class="pos-methods" id="posMethods">${posMethodsHtml()}</div>
          </div>
          <div id="posTender"></div>
          <div class="pos-total-row"><span>TOTAL</span><strong id="posTotal">£0.00</strong></div>
          <button class="btn btn-primary pos-charge" onclick="saveSale()" title="Ctrl+Enter from the scan box">💷 Charge<span class="kc-chord">Ctrl ⏎</span></button>
          <button class="btn btn-outline" onclick="posParkSale()" style="width:100%;margin-top:8px;"
            title="Hold this sale to serve someone else, then resume it later">⏸ Park sale</button>
        </div>
      </div>
    </div>`;
  posRenderTiles();
  posRenderBasket();
  posRenderTender();
  document.getElementById('posScan').focus();
}

function posMethodsHtml() {
  const m = [['cash', '💵 Cash'], ['card', '💳 Card'], ['bank_transfer', '🏦 Transfer']];
  return m.map(([k, label]) =>
    `<button class="pos-method${posMethod === k ? ' on' : ''}" onclick="posSetMethod('${k}')">${label}</button>`).join('');
}

function posSetMethod(m) {
  posMethod = m;
  const el = document.getElementById('posMethods');
  if (el) el.innerHTML = posMethodsHtml();
  posRenderTender();
  document.getElementById('posScan')?.focus();
}

function posSetCat(c) {
  posCat = c;
  document.querySelectorAll('.pos-cat').forEach(b => b.classList.toggle('on',
    b.textContent.trim() === 'All' ? c === 'all' : b.getAttribute('onclick').includes(`'${c}'`)));
  posRenderTiles();
  document.getElementById('posScan')?.focus();
}

// Tender area: an optional wallet-split row (real customer only) + the cash
// change helper. The wallet portion draws down the customer's credit — no cash
// moves for it; the remainder is paid by the method above, or left on account.
function posRenderTender() {
  const el = document.getElementById('posTender');
  if (!el) return;
  const custVal = document.getElementById('posCustomer')?.value || 'walkin';
  const paid = document.getElementById('posPaid')?.checked;
  const total = posTotalNow();
  let html = '';

  if (custVal && custVal !== 'walkin') {
    const cust = customers.find(c => String(c.id) === String(custVal));
    const bal = cust ? customerLedgerBalance(cust) : null;
    const credit = (typeof bal === 'number' && bal > 0) ? bal : 0;
    const maxW = Math.min(credit, total);
    html += `
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;flex-wrap:wrap;">
        <label style="font-size:var(--fs-body);flex-shrink:0;">👛 From wallet £</label>
        <input class="form-input" id="posWalletIn" type="number" min="0" step="0.01"
          value="${posWallet ? posWallet.toFixed(2) : ''}" placeholder="0.00"
          oninput="posWalletInput()" style="width:96px;min-height:0;padding:7px 10px;">
        <button class="pos-note" onclick="posWalletMax(${maxW.toFixed(2)})" ${maxW > 0 ? '' : 'disabled'}>Max</button>
        <span style="font-size:var(--fs-small);color:var(--muted);margin-left:auto;">${credit > 0 ? `credit ${fmtGbp(credit)}` : 'no credit'}</span>
      </div>
      <div id="posSplitInfo" style="font-size:var(--fs-small);color:var(--ink-secondary);margin-bottom:8px;min-height:15px;">${posSplitText()}</div>`;
  }

  if (paid && posMethod === 'cash') {
    html += `
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;flex-wrap:wrap;">
        <input class="form-input" id="posTenderIn" type="number" min="0" step="0.01" placeholder="Cash given £"
          oninput="posChangeCalc()" style="width:132px;min-height:0;padding:7px 10px;">
        ${[5, 10, 20, 50].map(n => `<button class="pos-note" onclick="posTenderQuick(${n})">£${n}</button>`).join('')}
        <span id="posChange" style="font-weight:700;font-size:var(--fs-ui);margin-left:auto;"></span>
      </div>`;
  }
  el.innerHTML = html;
  posChangeCalc();
}

// £ still to settle at the till after the wallet portion (the cash/card due).
function posCashDue() {
  const total = posTotalNow();
  return Math.max(0, +(total - Math.min(posWallet, total)).toFixed(2));
}

// One-line split summary: "👛 Wallet £20 · Cash £10" / "· On account £10".
function posSplitText() {
  const total = posTotalNow();
  const w = Math.min(posWallet, total);
  if (w <= 0) return '';
  const rest = posCashDue();
  const paid = document.getElementById('posPaid')?.checked;
  const restLabel = rest <= 0 ? '' : ` · ${paid ? (METHOD_LABELS[posMethod] || posMethod) : 'On account'} ${fmtGbp(rest)}`;
  return `👛 Wallet ${fmtGbp(w)}${restLabel}`;
}

function posCustomerChange() {
  posWallet = 0;            // wallet credit is per-customer — reset on switch
  posRenderTender();
  document.getElementById('posScan')?.focus();
}

// Update on wallet-field keystrokes WITHOUT re-rendering (keeps the field
// focused). Stores the RAW typed value — every reader (posCashDue, the split
// summary, submit) clamps against the LIVE total, so growing the basket after
// typing honours the full typed amount instead of a stale clamp.
function posWalletInput() {
  const el = document.getElementById('posWalletIn');
  let v = parseFloat(el?.value);
  if (!Number.isFinite(v) || v < 0) v = 0;
  posWallet = v;
  const info = document.getElementById('posSplitInfo');
  if (info) info.textContent = posSplitText();
  posChangeCalc();
}

function posWalletMax(v) {
  posWallet = Math.max(0, Number(v) || 0);
  const el = document.getElementById('posWalletIn');
  if (el) el.value = posWallet ? posWallet.toFixed(2) : '';
  posRenderTender();
}

function posTotalNow() {
  return posBasket.reduce((s, l) => {
    const i = shopItems.find(x => x.id === l.itemId);
    return s + (i ? (i.sellingPrice || 0) * l.qty : 0);
  }, 0);
}

function posTenderQuick(n) {
  const el = document.getElementById('posTenderIn');
  if (!el) return;
  el.value = ((parseFloat(el.value) || 0) + n).toFixed(2);
  posChangeCalc();
}

function posChangeCalc() {
  const out = document.getElementById('posChange');
  if (!out) return;
  const given = parseFloat(document.getElementById('posTenderIn')?.value);
  if (!Number.isFinite(given)) { out.textContent = ''; return; }
  const change = given - posCashDue();   // change is against the cash due, not the gross total
  out.style.color = change < 0 ? 'var(--danger-ink)' : 'var(--success)';
  out.textContent = change < 0 ? `${fmtGbp(Math.abs(change))} short` : `Change ${fmtGbp(change)}`;
}

function posFindItem(q) {
  const digits = q.replace(/\D/g, '');
  return shopItems.find(i => i.active && i.quantity > 0 && i.barcode && i.barcode === q)
    || shopItems.find(i => i.active && i.quantity > 0 && (
      (i.code && i.code.toLowerCase() === q.toLowerCase()) ||
      (digits.length >= 5 && ((i.barcode || '').replace(/\D/g, '') === digits ||
                              (i.code || '').replace(/\D/g, '') === digits)) ||
      [i.company, i.model].filter(Boolean).join(' ').toLowerCase() === q.toLowerCase()
    ));
}

function posScanEnter() {
  const el = document.getElementById('posScan');
  const q = el.value.trim();
  if (!q) return;
  // Exact barcode/code/name hit, or the single visible tile.
  const shown = shopItems.filter(i => i.active && i.quantity > 0 && posTileMatch(i, q));
  const item = posFindItem(q) || (shown.length === 1 ? shown[0] : null);
  if (item) { posAdd(item.id); el.value = ''; posRenderTiles(); }
  else toast('No matching item.', 'warning');
}

function posTileMatch(i, q) {
  if (posCat !== 'all' && i.category !== posCat) return false;
  if (!q) return true;
  const hay = `${i.barcode || ''} ${i.code || ''} ${i.company || ''} ${i.model || ''}`.toLowerCase();
  return hay.includes(q.toLowerCase());
}

function posRenderTiles() {
  const q = document.getElementById('posScan')?.value.trim() || '';
  const el = document.getElementById('posTiles');
  if (!el) return;
  const list = shopItems.filter(i => i.active && i.quantity > 0 && posTileMatch(i, q)).slice(0, 60);
  el.innerHTML = list.map(i => `
    <div class="pos-tile" onclick="posAdd('${i.id}')">
      <div class="pos-tile-name">${escHtml([i.company, i.model].filter(Boolean).join(' '))}</div>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:6px;">
        <span style="color:var(--muted);font-size:var(--fs-small);">${i.quantity} left</span>
        <span class="pos-tile-price">${fmtGbp((i.sellingPrice || 0))}</span>
      </div>
    </div>`).join('') || '<div style="color:var(--muted);font-size:var(--fs-body);padding:6px;">No matching items.</div>';
}

function posAdd(itemId) {
  const item = shopItems.find(i => i.id === itemId);
  if (!item) return;
  if (posLastSale) { posLastSale = null; posShowLastSale(); } // new customer, clear the banner
  const line = posBasket.find(l => l.itemId === itemId);
  const inBasket = line ? line.qty : 0;
  if (inBasket + 1 > item.quantity) { toast(`Only ${item.quantity} in stock.`, 'warning'); return; }
  if (line) line.qty++;
  else posBasket.push({ itemId, qty: 1, imei: '' });
  posRenderBasket();
}

function posQty(itemId, delta) {
  const line = posBasket.find(l => l.itemId === itemId);
  if (!line) return;
  const item = shopItems.find(i => i.id === itemId);
  line.qty += delta;
  if (line.qty <= 0) posBasket = posBasket.filter(l => l !== line);
  else if (item && line.qty > item.quantity) { line.qty = item.quantity; toast(`Only ${item.quantity} in stock.`, 'warning'); }
  posRenderBasket();
}

function posImei(itemId, v) {
  const line = posBasket.find(l => l.itemId === itemId);
  if (line) line.imei = v.trim();
}

function posRenderBasket() {
  const el = document.getElementById('posBasket');
  if (!el) return;
  let total = 0;
  el.innerHTML = posBasket.length === 0
    ? '<div style="color:var(--muted);font-size:var(--fs-body);padding:10px 2px;">Scan a barcode or tap an item to start.</div>'
    : posBasket.map(l => {
        const i = shopItems.find(x => x.id === l.itemId);
        if (!i) return '';
        const lineTotal = (i.sellingPrice || 0) * l.qty;
        total += lineTotal;
        return `
        <div class="pos-line">
          <div style="flex:1;min-width:0;">
            <div style="font-size:var(--fs-body);">${escHtml([i.company, i.model].filter(Boolean).join(' '))}</div>
            <div style="font-size:var(--fs-micro);color:var(--muted);">${fmtGbp((i.sellingPrice || 0))} each</div>
            ${i.category === 'phone' ? `<input class="form-input" placeholder="IMEI (scan)" value="${escHtml(l.imei)}"
              oninput="posImei('${i.id}', this.value)" style="width:100%;min-height:0;padding:4px 8px;font-size:var(--fs-micro);margin-top:3px;">` : ''}
          </div>
          <button class="action-btn" style="min-width:40px;min-height:40px;font-size:var(--fs-title);line-height:1;" aria-label="One fewer ${escHtml(i.name || 'item')}" onclick="posQty('${i.id}',-1)">−</button>
          <strong style="min-width:26px;text-align:center;font-size:var(--fs-lead);">${l.qty}</strong>
          <button class="action-btn" style="min-width:40px;min-height:40px;font-size:var(--fs-title);line-height:1;" aria-label="One more ${escHtml(i.name || 'item')}" onclick="posQty('${i.id}',1)">+</button>
          <strong style="min-width:58px;text-align:right;font-feature-settings:'tnum';">${fmtGbp(lineTotal)}</strong>
          <button class="action-btn" style="min-width:40px;min-height:40px;color:var(--danger-ink);font-size:var(--fs-lead);" title="Void line" aria-label="Remove ${escHtml(i.name || 'item')} from the sale"
            onclick="posQty('${i.id}',-999)">✕</button>
        </div>`;
      }).join('');
  const totalEl = document.getElementById('posTotal');
  if (totalEl) totalEl.textContent = `${fmtGbp(total)}`;
  // Basket edits change the split — keep the wallet summary + change live.
  const splitInfo = document.getElementById('posSplitInfo');
  if (splitInfo) splitInfo.textContent = posSplitText();
  posChangeCalc();
}

function posShowLastSale() {
  const el = document.getElementById('posLastSale');
  if (!el) return;
  if (!posLastSale) { el.innerHTML = ''; return; }
  const canEmail = !!posLastSale.customerId;
  el.innerHTML = `
    <div class="pos-done">
      ✅ ${fmtGbp(posLastSale.total)} taken${posLastSale.change !== null
        ? ` — <strong>change ${fmtGbp(posLastSale.change)}</strong>` : ''}
      ${canEmail ? `<button class="btn btn-secondary" style="margin-top:8px;width:100%;"
        onclick="emailSaleReceipt(this)" ${posLastSale.emailed ? 'disabled' : ''}>
        ${posLastSale.emailed ? '✉️ Receipt sent' : '✉️ Email receipt'}</button>` : ''}
    </div>`;
}

// ── Park / hold an open sale ─────────────────────────────────────────────
// Suspend an in-progress till sale so the cashier can serve someone else, then
// resume it — the Loyverse "hold ticket" pattern. Purely PRE-charge: it snapshots
// the basket + selections to localStorage; nothing is charged, no ledger/stock
// write happens until the resumed sale hits Charge (saveSale), which keeps its own
// server-side atomic stock guard. Parked sales survive Exit till + reload.
const POS_PARKED_KEY = 'kc_parked_sales';
function posGetParked() {
  try { const a = JSON.parse(localStorage.getItem(POS_PARKED_KEY) || '[]'); return Array.isArray(a) ? a : []; }
  catch { return []; }
}
function posSetParked(a) {
  try { localStorage.setItem(POS_PARKED_KEY, JSON.stringify(a || [])); } catch {}
}
function posParkedCount() { return posGetParked().length; }
function posSyncParkedButton() {
  const n = posParkedCount();
  const span = document.getElementById('posParkedN'); if (span) span.textContent = n;
  const btn = document.getElementById('posParkedBtn'); if (btn) btn.style.display = n ? '' : 'none';
}

// Snapshot the current sale and clear the till for the next customer.
// silent=true is used when auto-holding the current sale before resuming another,
// so nothing is ever lost — no toast, no menu, but the same reset.
function posParkSale(silent) {
  if (!posBasket.length) { if (!silent) toast('Nothing to park — the basket is empty.', 'warning'); return; }
  const custEl = document.getElementById('posCustomer');
  const custId = custEl ? custEl.value : 'walkin';
  let custName = 'Walk-in';
  if (custId && custId !== 'walkin') {
    const c = customers.find(x => String(x.id) === String(custId));
    if (c) custName = `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Customer';
  }
  const paidEl = document.getElementById('posPaid');
  const entry = {
    id: 'pk_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    at: Date.now(),
    customerId: custId,
    customerName: custName,
    method: posMethod,
    paidNow: paidEl ? !!paidEl.checked : true,
    basket: posBasket.map(l => ({ itemId: l.itemId, qty: l.qty, imei: l.imei || '' })),
    total: posTotalNow(),
    count: posBasket.reduce((s, l) => s + l.qty, 0),
  };
  posSetParked([entry, ...posGetParked()].slice(0, 20)); // cap the hold queue
  // Reset the current sale in place (don't rebuild the whole view — that would
  // drop an in-progress customer selection when resuming/discarding elsewhere).
  posBasket = []; posWallet = 0; posLastSale = null;
  if (custEl) custEl.value = 'walkin';
  if (paidEl) paidEl.checked = true;
  posRenderBasket(); posShowLastSale(); posRenderTender(); posSyncParkedButton();
  if (!silent) {
    const menu = document.getElementById('posParkedMenu'); if (menu) { menu.hidden = true; menu.innerHTML = ''; }
    toast(`Sale parked — ${custName}, ${fmtGbp(entry.total)}.`, 'success');
    document.getElementById('posScan')?.focus();
  }
}

// Load a parked sale back into the till. The current basket (if any) is parked
// first, so switching between customers never loses a basket.
function posResumeSale(id) {
  const target = posGetParked().find(p => p.id === id);
  if (!target) { posRenderParkedMenu(); return; }
  if (posBasket.length) posParkSale(true);          // hold the current one first
  posSetParked(posGetParked().filter(p => p.id !== id));
  posBasket = (target.basket || []).map(l => ({ itemId: l.itemId, qty: l.qty, imei: l.imei || '' }));
  posMethod = target.method || 'cash';
  posWallet = 0; posLastSale = null;
  const custEl = document.getElementById('posCustomer'); if (custEl) custEl.value = target.customerId || 'walkin';
  const paidEl = document.getElementById('posPaid'); if (paidEl) paidEl.checked = target.paidNow !== false;
  const methodsEl = document.getElementById('posMethods'); if (methodsEl) methodsEl.innerHTML = posMethodsHtml();
  posRenderBasket(); posShowLastSale(); posRenderTender(); posSyncParkedButton();
  const menu = document.getElementById('posParkedMenu'); if (menu) { menu.hidden = true; menu.innerHTML = ''; }
  toast(`Sale resumed — ${target.customerName || 'Walk-in'}.`, 'success');
  document.getElementById('posScan')?.focus();
}

function posDiscardParked(id) {
  posSetParked(posGetParked().filter(p => p.id !== id));
  posSyncParkedButton();
  posRenderParkedMenu(); // re-render (auto-hides when the queue empties)
}

function posToggleParked() {
  const el = document.getElementById('posParkedMenu');
  if (!el) return;
  if (!el.hidden) { el.hidden = true; el.innerHTML = ''; return; }
  posRenderParkedMenu();
}

function posRenderParkedMenu() {
  const el = document.getElementById('posParkedMenu');
  if (!el) return;
  const parked = posGetParked();
  if (!parked.length) { el.hidden = true; el.innerHTML = ''; return; }
  const pad2 = (n) => String(n).padStart(2, '0');
  const rows = parked.map(p => {
    const d = new Date(p.at || Date.now());
    const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-top:1px solid var(--border);">
        <div style="flex:1;min-width:0;">
          <div style="font-size:var(--fs-body);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escName(p.customerName || 'Walk-in')}</div>
          <div style="font-size:var(--fs-micro);color:var(--muted);">${p.count} item${p.count === 1 ? '' : 's'} · ${fmtGbp(p.total || 0)} · held ${hm}</div>
        </div>
        <button class="btn btn-primary" style="padding:6px 12px;" onclick="posResumeSale('${p.id}')">Resume</button>
        <button class="action-btn" style="min-width:36px;min-height:36px;color:var(--danger-ink);" title="Discard this held sale" onclick="posDiscardParked('${p.id}')">✕</button>
      </div>`;
  }).join('');
  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 12px 8px;">
      <span style="font-size:var(--fs-small);font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);">Parked sales</span>
      <button class="action-btn" style="min-width:32px;min-height:32px;" title="Close" onclick="posToggleParked()">✕</button>
    </div>
    ${rows}`;
  el.style.cssText = 'position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:1000;width:min(440px,92vw);background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;box-shadow:0 10px 40px rgba(0,0,0,.28);max-height:70vh;overflow:auto;';
  el.hidden = false;
}

async function emailSaleReceipt(btn) {
  if (!posLastSale || !posLastSale.customerId) return;
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
  const res = await kcFetch('/api/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind: 'sale',
      customerId: posLastSale.customerId,
      lines: posLastSale.lines,
      total: posLastSale.total,
      method: posLastSale.method,
      paidNow: posLastSale.paidNow,
    }),
  }).then(r => r.json()).catch(() => null);
  if (res && res.success && res.held) {
    toast(res.note || 'Email is on hold — receipt not sent.', 'warning');
  } else if (res && res.success && res.redirected) {
    posLastSale.emailed = true;
    toast(res.note || `Test mode — sent to ${res.sentTo}.`, 'warning');
  } else if (res && res.success) {
    posLastSale.emailed = true;
    toast(`Receipt emailed to ${res.sentTo}.`, 'success');
  } else {
    toast(res?.error || 'Could not send the receipt.', 'error');
  }
  posShowLastSale();
}

// ── myPOS terminal bridge — two lanes, one contract ──────────────────────
// Lane 1 (Android wrapper): the native side injects window.KCTill with
// charge(amountPence, chargeReference) — it starts a sale on the terminal
// and reports back by calling window.kcTillResult({ chargeReference,
// approved, myposRef, stan, authCode, brand, last4, error }).
// Lane 2 (ePOS API, cloud): no wrapper needed — /api/pos/terminal pushes the
// amount to the shop terminal over myPOS's ePOS API and the till polls for
// the outcome, then reports through the SAME window.kcTillResult, so the
// approval cache, re-ring guard and card_receipts recording are one code
// path for both lanes. With neither lane available the manual card flow is
// unchanged.
const kcTillPending = {};
// Approved terminal charges per reference WITH the approved amount: a re-ring
// after a lost sale POST reuses the approval instead of charging the card
// twice — but ONLY for the same total. If the basket changed, the operator is
// blocked and told to re-ring the original total or refund on the machine.
const kcTillApproved = {};   // ref → { result, amountPence }
const kcTillAmounts = {};    // ref → requested pence (survives the timeout)
let kcEposEnabled = false;
let kcEposProbed = false;
async function kcEposProbe() {
  if (kcEposProbed) return;
  kcEposProbed = true;
  try {
    const d = await (await kcFetch('/api/pos/terminal')).json();
    kcEposEnabled = !!(d && d.success && d.enabled);
  } catch { kcEposEnabled = false; }
}
function kcWrapperAvailable() { return !!(window.KCTill && typeof window.KCTill.charge === 'function'); }
function kcTillAvailable() { return kcWrapperAvailable() || kcEposEnabled; }
function kcTillCharge(amountPence, chargeReference) {
  const cached = kcTillApproved[chargeReference];
  if (cached) {
    if (cached.amountPence === amountPence) return Promise.resolve(cached.result);
    return Promise.resolve({ approved: false, mismatch: true, approvedAmount: cached.amountPence });
  }
  kcTillAmounts[chargeReference] = amountPence;
  if (!kcWrapperAvailable()) return kcEposCharge(amountPence, chargeReference);
  return new Promise((resolve) => {
    // Terminal interactions are slow (card tap, PIN, issuer) — 3 minutes, then
    // give up with "no answer" so the operator checks the machine itself.
    const timer = setTimeout(() => { delete kcTillPending[chargeReference]; resolve(null); }, 180000);
    kcTillPending[chargeReference] = (result) => { clearTimeout(timer); resolve(result); };
    try { window.KCTill.charge(amountPence, chargeReference); }
    catch (e) {
      clearTimeout(timer);
      delete kcTillPending[chargeReference];
      resolve({ approved: false, error: String((e && e.message) || e) });
    }
  });
}
// ePOS lane: start the payment server-side, poll every 2s until the terminal
// answers, then report through window.kcTillResult like the wrapper does.
// Transient poll failures are tolerated (the terminal is mid-interaction);
// if the till's 3-minute patience runs out first, the loop notices its
// pending slot is gone, stops, and best-effort cancels so the terminal
// doesn't sit waiting for a sale the till already abandoned.
function kcEposCharge(amountPence, chargeReference) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => { delete kcTillPending[chargeReference]; resolve(null); }, 180000);
    kcTillPending[chargeReference] = (result) => { clearTimeout(timer); resolve(result); };
    (async () => {
      let paymentId = null;
      const finish = (r) => window.kcTillResult({ chargeReference, ...r });
      const cancelUpstream = () => {
        if (!paymentId) return;
        kcFetch('/api/pos/terminal', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ op: 'cancel', paymentId }),
        }).catch(() => {});
      };
      try {
        const r = await kcFetch('/api/pos/terminal', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ op: 'charge', chargeReference, amountPence }),
        });
        const d = await r.json();
        if (!d.success) { finish({ approved: false, error: d.error || 'The card machine could not be started.' }); return; }
        paymentId = d.paymentId;
        while (true) {
          await new Promise((z) => setTimeout(z, 2000));
          if (!kcTillPending[chargeReference]) {
            // Till gave up: try to free the terminal, then look ONCE more —
            // if the card was actually approved in the gap, report it late so
            // the approval cache blocks a second charge (same protection as
            // the wrapper's late kcTillResult callback).
            cancelUpstream();
            try {
              const s = await (await kcFetch(`/api/pos/terminal?paymentId=${encodeURIComponent(paymentId)}`)).json();
              if (s && s.success && s.done && s.approved) finish({ approved: true, myposRef: paymentId });
            } catch { /* nothing to salvage */ }
            return;
          }
          try {
            const s = await (await kcFetch(`/api/pos/terminal?paymentId=${encodeURIComponent(paymentId)}`)).json();
            if (s && s.success && s.done) {
              finish({ approved: !!s.approved, myposRef: paymentId, error: s.approved ? null : (s.error || 'Declined') });
              return;
            }
          } catch { /* one missed poll is fine — keep waiting */ }
        }
      } catch (e) {
        cancelUpstream();
        finish({ approved: false, error: String((e && e.message) || e) });
      }
    })();
  });
}
window.kcTillResult = (result) => {
  const ref = result && result.chargeReference;
  if (!ref) return;
  // Cache and audit-log EVERY approval — even one arriving after the till
  // gave up — so the card can never be tapped twice for this reference, and
  // card_receipts shows the terminal charge whether or not the sale posted
  // (an approved row with no ledger match = "card taken, sale missing").
  if (result.approved && !kcTillApproved[ref]) {
    const amountPence = kcTillAmounts[ref];
    kcTillApproved[ref] = { result, amountPence };
    if (Number.isFinite(amountPence)) kcTillRecordResult(ref, amountPence / 100, result);
  }
  const done = kcTillPending[ref];
  if (done) { delete kcTillPending[ref]; done(result); return; }
  if (result.approved) {
    toast('The card machine approved after the till gave up — re-ring the SAME items to record the sale; the card will NOT be charged again.', 'warning');
  }
};
// Attach the terminal's references to the ledger payment row (reconciliation).
// Non-fatal: the money is already on the ledger; a miss only loses metadata.
function kcTillRecordResult(payRef, amount, r) {
  return kcFetch('/api/pos/card-result', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chargeReference: payRef, approved: true, amount,
      myposRef: r.myposRef, stan: r.stan, authCode: r.authCode, brand: r.brand, last4: r.last4,
    }),
  }).then(res => res.json())
    .then(res => { if (!res || !res.success) throw new Error('save failed'); })
    .catch(() => toast('Card taken, but the terminal reference didn’t save for reconciliation.', 'warning'));
}

async function saveSale() {
  if (!posBasket.length) { toast('The basket is empty.', 'error'); return; }
  const paidNow = document.getElementById('posPaid').checked;
  const given = parseFloat(document.getElementById('posTenderIn')?.value);
  const totalBefore = posTotalNow();
  const walletAmount = Math.min(Math.max(posWallet, 0), totalBefore);
  const cashDue = Math.max(0, +(totalBefore - walletAmount).toFixed(2));
  if (paidNow && posMethod === 'cash' && Number.isFinite(given) && given < cashDue) {
    toast(`Cash given (${fmtGbp(given)}) is less than the ${fmtGbp(cashDue)} due.`, 'error');
    return;
  }
  // Guard against a double-tap firing two sales; the per-HANDOVER token (kept
  // across failed attempts, cleared on success/duplicate) makes an operator
  // re-ring after a lost response replay the same token — the server dedupes
  // instead of charging twice. audit U3/A2.
  // A blocked re-tap used to return in total silence, which reads exactly like
  // a dead button to the operator standing at the counter.
  if (!kcBeginWrite('sale')) { toast('Still working on the last one — give it a moment.', 'info'); return; }
  if (!posSaleRef) posSaleRef = kcRef();
  // Terminal lane: inside the K300 wrapper a card payment goes to the machine
  // FIRST — only an approved tap records the sale. The result is keyed to the
  // same reference as the ledger payment row (PAY-SALE-<ref>-now) so the
  // settlement can be reconciled line by line.
  const payRef = `PAY-SALE-${posSaleRef}-now`;
  let tillResult = null;
  let res;
  // A tap/PIN/issuer round trip is ~10-40s. Without a busy state the button
  // stays live and the screen says nothing, so the operator cannot tell
  // "waiting on the machine" from "my tap didn't register" — well past the
  // ~10s threshold where a persistent indicator is required. Every other
  // write in this file already does disabled + relabel; this one was the
  // outlier, on the most-repeated action in the shop.
  const chargeBtn = document.querySelector('.pos-charge');
  const chargeIdle = chargeBtn ? chargeBtn.textContent : '';
  const setCharging = (on, label) => {
    if (!chargeBtn) return;
    chargeBtn.disabled = on;
    chargeBtn.textContent = on ? label : chargeIdle;
  };
  try {
    if (paidNow && posMethod === 'card' && cashDue > 0 && kcTillAvailable()) {
      toast(`Take ${fmtGbp(cashDue)} on the card machine…`, 'info');
      setCharging(true, '⏳ Waiting for the card machine…');
      tillResult = await kcTillCharge(Math.round(cashDue * 100), payRef);
      if (!tillResult) {
        toast('No answer from the card machine — nothing was recorded. Check the terminal and try again.', 'error');
        return;
      }
      if (tillResult.mismatch) {
        toast(`This sale already has a ${fmtGbp(tillResult.approvedAmount / 100)} card approval pending. Re-ring exactly that total to record it, or refund it on the machine and start fresh (Exit till).`, 'error');
        return;
      }
      if (!tillResult.approved) {
        toast(`Card ${tillResult.error ? 'error: ' + tillResult.error : 'declined'} — nothing was recorded.`, 'error');
        return;
      }
    }
    setCharging(true, '⏳ Recording the sale…');
    res = await kcFetch('/api/shop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        op: 'sale',
        lines: posBasket,
        customerId: document.getElementById('posCustomer').value,
        paidNow,
        method: posMethod,
        walletAmount,
        clientRef: posSaleRef,
      }),
    }).then(r => r.json()).catch(() => null);
  } finally {
    // Restores on every exit, including the early returns for a declined,
    // mismatched or unanswered terminal.
    setCharging(false);
    kcEndWrite('sale');
  }
  // NOTE: on a failed POST after an approved tap, posSaleRef and the cached
  // approval are both kept — the operator's re-ring replays the same sale
  // without touching the card again.
  if (!res || !res.success) { toast(res?.error || 'Could not record the sale.', 'error'); return; }
  // The terminal metadata was already audit-logged at approval time
  // (kcTillResult) — here we only retire the approval now the sale is real.
  if (tillResult) {
    delete kcTillApproved[payRef];
    delete kcTillAmounts[payRef];
  }
  if (res.duplicate) {
    posBasket = []; posWallet = 0; posSaleRef = null;
    posRenderTiles(); posRenderBasket(); posRenderTender();
    toast('Sale already recorded — no double charge.', 'info');
    const scan = document.getElementById('posScan');
    if (scan) { scan.value = ''; scan.focus(); }
    return;
  }

  // Stay in the till for the next customer: update local stock, clear the
  // basket, show the change banner, keep the scanner focused.
  posBasket.forEach(l => {
    const i = shopItems.find(x => x.id === l.itemId);
    if (i) i.quantity = Math.max(0, i.quantity - l.qty);
  });
  const custId = document.getElementById('posCustomer').value;
  const receiptLines = posBasket.map(l => {
    const i = shopItems.find(x => x.id === l.itemId);
    return {
      name: i ? [i.company, i.model].filter(Boolean).join(' ') : 'Item',
      qty: l.qty,
      total: Number.isFinite(Number(l.total)) ? Number(l.total) : (i ? (i.sellingPrice || 0) * l.qty : 0),
    };
  });
  posLastSale = {
    total: res.total,
    change: paidNow && posMethod === 'cash' && Number.isFinite(given) ? Math.max(0, given - cashDue) : null,
    customerId: custId && custId !== 'walkin' ? custId : null,
    lines: receiptLines,
    method: posMethod,
    paidNow,
    emailed: false,
  };
  // Keep the till's view of this customer's credit fresh for the next sale.
  if (custId && custId !== 'walkin' && customerLedgerBal && typeof res.balance === 'number') {
    customerLedgerBal.set(String(custId), Number(res.balance));
  }
  posBasket = []; posWallet = 0; posSaleRef = null;
  const walletNote = res.walletApplied > 0 ? ` (${fmtGbp(res.walletApplied)} from wallet)` : '';
  toast(`Sold ${res.lines} item${res.lines === 1 ? '' : 's'} — ${fmtGbp(res.total)}${walletNote}.`, 'success');
  // Credit turned out smaller than the agreed split — the uncovered part stayed
  // on the customer's account. Loud, persistent (error toasts stay until clicked).
  if (res.walletShortfall > 0) {
    toast(`Heads up: only ${fmtGbp(res.walletApplied)} credit was available — ${fmtGbp(res.walletShortfall)} left on the customer's account.`, 'error');
  }
  posRenderTiles();
  posRenderBasket();
  posRenderTender();
  posShowLastSale();
  const scan = document.getElementById('posScan');
  if (scan) { scan.value = ''; scan.focus(); }
}

// ─────────────────────────────────────────────
//  KOL TORAH — CD catalogue, shul consignment, settlements, conversion jobs
// ─────────────────────────────────────────────
// The recently-acquired audio business. Money follows the house rules: a
// settlement on a wallet-linked shul posts stock_sale + payment ledger rows;
// collecting a priced job charges the customer's wallet (KT-JOB-<id>).
let ktData = null;
let ktJobRef = null;          // idempotency token for the in-flight new job
const ktSettleRefs = {};      // per-shul settlement tokens, kept across retries
const ktMoveRefs = {};        // per-(shul,title,kind,qty) movement tokens, ditto
const ktEditShuls = new Set();

const KT_JOB_KINDS = { cd_to_mp3: 'CD → MP3', cd_to_sd: 'CD → SD card', cd_copy: 'CD copying', audio_other: 'Audio work' };
const KT_JOB_BADGE = {
  open:      'background:rgba(59,130,246,0.14);color:var(--accent);',
  ready:     'background:rgba(14,138,82,0.14);color:var(--success-ink);',
  collected: 'background:rgba(148,163,184,0.18);color:var(--muted);',
  cancelled: 'background:rgba(239,68,68,0.12);color:var(--danger-ink);',
};

function ktSectionHead(title, sub) {
  return `<div style="display:flex;align-items:baseline;gap:10px;margin:18px 2px 8px;">
    <h3 style="font-size:var(--fs-ui);font-weight:700;">${title}</h3>
    <span style="font-size:var(--fs-small);color:var(--muted);">${sub || ''}</span></div>`;
}

async function renderKolTorahTab() {
  const content = document.getElementById('mainContent');
  content.innerHTML = skeletonHtml('koltorah');
  const res = await kcFetch('/api/kol-torah').then(r => r.json()).catch(() => null);
  if (!res || !res.success) { content.innerHTML = errorHtml('Couldn’t load Kol Torah'); return; }
  ktData = res;
  if (currentTab !== 'koltorah') return; // user navigated away mid-load
  const d = ktData;

  const activeTitles = d.titles.filter(t => t.active);
  const openJobs = d.jobs.filter(j => j.status === 'open' || j.status === 'ready');
  const outQty = d.stock.reduce((s, r) => s + r.qty, 0);
  const received30 = d.settlements
    .filter(s => Date.now() - new Date(s.createdAt).getTime() < 30 * 86400000)
    .reduce((s, x) => s + x.received, 0);

  const customerOptions = customers.map(c =>
    `<option value="${escHtml(String(c.id))}">${escName(c.firstName)} ${escName(c.lastName)}</option>`).join('');
  const titleOptions = activeTitles.map(t =>
    `<option value="${t.id}">${escHtml(t.name)}${t.price ? ` — ${fmtGbp(t.price)}` : ''}</option>`).join('');

  // ── Jobs ────────────────────────────────────────────────────────────────
  const jobBtns = (j) => {
    const b = [];
    if (j.status === 'open') b.push(['ready', '✅ Ready', 'btn btn-outline']);
    if (j.status === 'open' || j.status === 'ready') {
      b.push(['collected', '📤 Collected', 'btn btn-primary']);
      b.push(['cancelled', '✕', 'action-btn danger']);
    }
    if (j.status === 'ready') b.push(['open', '↩', 'btn btn-outline']);
    if (j.status === 'cancelled') b.push(['open', '↩ Reopen', 'btn btn-outline']);
    return b.map(([to, label, cls]) =>
      `<button class="${cls}" style="font-size:var(--fs-micro);padding:4px 8px;" onclick="ktJobStatus('${j.id}','${to}')">${label}</button>`).join(' ');
  };
  const jobRows = d.jobs.length === 0
    ? `<tr><td colspan="6"><div class="empty-state"><div class="emoji">🎧</div><p>No conversion jobs yet — add the first drop-off above.</p></div></td></tr>`
    : d.jobs.map(j => `
      <tr>
        <td><div class="customer-name">${escName(j.customerName)}</div>
            <div style="font-size:var(--fs-micro);color:var(--muted);">${fmtDate(j.createdAt)}</div></td>
        <td>${escHtml(KT_JOB_KINDS[j.kind] || j.kind)}${j.qty > 1 ? ` <span style="color:var(--muted);">× ${j.qty}</span>` : ''}</td>
        <td style="max-width:260px;">${escHtml(j.details || '—')}</td>
        <td><strong>${fmtGbp(j.price)}</strong></td>
        <td><span class="badge" style="${KT_JOB_BADGE[j.status] || ''}">${escHtml(j.status)}</span></td>
        <td style="white-space:nowrap;">${jobBtns(j)}</td>
      </tr>`).join('');

  // ── Consignment cards ───────────────────────────────────────────────────
  const shulCards = d.shuls.filter(s => s.active).map(s => {
    const rows = d.stock.filter(r => r.shulId === s.id && r.qty > 0);
    const held = rows.reduce((n, r) => n + r.qty, 0);
    const chips = rows.length
      ? rows.map(r => {
          const t = d.titles.find(x => x.id === r.titleId);
          return `<span class="badge" style="background:var(--bg-secondary);color:var(--ink-secondary);">${r.qty} × ${escHtml(t ? t.name : '(retired)')}</span>`;
        }).join(' ')
      : '<span style="font-size:var(--fs-small);color:var(--muted);">nothing on consignment</span>';
    const editing = ktEditShuls.has(s.id);
    return `
      <div style="border:1px solid var(--border);border-radius:8px;padding:12px 14px;background:var(--bg-primary);">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <strong>${escHtml(s.name)}</strong>
          ${s.contact ? `<span style="font-size:var(--fs-small);color:var(--muted);">${escHtml(s.contact)}</span>` : ''}
          ${s.customerName ? `<span class="badge" style="background:rgba(14,138,82,0.14);color:var(--success-ink);" title="Settlements post to this wallet">👛 ${escName(s.customerName)}</span>`
            : '<span class="badge" style="background:rgba(239,68,68,0.1);color:var(--danger-ink);" title="Link a customer record so settlements hit the ledger">no wallet link</span>'}
          <span style="margin-left:auto;font-size:var(--fs-small);color:var(--muted);">${held} CD${held === 1 ? '' : 's'} out</span>
          <button class="btn btn-outline" style="font-size:var(--fs-micro);padding:4px 8px;" onclick="ktToggleShulEdit('${s.id}')">${editing ? 'Close' : '✎ Edit'}</button>
        </div>
        <div style="margin:8px 0;display:flex;flex-wrap:wrap;gap:5px;">${chips}</div>
        ${editing ? `
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:8px 0;padding:8px;border-radius:6px;background:var(--bg-secondary);">
          <input class="form-input" id="ktShulContact_${s.id}" value="${escHtml(s.contact || '')}" placeholder="Contact / gabbai" style="min-height:0;padding:6px 9px;font-size:var(--fs-small);min-width:170px;">
          <select class="form-input" id="ktShulCust_${s.id}" style="min-height:0;padding:6px 9px;font-size:var(--fs-small);max-width:220px;">
            <option value="">No wallet link</option>${s.customerId ? customerOptions.replace(`value="${escHtml(String(s.customerId))}"`, '$& selected') : customerOptions}
          </select>
          <button class="btn btn-outline btn-sm" style="font-size:var(--fs-micro);" onclick="ktSaveShul('${s.id}')">💾 Save</button>
        </div>` : ''}
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
          <select class="form-input" id="ktMoveTitle_${s.id}" aria-label="Title to move for ${escHtml(s.name)}" style="min-height:0;padding:6px 9px;font-size:var(--fs-small);max-width:230px;">${titleOptions}</select>
          <input class="form-input" id="ktMoveQty_${s.id}" type="number" min="1" step="1" value="1" aria-label="Quantity" style="width:64px;min-height:0;padding:6px 9px;font-size:var(--fs-small);">
          <button class="btn btn-outline" style="font-size:var(--fs-micro);padding:5px 9px;" onclick="ktMove('${s.id}','delivery')">📦 Deliver</button>
          <button class="btn btn-outline" style="font-size:var(--fs-micro);padding:5px 9px;" onclick="ktMove('${s.id}','sold')">💿 Sold</button>
          <button class="btn btn-outline" style="font-size:var(--fs-micro);padding:5px 9px;" onclick="ktMove('${s.id}','return')">↩ Return</button>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px;padding-top:8px;border-top:1px dashed var(--border);">
          <span style="font-size:var(--fs-small);color:var(--muted);">Settle:</span>
          <input class="form-input" id="ktSettleSold_${s.id}" type="number" min="0" step="0.01" placeholder="£ sold" style="width:88px;min-height:0;padding:6px 9px;font-size:var(--fs-small);">
          <input class="form-input" id="ktSettleRecv_${s.id}" type="number" min="0" step="0.01" placeholder="£ collected" style="width:98px;min-height:0;padding:6px 9px;font-size:var(--fs-small);">
          <select class="form-input" id="ktSettleMethod_${s.id}" aria-label="Settlement method for ${escHtml(s.name)}" style="min-height:0;padding:6px 9px;font-size:var(--fs-small);width:110px;">
            <option value="cash">💵 Cash</option><option value="bank_transfer">🏦 Transfer</option><option value="card">💳 Card</option><option value="other">Other</option>
          </select>
          <button class="btn btn-primary" style="font-size:var(--fs-micro);padding:5px 10px;" onclick="ktSettle('${s.id}')">🧾 Settle</button>
        </div>
      </div>`;
  }).join('');

  // ── Titles table ────────────────────────────────────────────────────────
  const titleRows = d.titles.map(t => `
    <tr style="${t.active ? '' : 'opacity:0.55;'}">
      <td><input class="form-input" id="ktT_code_${t.id}" value="${escHtml(t.code || '')}" style="width:74px;min-height:0;padding:5px 8px;font-size:var(--fs-small);"></td>
      <td><input class="form-input" id="ktT_name_${t.id}" value="${escHtml(t.name)}" style="min-width:170px;min-height:0;padding:5px 8px;font-size:var(--fs-small);"></td>
      <td><input class="form-input" id="ktT_speaker_${t.id}" value="${escHtml(t.speaker || '')}" style="min-width:130px;min-height:0;padding:5px 8px;font-size:var(--fs-small);"></td>
      <td><input class="form-input" id="ktT_price_${t.id}" type="number" min="0" step="0.01" value="${t.price.toFixed(2)}" style="width:84px;min-height:0;padding:5px 8px;font-size:var(--fs-small);"></td>
      <td><input type="checkbox" id="ktT_active_${t.id}" ${t.active ? 'checked' : ''} style="accent-color:var(--accent);cursor:pointer;"></td>
      <td><button class="btn btn-outline" style="font-size:var(--fs-small);padding:5px 10px;" aria-label="Save title" onclick="ktSaveTitle('${t.id}')">💾</button></td>
    </tr>`).join('');

  content.innerHTML = `
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:4px;">
      ${[
        ['💿', `${activeTitles.length}`, 'titles in the catalogue'],
        ['🏛️', `${d.shuls.filter(s => s.active).length}`, 'shuls stocked'],
        ['📦', `${outQty}`, 'CDs out on consignment'],
        ['🎧', `${openJobs.length}`, 'open jobs'],
        ['💷', fmtGbp(received30), 'collected, last 30 days'],
      ].map(([ico, big, label]) => `
        <div style="flex:1;min-width:140px;border:1px solid var(--border);border-radius:8px;padding:10px 14px;background:var(--bg-primary);">
          <div style="font-size:var(--fs-title);font-weight:800;">${ico} ${big}</div>
          <div style="font-size:var(--fs-micro);color:var(--muted);">${label}</div>
        </div>`).join('')}
    </div>

    ${ktSectionHead('Conversion jobs', 'CD → MP3 / SD and audio work — drop-off to collection')}
    ${'' /* The new-job form used to live inside the table's first row, which on
          a phone meant composing a job by scrolling sideways through cells.
          Same panel pattern as "Add a shul": the controls wrap instead. Ids
          unchanged — ktAddJob() reads the same fields. */}
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px;padding:10px 12px;border:1px dashed var(--border);border-radius:8px;">
      <span style="font-size:var(--fs-small);font-weight:700;color:var(--accent);">➕ New job</span>
      <select class="form-input" id="ktJobCust" style="min-height:0;padding:6px 9px;font-size:var(--fs-small);min-width:150px;max-width:180px;">
        <option value="walkin">🚶 Walk-in</option>${customerOptions}</select>
      <input class="form-input" id="ktJobName" placeholder="Name if walk-in" style="min-height:0;padding:6px 9px;font-size:var(--fs-small);min-width:140px;max-width:180px;">
      <select class="form-input" id="ktJobKind" style="min-height:0;padding:6px 9px;font-size:var(--fs-small);min-width:132px;">
        ${Object.entries(KT_JOB_KINDS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
      <input class="form-input" id="ktJobQty" type="number" min="1" step="1" value="1" aria-label="Quantity" style="width:64px;min-height:0;padding:6px 9px;font-size:var(--fs-small);">
      <input class="form-input" id="ktJobDetails" placeholder="e.g. 3 CDs of R' Shloime onto one SD" style="flex:1;min-width:180px;min-height:0;padding:6px 9px;font-size:var(--fs-small);">
      <input class="form-input" id="ktJobPrice" type="number" min="0" step="0.01" placeholder="£" style="width:80px;min-height:0;padding:6px 9px;font-size:var(--fs-small);">
      <button class="btn btn-primary btn-sm" onclick="ktAddJob()">+ Add job</button>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Customer</th><th>Job</th><th>Details</th><th>£</th><th>Status</th><th></th></tr></thead>
      <tbody>
        ${jobRows}
      </tbody></table></div>

    ${ktSectionHead('Consignment by shul', 'deliver / sold / return moves the count; Settle records the money')}
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(340px,100%),1fr));gap:10px;">
      ${shulCards || '<div class="empty-state" style="grid-column:1/-1;"><div class="emoji">🏛️</div><p>No shuls yet — add the first one below.</p></div>'}
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px;padding:10px 12px;border:1px dashed var(--border);border-radius:8px;">
      <span style="font-size:var(--fs-small);font-weight:700;color:var(--accent);">➕ Add a shul</span>
      <input class="form-input" id="ktNewShulName" placeholder="Shul name" style="min-height:0;padding:6px 9px;font-size:var(--fs-small);min-width:170px;">
      <input class="form-input" id="ktNewShulContact" placeholder="Contact / gabbai (optional)" style="min-height:0;padding:6px 9px;font-size:var(--fs-small);min-width:170px;">
      <select class="form-input" id="ktNewShulCust" style="min-height:0;padding:6px 9px;font-size:var(--fs-small);max-width:210px;" title="Link a customer record so settlements hit the ledger">
        <option value="">No wallet link yet</option>${customerOptions}
      </select>
      <button class="btn btn-outline btn-sm" onclick="ktSaveShul()">+ Add shul</button>
    </div>

    ${ktSectionHead('Titles catalogue', 'code · title · speaker · price — retire with the tick')}
    <div class="table-wrap"><table>
      <thead><tr><th>Code</th><th>Title</th><th>Speaker</th><th>£</th><th>Active</th><th></th></tr></thead>
      <tbody>
        ${titleRows}
      </tbody></table></div>
    ${'' /* Same move as the new-job form: composing in table cells means
          sideways scrolling on a phone. Ids unchanged — ktSaveTitle() reads
          the same fields. */}
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px;padding:10px 12px;border:1px dashed var(--border);border-radius:8px;">
      <span style="font-size:var(--fs-small);font-weight:700;color:var(--accent);">➕ Add a title</span>
      <input class="form-input" id="ktNewT_code" placeholder="KT-…" style="width:74px;min-height:0;padding:5px 8px;font-size:var(--fs-small);">
      <input class="form-input" id="ktNewT_name" placeholder="Title" style="flex:1;min-width:150px;min-height:0;padding:5px 8px;font-size:var(--fs-small);">
      <input class="form-input" id="ktNewT_speaker" placeholder="Speaker" style="min-width:130px;min-height:0;padding:5px 8px;font-size:var(--fs-small);">
      <input class="form-input" id="ktNewT_price" type="number" min="0" step="0.01" placeholder="£" style="width:84px;min-height:0;padding:5px 8px;font-size:var(--fs-small);">
      <button class="btn btn-primary btn-sm" onclick="ktSaveTitle()">+ Add</button>
    </div>

    ${ktSectionHead('Takings — recent settlements', 'what each shul sold and what was collected')}
    <div class="table-wrap"><table>
      <thead><tr><th>Date</th><th>Shul</th><th>£ sold</th><th>£ collected</th><th>Method</th><th>Note</th></tr></thead>
      <tbody>${d.settlements.length === 0
        ? '<tr><td colspan="6"><div class="empty-state"><div class="emoji">🧾</div><p>No settlements recorded yet.</p></div></td></tr>'
        : d.settlements.map(x => `
          <tr>
            <td class="kc-date">${fmtDate(x.createdAt)}</td>
            <td>${escHtml(x.shulName)}</td>
            <td>${fmtGbp(x.soldValue)}</td>
            <td><strong>${fmtGbp(x.received)}</strong></td>
            <td>${escHtml(x.method || '—')}</td>
            <td style="max-width:240px;font-size:var(--fs-small);color:var(--muted);">${escHtml(x.note || '')}</td>
          </tr>`).join('')}</tbody></table></div>`;
}

function ktFocusNewJob() {
  const el = document.getElementById('ktJobCust');
  if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); }
}

function ktToggleShulEdit(id) {
  if (ktEditShuls.has(id)) ktEditShuls.delete(id); else ktEditShuls.add(id);
  // The current wallet link is preselected IN the option markup: the old
  // post-render sel.value assignment was lost on any intervening re-render,
  // and saving with the picker silently back on "No wallet link" unlinked
  // the shul's wallet (sweep 2026-08-02 #20).
  renderKolTorahTab();
}

async function ktPost(body) {
  return kcFetch('/api/kol-torah', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json()).catch(() => null);
}

async function ktSaveTitle(id) {
  const v = (f) => document.getElementById(id ? `ktT_${f}_${id}` : `ktNewT_${f}`)?.value;
  const name = (v('name') || '').trim();
  if (!name) { toast('The title needs a name.', 'error'); return; }
  if (!kcBeginWrite('kt')) return;
  let res;
  try {
    res = await ktPost({
      op: 'title-save', id: id || undefined, code: v('code'), name, speaker: v('speaker'),
      price: parseFloat(v('price')) || 0,
      active: id ? !!document.getElementById(`ktT_active_${id}`)?.checked : true,
    });
  } finally { kcEndWrite('kt'); }
  if (!res || !res.success) { toast(res?.error || 'Could not save the title.', 'error'); return; }
  toast(id ? 'Title saved.' : 'Title added.', 'success');
  renderKolTorahTab();
}

async function ktSaveShul(id) {
  const name = id
    ? ktData?.shuls.find(s => s.id === id)?.name
    : (document.getElementById('ktNewShulName')?.value || '').trim();
  if (!name) { toast('The shul needs a name.', 'error'); return; }
  const contact = document.getElementById(id ? `ktShulContact_${id}` : 'ktNewShulContact')?.value;
  const customerId = document.getElementById(id ? `ktShulCust_${id}` : 'ktNewShulCust')?.value || null;
  if (!kcBeginWrite('kt')) return;
  let res;
  try {
    res = await ktPost({ op: 'shul-save', id: id || undefined, name, contact, customerId });
  } finally { kcEndWrite('kt'); }
  if (!res || !res.success) { toast(res?.error || 'Could not save the shul.', 'error'); return; }
  ktEditShuls.delete(id);
  toast(id ? 'Shul saved.' : 'Shul added.', 'success');
  renderKolTorahTab();
}

async function ktMove(shulId, kind) {
  const titleId = document.getElementById(`ktMoveTitle_${shulId}`)?.value;
  const qty = parseInt(document.getElementById(`ktMoveQty_${shulId}`)?.value, 10);
  if (!titleId) { toast('Add a title to the catalogue first.', 'error'); return; }
  if (!Number.isFinite(qty) || qty < 1) { toast('Quantity must be at least 1.', 'error'); return; }
  if (!kcBeginWrite('kt')) return;
  // Same-token retry per exact movement: a lost response replays the SAME
  // token and the server short-circuits, so "Deliver 10" can't land twice.
  // Changing any part of the movement (qty, title, kind) mints a fresh token.
  const fp = `${shulId}|${titleId}|${kind}|${qty}`;
  if (!ktMoveRefs[fp]) ktMoveRefs[fp] = kcRef();
  let res;
  try {
    res = await ktPost({ op: 'move', shulId, titleId, kind, qty, clientRef: ktMoveRefs[fp] });
  } finally { kcEndWrite('kt'); }
  if (!res || !res.success) { toast(res?.error || 'Could not record the movement.', 'error'); return; }
  delete ktMoveRefs[fp];
  if (res.duplicate) { toast('Movement already recorded — no double count.', 'info'); renderKolTorahTab(); return; }
  const verb = { delivery: 'Delivered', sold: 'Marked sold', return: 'Returned' }[kind] || 'Adjusted';
  toast(`${verb} ${qty} — ${res.qty} now at the shul.`, 'success');
  renderKolTorahTab();
}

async function ktSettle(shulId) {
  const shul = ktData?.shuls.find(s => s.id === shulId);
  const sold = parseFloat(document.getElementById(`ktSettleSold_${shulId}`)?.value) || 0;
  const received = parseFloat(document.getElementById(`ktSettleRecv_${shulId}`)?.value) || 0;
  const method = document.getElementById(`ktSettleMethod_${shulId}`)?.value || 'cash';
  if (sold <= 0 && received <= 0) { toast('Enter the £ sold and/or the £ collected.', 'error'); return; }
  if (!(await kcConfirm({
    title: 'Confirm settlement',
    body: `<strong>${escHtml(shul?.name || 'Shul')}</strong><br>
      CDs sold: ${fmtGbp(sold)} · collected now: ${fmtGbp(received)}
      ${shul?.customerName ? '<br>Posts to the linked wallet.' : '<br><em>No wallet link — recorded in Kol Torah only.</em>'}`,
    amount: received,
    okLabel: 'Record settlement',
  }))) return;
  if (!kcBeginWrite('kt')) return;
  // Same-token retry: a lost response replays the SAME settlement, the server
  // dedupes, and the shul is never settled twice.
  if (!ktSettleRefs[shulId]) ktSettleRefs[shulId] = kcRef();
  let res;
  try {
    res = await ktPost({ op: 'settle', shulId, soldValue: sold, received, method, clientRef: ktSettleRefs[shulId] });
  } finally { kcEndWrite('kt'); }
  if (!res || !res.success) { toast(res?.error || 'Could not record the settlement.', 'error'); return; }
  delete ktSettleRefs[shulId];
  toast(res.duplicate ? 'Settlement already recorded — no double post.' : 'Settlement recorded.', 'success');
  renderKolTorahTab();
}

async function ktAddJob() {
  const custId = document.getElementById('ktJobCust')?.value || 'walkin';
  const customerName = (document.getElementById('ktJobName')?.value || '').trim();
  if (custId === 'walkin' && !customerName) { toast('Pick a customer or type a name.', 'error'); return; }
  const kind = document.getElementById('ktJobKind')?.value;
  const qty = parseInt(document.getElementById('ktJobQty')?.value, 10) || 1;
  const details = document.getElementById('ktJobDetails')?.value;
  const price = parseFloat(document.getElementById('ktJobPrice')?.value) || 0;
  if (!kcBeginWrite('kt')) return;
  if (!ktJobRef) ktJobRef = kcRef();
  let res;
  try {
    res = await ktPost({
      op: 'job-save', customerId: custId === 'walkin' ? null : custId,
      customerName, kind, qty, details, price, clientRef: ktJobRef,
    });
  } finally { kcEndWrite('kt'); }
  if (!res || !res.success) { toast(res?.error || 'Could not save the job.', 'error'); return; }
  ktJobRef = null;
  toast(res.duplicate ? 'Job already saved — no double entry.' : 'Job added.', 'success');
  renderKolTorahTab();
}

async function ktJobStatus(id, to) {
  const job = ktData?.jobs.find(j => j.id === id);
  // Never act on a job we can't show: the collect confirm displays the amount,
  // and skipping it on stale data would charge without a confirmation.
  if (!job) { toast('That job needs a refresh — try again.', 'warning'); renderKolTorahTab(); return; }
  if (to === 'cancelled' && !(await kcConfirm({
    title: 'Cancel this job?',
    body: `<strong>${escHtml(job?.customerName || '')}</strong> — ${escHtml(KT_JOB_KINDS[job?.kind] || '')}.<br>Nothing has been charged; the job is just closed.`,
    okLabel: 'Cancel job',
  }))) return;
  if (to === 'collected' && job && job.price > 0 && !(await kcConfirm({
    title: 'Confirm collection',
    body: `<strong>${escName(job.customerName)}</strong> — ${escHtml(KT_JOB_KINDS[job.kind] || '')}${job.qty > 1 ? ` × ${job.qty}` : ''}.<br>${job.customerId ? 'Charges their wallet on collection.' : '<em>Walk-in — take the money at the till.</em>'}`,
    amount: job.price,
    okLabel: 'Mark collected',
  }))) return;
  if (!kcBeginWrite('kt')) return;
  let res;
  try {
    res = await ktPost({ op: 'job-status', id, status: to });
  } finally { kcEndWrite('kt'); }
  if (!res || !res.success) { toast(res?.error || 'Could not update the job.', 'error'); return; }
  toast('Job updated.', 'success');
  renderKolTorahTab();
}

// ─────────────────────────────────────────────
//  TASKS
// ─────────────────────────────────────────────
// Tables-native to-do list. Also displays the keyed auto-tasks the system
// raises (BALANCE-<id> arrears, passport expiry, overdue rentals).

let tasksList = [];

function taskPriorityBadge(p) {
  const styles = {
    High:   'background:rgba(239,68,68,0.15);color:var(--danger-ink);',
    Normal: 'background:rgba(0,96,168,0.10);color:var(--accent);',
    Low:    'background:rgba(148,163,184,0.15);color:var(--muted);',
  };
  return `<span class="badge" style="${styles[p] || styles.Normal}">${escHtml(p)}</span>`;
}

// ── Remind-me everywhere (the Slack pattern) ─────────────────────────────
// A ⏰ on any row creates a task that sleeps (snoozed) until its date, then
// surfaces in the Now lane pointing back at the thing.

function remindContextFor(kind, id) {
  switch (kind) {
    case 'customer': { const c = customers.find(x => x.id === id);
      return c && { label: `Follow up with ${c.firstName} ${c.lastName}`, customerId: c.id }; }
    case 'rental': { const r = rentals.find(x => x.id === id);
      return r && { label: `Check rental — ${r.customerName} (${r.phoneNumber})`, customerId: r.customerId }; }
    case 'booking': { const b = bookings.find(x => x.id === id);
      return b && { label: `Booking ${b.route} — ${b.customerName || b.passenger || ''}`.trim(), customerId: b.customerId }; }
    case 'repair': { const r = repairs.find(x => x.id === id);
      return r && { label: `Repair — ${r.customerName} (${r.device || 'device'})`, customerId: r.customerId }; }
    case 'sim': { const s = sims.find(x => x.id === id);
      return s && { label: `SIM — ${s.customerName} (${s.provider || 'plan'})`, customerId: s.customerId }; }
    case 'vn': { const v = virtualNumbers.find(x => x.id === id);
      return v && { label: `Virtual number ${v.number}${v.customerName ? ' — ' + v.customerName : ''}`, customerId: v.customerId }; }
    case 'note': // free-standing reminder not tied to a record
      return { label: 'Reminder', customerId: null };
  }
  return null;
}

// Same-day reminders: fire as an in-app popup (toast + browser notification)
// while the app is open; a matching task due today is the safety net.
function localReminders() {
  try { return JSON.parse(localStorage.getItem('kcLocalReminders') || '[]'); } catch { return []; }
}

async function saveQuickReminder(kind, id, minutes) {
  const ctx = remindContextFor(kind, id);
  if (!ctx) return;
  const list = localReminders();
  list.push({ at: Date.now() + minutes * 60000, label: ctx.label });
  localStorage.setItem('kcLocalReminders', JSON.stringify(list));
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  // Safety net if the tab closes: a task in today's Now lane.
  await window.api.addTask({
    title: `⏰ ${ctx.label}`,
    dueDate: localISO(),
    priority: 'High',
    notes: `quick reminder — ${minutes} min, set ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
    customerId: ctx.customerId || null,
  }).catch(() => null);
  closeDynamicModal();
  toast(`⏰ Will pop up in ${minutes >= 60 ? (minutes / 60) + ' hour' + (minutes > 60 ? 's' : '') : minutes + ' minutes'}.`, 'success');
}

function checkLocalReminders() {
  const list = localReminders();
  const due = list.filter(r => r.at <= Date.now());
  if (!due.length) return;
  localStorage.setItem('kcLocalReminders', JSON.stringify(list.filter(r => r.at > Date.now())));
  for (const r of due) {
    toast(`⏰ REMINDER: ${r.label}`, 'warning');
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Kosher Connect — reminder', { body: r.label, icon: '/logo.png' });
    }
  }
}

function openRemindModal(kind, id) {
  const ctx = remindContextFor(kind, id);
  if (!ctx) return;
  const tomorrow = parseLocalDate(localISO());
  tomorrow.setDate(tomorrow.getDate() + 1);
  showDynamicModal(`
    <div class="modal-title">⏰ Remind me</div>
    <div style="font-size:var(--fs-body);color:var(--muted);margin-bottom:14px;">${escHtml(ctx.label)}</div>
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:14px;flex-wrap:wrap;">
      <span style="font-size:var(--fs-small);color:var(--muted);">Quick (pops up in-app):</span>
      <button type="button" class="btn btn-outline btn-sm" onclick="saveQuickReminder('${escHtml(kind)}','${escHtml(String(id))}',30)">30 min</button>
      <button type="button" class="btn btn-outline btn-sm" onclick="saveQuickReminder('${escHtml(kind)}','${escHtml(String(id))}',60)">1 hour</button>
      <button type="button" class="btn btn-outline btn-sm" onclick="saveQuickReminder('${escHtml(kind)}','${escHtml(String(id))}',180)">3 hours</button>
    </div>
    <div class="section-divider" style="margin:0 0 10px;">or at a date &amp; time</div>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Date</label>
        <input class="form-input" type="date" id="rmDate" value="${localISO(tomorrow)}">
      </div>
      <div class="form-group">
        <label class="form-label">Time <span style="color:var(--muted);font-weight:400;">(optional — pops up at this exact time)</span></label>
        <input class="form-input" type="time" id="rmTime">
      </div>
      <div class="form-group">
        <label class="form-label">Priority</label>
        <select class="form-input" id="rmPriority">
          <option value="Normal">📋 Next</option>
          <option value="High">🔥 Now</option>
          <option value="Low">🌙 Later</option>
        </select>
      </div>
      <div class="form-group form-full">
        <label class="form-label">Note (optional)</label>
        <input class="form-input" id="rmNote" placeholder="What should you remember?">
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeDynamicModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveReminder('${escHtml(kind)}','${escHtml(String(id))}')">⏰ Set reminder</button>
    </div>
  `);
}

async function saveReminder(kind, id) {
  const ctx = remindContextFor(kind, id);
  if (!ctx) return;
  const date = document.getElementById('rmDate').value;
  if (!date) { toast('Pick a date.', 'error'); return; }
  const time = document.getElementById('rmTime').value; // HH:MM or ''
  const note = document.getElementById('rmNote').value.trim();
  // A free-standing 'note' reminder uses the note itself as its label.
  if (kind === 'note' && !note) { toast('Type what to remind you about.', 'error'); return; }
  const baseLabel = (kind === 'note') ? note : ctx.label;

  // With a time, schedule an exact-moment popup (fires while the app is
  // open) on top of the backup task; without one it's a plain day reminder.
  if (time) {
    const [hh, mm] = time.split(':').map(Number);
    const target = parseLocalDate(date);
    target.setHours(hh || 0, mm || 0, 0, 0);
    if (target.getTime() <= Date.now()) { toast('That time is in the past.', 'error'); return; }
    const list = localReminders();
    list.push({ at: target.getTime(), label: (kind !== 'note' && note) ? `${baseLabel} — ${note}` : baseLabel });
    localStorage.setItem('kcLocalReminders', JSON.stringify(list));
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  }

  const res = await window.api.addTask({
    title: `⏰ ${baseLabel}${time ? ' @ ' + time : ''}`,
    dueDate: date,
    priority: document.getElementById('rmPriority').value,
    notes: note,
    customerId: ctx.customerId || null,
    snoozedUntil: date, // sleeps until its day, then lands in the Now lane
  });
  if (!res.success) { toast(res.error || 'Could not set the reminder.', 'error'); return; }
  closeDynamicModal();
  toast(time ? `⏰ Will pop up ${fmtDate(date)} at ${time}.` : `Reminder set for ${fmtDate(date)}.`, 'success');
}

// ── Business summary (revenue by service type) ───────────────────────────
// Ledger entry_types collapsed into the services the owner thinks in.
const REVENUE_CATS = {
  rental: '📱 Rentals', rental_loss: '📱 Rentals',
  sim_charge: '📶 SIM', sim_annual: '📶 SIM', sim_additional: '📶 SIM',
  sim_replacement: '📶 SIM', sim_service: '📶 SIM',
  repair: '🔧 Repairs',
  booking: '✈️ Flights & tickets',
  online_service: '🖨️ Print / online',
  phone_sale: '🛒 Shop', stock_sale: '🛒 Shop',
  virtual_number: '🔢 Virtual numbers',
  extra_charge: '➕ Extra charges',
};
function groupRevenue(byType) {
  const groups = {};
  for (const [type, amt] of Object.entries(byType || {})) {
    const label = REVENUE_CATS[type] || '• Other';
    groups[label] = (groups[label] || 0) + amt;
  }
  return Object.entries(groups).sort((a, b) => b[1] - a[1]);
}
async function openBusinessSummary() {
  const now = new Date();
  const weekFrom = localISO(new Date(Date.now() - 6 * 86400000));
  const monthFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  showDynamicModal(`
    <div class="modal-title">📊 Business summary</div>
    <div id="bizSummaryBody" style="color:var(--muted);padding:20px 4px;">Loading…</div>
    <div class="modal-actions"><button class="btn btn-outline" onclick="closeDynamicModal()">Close</button></div>`);
  const [wk, mo] = await Promise.all([
    kcFetch('/api/ledger?report=1&from=' + weekFrom).then(r => r.json()).catch(() => null),
    kcFetch('/api/ledger?report=1&from=' + monthFrom).then(r => r.json()).catch(() => null),
  ]);
  const body = document.getElementById('bizSummaryBody');
  if (!body) return;
  if (!wk?.success || !mo?.success) {
    body.innerHTML = `<div style="color:var(--danger-ink);padding:6px 0;">${(wk && wk.error) || (mo && mo.error) || 'Could not load the summary.'}</div>`;
    return;
  }
  // Revenue by service is a magnitude-by-category read → horizontal bars in a
  // single hue (values labelled directly, so identity is never colour-alone),
  // plus a collection-rate bar. Soft top-light gradients give a light 3D feel.
  const col = (title, rep) => {
    const rows = groupRevenue(rep.byType);
    const max = Math.max(1, ...rows.map(([, a]) => a));
    const bars = rows.length ? rows.map(([label, amt]) => `
      <div class="bizbar-row">
        <span class="bizbar-label" title="${label}">${label}</span>
        <div class="bizbar-track"><div class="bizbar-fill" style="width:${Math.max(3, (amt / max) * 100).toFixed(1)}%;"></div></div>
        <span class="bizbar-val">${fmtGbp(amt)}</span>
      </div>`).join('')
      : '<div style="color:var(--muted);font-size:var(--fs-body);padding:6px 0;">No charges yet.</div>';
    const rate = rep.charged > 0 ? Math.min(100, Math.round((rep.received / rep.charged) * 100)) : 0;
    return `<div class="bizcol">
      <div class="bizcol-title">${title}</div>
      <div class="bizbars">${bars}</div>
      <div class="bizcol-tot">
        <div class="bizbar-row">
          <span class="bizbar-label" style="font-weight:700;color:var(--text);">Billed</span>
          <div class="bizbar-track"><div class="bizbar-fill" style="width:100%;opacity:0.3;"></div></div>
          <span class="bizbar-val">${fmtGbp(rep.charged)}</span>
        </div>
        <div class="bizbar-row">
          <span class="bizbar-label" style="color:var(--success);">Received</span>
          <div class="bizbar-track"><div class="bizbar-fill received" style="width:${rate}%;"></div></div>
          <span class="bizbar-val">${fmtGbp(rep.received)} <span style="color:var(--muted);font-weight:400;">· ${rate}%</span></span>
        </div>
        ${rep.refunded ? `<div style="display:flex;justify-content:space-between;font-size:var(--fs-small);color:var(--muted);padding-top:4px;"><span>Refunded</span><span>−${fmtGbp(rep.refunded)}</span></div>` : ''}
      </div>
    </div>`;
  };
  body.style.color = 'var(--text)';
  body.style.padding = '0';
  body.innerHTML = `
    <div style="display:flex;gap:28px;flex-wrap:wrap;">${col('This week (7 days)', wk)}${col('This month', mo)}</div>
    <div style="font-size:var(--fs-micro);color:var(--muted);margin-top:14px;">Bars show revenue by service. “Billed” is revenue charged; “Received” is money actually taken in (payments + top-ups); the green bar is the collection rate.</div>`;
}

// ── Command palette (Ctrl/Cmd+K) ─────────────────────────────────────────
// One box that finds anything: customers, phones (by number / IMEI / ICCID —
// the barcode scanner types straight into it), rentals, bookings, and quick
// commands. Keyboard: ↑↓ + Enter, Esc closes.

let paletteIndex = 0;
let paletteResults = [];

// A tab-scoped create: navigate to the tab first, then open its modal, so the
// view underneath (and any post-save re-render) matches the record type — the
// same pattern the "New Customer" command has always used.
const openOnTab = (tab, fn) => { goToTab(tab); setTimeout(() => fn(), 130); };

// Apply a saved-filter view, then jump to its tab. Filters persist exactly
// like the on-page dropdowns — the tab's own "Clear" button resets them.
const filterView = (tab, apply, reRender) => { apply(); goToTab(tab); if (reRender) setTimeout(reRender, 60); };

// ── In-house AI assistant — "Ask / do anything" ──
// Gemini (server) turns plain language into ONE structured action; the client
// answers reads from data it already holds, and shows a confirm card for any
// write before running it through the app's existing flow. Money actions are
// owner-only. Gemini proposes; only a human tap makes anything happen.
let assistantBusy = false;
let assistantPending = null;

function openAssistantModal(prefill) {
  showDynamicModal(`
    <div class="modal-title">🤖 Ask Kosher Connect</div>
    <div style="font-size:var(--fs-small);color:var(--muted);margin-bottom:10px;">Ask a question or say what you want to do — e.g. “who owes money?”, “overdue rentals”, “what's Abraham Diamant's balance?”, “draft a reminder for Yoel Kahana”, “create a £50 payment link for Shloime Grinfeld”, “add a task to order chargers”. Anything that makes a change is shown for you to confirm first.</div>
    <div style="display:flex;gap:8px;align-items:flex-end;">
      <input class="form-input" id="askInput" placeholder="Type here…" style="flex:1;" onkeydown="if(event.key==='Enter')runAssistant()">
      <button class="btn btn-primary" id="askGo" onclick="runAssistant()">Ask</button>
    </div>
    <div id="askOut" style="margin-top:14px;"></div>
    <div class="modal-actions"><button class="btn btn-outline" onclick="closeDynamicModal()">Close</button></div>
  `);
  setTimeout(() => { const i = document.getElementById('askInput'); if (i) { if (prefill) i.value = prefill; i.focus(); if (prefill) runAssistant(); } }, 40);
}
async function runAssistant() {
  if (assistantBusy) return;
  const input = document.getElementById('askInput');
  const msg = input && input.value.trim();
  const out = document.getElementById('askOut');
  if (!msg) return;
  assistantBusy = true; assistantPending = null;
  const btn = document.getElementById('askGo'); if (btn) { btn.disabled = true; btn.textContent = '…'; }
  if (out) out.innerHTML = '<div style="color:var(--muted);font-size:var(--fs-body);">Thinking…</div>';
  try {
    const r = await kcFetch('/api/assistant/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.success) { if (out) out.innerHTML = `<div style="color:var(--danger-ink);font-size:var(--fs-body);">${escHtml(j.error || 'Could not understand that.')}</div>`; return; }
    await dispatchAssistant(j.plan, out);
  } catch { if (out) out.innerHTML = '<div style="color:var(--danger-ink);font-size:var(--fs-body);">Could not reach the assistant.</div>'; }
  finally { assistantBusy = false; if (btn) { btn.disabled = false; btn.textContent = 'Ask'; } }
}
async function dispatchAssistant(plan, out) {
  if (!out) return;
  if (!plan) { out.textContent = 'No answer.'; return; }
  const reply = plan.reply ? `<div style="font-size:var(--fs-body);margin-bottom:10px;">${escHtml(plan.reply)}</div>` : '';
  const a = plan.action || 'none';
  if (a === 'who_owes') { out.innerHTML = reply + await assistantWhoOwes(); return; }
  if (a === 'customer_info') { out.innerHTML = reply + await assistantCustomerInfo(plan.args && plan.args.name); return; }
  if (a === 'overdue_rentals') { out.innerHTML = reply + assistantOverdue(); return; }
  // There is no 'cashup' TAB — it's a modal. goToTab() clicked a nav item that
  // doesn't exist and optional chaining swallowed the miss, so the announced
  // action did nothing, every time.
  if (a === 'todays_takings') { out.innerHTML = reply + '<div style="font-size:var(--fs-body);">Opening the cash-up screen…</div>'; setTimeout(() => { closeDynamicModal(); openCashupModal(); }, 700); return; }
  if (['draft_reminder', 'create_payment_link', 'add_task', 'mark_task_done'].includes(a)) { out.innerHTML = reply + await assistantConfirmCard(plan); return; }
  out.innerHTML = reply || '<div style="font-size:var(--fs-body);color:var(--muted);">I can help with balances, who owes, overdue rentals, reminders, payment links and tasks.</div>';
}
function assistantNameOf(id) { const c = customers.find(x => String(x.id) === String(id)); return c ? `${c.firstName || ''} ${c.lastName || ''}`.trim() : ('#' + id); }
async function assistantWhoOwes() {
  try {
    const r = await kcFetch('/api/ledger');
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.success) return '<div style="color:var(--danger-ink);font-size:var(--fs-body);">Could not load balances.</div>';
    const owers = (j.arrears || []).slice().sort((a, b) => Math.abs(Number(b.balance)) - Math.abs(Number(a.balance)));
    if (!owers.length) return '<div style="color:var(--success);font-size:var(--fs-body);">Nobody is in debt right now. 🎉</div>';
    const total = owers.reduce((s, b) => s + Math.abs(Number(b.balance) || 0), 0);
    const rows = owers.slice(0, 40).map((b) =>
      `<div style="display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);font-size:var(--fs-body);">
        <button style="background:none;border:0;color:var(--accent);cursor:pointer;padding:0;text-align:start;" onclick="openCustomerById('${escHtml(String(b.customerId))}')">${escHtml(assistantNameOf(b.customerId))}</button>
        <span style="color:var(--danger-ink);font-weight:600;">${fmtGbp(Math.abs(Number(b.balance)))}</span>
      </div>`).join('');
    return `<div style="font-size:var(--fs-small);color:var(--muted);margin-bottom:6px;">${owers.length} owing · ${fmtGbp(total)} total</div><div style="max-height:280px;overflow:auto;">${rows}</div>`;
  } catch { return '<div style="color:var(--danger-ink);font-size:var(--fs-body);">Could not load balances.</div>'; }
}
async function assistantCustomerInfo(name) {
  const res = assistantResolve(name);
  if (res.none) return `<div style="color:var(--muted);font-size:var(--fs-body);">I couldn’t find a customer called “${escHtml(name || '')}”.</div>`;
  if (res.choices) return `<div style="font-size:var(--fs-body);margin-bottom:6px;">A few match — open one:</div>${assistantChooserHtml(res.choices)}`;
  const c = res.customer;
  let bal = null;
  if (customerLedgerBal && customerLedgerBal.has(String(c.id))) bal = customerLedgerBal.get(String(c.id));
  else { try { const r = await kcFetch('/api/ledger'); const j = await r.json().catch(() => ({})); if (j && j.success) { const hit = [...(j.arrears || []), ...(j.credits || [])].find((b) => String(b.customerId) === String(c.id)); if (hit) bal = Number(hit.balance); } } catch {} }
  const owes = bal != null && bal < 0;
  const balHtml = bal == null ? '<span style="color:var(--muted);">settled / no balance on file</span>'
    : `<span style="color:${owes ? 'var(--danger-ink)' : 'var(--success)'};font-weight:700;">${owes ? fmtGbp(Math.abs(bal)) + ' owed' : (bal > 0 ? fmtGbp(bal) + ' in credit' : 'settled')}</span>`;
  return `<div style="border:1px solid var(--border);border-radius:10px;padding:12px 14px;font-size:var(--fs-body);">
    <div style="font-weight:600;margin-bottom:4px;">${escHtml(`${c.firstName || ''} ${c.lastName || ''}`.trim())}</div>
    <div style="margin-bottom:8px;">${balHtml}</div>
    <button class="btn btn-outline btn-sm" onclick="openCustomerById('${escHtml(String(c.id))}')">Open customer</button>
  </div>`;
}
function assistantOverdue() {
  const od = rentals.filter((r) => r.status === 'overdue');
  if (!od.length) return '<div style="color:var(--success);font-size:var(--fs-body);">No overdue rentals. 🎉</div>';
  const rows = od.map((r) =>
    `<div style="display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);font-size:var(--fs-body);">
      <button style="background:none;border:0;color:var(--accent);cursor:pointer;padding:0;text-align:start;" onclick="openCustomerById('${escHtml(String(r.customerId))}')">${escHtml(assistantNameOf(r.customerId))}</button>
      <span style="color:var(--muted);">${r.phoneNumber ? escHtml(r.phoneNumber) + ' · ' : ''}due ${r.toDate ? fmtDate(r.toDate) : '—'}</span>
    </div>`).join('');
  return `<div style="font-size:var(--fs-small);color:var(--muted);margin-bottom:6px;">${od.length} overdue</div><div style="max-height:280px;overflow:auto;">${rows}</div>`;
}
function assistantResolve(name) {
  const q = String(name || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  if (!q) return { none: true };
  const scored = customers.map((c) => {
    const full = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    let score = 0;
    if (full === q) score = 100;
    else if (full.startsWith(q) || q.startsWith(full)) score = 70;
    else if (full.includes(q) || q.split(' ').every((w) => w && full.includes(w))) score = 50;
    return { c, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  if (!scored.length) return { none: true };
  const top = scored[0];
  const ties = scored.filter((x) => x.score === top.score);
  if (top.score === 100 || ties.length === 1) return { customer: top.c };
  if (ties.length > 6) return { customer: top.c };
  return { choices: ties.map((x) => x.c) };
}
function assistantChooserHtml(choices) {
  return choices.map((c) => `<button style="display:block;width:100%;text-align:start;background:none;border:1px solid var(--border);border-radius:8px;padding:6px 10px;margin-bottom:4px;color:var(--accent);cursor:pointer;" onclick="openCustomerById('${escHtml(String(c.id))}')">${escHtml(`${c.firstName || ''} ${c.lastName || ''}`.trim())}</button>`).join('');
}
async function assistantConfirmCard(plan) {
  const built = await assistantBuildAction(plan);
  if (built.error) return `<div style="color:var(--danger-ink);font-size:var(--fs-body);">${built.error}</div>`;
  if (built.choicesHtml) return built.choicesHtml;
  assistantPending = built;
  return `<div style="border:1px solid var(--border);border-radius:10px;padding:12px 14px;">
    <div style="font-size:var(--fs-body);margin-bottom:10px;">${built.summary}</div>
    <div style="display:flex;gap:8px;">
      <button class="btn btn-primary btn-sm" onclick="assistantConfirm()">✓ Do it</button>
      <button class="btn btn-outline btn-sm" onclick="assistantPending=null;var o=document.getElementById('askOut');if(o)o.innerHTML='';">Cancel</button>
    </div>
  </div>`;
}
function assistantConfirm() {
  const p = assistantPending; assistantPending = null;
  if (p && typeof p.run === 'function') p.run();
}
async function assistantBuildAction(plan) {
  const a = plan.action; const args = plan.args || {};
  const needsCust = (a === 'draft_reminder' || a === 'create_payment_link' || (a === 'add_task' && args.name));
  let cust = null;
  if (needsCust) {
    const res = assistantResolve(args.name);
    if (res.none) return { error: `I couldn’t find a customer called “${escHtml(args.name || '')}”.` };
    if (res.choices) return { choicesHtml: `<div style="font-size:var(--fs-body);margin-bottom:6px;">Several match “${escHtml(args.name)}” — say the surname too, or open one:</div>${assistantChooserHtml(res.choices)}` };
    cust = res.customer;
  }
  const cn = cust ? `${cust.firstName || ''} ${cust.lastName || ''}`.trim() : '';
  if (a === 'draft_reminder') {
    return { summary: `Open a <strong>reminder draft</strong> for <strong>${escHtml(cn)}</strong>${args.note ? ` about “${escHtml(String(args.note))}”` : ''}. Nothing is sent.`,
      run: () => { closeDynamicModal(); openDraftReminderModal(cust.id); } };
  }
  if (a === 'create_payment_link') {
    if (currentStaff && currentStaff.role !== 'owner') return { error: 'Only the owner can create payment links.' };
    const amt = Number(args.amount);
    const hasAmt = Number.isFinite(amt) && amt > 0;
    return { summary: `Create a <strong>Stripe payment link</strong> for <strong>${escHtml(cn)}</strong>${hasAmt ? ` for <strong>${fmtGbp(amt)}</strong>` : ''}${args.description ? ` (${escHtml(String(args.description))})` : ''}.`,
      run: () => { closeDynamicModal(); openPaymentLinkModal(cust.id); setTimeout(() => { const el = document.getElementById('plAmount'); if (el && hasAmt) el.value = amt.toFixed(2); const de = document.getElementById('plDesc'); if (de && args.description) de.value = String(args.description).slice(0, 120); }, 150); } };
  }
  if (a === 'add_task') {
    const title = String(args.title || '').trim();
    if (!title) return { error: 'What should the task say?' };
    return { summary: `Add a task: <strong>${escHtml(title)}</strong>${cust ? ` (linked to ${escHtml(cn)})` : ''}.`,
      run: async () => { try { const r = await window.api.addTask({ title, customerId: cust ? cust.id : undefined }); if (r && (r.success || r.task)) { toast('Task added.', 'success'); if (currentTab === 'tasks') renderTasksTab(); const o = document.getElementById('askOut'); if (o) o.innerHTML = '<div style="color:var(--success);font-size:var(--fs-body);">✓ Task added.</div>'; } else toast('Could not add task.', 'error'); } catch { toast('Could not add task.', 'error'); } } };
  }
  if (a === 'mark_task_done') {
    const hint = String(args.task || '').toLowerCase().trim();
    if (!hint) return { error: 'Which task?' };
    let list = [];
    try { const t = await window.api.getTasks(); if (Array.isArray(t)) list = t.filter((x) => !x.done); } catch {}
    const matches = list.filter((x) => { const tl = String(x.title || '').toLowerCase(); return tl.includes(hint) || hint.split(' ').every((w) => w && tl.includes(w)); });
    if (!matches.length) return { error: `I couldn’t find an open task matching “${escHtml(hint)}”.` };
    if (matches.length > 1) return { error: `Several open tasks match “${escHtml(hint)}” — please be more specific.` };
    const tk = matches[0];
    return { summary: `Mark done: <strong>${escHtml(tk.title)}</strong>.`,
      run: async () => { try { const r = await window.api.updateTask({ id: tk.id, done: true }); if (r && (r.success || r.task)) { toast('Marked done.', 'success'); if (currentTab === 'tasks') renderTasksTab(); const o = document.getElementById('askOut'); if (o) o.innerHTML = '<div style="color:var(--success);font-size:var(--fs-body);">✓ Done.</div>'; } else toast('Could not update.', 'error'); } catch { toast('Could not update.', 'error'); } } };
  }
  return { error: 'I’m not sure how to do that yet.' };
}

const PALETTE_COMMANDS = [
  // ── Create ──
  { icon: '📱', label: 'New Rental', sub: 'create', run: () => openNewRentalModal() },
  { icon: '✈️', label: 'New Booking', sub: 'create', run: () => openNewBookingModal() },
  { icon: '🔧', label: 'New Repair', sub: 'create', run: async () => { repairMenu = await window.api.getServiceMenu('repair'); openNewRepairModal(); } },
  { icon: '👤', label: 'New Customer', sub: 'create', run: () => goToTab('customers', {}) || setTimeout(() => document.getElementById('btnNewCustomer')?.click(), 120) },
  { icon: '📶', label: 'New SIM plan', sub: 'create', run: () => openOnTab('sim', openSimFormModal) },
  { icon: '☎️', label: 'New Virtual Number', sub: 'create', run: () => openOnTab('virtual', openNewVNModal) },
  { icon: '🖨️', label: 'Charge a Service', sub: 'create', run: () => openOnTab('services', openNewServiceModal) },
  { icon: '📦', label: 'Add Stock Item', sub: 'create', run: () => openOnTab('shop', openStockItemModal) },
  // ── Tools ──
  { icon: '⏱', label: 'Start help timer', sub: 'tool', run: () => openOnTab('services', () => document.getElementById('svcTimerCustomer')?.focus()) },
  { icon: '🛒', label: 'Point of Sale (Till)', sub: 'tool', keys: ['pos', 'till', 'sell', 'checkout'], run: () => goToTab('shop') },
  { icon: '📇', label: 'Manage Phone Inventory', sub: 'tool', run: () => openOnTab('rentals', openManagePhonesModal) },
  { icon: '🧾', label: 'Cash-up (Z-report)', sub: 'tool', keys: ['cashup', 'z report', 'eod', 'end of day', 'takings'], run: () => openCashupModal() },
  { icon: '⌨️', label: 'Keyboard shortcuts', sub: 'help', run: () => openShortcuts() },
  { icon: '⏰', label: 'New reminder', sub: 'tool', run: () => openRemindModal('note', '') },
  { icon: '🔑', label: 'Change my password', sub: 'tool', run: () => openChangePasswordModal() },
  { icon: '🌓', label: 'Toggle dark mode', sub: 'tool', run: () => toggleTheme() },
  { icon: '🔠', label: 'Text size (Simple Mode)', sub: 'tool', keys: ['text size', 'bigger', 'larger', 'font', 'simple mode', 'accessibility'], run: () => cycleTextSize() },
  // ── Find (saved-filter views) ──
  { icon: '⏰', label: 'Show overdue rentals', sub: 'view', run: () => filterView('rentals', () => { kcView('rentals').dims = { balance: 'all', status: 'overdue' }; }, renderRentalRows) },
  { icon: '💷', label: 'Rentals with a balance owing', sub: 'view', run: () => filterView('rentals', () => { kcView('rentals').dims = { balance: 'debt', status: 'all' }; }, renderRentalRows) },
  { icon: '💰', label: 'Who owes money (arrears)', sub: 'view', run: () => filterView('customers', () => { customerFilter = 'arrears'; }, renderTableRows) },
  { icon: '✈️', label: 'Customers flying soon', sub: 'view', run: () => filterView('customers', () => { customerFilter = 'flight'; }, renderTableRows) },
  { icon: '🛂', label: 'Customers with passport on file', sub: 'view', run: () => filterView('customers', () => { customerFilter = 'passport'; }, renderTableRows) },
  { icon: '📶', label: 'SIMs that renew this week', sub: 'view', run: () => filterView('sim', () => { simFilterStatus = 'week'; simFilterPay = 'all'; }, renderSimRows) },
  { icon: '🔧', label: 'Repairs waiting for collection', sub: 'view', run: () => filterView('repairs', () => { kcView('repairs').filter = 'ready'; }) },
  // (the old one-off 'Payment / top-up for open customer' entry is superseded
  // by paletteContextVerbs — every card verb now surfaces automatically)
  // ── Admin (hidden for helpers) ──
  { icon: '📊', label: 'Business summary (revenue)', sub: 'admin', admin: true, run: () => openBusinessSummary() },
  { icon: '⚙️', label: 'Run automations now', sub: 'admin', admin: true, run: () => runSweepsNow() },
  { icon: '📤', label: 'Export CSV', sub: 'admin', admin: true, run: async () => { const r = await window.api.exportCSV(); toast(r?.success ? 'CSV exported.' : (r?.error || 'Export failed.'), r?.success ? 'success' : 'error'); } },
  { icon: '✉️', label: 'Add email address', sub: 'admin', admin: true, run: () => openOnTab('settings', openEmailAliasModal) },
  { icon: '🤖', label: 'New automation rule', sub: 'admin', admin: true, run: () => openOnTab('settings', openAutomationModal) },
  { icon: '🔗', label: 'Match customers to ELID', sub: 'admin', admin: true, run: () => openElidMatchModal() },
  { icon: '📥', label: 'Import ELID accounts', sub: 'admin', admin: true, run: () => openElidImportModal() },
  { icon: '👥', label: 'Find duplicate customers', sub: 'admin', admin: true, run: () => openDupScanModal() },
  { icon: '🧠', label: 'AI plan my day (tasks)', sub: 'tasks', run: () => openTaskTriageModal() },
  { icon: '🤖', label: 'Ask / do anything (AI assistant)', sub: 'AI', run: () => openAssistantModal() },
  // ── Navigate ──
  // #49 — palette navigate entries read the same label map, so "Go to SIM
  // Plans" matches the sidebar and page title exactly (no more "Go to sim").
  ...Object.keys(TAB_META)
    .map(t => ({ icon: '↪', label: `Go to ${TAB_META[t]?.label || t}`, sub: 'navigate', tab: t, run: () => goToTab(t) })),
];

// Commands the current user may run — admin-only entries are hidden for
// helpers (#78: navigation to a forbidden tab is hidden too).
function visibleCommands() {
  const isAdmin = !currentStaff || currentStaff.role === 'owner';
  return PALETTE_COMMANDS.filter(c =>
    (!c.admin || isAdmin) &&
    (!c.tab || !allowedTabs || allowedTabs.includes(c.tab)));
}

// Strip everything that isn't a letter or digit from both sides, so
// punctuation and spacing in a label can never block a match.
function paletteNorm(v) { return String(v || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
// A command matches on its label OR any alias.
function paletteHit(c, needle) {
  if (paletteNorm(c.label).includes(needle)) return true;
  return (c.keys || []).some(k => paletteNorm(k).includes(needle));
}

function paletteSearch(q) {
  const needle = paletteNorm(q);
  const digits = needle.replace(/\D/g, '');
  const out = [];
  const commands = visibleCommands();
  // Empty query: the Quick-actions tiles right above this list are exactly the
  // "create" commands, so slicing the top 9 printed New Rental … Add Stock Item
  // twice, one block under the other, and pushed everything else out of sight.
  // The tiles were added after this line and nobody came back to it. Show what
  // the tiles don't — the tools and saved views, which are the entries you
  // can't find any other way without knowing their name.
  if (!needle) return commands.filter(c => c.sub !== 'create').slice(0, 9);

  // Verbs for the open customer card outrank everything: with a card open,
  // "pay" should mean THIS customer's payment before any generic command.
  const ctx = paletteContextVerbs();
  if (ctx) {
    for (const v of ctx.verbs) {
      if (paletteHit(v, needle)) out.push({ ...v, sub: `for ${ctx.name}`, kind: 'ctx' });
    }
  }
  for (const c of commands) {
    if (paletteHit(c, needle)) { out.push(c); if (out.length >= 6) break; }
  }
  for (const c of customers) {
    if (out.length >= 12) break;
    const name = `${c.firstName} ${c.lastName}`;
    if (name.toLowerCase().includes(needle) ||
        (digits.length >= 4 && (c.phone || '').replace(/\D/g, '').includes(digits)) ||
        phoneDigitsMatch(needle, c) ||
        (c.email || '').toLowerCase().includes(needle)) {
      out.push({ icon: '👤', label: name, sub: fmtPhone(c.phone || '') || c.email || 'customer',
        kind: 'customer', id: c.id, run: () => goToTab('customers', { customerId: c.id }) });
    }
  }
  for (const p of phones) {
    if (out.length >= 12) break;
    const hay = `${p.number || ''} ${p.imei || ''} ${p.simId || ''}`.replace(/\D/g, '');
    if ((p.number || '').toLowerCase().includes(needle) ||
        (digits.length >= 5 && hay.includes(digits))) {
      out.push({ icon: '📱', label: fmtPhone(p.number || '') || '(no number)',
        sub: `${p.country || ''} · ${p.status}${p.maintenance ? ' · 🔧 maintenance' : ''}${p.imei ? ' · IMEI ' + p.imei : ''}`,
        kind: 'phone', id: p.id, run: () => openEditPhoneModal(p.id) });
    }
  }
  for (const b of bookings) {
    if (out.length >= 12) break;
    if ((b.route || '').toLowerCase().includes(needle) ||
        (b.passenger || '').toLowerCase().includes(needle) ||
        (b.bookingReference || '').toLowerCase().includes(needle)) {
      out.push({ icon: '✈️', label: `${b.route} — ${b.customerName || b.passenger || ''}`,
        sub: `flies ${fmtDate(b.travelDate)}`, run: () => goToTab('bookings') });
    }
  }
  // #50 — SIMs, virtual numbers, repairs and services were unsearchable.
  for (const s of sims) {
    if (out.length >= 12) break;
    if ((s.customerName || '').toLowerCase().includes(needle) ||
        (s.provider || '').toLowerCase().includes(needle) ||
        (s.simNumber || '').toLowerCase().includes(needle) ||
        (digits.length >= 4 && (s.simNumber || '').replace(/\D/g, '').includes(digits))) {
      out.push({ icon: '📶', label: `SIM — ${s.customerName || ''}`, sub: `${s.provider || 'plan'}${s.simNumber ? ' · ' + s.simNumber : ''}`,
        kind: 'sim', id: s.id, run: () => openManageSimModal(s.id) });
    }
  }
  for (const v of virtualNumbers) {
    if (out.length >= 12) break;
    if ((v.number || '').toLowerCase().includes(needle) ||
        (v.customerName || '').toLowerCase().includes(needle) ||
        (digits.length >= 4 && (v.number || '').replace(/\D/g, '').includes(digits))) {
      out.push({ icon: '🔢', label: `VN ${fmtPhone(v.number || '')} — ${v.customerName || ''}`, sub: v.status || 'virtual number',
        run: () => goToTab('virtual') });
    }
  }
  for (const r of repairs) {
    if (out.length >= 12) break;
    if ((r.customerName || '').toLowerCase().includes(needle) ||
        (r.device || '').toLowerCase().includes(needle)) {
      out.push({ icon: '🔧', label: `Repair — ${r.customerName || ''}`, sub: `${r.device || ''} · ${r.status || ''}`,
        run: () => goToTab('repairs') });
    }
  }
  for (const o of serviceOrders) {
    if (out.length >= 12) break;
    if ((o.customerName || '').toLowerCase().includes(needle) ||
        (o.serviceName || '').toLowerCase().includes(needle)) {
      out.push({ icon: '🖨️', label: `${o.serviceName || 'Service'} — ${o.customerName || ''}`, sub: o.createdAt ? fmtDate(o.createdAt) : 'service',
        run: () => goToTab('services') });
    }
  }
  for (const t of (tasksList || [])) {
    if (out.length >= 12) break;
    if (!t.done && (t.title || '').toLowerCase().includes(needle)) {
      out.push({ icon: '⏰', label: t.title || 'Task', sub: t.dueDate ? `due ${fmtDate(t.dueDate)}` : 'task',
        run: () => goToTab('tasks') });
    }
  }
  return out.slice(0, 12);
}

function paletteRender() {
  const list = document.getElementById('paletteList');
  if (!list) return;
  list.innerHTML = paletteResults.length === 0
    ? `<div style="padding:14px;color:var(--muted);font-size:var(--fs-body);">No matches.</div>`
    : paletteResults.map((r, i) => `
      <div class="palette-item${i === paletteIndex ? ' active' : ''}" onclick="paletteRun(${i})">
        <span style="width:22px;text-align:center;">${r.icon}</span>
        <span style="flex:1;">${escHtml(r.label)}</span>
        <span style="color:var(--muted);font-size:var(--fs-micro);">${escHtml(r.sub)}</span>
      </div>`).join('');
}

// ── Recently viewed (⌘K) ──────────────────────────────────────────────────
// The last few records you opened from the palette, surfaced in its empty
// state so ⌘K hops you straight back. Nav-only; persisted locally. Each entry
// is serialisable {icon,label,sub,kind,id} and its action is rebuilt from
// kind+id on click (the run closures themselves can't be stored).
const RECENT_KEY = 'kc_recent_nav';
let recentNav = [];
try { recentNav = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); if (!Array.isArray(recentNav)) recentNav = []; } catch { recentNav = []; }

const RECENT_RUN = {
  customer: (id) => goToTab('customers', { customerId: id }),
  phone:    (id) => openEditPhoneModal(id),
  sim:      (id) => openManageSimModal(id),
};

function pushRecent(it) {
  if (!it || !it.kind || !RECENT_RUN[it.kind]) return;
  const key = it.kind + ':' + (it.id ?? '');
  recentNav = [{ icon: it.icon, label: it.label, sub: it.sub, kind: it.kind, id: it.id ?? null },
    ...recentNav.filter(r => (r.kind + ':' + (r.id ?? '')) !== key)].slice(0, 6);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(recentNav)); } catch { /* private mode / full */ }
}

window.paletteRecentRun = (i) => {
  const r = recentNav[i];
  closePalette();
  if (r && RECENT_RUN[r.kind]) RECENT_RUN[r.kind](r.id);
};

// ── Pinned favourites (⌘K) — keep the records you touch most at the top of the
// palette. Same serialisable {icon,label,sub,kind,id} shape and RECENT_RUN
// actions as recently-viewed; nav-only, persisted locally. Pin from a Recent
// card's 📌, unpin from the pinned card's 📌.
const PIN_KEY = 'kc_pinned_nav';
let pinnedNav = [];
try { pinnedNav = JSON.parse(localStorage.getItem(PIN_KEY) || '[]'); if (!Array.isArray(pinnedNav)) pinnedNav = []; } catch { pinnedNav = []; }
const pinKeyOf = (r) => (r.kind + ':' + (r.id ?? ''));
const isPinned = (r) => pinnedNav.some((p) => pinKeyOf(p) === pinKeyOf(r));
function savePins() { try { localStorage.setItem(PIN_KEY, JSON.stringify(pinnedNav)); } catch { /* private mode / full */ } }
window.palettePin = (i) => {
  const r = recentNav[i];
  if (r && RECENT_RUN[r.kind] && !isPinned(r)) {
    pinnedNav = [{ icon: r.icon, label: r.label, sub: r.sub, kind: r.kind, id: r.id ?? null }, ...pinnedNav].slice(0, 8);
    savePins();
  }
  fillPaletteQuick();
};
window.paletteUnpin = (i) => { pinnedNav = pinnedNav.filter((_, j) => j !== i); savePins(); fillPaletteQuick(); };
window.palettePinRun = (i) => { const r = pinnedNav[i]; closePalette(); if (r && RECENT_RUN[r.kind]) RECENT_RUN[r.kind](r.id); };

function paletteRun(i) {
  const r = paletteResults[i];
  closePalette();
  if (r) { pushRecent(r); r.run(); }
}

// ── Context verbs (⌘K) — act on the record you're looking at, not just
// navigate (Linear pattern). With a customer card open, the palette leads
// with verbs for THAT customer, and a typed search matches them first —
// ⌘K "pay" ↵ takes the payment without hunting for a button. Every verb is
// an existing card action; opening one over the card is exactly what the
// card's own buttons do. pushRecent ignores these (kind 'ctx' isn't
// navigable), so they never pollute Recent.
function paletteContextVerbs() {
  // "Looking at a customer" = the card overlay OR the full-page profile —
  // the palette's verbs act on whichever is up.
  const card = document.getElementById('customerCard');
  const cardOpen = !!card && !card.classList.contains('hidden');
  if ((!cardOpen && !customerPageId) || !selectedId) return null;
  const c = customers.find((x) => x.id === selectedId);
  if (!c) return null;
  const id = c.id;
  return {
    name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'this customer',
    verbs: [
      { icon: '💰', label: 'Record payment / credit', run: () => openWalletModal(id) },
      { icon: '📱', label: 'New rental', run: () => openNewRentalModal(id) },
      { icon: '✉️', label: 'Draft reminder', run: () => openDraftReminderModal(id) },
      { icon: '📞', label: 'Log call / note', run: () => openLogCommModal(id) },
      { icon: '⏰', label: 'Remind me', run: () => openRemindModal('customer', id) },
      { icon: '✏️', label: 'Edit details', run: () => openEditModal(id) },
      ...(customerPageId === id ? [] : [{ icon: '👤', label: 'Open full profile', run: () => openCustomerPage(id) }]),
    ],
  };
}
window.paletteCtxRun = (i) => {
  const ctx = paletteContextVerbs();
  closePalette();
  if (ctx && ctx.verbs[i]) ctx.verbs[i].run();
};

// Spotlight-style quick actions — the common "create" commands as icon tiles,
// shown while the palette query is empty (hidden the moment you start typing).
function paletteQuickItems() { return PALETTE_COMMANDS.filter(c => c.sub === 'create'); }
window.paletteQuickRun = (i) => { const it = paletteQuickItems()[i]; closePalette(); if (it) it.run(); };
function fillPaletteQuick() {
  const q = document.getElementById('paletteQuick');
  if (!q) return;
  // A nav card (keyboard-operable div, so the 📌 corner can be its own control
  // — a button can't nest a button) with a pin toggle in the corner.
  const navCard = (navCall, r, corner) =>
    `<div class="palette-quick-card" role="button" tabindex="0" title="${escHtml(r.sub || '')}"
        onclick="${navCall}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${navCall}}">
      <span class="pq-icon">${r.icon}</span><span class="pq-label">${escHtml(r.label)}</span>${corner}
    </div>`;
  const pin = (call, on, title) =>
    `<span class="pq-pin${on ? ' on' : ''}" role="button" tabindex="0" aria-label="${title}" title="${title}"
        onclick="event.stopPropagation();${call}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();${call}}">📌</span>`;
  let html = '';
  const ctx = paletteContextVerbs();
  if (ctx) {
    html += `<div class="palette-quick-label">For ${escHtml(ctx.name)}</div><div class="palette-quick-row">` +
      ctx.verbs.map((v, i) =>
        `<button type="button" class="palette-quick-card" onclick="paletteCtxRun(${i})">
          <span class="pq-icon">${v.icon}</span><span class="pq-label">${escHtml(v.label)}</span>
        </button>`).join('') + `</div>`;
  }
  if (pinnedNav.length) {
    html += `<div class="palette-quick-label">Pinned</div><div class="palette-quick-row">` +
      pinnedNav.map((r, i) => navCard(`palettePinRun(${i})`, r, pin(`paletteUnpin(${i})`, true, 'Unpin'))).join('') + `</div>`;
  }
  // Recent, minus anything already pinned (kept at its real index for the run).
  const recentShown = recentNav.map((r, i) => ({ r, i })).filter((x) => !isPinned(x.r));
  if (recentShown.length) {
    html += `<div class="palette-quick-label">Recent</div><div class="palette-quick-row">` +
      recentShown.map(({ r, i }) => navCard(`paletteRecentRun(${i})`, r, pin(`palettePin(${i})`, false, 'Pin'))).join('') + `</div>`;
  }
  html += `<div class="palette-quick-label">Quick actions</div><div class="palette-quick-row">` +
    paletteQuickItems().map((c, i) =>
      `<button type="button" class="palette-quick-card" onclick="paletteQuickRun(${i})"${i < 9 ? ` title="Press ${i + 1}" aria-keyshortcuts="${i + 1}"` : ''}>
        <span class="pq-icon">${c.icon}</span><span class="pq-label">${escHtml(c.label.replace(/^New /, ''))}</span>${i < 9 ? `<span class="pq-key" aria-hidden="true">${i + 1}</span>` : ''}
      </button>`).join('') + `</div>`;
  q.innerHTML = html;
}

function openPalette() {
  kcSaveReturnFocus('paletteOverlay');
  if (document.getElementById('paletteOverlay')) return;
  const el = document.createElement('div');
  el.id = 'paletteOverlay';
  el.className = 'palette-overlay';
  el.innerHTML = `
    <div class="palette-box">
      <input class="palette-input" id="paletteInput" placeholder="${kcHint('Search customers, phones, IMEI… or type a command', 'Search or type a command')}"
        autocomplete="off" spellcheck="false">
      <div id="paletteQuick" class="palette-quick"></div>
      <div id="paletteList"></div>
      <div style="padding:7px 14px;border-top:1px solid var(--border);font-size:var(--fs-micro);color:var(--muted);">↑↓ navigate · Enter open · 1–9 quick action · Esc close · scan a barcode straight in</div>
    </div>`;
  el.addEventListener('mousedown', e => { if (e.target === el) closePalette(); });
  document.body.appendChild(el);
  const input = document.getElementById('paletteInput');
  paletteIndex = 0;
  paletteResults = paletteSearch('');
  fillPaletteQuick();
  paletteRender();
  input.focus();
  const quick = document.getElementById('paletteQuick');
  input.addEventListener('input', () => {
    paletteIndex = 0;
    paletteResults = paletteSearch(input.value);
    if (quick) quick.style.display = input.value.trim() ? 'none' : 'block';
    paletteRender();
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); paletteIndex = Math.min(paletteIndex + 1, paletteResults.length - 1); paletteRender(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); paletteIndex = Math.max(paletteIndex - 1, 0); paletteRender(); }
    else if (e.key === 'Enter') { e.preventDefault(); paletteRun(paletteIndex); }
    else if (!input.value.trim() && /^[1-9]$/.test(e.key)) {
      // Empty search → the numbered Quick actions are showing; the digit fires one.
      const items = paletteQuickItems(); const n = Number(e.key) - 1;
      if (n < items.length) { e.preventDefault(); paletteQuickRun(n); }
    }
    else if (e.key === 'Escape') { closePalette(); }
  });
}

function closePalette() {
  kcRestoreReturnFocus('paletteOverlay');
  document.getElementById('paletteOverlay')?.remove();
}

// ── Keyboard shortcuts help (press ?) ────────────────────────────────────
// A discoverability card for the keyboard-first work — the palette, the row/
// card Enter-to-open, the Escape stack. Additive; opens on "?" from anywhere
// you're not typing.
const KC_SHORTCUTS = [
  ['⌘K / Ctrl K', 'Open the command palette — search customers, phones, IMEI, or run a command'],
  ['⌘B / Ctrl B', 'Collapse or expand the sidebar (menu drawer on a phone)'],
  ['?', 'Show this shortcuts help'],
  ['Esc', 'Close the open dialog, palette, or customer card'],
  ['Enter / Space', 'Open the focused row, card, or dashboard drill-down'],
  ['Tab / ⇧ Tab', 'Move between fields — stays inside an open dialog'],
  ['↑ ↓ then Enter', 'In the palette: pick a result and open it'],
  ['1 – 9', 'In the palette (empty search): run that numbered Quick action'],
  ['Scan a barcode', 'Scans straight into the palette or the till'],
];
function kcIsTyping() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}
function openShortcuts() {
  if (document.getElementById('kcShortcuts')) return;
  kcSaveReturnFocus('kcShortcuts');
  const el = document.createElement('div');
  el.id = 'kcShortcuts';
  el.className = 'modal-overlay';
  el.addEventListener('mousedown', e => { if (e.target === el) closeShortcuts(); });
  el.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="kcShortcutsTitle" style="width:460px;">
      <div class="modal-title" id="kcShortcutsTitle">⌨️ Keyboard shortcuts</div>
      <div class="kc-shortcuts">
        ${KC_SHORTCUTS.map(([k, d]) => `<div class="kc-shortcut"><span class="kbd">${escHtml(k)}</span><span class="kc-shortcut-desc">${escHtml(d)}</span></div>`).join('')}
      </div>
      <div class="modal-actions"><button class="btn btn-primary" onclick="closeShortcuts()">Got it</button></div>
    </div>`;
  document.body.appendChild(el);
  const btn = el.querySelector('button');
  if (btn) { try { btn.focus({ preventScroll: true }); } catch { btn.focus(); } }
}
function closeShortcuts() {
  document.getElementById('kcShortcuts')?.remove();
  kcRestoreReturnFocus('kcShortcuts');
}

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openPalette();
    return;
  }
  // ⌘B/Ctrl+B — sidebar: icon rail on desktop, drawer on phones.
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'b') {
    e.preventDefault();
    if (window.kcToggleNav) window.kcToggleNav();
    return;
  }
  // "?" opens the shortcuts help — but not while typing in a field, and not
  // when an overlay is already up.
  if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey && !kcIsTyping()
      && !document.getElementById('paletteOverlay') && !document.getElementById('kcShortcuts')
      && !kcTopModalOverlay()) {
    e.preventDefault();
    openShortcuts();
    return;
  }
  // Escape closes the top-most open overlay (a universal expectation). Order
  // matches the visual stack: charge-confirm > palette > action modals >
  // customer card. The palette input has its own Esc too; this covers the
  // rest and the case where focus isn't in the palette.
  if (e.key === 'Escape') {
    const open = (id) => { const el = document.getElementById(id); return el && !el.classList.contains('hidden') ? el : null; };
    if (open('kcShortcuts')) { closeShortcuts(); return; }
    if (open('kcConfirm')) { kcConfirmDone(false); return; }
    if (open('paletteOverlay')) { closePalette(); return; }
    if (open('dynamicModal')) { closeDynamicModal(); return; }
    if (open('customerModal')) { closeModal(); return; }
    if (open('customerCard')) { dismissCustomerCard(); return; }
  }
});

// ── Programmatic labels for form controls ────────────────────────────────
// Nearly every field in the app sits in a `.form-group` under a visible
// `<label class="form-label">` that has no `for=`. Sighted staff see a
// labelled field; a screen reader announces "edit text, blank" — and clicking
// the label doesn't focus the field either. ~200 controls are like this, so
// rather than 200 hand edits (200 chances to break a live form), bind the pair
// the markup already puts together, at render time. Same shape as
// kcScanClickable below: one pass per inserted subtree.
const KC_CTL = 'input:not([type=hidden]):not([type=submit]):not([type=button]),select,textarea';
let kcLabelSeq = 0;
function kcHasName(el) {
  return !!((el.getAttribute('aria-label') || '').trim() ||
            el.getAttribute('aria-labelledby') ||
            (el.labels && el.labels.length) ||
            (el.getAttribute('title') || '').trim());
}
function kcLabelControls(group) {
  // Form groups nest (a group can hold a form-grid of groups), so only take
  // the controls and labels this group actually owns.
  const mine = el => el.closest('.form-group') === group;
  const ctls = [...group.querySelectorAll(KC_CTL)].filter(mine);
  if (!ctls.length) return;
  // A label that already points somewhere, or that wraps its own control
  // (the checkbox rows), is left alone — it works.
  const label = [...group.querySelectorAll('label')].filter(mine)
    .find(l => !l.getAttribute('for') && !l.querySelector(KC_CTL));
  const first = ctls[0];                       // what the group's label describes
  if (label && !kcHasName(first)) {
    if (!first.id) first.id = 'kc-ctl-' + (++kcLabelSeq);
    label.setAttribute('for', first.id);
    return;
  }
  // Some groups head themselves with a `.section-divider` ("Payment") instead
  // of a label. It's a heading, not a <label>, so point at it by id rather
  // than inventing a `for`.
  const head = [...group.querySelectorAll('.section-divider')].filter(mine)[0];
  if (head && !kcHasName(first) && head.textContent.trim()) {
    if (!head.id) head.id = 'kc-lbl-' + (++kcLabelSeq);
    first.setAttribute('aria-labelledby', head.id);
  }
}
// Inline-edit tables (the price menu, Kol Torah titles, extra charges) put a
// bare control in every cell. The column header IS the field name there — it's
// what a sighted user reads the cell against — so borrow it. Column index is
// walked with colspan so the grouping rows don't shift the mapping.
const KC_CELL_CTL = KC_CTL.split(',').map(s => 'td ' + s).join(',');
function kcLabelCells(root) {
  root.querySelectorAll(KC_CELL_CTL).forEach(el => {
    if (kcHasName(el)) return;
    const cell = el.closest('td'), table = cell.closest('table');
    const head = table && table.querySelector(':scope > thead > tr:last-child');
    if (!head) return;
    let col = 0;
    for (const c of cell.parentElement.children) { if (c === cell) break; col += c.colSpan || 1; }
    let at = 0, name = '';
    for (const th of head.children) {
      const w = th.colSpan || 1;
      if (col < at + w) { name = th.textContent.trim(); break; }
      at += w;
    }
    if (name) el.setAttribute('aria-label', name);
  });
}
// Last resort for a control with no label anywhere — the search boxes, and the
// second/third field of a paired row. The placeholder is the only text a
// sighted user gets, and it vanishes as soon as they type, so promoting it to
// an accessible name loses nothing and gives a screen reader something.
// …and for a bare <select>, its own prompt option. Only a real prompt counts:
// an empty-value first option ("Choose a customer…") or a "Filter: everyone"
// style prefix. A first option that's just the default value ("Normal") names
// nothing, so it's left alone rather than given a misleading name.
function kcSelectPrompt(sel) {
  const first = sel.options && sel.options[0];
  if (!first) return '';
  const txt = (first.textContent || '').trim();
  if (/:\s/.test(txt)) return txt.split(/:\s/)[0].trim();
  return first.value === '' ? txt.replace(/^[—–-]\s*|\s*[—–-]$/g, '').trim() : '';
}
function kcLabelFallback(root) {
  root.querySelectorAll(KC_CTL).forEach(el => {
    if (kcHasName(el)) return;
    const name = (el.getAttribute('placeholder') || '').trim() ||
                 (el.tagName === 'SELECT' ? kcSelectPrompt(el) : '');
    if (name) el.setAttribute('aria-label', name);
  });
}
function kcScanLabels(root) {
  if (!root || root.nodeType !== 1 || !root.querySelectorAll) return;
  if (root.matches && root.matches('.form-group')) kcLabelControls(root);
  root.querySelectorAll('.form-group').forEach(kcLabelControls);
  kcLabelCells(root);
  kcLabelFallback(root);
}

// ── A scrollable table must be reachable by keyboard ─────────────────────
// The edge shadow now shows that a list table has more to the side, but a
// keyboard still could not get there. Not for the buttons — tabbing to a
// control scrolls it into view, so Edit/Details/Delete were always reachable
// even at 339px off-screen. It is the columns with nothing focusable in them:
// Balance is plain text, so a keyboard-only user tabs from the last button of
// one row to the first of the next and never sees "£45.00 debt" at all.
// A scroll container that holds content a keyboard cannot reach needs to be
// focusable itself (WCAG 2.1.1).
//
// A tab stop is only warranted while the table actually overflows — the same
// table at 1280px has nothing hidden, and a tab stop that does nothing is
// noise. So this re-runs on resize and takes the attributes off again.
function kcSyncScrollers() {
  // Two shapes scroll: the .table-wrap div, and a table that IS the scroll box
  // because it sits straight inside a .table-card.
  document.querySelectorAll('.table-wrap, .table-card > table').forEach(w => {
    const scrolls = w.scrollWidth - w.clientWidth > 1;
    if (scrolls) {
      if (w.getAttribute('data-kc-scroller') === '1') return;
      w.setAttribute('data-kc-scroller', '1');
      w.setAttribute('tabindex', '0');
      // role=region on a <table> would stop it being a table to a screen
      // reader, which costs more than the region announcement is worth. The
      // table keeps its own role; the label below still names it.
      if (w.tagName !== 'TABLE') w.setAttribute('role', 'region');
      // Name it after the section it belongs to, so a screen reader announces
      // "Customers, scrollable region" rather than an anonymous one.
      const head = w.previousElementSibling?.querySelector?.('.section-title')
        || w.closest('.card, .settings-card, .content')?.querySelector('.section-title');
      const title = (head?.textContent || '').trim();
      w.setAttribute('aria-label', title ? `${title} — scrolls sideways` : 'Table, scrolls sideways');
    } else if (w.getAttribute('data-kc-scroller') === '1') {
      w.removeAttribute('data-kc-scroller');
      w.removeAttribute('tabindex');
      if (w.tagName !== 'TABLE') w.removeAttribute('role');
      w.removeAttribute('aria-label');
    }
  });
}
let kcScrollerTimer = null;
function kcScheduleScrollerSync() {
  if (kcScrollerTimer) return;                 // coalesce a burst of mutations
  kcScrollerTimer = setTimeout(() => { kcScrollerTimer = null; kcSyncScrollers(); }, 60);
}
window.addEventListener('resize', kcScheduleScrollerSync);

// ── Keyboard-operable clickable rows / drill-downs ───────────────────────
// Dozens of rows and cards use inline onclick on non-button elements (tr, div),
// which a keyboard can neither focus nor trigger. Rather than edit ~240 call
// sites, mark every clickable non-native element focusable (tabindex) + give
// non-row elements a button role, and let Enter/Space activate it. The
// :focus-visible ring already covers tbody tr / [tabindex] / [role=button].
function kcMarkClickable(el) {
  const tag = el.tagName;
  if (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || tag === 'SELECT' ||
      tag === 'TEXTAREA' || tag === 'LABEL') return;            // natively operable
  if (el.hasAttribute('data-kc-key')) return;                   // already marked
  el.setAttribute('data-kc-key', '1');
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
  // Keep table rows as rows for screen readers; only non-rows become buttons.
  if (tag !== 'TR' && !el.hasAttribute('role')) el.setAttribute('role', 'button');
}
function kcScanClickable(root) {
  if (!root || root.nodeType !== 1) return;
  if (root.hasAttribute && root.hasAttribute('onclick')) kcMarkClickable(root);
  if (root.querySelectorAll) root.querySelectorAll('[onclick]').forEach(kcMarkClickable);
}
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
  const el = document.activeElement;
  if (!el || !el.hasAttribute || !el.hasAttribute('data-kc-key')) return;
  if (e.target !== el) return;              // let inner controls handle their own keys
  e.preventDefault();                        // Space would otherwise scroll the page
  el.click();
});
try {
  const kcClickObs = new MutationObserver(muts => {
    for (const m of muts) m.addedNodes.forEach(n => { kcScanClickable(n); kcScanLabels(n); });
    kcScheduleScrollerSync();          // a repainted tab may have swapped the table
  });
  kcClickObs.observe(document.body, { childList: true, subtree: true });
} catch { /* MutationObserver unsupported — rows stay mouse-only, no worse than before */ }
kcScanClickable(document.body);
kcScanLabels(document.body);
kcSyncScrollers();

// ── Modal focus trap ─────────────────────────────────────────────────────
// Modals carry role=dialog + aria-modal (announced as dialogs) and Escape
// already closes them; this keeps Tab inside the top-most open dialog so focus
// can't wander into the dimmed page behind it. Stack order matches the Escape
// handler: confirm > dynamic action modal > customer form.
function kcTopModalOverlay() {
  for (const id of ['kcShortcuts', 'kcConfirm', 'dynamicModal', 'customerModal', 'customerCard']) {
    const el = document.getElementById(id);
    if (el && !el.classList.contains('hidden')) return el;
  }
  return null;
}
document.addEventListener('keydown', e => {
  if (e.key !== 'Tab') return;
  const overlay = kcTopModalOverlay();
  if (!overlay) return;
  const scope = overlay.querySelector('.modal') || overlay;
  const sel = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),'
            + 'select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  const f = [...scope.querySelectorAll(sel)].filter(el => el.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1], active = document.activeElement;
  if (!scope.contains(active)) { e.preventDefault(); first.focus(); return; }
  if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
});

// Keep the floating help-timer chip alive across the whole session.
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startSvcTimerFloat);
else startSvcTimerFloat();

// ── Priority suggestion engine ───────────────────────────────────────────
// Deterministic scoring over what the task IS (its reference) and its due
// date — the assistant proposes, the user disposes. Returns null when there
// is nothing to say (no opinion, already at the suggested level, or the
// same suggestion was rejected before).
// AI "plan my day" — asks the server (Gemini) to rank the whole open queue,
// then shows the plan grouped Now / Today / Soon with a reason and next step.
// Advisory: ticking ✓ marks a task done; nothing else is changed automatically.
async function openTaskTriageModal() {
  showDynamicModal(`<div class="modal-title">🧠 AI plan for your day</div><div id="aiPlanBody" style="font-size:var(--fs-body);color:var(--muted);">Reading your open tasks and working out the order…</div>`);
  try {
    const r = await kcFetch('/api/tasks/prioritize', { method: 'POST' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.success) { const b = document.getElementById('aiPlanBody'); if (b) b.innerHTML = escHtml(j.error || 'Could not build a plan.'); return; }
    renderTaskTriage(j);
  } catch { const b = document.getElementById('aiPlanBody'); if (b) b.textContent = 'Could not reach the server.'; }
}
function renderTaskTriage(j) {
  const buckets = [
    { key: 'now', label: '🔴 Now', color: 'var(--danger-ink)' },
    { key: 'today', label: '🟡 Today', color: 'var(--warning,#b7791f)' },
    { key: 'soon', label: '⚪ Soon', color: 'var(--muted)' },
  ];
  const row = (t) => `
    <div class="triage-row" style="padding:8px 0;border-bottom:1px solid var(--border);">
      <div style="display:flex;align-items:flex-start;gap:8px;">
        <button title="Mark done" style="background:none;border:1px solid var(--border);border-radius:6px;width:22px;height:22px;cursor:pointer;flex-shrink:0;color:var(--muted);" onclick="triageDone('${escHtml(t.id)}', this)">✓</button>
        <div style="flex:1;min-width:0;">
          <div style="font-size:var(--fs-body);font-weight:600;">${escHtml(t.title)}</div>
          ${t.reason ? `<div style="font-size:var(--fs-small);color:var(--muted);margin-top:2px;">${escHtml(t.reason)}</div>` : ''}
          <div style="font-size:var(--fs-micro);margin-top:3px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
            ${t.action ? `<span style="color:var(--accent);">→ ${escHtml(t.action)}</span>` : ''}
            ${t.customerId
              ? `<button style="background:none;border:0;color:var(--accent);cursor:pointer;padding:0;font-size:var(--fs-micro);" onclick="openCustomerById('${escHtml(String(t.customerId))}')">👤 ${escName(t.customerName || 'open customer')}</button>`
              : (t.customerName ? `<span style="color:var(--muted);">👤 ${escName(t.customerName)}</span>` : '')}
          </div>
        </div>
      </div>
    </div>`;
  const groups = buckets.map((b) => {
    const list = (j.ranked || []).filter((t) => t.bucket === b.key);
    if (!list.length) return '';
    return `<div style="margin-bottom:14px;"><div class="section-divider" style="color:${b.color};">${b.label} <span style="color:var(--muted);font-weight:400;">· ${list.length}</span></div>${list.map(row).join('')}</div>`;
  }).join('');
  showDynamicModal(`
    <div class="modal-title">🧠 AI plan for your day</div>
    ${j.focus ? `<div style="background:var(--accent-wash);border:1px solid var(--primary-subdued);border-radius:10px;padding:10px 12px;margin-bottom:14px;font-size:var(--fs-body);"><strong>Start here:</strong> ${escHtml(j.focus)}</div>` : ''}
    <div style="max-height:420px;overflow:auto;">${groups || '<div style="color:var(--success);font-size:var(--fs-body);">Nothing open. 🎉</div>'}</div>
    <div style="font-size:var(--fs-micro);color:var(--muted);margin-top:8px;">An AI suggestion from your live task list — you decide. Ticking ✓ marks the task done.</div>
    <div class="modal-actions"><button class="btn btn-outline" onclick="closeDynamicModal()">Close</button><button class="btn btn-primary" onclick="openTaskTriageModal()">↻ Re-plan</button></div>
  `);
}
async function triageDone(id, btn) {
  try {
    const r = await window.api.updateTask({ id, done: true });
    if (r && (r.success || r.task)) {
      const rowEl = btn.closest('.triage-row');
      if (rowEl) rowEl.style.opacity = '0.45';
      btn.style.background = 'var(--success)'; btn.style.color = '#fff'; btn.disabled = true;
      if (Array.isArray(tasksList)) { const tk = tasksList.find((x) => String(x.id) === String(id)); if (tk) tk.done = true; }
      toast('Marked done.', 'success');
    } else toast('Could not update.', 'error');
  } catch { toast('Could not update.', 'error'); }
}

function suggestTaskPriority(t, todayISO) {
  if (t.done) return null;
  let s = null;
  const ref = t.reference || '';
  const daysUntilDue = t.dueDate
    ? Math.round((parseLocalDate(t.dueDate) - parseLocalDate(todayISO)) / 86400000)
    : null;

  if (ref.startsWith('OVERDUE-')) {
    s = { priority: 'High', reason: 'A phone is out past its return date — late fees are accruing and the handset is at risk.' };
  } else if (ref.startsWith('BALANCE-')) {
    const amt = parseFloat((t.title.match(/£(\d+(?:\.\d+)?)/) || [])[1]);
    s = Number.isFinite(amt) && amt >= 50
      ? { priority: 'High', reason: `${fmtGbp(amt)} outstanding — chase before it grows.` }
      : { priority: 'Normal', reason: 'Money owed — collect at the next visit.' };
  } else if (ref.startsWith('SIMDUE-')) {
    s = /KC pays/i.test(t.title)
      ? { priority: 'High', reason: 'KC pays this renewal — make sure the payment goes out and gets recharged.' }
      : { priority: 'Normal', reason: 'Customer-paid renewal — a quick check that it went through.' };
  } else if (ref.startsWith('PASSPORT-')) {
    s = daysUntilDue !== null && daysUntilDue <= 30
      ? { priority: 'High', reason: `Passport expires in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'} — travel is at risk.` }
      : { priority: 'Low', reason: 'Expiry is a while away — safe to park for now.' };
  } else if (daysUntilDue !== null && daysUntilDue < 0) {
    s = { priority: 'High', reason: `${-daysUntilDue} day${daysUntilDue === -1 ? '' : 's'} past its due date.` };
  } else if (daysUntilDue === 0) {
    s = { priority: 'High', reason: 'Due today.' };
  }

  if (!s) return null;
  if (s.priority === t.priority) return null;          // already there
  if (s.priority === t.suggestionRejected) return null; // was rejected — don't nag
  return s;
}

// Snoozed = parked until a future date; a passed date returns to the lanes.
function taskSnoozed(t, todayISO) {
  return !t.done && t.snoozedUntil && t.snoozedUntil > todayISO;
}

async function patchTask(patch) {
  const res = await window.api.updateTask(patch);
  if (!res.success) { toast(res.error || 'Could not update the task.', 'error'); return false; }
  return true;
}

async function acceptSuggestion(id, priority) {
  if (await patchTask({ id, priority })) {
    toast(`Moved to ${priority}.`, 'success');
    renderTasksTab();
  }
}

async function rejectSuggestion(id, priority) {
  if (await patchTask({ id, suggestionRejected: priority })) renderTasksTab();
}

async function setTaskPriority(id, priority) {
  if (await patchTask({ id, priority })) renderTasksTab();
}

// Natural-language date for the snooze/remind prompts. Accepts:
//   2026-08-03 · 3/8 or 03/08/2026 (UK day-first; past d/m rolls to next year)
//   today · tomorrow · 3d / 3 days · 2w / 2 weeks · next week · next month
//   weekday names or 3-letter prefixes ("sunday", "sun" → the NEXT one).
// Returns YYYY-MM-DD, or null when it can't tell.
function kcParseWhen(input, todayISO) {
  const s = String(input || '').trim().toLowerCase();
  if (!s) return null;
  const today = todayISO || localISO();
  const base = parseLocalDate(today);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  let m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (m) {
    const yr = m[3] ? Number(m[3].length === 2 ? '20' + m[3] : m[3]) : base.getFullYear();
    const d = new Date(base);
    d.setFullYear(yr, Number(m[2]) - 1, Number(m[1]));
    if (!m[3] && localISO(d) <= today) d.setFullYear(yr + 1);
    return localISO(d);
  }
  if (s === 'today') return today;
  if (s === 'tomorrow' || s === 'tmrw') { base.setDate(base.getDate() + 1); return localISO(base); }
  if (s === 'next week') { base.setDate(base.getDate() + 7); return localISO(base); }
  if (s === 'next month') { base.setMonth(base.getMonth() + 1); return localISO(base); }
  m = s.match(/^(?:in\s+)?(\d{1,3})\s*(?:d|day|days)$/);
  if (m) { base.setDate(base.getDate() + Number(m[1])); return localISO(base); }
  m = s.match(/^(?:in\s+)?(\d{1,2})\s*(?:w|wk|week|weeks)$/);
  if (m) { base.setDate(base.getDate() + Number(m[1]) * 7); return localISO(base); }
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const di = days.findIndex(d => d === s || d.slice(0, 3) === s);
  if (di >= 0) {
    const delta = ((di - base.getDay()) + 7) % 7 || 7; // always in the future
    base.setDate(base.getDate() + delta);
    return localISO(base);
  }
  return null;
}

async function snoozeTask(id, choice) {
  if (!choice) return;
  let until = null;
  const base = parseLocalDate(localISO());
  if (choice === 'tomorrow')  { base.setDate(base.getDate() + 1); until = localISO(base); }
  if (choice === '3days')     { base.setDate(base.getDate() + 3); until = localISO(base); }
  if (choice === 'nextweek')  { base.setDate(base.getDate() + 7); until = localISO(base); }
  if (choice === 'pick') {
    const d = prompt('Snooze until — a date (2026-08-03, 3/8) or “tomorrow”, “sunday”, “3d”, “next week”:',
      localISO(new Date(Date.now() + 14 * 86400000)));
    if (d == null || !String(d).trim()) return;
    until = kcParseWhen(d);
    if (!until) { toast('Couldn’t read that date — try 2026-08-03, 3/8, “tomorrow” or “sunday”.', 'error'); return; }
  }
  if (choice === 'wake') until = '';
  if (await patchTask({ id, snoozedUntil: until })) {
    toast(until ? `Snoozed until ${fmtDate(until)}.` : 'Task is back in the list.', 'success');
    renderTasksTab();
  }
}

async function renderTasksTab() {
  const content = document.getElementById('mainContent');
  content.innerHTML = skeletonHtml('tasks');
  tasksList = await window.api.getTasks();
  if (!Array.isArray(tasksList)) tasksList = [];

  const today = localISO();
  const tkBar = kcFilterSort('tasks', [
    { value: 'all', label: 'Filter: all tasks' },
    { value: 'manual', label: '✍️ Manual only', test: t => t.source === 'manual' },
    { value: 'auto', label: '🤖 Auto only', test: t => t.source !== 'manual' },
    { value: 'customer', label: '👤 With customer', test: t => !!t.customerId },
    { value: 'overdue', label: '⚠️ Overdue', test: t => t.dueDate && t.dueDate < today && !t.done },
  ], [
    { value: 'smart', label: 'Sort: Smart' },
    { value: 'due', label: 'Due date (soonest)', cmp: (a, b) => String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999')) },
    { value: 'recent', label: 'Recently added', cmp: kcCmpDate(t => t.createdAt || '', -1) },
    { value: 'az', label: 'A–Z', cmp: kcCmpStr(t => t.title) },
  ], renderTasksTab);
  const tkTasks = kcViewApply('tasks', tasksList);
  const doneTasks = tkTasks.filter(t => t.done);
  const snoozed = tkTasks.filter(t => taskSnoozed(t, today));
  const live = tkTasks.filter(t => !t.done && !taskSnoozed(t, today));
  const nowLane  = live.filter(t => t.priority === 'High' || (t.dueDate && t.dueDate <= today));
  const nextLane = live.filter(t => !nowLane.includes(t));
  const suggestions = live.map(t => [t, suggestTaskPriority(t, today)]).filter(([, s]) => s);

  const card = (t) => {
    const s = suggestTaskPriority(t, today);
    const overdueDue = t.dueDate && t.dueDate < today;
    // #62 — a chase task you can act on in place: deep-link the customer and,
    // for money tasks, drop the payment modal right onto the card.
    const isMoneyTask = t.customerId && /£|owes|balance|arrears|\bpay\b/i.test(t.title || '');
    const isChaseTask = isMoneyTask || (t.customerId && /^(BALANCE|OVERDUE)-/.test(t.reference || ''));
    const chaseCust = isChaseTask ? customers.find(c => c.id === t.customerId) : null;
    const custLabel = t.customerName
      ? (t.customerId
          ? `<span class="dash-link" style="color:var(--accent);cursor:pointer;" onclick="goToTab('customers',{customerId:'${escHtml(String(t.customerId))}'})">👤 ${escName(t.customerName)}</span> · `
          : '👤 ' + escName(t.customerName) + ' · ')
      : '';
    return `
    <div class="task-card${t.done ? ' task-done' : ''}">
      <div style="display:flex;align-items:flex-start;gap:10px;">
        <input type="checkbox" ${t.done ? 'checked' : ''} style="margin-top:3px;cursor:pointer;"
          aria-label="Mark done: ${escHtml(t.title || 'task')}"
          onchange="toggleTaskDone('${escHtml(t.id)}', this.checked)">
        <div style="flex:1;min-width:0;">
          <div class="history-desc" style="${t.done ? 'text-decoration:line-through;' : ''}">${escHtml(t.title)}</div>
          <div style="font-size:var(--fs-micro);color:var(--muted);margin-top:2px;">
            ${custLabel}${t.source !== 'manual' ? '🤖 auto · ' : ''}${t.dueDate ? `<span style="${overdueDue && !t.done ? 'color:var(--danger-ink);font-weight:600;' : ''}">due ${fmtDate(t.dueDate)}</span>` : ''}
          </div>
          ${t.notes ? `<div style="font-size:var(--fs-small);color:var(--text);margin-top:5px;white-space:pre-line;line-height:1.5;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:6px 10px;">${escHtml(t.notes)}</div>` : ''}
        </div>
        ${taskPriorityBadge(t.priority)}
      </div>
      ${!t.done ? `
      <div class="task-actions">
        ${/^New signup:/i.test(t.title || '') && !t.customerId ? `<button class="btn btn-primary btn-sm" style="font-size:var(--fs-micro);padding:3px 10px;" onclick="addCustomerFromTask('${escHtml(t.id)}')">➕ Add as customer</button>` : ''}
        ${isMoneyTask ? `<button class="btn btn-outline btn-sm" style="font-size:var(--fs-micro);padding:3px 10px;" onclick="openWalletModal('${escHtml(String(t.customerId))}')">💰 Record</button>` : ''}
        ${chaseCust && waLink(chaseCust, '') ? `<button class="btn btn-outline btn-sm" style="font-size:var(--fs-micro);padding:3px 10px;" onclick="waChaseCustomer('${escHtml(String(t.customerId))}')" title="Open a chase message in WhatsApp">💬 WhatsApp</button>` : ''}
        <select class="task-mini" onchange="setTaskPriority('${escHtml(t.id)}', this.value)" title="Priority">
          ${['High', 'Normal', 'Low'].map(p => `<option value="${p}" ${t.priority === p ? 'selected' : ''}>${p === 'High' ? '🔥 Now' : p === 'Normal' ? '📋 Next' : '🌙 Later'}</option>`).join('')}
        </select>
        <select class="task-mini" onchange="snoozeTask('${escHtml(t.id)}', this.value); this.value='';" title="Postpone">
          <option value="">💤 Snooze…</option>
          <option value="tomorrow">Until tomorrow</option>
          <option value="3days">3 days</option>
          <option value="nextweek">Next week</option>
          <option value="pick">Pick a date…</option>
        </select>
      </div>` : ''}
      ${s && !t.done ? `
      <div class="task-suggest">
        <span>💡 Suggests <strong>${s.priority === 'High' ? '🔥 Now' : s.priority === 'Normal' ? '📋 Next' : '🌙 Later'}</strong> — ${escHtml(s.reason)}</span>
        <span class="task-suggest-actions">
          <button class="btn btn-primary btn-sm" style="font-size:var(--fs-micro);padding:3px 10px;"
            onclick="acceptSuggestion('${escHtml(t.id)}', '${s.priority}')">✓ Accept</button>
          <button class="btn btn-outline btn-sm" style="font-size:var(--fs-micro);padding:3px 10px;"
            onclick="rejectSuggestion('${escHtml(t.id)}', '${s.priority}')">✕ Keep ${escHtml(t.priority)}</button>
        </span>
      </div>` : ''}
    </div>`;
  };

  const snoozeCard = (t) => `
    <div class="task-card" style="opacity:0.75;">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:15px;">💤</span>
        <div style="flex:1;min-width:0;">
          <div class="history-desc">${escHtml(t.title)}</div>
          <div style="font-size:var(--fs-micro);color:var(--muted);">wakes ${fmtDate(t.snoozedUntil)}</div>
        </div>
        <button class="btn btn-outline btn-sm" style="font-size:var(--fs-micro);padding:3px 10px;"
          onclick="snoozeTask('${escHtml(t.id)}', 'wake')">⏰ Wake now</button>
      </div>
    </div>`;

  const lane = (title, list, empty) => `
    <div class="table-card" style="padding:8px 16px 12px;">
      <div class="section-divider" style="margin-top:10px;">${title} <span style="color:var(--muted);font-weight:400;">· ${list.length}</span></div>
      ${list.length ? list.map(card).join('') : `<div style="color:var(--muted);font-size:var(--fs-body);padding:8px 0;">${empty}</div>`}
    </div>`;

  content.innerHTML = `
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">🔥 Now</div><div class="stat-value" style="color:${nowLane.length ? 'var(--danger-ink)' : 'var(--success)'};">${nowLane.length}</div></div>
      <div class="stat-card"><div class="stat-label">📋 Next</div><div class="stat-value">${nextLane.length}</div></div>
      <div class="stat-card"><div class="stat-label">💤 Snoozed</div><div class="stat-value">${snoozed.length}</div></div>
      <div class="stat-card"><div class="stat-label">💡 Suggestions</div><div class="stat-value" style="color:${suggestions.length ? 'var(--accent)' : 'var(--text)'};">${suggestions.length}</div>
        ${suggestions.length ? '<div class="stat-sub">awaiting your call</div>' : '<div class="stat-sub">all agreed</div>'}</div>
    </div>
    <div class="table-card" style="padding:14px;margin-bottom:14px;">
      <!-- flex-wrap + a real flex-basis on the title: with flex:1 (basis 0)
           and three fixed-width siblings, the box you actually type in
           was the one that collapsed — 10px wide at 390px. -->
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <input class="form-input" id="tkTitle" placeholder="Add a task…" style="flex:1 1 200px;min-width:180px;"
          onkeydown="if(event.key==='Enter')saveNewTask()">
        <input class="form-input" type="date" id="tkDue" style="width:150px;" aria-label="Due date for the new task">
        <select class="form-input" id="tkPriority" style="width:110px;" aria-label="Priority for the new task">
          <option value="Normal">Normal</option>
          <option value="High">High</option>
          <option value="Low">Low</option>
        </select>
        <button class="btn btn-primary" onclick="saveNewTask()">+ Add</button>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
      <button class="btn btn-outline" onclick="openTaskTriageModal()" title="Let AI read your whole open list and rank what to do first, and why">🧠 AI plan my day</button>
      ${tkBar}
    </div>
    <div class="dash-cols">
      ${lane('🔥 Now — do these first', nowLane, 'Nothing urgent. 🎉')}
      ${lane('📋 Next — when the counter is quiet', nextLane, 'Nothing queued.')}
    </div>
    ${snoozed.length ? `
    <div class="table-card" style="padding:8px 16px 12px;margin-top:16px;">
      <div class="section-divider" style="margin-top:10px;">💤 Snoozed <span style="color:var(--muted);font-weight:400;">· ${snoozed.length}</span></div>
      ${snoozed.map(snoozeCard).join('')}
    </div>` : ''}
    ${doneTasks.length ? `
    <div class="table-card" style="padding:8px 16px 12px;margin-top:16px;">
      <div class="section-divider" style="margin-top:10px;">✓ Completed <span style="color:var(--muted);font-weight:400;">· ${doneTasks.length}</span></div>
      ${doneTasks.slice(0, 10).map(card).join('')}
    </div>` : ''}`;
}

async function saveNewTask() {
  const title = document.getElementById('tkTitle').value.trim();
  if (!title) { toast('Type a task first.', 'error'); return; }
  const res = await window.api.addTask({
    title,
    dueDate: document.getElementById('tkDue').value,
    priority: document.getElementById('tkPriority').value,
  });
  if (!res.success) { toast(res.error || 'Could not add the task.', 'error'); return; }
  renderTasksTab();
}

async function toggleTaskDone(id, done) {
  const res = await window.api.updateTask({ id, done });
  if (!res.success) { toast(res.error || 'Could not update the task.', 'error'); }
  // The card jumps lanes on re-render — say where it went so it doesn't feel
  // like it vanished, and how to get it back.
  else if (done) toast('Done ✓ — moved to “✓ Completed” at the bottom of this page. Untick it there to bring it back.', 'success');
  renderTasksTab();
}

// "New signup:" tasks → open the customer form prefilled from the task, so
// approving a signup is one click + a check of the details. The task itself
// stays open until it's ticked, so nothing disappears mid-flow.
function addCustomerFromTask(id) {
  const t = tasksList.find(x => x.id === id);
  if (!t) return;
  const name = (t.title || '').replace(/^New signup:\s*/i, '').trim();
  const [firstName, ...rest] = name.split(/\s+/);
  const phone = (t.notes || '').match(/Phone:\s*([^\n]+)/i)?.[1]?.trim() || '';
  const email = (t.notes || '').match(/Email:\s*([^\n]+)/i)?.[1]?.trim() || '';
  const asked = (t.notes || '').match(/Asked for:\s*([^\n]+)/i)?.[1]?.trim() || '';
  openAddModal();
  document.getElementById('fFirstName').value = firstName || '';
  document.getElementById('fLastName').value = rest.join(' ');
  document.getElementById('fEmail').value = email;
  const codes = ['+972', '+44', '+1-CA', '+1', '+33', '+49', '+43', '+41', '+32', '+31', '+61', '+55', '+52', '+54', '+27'];
  let code = '+44', phoneNum = phone;
  for (const cc of codes) {
    const plain = cc.replace('-CA', '');
    if (phoneNum.startsWith(plain)) { code = cc; phoneNum = phoneNum.slice(plain.length).trim(); break; }
  }
  document.getElementById('fCountryCode').value = code;
  document.getElementById('fPhoneNumber').value = phoneNum;
  const fNotes = document.getElementById('fNotes');
  if (fNotes && asked) fNotes.value = `Signup request: ${asked}`;
  toast('Details filled in from the signup — check them, then Save. Tick the task when you’re done.', 'success');
}

// ─────────────────────────────────────────────
//  DASHBOARD (business overview)
// ─────────────────────────────────────────────
// Stripi layout: featured dark-navy money card (the brand's featured-tier
// treatment) + thin-display metric cards, over a two-column feed.

// Dashboard deep-links: every "needs attention" line jumps to the page where
// the problem can actually be dealt with. Uses the real sidebar click so the
// active nav state stays consistent.
let dashFeedActions = [];
function goToTab(tab, opts = {}) {
  if (opts.rentalSearch !== undefined) {
    rentalSearchTerm = opts.rentalSearch;
    kcView('rentals').dims = { balance: 'all', status: 'all' };
  }
  document.querySelector(`.nav-item[data-tab="${tab}"]`)?.click();
  // Customers tab renders synchronously from memory; open the detail after it.
  if (opts.customerId) setTimeout(() => {
    selectedId = opts.customerId;
    renderDetailPanel(opts.customerId);
    document.querySelectorAll('tr[data-id]').forEach(r =>
      r.classList.toggle('selected', r.dataset.id === String(opts.customerId)));
  }, 120);
}

// Hebrew calendar string for a Date (gematria day + month + gematria year).
function hebrewDateString(d) {
  try {
    const parts = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
      day: 'numeric', month: 'long', year: 'numeric'
    }).formatToParts(d);
    const dayNum   = parseInt(parts.find(p => p.type === 'day')?.value || '0');
    const monthStr = parts.find(p => p.type === 'month')?.value || '';
    const yearNum  = parseInt(parts.find(p => p.type === 'year')?.value || '0');
    return numToHebrew(dayNum) + ' ' + monthStr + ' ' + numToHebrew(yearNum);
  } catch (e) { return ''; }
}

// The dashboard paints INSTANTLY from what's already in memory (rentals,
// phones, sims, bookings, repairs) plus the last-known money/tasks, then
// repaints once the fresh ledger + tasks arrive. No blank "Loading…" wait.
let dashCache = { money: null, tasks: null, shop: null, returns: null };

async function renderDashboardTab() {
  dashPaint(dashCache.money, dashCache.tasks, dashCache.money === null, dashCache.shop, dashCache.returns);

  const today = localISO();
  const [ledgerSummary, tasksData, shopData, retData] = await Promise.all([
    kcFetch('/api/ledger?since=' + today).then(r => r.ok ? r.json() : null).catch(() => null),
    window.api.getTasks().catch(() => []),
    kcFetch('/api/shop').then(r => r.ok ? r.json() : null).catch(() => null),
    kcFetch('/api/supplier-returns').then(r => r.ok ? r.json() : null).catch(() => null),
  ]);
  dashCache = {
    money: ledgerSummary?.success ? ledgerSummary : dashCache.money,
    tasks: Array.isArray(tasksData) ? tasksData : (dashCache.tasks || []),
    shop: shopData?.success ? shopData.items : dashCache.shop,
    returns: retData?.success ? retData.returns : dashCache.returns,
  };
  if (currentTab === 'dashboard') dashPaint(dashCache.money, dashCache.tasks, false, dashCache.shop, dashCache.returns);
}

function dashPaint(money, tasksList2, stillLoading, shopList, returnsList) {
  const content = document.getElementById('mainContent');
  const now = new Date();
  const today = localISO(now);
  const in7 = localISO(new Date(Date.now() + 7 * 86400000));
  const reps = repairs;
  const tks = tasksList2 || [];

  const activeRentals = rentals.filter(r => r.status !== 'returned');
  const overdue = activeRentals.filter(r => r.toDate && r.toDate < today);
  const dueToday = activeRentals.filter(r => r.toDate === today);
  const openRepairs = reps.filter(r => r.status === 'Open' || r.status === 'In Progress');
  const readyRepairs = reps.filter(r => r.status === 'Ready');
  const travel7 = bookings.filter(b => b.status !== 'Cancelled' && b.travelDate >= today && b.travelDate <= in7);
  const renewals7 = sims.filter(s => s.status === 'active' && s.renewalDate && s.renewalDate >= today && s.renewalDate <= in7);
  // Snoozed tasks are deliberately parked — keep them off the dashboard.
  const openTasks = tks.filter(t => !t.done && !(t.snoozedUntil && t.snoozedUntil > today));
  const highTasks = openTasks.filter(t => t.priority === 'High');

  const arrears = money ? money.arrears : [];
  const arrearsTotal = money ? Math.abs(money.arrearsTotal) : 0;

  // ── Header: date (EN + Hebrew) · greeting · quick actions ──
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const staffFirstName = (currentStaff?.full_name || '').trim().split(/\s+/)[0]
    || (currentStaff?.email || '').split('@')[0] || '';
  const enDate = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const hebDate = hebrewDateString(now);
  const pad2 = (n) => String(n).padStart(2, '0');
  const clockHM = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  const clockSS = pad2(now.getSeconds());
  // One global 1s ticker keeps the dashboard clock live: the pulse dot beats
  // and the seconds tick beside it. No-ops when off the dashboard.
  if (!window.__dashClockTimer) {
    window.__dashClockTimer = setInterval(() => {
      const el = document.getElementById('dashClock'); if (!el) return;
      const d = new Date(), p = (n) => String(n).padStart(2, '0');
      const b = el.querySelector('b');
      if (b) b.textContent = `${p(d.getHours())}:${p(d.getMinutes())}`;
      const s = el.querySelector('.dash-secs');
      if (s) s.textContent = p(d.getSeconds());
    }, 1000);
  }

  // ── Featured money card (dark navy) ──
  const heroHtml = `
    <div class="dash-hero">
      <div class="dash-hero-label">Money in today</div>
      <div class="dash-hero-value">${stillLoading ? '…' : (money ? fmtGbp(money.todayIn) : '£0.00')}</div>
      <div class="dash-hero-sub">${money && money.todayOut ? fmtGbp(Math.abs(money.todayOut)) + ' charged out today' : (stillLoading ? '&nbsp;' : 'no charges yet today')}</div>
      <div class="dash-hero-divider"></div>
      <div class="dash-hero-label">Outstanding</div>
      <div class="dash-hero-value" style="font-size:var(--fs-hero);letter-spacing:-0.28px;">${stillLoading ? '…' : fmtGbp(arrearsTotal)}</div>
      <div class="dash-hero-sub">${arrears.length ? arrears.length + ' customer' + (arrears.length === 1 ? '' : 's') + ' in arrears' : (stillLoading ? '&nbsp;' : 'nobody owes money 🎉')}</div>
      ${arrears.length ? `<div class="dash-hero-divider"></div>` +
        arrears.slice(0, 8).map(a => `
          <div class="dash-hero-row${a.customerId ? ' dash-link' : ''}"${a.customerId
            ? ` onclick="goToTab('customers',{customerId:'${escHtml(String(a.customerId))}'})" title="Open ${escName(a.customerName)}"` : ''}>
            <span>${escName(a.customerName)}${a.customerId ? '' : ' <span style="color:var(--muted);font-size:var(--fs-micro);">(walk-in)</span>'}</span>
            <span class="amt">${fmtGbp(Math.abs(a.balance))}${a.customerId ? ' <span class="feed-go" style="opacity:1;">›</span>' : ''}</span>
          </div>`).join('') +
        (arrears.length > 8 ? `<div class="dash-hero-row dash-link" onclick="goToTab('wallet')" title="Open the wallet"
            style="color:var(--muted);"><span>+ ${arrears.length - 8} more in arrears</span><span class="amt">see all ›</span></div>` : '') : ''}
    </div>`;

  // ── Metric cards (each links to its tab) ──
  const metric = (label, value, sub, tab, valueStyle = '') => `
    <div class="stat-card dash-link" onclick="goToTab('${tab}')" title="Open ${tab}">
      <div class="stat-label">${label}</div>
      <div class="stat-value" ${valueStyle ? `style="${valueStyle}"` : ''}>${value}</div>
      ${sub ? `<div class="stat-sub">${sub}</div>` : ''}
    </div>`;

  const metricsHtml = `
    <div class="dash-metrics">
      ${metric('Active Rentals', activeRentals.length,
        [overdue.length ? `<span style="${statBandStyle('overdue', overdue.length) || 'color:var(--danger-ink);'}">${overdue.length} overdue</span>` : '',
         dueToday.length ? `${dueToday.length} due today` : ''].filter(Boolean).join(' · ') || 'all on schedule', 'rentals')}
      ${metric('Open Repairs', openRepairs.length,
        readyRepairs.length ? `<span style="color:var(--accent);">${readyRepairs.length} ready to collect</span>` : 'nothing waiting', 'repairs')}
      ${/* Just 'Flights': its own sub-line already says 'N flights this week',
           and the qualifier was the only stat label long enough to wrap — two
           lines at 390px, which left the card 16px taller than the one beside
           it. Matches Active Rentals / Open Repairs / Open Tasks. */''}
      ${metric('Flights', travel7.length,
        `${travel7.length === 1 ? '1 flight' : travel7.length + ' flights'} this week${renewals7.length
          ? ` · <span class="dash-link" style="color:var(--gold);" onclick="event.stopPropagation();goToTab('sim')">${renewals7.length} SIM renewal${renewals7.length === 1 ? '' : 's'} ›</span>` : ''}`,
        'bookings')}
      ${metric('Open Tasks', openTasks.length,
        highTasks.length ? `<span style="${statBandStyle('highTasks', highTasks.length) || 'color:var(--danger-ink);'}">${highTasks.length} high priority</span>` : 'none urgent', 'tasks',
        statBand('highTasks', highTasks.length) === 'clear' ? '' : statBandStyle('highTasks', highTasks.length))}
    </div>`;

  // ── Needs-attention feed — each line deep-links to its problem page.
  // Handlers live in dashFeedActions (closures), not inline strings, so
  // customer names with quotes can't break the HTML.
  const attention = [];
  overdue.forEach(r => attention.push(['📱',
    `<strong>${escName(r.customerName || '?')}</strong> — rental overdue since ${fmtDate(r.toDate)}`,
    () => goToTab('rentals', { rentalSearch: r.customerName || '' })]));
  readyRepairs.forEach(r => attention.push(['🔧',
    `<strong>${escName(r.customerName || '?')}</strong> — repair ready to collect (${fmtGbp((r.total || 0))})`,
    () => goToTab('repairs')]));
  travel7.forEach(b => attention.push(['✈️',
    `<strong>${escName(b.customerName || '?')}</strong> — flies ${fmtDate(b.travelDate)} (${escHtml(b.route)})`,
    () => goToTab('bookings')]));
  // Straight to the plan that is renewing, not to the list of every plan.
  // The line names one SIM, so landing on the tab and leaving you to find it
  // again is the app forgetting what you just clicked.
  renewals7.forEach(s => attention.push(['💳',
    `<strong>${escName(s.customerName || '?')}</strong> — SIM renews ${fmtDate(s.renewalDate)}`,
    () => openOnTab('sim', () => openManageSimModal(s.id))]));
  // Low-stock accessories/phones (display-only; the Shop tab holds the editable
  // per-SKU threshold + the full list). One rolled-up line → opens Shop.
  const lowStock = (shopList || []).filter(i => i.active && i.quantity <= i.lowStockAt);
  if (lowStock.length) {
    const names = lowStock.slice(0, 3).map(i => `${escHtml(i.model)} (${i.quantity})`).join(', ');
    attention.push(['📦',
      `<strong>${lowStock.length} item${lowStock.length === 1 ? '' : 's'} low on stock</strong> — ${names}${lowStock.length > 3 ? ` + ${lowStock.length - 3} more` : ''}`,
      () => goToTab('shop')]);
  }
  // Open supplier returns: the bag of defective stock waiting to go back.
  // One rolled-up line (like low stock) so it nags until the supplier settles.
  const openRets = (returnsList || []).filter(r => SUPPLIER_RETURN_OPEN.includes(r.status));
  if (openRets.length) {
    const claim = openRets.reduce((s, r) => s + (r.claimedValue || 0), 0);
    const names = [...new Set(openRets.map(r => r.supplierName).filter(Boolean))].slice(0, 2).map(escHtml).join(', ');
    attention.push(['📤',
      `<strong>${openRets.length} return${openRets.length === 1 ? '' : 's'} to supplier open</strong>${claim ? ` — ${fmtGbp(claim)} claimed` : ''}${names ? ` (${names})` : ''}`,
      () => goToTab('shop')]);
  }
  highTasks.slice(0, 5).forEach(t => attention.push(['❗', escHtml(t.title), () => goToTab('tasks')]));

  const shown = attention.slice(0, 10);
  dashFeedActions = shown.map(a => a[2]);
  const attentionHtml = shown.length === 0
    ? `<div style="color:var(--muted);font-size:var(--fs-body);padding:8px 0;">All clear. 🎉</div>`
    : shown.map(([icon, html], i) => `
        <div class="feed-item dash-link" onclick="dashFeedActions[${i}]()" title="Open">
          <span class="feed-icon">${icon}</span><span>${html}</span>
          <span class="feed-go">›</span>
        </div>`).join('');

  // Each row deep-links to its customer (same as the wallet tab's feed).
  const activityHtml = !money || money.recent.length === 0
    ? `<div style="color:var(--muted);font-size:var(--fs-body);padding:8px 0;">No wallet activity yet.</div>`
    : money.recent.slice(0, 8).map(e => `
        <div class="history-item history-flat${e.customerId ? ' dash-link' : ''}"
          ${e.customerId ? `onclick="goToTab('customers',{customerId:'${escHtml(String(e.customerId))}'})" title="Open customer"` : ''}>
          <div class="history-main">
            <div class="history-dot ${e.amount >= 0 ? 'dot-green' : 'dot-blue'}"></div>
            <div class="history-desc kc-clamp-2">
              ${escName(e.customerName || '—')} · ${LEDGER_TYPE_LABELS[e.type] || escHtml(e.type)}${e.description ? ' · ' + escHtml(e.description) : ''}</div>
          </div>
          <div class="history-date" style="margin:0 12px;">${fmtDate(e.at)}</div>
          <div class="history-amount" style="color:${e.amount >= 0 ? 'var(--success)' : 'var(--text)'};">
            ${e.amount >= 0 ? '+' : '−'}${fmtGbp(Math.abs(e.amount))}</div>
          ${e.customerId ? '<span class="feed-go">›</span>' : ''}
        </div>`).join('') + `
        <div class="feed-item dash-link" onclick="goToTab('wallet')" style="color:var(--muted);font-size:var(--fs-small);">
          <span class="feed-label">Full ledger &amp; today's money</span><span class="feed-go">›</span>
        </div>`;

  content.innerHTML = `
    <div class="dash-head">
      <div>
        <div class="dash-date"><span class="dash-clock" id="dashClock" title="Current time"><b>${clockHM}</b><span class="dash-pulse" aria-hidden="true"></span><span class="dash-secs" id="dashSecs">${clockSS}</span></span>&nbsp;·&nbsp;${enDate}${hebDate ? ` &nbsp;·&nbsp; <span class="heb">${hebDate}</span>` : ''}</div>
        <div class="dash-greeting">${greeting}${staffFirstName ? ', ' + nameHtml(staffFirstName) : ''}.</div>
      </div>
      <div class="dash-actions">
        <button class="btn btn-outline" onclick="renderDashboardTab()" title="Reload today's money & tasks">↻ Refresh</button>
        ${(!currentStaff || currentStaff.role === 'owner') ? `<button class="btn btn-outline" onclick="openBusinessSummary()" title="Revenue by service — this week & month">📊 Summary</button>` : ''}
        <button class="btn btn-outline" onclick="openNewRentalModal()">📱 New Rental</button>
        <button class="btn btn-outline" onclick="openNewBookingModal()">✈️ New booking</button>
        <button class="btn btn-outline" onclick="(async()=>{repairMenu=await window.api.getServiceMenu('repair');openNewRepairModal()})()">🔧 New Repair</button>
        <button class="btn btn-outline" onclick="document.querySelector('[data-tab=customers]').click();setTimeout(()=>document.getElementById('btnNewCustomer')?.click(),100)">👤 New customer</button>
      </div>
    </div>

    <div class="dash-grid">
      ${heroHtml}
      ${metricsHtml}
    </div>

    <div class="dash-cols">
      <div class="table-card" style="padding:8px 18px 14px;">
        <div class="section-divider" style="margin-top:12px;">Needs attention</div>
        ${attentionHtml}
      </div>
      <div class="table-card" style="padding:8px 18px 14px;">
        <div class="section-divider" style="margin-top:12px;">Recent wallet activity</div>
        <div>${activityHtml}</div>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────
//  VIRTUAL NUMBERS
// ─────────────────────────────────────────────

let virtualNumbers = [];
let vnPriceMatrix = []; // bundle price matrix (also drives the billing modal)

async function renderVirtualTab() {
  const content = document.getElementById('mainContent');
  content.innerHTML = skeletonHtml('virtual');
  try {
    [virtualNumbers, vnPriceMatrix] = await Promise.all([
      window.api.getVirtualNumbers(),
      kcFetch('/api/vn-prices').then(r => r.ok ? r.json() : []).catch(() => []),
    ]);
  } catch { content.innerHTML = errorHtml('Couldn’t load virtual numbers'); return; }
  if (!Array.isArray(virtualNumbers)) virtualNumbers = [];
  if (!Array.isArray(vnPriceMatrix)) vnPriceMatrix = [];

  const active = virtualNumbers.filter(v => v.status === 'Active');
  const vnBar = kcFilterSort('virtual', [
    { value: 'all', label: 'Filter: all numbers' },
    { value: 'active', label: '✅ Active', test: v => v.status === 'Active' },
    { value: 'inactive', label: '⏸ Inactive', test: v => v.status !== 'Active' },
    { value: 'billing', label: '💷 Billing on', test: v => v.billingEnabled && v.monthlyPrice },
  ], [
    { value: 'number', label: 'Sort: Number', cmp: kcCmpStr(v => v.number) },
    { value: 'name', label: 'Customer A–Z', cmp: kcCmpStr(v => v.customerName) },
    { value: 'monthly', label: 'Monthly (high–low)', cmp: kcCmpNum(v => v.monthlyPrice || 0) },
    { value: 'platform', label: 'Platform', cmp: kcCmpStr(v => v.platform) },
    { value: 'recent', label: 'Recently added', cmp: kcCmpDate(v => v.createdAt || '', -1) },
  ], renderVirtualTab);
  const vnShown = kcViewApply('virtual', virtualNumbers);
  const rows = vnShown.length === 0
    ? `<tr><td colspan="7"><div class="empty-state"><div class="emoji">🔢</div><p>${virtualNumbers.length ? 'No numbers match this filter.' : 'No virtual numbers yet.'}</p>${kcClearFiltersBtn('virtual')}</div></td></tr>`
    : vnShown.map(v => `
      <tr>
        <td class="kc-phone"><strong>${escHtml(fmtPhone(v.number))}</strong></td>
        <td>${escName(v.customerName || '—')}</td>
        <td>${providerBadge(v.platform)}</td>
        <td>${v.billingEnabled && v.monthlyPrice
          ? `<strong>${fmtGbp(v.monthlyPrice)}</strong><div class="customer-email">next ${fmtDate(v.nextBillingDate) || '—'}</div>`
          : '<span style="color:var(--muted);">—</span>'}</td>
        <td><span class="badge" style="${v.status === 'Active'
          ? 'background:rgba(34,197,94,0.15);color:var(--success-ink);'
          : 'background:rgba(148,163,184,0.15);color:var(--muted);'}">${escHtml(v.status)}</span></td>
        <td>${v.shortcutUrl ? `<a href="${escHtml(v.shortcutUrl)}" target="_blank" rel="noopener" style="color:var(--accent);font-size:var(--fs-small);">open ↗</a>` : '—'}</td>
        <td style="white-space:nowrap;">
          <button class="action-btn" style="font-size:var(--fs-micro);padding:4px 10px;"
            onclick="openRemindModal('vn','${escHtml(v.id)}')" title="Remind me">⏰</button>
          <button class="action-btn" style="font-size:var(--fs-micro);padding:4px 10px;"
            onclick="openVNBillingModal('${escHtml(v.id)}')">💷 Billing</button>
          <button class="action-btn" style="font-size:var(--fs-micro);padding:4px 10px;"
            onclick="toggleVNStatus('${escHtml(v.id)}', '${v.status === 'Active' ? 'Inactive' : 'Active'}')">
            ${v.status === 'Active' ? '⏸ Deactivate' : '▶ Activate'}</button>
          <button class="action-btn danger" style="font-size:var(--fs-micro);padding:4px 10px;"
            aria-label="Delete this number" onclick="deleteVN('${escHtml(v.id)}', '${escHtml(v.number)}')">✕</button>
        </td>
      </tr>`).join('');

  content.innerHTML = `
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">Total Numbers</div><div class="stat-value">${virtualNumbers.length}</div></div>
      <div class="stat-card"><div class="stat-label">Active</div><div class="stat-value" style="color:var(--success);">${active.length}</div></div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
      ${vnBar}
      <button class="btn btn-primary" onclick="openNewVNModal()">+ New virtual number</button>
    </div>
    <div class="table-card">
      <table>
        <thead><tr><th>Number</th><th>Customer</th><th>Platform</th><th>Monthly</th><th>Status</th><th>Shortcut</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${vnPriceMatrix.length ? `
    <div class="table-card" style="margin-top:16px;">
      <div class="section-divider" style="margin:12px 14px 4px;">💷 Bundle price reference <span style="color:var(--muted);font-weight:400;">· per month · customer price list</span></div>
      <table>
        <thead><tr><th>Bundle</th><th>Incoming only</th><th>+100 outgoing</th><th>Unlimited</th><th>PAYG</th></tr></thead>
        <tbody>${vnPriceMatrix.map(p => `
          <tr>
            <td><strong>${escHtml(p.label)}</strong></td>
            <td>${p.incomingOnly === null ? '—' : fmtGbp(p.incomingOnly)}</td>
            <td>${p.outgoing100 === null ? '—' : fmtGbp(p.outgoing100)}</td>
            <td>${p.unlimited === null ? '—' : fmtGbp(p.unlimited)}</td>
            <td>${p.paygBase === null ? '—' : fmtGbp(p.paygBase) + ' + rates'}</td>
          </tr>`).join('')}</tbody>
      </table>
    </div>` : ''}`;
}

function openNewVNModal(preselectCustomerId) {
  const customerOptions = customers.map(c =>
    `<option value="${c.id}" ${preselectCustomerId === c.id ? 'selected' : ''}>${escName(c.firstName)} ${escName(c.lastName)}</option>`
  ).join('');
  showDynamicModal(`
    <div class="modal-title">🔢 New Virtual Number</div>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Number *</label>
        <input class="form-input" id="vnNumber" type="tel" inputmode="tel" dir="ltr" placeholder="+1 732 555 0123">
      </div>
      <div class="form-group">
        <label class="form-label">Customer</label>
        <select class="form-input" id="vnCustomer">
          <option value="">— unassigned —</option>${customerOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Platform / IVR provider</label>
        <select class="form-input" id="vnPlatform">
          ${ivrPlatforms().map(p => `<option value="${escHtml(p)}">${escHtml(p)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Shortcut URL</label>
        <input class="form-input" id="vnShortcut" placeholder="https://…">
      </div>
      <div class="form-group form-full">
        <label class="form-label">Notes</label>
        <input class="form-input" id="vnNotes">
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeDynamicModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveNewVN()">🔢 Save</button>
    </div>
  `);
}

async function saveNewVN() {
  const number = document.getElementById('vnNumber').value.trim();
  if (!number) { toast('Number is required.', 'error'); return; }
  const res = await window.api.addVirtualNumber({
    number,
    customerId: document.getElementById('vnCustomer').value || null,
    platform: document.getElementById('vnPlatform').value,
    shortcutUrl: document.getElementById('vnShortcut').value.trim(),
    notes: document.getElementById('vnNotes').value.trim(),
  });
  if (!res.success) { toast(res.error || 'Could not save.', 'error'); return; }
  closeDynamicModal();
  toast(`Virtual number ${number} saved ✔`, 'success');
  renderVirtualTab();
}

// ── VN monthly billing (price list bundle matrix drives the price) ──

const VN_PLAN_LABELS = {
  incoming_only: 'Incoming only', outgoing_100: '+100 outgoing',
  unlimited: 'Unlimited', payg: 'PAYG (base + rates)',
};

function vnBundlePriceFor(bundleLabel, plan) {
  const b = vnPriceMatrix.find(x => x.label === bundleLabel);
  if (!b) return null;
  return { incoming_only: b.incomingOnly, outgoing_100: b.outgoing100,
           unlimited: b.unlimited, payg: b.paygBase }[plan] ?? null;
}

function vnBillingPricePrefill() {
  const bundle = document.getElementById('vbBundle')?.value;
  const plan = document.getElementById('vbPlan')?.value;
  const price = vnBundlePriceFor(bundle, plan);
  if (price !== null && price !== undefined) {
    document.getElementById('vbPrice').value = price.toFixed(2);
  }
}

function openVNBillingModal(id) {
  const v = virtualNumbers.find(x => x.id === id);
  if (!v) return;
  const bundleOptions = ['<option value="">— custom / none —</option>']
    .concat(vnPriceMatrix.map(p =>
      `<option value="${escHtml(p.label)}" ${v.bundleLabel === p.label ? 'selected' : ''}>${escHtml(p.label)}</option>`))
    .join('');
  const planOptions = Object.entries(VN_PLAN_LABELS).map(([k, label]) =>
    `<option value="${k}" ${v.plan === k ? 'selected' : ''}>${label}</option>`).join('');
  showDynamicModal(`
    <div class="modal-title">💷 Monthly Billing — ${escHtml(fmtPhone(v.number))}</div>
    <div style="color:var(--muted);font-size:var(--fs-body);margin-bottom:14px;">
      ${v.customerName ? `Customer: <strong style="color:var(--text);">${escName(v.customerName)}</strong>` :
        '<span style="color:var(--danger-ink);">⚠ No customer assigned — billing needs one.</span>'}
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Bundle</label>
        <select class="form-input" id="vbBundle" onchange="vnBillingPricePrefill()">${bundleOptions}</select>
      </div>
      <div class="form-group">
        <label class="form-label">Plan</label>
        <select class="form-input" id="vbPlan" onchange="vnBillingPricePrefill()">${planOptions}</select>
      </div>
      <div class="form-group">
        <label class="form-label">Monthly price (£)</label>
        <input class="form-input" type="number" id="vbPrice" min="0" step="0.01" value="${v.monthlyPrice ?? ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Next billing date</label>
        <input class="form-input" type="date" id="vbDate" value="${escHtml(v.nextBillingDate || localISO())}">
      </div>
      <div class="form-group form-full" style="flex-direction:row;align-items:center;gap:10px;">
        <input type="checkbox" id="vbEnabled" ${v.billingEnabled ? 'checked' : ''}
          style="cursor:pointer;">
        <label for="vbEnabled" style="font-size:var(--fs-body);cursor:pointer;">Billing enabled — the daily sweep posts one wallet charge per month</label>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeDynamicModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveVNBilling('${escHtml(v.id)}')">💷 Save</button>
    </div>
  `);
}

async function saveVNBilling(id) {
  const enabled = document.getElementById('vbEnabled').checked;
  const price = parseFloat(document.getElementById('vbPrice').value);
  if (enabled && (!Number.isFinite(price) || price <= 0)) {
    toast('Enter a monthly price greater than £0.', 'error'); return;
  }
  const vnRec = virtualNumbers.find(x => x.id === id);
  if (enabled && !(await kcConfirm({
    title: 'Confirm recurring VN charge',
    body: `<strong>${vnRec?.customerName ? escName(vnRec.customerName) : 'Customer'}</strong><br>
      ${vnRec ? escHtml(vnRec.number) : ''} — billed monthly from ${fmtDate(document.getElementById('vbDate').value)} (posted by the daily sweep)`,
    amount: price,
    okLabel: 'Enable monthly billing',
  }))) return;
  const res = await window.api.updateVirtualNumber({
    id,
    bundleLabel: document.getElementById('vbBundle').value,
    plan: document.getElementById('vbPlan').value,
    monthlyPrice: Number.isFinite(price) ? price : null,
    billingEnabled: enabled,
    nextBillingDate: document.getElementById('vbDate').value,
  });
  if (!res.success) { toast(res.error || 'Could not save billing.', 'error'); return; }
  closeDynamicModal();
  toast(enabled ? 'Monthly billing on — charges post via the daily sweep.' : 'Billing saved.', 'success');
  renderVirtualTab();
}

async function toggleVNStatus(id, status) {
  const res = await window.api.updateVirtualNumber({ id, status });
  if (!res.success) { toast(res.error || 'Could not update.', 'error'); return; }
  renderVirtualTab();
}

async function deleteVN(id, number) {
  const ok = await window.api.confirmDelete(`Delete virtual number "${number}"?\n\nThis cannot be undone.`);
  if (!ok) return;
  const res = await window.api.deleteVirtualNumber(id);
  if (!res.success) { toast(res.error || 'Could not delete.', 'error'); return; }
  toast('Virtual number deleted.', 'warning');
  renderVirtualTab();
}

// ─────────────────────────────────────────────
//  SETTINGS (pricing editor — edit-only, typed, server-validated)
// ─────────────────────────────────────────────

async function renderSettingsTab() {
  const content = document.getElementById('mainContent');
  content.innerHTML = skeletonHtml('settings');
  const [cfg, team, autos, aliases, menu, extra, bizacc, pguide, health, elidSummary] = await Promise.all([
    window.api.getSettings(),
    kcFetch('/api/team').then(r => r.status === 403 ? null : r.json()).catch(() => null),
    kcFetch('/api/automations').then(r => r.status === 403 ? null : r.json()).catch(() => null),
    kcFetch('/api/email-aliases').then(r => r.status === 403 ? null : r.json()).catch(() => null),
    kcFetch('/api/services?all=1').then(r => r.ok ? r.json() : null).catch(() => null),
    kcFetch('/api/custom-charges').then(r => r.ok ? r.json() : null).catch(() => null),
    kcFetch('/api/business-accounts').then(r => r.status === 403 ? null : r.json()).catch(() => null),
    kcFetch('/api/phone-guide').then(r => r.ok ? r.json() : null).catch(() => null),
    fetch('/api/health').then(r => r.json()).catch(() => null),
    kcFetch('/api/elid/summary').then(r => r.status === 403 ? null : r.json()).catch(() => null),
  ]);
  if (!cfg || !cfg.success) {
    content.innerHTML = `<div class="tab-placeholder"><div class="big">⚙️</div>
      <h2>Settings</h2><p style="color:var(--muted)">${escHtml(cfg?.error || 'Settings unavailable.')}</p></div>`;
    return;
  }
  pricingConfig = cfg; // keep live pricing in sync with what's displayed

  // Team card — rendered only for the owner (helpers get a 403 from /api/team).
  const teamHtml = team?.success ? settingsCard('team', '👥 Team', `${team.members.length} member${team.members.length === 1 ? '' : 's'} + helper access`, `
      <table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead>
      <tbody>
        ${team.members.map(m => `
          <tr>
            <td><span class="customer-name">${escName(m.fullName || '—')}</span>${m.isYou ? ' <span class="badge badge-rental">you</span>' : ''}</td>
            <td>${escHtml(m.email || '—')}</td>
            <td>
              <select class="form-input" style="width:110px;padding:5px 8px;font-size:var(--fs-body);min-height:0;"
                onchange="changeTeamRole('${escHtml(m.id)}', this.value)" ${m.isYou ? 'disabled' : ''}>
                <option value="owner" ${m.role === 'owner' ? 'selected' : ''}>Admin</option>
                <option value="helper" ${m.role === 'helper' ? 'selected' : ''}>Helper</option>
              </select>
            </td>
            <td style="white-space:nowrap;">
              <button class="action-btn" style="font-size:var(--fs-micro);"
                onclick="openResetPasswordModal('${escHtml(m.id)}', '${escJs(m.fullName || m.email)}')">🔑 Reset password</button>
              <button class="action-btn danger" style="font-size:var(--fs-micro);"
                onclick="removeTeamMember('${escHtml(m.id)}', '${escJs(m.fullName || m.email)}', ${m.isYou})">✕ Remove${m.isYou ? ' (you)' : ''}</button></td>
          </tr>`).join('')}
        <tr>
          <td><input class="form-input" id="tmName" placeholder="Full name" style="min-height:0;padding:6px 10px;font-size:var(--fs-body);"></td>
          <td style="white-space:nowrap;">
            <input class="form-input" id="tmEmail" type="email" placeholder="Email" style="min-height:0;padding:6px 10px;font-size:var(--fs-body);width:46%;display:inline-block;">
            <input class="form-input" id="tmPassword" type="password" placeholder="Password (8+)" style="min-height:0;padding:6px 10px;font-size:var(--fs-body);width:46%;display:inline-block;">
          </td>
          <td>
            <select class="form-input" id="tmRole" style="width:110px;padding:5px 8px;font-size:var(--fs-body);min-height:0;">
              <option value="helper">Helper</option>
              <option value="owner">Admin</option>
            </select>
          </td>
          <td><button class="btn btn-primary btn-sm" onclick="saveNewTeamMember()">+ Add</button></td>
        </tr>
      </tbody></table>
      <div class="section-divider" style="margin:14px 14px 4px;">🔓 What helpers can see</div>
      <div style="padding:4px 14px 14px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
        ${['dashboard', 'customers', 'rentals', 'sim', 'wallet', 'bookings', 'repairs', 'services', 'shop', 'koltorah', 'virtual', 'tasks', 'settings'].map(t => `
          <label style="display:flex;align-items:center;gap:5px;font-size:var(--fs-small);cursor:pointer;">
            <input type="checkbox" class="htTab" value="${t}" style="accent-color:var(--accent);cursor:pointer;"
              ${(cfg.settings.find(s => s.key === 'helper_tabs')?.textValue || '').split(',').includes(t) ? 'checked' : ''}>
            ${t}</label>`).join('')}
        <button class="btn btn-outline btn-sm" style="font-size:var(--fs-micro);" onclick="saveHelperTabs()">💾 Save access</button>
        <span style="font-size:var(--fs-micro);color:var(--muted);">Wallet, shop &amp; settings are also blocked server-side when unticked.</span>
      </div>`) : '';

  // ── Automations card (owner-only) — custom "when X, do Y" rules ──
  autoTriggers = autos?.triggers || autoTriggers;
  autoRulesCache = autos?.rules || [];
  const automationsHtml = autos?.success ? settingsCard('automations', '🤖 Automations',
    `${autos.rules.length} rule${autos.rules.length === 1 ? '' : 's'} — run in the daily sweep`, `
      <table><thead><tr><th>Rule</th><th>When</th><th>Raises</th><th>On</th><th></th></tr></thead>
      <tbody>
        ${autos.rules.length === 0 ? `<tr><td colspan="5" style="color:var(--muted);font-size:var(--fs-body);padding:12px 16px;">No custom rules yet. The built-in sweeps (overdue, arrears, flights, passports, SIM renewals, VN billing) always run.</td></tr>` : ''}
        ${autos.rules.map(r => `
          <tr style="${r.enabled ? '' : 'opacity:0.5;'}">
            <td><strong>${escHtml(r.name)}</strong></td>
            <td style="font-size:var(--fs-small);">${escHtml((autoTriggers[r.trigger]?.label || r.trigger).replace('N', r.threshold))}</td>
            <td style="font-size:var(--fs-small);">📋 task <span class="badge badge-${r.priority === 'high' ? 'rental' : 'sim'}" style="font-size:var(--fs-micro);">${escHtml(r.priority)}</span></td>
            <td><label style="font-size:var(--fs-small);cursor:pointer;"><input type="checkbox" ${r.enabled ? 'checked' : ''} onchange="toggleAutomation('${escHtml(r.id)}', this.checked)" style="accent-color:var(--accent);"> on</label></td>
            <td style="white-space:nowrap;">
              <button class="action-btn" aria-label="Edit this rule" onclick="openAutomationModal('${escHtml(r.id)}')">✏️</button>
              <button class="action-btn danger" aria-label="Delete this rule" onclick="deleteAutomation('${escHtml(r.id)}')">✕</button>
            </td>
          </tr>`).join('')}
      </tbody></table>
      <div style="padding:8px 14px 14px;">
        <button class="btn btn-outline btn-sm" onclick="openAutomationModal()">+ New automation rule</button>
        <span style="font-size:var(--fs-micro);color:var(--muted);margin-left:8px;">e.g. "owes £100+ → urgent task", "flight in 7 days → task".</span>
      </div>`) : '';

  // ── Email addresses card (owner-only) — Forward Email aliases ──
  const aliasesHtml = aliases === null ? '' : (aliases.success ? settingsCard('emails', '📧 Email addresses',
    `${aliases.aliases.length} @${escHtml(aliases.domain)} via Forward Email`, `
      <table><thead><tr><th>Address</th><th>Forwards to</th><th>Purpose</th><th>On</th><th></th></tr></thead>
      <tbody>
        ${aliases.aliases.length === 0 ? `<tr><td colspan="5" style="color:var(--muted);font-size:var(--fs-body);padding:12px 16px;">No addresses yet — add the first one below (e.g. reminder@, admin@, receipts@).</td></tr>` : ''}
        ${aliases.aliases.map(a => `
          <tr style="${a.enabled ? '' : 'opacity:0.5;'}">
            <td><strong>${escHtml(a.address)}</strong></td>
            <td style="font-size:var(--fs-small);">${a.recipients.map(escHtml).join('<br>') || '—'}</td>
            <td style="font-size:var(--fs-small);color:var(--muted);">${escHtml(a.description || '—')}</td>
            <td><label style="font-size:var(--fs-small);cursor:pointer;"><input type="checkbox" ${a.enabled ? 'checked' : ''}
              onchange="toggleEmailAlias('${escHtml(a.id)}', this.checked)" style="accent-color:var(--accent);"> on</label></td>
            <td style="white-space:nowrap;">
              <button class="action-btn" title="Edit forwarding / purpose" onclick="openEmailAliasModal('${escHtml(a.id)}')">✏️</button>
              <button class="action-btn" title="Generate SMTP password (for sending as this address)"
                onclick="generateAliasPassword('${escHtml(a.id)}', '${escHtml(a.address)}')">🔑</button>
              <button class="action-btn danger" aria-label="Delete ${escHtml(a.address)}" onclick="deleteEmailAlias('${escHtml(a.id)}', '${escHtml(a.address)}')">✕</button>
            </td>
          </tr>`).join('')}
      </tbody></table>
      <div style="padding:8px 14px 14px;">
        <button class="btn btn-outline btn-sm" onclick="openEmailAliasModal()">+ New address</button>
        <span style="font-size:var(--fs-micro);color:var(--muted);margin-left:8px;">🔑 makes an SMTP password so the app (or Gmail send-as) can send from that address.</span>
      </div>`) : settingsCard('emails', '📧 Email addresses', 'not connected yet',
    `<div style="padding:8px 16px 14px;font-size:var(--fs-body);color:var(--muted);">${escHtml(aliases.error || 'Unavailable.')}</div>`));

  const num = (id, val, step = '0.01') =>
    `<input class="form-input" type="number" step="${step}" id="${id}" value="${val}" style="width:90px;padding:6px 8px;font-size:var(--fs-body);">`;

  const rateRows = cfg.rentalRates.map(r => `
    <tr>
      <td><strong>${escHtml(r.displayName)}</strong><div class="customer-email">${escHtml(r.countryCode)}</div></td>
      <td>${num(`rr_rate_${r.countryCode}`, r.ratePerDay)}</td>
      <td>${num(`rr_min_${r.countryCode}`, r.minCharge)}</td>
      <td>${num(`rr_cap_${r.countryCode}`, r.cap)}</td>
      <td>${num(`rr_period_${r.countryCode}`, r.capPeriodDays, '1')}</td>
      <td>${num(`rr_vnw_${r.countryCode}`, r.vnWeekly ?? '')}</td>
      <td>${num(`rr_vnm_${r.countryCode}`, r.vnPer30Days ?? '')}</td>
      <td style="white-space:nowrap;"><button class="btn btn-outline" style="font-size:var(--fs-small);padding:5px 12px;"
        aria-label="Save this rate" onclick="saveRentalRate('${escHtml(r.countryCode)}')">💾</button>
        <button class="action-btn danger" style="font-size:var(--fs-micro);" title="Remove country"
        onclick="deleteRateRow('rental_rates','${escHtml(r.countryCode)}')">✕</button></td>
    </tr>`).join('') + `
    <tr style="background:var(--bg-secondary);">
      <td><div style="font-size:var(--fs-overline);font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:0.3px;margin-bottom:4px;">➕ Add a country</div>
        <input class="form-input" id="rrNew_code" placeholder="FR" style="width:70px;padding:5px 7px;font-size:var(--fs-small);min-height:0;text-transform:uppercase;">
        <input class="form-input" id="rrNew_name" placeholder="France" style="width:100px;padding:5px 7px;font-size:var(--fs-small);min-height:0;margin-top:3px;"></td>
      <td>${num('rrNew_rate', '')}</td><td>${num('rrNew_min', '')}</td><td>${num('rrNew_cap', '')}</td>
      <td>${num('rrNew_period', '30', '1')}</td><td>${num('rrNew_vnw', '')}</td><td>${num('rrNew_vnm', '')}</td>
      <td><button class="btn btn-primary btn-sm" onclick="addRentalRate()">+ Add</button></td>
    </tr>`;

  const damageRows = cfg.damageRates.map(d => `
    <tr>
      <td><strong>${escHtml(d.countryCode)}</strong></td>
      <td>${num(`dr_phone_${d.countryCode}`, d.phoneDamageLoss)}</td>
      <td>${num(`dr_charger_${d.countryCode}`, d.chargerMissing)}</td>
      <td>${num(`dr_sim_${d.countryCode}`, d.simMissing)}</td>
      <td style="white-space:nowrap;"><button class="btn btn-outline" style="font-size:var(--fs-small);padding:5px 12px;"
        aria-label="Save this rate" onclick="saveDamageRate('${escHtml(d.countryCode)}')">💾</button>
        <button class="action-btn danger" style="font-size:var(--fs-micro);" title="Remove country"
        onclick="deleteRateRow('damage_rates','${escHtml(d.countryCode)}')">✕</button></td>
    </tr>`).join('') + `
    <tr style="background:var(--bg-secondary);">
      <td><div style="font-size:var(--fs-overline);font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:0.3px;margin-bottom:4px;">➕ Add a country</div>
        <input class="form-input" id="drNew_code" placeholder="FR" style="width:70px;padding:5px 7px;font-size:var(--fs-small);min-height:0;text-transform:uppercase;"></td>
      <td>${num('drNew_phone', '')}</td><td>${num('drNew_charger', '')}</td><td>${num('drNew_sim', '')}</td>
      <td><button class="btn btn-primary btn-sm" onclick="addDamageRate()">+ Add</button></td>
    </tr>`;

  // Plain-language names, sentences and clear units for each fee, grouped so
  // a non-technical owner reads what it means, not the raw database key.
  const FEE_META = {
    late_fee_per_day:          { group: '📱 Rentals', label: 'Late return fee', help: 'Charged for each day a phone is returned past its due date (Shabbos & Yom Tov not counted).', unit: '£ / day' },
    multi_phone_discount_pct:  { group: '📱 Rentals', label: 'Multi-phone discount', help: 'The discount when a customer rents several phones at once.', unit: '% off' },
    multi_phone_discount_from: { group: '📱 Rentals', label: 'Multi-phone discount starts at', help: 'Which phone the discount kicks in on — 3 means the 3rd phone and up. Change to 4 to start at the 4th.', unit: 'th phone' },
    multi_sim_discount_from:   { group: '💳 SIM plans', label: 'Multi-SIM discount starts at', help: 'Which plan the discount kicks in on — 3 means 3 or more plans.', unit: 'th plan' },
    sim_dd_surcharge_pct:      { group: '💳 SIM plans', label: 'SIM monthly surcharge', help: 'Service fee for running a through-me SIM’s monthly direct debit.', unit: '% extra' },
    sim_dd_surcharge_min:      { group: '💳 SIM plans', label: 'SIM monthly surcharge minimum', help: 'The smallest SIM monthly surcharge, even on cheap plans.', unit: '£ minimum' },
    sim_activation_fee:        { group: '💳 SIM plans', label: 'SIM setup fee', help: 'One-off charge to set up a new SIM.', unit: '£' },
    sim_annual_fee:            { group: '💳 SIM plans', label: 'SIM yearly fee', help: 'Charged once a year per active SIM.', unit: '£' },
    sim_additional_fee:        { group: '💳 SIM plans', label: 'Extra SIM fee', help: 'For an additional SIM on the same customer.', unit: '£' },
    sim_service_fee:           { group: '💳 SIM plans', label: 'SIM service fee', help: 'General servicing / support charge.', unit: '£' },
    sim_replacement_fee:       { group: '💳 SIM plans', label: 'SIM replacement fee', help: 'For a replacement SIM after the free allowance is used.', unit: '£' },
    free_replacements_default: { group: '💳 SIM plans', label: 'Free SIM replacements', help: 'How many replacements a customer gets before being charged.', unit: 'free' },
    multi_sim_discount_pct:    { group: '💳 SIM plans', label: 'Multi-SIM discount', help: 'Discount when a customer has 3 or more SIM plans.', unit: '% off' },
    vn_weekly:                 { group: '🔢 Virtual numbers', label: 'Virtual number — weekly', help: 'Price per week (minimum one week).', unit: '£ / week' },
    vn_per_30_days:            { group: '🔢 Virtual numbers', label: 'Virtual number — monthly', help: 'Flat price for a 30-day rental.', unit: '£ / 30 days' },
    online_hourly_rate:        { group: '🖨️ Online & print', label: 'Help / online rate', help: 'Charged per hour for hands-on help (10-minute minimum).', unit: '£ / hour' },
    online_min_charge:         { group: '🖨️ Online & print', label: 'Minimum online charge', help: 'The smallest charge for any online service.', unit: '£' },
    online_repeat_from:        { group: '🖨️ Online & print', label: 'Bulk discount starts at', help: 'From this many applications, the cheaper "repeat" price applies (your price list says 4).', unit: 'th one' },
    // These change nothing about what anybody is charged — they decide when a
    // number on the dashboard turns amber, and when it turns red. Worth saying
    // so in the help text, since they sit in a table of fees.
    dash_arrears_amber:        { group: '📊 Dashboard colours', label: 'Outstanding — amber above', help: 'Total owed across all customers. Below this the figure shows green when it is zero, and plain otherwise. Nothing here changes a charge.', unit: '£ owed' },
    dash_arrears_red:          { group: '📊 Dashboard colours', label: 'Outstanding — red above', help: 'The point at which the money owed is a problem rather than the ordinary flow of the week.', unit: '£ owed' },
    dash_overdue_amber:        { group: '📊 Dashboard colours', label: 'Overdue rentals — amber above', help: 'Phones still out past their return date.', unit: 'rentals' },
    dash_overdue_red:          { group: '📊 Dashboard colours', label: 'Overdue rentals — red above', help: 'How many overdue phones means somebody should be chasing today.', unit: 'rentals' },
    dash_tasks_amber:          { group: '📊 Dashboard colours', label: 'High-priority tasks — amber above', help: 'Open tasks marked 🔥 Now.', unit: 'tasks' },
    dash_tasks_red:            { group: '📊 Dashboard colours', label: 'High-priority tasks — red above', help: 'The backlog size that counts as behind.', unit: 'tasks' },
    dash_phones_amber:         { group: '📊 Dashboard colours', label: 'Phones left — amber at or below', help: 'Rental phones on the shelf and ready to go out. This one counts DOWN: fewer is worse.', unit: 'phones' },
    dash_phones_red:           { group: '📊 Dashboard colours', label: 'Phones left — red at or below', help: 'The point at which the next customer through the door may go away empty-handed.', unit: 'phones' },
    dash_returning_amber:      { group: '📊 Dashboard colours', label: 'Returning today — amber above', help: 'Phones expected back today, so the counter knows what kind of day it is.', unit: 'returns' },
    dash_returning_red:        { group: '📊 Dashboard colours', label: 'Returning today — red above', help: 'A busy enough return day to need a second pair of hands.', unit: 'returns' },
  };
  const editable = cfg.settings.filter(s => s.numValue !== null && s.editable && !s.custom);
  const feeGroups = {};
  editable.forEach(s => {
    const m = FEE_META[s.key] || { group: '⚙️ Other', label: s.description || s.key, help: '', unit: s.unit };
    (feeGroups[m.group] = feeGroups[m.group] || []).push({ s, m });
  });
  const feeRow = ({ s, m }) => `
    <tr>
      <td style="max-width:340px;"><strong>${escHtml(m.label)}</strong>${m.help ? `<div style="color:var(--muted);font-size:var(--fs-micro);line-height:1.4;margin-top:2px;">${escHtml(m.help)}</div>` : ''}</td>
      <td style="white-space:nowrap;">${num(`st_${s.key}`, s.numValue)} <span style="color:var(--muted);font-size:var(--fs-micro);">${escHtml(m.unit || '')}</span></td>
      <td><button class="btn btn-outline" style="font-size:var(--fs-small);padding:5px 12px;" onclick="saveSettingKey('${escHtml(s.key)}')">💾 Save</button></td>
    </tr>`;
  const settingRows = Object.entries(feeGroups).map(([group, items]) =>
    `<tr><td colspan="3" style="background:var(--bg-secondary);font-size:var(--fs-micro);font-weight:600;text-transform:uppercase;letter-spacing:0.4px;color:var(--muted);padding:6px 16px;">${group}</td></tr>` +
    items.map(feeRow).join('')).join('');

  emailAliasCache = aliases?.success ? aliases.aliases : [];

  // ── Service price menu card (admin-editable price list) ──
  menuItemsCache = menu?.success ? menu.items : [];
  const isAdmin = !currentStaff || currentStaff.role === 'owner';
  const catLabel = { repair: '🔧 Repairs', online: '🖨️ Online & print', tickets: '✈️ Tickets',
    phone: '📱 Phones', sim: '💳 SIM', other: '📦 Other' };
  const menuNum = (id, val) =>
    `<input class="form-input" type="number" step="0.01" id="${id}" value="${val ?? ''}" placeholder="—" style="width:76px;padding:5px 7px;font-size:var(--fs-small);min-height:0;">`;
  const menuHtml = !isAdmin || !menu?.success ? '' : settingsCard('pricemenu', '🧾 Service price menu',
    `${menuItemsCache.length} services — what the charging screens offer`, `
      <div class="table-wrap"><table><thead><tr><th>Service</th><th>Price</th><th>KC price</th><th>Repeat</th><th>Bulk (tickets 6th+)</th><th>On</th><th></th></tr></thead>
      <tbody>
        ${['repair','online','tickets','phone','sim','other'].map(cat => {
          const items = menuItemsCache.filter(m => m.category === cat);
          if (!items.length) return '';
          return `<tr><td colspan="7" style="background:var(--bg-secondary);font-size:var(--fs-micro);font-weight:600;text-transform:uppercase;letter-spacing:0.4px;color:var(--muted);padding:6px 16px;">${catLabel[cat] || cat}</td></tr>` +
            items.map(m => `
            <tr style="${m.active ? '' : 'opacity:0.45;'}">
              <td><input class="form-input" id="mi_name_${m.id}" value="${escHtml(m.name)}" style="min-height:0;padding:5px 8px;font-size:var(--fs-small);min-width:170px;"></td>
              <td>${menuNum(`mi_price_${m.id}`, m.price)}</td>
              <td>${menuNum(`mi_kc_${m.id}`, m.kcPrice)}</td>
              <td>${menuNum(`mi_rep_${m.id}`, m.repeatPrice)}</td>
              <td>${menuNum(`mi_bulk_${m.id}`, m.bulkPrice)}</td>
              <td><input type="checkbox" id="mi_active_${m.id}" ${m.active ? 'checked' : ''} style="accent-color:var(--accent);cursor:pointer;"></td>
              <td><button class="btn btn-outline" style="font-size:var(--fs-small);padding:5px 12px;" onclick="saveMenuItem('${escHtml(String(m.id))}')">💾 Save</button></td>
            </tr>`).join('');
        }).join('')}
        <tr style="background:var(--bg-secondary);">
          <td><div style="font-size:var(--fs-overline);font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:0.3px;margin-bottom:4px;">➕ Add a service</div>
            <input class="form-input" id="miNewName" placeholder="New service name" style="min-height:0;padding:5px 8px;font-size:var(--fs-small);min-width:170px;"></td>
          <td>${menuNum('miNewPrice', '')}</td>
          <td colspan="3">
            <select class="form-input" id="miNewCat" style="min-height:0;padding:5px 8px;font-size:var(--fs-small);width:130px;">
              ${Object.entries(catLabel).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}
            </select>
          </td>
          <td></td>
          <td><button class="btn btn-primary btn-sm" onclick="addMenuItem()">+ Add</button></td>
        </tr>
      </tbody></table></div>
      <div style="padding:6px 14px 12px;font-size:var(--fs-micro);color:var(--muted);">Prices apply to new charges only. Untick "On" to retire a service — old charges keep their label.</div>`);

  // ── Extra charges card (owner-defined fees the engine applies for you) ──
  extraChargeCache = extra?.success ? extra.charges : [];
  const TARGET_LABEL = { booking: '✈️ Every flight booking', service: '🖨️ Every online/print service',
    sim: '💳 Every SIM setup', repair: '🔧 Every repair', rental: '📱 Every rental', any: '⭐ All of the above' };
  const extraHtml = !isAdmin || !extra?.success ? '' : settingsCard('extras', '➕ Extra charges',
    `${extraChargeCache.length} auto-applied — the app bills these for you`, `
      <div style="padding:8px 16px 4px;font-size:var(--fs-small);color:var(--muted);line-height:1.5;">
        Define a fee once and the app adds it <strong>automatically</strong> every time you make that kind of charge —
        e.g. a £5 handling fee on every flight booking. "Automatic" always applies; "optional" you tick per charge.
        Wired for flight bookings, online/print services, SIM setups, repairs and rentals.</div>
      <div class="table-wrap"><table><thead><tr><th>Charge name</th><th>Amount</th><th>Added to</th><th>How</th><th>On</th><th></th></tr></thead>
      <tbody>
        ${extraChargeCache.length === 0 ? `<tr><td colspan="6" style="color:var(--muted);font-size:var(--fs-body);padding:12px 16px;">None yet. Add one below — e.g. "Handling fee £5 → every flight booking → automatic".</td></tr>` : ''}
        ${extraChargeCache.map(c => `
          <tr style="${c.active ? '' : 'opacity:0.5;'}">
            <td><input class="form-input" id="ec_label_${c.id}" value="${escHtml(c.label)}" style="min-height:0;padding:5px 8px;font-size:var(--fs-small);min-width:150px;"></td>
            <td>${num(`ec_amount_${c.id}`, c.amount)}</td>
            <td><select class="form-input" id="ec_target_${c.id}" style="min-height:0;padding:5px 8px;font-size:var(--fs-small);">
              ${Object.entries(TARGET_LABEL).map(([k, l]) => `<option value="${k}" ${c.appliesTo === k ? 'selected' : ''}>${l}</option>`).join('')}
            </select></td>
            <td><select class="form-input" id="ec_mode_${c.id}" style="min-height:0;padding:5px 8px;font-size:var(--fs-small);width:110px;">
              <option value="auto" ${c.mode === 'auto' ? 'selected' : ''}>Automatic</option>
              <option value="optional" ${c.mode === 'optional' ? 'selected' : ''}>Optional</option>
            </select></td>
            <td><input type="checkbox" id="ec_active_${c.id}" ${c.active ? 'checked' : ''} style="accent-color:var(--accent);cursor:pointer;"></td>
            <td style="white-space:nowrap;">
              <button class="btn btn-outline" style="font-size:var(--fs-small);padding:5px 10px;" aria-label="Save this charge" onclick="saveExtraCharge('${escHtml(c.id)}')">💾</button>
              <button class="action-btn danger" style="font-size:var(--fs-micro);" aria-label="Delete this charge" onclick="deleteExtraCharge('${escHtml(c.id)}')">✕</button>
            </td>
          </tr>`).join('')}
        <tr style="background:var(--bg-secondary);">
          <td><div style="font-size:var(--fs-overline);font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:0.3px;margin-bottom:4px;">➕ Add a charge</div>
            <input class="form-input" id="ecNew_label" placeholder="e.g. Handling fee" style="min-height:0;padding:5px 8px;font-size:var(--fs-small);min-width:150px;"></td>
          <td>${num('ecNew_amount', '')}</td>
          <td><select class="form-input" id="ecNew_target" style="min-height:0;padding:5px 8px;font-size:var(--fs-small);">
            ${Object.entries(TARGET_LABEL).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}
          </select></td>
          <td><select class="form-input" id="ecNew_mode" style="min-height:0;padding:5px 8px;font-size:var(--fs-small);width:110px;">
            <option value="auto">Automatic</option><option value="optional">Optional</option>
          </select></td>
          <td></td>
          <td><button class="btn btn-primary btn-sm" onclick="addExtraCharge()">+ Add</button></td>
        </tr>
      </tbody></table></div>`);

  // ── IVR / phone providers card (owner-only) — the editable provider list
  // that populates the "Platform / IVR provider" dropdown on a virtual number
  // (feature #10). ──
  const ivrList = ivrPlatforms();
  const ivrHtml = !isAdmin ? '' : settingsCard('ivr', '📞 IVR / phone providers',
    `${ivrList.length} provider${ivrList.length === 1 ? '' : 's'} — options when adding a virtual number`, `
      <div style="padding:10px 16px 2px;display:flex;flex-wrap:wrap;gap:6px;">
        ${ivrList.map(p => `<span class="badge badge-vn">${escHtml(p)}</span>`).join('')}
      </div>
      <div style="padding:8px 16px 10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <input class="form-input" id="ivrPlatformsInput" value="${escHtml(ivrList.join(', '))}"
          placeholder="elid, FreePBX, OpenBPX, 3CX…" style="flex:1;min-width:240px;min-height:0;padding:8px 12px;font-size:var(--fs-body);">
        <button class="btn btn-outline btn-sm" onclick="saveIvrPlatforms()">💾 Save providers</button>
      </div>
      <div style="padding:0 16px 14px;font-size:var(--fs-micro);color:var(--muted);line-height:1.5;">
        Comma-separated. These appear in the <strong>Platform / IVR provider</strong> dropdown when you add a virtual number.
        Existing numbers keep their provider even if you remove it here.</div>`);

  // ── Contact Tools reference card — the phone-migration workbench SOP.
  // A directory, not a launcher: a browser can't start a Windows program, so
  // this tells any helper which converter handles which handset, and where the
  // same job can be done in-app. The work itself is charged via the "Contact
  // Transfer / Phone Setup" line on the Online & Print menu.
  const contactToolsHtml = settingsCard('contacttools', '🔧 Contact tools (phone migrations)',
    'which converter handles which handset', `
      <div style="padding:10px 16px 6px;">
        <div class="table-wrap"><table>
          <thead><tr><th>Tool</th><th>What it does</th><th>Where</th></tr></thead>
          <tbody>
            <tr><td>Contacts Converter</td><td>Excel / CSV / VCF → clean +44 VCF (map, merge, dedupe)</td><td><a href="/tools/contacts" target="_blank" rel="noopener">in-app</a></td></tr>
            <tr><td>Transfer Wizard</td><td>Phone-to-phone: XML / NBF / IB / VCF → VCF or FIG zip</td><td><a href="/tools/transfer" target="_blank" rel="noopener">in-app</a></td></tr>
            <tr><td>xml→fig</td><td>Nokia backup XML → Fig core phone format</td><td>office PC</td></tr>
            <tr><td>NokiaB→VCF</td><td>Nokia backup (NBF) → VCF</td><td>office PC</td></tr>
            <tr><td>Excel→VCF / CSV→VCF offline</td><td>Spreadsheet exports → VCF</td><td>office PC</td></tr>
            <tr><td>VCF UK-prefix converter</td><td>Normalises numbers to +44</td><td>office PC</td></tr>
            <tr><td>VCF cleaner</td><td>Strips broken / duplicate entries from a VCF</td><td>office PC</td></tr>
          </tbody>
        </table></div>
      </div>
      <div style="padding:0 16px 14px;font-size:var(--fs-micro);color:var(--muted);line-height:1.5;">
        Charge the job with the <strong>Contact Transfer / Phone Setup</strong> line on the Online &amp; Print menu — it lands on the customer's timeline and wallet like any other service. Then save the finished <strong>.vcf</strong> against the customer (Documents on their card), so next phone change their contacts are one click away.</div>`);

  // A category eyebrow above its cards — same idea as the sidebar's group
  // labels, so a section header reads as a CATEGORY and the cards below read as
  // its rows. The two levels are then unmistakably different (that's the "left
  // panel is better" hierarchy, brought to the settings body).
  const sectionHead = (t, sub) => `
    <div class="settings-section">
      <h3 class="sh-label">${t}</h3>
      ${sub ? `<span class="sh-sub">${sub}</span>` : ''}
    </div>`;
  const pricingCards = [
    menuHtml, extraHtml,
    settingsCard('rates', '📱 Rental Rates', `${cfg.rentalRates.length} countries`, `
      <div class="table-wrap"><table><thead><tr><th>Country</th><th>£/day</th><th>Min £</th><th>Cap £</th><th>Cap period (days)</th><th>VN £/wk</th><th>VN £/30d</th><th></th></tr></thead>
      <tbody>${rateRows}</tbody></table></div>`),
    settingsCard('damage', '💥 Damage / Loss Charges', 'what a lost/broken item costs', `
      <div class="table-wrap"><table><thead><tr><th>Country</th><th>Phone £</th><th>Charger £</th><th>SIM £</th><th></th></tr></thead>
      <tbody>${damageRows}</tbody></table></div>`),
    settingsCard('fees', '⚙️ Fees & Rules', 'late fees, SIM fees, discounts', `
      <div class="table-wrap"><table><thead><tr><th>What it is</th><th>Value</th><th></th></tr></thead>
      <tbody>${settingRows}</tbody></table></div>`),
  ].filter(Boolean).join('');

  // ── Accounts & subscriptions register (owner-only) — every external
  // account the business runs on: where to log in, what it costs, when it
  // renews. Credentials live encrypted server-side; reveal is on demand.
  bizAccountsCache = bizacc?.accounts || [];
  const BIZ_CAT_LABELS = { infrastructure: '🏗 Infrastructure', telecom: '📶 Telecom', ivr: '📞 IVR / PBX', email: '📧 Email', finance: '💷 Finance', other: '📦 Other' };
  const activeBiz = bizAccountsCache.filter(a => a.active);
  const bizTotal = activeBiz.reduce((s, a) => s + (a.monthlyCost || 0), 0);
  const today10 = new Date().toISOString().slice(0, 10);
  const soon10 = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const bizAccHtml = bizacc?.success ? settingsCard('bizacc', '🗄 Accounts & subscriptions',
    `${activeBiz.length} account${activeBiz.length === 1 ? '' : 's'} · ~${fmtGbp(bizTotal)}/month`, `
      <table><thead><tr><th>Account</th><th>Login</th><th>£/month</th><th>Renews</th><th></th></tr></thead>
      <tbody>
        ${activeBiz.length === 0 ? `<tr><td colspan="5" style="color:var(--muted);font-size:var(--fs-body);padding:12px 16px;">Nothing registered yet — add Vercel, Supabase, Resend, Twilio, elid, the carrier logins… so nothing lives only in someone's head.</td></tr>` : ''}
        ${activeBiz.map(a => `
          <tr>
            <td><strong>${escHtml(a.name)}</strong><div style="font-size:var(--fs-micro);color:var(--muted);">${BIZ_CAT_LABELS[a.category] || escHtml(a.category)}${a.notes ? ' · ' + escHtml(a.notes.slice(0, 60)) : ''}</div></td>
            <td style="font-size:var(--fs-small);">${a.url ? `<a href="${escHtml(a.url)}" target="_blank" rel="noopener" style="color:var(--accent);">open ↗</a> ` : ''}${escHtml(a.loginEmail || '—')}</td>
            <td style="font-feature-settings:'tnum';">${a.monthlyCost != null ? fmtGbp(a.monthlyCost) : '—'}</td>
            <td class="kc-date">${a.renewalDate ? `<span style="${a.renewalDate <= soon10 ? 'color:var(--danger-ink);font-weight:600;' : ''}">${fmtDate(a.renewalDate)}${a.renewalDate < today10 ? ' ⚠' : ''}</span>` : '—'}</td>
            <td style="white-space:nowrap;">
              ${a.hasCred ? `<button class="action-btn" style="font-size:var(--fs-micro);" onclick="revealBizAccount('${escHtml(a.id)}')">🔑 Reveal</button>` : ''}
              <button class="action-btn" aria-label="Edit ${escHtml(a.name || 'account')}" onclick="openBizAccountModal('${escHtml(a.id)}')">✏️</button>
              <button class="action-btn danger" aria-label="Retire ${escHtml(a.name || 'account')}" onclick="retireBizAccount('${escHtml(a.id)}', '${escJs(a.name)}')">✕</button>
            </td>
          </tr>`).join('')}
      </tbody></table>
      <div style="padding:8px 14px 14px;">
        <button class="btn btn-outline btn-sm" onclick="openBizAccountModal()">+ Add account</button>
        ${bizacc.credVault ? '' : '<span style="font-size:var(--fs-micro);color:var(--warning,#b45309);margin-left:8px;">Credential vault key missing — passwords cannot be stored until SIM_CRED_KEY is set.</span>'}
      </div>`) : '';

  // Phone guide — the public handset catalogue (/phone-guide), composed here.
  // Specs came from the shop's Price List doc; pros/cons are the owner's to
  // write, one point per line, no coding needed.
  phoneModelsCache = pguide?.models || [];
  const activeModels = phoneModelsCache.filter(m => m.active);
  const retiredModels = phoneModelsCache.filter(m => !m.active);
  const phoneGuideHtml = pguide?.success ? settingsCard('phoneguide', '📱 Phone guide',
    `${activeModels.length} model${activeModels.length === 1 ? '' : 's'} on the public guide`, `
      <table><thead><tr><th>Phone</th><th>Price</th><th>Specs</th><th>Pros &amp; cons</th><th></th></tr></thead>
      <tbody>
        ${activeModels.length === 0 ? '<tr><td colspan="5" style="color:var(--muted);font-size:var(--fs-body);padding:12px 16px;">No models yet — add the first phone.</td></tr>' : ''}
        ${activeModels.map(m => `
          <tr>
            <td><strong>${escHtml(m.name)}</strong><div style="font-size:var(--fs-micro);color:var(--muted);">order ${m.sortOrder}${m.notes ? ' · ' + escHtml(m.notes.slice(0, 50)) : ''}</div></td>
            <td style="font-feature-settings:'tnum';">${m.price != null ? fmtGbp(m.price) : '—'}</td>
            <td style="font-size:var(--fs-small);color:var(--muted);max-width:260px;">${escHtml(['Dual SIM: ' + (m.dualSim || '—'), 'Hebrew: ' + (m.yiddishText || '—'), 'Touch: ' + (m.touchScreen || '—'), 'Text: ' + (m.texting || '—')].join(' · '))}</td>
            <td style="font-size:var(--fs-small);">${m.pros || m.cons ? '✍️ written' : '<span style="color:var(--muted);">not written yet</span>'}</td>
            <td style="white-space:nowrap;">
              <button class="action-btn" aria-label="Edit ${escHtml(m.name || 'model')}" onclick="openPhoneModelModal('${escHtml(m.id)}')">✏️</button>
              <button class="action-btn danger" aria-label="Retire ${escHtml(m.name || 'model')}" onclick="retirePhoneModel('${escHtml(m.id)}', '${escJs(m.name)}')">✕</button>
            </td>
          </tr>`).join('')}
      </tbody></table>
      <div style="padding:8px 14px 14px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
        <button class="btn btn-outline btn-sm" onclick="openPhoneModelModal()">+ Add phone</button>
        <a class="btn btn-outline btn-sm" href="/phone-guide" target="_blank" rel="noopener">👁 View the public page ↗</a>
        ${retiredModels.length ? `<span style="font-size:var(--fs-micro);color:var(--muted);">Hidden: ${retiredModels.map(m => `${escHtml(m.name)} <button class="action-btn" style="font-size:var(--fs-micro);" onclick="restorePhoneModel('${escHtml(m.id)}')">↩ restore</button>`).join(' · ')}</span>` : ''}
      </div>`) : '';

  // ── Messaging status (email + SMS) — reads /api/health, which reports each
  // channel's configuration and safety gate (hold / test / live) without ever
  // exposing a secret. The test-SMS button proves the Twilio console
  // connection end-to-end the moment the owner pastes the keys into Vercel.
  const chanBadge = (st) => {
    if (!st || !st.configured) return '<span class="badge" style="background:var(--bg-secondary);color:var(--muted);">not connected</span>';
    const mode = st.mode || 'hold';
    const style = mode === 'live' ? 'badge-active' : mode === 'test' ? 'badge-sim' : 'badge-rental';
    return `<span class="badge ${style}">${escHtml(mode.toUpperCase())}</span>`;
  };
  const msgHtml = settingsCard('messaging', '📨 Messaging (email & SMS)',
    `email ${health?.email?.configured ? health.email.mode : 'not connected'} · SMS ${health?.sms?.configured ? health.sms.mode : 'not connected'}`, `
      <table><thead><tr><th>Channel</th><th>Provider</th><th>Status</th><th>What the status means</th></tr></thead>
      <tbody>
        <tr>
          <td><strong>📧 Email</strong></td>
          <td style="font-size:var(--fs-small);">${escHtml(health?.email?.provider || '—')}</td>
          <td>${chanBadge(health?.email)}</td>
          <td style="font-size:var(--fs-small);color:var(--muted);">HOLD builds &amp; logs but sends nothing · TEST sends everything to your own address · LIVE emails real customers (MAIL_LIVE).</td>
        </tr>
        <tr>
          <td><strong>💬 SMS</strong></td>
          <td style="font-size:var(--fs-small);">${escHtml(health?.sms?.provider || 'Twilio (not connected)')}</td>
          <td>${chanBadge(health?.sms)}</td>
          <td style="font-size:var(--fs-small);color:var(--muted);">${health?.sms?.configured
            ? 'HOLD builds &amp; logs but sends nothing · TEST sends everything to SMS_TEST_TO · LIVE texts real customers (SMS_LIVE).'
            : 'Connect the Twilio console: paste TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM (or TWILIO_MESSAGING_SERVICE_SID) into Vercel env vars, redeploy, and this flips to HOLD.'}</td>
        </tr>
      </tbody></table>
      <div style="padding:8px 14px 14px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
        <input class="form-input" id="smsTestTo" type="tel" dir="ltr" placeholder="+44 7…  (your own number)"
          style="min-height:0;padding:7px 10px;font-size:var(--fs-body);width:220px;">
        <button class="btn btn-outline btn-sm" onclick="sendTestSms()">📤 Send test SMS</button>
        <span style="font-size:var(--fs-micro);color:var(--muted);">Safe in every mode — on HOLD it only logs; on TEST it goes to the test number whatever you type.</span>
      </div>`);

  // Shop details — public-facing facts the owner should be able to change
  // without a code change (they show on the welcome page within minutes).
  const openingHours = cfg.settings.find(s => s.key === 'opening_hours')?.textValue || 'Sunday–Thursday, 2:00–6:30pm';
  const shopHtml = settingsCard('shop-details', '🏪 Shop details', 'what the public site shows', `
      <div style="padding:12px 14px 14px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
        <label style="font-size:var(--fs-body);color:var(--muted);">Opening hours</label>
        <input class="form-input" id="stOpeningHours" value="${escHtml(openingHours)}"
          style="min-height:0;padding:7px 10px;font-size:var(--fs-body);flex:1;min-width:240px;" placeholder="e.g. Sunday–Thursday, 2:00–6:30pm">
        <button class="btn btn-primary btn-sm" onclick="saveOpeningHours()">💾 Save</button>
        <span style="flex-basis:100%;font-size:var(--fs-micro);color:var(--muted);">Shown on the public welcome page (Visit-the-shop card and footer). Free text — write it the way you'd say it.</span>
      </div>`);

  // Travel requirements matrix (owner-only) — filled lazily after render.
  const travelRulesHtml = (currentStaff && currentStaff.role !== 'owner') ? '' :
    settingsCard('travel-rules', '🛂 Travel requirements',
      'what each passport needs, per destination', `
      <div id="travelRulesBody" style="padding:12px 14px 14px;"><div style="color:var(--muted);font-size:var(--fs-body);">Loading…</div></div>`);

  // ELID (telecom upstream) — owner-only. Shows the reseller's live ELID credit
  // balance, read-only. Hidden until ELID is configured (a 503 "not configured"
  // or a non-owner 403 → no card). Read live via lib/elid.js.
  const elidCard = (!elidSummary || /not configured/i.test(elidSummary.error || '')) ? '' :
    settingsCard('elid', '📞 ELID (telecom upstream)',
      elidSummary.success ? `credit £${Number(elidSummary.balance).toFixed(2)}` : 'connection issue', `
      <div style="padding:12px 14px 14px;font-size:var(--fs-body);">
        ${elidSummary.success
          ? `Account <strong>${escHtml(elidSummary.account)}</strong> — upstream credit balance:
             <strong style="font-size:var(--fs-lead);">£${Number(elidSummary.balance).toFixed(2)}</strong>
             <div style="font-size:var(--fs-micro);color:var(--muted);margin-top:6px;">Read live from ELID (Kolmisoft MOR), read-only. Per-customer usage is next.</div>`
          : `<span style="color:var(--danger-ink);">Couldn't read ELID: ${escHtml(elidSummary.error || 'unknown error')}</span>`}
      </div>`);

  content.innerHTML = `
    <div style="margin-bottom:8px;padding:10px 14px;border-radius:8px;background:var(--bg-secondary);font-size:var(--fs-small);color:var(--muted);display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
      <span style="flex:1;">Everything that runs the business — people, prices, messages and automation — lives here. Price edits apply to <strong>new</strong> charges only; existing tickets never reprice.</span>
      <button class="btn btn-outline btn-sm" onclick="openChangePasswordModal()" title="Change your own login password">🔑 My password</button>
      <button class="btn btn-outline btn-sm" onclick="runSweepsNow()" title="Overdue rentals, arrears, passport expiry, SIM renewals">⏰ Run sweeps now</button>
    </div>

    ${sectionHead('Shop', 'public-facing details')}
    ${shopHtml}
    ${phoneGuideHtml}

    ${bizAccHtml ? sectionHead('Business', 'the accounts &amp; subscriptions the company runs on') + bizAccHtml : ''}

    ${team?.success ? sectionHead('People &amp; access', 'who works here and what they can see') + teamHtml : ''}

    ${sectionHead('Prices &amp; charges', 'what you charge and any automatic extras')}
    ${pricingCards}

    ${sectionHead('Communications', 'channels, safety gates &amp; addresses')}
    ${msgHtml}
    ${aliasesHtml}

    ${(ivrHtml || elidCard) ? sectionHead('Connectivity', 'virtual-number &amp; IVR providers') + ivrHtml + elidCard : ''}

    ${sectionHead('Workbench', 'phone migrations &amp; converters')}
    ${contactToolsHtml}

    ${travelRulesHtml ? sectionHead('Travel', 'entry requirements the booking panel &amp; reminders use') + travelRulesHtml : ''}

    ${automationsHtml ? sectionHead('Automation', 'jobs the daily sweep runs for you') + automationsHtml : ''}`;

  if (travelRulesHtml) loadTravelRulesCard();
}

// Settings → Travel: edit the destination × passport matrix the booking panel
// and reminders use. Owner-only (the API enforces it too). Loaded lazily so a
// non-owner never fetches it.
async function loadTravelRulesCard() {
  const el = document.getElementById('travelRulesBody');
  if (!el) return;
  let d;
  try { d = await kcFetch('/api/travel-rules').then(r => r.json()); } catch { d = null; }
  if (!d || !d.success) { el.innerHTML = `<div style="color:var(--muted);font-size:var(--fs-body);">${escHtml(d?.error || 'Could not load rules.')}</div>`; return; }
  const natName = Object.fromEntries((d.nationalities || []).map(n => [n.code, n.name]));
  const destName = Object.fromEntries((d.destinations || []).map(x => [x.code, x.name]));
  const authOpts = (sel) => (d.authTypes || []).map(a => `<option value="${a.code}" ${a.code === sel ? 'selected' : ''}>${escHtml(a.label)}</option>`).join('');
  const byDest = {};
  (d.rules || []).forEach(r => { (byDest[r.destination] = byDest[r.destination] || []).push(r); });
  const blocks = (d.destinations || []).map(dd => {
    const rows = (byDest[dd.code] || []).map(r => `
      <tr data-dest="${escHtml(r.destination)}" data-nat="${escHtml(r.nationality)}">
        <td>${escHtml(natName[r.nationality] || r.nationality)}</td>
        <td><select class="form-input tr-auth" style="min-height:0;padding:6px 8px;font-size:var(--fs-body);">${authOpts(r.authType)}</select></td>
        <td><input class="form-input tr-note" value="${escHtml(r.note || '')}" placeholder="optional note" style="min-height:0;padding:6px 8px;font-size:var(--fs-body);width:100%;"></td>
        <td><button class="btn btn-outline btn-sm" style="font-size:var(--fs-small);padding:4px 10px;" onclick="saveTravelRule(this)">Save</button></td>
      </tr>`).join('');
    return `<div style="margin-bottom:14px;">
      <div style="font-weight:600;margin-bottom:4px;">${escHtml(destName[dd.code] || dd.code)}</div>
      <div class="table-wrap"><table><thead><tr><th>Passport</th><th>Needs</th><th>Note</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    </div>`;
  }).join('');
  el.innerHTML = `<div style="font-size:var(--fs-small);color:var(--muted);margin-bottom:10px;">
    Change what each passport needs for each destination — used by the 🛂 panel on bookings and the reminders. New booking views pick up changes within a minute. Guidance only; always confirm on the official site.</div>${blocks}`;
}

async function saveTravelRule(btn) {
  const tr = btn.closest('tr');
  if (!tr) return;
  const payload = {
    destination: tr.dataset.dest,
    nationality: tr.dataset.nat,
    authType: tr.querySelector('.tr-auth').value,
    note: tr.querySelector('.tr-note').value.trim(),
    active: true,
  };
  const res = await kcFetch('/api/travel-rules', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }).then(r => r.json()).catch(() => null);
  if (!res || !res.success) { toast(res?.error || 'Could not save the rule.', 'error'); return; }
  toast('Rule saved ✓', 'success');
}

// Settings → Messaging: prove the Twilio connection end-to-end. The server
// gate still applies, so this is safe to press in any mode.
async function sendTestSms() {
  const to = document.getElementById('smsTestTo')?.value?.trim();
  if (!to) { toast('Type the number to text first (your own).', 'warning'); return; }
  const res = await kcFetch('/api/sms-test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to }),
  }).then(r => r.json()).catch(() => null);
  if (!res || !res.success) { toast(res?.error || 'Test failed.', 'error'); return; }
  if (res.held) toast('Twilio is connected, but SMS is on HOLD — the test was built and logged, nothing sent. Set SMS_TEST_TO or SMS_LIVE to send for real.', 'success');
  else if (res.redirectedTo) toast(`Sent — redirected to the test number ${res.redirectedTo} (TEST mode).`, 'success');
  else toast(`Sent to ${res.sentTo} ✔ The Twilio connection works.`, 'success');
}

// ── Collapsible settings cards ───────────────────────────────────────────
// Open/closed state lives in localStorage so it survives the re-render that
// follows every save. Everything starts collapsed — the page is a directory,
// you open what you're working on.
function settingsOpenState() {
  try { return JSON.parse(localStorage.getItem('kcSettingsOpen')) || {}; } catch { return {}; }
}
function settingsCard(key, title, subtitle, bodyHtml) {
  const open = !!settingsOpenState()[key];
  return `
    <div class="table-card settings-card" style="margin-bottom:12px;">
      <div onclick="toggleSettingsCard('${key}')"
        style="display:flex;align-items:center;gap:10px;padding:13px 16px;cursor:pointer;user-select:none;">
        <span id="scChev_${key}" style="font-size:var(--fs-micro);color:var(--muted);transition:transform 0.15s;display:inline-block;${open ? 'transform:rotate(90deg);' : ''}">▶</span>
        <strong style="font-size:var(--fs-ui);">${title}</strong>
        ${subtitle ? `<span style="color:var(--muted);font-size:var(--fs-small);font-weight:400;">${subtitle}</span>` : ''}
      </div>
      <div id="scBody_${key}" style="${open ? '' : 'display:none;'}">${bodyHtml}</div>
    </div>`;
}
function toggleSettingsCard(key) {
  const body = document.getElementById(`scBody_${key}`);
  const chev = document.getElementById(`scChev_${key}`);
  if (!body) return;
  const nowOpen = body.style.display === 'none';
  body.style.display = nowOpen ? '' : 'none';
  if (chev) chev.style.transform = nowOpen ? 'rotate(90deg)' : '';
  const state = settingsOpenState();
  state[key] = nowOpen;
  localStorage.setItem('kcSettingsOpen', JSON.stringify(state));
}

async function applySettingUpdate(payload) {
  const res = await window.api.updateSetting(payload);
  if (!res.success) { toast(res.error || 'Could not save.', 'error'); return false; }
  (res.warnings || []).forEach(w => toast(w, 'warning'));
  toast('Saved ✔ New calculations use the updated value.', 'success');
  pricingConfig = await window.api.getSettings().catch(() => pricingConfig);
  return true;
}

async function saveRentalRate(code) {
  const raw = {
    ratePerDay:    document.getElementById(`rr_rate_${code}`).value,
    minCharge:     document.getElementById(`rr_min_${code}`).value,
    cap:           document.getElementById(`rr_cap_${code}`).value,
    capPeriodDays: document.getElementById(`rr_period_${code}`).value,
    vnWeekly:      document.getElementById(`rr_vnw_${code}`).value,
    vnPer30Days:   document.getElementById(`rr_vnm_${code}`).value,
  };
  // An emptied field means "leave as is" — never send '' (it would save as 0).
  await applySettingUpdate({
    table: 'rental_rates', key: code,
    values: Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== '')),
  });
}

async function saveDamageRate(code) {
  await applySettingUpdate({
    table: 'damage_rates', key: code,
    values: {
      phoneDamageLoss: document.getElementById(`dr_phone_${code}`).value,
      chargerMissing:  document.getElementById(`dr_charger_${code}`).value,
      simMissing:      document.getElementById(`dr_sim_${code}`).value,
    },
  });
}

async function saveSettingKey(key) {
  await applySettingUpdate({
    table: 'settings', key,
    values: { numValue: document.getElementById(`st_${key}`).value },
  });
}

async function saveOpeningHours() {
  await applySettingUpdate({
    table: 'settings', key: 'opening_hours',
    values: { textValue: document.getElementById('stOpeningHours').value },
  });
}

// ── Accounts & subscriptions register ────────────────────────────────────
let bizAccountsCache = [];

function openBizAccountModal(id = null) {
  const a = id ? bizAccountsCache.find(x => x.id === id) : null;
  const cats = [['infrastructure', 'Infrastructure'], ['telecom', 'Telecom'], ['ivr', 'IVR / PBX'], ['email', 'Email'], ['finance', 'Finance'], ['other', 'Other']];
  showDynamicModal(`
    <div class="modal-title">${a ? '✏️ Edit account' : '➕ Add account'}</div>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Name *</label>
        <input class="form-input" id="baName" value="${escHtml(a?.name || '')}" placeholder="e.g. Twilio">
      </div>
      <div class="form-group">
        <label class="form-label">Category</label>
        <select class="form-input" id="baCategory">
          ${cats.map(([k, l]) => `<option value="${k}" ${a?.category === k ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>
      <div class="form-group form-full">
        <label class="form-label">Login page URL</label>
        <input class="form-input" id="baUrl" value="${escHtml(a?.url || '')}" placeholder="https://…">
      </div>
      <div class="form-group">
        <label class="form-label">Login email / user</label>
        <input class="form-input" id="baLogin" value="${escHtml(a?.loginEmail || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Password ${a?.hasCred ? '<span style="color:var(--muted);font-weight:400;">(stored — leave empty to keep, type "-" to clear)</span>' : '<span style="color:var(--muted);font-weight:400;">(stored encrypted)</span>'}</label>
        <input class="form-input" id="baCred" type="password" autocomplete="new-password" placeholder="${a?.hasCred ? '••••••••' : ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Cost £/month</label>
        <input class="form-input" type="number" step="0.01" min="0" id="baCost" value="${a?.monthlyCost ?? ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Next renewal</label>
        <input class="form-input" type="date" id="baRenewal" value="${escHtml(a?.renewalDate || '')}">
      </div>
      <div class="form-group form-full">
        <label class="form-label">Notes</label>
        <input class="form-input" id="baNotes" value="${escHtml(a?.notes || '')}" placeholder="what it's for, who pays, recovery details…">
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeDynamicModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveBizAccount(${a ? `'${a.id}'` : 'null'})">💾 Save</button>
    </div>
  `);
}

async function saveBizAccount(id) {
  const res = await kcFetch('/api/business-accounts', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      op: 'save', id: id || undefined,
      name: document.getElementById('baName').value,
      category: document.getElementById('baCategory').value,
      url: document.getElementById('baUrl').value,
      loginEmail: document.getElementById('baLogin').value,
      credential: document.getElementById('baCred').value,
      monthlyCost: document.getElementById('baCost').value,
      renewalDate: document.getElementById('baRenewal').value,
      notes: document.getElementById('baNotes').value,
    }),
  }).then(r => r.json()).catch(() => ({ success: false, error: 'Network error.' }));
  if (!res.success) { toast(res.error || 'Could not save.', 'error'); return; }
  toast('Saved ✔', 'success');
  closeDynamicModal();
  renderSettingsTab();
}

async function revealBizAccount(id) {
  const res = await kcFetch('/api/business-accounts', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'reveal', id }),
  }).then(r => r.json()).catch(() => ({ success: false }));
  if (!res.success) { toast(res.error || 'Could not reveal.', 'error'); return; }
  const a = bizAccountsCache.find(x => x.id === id);
  showDynamicModal(`
    <div class="modal-title">🔑 ${escHtml(a?.name || 'Credential')}</div>
    <div style="font-size:var(--fs-small);color:var(--muted);margin-bottom:8px;">Shown once — close this when you've used it.</div>
    <input class="form-input" readonly value="${escHtml(res.credential)}" onclick="this.select()" style="font-family:monospace;">
    <div class="modal-actions">
      <button class="btn btn-primary" onclick="closeDynamicModal()">Close</button>
    </div>
  `);
}

async function retireBizAccount(id, name) {
  if (!confirm(`Retire "${name}" from the register? (It's kept in the database, just hidden.)`)) return;
  const res = await kcFetch('/api/business-accounts', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'retire', id }),
  }).then(r => r.json()).catch(() => ({ success: false }));
  if (!res.success) { toast(res.error || 'Could not retire.', 'error'); return; }
  toast('Retired ✔', 'success');
  renderSettingsTab();
}

// ── Phone guide editor ───────────────────────────────────────────────────
let phoneModelsCache = [];

function openPhoneModelModal(id = null) {
  const m = id ? phoneModelsCache.find(x => x.id === id) : null;
  showDynamicModal(`
    <div class="modal-title">${m ? '✏️ Edit ' + escHtml(m.name) : '➕ Add phone'}</div>
    <div style="font-size:var(--fs-small);color:var(--muted);margin-bottom:10px;">Everything here shows on the public phone guide, except the internal notes. Pros and cons: one point per line.</div>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Phone name *</label>
        <input class="form-input" id="pmName" value="${escHtml(m?.name || '')}" placeholder="e.g. FIG Pro">
      </div>
      <div class="form-group">
        <label class="form-label">Price £ <span style="color:var(--muted);font-weight:400;">(empty = "Ask in shop")</span></label>
        <input class="form-input" type="number" step="0.01" min="0" id="pmPrice" value="${m?.price ?? ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Order on the guide <span style="color:var(--muted);font-weight:400;">(1 = top)</span></label>
        <input class="form-input" type="number" step="1" id="pmOrder" value="${m?.sortOrder ?? (phoneModelsCache.length + 1)}">
      </div>
      <div class="form-group">
        <label class="form-label">Dual SIM</label>
        <input class="form-input" id="pmDual" value="${escHtml(m?.dualSim || '')}" placeholder="Yes / No / Yes (second SIM is 2G)">
      </div>
      <div class="form-group">
        <label class="form-label">Hebrew text</label>
        <input class="form-input" id="pmYiddish" value="${escHtml(m?.yiddishText || '')}" placeholder="Yes / No">
      </div>
      <div class="form-group">
        <label class="form-label">Touch-screen</label>
        <input class="form-input" id="pmTouch" value="${escHtml(m?.touchScreen || '')}" placeholder="Yes / No / Semi">
      </div>
      <div class="form-group">
        <label class="form-label">Texting</label>
        <input class="form-input" id="pmTexting" value="${escHtml(m?.texting || '')}" placeholder="Optional / With text / No text / OTP only">
      </div>
      <div class="form-group form-full">
        <label class="form-label">Pros <span style="color:var(--muted);font-weight:400;">(one per line — shown with a ✓)</span></label>
        <textarea class="form-input" id="pmPros" rows="4" placeholder="Big clear buttons&#10;Battery lasts all week">${escHtml(m?.pros || '')}</textarea>
      </div>
      <div class="form-group form-full">
        <label class="form-label">Cons <span style="color:var(--muted);font-weight:400;">(one per line — honest, like we'd say it in the shop)</span></label>
        <textarea class="form-input" id="pmCons" rows="4" placeholder="No camera&#10;Speaker on the quiet side">${escHtml(m?.cons || '')}</textarea>
      </div>
      <div class="form-group form-full">
        <label class="form-label">Internal notes <span style="color:var(--muted);font-weight:400;">(never shown publicly)</span></label>
        <input class="form-input" id="pmNotes" value="${escHtml(m?.notes || '')}" placeholder="supplier, stock quirks…">
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeDynamicModal()">Cancel</button>
      <button class="btn btn-primary" onclick="savePhoneModel(${m ? `'${m.id}'` : 'null'})">💾 Save</button>
    </div>
  `);
}

async function savePhoneModel(id) {
  const res = await kcFetch('/api/phone-guide', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      op: 'save', id: id || undefined,
      name: document.getElementById('pmName').value,
      price: document.getElementById('pmPrice').value,
      sortOrder: document.getElementById('pmOrder').value,
      dualSim: document.getElementById('pmDual').value,
      yiddishText: document.getElementById('pmYiddish').value,
      touchScreen: document.getElementById('pmTouch').value,
      texting: document.getElementById('pmTexting').value,
      pros: document.getElementById('pmPros').value,
      cons: document.getElementById('pmCons').value,
      notes: document.getElementById('pmNotes').value,
    }),
  }).then(r => r.json()).catch(() => ({ success: false, error: 'Network error.' }));
  if (!res.success) { toast(res.error || 'Could not save.', 'error'); return; }
  toast('Saved ✔ The public guide updates within a few minutes.', 'success');
  closeDynamicModal();
  renderSettingsTab();
}

async function retirePhoneModel(id, name) {
  if (!confirm(`Take "${name}" off the public guide? (Kept here — you can restore it any time.)`)) return;
  const res = await kcFetch('/api/phone-guide', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'retire', id }),
  }).then(r => r.json()).catch(() => ({ success: false }));
  if (!res.success) { toast(res.error || 'Could not update.', 'error'); return; }
  toast('Hidden from the guide ✔', 'success');
  renderSettingsTab();
}

async function restorePhoneModel(id) {
  const res = await kcFetch('/api/phone-guide', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'restore', id }),
  }).then(r => r.json()).catch(() => ({ success: false }));
  if (!res.success) { toast(res.error || 'Could not update.', 'error'); return; }
  toast('Back on the guide ✔', 'success');
  renderSettingsTab();
}

// ── Adding rows to the rate / fee cards ──────────────────────────────────
async function applySettingAdd(payload) {
  const res = await window.api.addSetting(payload);
  if (!res.success) { toast(res.error || 'Could not add.', 'error'); return; }
  toast('Added ✔', 'success');
  pricingConfig = await window.api.getSettings().catch(() => pricingConfig);
  renderSettingsTab();
}

async function addRentalRate() {
  const code = document.getElementById('rrNew_code').value.trim().toUpperCase();
  if (!code) { toast('Enter a country code (e.g. FR).', 'error'); return; }
  await applySettingAdd({
    table: 'rental_rates', countryCode: code,
    displayName: document.getElementById('rrNew_name').value.trim() || code,
    ratePerDay: document.getElementById('rrNew_rate').value,
    minCharge: document.getElementById('rrNew_min').value,
    cap: document.getElementById('rrNew_cap').value,
    capPeriodDays: document.getElementById('rrNew_period').value,
    vnWeekly: document.getElementById('rrNew_vnw').value,
    vnPer30Days: document.getElementById('rrNew_vnm').value,
  });
}

async function addDamageRate() {
  const code = document.getElementById('drNew_code').value.trim().toUpperCase();
  if (!code) { toast('Enter a country code.', 'error'); return; }
  await applySettingAdd({
    table: 'damage_rates', countryCode: code,
    phoneDamageLoss: document.getElementById('drNew_phone').value,
    chargerMissing: document.getElementById('drNew_charger').value,
    simMissing: document.getElementById('drNew_sim').value,
  });
}

// ── Extra charges (owner-defined auto fees) ──────────────────────────────
let extraChargeCache = [];

async function addExtraCharge() {
  const label = document.getElementById('ecNew_label').value.trim();
  const amount = parseFloat(document.getElementById('ecNew_amount').value);
  if (!label) { toast('Give the charge a name.', 'error'); return; }
  if (!Number.isFinite(amount) || amount <= 0) { toast('Enter an amount greater than £0.', 'error'); return; }
  const res = await kcFetch('/api/custom-charges', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label, amount,
      appliesTo: document.getElementById('ecNew_target').value,
      mode: document.getElementById('ecNew_mode').value }),
  }).then(r => r.json()).catch(() => null);
  if (!res || !res.success) { toast(res?.error || 'Could not add.', 'error'); return; }
  toast(`"${res.charge.label}" added — the app will bill it automatically.`, 'success');
  renderSettingsTab();
}

async function saveExtraCharge(id) {
  const res = await kcFetch('/api/custom-charges', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id,
      label: document.getElementById(`ec_label_${id}`).value,
      amount: document.getElementById(`ec_amount_${id}`).value,
      appliesTo: document.getElementById(`ec_target_${id}`).value,
      mode: document.getElementById(`ec_mode_${id}`).value,
      active: !!document.getElementById(`ec_active_${id}`).checked }),
  }).then(r => r.json()).catch(() => null);
  if (!res || !res.success) { toast(res?.error || 'Could not save.', 'error'); return; }
  toast(`${res.charge.label} saved.`, 'success');
}

async function deleteExtraCharge(id) {
  const ok = await window.api.confirmDelete('Remove this extra charge?\n\nIt stops applying to new charges; past ones are unaffected.');
  if (!ok) return;
  const res = await kcFetch('/api/custom-charges?id=' + encodeURIComponent(id), { method: 'DELETE' })
    .then(r => r.json()).catch(() => null);
  if (!res || !res.success) { toast(res?.error || 'Could not remove.', 'error'); return; }
  toast('Removed.', 'warning');
  renderSettingsTab();
}

async function deleteRateRow(table, code) {
  const ok = await window.api.confirmDelete(
    `Remove ${code} from ${table === 'rental_rates' ? 'rental rates' : 'damage charges'}?\n\nExisting rentals keep their frozen prices; only new calculations are affected.`
  );
  if (!ok) return;
  const res = await window.api.deleteSetting(table, code);
  if (!res.success) { toast(res.error || 'Could not remove.', 'error'); return; }
  toast(`${code} removed.`, 'warning');
  pricingConfig = await window.api.getSettings().catch(() => pricingConfig);
  renderSettingsTab();
}

// The daily 06:00 cron runs these on production; this button runs them on
// demand (and is how previews exercise them — crons don't fire on previews).
async function runSweepsNow() {
  toast('Running sweeps…', 'warning');
  const res = await kcFetch('/api/cron/sweep', { method: 'POST' }).then(r => r.json()).catch(() => null);
  if (!res?.success) { toast(res?.error || 'Sweeps failed — check logs.', 'error'); return; }
  const c = res.counts;
  toast(`Sweeps done: ${c.rentalsFlippedOverdue} flipped overdue · ${c.overdueTasks + c.balanceTasks + c.passportTasks + c.simRenewalTasks} tasks raised · ${c.overdueClosed + c.balanceClosed + c.simClosed} closed.`, 'success');
}

// ── Service price menu (admin-editable price list) ──────────────────────

let menuItemsCache = [];

async function saveMenuItem(id) {
  const val = (fid) => {
    const v = document.getElementById(fid)?.value;
    return v === '' || v === undefined ? null : parseFloat(v);
  };
  const res = await kcFetch('/api/services', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      name: document.getElementById(`mi_name_${id}`)?.value || '',
      price: val(`mi_price_${id}`) ?? 0,
      kcPrice: val(`mi_kc_${id}`),
      repeatPrice: val(`mi_rep_${id}`),
      bulkPrice: val(`mi_bulk_${id}`),
      active: !!document.getElementById(`mi_active_${id}`)?.checked,
    }),
  }).then(r => r.json()).catch(() => null);
  if (!res || !res.success) { toast(res?.error || 'Could not save.', 'error'); return; }
  // Charging screens re-fetch their menus when opened, so no cache to fix.
  toast(`${res.item.name} saved.`, 'success');
}

async function addMenuItem() {
  const name = document.getElementById('miNewName')?.value.trim();
  const price = parseFloat(document.getElementById('miNewPrice')?.value);
  if (!name) { toast('Enter a service name.', 'error'); return; }
  if (!Number.isFinite(price) || price < 0) { toast('Enter a price (£0 or more).', 'error'); return; }
  const res = await kcFetch('/api/services', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, price, category: document.getElementById('miNewCat')?.value }),
  }).then(r => r.json()).catch(() => null);
  if (!res || !res.success) { toast(res?.error || 'Could not add it.', 'error'); return; }
  toast(`${res.item.name} added to the menu.`, 'success');
  renderSettingsTab();
}

// ── Email addresses (owner-only, Forward Email aliases) ─────────────────

let emailAliasCache = [];

function openEmailAliasModal(id = null) {
  const a = id ? emailAliasCache.find(x => x.id === id) : null;
  showDynamicModal(`
    <div class="modal-title">📧 ${a ? 'Edit ' + escHtml(a.address) : 'New email address'}</div>
    <div class="form-grid">
      ${a ? '' : `<div class="form-group">
        <label class="form-label">Address</label>
        <div style="display:flex;align-items:center;gap:6px;">
          <input class="form-input" id="eaName" placeholder="reminder" style="flex:1;">
          <span style="font-size:var(--fs-body);color:var(--muted);white-space:nowrap;">@kosher-connect.com</span>
        </div>
      </div>`}
      <div class="form-group ${a ? 'form-full' : ''}">
        <label class="form-label">Forwards to (comma-separated)</label>
        <input class="form-input" id="eaRecipients" placeholder="yourinbox@gmail.com"
          value="${a ? escHtml(a.recipients.join(', ')) : ''}">
      </div>
      <div class="form-group form-full">
        <label class="form-label">Purpose (optional)</label>
        <input class="form-input" id="eaDesc" placeholder="e.g. customer reminders" value="${a ? escHtml(a.description) : ''}">
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeDynamicModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveEmailAlias(${a ? `'${escHtml(a.id)}'` : 'null'})">💾 Save</button>
    </div>
  `);
}

async function saveEmailAlias(id) {
  const body = {
    recipients: document.getElementById('eaRecipients').value,
    description: document.getElementById('eaDesc').value.trim(),
  };
  if (!id) body.name = document.getElementById('eaName').value.trim();
  else body.id = id;
  const res = await kcFetch('/api/email-aliases', {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json()).catch(() => null);
  if (!res || !res.success) { toast(res?.error || 'Could not save the address.', 'error'); return; }
  closeDynamicModal();
  toast(id ? 'Address updated.' : `${res.alias.address} created ✔`, 'success');
  renderSettingsTab();
}

async function toggleEmailAlias(id, enabled) {
  const res = await kcFetch('/api/email-aliases', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, enabled }),
  }).then(r => r.json()).catch(() => null);
  if (!res || !res.success) { toast(res?.error || 'Could not update.', 'error'); renderSettingsTab(); return; }
  toast(enabled ? 'Address enabled.' : 'Address disabled — mail to it now bounces.', enabled ? 'success' : 'warning');
}

async function deleteEmailAlias(id, address) {
  const ok = await window.api.confirmDelete(`Delete ${address}?\n\nMail sent to it will bounce, and any SMTP password for it stops working.`);
  if (!ok) return;
  const res = await kcFetch('/api/email-aliases?id=' + encodeURIComponent(id), { method: 'DELETE' })
    .then(r => r.json()).catch(() => null);
  if (!res || !res.success) { toast(res?.error || 'Could not delete.', 'error'); return; }
  toast(`${address} deleted.`, 'warning');
  renderSettingsTab();
}

async function generateAliasPassword(id, address) {
  const ok = await kcConfirm({
    title: 'Generate SMTP password',
    body: `New sending password for <strong>${escHtml(address)}</strong>.<br>
      <span style="color:var(--danger-ink);">Any previous password for this address stops working immediately</span> — you'll need to update it wherever it's used (Vercel SMTP_PASS, Gmail send-as).`,
    okLabel: 'Generate password',
  });
  if (!ok) return;
  const res = await kcFetch('/api/email-aliases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'password', id }),
  }).then(r => r.json()).catch(() => null);
  if (!res || !res.success) { toast(res?.error || 'Could not generate a password.', 'error'); return; }
  // Shown ONCE — Forward Email never reveals it again, and we don't store it.
  showDynamicModal(`
    <div class="modal-title">🔑 SMTP password — shown once</div>
    <div style="font-size:var(--fs-body);line-height:1.7;">
      <div style="margin-bottom:10px;color:var(--muted);">Copy these now — this password can't be viewed again (only regenerated).</div>
      <div style="display:grid;grid-template-columns:auto 1fr;gap:6px 12px;font-size:var(--fs-body);">
        <span style="color:var(--muted);">Server</span><strong>smtp.forwardemail.net : 465 (SSL)</strong>
        <span style="color:var(--muted);">Username</span>
        <strong style="cursor:pointer;" onclick="copyText('${escHtml(res.username)}')" title="Click to copy">${escHtml(res.username)} 📋</strong>
        <span style="color:var(--muted);">Password</span>
        <strong style="cursor:pointer;font-family:monospace;" onclick="copyText('${escHtml(res.password)}')" title="Click to copy">${escHtml(res.password)} 📋</strong>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-primary" onclick="closeDynamicModal()">Done — I've copied it</button>
    </div>
  `);
}

// ── Login credentials ────────────────────────────────────────────────────

function openChangePasswordModal() {
  showDynamicModal(`
    <div class="modal-title">🔑 Change my password</div>
    <div class="form-grid">
      <div class="form-group form-full">
        <label class="form-label">Current password</label>
        <input class="form-input" type="password" id="cpCurrent" autocomplete="current-password">
      </div>
      <div class="form-group">
        <label class="form-label">New password (8+)</label>
        <input class="form-input" type="password" id="cpNew" autocomplete="new-password">
      </div>
      <div class="form-group">
        <label class="form-label">Repeat new password</label>
        <input class="form-input" type="password" id="cpNew2" autocomplete="new-password">
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeDynamicModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveChangePassword()">🔑 Change</button>
    </div>
  `);
}

async function saveChangePassword() {
  const now = document.getElementById('cpCurrent').value;
  const next = document.getElementById('cpNew').value;
  if (next.length < 8) { toast('New password must be at least 8 characters.', 'error'); return; }
  if (next !== document.getElementById('cpNew2').value) { toast('New passwords do not match.', 'error'); return; }
  const res = await kcFetch('/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword: now, newPassword: next }),
  }).then(r => r.json()).catch(() => null);
  if (!res || !res.success) { toast(res?.error || 'Could not change the password.', 'error'); return; }
  closeDynamicModal();
  toast('Password changed. Use the new one from your next sign-in.', 'success');
}

function openResetPasswordModal(id, label) {
  showDynamicModal(`
    <div class="modal-title">🔑 Reset password — ${escHtml(label)}</div>
    <div style="font-size:var(--fs-small);color:var(--muted);margin-bottom:12px;">
      Admin reset: no current password needed. Tell them the new one in person.</div>
    <div class="form-group">
      <label class="form-label">New password (8+)</label>
      <input class="form-input" type="password" id="rpNewPw" autocomplete="new-password">
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeDynamicModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveResetPassword('${escHtml(id)}')">🔑 Set password</button>
    </div>
  `);
}

async function saveResetPassword(id) {
  const pw = document.getElementById('rpNewPw').value;
  if (pw.length < 8) { toast('Password must be at least 8 characters.', 'error'); return; }
  const res = await kcFetch('/api/team', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, password: pw }),
  }).then(r => r.json()).catch(() => null);
  if (!res || !res.success) { toast(res?.error || 'Could not reset the password.', 'error'); return; }
  closeDynamicModal();
  toast('Password reset — it takes effect on their next sign-in.', 'success');
}

async function saveHelperTabs() {
  const list = [...document.querySelectorAll('.htTab:checked')].map(el => el.value);
  if (!list.length) { toast('Helpers need at least one tab.', 'error'); return; }
  const ok = await applySettingUpdate({
    table: 'settings', key: 'helper_tabs',
    values: { textValue: list.join(',') },
  });
  if (ok) toast('Helper access updated — applies on their next page load.', 'success');
}

// IVR / VN provider list (feature #10). Comma-separated; the server sanitises
// and de-dups. Re-render so the chips + VN dropdown reflect the new list.
async function saveIvrPlatforms() {
  const raw = document.getElementById('ivrPlatformsInput')?.value || '';
  const list = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (!list.length) { toast('Add at least one provider.', 'error'); return; }
  const ok = await applySettingUpdate({
    table: 'settings', key: 'ivr_platforms',
    values: { textValue: list.join(',') },
  });
  if (ok) { toast('Providers updated.', 'success'); renderSettingsTab(); }
}

// ── Team management (owner-only; server enforces) ──

async function saveNewTeamMember() {
  const payload = {
    fullName: document.getElementById('tmName').value.trim(),
    email: document.getElementById('tmEmail').value.trim(),
    password: document.getElementById('tmPassword').value,
    role: document.getElementById('tmRole').value,
  };
  if (!payload.email) { toast('Email is required.', 'error'); return; }
  if (!payload.password || payload.password.length < 8) { toast('Password must be at least 8 characters.', 'error'); return; }
  const res = await kcFetch('/api/team', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(r => r.json());
  if (!res.success) { toast(res.error || 'Could not add the member.', 'error'); return; }
  toast(`${payload.email} added as ${payload.role} ✔ They can sign in right away.`, 'success');
  renderSettingsTab();
}

async function changeTeamRole(id, role) {
  const res = await kcFetch('/api/team', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, role }),
  }).then(r => r.json());
  if (!res.success) { toast(res.error || 'Could not change the role.', 'error'); }
  renderSettingsTab();
}

async function removeTeamMember(id, label, isSelf = false) {
  const ok = await window.api.confirmDelete(isSelf
    ? `Remove YOURSELF from the team?\n\nYou will be signed out immediately and lose all access. Only possible while another admin remains.`
    : `Remove "${label}" from the team?\n\nTheir access stops immediately. The login account is kept but no longer works for this app.`);
  if (!ok) return;
  const res = await kcFetch('/api/team?id=' + encodeURIComponent(id), { method: 'DELETE' }).then(r => r.json());
  if (!res.success) { toast(res.error || 'Could not remove the member.', 'error'); return; }
  if (res.removedSelf) {
    await kcFetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    window.location.href = '/login';
    return;
  }
  toast('Team member removed.', 'warning');
  renderSettingsTab();
}

// ── Automations (owner-only; server enforces) ──
let autoTriggers = {
  balance_over:        { label: 'Customer owes at least £N', unit: '£' },
  rental_overdue_days: { label: 'Rental overdue by N+ days', unit: 'days' },
  flight_in_days:      { label: 'Flight within N days', unit: 'days' },
  passport_in_days:    { label: 'Passport expires within N days', unit: 'days' },
  sim_renewal_in_days: { label: 'SIM renews within N days', unit: 'days' },
  checkin_due:         { label: 'We-do check-in within N days (not done)', unit: 'days' },
};
let autoRulesCache = [];

function openAutomationModal(id = null) {
  // Cache is refreshed on each settings render via the API list; find by id.
  const r = id ? autoRulesCache.find(x => x.id === id) : null;
  const trigOptions = Object.entries(autoTriggers).map(([k, t]) =>
    `<option value="${k}" ${r && r.trigger === k ? 'selected' : ''}>${escHtml(t.label)}</option>`).join('');
  showDynamicModal(`
    <div class="modal-title">🤖 ${r ? 'Edit' : 'New'} automation rule</div>
    <div class="form-grid">
      <div class="form-group form-full">
        <label class="form-label">Rule name</label>
        <input class="form-input" id="auName" value="${escHtml(r?.name || '')}" placeholder="e.g. Chase big debtors">
      </div>
      <div class="form-group form-full">
        <label class="form-label">When…</label>
        <select class="form-input" id="auTrigger">${trigOptions}</select>
      </div>
      <div class="form-group">
        <label class="form-label">Threshold (£ or days)</label>
        <input class="form-input" type="number" min="0" step="1" id="auThreshold" value="${r?.threshold ?? ''}" placeholder="e.g. 100 or 7">
      </div>
      <div class="form-group">
        <label class="form-label">Task priority</label>
        <select class="form-input" id="auPriority">
          ${['high', 'medium', 'low'].map(p => `<option value="${p}" ${(r?.priority || 'high') === p ? 'selected' : ''}>${p}</option>`).join('')}
        </select>
      </div>
      <div class="form-group form-full">
        <label class="form-label">Task title <span style="color:var(--muted);font-weight:400;">(optional — {name} = customer, {n} = the number)</span></label>
        <input class="form-input" id="auTitle" value="${escHtml(r?.taskTitle || '')}" placeholder="Chase {name} — owes £{n}">
      </div>
    </div>
    <div style="font-size:var(--fs-micro);color:var(--muted);margin-top:6px;">The rule raises a task in the daily sweep for every matching customer, and closes it automatically when the condition clears.</div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeDynamicModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveAutomation(${r ? `'${escHtml(r.id)}'` : 'null'})">💾 Save rule</button>
    </div>
  `);
}

async function saveAutomation(id) {
  const payload = {
    id: id || undefined,
    name: document.getElementById('auName').value.trim(),
    trigger: document.getElementById('auTrigger').value,
    threshold: parseFloat(document.getElementById('auThreshold').value),
    priority: document.getElementById('auPriority').value,
    taskTitle: document.getElementById('auTitle').value.trim(),
  };
  if (!payload.name) { toast('Give the rule a name.', 'error'); return; }
  if (!Number.isFinite(payload.threshold)) { toast('Enter a threshold.', 'error'); return; }
  const res = await kcFetch('/api/automations', {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(r => r.json()).catch(() => null);
  if (!res || !res.success) { toast(res?.error || 'Could not save the rule.', 'error'); return; }
  closeDynamicModal();
  toast('Automation saved.', 'success');
  renderSettingsTab();
}

async function toggleAutomation(id, enabled) {
  const r = autoRulesCache.find(x => x.id === id);
  if (!r) return;
  const res = await kcFetch('/api/automations', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...r, enabled }),
  }).then(r => r.json()).catch(() => null);
  if (!res || !res.success) { toast(res?.error || 'Could not update.', 'error'); renderSettingsTab(); return; }
  toast(enabled ? 'Rule on.' : 'Rule paused.', 'success');
  renderSettingsTab();
}

async function deleteAutomation(id) {
  const ok = await window.api.confirmDelete('Delete this automation rule?\n\nAny open tasks it raised stay; it just stops running.');
  if (!ok) return;
  const res = await kcFetch('/api/automations?id=' + encodeURIComponent(id), { method: 'DELETE' }).then(r => r.json());
  if (!res.success) { toast(res.error || 'Could not delete.', 'error'); return; }
  toast('Rule deleted.', 'warning');
  renderSettingsTab();
}

// ─────────────────────────────────────────────
//  DOUBLE-SUBMIT GUARD
// ─────────────────────────────────────────────
// The async save handlers await API calls before closing their modal, so a
// double-click fires the handler twice and creates duplicate records (or a
// duplicate payment). Wrap them so re-entrant calls are ignored while a save
// is in flight. Inline onclick handlers resolve these names at click time,
// so rebinding here covers every call site.
function guardReentry(fn) {
  let inFlight = false;
  return async function (...args) {
    if (inFlight) return;
    inFlight = true;
    try {
      return await fn.apply(this, args);
    } finally {
      inFlight = false;
    }
  };
}
saveCustomer     = guardReentry(saveCustomer);
saveWalletEntry  = guardReentry(saveWalletEntry);
saveNewBooking   = guardReentry(saveNewBooking);
savePassengers   = guardReentry(savePassengers);
saveCheckin      = guardReentry(saveCheckin);
saveEditBooking  = guardReentry(saveEditBooking);
saveNewRepair    = guardReentry(saveNewRepair);
changeRepairStatus = guardReentry(changeRepairStatus);
confirmCollectRepair = guardReentry(confirmCollectRepair);
saveAutomation   = guardReentry(saveAutomation);
deleteAutomation = guardReentry(deleteAutomation);
saveEmailAlias   = guardReentry(saveEmailAlias);
saveMenuItem     = guardReentry(saveMenuItem);
addMenuItem      = guardReentry(addMenuItem);
deleteEmailAlias = guardReentry(deleteEmailAlias);
generateAliasPassword = guardReentry(generateAliasPassword);
saveNewTask      = guardReentry(saveNewTask);
saveRentalRate   = guardReentry(saveRentalRate);
saveDamageRate   = guardReentry(saveDamageRate);
saveSettingKey   = guardReentry(saveSettingKey);
addRentalRate    = guardReentry(addRentalRate);
addDamageRate    = guardReentry(addDamageRate);
addExtraCharge   = guardReentry(addExtraCharge);
saveExtraCharge  = guardReentry(saveExtraCharge);
deleteExtraCharge = guardReentry(deleteExtraCharge);
saveNewVN        = guardReentry(saveNewVN);
saveVNBilling    = guardReentry(saveVNBilling);
saveNewServiceOrder = guardReentry(saveNewServiceOrder);
saveReminder     = guardReentry(saveReminder);
saveCashup       = guardReentry(saveCashup);
startReservation = guardReentry(startReservation);
saveChangePassword = guardReentry(saveChangePassword);
saveResetPassword  = guardReentry(saveResetPassword);
saveStockItem    = guardReentry(saveStockItem);
saveSale         = guardReentry(saveSale);
deleteVN         = guardReentry(deleteVN);
saveNewTeamMember = guardReentry(saveNewTeamMember);
removeTeamMember  = guardReentry(removeTeamMember);
saveNewRental    = guardReentry(saveNewRental);
saveManageRental = guardReentry(saveManageRental);
saveSimForm      = guardReentry(saveSimForm);
addSimCharge     = guardReentry(addSimCharge);
addPayment       = guardReentry(addPayment);
deleteCustomer   = guardReentry(deleteCustomer);
deleteRental     = guardReentry(deleteRental);

// Fade out and remove the full-page boot loader. Safe to call more than once.
function hideBootLoader() {
  const boot = document.getElementById('kcBoot');
  if (!boot || boot.classList.contains('kc-boot-hide')) return;
  boot.classList.add('kc-boot-hide');
  setTimeout(() => boot.remove(), 450);
}

// ─────────────────────────────────────────────
//  START
// ─────────────────────────────────────────────
// Never let a boot error trap the operator behind the splash — reveal the
// shell even if the initial load throws (per-call catches already default to
// empty data, but this guards a truly fatal path).
initApp().catch(err => { console.error('[init] fatal', err); hideBootLoader(); });
