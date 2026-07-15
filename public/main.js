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

  getAllRentals: () => kcFetch('/api/rentals').then(r => r.json()),
  // Whole-array save. `deletedIds` names the ids the user actually removed;
  // the server deletes ONLY those (nothing is wiped just for being absent).
  saveAllRentals: (data, deletedIds = []) => kcFetch('/api/rentals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: data, deletedIds }),
  }).then(r => r.json()),

  getAllPhones: () => kcFetch('/api/phones').then(r => r.json()),
  saveAllPhones: (data, deletedIds = []) => kcFetch('/api/phones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: data, deletedIds }),
  }).then(r => r.json()),

  getAllSims: () => kcFetch('/api/sims').then(r => r.json()),
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

  getAllBookings: () => kcFetch('/api/bookings').then(r => r.ok ? r.json() : []),
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
let selectedId = null;
let currentTab = 'customers';
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
    window.api.getAllCustomers().catch(() => []),
    safeLoadArray('rentals', '/api/rentals'),
    safeLoadArray('phones', '/api/phones'),
    safeLoadArray('sims', '/api/sims'),
    window.api.getAllBookings().catch(() => []),
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
  filteredCustomers = [...customers];
  rentals = arr(rent);
  phones = arr(ph);
  sims = arr(sm);
  bookings = arr(bk);
  virtualNumbers = arr(vn);
  repairs = arr(rp);
  serviceOrders = arr(so);
  pricingConfig = cfg;
  simMenu = arr(menu);
  if (me?.success && me.authEnabled) {
    currentStaff = me.staff || null;
    allowedTabs = Array.isArray(me.allowedTabs) ? me.allowedTabs : null;
  }
  // A failed load of a whole-array collection: warn, block saves, offer reload.
  const failedKeys = Object.keys(loadFailed).filter(k => loadFailed[k]);
  if (failedKeys.length) showReloadBanner(`Couldn’t load ${failedKeys.join(', ')} — some data is missing. Saving is paused to protect your records.`);
  applyTabVisibility();
  reconcilePhoneStatuses();
  renderTab(allowedTabs && !allowedTabs.includes('dashboard') ? allowedTabs[0] : 'dashboard');
  setupNav();
  setupSearch();
  setupModal();
  setupTopbarButtons();
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
  let changed = false;
  phones.forEach(p => {
    const shouldBeRented = activePhoneIds.has(p.id);
    if (shouldBeRented && p.status !== 'rented') {
      p.status = 'rented';
      changed = true;
    } else if (!shouldBeRented && p.status === 'rented') {
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
  b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:6000;background:var(--danger);color:#fff;padding:11px 18px;text-align:center;font-size:14px;font-weight:500;box-shadow:0 2px 8px rgba(0,0,0,.2);';
  b.innerHTML = `⚠️ ${escHtml(msg)} <button onclick="location.reload()" style="margin-left:12px;background:#fff;color:var(--danger);border:none;border-radius:7px;padding:5px 14px;cursor:pointer;font-weight:700;">↻ Reload</button>`;
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
function setupNav() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      currentTab = item.dataset.tab;
      renderTab(currentTab);
    });
  });
}

// ── Helper visibility ─────────────────────────────────────────────────────
let currentStaff = null;   // { id, role, full_name, email }
let allowedTabs = null;    // null = everything (owner / auth off)

function applyTabVisibility() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.style.display = (allowedTabs && !allowedTabs.includes(item.dataset.tab)) ? 'none' : '';
  });
}

function renderTab(tab) {
  if (allowedTabs && !allowedTabs.includes(tab)) {
    toast('That area is not enabled for your account.', 'warning');
    return;
  }
  document.body.classList.remove('pos-mode'); // leaving the till via any nav
  const content = document.getElementById('mainContent');
  const searchBox = document.getElementById('searchBox');
  const btnNew = document.getElementById('btnNewCustomer');

  if (tab === 'dashboard') {
    document.getElementById('pageTitle').innerHTML = 'Business <span>Dashboard</span>';
    searchBox.style.display = 'none';
    btnNew.style.display = 'none';
    renderDashboardTab();
  } else if (tab === 'customers') {
    document.getElementById('pageTitle').innerHTML = 'Customer <span>Management</span>';
    searchBox.style.display = '';
    btnNew.style.display = '';
    renderCustomersTab();
  } else if (tab === 'rentals') {
    document.getElementById('pageTitle').innerHTML = 'Phone <span>Rentals</span>';
    searchBox.style.display = 'none';
    btnNew.style.display = 'none';
    renderRentalsTab();
  } else if (tab === 'sim') {
    document.getElementById('pageTitle').innerHTML = 'SIM <span>Plans</span>';
    searchBox.style.display = 'none';
    btnNew.style.display = 'none';
    renderSimsTab();
  } else if (tab === 'bookings') {
    document.getElementById('pageTitle').innerHTML = 'Tickets <span>& Flights</span>';
    searchBox.style.display = 'none';
    btnNew.style.display = 'none';
    renderBookingsTab();
  } else if (tab === 'wallet') {
    document.getElementById('pageTitle').innerHTML = 'Wallet <span>& Ledger</span>';
    searchBox.style.display = 'none';
    btnNew.style.display = 'none';
    renderWalletTab();
  } else if (tab === 'repairs') {
    document.getElementById('pageTitle').innerHTML = 'Phone <span>Repairs</span>';
    searchBox.style.display = 'none';
    btnNew.style.display = 'none';
    renderRepairsTab();
  } else if (tab === 'services') {
    document.getElementById('pageTitle').innerHTML = 'Online <span>&amp; Print</span>';
    searchBox.style.display = 'none';
    btnNew.style.display = 'none';
    renderServicesTab();
  } else if (tab === 'shop') {
    document.getElementById('pageTitle').innerHTML = 'Shop <span>& Stock</span>';
    searchBox.style.display = 'none';
    btnNew.style.display = 'none';
    renderShopTab();
  } else if (tab === 'tasks') {
    document.getElementById('pageTitle').innerHTML = 'Task <span>List</span>';
    searchBox.style.display = 'none';
    btnNew.style.display = 'none';
    renderTasksTab();
  } else if (tab === 'settings') {
    document.getElementById('pageTitle').innerHTML = 'System <span>Settings</span>';
    searchBox.style.display = 'none';
    btnNew.style.display = 'none';
    renderSettingsTab();
  } else if (tab === 'virtual') {
    document.getElementById('pageTitle').innerHTML = 'Virtual <span>Numbers</span>';
    searchBox.style.display = 'none';
    btnNew.style.display = 'none';
    renderVirtualTab();
  } else {
    // No stub tabs remain; unknown tab ids fall back to Customers.
    document.getElementById('pageTitle').innerHTML = 'Customer <span>Management</span>';
    searchBox.style.display = '';
    btnNew.style.display = '';
    renderCustomersTab();
  }
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
  return d + '/' + m + '/' + y;
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
    (c.email || '').toLowerCase().includes(term)
  ).slice(0, 10);

  if (matches.length === 0) {
    dropdown.innerHTML = '<div class="customer-dropdown-empty">No customers found</div>';
  } else {
    dropdown.innerHTML = matches.map(c => `
      <div class="customer-dropdown-item" onclick="selectRentalCustomer('${c.id}')">
        <strong>${nameHtml(`${c.firstName || ''} ${c.lastName || ''}`.trim())}</strong>
        <span style="color:var(--muted);font-size:11px;margin-left:8px;">${escHtml(c.phone||'')} ${c.email ? '· '+escHtml(c.email) : ''}</span>
      </div>`).join('');
  }
  dropdown.classList.add('open');
}

function selectRentalCustomer(id) {
  const c = customers.find(x => x.id === id);
  if (!c) return;
  document.getElementById('rCustomer').value = id;
  document.getElementById('rCustomerSearch').value = `${c.firstName} ${c.lastName}`;
  document.getElementById('rCustomerSelected').textContent = `✓ ${c.phone || ''}`;
  document.getElementById('rCustomerDropdown').classList.remove('open');
  selectedRentalCustomerId = id;
  updateRentalCalc(); // customer drives the multi-phone (3rd+) auto-discount
}

function onCustomerSelectChange() {
  document.getElementById('rCustomerSearch').value = '';
  document.getElementById('rCustomerDropdown').classList.remove('open');
  const sel = document.getElementById('rCustomer');
  const c = customers.find(x => x.id === sel.value);
  const div = document.getElementById('rCustomerSelected');
  if (c && div) div.textContent = '✓ ' + (c.phone || '');
  else if (div) div.textContent = '';
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
// Shabbat handled by day-of-week check, not listed here.
const DIASPORA_HOLIDAYS = new Set([
  '2020-04-08','2020-04-09','2020-04-14','2020-04-15','2020-05-28','2020-05-29','2020-09-18','2020-09-19',
  '2020-09-27','2020-10-02','2020-10-03','2020-10-09','2020-10-10','2021-03-28','2021-04-02','2021-04-03',
  '2021-05-16','2021-05-17','2021-09-06','2021-09-07','2021-09-15','2021-09-20','2021-09-21','2021-09-27',
  '2021-09-28','2022-04-15','2022-04-16','2022-04-21','2022-04-22','2022-06-04','2022-06-05','2022-09-25',
  '2022-09-26','2022-10-04','2022-10-09','2022-10-10','2022-10-16','2022-10-17','2023-04-05','2023-04-06',
  '2023-04-11','2023-04-12','2023-05-25','2023-05-26','2023-09-15','2023-09-16','2023-09-24','2023-09-29',
  '2023-09-30','2023-10-06','2023-10-07','2024-04-22','2024-04-23','2024-04-28','2024-04-29','2024-06-11',
  '2024-06-12','2024-10-02','2024-10-03','2024-10-11','2024-10-16','2024-10-17','2024-10-23','2024-10-24',
  '2025-04-12','2025-04-13','2025-04-18','2025-04-19','2025-06-01','2025-06-02','2025-09-22','2025-09-23',
  '2025-10-01','2025-10-06','2025-10-07','2025-10-13','2025-10-14','2026-04-01','2026-04-02','2026-04-07',
  '2026-04-08','2026-05-21','2026-05-22','2026-09-11','2026-09-12','2026-09-20','2026-09-25','2026-09-26',
  '2026-10-02','2026-10-03','2027-04-21','2027-04-22','2027-04-27','2027-04-28','2027-06-10','2027-06-11',
  '2027-10-01','2027-10-02','2027-10-10','2027-10-15','2027-10-16','2027-10-22','2027-10-23','2028-04-10',
  '2028-04-11','2028-04-16','2028-04-17','2028-05-30','2028-05-31','2028-09-20','2028-09-21','2028-09-29',
  '2028-10-04','2028-10-05','2028-10-11','2028-10-12','2029-03-30','2029-03-31','2029-04-05','2029-04-06',
  '2029-05-19','2029-05-20','2029-09-09','2029-09-10','2029-09-18','2029-09-23','2029-09-24','2029-09-30',
  '2029-10-01','2030-04-17','2030-04-18','2030-04-23','2030-04-24','2030-06-06','2030-06-07','2030-09-27',
  '2030-09-28','2030-10-06','2030-10-11','2030-10-12','2030-10-18','2030-10-19','2031-04-07','2031-04-08',
  '2031-04-13','2031-04-14','2031-05-27','2031-05-28','2031-09-17','2031-09-18','2031-09-26','2031-10-01',
  '2031-10-02','2031-10-08','2031-10-09','2032-03-27','2032-03-28','2032-04-01','2032-04-02','2032-05-15',
  '2032-05-16','2032-09-05','2032-09-06','2032-09-14','2032-09-19','2032-09-20','2032-09-26','2032-09-27',
  '2033-04-13','2033-04-14','2033-04-19','2033-04-20','2033-06-02','2033-06-03','2033-09-23','2033-09-24',
  '2033-10-02','2033-10-07','2033-10-08','2033-10-14','2033-10-15','2034-04-03','2034-04-04','2034-04-09',
  '2034-04-10','2034-05-23','2034-05-24','2034-09-13','2034-09-14','2034-09-22','2034-09-27','2034-09-28',
  '2034-10-04','2034-10-05','2035-04-23','2035-04-24','2035-04-29','2035-04-30','2035-06-12','2035-06-13',
  '2035-10-03','2035-10-04','2035-10-12','2035-10-17','2035-10-18','2035-10-24','2035-10-25','2036-04-11',
  '2036-04-12','2036-04-17','2036-04-18','2036-05-31','2036-06-01','2036-09-21','2036-09-22','2036-09-30',
  '2036-10-05','2036-10-06','2036-10-12','2036-10-13','2037-03-30','2037-03-31','2037-04-05','2037-04-06',
  '2037-05-19','2037-05-20','2037-09-09','2037-09-10','2037-09-18','2037-09-23','2037-09-24','2037-09-30',
  '2037-10-01','2038-04-19','2038-04-20','2038-04-25','2038-04-26','2038-06-08','2038-06-09','2038-09-29',
  '2038-09-30','2038-10-08','2038-10-13','2038-10-14','2038-10-20','2038-10-21','2039-04-08','2039-04-09',
  '2039-04-14','2039-04-15','2039-05-28','2039-05-29','2039-09-18','2039-09-19','2039-09-27','2039-10-02',
  '2039-10-03','2039-10-09','2039-10-10','2040-03-28','2040-03-29','2040-04-03','2040-04-04','2040-05-17',
  '2040-05-18','2040-09-07','2040-09-08','2040-09-16','2040-09-21','2040-09-22','2040-09-28','2040-09-29',
  '2041-04-15','2041-04-16','2041-04-21','2041-04-22','2041-06-04','2041-06-05','2041-09-25','2041-09-26',
  '2041-10-04','2041-10-09','2041-10-10','2041-10-16','2041-10-17','2042-04-04','2042-04-05','2042-04-10',
  '2042-04-11','2042-05-24','2042-05-25','2042-09-14','2042-09-15','2042-09-23','2042-09-28','2042-09-29',
  '2042-10-05','2042-10-06','2043-04-24','2043-04-25','2043-04-30','2043-05-01','2043-06-13','2043-06-14',
  '2043-10-04','2043-10-05','2043-10-13','2043-10-18','2043-10-19','2043-10-26','2043-10-27','2044-04-11',
  '2044-04-12','2044-04-17','2044-04-18','2044-05-31','2044-06-01','2044-09-21','2044-09-22','2044-09-30',
  '2044-10-05','2044-10-06','2044-10-12','2044-10-13','2045-04-01','2045-04-02','2045-04-07','2045-04-08',
  '2045-05-21','2045-05-22','2045-09-11','2045-09-12','2045-09-20','2045-09-25','2045-09-26','2045-10-02',
  '2045-10-03','2046-04-20','2046-04-21','2046-04-26','2046-04-27','2046-06-09','2046-06-10','2046-09-30',
  '2046-10-01','2046-10-09','2046-10-14','2046-10-15','2046-10-21','2046-10-22','2047-04-10','2047-04-11',
  '2047-04-16','2047-04-17','2047-05-30','2047-05-31','2047-09-20','2047-09-21','2047-09-29','2047-10-04',
  '2047-10-05','2047-10-11','2047-10-12','2048-03-29','2048-04-03','2048-04-04','2048-05-17','2048-05-18',
  '2048-09-07','2048-09-08','2048-09-16','2048-09-21','2048-09-22','2048-09-28','2048-09-29','2049-04-16',
  '2049-04-17','2049-04-22','2049-04-23','2049-06-05','2049-06-06','2049-09-26','2049-09-27','2049-10-05',
  '2049-10-10','2049-10-11','2049-10-17','2049-10-18','2050-04-06','2050-04-07','2050-04-12','2050-04-13',
  '2050-05-26','2050-05-27','2050-09-16','2050-09-17','2050-09-25','2050-09-30','2050-10-01','2050-10-07',
  '2050-10-08','2051-03-27','2051-03-28','2051-04-02','2051-04-03','2051-05-16','2051-05-17','2051-09-06',
  '2051-09-07','2051-09-15','2051-09-20','2051-09-21','2051-09-27','2051-09-28','2052-04-13','2052-04-14',
  '2052-04-19','2052-04-20','2052-06-02','2052-06-03','2052-09-23','2052-09-24','2052-10-02','2052-10-07',
  '2052-10-08','2052-10-14','2052-10-15','2053-04-02','2053-04-03','2053-04-08','2053-04-09','2053-05-22',
  '2053-05-23','2053-09-12','2053-09-13','2053-09-21','2053-09-26','2053-09-27','2053-10-03','2053-10-04',
  '2054-04-22','2054-04-23','2054-04-28','2054-04-29','2054-06-11','2054-06-12','2054-10-02','2054-10-03',
  '2054-10-11','2054-10-16','2054-10-17','2054-10-23','2054-10-24','2055-04-12','2055-04-13','2055-04-18',
  '2055-04-19','2055-06-01','2055-06-02','2055-09-22','2055-09-23','2055-10-01','2055-10-06','2055-10-07',
  '2055-10-13','2055-10-14','2056-03-31','2056-04-01','2056-04-06','2056-04-07','2056-05-20','2056-05-21',
  '2056-09-10','2056-09-11','2056-09-19','2056-09-24','2056-09-25','2056-10-01','2056-10-02','2057-04-18',
  '2057-04-19','2057-04-24','2057-04-25','2057-06-07','2057-06-08','2057-09-28','2057-09-29','2057-10-07',
  '2057-10-12','2057-10-13','2057-10-19','2057-10-20','2058-04-08','2058-04-09','2058-04-14','2058-04-15',
  '2058-05-28','2058-05-29','2058-09-18','2058-09-19','2058-09-27','2058-10-02','2058-10-03','2058-10-09',
  '2058-10-10','2059-03-29','2059-03-30','2059-04-03','2059-04-04','2059-05-17','2059-05-18','2059-09-07',
  '2059-09-08','2059-09-16','2059-09-21','2059-09-22','2059-09-28','2059-09-29','2060-04-14','2060-04-15',
  '2060-04-20','2060-04-21','2060-06-03','2060-06-04','2060-09-24','2060-09-25','2060-10-03','2060-10-08',
  '2060-10-09','2060-10-15','2060-10-16','2061-04-04','2061-04-05','2061-04-10','2061-04-11','2061-05-24',
  '2061-05-25','2061-09-14','2061-09-15','2061-09-23','2061-09-28','2061-09-29','2061-10-05','2061-10-06',
  '2062-04-24','2062-04-25','2062-04-30','2062-05-01','2062-06-13','2062-06-14','2062-10-04','2062-10-05',
  '2062-10-13','2062-10-18','2062-10-19','2062-10-25','2062-10-26','2063-04-13','2063-04-14','2063-04-19',
  '2063-04-20','2063-06-02','2063-06-03','2063-09-23','2063-09-24','2063-10-02','2063-10-07','2063-10-08',
  '2063-10-14','2063-10-15','2064-03-31','2064-04-01','2064-04-06','2064-04-07','2064-05-20','2064-05-21',
  '2064-09-10','2064-09-11','2064-09-19','2064-09-24','2064-09-25','2064-10-01','2064-10-02','2065-04-20',
  '2065-04-21','2065-04-26','2065-04-27','2065-06-09','2065-06-10','2065-09-30','2065-10-01','2065-10-09',
  '2065-10-14','2065-10-15','2065-10-21','2065-10-22','2066-04-09','2066-04-10','2066-04-15','2066-04-16',
  '2066-05-29','2066-05-30','2066-09-19','2066-09-20','2066-09-28','2066-10-03','2066-10-04','2066-10-10',
  '2066-10-11','2067-03-30','2067-03-31','2067-04-05','2067-04-06','2067-05-19','2067-05-20','2067-09-09',
  '2067-09-10','2067-09-18','2067-09-23','2067-09-24','2067-09-30','2067-10-01','2068-04-16','2068-04-17',
  '2068-04-22','2068-04-23','2068-06-05','2068-06-06','2068-09-26','2068-09-27','2068-10-05','2068-10-10',
  '2068-10-11','2068-10-17','2068-10-18','2069-04-05','2069-04-06','2069-04-11','2069-04-12','2069-05-25',
  '2069-05-26','2069-09-15','2069-09-16','2069-09-24','2069-09-29','2069-09-30','2069-10-06','2069-10-07',
  '2070-03-27','2070-03-28','2070-04-01','2070-04-02','2070-05-15','2070-05-16','2070-09-05','2070-09-06',
  '2070-09-14','2070-09-19','2070-09-20','2070-09-26','2070-09-27','2071-04-13','2071-04-14','2071-04-19',
  '2071-04-20','2071-06-02','2071-06-03','2071-09-23','2071-09-24','2071-10-02','2071-10-07','2071-10-08',
  '2071-10-14','2071-10-15','2072-04-02','2072-04-03','2072-04-08','2072-04-09','2072-05-22','2072-05-23',
  '2072-09-12','2072-09-13','2072-09-21','2072-09-26','2072-09-27','2072-10-03','2072-10-04','2073-04-21',
  '2073-04-22','2073-04-27','2073-04-28','2073-06-10','2073-06-11','2073-10-01','2073-10-02','2073-10-10',
  '2073-10-15','2073-10-16','2073-10-22','2073-10-23','2074-04-11','2074-04-12','2074-04-17','2074-04-18',
  '2074-05-31','2074-06-01','2074-09-21','2074-09-22','2074-09-30','2074-10-05','2074-10-06','2074-10-12',
  '2074-10-13','2075-03-31','2075-04-05','2075-04-06','2075-05-19','2075-05-20','2075-09-09','2075-09-10',
  '2075-09-18','2075-09-23','2075-09-24','2075-09-30','2075-10-01','2076-04-17','2076-04-18','2076-04-23',
  '2076-04-24','2076-06-06','2076-06-07','2076-09-27','2076-09-28','2076-10-06','2076-10-11','2076-10-12',
  '2076-10-18','2076-10-19','2077-04-07','2077-04-08','2077-04-13','2077-04-14','2077-05-27','2077-05-28',
  '2077-09-17','2077-09-18','2077-09-26','2077-10-01','2077-10-02','2077-10-08','2077-10-09','2078-03-28',
  '2078-03-29','2078-04-03','2078-04-04','2078-05-17','2078-05-18','2078-09-07','2078-09-08','2078-09-16',
  '2078-09-21','2078-09-22','2078-09-28','2078-09-29','2079-04-15','2079-04-16','2079-04-21','2079-04-22',
  '2079-06-04','2079-06-05','2079-09-25','2079-09-26','2079-10-04','2079-10-09','2079-10-10','2079-10-16',
  '2079-10-17','2080-04-03','2080-04-04','2080-04-09','2080-04-10','2080-05-23','2080-05-24','2080-09-13',
  '2080-09-14','2080-09-22','2080-09-27','2080-09-28','2080-10-04','2080-10-05','2081-04-23','2081-04-24',
  '2081-04-29','2081-04-30','2081-06-12','2081-06-13','2081-10-03','2081-10-04','2081-10-12','2081-10-17',
  '2081-10-18','2081-10-24','2081-10-25','2082-04-13','2082-04-14','2082-04-19','2082-04-20','2082-06-02',
  '2082-06-03','2082-09-23','2082-09-24','2082-10-02','2082-10-07','2082-10-08','2082-10-14','2082-10-15',
  '2083-04-02','2083-04-03','2083-04-08','2083-04-09','2083-05-22','2083-05-23','2083-09-12','2083-09-13',
  '2083-09-21','2083-09-26','2083-09-27','2083-10-03','2083-10-04','2084-04-19','2084-04-20','2084-04-25',
  '2084-04-26','2084-06-08','2084-06-09','2084-09-29','2084-09-30','2084-10-08','2084-10-13','2084-10-14',
  '2084-10-20','2084-10-21','2085-04-09','2085-04-10','2085-04-15','2085-04-16','2085-05-29','2085-05-30',
  '2085-09-19','2085-09-20','2085-09-28','2085-10-03','2085-10-04','2085-10-10','2085-10-11','2086-03-30',
  '2086-03-31','2086-04-04','2086-04-05','2086-05-18','2086-05-19','2086-09-08','2086-09-09','2086-09-17',
  '2086-09-22','2086-09-23','2086-09-29','2086-09-30','2087-04-16','2087-04-17','2087-04-22','2087-04-23',
  '2087-06-05','2087-06-06','2087-09-26','2087-09-27','2087-10-05','2087-10-10','2087-10-11','2087-10-17',
  '2087-10-18','2088-04-05','2088-04-06','2088-04-11','2088-04-12','2088-05-25','2088-05-26','2088-09-15',
  '2088-09-16','2088-09-24','2088-09-29','2088-09-30','2088-10-06','2088-10-07','2089-03-26','2089-03-27',
  '2089-03-31','2089-04-01','2089-05-14','2089-05-15','2089-09-04','2089-09-05','2089-09-13','2089-09-18',
  '2089-09-19','2089-09-25','2089-09-26','2090-04-14','2090-04-15','2090-04-20','2090-04-21','2090-06-03',
  '2090-06-04','2090-09-24','2090-09-25','2090-10-03','2090-10-08','2090-10-09','2090-10-15','2090-10-16',
  '2091-04-02','2091-04-03','2091-04-08','2091-04-09','2091-05-22','2091-05-23','2091-09-12','2091-09-13',
  '2091-09-21','2091-09-26','2091-09-27','2091-10-03','2091-10-04','2092-04-21','2092-04-22','2092-04-27',
  '2092-04-28','2092-06-10','2092-06-11','2092-10-01','2092-10-02','2092-10-10','2092-10-15','2092-10-16',
  '2092-10-22','2092-10-23','2093-04-10','2093-04-11','2093-04-16','2093-04-17','2093-05-30','2093-05-31',
  '2093-09-20','2093-09-21','2093-09-29','2093-10-04','2093-10-05','2093-10-11','2093-10-12','2094-03-31',
  '2094-04-01','2094-04-06','2094-04-07','2094-05-20','2094-05-21','2094-09-10','2094-09-11','2094-09-19',
  '2094-09-24','2094-09-25','2094-10-01','2094-10-02','2095-04-18','2095-04-19','2095-04-24','2095-04-25',
  '2095-06-07','2095-06-08','2095-09-28','2095-09-29','2095-10-07','2095-10-12','2095-10-13','2095-10-19',
  '2095-10-20','2096-04-06','2096-04-07','2096-04-12','2096-04-13','2096-05-26','2096-05-27','2096-09-16',
  '2096-09-17','2096-09-25','2096-09-30','2096-10-01','2096-10-07','2096-10-08','2097-03-28','2097-03-29',
  '2097-04-02','2097-04-03','2097-05-16','2097-05-17','2097-09-06','2097-09-07','2097-09-15','2097-09-20',
  '2097-09-21','2097-09-27','2097-09-28','2098-04-16','2098-04-17','2098-04-22','2098-04-23','2098-06-05',
  '2098-06-06','2098-09-26','2098-09-27','2098-10-05','2098-10-10','2098-10-11','2098-10-17','2098-10-18',
  '2099-04-04','2099-04-05','2099-04-10','2099-04-11','2099-05-24','2099-05-25','2099-09-14','2099-09-15',
  '2099-09-23','2099-09-28','2099-09-29','2099-10-05','2099-10-06','2100-04-23','2100-04-24','2100-04-29',
  '2100-04-30','2100-06-12','2100-06-13','2100-10-03','2100-10-04','2100-10-12','2100-10-17','2100-10-18',
  '2100-10-24','2100-10-25','2101-04-13','2101-04-14','2101-04-19','2101-04-20','2101-06-02','2101-06-03',
  '2101-09-23','2101-09-24','2101-10-02','2101-10-07','2101-10-08','2101-10-14','2101-10-15','2102-04-03',
  '2102-04-04','2102-04-09','2102-04-10','2102-05-23','2102-05-24','2102-09-13','2102-09-14','2102-09-22',
  '2102-09-27','2102-09-28','2102-10-04','2102-10-05','2103-04-21','2103-04-22','2103-04-27','2103-04-28',
  '2103-06-10','2103-06-11','2103-10-01','2103-10-02','2103-10-10','2103-10-15','2103-10-16','2103-10-22',
  '2103-10-23','2104-04-09','2104-04-10','2104-04-15','2104-04-16','2104-05-29','2104-05-30','2104-09-19',
  '2104-09-20','2104-09-28','2104-10-03','2104-10-04','2104-10-10','2104-10-11','2105-03-30','2105-03-31',
  '2105-04-05','2105-04-06','2105-05-19','2105-05-20','2105-09-09','2105-09-10','2105-09-18','2105-09-23',
  '2105-09-24','2105-09-30','2105-10-01','2106-04-19','2106-04-20','2106-04-25','2106-04-26','2106-06-08',
  '2106-06-09','2106-09-29','2106-09-30','2106-10-08','2106-10-13','2106-10-14','2106-10-20','2106-10-21',
  '2107-04-08','2107-04-09','2107-04-14','2107-04-15','2107-05-28','2107-05-29','2107-09-18','2107-09-19',
  '2107-09-27','2107-10-02','2107-10-03','2107-10-09','2107-10-10','2108-03-26','2108-03-27','2108-04-01',
  '2108-04-02','2108-05-15','2108-05-16','2108-09-05','2108-09-06','2108-09-14','2108-09-19','2108-09-20',
  '2108-09-26','2108-09-27','2109-04-15','2109-04-16','2109-04-21','2109-04-22','2109-06-04','2109-06-05',
  '2109-09-25','2109-09-26','2109-10-04','2109-10-09','2109-10-10','2109-10-16','2109-10-17','2110-04-04',
  '2110-04-05','2110-04-10','2110-04-11','2110-05-24','2110-05-25','2110-09-14','2110-09-15','2110-09-23',
  '2110-09-28','2110-09-29','2110-10-05','2110-10-06','2111-04-22','2111-04-23','2111-04-28','2111-04-29',
  '2111-06-11','2111-06-12','2111-10-02','2111-10-03','2111-10-11','2111-10-16','2111-10-17','2111-10-23',
  '2111-10-24','2112-04-11','2112-04-12','2112-04-17','2112-04-18','2112-05-31','2112-06-01','2112-09-21',
  '2112-09-22','2112-09-30','2112-10-05','2112-10-06','2112-10-12','2112-10-13','2113-03-31','2113-04-01',
  '2113-04-06','2113-04-07','2113-05-20','2113-05-21','2113-09-10','2113-09-11','2113-09-19','2113-09-24',
  '2113-09-25','2113-10-01','2113-10-02','2114-04-20','2114-04-21','2114-04-26','2114-04-27','2114-06-09',
  '2114-06-10','2114-09-30','2114-10-01','2114-10-09','2114-10-14','2114-10-15','2114-10-21','2114-10-22',
  '2115-04-08','2115-04-09','2115-04-14','2115-04-15','2115-05-28','2115-05-29','2115-09-18','2115-09-19',
  '2115-09-27','2115-10-02','2115-10-03','2115-10-09','2115-10-10','2116-03-28','2116-03-29','2116-04-02',
  '2116-04-03','2116-05-16','2116-05-17','2116-09-06','2116-09-07','2116-09-15','2116-09-20','2116-09-21',
  '2116-09-27','2116-09-28','2117-04-16','2117-04-17','2117-04-22','2117-04-23','2117-06-05','2117-06-06',
  '2117-09-26','2117-09-27','2117-10-05','2117-10-10','2117-10-11','2117-10-17','2117-10-18','2118-04-06',
  '2118-04-07','2118-04-12','2118-04-13','2118-05-26','2118-05-27','2118-09-16','2118-09-17','2118-09-25',
  '2118-09-30','2118-10-01','2118-10-07','2118-10-08','2119-04-24','2119-04-25','2119-04-30','2119-05-01',
  '2119-06-13','2119-06-14','2119-10-04','2119-10-05','2119-10-13','2119-10-18','2119-10-19','2119-10-25',
  '2119-10-26','2120-04-12','2120-04-13','2120-04-18','2120-04-19','2120-06-01','2120-06-02','2120-09-22',
  '2120-09-23','2120-10-01','2120-10-06','2120-10-07','2120-10-13','2120-10-14','2121-04-02','2121-04-03',
  '2121-04-08','2121-04-09','2121-05-22','2121-05-23','2121-09-12','2121-09-13','2121-09-21','2121-09-26',
  '2121-09-27','2121-10-03','2121-10-04','2122-04-20','2122-04-21','2122-04-26','2122-04-27','2122-06-09',
  '2122-06-10','2122-09-30','2122-10-01','2122-10-09','2122-10-14','2122-10-15','2122-10-21','2122-10-22',
  '2123-04-10','2123-04-11','2123-04-16','2123-04-17','2123-05-30','2123-05-31','2123-09-20','2123-09-21',
  '2123-09-29','2123-10-04','2123-10-05','2123-10-11','2123-10-12','2124-03-29','2124-03-30','2124-04-04',
  '2124-04-05','2124-05-18','2124-05-19','2124-09-08','2124-09-09','2124-09-17','2124-09-22','2124-09-23',
  '2124-09-29','2124-09-30','2125-04-18','2125-04-19','2125-04-24','2125-04-25','2125-06-07','2125-06-08',
  '2125-09-28','2125-09-29','2125-10-07','2125-10-12','2125-10-13','2125-10-19','2125-10-20'
]);


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
  const { ratePerDay, minCharge, cap, capPeriodDays } = rateFor(country, ukPlan, simGiven);
  let price = chargeableDays * ratePerDay;
  if (chargeableDays > 0 && price < minCharge) price = minCharge;
  // Cap scales per calendar window (default 30 days): chargeable days set the
  // £, calendar days set how many cap periods the rental spans — so a 60-day
  // rental caps at 2× cap, not 1×.
  if (cap != null) {
    const capTotal = cap * Math.max(1, Math.ceil(totalDays / (capPeriodDays || 30)));
    if (price > capTotal) price = capTotal;
  }
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
  if (svc.repeatPrice === null || svc.repeatPrice === undefined) return single;
  const upTo5 = Math.min(n - 1, 4) * Number(svc.repeatPrice);
  const from6 = Math.max(n - 5, 0) * Number(svc.bulkPrice ?? svc.repeatPrice);
  return single + upTo5 + from6;
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
const POOL_KEEP_DAYS = 7;      // >7 days of expiry left ⇒ worth keeping pooled
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
    .filter(p => (p.country || '').toUpperCase() === 'USA' && p.pool &&
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
let filterCustomer = '', filterStatus = 'all', filterPaid = 'all';

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
  filterCustomer = ''; filterStatus = 'all'; filterPaid = 'all';
  const fc = document.getElementById('filterCustomer');
  if (fc) fc.value = '';
  csPick('csBalance', 'all', 'Balance', null);
  csPick('csStatusFilter', 'all', 'Status', null);
  renderRentalRows();
}
function mgComputeLateFee() {
  const to = document.getElementById('mgTo')?.value;
  if (!to) return 0;
  const today = localISO();
  if (to >= today) return 0;
  const country = document.getElementById('mgCountry')?.value || 'USA';
  const lateDayStart = parseLocalDate(to);
  lateDayStart.setDate(lateDayStart.getDate() + 1);
  return countChargeableDays(localISO(lateDayStart), today, country) * settingNum('late_fee_per_day', 1);
}

// Returns lost-item charges entered in the modal: { total, items: [{label, amount}] }
function mgComputeLostCharges() {
  const LABELS = { phone: 'Phone', sim: 'SIM card', plug: 'Plug/Charger', cable: 'Cable' };
  const items = [];
  let total = 0;
  ['phone', 'sim', 'plug', 'cable'].forEach(item => {
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
function mgSIMReturnChanged() {
  const checked = document.getElementById('mgSIM')?.checked;
  const current = document.getElementById('mgReturned')?.value;
  if (checked && current !== '1') toggleReturned();
  else if (!checked && current === '1') toggleReturned();
}
function nrToggleGiven(item) {
  const el = document.getElementById('nrGiven_' + item);
  if (!el) return;
  el.dataset.given = el.dataset.given === '1' ? '0' : '1';
  // A USA phone without a SIM prices on the cheaper no-SIM row.
  if (item === 'sim') updateRentalCalc();
}

function renderRentalsTab() {
  const content = document.getElementById('mainContent');
  const today0  = localISO();
  const activeRentals   = rentals.filter(r => r.status === 'active').length;
  const availablePhones = phones.filter(p => p.status === 'available').length;
  const returningToday  = rentals.filter(r => r.status === 'active' && r.toDate === today0).length;
  const outstandingDebt = rentals.reduce((s, r) => s + rentalDebt(r), 0);

  const balLabel     = filterPaid==='paid'?'Fully Paid':filterPaid==='debt'?'Has Debt':'Balance';
  const statusLabel  = filterStatus==='active'?'Active':filterStatus==='overdue'?'Overdue':filterStatus==='returned'?'Returned':filterStatus==='returned_incomplete'?'Returned ⚠️':'Status';

  content.innerHTML = `
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">Active Rentals</div>
        <div class="stat-value green">${activeRentals}</div>
        <div class="stat-sub">Currently out</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Available Phones</div>
        <div class="stat-value blue">${availablePhones}</div>
        <div class="stat-sub">Ready to rent</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Returning Today</div>
        <div class="stat-value ${returningToday > 0 ? 'gold' : 'purple'}">${returningToday}</div>
        <div class="stat-sub">Expected back</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Outstanding Debt</div>
        <div class="stat-value" style="color:${outstandingDebt>0?'var(--danger)':'var(--success)'};">£${outstandingDebt}</div>
        <div class="stat-sub">Unpaid balances</div>
      </div>
    </div>

    <div style="display:flex; gap:10px; margin-bottom:20px; flex-wrap:wrap;">
      <button class="btn btn-primary" onclick="openNewRentalModal()">📱 New Rental</button>
      <button class="btn btn-outline" onclick="openManagePhonesModal()">⚙️ Manage Phones</button>
      <button class="btn ${rentalView === 'calendar' ? 'btn-primary' : 'btn-outline'}"
        onclick="rentalView = rentalView === 'calendar' ? 'list' : 'calendar'; renderRentalsTab();">📅 Availability</button>
      <input class="search-box" style="width:240px;" type="text" id="rentalSearch"
        placeholder="🔍 Search customer or phone..."
        value="${rentalSearchTerm}"
        oninput="rentalSearchTerm=this.value; renderRentalRows()">
    </div>

    ${rentalView === 'calendar' ? availabilityCalendarHtml() : ''}

    <div class="rentals-split" style="${rentalView === 'calendar' ? 'display:none;' : ''}">
      <div class="rentals-split-col">
        <div class="section-header">
          <div class="section-title">Active & Recent Rentals</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;align-items:center;">
          <input type="text" class="search-box" id="filterCustomer" placeholder="Filter by customer..."
            style="width:180px;" value="${filterCustomer}"
            oninput="filterCustomer=this.value;renderRentalRows()">

          <div class="cs-wrap" id="csBalance">
            <div class="cs-btn" onclick="csToggle('csBalance')"><span>${balLabel}</span></div>
            <div class="cs-list">
              <div class="cs-item ${filterPaid==='all'?'cs-active':''}" data-value="all" onclick="csPick('csBalance','all','Balance',v=>{filterPaid=v;renderRentalRows()})">Balance</div>
              <div class="cs-item ${filterPaid==='paid'?'cs-active':''}" data-value="paid" onclick="csPick('csBalance','paid','Fully Paid',v=>{filterPaid=v;renderRentalRows()})">Fully Paid</div>
              <div class="cs-item ${filterPaid==='debt'?'cs-active':''}" data-value="debt" onclick="csPick('csBalance','debt','Has Debt',v=>{filterPaid=v;renderRentalRows()})">Has Debt</div>
            </div>
          </div>

          <div class="cs-wrap" id="csStatusFilter">
            <div class="cs-btn" onclick="csToggle('csStatusFilter')"><span>${statusLabel}</span></div>
            <div class="cs-list">
              <div class="cs-item ${filterStatus==='all'?'cs-active':''}" data-value="all" onclick="csPick('csStatusFilter','all','Status',v=>{filterStatus=v;renderRentalRows()})">Status</div>
              <div class="cs-item ${filterStatus==='active'?'cs-active':''}" data-value="active" onclick="csPick('csStatusFilter','active','Active',v=>{filterStatus=v;renderRentalRows()})">Active</div>
              <div class="cs-item ${filterStatus==='overdue'?'cs-active':''}" data-value="overdue" onclick="csPick('csStatusFilter','overdue','Overdue',v=>{filterStatus=v;renderRentalRows()})">Overdue</div>
              <div class="cs-item ${filterStatus==='returned'?'cs-active':''}" data-value="returned" onclick="csPick('csStatusFilter','returned','Returned',v=>{filterStatus=v;renderRentalRows()})">Returned</div>
              <div class="cs-item ${filterStatus==='returned_incomplete'?'cs-active':''}" data-value="returned_incomplete" onclick="csPick('csStatusFilter','returned_incomplete','Returned ⚠️',v=>{filterStatus=v;renderRentalRows()})">Returned ⚠️</div>
            </div>
          </div>

          <button class="btn btn-outline" style="font-size:12px;padding:5px 12px;" onclick="clearRentalFilters()">Clear</button>
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
    return `<th class="cal-day${dow === 6 ? ' cal-shabbat' : ''}${iso(d) === today ? ' cal-today' : ''}">${d}</th>`;
  }).join('');

  const rows = phones.map(p => {
    const cells = Array.from({ length: daysInMonth }, (_, i) => {
      const dIso = iso(i + 1);
      const hit = (blocks.get(p.id) || []).find(b => b.r.fromDate <= dIso && b.end >= dIso);
      const dow = new Date(y, m - 1, i + 1).getDay();
      if (!hit) {
        return `<td class="cal-cell cal-free${dow === 6 ? ' cal-shabbat' : ''}${dIso === today ? ' cal-today' : ''}"
          title="Free — click to reserve ${escHtml(p.number)} from ${fmtDate(dIso)}"
          onclick="calQuickReserve('${p.id}','${dIso}')"></td>`;
      }
      const cls = hit.r.status === 'booked' ? 'cal-booked'
        : (hit.r.status !== 'returned' && hit.r.toDate < today) ? 'cal-overdue' : 'cal-active';
      return `<td class="cal-cell ${cls}${dIso === today ? ' cal-today' : ''}"
        title="${escHtml(hit.r.customerName || '')} · ${fmtDate(hit.r.fromDate)} → ${fmtDate(hit.r.toDate)}${hit.r.status === 'booked' ? ' (reserved)' : ''}"
        onclick="openManageRentalModal('${hit.r.id}')"></td>`;
    }).join('');
    return `<tr>
      <td class="cal-phone"><strong>${escHtml(p.number)}</strong><div class="customer-email">${escHtml(p.country)}${p.ukPlan === 'unlimited' ? ' intl' : ''}</div></td>
      ${cells}
    </tr>`;
  }).join('');

  return `
    <div class="table-card" style="margin-bottom:20px;padding-bottom:10px;">
      <div style="display:flex;align-items:center;gap:12px;padding:12px 14px 4px;">
        <button class="btn btn-outline btn-sm" onclick="calShift(-1)">←</button>
        <strong style="min-width:150px;text-align:center;">${monthName}</strong>
        <button class="btn btn-outline btn-sm" onclick="calShift(1)">→</button>
        <span style="margin-left:auto;font-size:11px;color:var(--muted);">
          <span class="cal-key cal-active"></span> out
          <span class="cal-key cal-booked"></span> reserved
          <span class="cal-key cal-overdue"></span> overdue
          <span class="cal-key cal-shabbat"></span> Shabbat
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
  const incomplete = ['phone', 'sim', 'plug', 'cable'].some(k => (eq[k] ?? true) && getItemStatus(r, k) === 'undecided');
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
  if (filterCustomer) {
    const fc = filterCustomer.toLowerCase();
    filtered = filtered.filter(r => (r.customerName || '').toLowerCase().includes(fc));
  }
  if (filterStatus !== 'all') {
    filtered = filtered.filter(r => getComputedStatus(r, today) === filterStatus);
  }
  if (filterPaid !== 'all') {
    filtered = filtered.filter(r => {
      const fullyPaid = (r.amountPaid || 0) >= rentalGrandTotal(r);
      return filterPaid === 'paid' ? fullyPaid : !fullyPaid;
    });
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="emoji">📱</div><p>No rentals yet.</p><small>Click "New Rental" to get started.</small></div></td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    const computedStatus = getComputedStatus(r, today);
    let statusBadge;
    if      (computedStatus === 'booked')               statusBadge = `<span class="badge" style="background:#f5e9d4;color:#9b6829;">📅 Reserved${r.fromDate <= today ? ' — pickup due' : ''}</span>`;
    else if (computedStatus === 'active' && r.toDate === today) statusBadge = `<span class="badge badge-sim">Due Today</span>`;
    else if (computedStatus === 'active')               statusBadge = `<span class="badge badge-rental">Active</span>`;
    else if (computedStatus === 'overdue')              statusBadge = `<span class="badge" style="background:rgba(239,68,68,0.15);color:var(--danger);">Overdue ⚠️</span>`;
    else if (computedStatus === 'returned')             statusBadge = `<span class="badge badge-active">Returned</span>`;
    else                                                statusBadge = `<span class="badge" style="background:#f5e9d4;color:#9b6829;">Returned ⚠️</span>`;

    const paid = r.amountPaid || 0;
    const totalOwed = rentalGrandTotal(r) - paid;
    const debtColor = totalOwed > 0 ? 'color:var(--danger);' : 'color:var(--success);';
    return `<tr style="cursor:pointer;" onclick="if(!event.target.closest('.action-btn'))openManageRentalModal('${r.id}')">
      <td>
        <div class="customer-name">${nameHtml(r.customerName || '—')}</div>
        <div class="customer-email" style="font-size:11px;">${r.vn ? '🔢 +'+escHtml(r.vnPrefix || '') : ''}</div>
      </td>
      <td style="font-weight:600;font-size:12px;">${escHtml(r.phoneNumber || '—')}</td>
      <td style="font-size:11px;">${fmtDate(r.fromDate)}<br>${fmtDate(r.toDate)}</td>
      <td style="text-align:center;">${r.chargeableDays}d</td>
      <td style="color:var(--success);font-weight:700;">£${r.price}</td>
      <td style="font-weight:700;${debtColor}">${totalOwed > 0 ? '£'+totalOwed+' owed' : '✓ Paid'}</td>
      <td>${statusBadge}</td>
      <td>
        <div class="row-actions">
          ${computedStatus === 'booked' ? `<button class="action-btn" style="color:var(--success);font-weight:600;" onclick="startReservation('${r.id}')">▶ Start</button>` : ''}
          <button class="action-btn" onclick="openRemindModal('rental','${r.id}')" title="Remind me">⏰</button>
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
    else if (p.status === 'available' && p.poolExpiry && !poolExpired)
                                        statusBadge = `<span class="badge badge-sim">Available (active pool)</span>`;
    else if (poolExpired)               statusBadge = `<span class="badge" style="background:rgba(107,114,128,0.15);color:var(--muted);">Pool Expired</span>`;
    else                                statusBadge = `<span class="badge badge-active">Available</span>`;

    const isUSA = p.country === 'USA';
    const poolDisplay   = isUSA ? (p.pool || '—') : 'N/A';
    const expiryDisplay = isUSA ? (p.poolExpiry || '—') : 'N/A';
    return `<tr style="cursor:pointer;" onclick="if(!event.target.closest('.action-btn'))openEditPhoneModal('${p.id}')">
      <td style="font-weight:600;font-size:12px;">${escHtml(p.number)}${p.model ? `<div class="customer-email">${escHtml(p.model)}</div>` : ''}</td>
      <td>${p.country === 'USA' ? '🇺🇸' : p.country === 'Israel' ? '🇮🇱' : p.country === 'UK' ? '🇬🇧' : p.country === 'Canada' ? '🇨🇦' : '🇪🇺'} ${escHtml(p.country)}</td>
      <td style="font-size:12px;color:${isUSA?'':'var(--muted)'};">${isUSA ? escHtml(poolDisplay) : poolDisplay}</td>
      <td style="font-size:11px;color:${poolExpired?'var(--danger)':isUSA?'var(--muted)':'var(--muted)'};">${isUSA ? expiryDisplay : '<span style="color:var(--muted);">N/A</span>'}</td>
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
  const list = (from && to && to >= from)
    ? phones.filter(p => phoneConflicts(rentals, p.id, from, to, today).length === 0)
    : phones.filter(p => p.status !== 'rented');
  return list
    .map(p => `<option value="${p.id}">${escHtml(p.number)} · ${escHtml(p.country)} · ${escHtml(p.company||'')} ${p.pool ? '(Pool: '+escHtml(p.pool)+')' : ''}</option>`)
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

function openNewRentalModal() {
  const customerOptions = customers.map(c =>
    `<option value="${c.id}">${escHtml(c.firstName)} ${escHtml(c.lastName)} · ${escHtml(c.phone||'')}</option>`
  ).join('');

  const availablePhoneOptions = phoneOptionsFor(null, null);

  showDynamicModal(`
    <div class="modal-title">📱 New Rental</div>
    <div class="form-grid">
      <div class="form-group form-full">
        <label class="form-label">Customer *</label>
        <div class="customer-search-wrap">
          <select class="form-input" id="rCustomer" onchange="onCustomerSelectChange()">
            <option value="">— Select customer —</option>
            ${customerOptions}
          </select>
          <input class="form-input" type="text" id="rCustomerSearch"
            placeholder="Or type to filter..." autocomplete="off"
            oninput="filterCustomerDropdown()" style="margin-top:6px;">
          <div class="customer-dropdown" id="rCustomerDropdown"></div>
        </div>
        <div id="rCustomerSelected" style="font-size:12px;color:var(--success);margin-top:4px;"></div>
      </div>

      <div class="form-group form-full">
        <label class="form-label">Phone * <span style="color:var(--muted);font-weight:400;" id="rPhoneHint">(pick dates to see availability)</span></label>
        <select class="form-input" id="rPhone" onchange="updateRentalPhoneInfo(); updateRentalCalc();">
          <option value="">— Select phone —</option>
          ${availablePhoneOptions}
        </select>
        <div id="rPhoneInfo" style="font-size:12px;color:var(--muted);margin-top:4px;"></div>
      </div>

      <div class="form-group">
        <label class="form-label">From Date *</label>
        <input class="form-input" type="date" id="rFrom" onchange="refreshRentalPhoneOptions(); updateRentalCalc(); showHebrewDate('rFrom','rFromHeb')">
        <div class="hebrew-date-label" id="rFromHeb"></div>
      </div>
      <div class="form-group">
        <label class="form-label">To Date * (inclusive)</label>
        <input class="form-input" type="date" id="rTo" onchange="refreshRentalPhoneOptions(); updateRentalCalc(); showHebrewDate('rTo','rToHeb')">
        <div class="hebrew-date-label" id="rToHeb"></div>
      </div>

      <div class="form-group form-full" id="rCalcBox" style="display:none;">
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px 16px;font-size:13px;">
          <div id="rCalcText"></div>
        </div>
      </div>

      <div class="form-group form-full" style="flex-direction:row;align-items:center;gap:10px;">
        <input type="checkbox" id="rAddVN" style="width:16px;height:16px;cursor:pointer;accent-color:var(--accent);"
          onchange="document.getElementById('rVNSection').style.display=this.checked?'contents':'none'">
        <label for="rAddVN" style="font-size:14px;cursor:pointer;">🔢 Add Virtual Number</label>
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
          <div class="eq-btn" id="nrGiven_phone" data-given="0" onclick="nrToggleGiven('phone')">📱 Phone</div>
          <div class="eq-btn" id="nrGiven_sim"   data-given="1" onclick="nrToggleGiven('sim')">💳 SIM</div>
          <div class="eq-btn" id="nrGiven_plug"  data-given="0" onclick="nrToggleGiven('plug')">🔌 Plug</div>
          <div class="eq-btn" id="nrGiven_cable" data-given="0" onclick="nrToggleGiven('cable')">🔋 Cable</div>
        </div>
        <div style="font-size:11px;color:var(--muted);margin-top:6px;">Tap to toggle — bright = given</div>
      </div>

      <div class="form-group form-full" id="rDiscountRow">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;">
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
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeDynamicModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveNewRental()">💾 Save Rental</button>
    </div>
  `);

  const today = localISO();
  const next7 = localISO(new Date(Date.now() + 7*86400000));
  document.getElementById('rFrom').value = today;
  document.getElementById('rTo').value   = next7;
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
  priceEl.value = calcVNPrice(vnSub, from, to, phone?.country || 'USA', phone?.ukPlan || 'standard');
}

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
    if (dval > 0) discountLine = ` &nbsp;|&nbsp; <span style="color:var(--gold);font-size:12px;">-${dtype==='percent'?dval+'%':'£'+dval} discount → <strong>£${finalPrice.toFixed(2)}</strong></span>`;
  } else {
    // Auto multi-phone discount (3rd+ concurrent phone); a manual discount
    // replaces it — staff choice wins.
    const autoPct = multiPhoneDiscountPct(rentals, document.getElementById('rCustomer')?.value, from, to);
    if (autoPct > 0) {
      finalPrice = Math.max(0, price * (1 - autoPct / 100));
      discountLine = ` &nbsp;|&nbsp; <span style="color:var(--gold);font-size:12px;">3rd phone+ −${autoPct}% → <strong>£${finalPrice.toFixed(2)}</strong></span>`;
    }
  }
  box.style.display = 'block';
  // Full reasoning: rate math, which days were dropped for Shabbat/Yom Tov,
  // and whether the minimum or the cap kicked in.
  const raw = chargeableDays * rate.ratePerDay;
  const capPeriods = rate.cap == null ? 0 : Math.max(1, Math.ceil(totalDays / (rate.capPeriodDays || 30)));
  const steps = [
    `${chargeableDays} chargeable day${chargeableDays === 1 ? '' : 's'} × £${rate.ratePerDay}/day = £${raw.toFixed(2)}`,
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
      poolLine = `<div style="margin-top:6px;font-size:11px;line-height:1.5;">
        💡 <span style="color:var(--accent);font-weight:600;">Best pool match: ${escHtml(best.phone.number)}</span>
        <button type="button" class="btn btn-outline" style="padding:1px 8px;font-size:11px;margin-left:4px;"
          onclick="document.getElementById('rPhone').value='${best.phone.id}';updateRentalPhoneInfo();updateRentalCalc();">Use</button>
        <br><span style="color:var(--muted);">${escHtml(best.reason)}</span></div>`;
    }
  }
  txt.innerHTML = `
    <span style="color:var(--muted);">Total days:</span> ${totalDays} &nbsp;|&nbsp;
    <span style="color:var(--muted);">Shabbat/Yom Tov excluded:</span> <span style="color:var(--gold);">${excluded}</span> &nbsp;|&nbsp;
    <span style="color:var(--muted);">Chargeable days:</span> ${chargeableDays} &nbsp;|&nbsp;
    <strong style="color:var(--success);font-size:15px;">£${price}</strong>${discountLine}
    <div style="margin-top:6px;font-size:11px;color:var(--muted);line-height:1.6;">
      🧮 ${steps.join(' → ')}
      ${excluded > 0 ? `<br>📅 <span style="cursor:help;" title="Every Shabbos and full Yom Tov in the rental window is free — guests keep the phone over those days at no charge.">${excluded} free day${excluded === 1 ? '' : 's'} (Shabbos / Yom Tov) — hover for why</span>` : ''}
    </div>${poolLine}
  `;
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
  const equipmentGiven = {
    phone: document.getElementById('nrGiven_phone')?.dataset.given === '1',
    sim:   document.getElementById('nrGiven_sim')?.dataset.given   === '1',
    plug:  document.getElementById('nrGiven_plug')?.dataset.given  === '1',
    cable: document.getElementById('nrGiven_cable')?.dataset.given === '1',
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

  const totalPrice = discountedRental + vnPrice;
  if (!(await kcConfirm({
    title: isReservation ? 'Confirm reservation' : 'Confirm rental charge',
    body: `<strong>${escHtml(customer.firstName)} ${escHtml(customer.lastName)}</strong><br>
      ${escHtml(phone.number)} (${escHtml(phone.country)}) · ${fmtDate(from)} → ${fmtDate(to)} · ${chargeableDays} chargeable days${addVN ? '<br>+ virtual number' : ''}${discountValue > 0 ? '<br>discount applied' : ''}`,
    amount: totalPrice,
    okLabel: isReservation ? 'Reserve & charge' : 'Charge rental',
  }))) return;
  const rental = {
    id:           Date.now().toString(),
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
    status:       isReservation ? 'booked' : 'active',
    createdAt:    new Date().toISOString(),
    equipmentGiven,
  };

  rentals.push(rental);
  saveRentals(rentals);

  if (!isReservation) {
    phone.status        = 'rented';
    phone.currentRental = rental.id;
    savePhones(phones);
  }

  const c = customers.find(x => x.id === customerId);
  if (c) {
    if (!c.history) c.history = [];
    c.history.push({
      type:   'rental',
      desc:   `Phone Rental · ${phone.number} · ${phone.country} · ${chargeableDays} days${addVN ? ` + VN +${vnPrefix}` : ''}`,
      amount: totalPrice,
      date:   new Date().toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }),
    });
    c.totalPaid = (c.totalPaid || 0) + totalPrice;
    if (!c.services) c.services = [];
    c.services.push({ type: 'rental', label: `Rental 🇺🇸`, rentalId: rental.id });
    await window.api.updateCustomer(c);
    const idx = customers.findIndex(x => x.id === customerId);
    if (idx !== -1) customers[idx] = c;
  }

  closeDynamicModal();
  // Owner-defined auto extras for rentals (posted once, keyed on the rental).
  const extraMsg = await applyExtraCharges('rental', rental.id, customerId, false);
  toast(isReservation
    ? `Reserved for ${customer.firstName} — pickup ${fmtDate(from)}. Press ▶ Start at handover.`
    : `Rental saved! £${totalPrice} charged to ${customer.firstName}.${extraMsg}`, 'success');
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
    return ` Incl. ${res.extras.map(e => `${e.label} £${e.amount.toFixed(2)}`).join(', ')}.`;
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
    <div class="modal-title">⚙️ Manage Phones</div>
    <div class="section-divider">Add New Phone</div>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Phone Number *</label>
        <input class="form-input" id="pNumber" type="text" placeholder="+1 718 555 0101">
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
          <option value="unlimited">Unlimited International – £2.50/day</option>
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
        <input class="form-input" id="pSIMID" type="text" placeholder="ICCID...">
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
      <button class="btn btn-primary" onclick="saveNewPhone()">➕ Add Phone</button>
    </div>
    <div class="section-divider" style="margin-top:20px;">Current Inventory (${phones.length})</div>
    <div style="max-height:200px;overflow-y:auto;">
      ${phones.length === 0 ? '<p style="color:var(--muted);font-size:13px;">No phones yet.</p>' :
        phones.map(p => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;">
            <span style="font-weight:600;">${escHtml(p.number)}</span>
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
    id:         Date.now().toString(),
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

function openEditPhoneModal(phoneId) {
  const p = phones.find(x => x.id === phoneId);
  if (!p) return;
  const activeRental = rentals.find(r => r.phoneId === phoneId && (r.status === 'active' || r.status === 'overdue'));
  const renterInfo = activeRental
    ? `<div style="margin-top:6px;font-size:13px;color:var(--muted);">Rented to: <strong style="color:var(--text);">${escHtml(activeRental.customerName)}</strong> &nbsp;<button class="btn btn-outline" style="padding:3px 10px;font-size:12px;" onclick="closeDynamicModal();openManageRentalModal('${activeRental.id}')">Manage Rental</button></div>`
    : '';
  const statusColor = p.status === 'rented' ? 'var(--accent)' : 'var(--success)';
  const statusLabel = p.status === 'rented' ? '🔴 Rented' : '🟢 Available';
  showDynamicModal(`
    <div class="modal-title">✏️ Edit Phone — ${escHtml(p.number)}</div>
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
        <div style="font-size:13px;font-weight:600;color:${statusColor};padding:8px 0;">${statusLabel}</div>
        ${renterInfo}
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

  // Build per-item status rows — three-position sliding toggle (A2)
  const EQ_LABELS   = { phone: '📱 Phone handset', sim: '💳 SIM card', plug: '🔌 Plug/Charger', cable: '🔋 Cable' };
  const EQ_DEFAULTS = { phone: false, sim: true, plug: false, cable: false };
  const eqRows = ['phone', 'sim', 'plug', 'cable'].map(item => {
    const given   = r.equipmentGiven?.[item] ?? EQ_DEFAULTS[item];
    const status  = getItemStatus(r, item);
    const lostAmt = r.lostCharges?.[item] ?? '';
    const pending = status === 'undecided';
    return `
      <div id="mgEqRow_${item}" style="display:${given ? 'flex' : 'none'};align-items:center;gap:8px;flex-wrap:wrap;padding:3px 0;">
        <input type="hidden" id="mgItemStatus_${item}" value="${status}">
        <span style="font-size:13px;min-width:130px;">${EQ_LABELS[item]}</span>
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
          style="display:${status==='lost'?'inline-block':'none'};width:110px;padding:4px 10px;font-size:12px;border-radius:20px;"
          value="${lostAmt}" oninput="mgUpdateCalc()">
      </div>`;
  }).join('');

  showDynamicModal(`
    <div class="modal-title">⚙ Manage Rental — ${escHtml(r.phoneNumber)}</div>
    <div style="color:var(--muted);font-size:13px;margin-bottom:16px;">
      Customer: <strong style="color:var(--text);">${escHtml(r.customerName)}</strong>
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">From Date</label>
        <input class="form-input" type="date" id="mgFrom" value="${r.fromDate}" onchange="mgUpdateCalc()">
        <div class="hebrew-date-label" id="mgFromHeb"></div>
      </div>
      <div class="form-group">
        <label class="form-label">To Date (inclusive)</label>
        <input class="form-input" type="date" id="mgTo" value="${r.toDate}" onchange="mgUpdateCalc()">
        <div class="hebrew-date-label" id="mgToHeb"></div>
      </div>
      <div class="form-group form-full" id="mgCalcBox">
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px 14px;font-size:13px;">
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
          <span id="mgReturnedLabel" style="font-size:14px;font-weight:600;color:${r.status==='returned'?'var(--success)':'var(--muted)'};">
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
        <span style="font-size:13px;color:var(--muted);white-space:nowrap;">Amount paid: £</span>
        <input class="form-input" type="number" id="mgPaid" value="${paid}" min="0" step="0.5"
          style="width:100px;padding:7px 10px;" oninput="mgUpdateDebt()">
      </div>
      <div style="margin-bottom:8px;">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;">
          <input type="checkbox" id="mgFullyPaid" style="accent-color:var(--accent);"
            onchange="if(this.checked){document.getElementById('mgPaid').value=mgComputeTotal().toFixed(2);mgUpdateDebt();}else{document.getElementById('mgPaid').value='';mgUpdateDebt();}">
          Mark as fully paid
        </label>
      </div>
      <div id="mgDebtDisplay" style="font-size:13px;font-weight:600;color:${debt>0?'var(--danger)':'var(--success)'};">
        ${debt > 0 ? 'Remaining debt: £'+debt : '✓ Fully paid'}
      </div>
    </div>

    <div class="section-divider" style="margin-top:12px;">Equipment</div>
    <div style="margin-bottom:8px;">
      <div style="font-size:12px;color:var(--muted);margin-bottom:6px;">Given to customer — tap to toggle</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
        <div class="eq-btn" id="mgGivenPhone" data-given="${(r.equipmentGiven?.phone??false)?'1':'0'}" onclick="mgToggleGiven('phone')">📱 Phone</div>
        <div class="eq-btn" id="mgGivenSim"   data-given="${(r.equipmentGiven?.sim??true)?'1':'0'}"   onclick="mgToggleGiven('sim')">💳 SIM</div>
        <div class="eq-btn" id="mgGivenPlug"  data-given="${(r.equipmentGiven?.plug??false)?'1':'0'}" onclick="mgToggleGiven('plug')">🔌 Plug</div>
        <div class="eq-btn" id="mgGivenCable" data-given="${(r.equipmentGiven?.cable??false)?'1':'0'}" onclick="mgToggleGiven('cable')">🔋 Cable</div>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:6px;">Item status — tap Returned or Lost for each item given</div>
      <div style="display:flex;flex-direction:column;gap:4px;">${eqRows}</div>
    </div>

    <div class="section-divider" style="margin-top:12px;">Discount</div>
    <div style="margin-bottom:16px;">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;">
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
          style="width:80px;padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-secondary);color:var(--text);font-size:13px;" oninput="mgUpdateCalc()">
      </div>
    </div>

    <div class="form-group" style="margin-bottom:16px;">
      <label class="form-label">Notes</label>
      <input class="form-input" type="text" id="mgNotes" value="${escHtml(r.notes||'')}">
    </div>

    <input type="hidden" id="mgCountry" value="${r.country || 'USA'}">
    <input type="hidden" id="mgUKPlan" value="${r.ukPlan || 'standard'}">
    <input type="hidden" id="mgBasePrice" value="${r.basePrice || r.price}">
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeDynamicModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveManageRental('${rentalId}')">💾 Save Changes</button>
    </div>
  `);

  showHebrewDate('mgFrom','mgFromHeb');
  showHebrewDate('mgTo','mgToHeb');
  mgUpdateCalc();
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

  let finalPrice = price;
  let discountLine = '';
  const addDiscount = document.getElementById('mgAddDiscount')?.checked;
  if (addDiscount) {
    const dtype = document.getElementById('mgDiscountType')?.value || 'percent';
    const dval  = parseFloat(document.getElementById('mgDiscountValue')?.value) || 0;
    finalPrice  = dtype === 'percent' ? Math.max(0, price * (1 - dval / 100)) : Math.max(0, price - dval);
    if (dval > 0) discountLine = ` &nbsp;|&nbsp; -${dtype==='percent'?dval+'%':'£'+dval} → <strong style="color:var(--accent);">£${finalPrice.toFixed(2)}</strong>`;
  }

  const lateFee  = mgComputeLateFee();
  document.getElementById('mgCalcText').innerHTML =
    `Total: ${totalDays}d &nbsp;|&nbsp; Shabbat/YT excluded: <span style="color:var(--gold);">${excl}</span> &nbsp;|&nbsp; Chargeable: ${chargeableDays}d &nbsp;|&nbsp; <strong style="color:var(--success);">£${price}</strong>${discountLine}`;
  document.getElementById('mgPrice').value    = finalPrice.toFixed(2);
  document.getElementById('mgBasePrice').value = price;

  // Build itemised charge breakdown (A3)
  const lostInfo   = mgComputeLostCharges();
  const grandTotal = finalPrice + lateFee + lostInfo.total;
  const row = (label, amount, colour) =>
    `<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px;">
      <span style="color:${colour||'var(--muted)'};">${label}</span>
      <span style="color:${colour||'var(--text)'};">£${amount.toFixed(2)}</span>
    </div>`;
  let html = row('Rental', finalPrice);
  if (lateFee > 0)     html += row('Late fee', lateFee, 'var(--gold)');
  lostInfo.items.forEach(({ label, amount }) => {
    html += row(label + ' — lost', amount, 'var(--danger)');
  });
  html += `<div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;
              margin-top:6px;padding-top:6px;border-top:1px solid var(--border);">
             <span>Total</span>
             <span id="mgTotalChargeValue">£${grandTotal.toFixed(2)}</span>
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
}

function mgUpdateDebt() {
  const total = mgComputeTotal();
  const paid  = parseFloat(document.getElementById('mgPaid')?.value) || 0;
  const diff  = total - paid;
  const el    = document.getElementById('mgDebtDisplay');
  if (!el) return;
  if (diff > 0.005) {
    el.style.color = 'var(--danger)';
    el.textContent = 'Remaining debt: £' + diff.toFixed(2);
  } else if (diff < -0.005) {
    el.style.color = 'var(--warning)';
    el.textContent = '⚠ Paid £' + Math.abs(diff).toFixed(2) + ' over total — reconcile manually';
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

  // No hard block on undecided items — undecided items show ⚠️ badge (getComputedStatus)

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
    body: `<strong>${escHtml(r.customerName || 'Customer')}</strong><br>
      Rental £${newPrice.toFixed(2)}${savedLateFee > 0 ? ` + late fee £${savedLateFee.toFixed(2)}` : ''}${lostInfo.total > 0 ? ` + lost items £${lostInfo.total.toFixed(2)}` : ''}<br>
      <span style="color:var(--muted);font-size:12px;">was £${oldGrand.toFixed(2)}</span>`,
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
  // Per-item status and per-item loss amounts (A1 data model)
  r.itemStatus  = {};
  r.lostCharges = {};
  ['phone', 'sim', 'plug', 'cable'].forEach(item => {
    const st = document.getElementById('mgItemStatus_' + item)?.value || 'undecided';
    r.itemStatus[item]  = st;
    r.lostCharges[item] = st === 'lost' ? (parseFloat(document.getElementById('mgLostAmt_' + item)?.value) || null) : null;
  });
  r.equipmentGiven = {
    phone: document.getElementById('mgGivenPhone')?.dataset.given === '1',
    sim:   document.getElementById('mgGivenSim')?.dataset.given   === '1',
    plug:  document.getElementById('mgGivenPlug')?.dataset.given  === '1',
    cable: document.getElementById('mgGivenCable')?.dataset.given === '1',
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
  const confirmed = await window.api.confirmDelete('Delete this rental record?');
  if (!confirmed) return;
  const r = rentals.find(x => x.id === id);
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
  const p = phones.find(x => x.id === id);
  if (p && p.status === 'rented') { toast('Cannot delete a phone that is currently rented.', 'error'); return; }
  const confirmed = await window.api.confirmDelete('Delete this phone from inventory?');
  if (!confirmed) return;
  phones = phones.filter(x => x.id !== id);
  const res = await savePhones(phones, [id]);
  renderRentalsTab();
  if (res && res.success === false) return; // reportSave already warned
  toast('Phone removed.', 'warning');
}

// ══ DYNAMIC MODAL (shared) ══
function showDynamicModal(html) {
  let overlay = document.getElementById('dynamicModal');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'dynamicModal';
    overlay.className = 'modal-overlay';
    overlay.addEventListener('click', e => { if (e.target === overlay) closeDynamicModal(); });
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `<div class="modal" style="width:560px;">${html}</div>`;
  overlay.classList.remove('hidden');
}
function closeDynamicModal() {
  const overlay = document.getElementById('dynamicModal');
  if (overlay) overlay.classList.add('hidden');
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
      <div class="modal" style="width:430px;">
        <div class="modal-title">${escHtml(title)}</div>
        <div style="font-size:14px;line-height:1.65;margin:4px 0 10px;color:var(--text);">${body}</div>
        ${amount !== null ? `<div style="font-size:24px;font-weight:700;margin:0 0 16px;font-feature-settings:'tnum';">£${Number(amount).toFixed(2)}</div>` : ''}
        <div class="modal-actions">
          <button class="btn btn-outline" onclick="kcConfirmDone(false)">Cancel</button>
          <button class="btn btn-primary" onclick="kcConfirmDone(true)">✓ ${escHtml(okLabel)}</button>
        </div>
      </div>`;
    el.classList.remove('hidden');
  });
}
function kcConfirmDone(ok) {
  const el = document.getElementById('kcConfirm');
  if (el) el.classList.add('hidden');
  const r = kcConfirmResolve; kcConfirmResolve = null;
  if (r) r(ok);
}

// ─────────────────────────────────────────────
//  CUSTOMERS TAB
// ─────────────────────────────────────────────
function renderCustomersTab() {
  applySearch();
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
        <div class="stat-value gold">${sims.filter(s => s.status === 'active').length}</div>
        <div class="stat-sub">Running now</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Revenue</div>
        <div class="stat-value purple">£${totalPaid}</div>
        <div class="stat-sub">All time</div>
      </div>
    </div>

    <div class="section-header">
      <div class="section-title">Customer List</div>
      <div style="display:flex;gap:8px;align-items:center;">
        <select class="form-input" style="width:180px;padding:6px 10px;font-size:13px;min-height:0;"
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
        <select class="form-input" style="width:170px;padding:6px 10px;font-size:13px;min-height:0;"
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

// Live debt/services per customer, used for sorting.
function customerOwed(c) {
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

// Passport-on-file is DERIVED, not just the manual flag: a customer counts as
// having a passport on file if any of their bookings is marked passport-on-file
// or carries a passenger with a passport number. The manual checkbox is only a
// fallback for customers with no booking yet.
function customerHasPassport(c) {
  if (c.passportOnFile) return true;
  return bookings.some(b => b.customerId === c.id &&
    (b.passportOnFile || (b.passengers || []).some(p => p.passportNumber)));
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
  filteredCustomers = sortCustomers(filteredCustomers.filter(customerMatchesFilter));

  if (filteredCustomers.length === 0) {
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

  tbody.innerHTML = filteredCustomers.map(c => {
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
      ...activeCustomerRentals.map(r => `<span class="badge badge-rental">Rental ${r.country === 'USA' ? '🇺🇸' : r.country === 'UK' ? '🇬🇧' : r.country === 'Israel' ? '🇮🇱' : '🌍'}</span>`),
      ...(cUpcomingFlights ? [`<span class="badge badge-booking">✈️ Flight${cUpcomingFlights > 1 ? ' ×' + cUpcomingFlights : ''}</span>`] : []),
      ...(cSimCount ? [`<span class="badge badge-sim">💳 SIM${cSimCount > 1 ? ' ×' + cSimCount : ''}</span>`] : []),
      ...(cVnCount ? [`<span class="badge badge-vn">🔢 VN${cVnCount > 1 ? ' ×' + cVnCount : ''}</span>`] : []),
      ...(cOpenRepairs ? [`<span class="badge badge-repair">🔧 Repair${cOpenRepairs > 1 ? ' ×' + cOpenRepairs : ''}</span>`] : []),
      ...otherServices.map(s => `<span class="badge badge-${s.type}">${escHtml(s.label)}</span>`),
    ].join('');

    const customerDebt = rentals
      .filter(r => r.customerId === c.id)
      .reduce((sum, r) => sum + rentalDebt(r), 0);
    const customerPaid = rentals
      .filter(r => r.customerId === c.id)
      .reduce((sum, r) => sum + (r.amountPaid || 0), 0);

    return `
    <tr class="${selected}" data-id="${c.id}">
      <td>
        <div class="customer-name">${nameHtml(`${c.firstName || ''} ${c.lastName || ''}`.trim())}${customerHasPassport(c) ? ' <span title="Passport on file">🛂</span>' : ''}</div>
        <div class="customer-email">${escHtml(c.email || '')}${c.accountEmail ? `${c.email ? '<br>' : ''}<span title="Account/login email (Lebara etc.) — not for contacting the customer" style="color:var(--muted);">⚙️ ${escHtml(c.accountEmail)}</span>` : ''}</div>
      </td>
      <td>${escHtml(c.phone || '—')}</td>
      <td>${services || '<span style="color:var(--muted);font-size:12px;">None</span>'}</td>
      <td style="color: ${customerDebt > 0 ? 'var(--danger)' : 'var(--success)'}; font-weight: 700;">${customerDebt > 0 ? `£${customerDebt} debt` : `£${customerPaid}`}</td>
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
  for (const r of rentals.filter(x => x.customerId === cid)) {
    ev.push({ date: r.fromDate || r.createdAt, icon: '📱', cat: 'Rental',
      title: `Rental${r.phoneNumber ? ' — ' + r.phoneNumber : r.country ? ' — ' + r.country : ''}`,
      sub: `${r.status}${r.fromDate ? ' · ' + fmtDate(r.fromDate) + (r.toDate ? ' → ' + fmtDate(r.toDate) : '') : ''}`,
      amount: rentalGrandTotal(r) });
  }
  for (const b of bookings.filter(x => x.customerId === cid)) {
    ev.push({ date: b.travelDate || b.createdAt, icon: '✈️', cat: 'Flight',
      title: `${b.route || 'Flight'}${b.passenger ? ' — ' + b.passenger : ''}`,
      sub: `${b.status || ''}${b.travelDate ? ' · ' + fmtDate(b.travelDate) : ''}`,
      amount: Number(b.price || b.total || 0) });
  }
  for (const s of sims.filter(x => x.customerId === cid)) {
    ev.push({ date: s.createdAt || s.renewalDate, icon: '📶', cat: 'SIM',
      title: `SIM — ${s.provider || 'plan'}${s.simNumber ? ' · ' + s.simNumber : ''}`,
      sub: `${s.status || ''}${s.renewalDate ? ' · renews ' + fmtDate(s.renewalDate) : ''}` });
  }
  for (const v of virtualNumbers.filter(x => x.customerId === cid)) {
    ev.push({ date: v.createdAt, icon: '🔢', cat: 'Virtual number',
      title: `VN ${v.number || ''}`.trim(), sub: v.status || '' });
  }
  for (const r of repairs.filter(x => x.customerId === cid)) {
    ev.push({ date: r.openedAt || r.createdAt, icon: '🔧', cat: 'Repair',
      title: `Repair${r.device ? ' — ' + r.device : ''}`, sub: r.status || '',
      amount: Number(r.total || 0) });
  }
  for (const o of serviceOrders.filter(x => x.customerId === cid)) {
    ev.push({ date: o.createdAt, icon: '🖨️', cat: 'Service',
      title: o.serviceName || 'Service', sub: o.createdAt ? fmtDate(o.createdAt) : '',
      amount: Number(o.total || 0) });
  }
  ev.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  return ev;
}

function renderDetailPanel(id) {
  const c = customers.find(x => x.id === id);
  if (!c) return;
  const container = document.getElementById('detailPanelContainer');
  if (!container) return;

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

  const dotColor = { rental: 'dot-blue', vn: 'dot-purple', sim: 'dot-gold', payment: 'dot-green' };

  const historyHTML = history.length === 0
    ? `<div style="color:var(--muted);font-size:13px;padding:10px 0;">No history yet.</div>`
    : history.slice().reverse().map(h => `
        <div class="history-item">
          <div style="display:flex;align-items:center;flex:1;">
            <div class="history-dot ${dotColor[h.type] || 'dot-blue'}"></div>
            <div class="history-desc">${escHtml(h.desc)}</div>
          </div>
          <div class="history-date" style="margin:0 16px;">${escHtml(h.date || '')}</div>
          <div class="history-amount">£${h.amount}</div>
        </div>`).join('');

  const cUpcoming = customerUpcomingBookings(c);
  const allActiveServices = [
    ...cActiveRentals.map(r => ({ type: 'rental', label: `Rental ${r.country === 'USA' ? '🇺🇸' : r.country === 'UK' ? '🇬🇧' : r.country === 'Israel' ? '🇮🇱' : '🌍'}` })),
    ...cUpcoming.map(b => ({ type: 'booking', label: `✈️ ${b.route}${b.travelDate ? ' · ' + fmtDate(b.travelDate) : ''}` })),
    ...cSims.map(s => ({ type: 'sim', label: `SIM · ${s.provider || 'plan'}${s.simNumber ? ' · ' + s.simNumber : ''}` })),
    ...cVNs.map(v => ({ type: 'vn', label: `VN ${v.number || ''}` })),
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
    ? `<span style="color:var(--muted);font-size:13px;">No active services.</span>`
    : allActiveServices.map(s => `<span class="badge badge-${s.type}" style="font-size:12px;padding:5px 12px;">${escHtml(s.label)}</span>`).join('');

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
      <div style="display:flex;align-items:center;gap:8px;font-size:13px;padding:4px 0;">
        <span>${ok ? '✅' : '⚠️'}</span>
        <span style="flex:1;">${ok ? okLabel : missingLabel}</span>
        ${!ok ? fixHtml : ''}
      </div>`;
    tripHtml = `
      <div class="section-divider">✈️ Next trip — ${escHtml(nextTrip.route)} on ${fmtDate(nextTrip.travelDate)}${nextTrip.departureTime ? ' · ' + escHtml(nextTrip.departureTime) : ''}</div>
      <div style="background:var(--bg-secondary);border-radius:10px;padding:10px 14px;margin-bottom:18px;">
        ${item(true, `Flight booked${nextTrip.airline ? ' — ' + escHtml(nextTrip.airline) : ''}${nextTrip.bookingReference ? ' (' + escHtml(nextTrip.bookingReference) + ')' : ''}`, '', '')}
        ${item(!!phoneCover,
          `Phone covered — ${escHtml(phoneCover?.phoneNumber || '')} until ${fmtDate(phoneCover?.toDate)}`,
          'No rental phone covering the travel date',
          `<button class="btn btn-outline btn-sm" style="font-size:11px;padding:3px 10px;" onclick="openNewRentalModal()">📱 Book a phone</button>`)}
        ${item(!!simCover,
          `SIM plan active — ${escHtml(simCover?.provider || '')}`,
          'No active SIM plan',
          `<span style="color:var(--muted);font-size:11px;">add via SIM Plans tab</span>`)}
        ${item(!!vnCover,
          `Virtual number — ${escHtml(vnCover?.number || '')}`,
          'No virtual number (family cannot call locally)',
          `<button class="btn btn-outline btn-sm" style="font-size:11px;padding:3px 10px;" onclick="openNewVNModal('${c.id}')">🔢 Add a number</button>`)}
        ${!nextTrip.passportOnFile ? item(false, '', 'Passport not on file', `<span style="color:var(--muted);font-size:11px;">check at counter</span>`) : ''}
      </div>`;
  }

  // Full activity timeline (Customer 360).
  const timeline = buildCustomerTimeline(c);
  const catCounts = timeline.reduce((m, e) => (m[e.cat] = (m[e.cat] || 0) + 1, m), {});
  const timelineSummary = Object.entries(catCounts).map(([k, n]) => `${n} ${k.toLowerCase()}${n === 1 ? '' : 's'}`).join(' · ');
  const lifetimeSpend = timeline.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const timelineHtml = timeline.length === 0
    ? `<div style="color:var(--muted);font-size:13px;padding:6px 0;">No activity yet.</div>`
    : timeline.map(e => `
        <div class="history-item" style="align-items:flex-start;gap:8px;">
          <span style="width:20px;flex-shrink:0;text-align:center;">${e.icon}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;color:var(--text);">${escHtml(e.title)}</div>
            <div style="font-size:11px;color:var(--muted);">${escHtml(e.cat)}${e.sub ? ' · ' + escHtml(e.sub) : ''}</div>
          </div>
          ${e.amount ? `<span style="font-size:12px;color:var(--muted);white-space:nowrap;">£${Number(e.amount).toFixed(2)}</span>` : ''}
        </div>`).join('');

  const panelHtml = `
    <div class="detail-panel" id="detailPanel">
      <div class="detail-header">
        <div class="avatar">${initials}</div>
        <div style="flex:1;">
          <div class="detail-name">${nameHtml(`${c.firstName || ''} ${c.lastName || ''}`.trim())}${customerHasPassport(c) ? ' <span title="Passport on file" style="font-size:16px;">🛂</span>' : ''}</div>
          <div class="detail-meta">${escHtml(c.phone || '—')} · ✉️ ${escHtml(c.email || 'no contact email')}${c.accountEmail ? ` · <span title="Account/login email (Lebara etc.) — not the customer’s real contact address" style="color:var(--gold);">⚙️ ${escHtml(c.accountEmail)}</span>` : ''} ${addr} · Since ${since}</div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-outline" style="font-size:12px;padding:6px 14px;" onclick="openRemindModal('customer','${c.id}')" title="Remind me about this customer">⏰</button>
          <button class="btn btn-outline" style="font-size:12px;padding:6px 14px;" onclick="openEditModal('${c.id}')">✏️ Edit</button>
          <button class="btn btn-outline" style="font-size:12px;padding:6px 14px;" onclick="dismissCustomerCard()">✕</button>
        </div>
      </div>

      <div class="detail-stats">
        <div class="detail-stat">
          <div class="detail-stat-label">${totalDebt > 0 ? 'Total Debt' : 'Total Paid'}</div>
          <div class="detail-stat-value" style="color:${totalDebt > 0 ? 'var(--danger)' : 'var(--success)'};">£${totalDebt > 0 ? totalDebt : customerPaid}</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-label">Active Rentals</div>
          <div class="detail-stat-value" style="color:var(--accent);">${cActiveRentals.length}</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-label">Virtual Numbers</div>
          <div class="detail-stat-value" style="color:#c026d3;">${activeVNs}</div>
        </div>
      </div>

      ${tripHtml}

      <div class="section-divider">Active Services</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px;">${servicesHTML}</div>

      <div class="section-divider">💰 Wallet</div>
      <div id="walletSection-${c.id}" style="margin-bottom:18px;">
        <div style="color:var(--muted);font-size:13px;padding:6px 0;">Loading wallet…</div>
      </div>

      <details style="margin-top:18px;margin-bottom:6px;">
        <summary style="cursor:pointer;font-weight:600;color:var(--text);font-size:13px;padding:6px 0;border-top:1px solid var(--border);">
          📋 Full history — ${timeline.length} record${timeline.length === 1 ? '' : 's'}${lifetimeSpend > 0 ? ` · £${lifetimeSpend.toFixed(2)} lifetime` : ''}
          ${timelineSummary ? `<div style="font-weight:400;color:var(--muted);font-size:11px;margin-top:2px;">${escHtml(timelineSummary)}</div>` : ''}
        </summary>
        <div style="max-height:300px;overflow-y:auto;margin-top:8px;">${timelineHtml}</div>
      </details>

      <div class="section-divider" style="margin-top:18px;">New Service</div>
      <div class="service-actions">
        <button class="btn btn-rental" style="font-size:13px;padding:7px 16px;" onclick="openNewRentalModal()">📱 New Rental</button>
        <button class="btn btn-primary" style="font-size:13px;padding:7px 16px;" onclick="openNewBookingModal('${c.id}')">✈️ New Flight Booking</button>
        <button class="btn btn-vn" style="font-size:13px;padding:7px 16px;" onclick="openNewVNModal('${c.id}')">🔢 New Virtual Number</button>
        <button class="btn btn-sim" style="font-size:13px;padding:7px 16px;" onclick="openAddSimModal('${c.id}')">💳 New SIM Plan</button>
        <button class="btn btn-outline" style="font-size:13px;padding:7px 16px;" onclick="(async()=>{repairMenu=await window.api.getServiceMenu('repair');openNewRepairModal('${c.id}')})()">🔧 New Repair</button>
        <button class="btn btn-outline" style="font-size:13px;padding:7px 16px;" onclick="openNewServiceModal('${c.id}')">🖨️ Online / Print Service</button>
      </div>
    </div>`;

  // The card opens as a POP-UP over the page — a real "separate card", no
  // page scrolling. Its own overlay sits BELOW the action modals (New Rental,
  // Edit, …) so those stack on top of it. z-index 90 < the 100 of #dynamicModal
  // and #customerModal.
  let overlay = document.getElementById('customerCard');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'customerCard';
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '90';
    overlay.addEventListener('click', e => { if (e.target === overlay) dismissCustomerCard(); });
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `<div class="modal" style="width:720px;max-width:94vw;max-height:90vh;overflow-y:auto;">${panelHtml}</div>`;
  overlay.classList.remove('hidden');
  if (container) container.innerHTML = ''; // legacy inline container stays empty
  loadWalletSection(c.id);
}

function closeCustomerCard() {
  const overlay = document.getElementById('customerCard');
  if (overlay) overlay.classList.add('hidden');
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

const LEDGER_TYPE_LABELS = {
  payment: '💷 Payment', top_up: '➕ Top-up', refund: '↩️ Refund',
  manual_adjustment: '✏️ Adjustment', booking: '✈️ Flight', rental: '📱 Rental',
  rental_adjustment: '📱 Rental adj.', rental_loss: '📱 Loss', rental_void: '📱 Void credit',
  repair: '🔧 Repair', online_service: '🖨️ Service', sim_annual: '💳 SIM annual',
  sim_additional: '💳 SIM extra', sim_replacement: '💳 SIM replacement',
  sim_service: '💳 SIM service', phone_sale: '📦 Phone sale', stock_sale: '📦 Sale',
  virtual_number: '🔢 Virtual number', extra_charge: '➕ Extra charge',
};

async function loadWalletSection(customerId) {
  const el = document.getElementById(`walletSection-${customerId}`);
  if (!el) return;
  let data;
  try { data = await window.api.getLedger(customerId); }
  catch { data = null; }
  if (!data || !data.success) {
    el.innerHTML = `<div style="color:var(--muted);font-size:12px;">Wallet unavailable${data?.error ? ' — ' + escHtml(data.error) : ''}.</div>`;
    return;
  }
  const bal = data.balance || 0;
  const balColor = bal < 0 ? 'var(--danger)' : 'var(--success)';
  const balLabel = bal < 0 ? `owes £${Math.abs(bal).toFixed(2)}` : `£${bal.toFixed(2)} in credit`;
  const entriesHtml = data.entries.length === 0
    ? `<div style="color:var(--muted);font-size:13px;padding:6px 0;">No wallet activity yet.</div>`
    : data.entries.slice(0, 8).map(e => `
        <div class="history-item">
          <div style="display:flex;align-items:center;flex:1;">
            <div class="history-dot ${e.amount >= 0 ? 'dot-green' : 'dot-blue'}"></div>
            <div class="history-desc">${LEDGER_TYPE_LABELS[e.type] || escHtml(e.type)}${e.description ? ' · ' + escHtml(e.description) : ''}</div>
          </div>
          <div class="history-date" style="margin:0 16px;">${fmtDate(e.at)}</div>
          <div class="history-amount" style="color:${e.amount >= 0 ? 'var(--success)' : 'var(--danger)'};">
            ${e.amount >= 0 ? '+' : '−'}£${Math.abs(e.amount).toFixed(2)}</div>
        </div>`).join('');

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
      <span class="badge" style="font-size:14px;padding:7px 16px;background:${bal < 0 ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)'};color:${balColor};">
        Balance: ${balLabel}</span>
      <button class="btn btn-primary" style="font-size:12px;padding:6px 14px;"
        onclick="openWalletModal('${escHtml(customerId)}')">💰 Record payment / credit</button>
      ${data.entries.length > 8 ? `<span style="color:var(--muted);font-size:11px;">showing 8 of ${data.entries.length}</span>` : ''}
    </div>
    <div class="history-list">${entriesHtml}</div>`;
}

function openWalletModal(customerId) {
  const c = customers.find(x => x.id === customerId);
  showDynamicModal(`
    <div class="modal-title">💰 Record payment / credit — ${c ? escHtml(c.firstName) + ' ' + escHtml(c.lastName) : ''}</div>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Type</label>
        <select class="form-input" id="wlKind"
          onchange="document.getElementById('wlMethodWrap').style.display=this.value==='payment'||this.value==='top_up'?'block':'none'">
          <option value="payment">💷 Payment (settles what they owe)</option>
          <option value="top_up">➕ Top-up (credit in advance)</option>
          <option value="refund">↩️ Refund (money back to wallet)</option>
          <option value="adjustment">✏️ Adjustment (correction, ± allowed)</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Amount (£)</label>
        <input class="form-input" type="number" step="0.01" id="wlAmount" placeholder="0.00">
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
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;">
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
  // A negative adjustment is a charge in disguise — confirm it like one.
  if (kind === 'adjustment' && amount < 0) {
    const wlCust = customers.find(x => x.id === customerId);
    if (!(await kcConfirm({
      title: 'Confirm adjustment (charge)',
      body: `<strong>${wlCust ? escHtml(wlCust.firstName) + ' ' + escHtml(wlCust.lastName) : 'Customer'}</strong><br>${note ? escHtml(note) : 'Manual adjustment — reduces their balance'}`,
      amount: Math.abs(amount),
      okLabel: 'Apply adjustment',
    }))) return;
  }
  const res = await window.api.addLedgerEntry({ customerId, kind, amount, method, note });
  if (!res.success) { toast(res.error || 'Could not record it.', 'error'); return; }
  closeDynamicModal();
  toast(`Recorded — wallet balance now £${res.balance.toFixed(2)}.`, 'success');
  if (wantEmail && amount > 0) {
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
      else if (er && er.success) toast(`Receipt emailed to ${er.sentTo}.`, 'success');
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
  content.innerHTML = `<div style="color:var(--muted);padding:30px;">Loading wallet…</div>`;

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
      <span style="flex:1;"><strong>${escHtml(b.customerName)}</strong></span>
      <span style="font-feature-settings:'tnum';color:${negative ? 'var(--danger)' : 'var(--success)'};font-weight:600;">
        ${negative ? '−' : '+'}£${Math.abs(b.balance).toFixed(2)}</span>
      ${b.customerId ? `<button class="btn btn-outline btn-sm" style="margin-left:10px;font-size:11px;padding:4px 10px;"
        onclick="event.stopPropagation();openWalletModal('${escHtml(String(b.customerId))}')">💰 Record</button>` : ''}
      <span class="feed-go">›</span>
    </div>`;

  const arrearsHtml = arrears.length === 0
    ? `<div style="color:var(--muted);font-size:13px;padding:8px 0;">Nobody owes money. 🎉</div>`
    : arrears.map(b => balanceRow(b, true)).join('');
  const creditsHtml = credits.length === 0
    ? `<div style="color:var(--muted);font-size:13px;padding:8px 0;">No prepaid credit held.</div>`
    : credits.map(b => balanceRow(b, false)).join('');

  const feedHtml = (data.recent || []).length === 0
    ? `<div style="color:var(--muted);font-size:13px;padding:8px 0;">No wallet activity yet.</div>`
    : data.recent.map(e => `
        <div class="history-item${e.customerId ? ' dash-link' : ''}"
          style="background:transparent;border-bottom:1px solid var(--border);border-radius:0;padding:9px 2px;"
          ${e.customerId ? `onclick="goToTab('customers',{customerId:'${escHtml(String(e.customerId))}'})" title="Open customer"` : ''}>
          <div style="display:flex;align-items:center;flex:1;min-width:0;">
            <div class="history-dot ${e.amount >= 0 ? 'dot-green' : 'dot-blue'}"></div>
            <div class="history-desc" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              <strong>${escHtml(e.customerName || '—')}</strong> · ${LEDGER_TYPE_LABELS[e.type] || escHtml(e.type)}${e.description ? ' · ' + escHtml(e.description) : ''}${e.method ? ` <span style="color:var(--muted);">(${escHtml(e.method.replace('_', ' '))})</span>` : ''}</div>
          </div>
          <div class="history-date" style="margin:0 12px;">${fmtDate(e.at)}</div>
          <div class="history-amount" style="color:${e.amount >= 0 ? 'var(--success)' : 'var(--text)'};font-feature-settings:'tnum';">
            ${e.amount >= 0 ? '+' : '−'}£${Math.abs(e.amount).toFixed(2)}</div>
        </div>`).join('');

  const customerOptions = [...customers]
    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
    .map(c => `<option value="${escHtml(c.id)}">${escHtml(c.firstName)} ${escHtml(c.lastName)}</option>`)
    .join('');

  content.innerHTML = `
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">Money In Today</div>
        <div class="stat-value" style="color:var(--success);">£${(data.todayIn || 0).toFixed(2)}</div></div>
      <div class="stat-card"><div class="stat-label">Charged Out Today</div>
        <div class="stat-value">£${Math.abs(data.todayOut || 0).toFixed(2)}</div></div>
      <div class="stat-card"><div class="stat-label">Outstanding</div>
        <div class="stat-value" style="color:${arrearsTotal > 0 ? 'var(--danger)' : 'var(--success)'};">£${arrearsTotal.toFixed(2)}</div>
        <div class="stat-sub">${arrears.length} customer${arrears.length === 1 ? '' : 's'} in arrears</div></div>
      <div class="stat-card"><div class="stat-label">Credit Held</div>
        <div class="stat-value">£${creditsTotal.toFixed(2)}</div>
        <div class="stat-sub">${credits.length} customer${credits.length === 1 ? '' : 's'} in credit</div></div>
    </div>

    <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;align-items:center;">
      <select class="form-input" id="wtCustomer" style="width:260px;min-height:0;padding:8px 12px;font-size:13px;">
        <option value="">Choose a customer…</option>${customerOptions}
      </select>
      <button class="btn btn-primary" onclick="(()=>{const id=document.getElementById('wtCustomer').value;
        if(!id){toast('Choose a customer first.','error');return;}openWalletModal(id)})()">💰 Record payment / credit</button>
      <button class="btn btn-outline" onclick="openCashupModal()" style="margin-left:auto;">🧾 Cash-up</button>
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

async function openCashupModal() {
  const today = localISO();
  const data = await kcFetch(`/api/cashup?date=${today}`).then(r => r.json()).catch(() => null);
  if (!data || !data.success) { toast(data?.error || 'Cash-up unavailable.', 'error'); return; }

  const methodRows = Object.entries(data.methods)
    .sort((a, b) => b[1] - a[1])
    .map(([m, amt]) => `
      <div style="display:flex;justify-content:space-between;font-size:13px;padding:5px 0;border-bottom:1px solid var(--border);">
        <span>${METHOD_LABELS[m] || escHtml(m)}</span>
        <strong style="font-feature-settings:'tnum';">£${amt.toFixed(2)}</strong>
      </div>`).join('') ||
    `<div style="color:var(--muted);font-size:13px;padding:6px 0;">No money in yet today.</div>`;

  showDynamicModal(`
    <div class="modal-title">🧾 Cash-up — ${fmtDate(today)}</div>
    <div style="margin-bottom:14px;">${methodRows}
      <div style="display:flex;justify-content:space-between;font-size:13px;padding:7px 0;color:var(--muted);">
        <span>Charged out today</span><span style="font-feature-settings:'tnum';">−£${Math.abs(data.totalOut).toFixed(2)}</span>
      </div>
    </div>
    <div style="background:var(--bg-secondary);border-radius:10px;padding:12px 14px;margin-bottom:14px;">
      ${data.openingFloat ? `<div style="display:flex;justify-content:space-between;font-size:13px;padding-bottom:6px;color:var(--muted);">
        <span>Opening float</span><span style="font-feature-settings:'tnum';">£${Number(data.openingFloat).toFixed(2)}</span>
      </div>` : ''}
      <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:600;">
        <span>Expected cash in till</span><span>£${data.expectedCash.toFixed(2)}</span>
      </div>
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Counted cash (£)</label>
        <input class="form-input" type="number" min="0" step="0.01" id="cuCounted"
          value="${data.count ? data.count.counted.toFixed(2) : ''}" placeholder="0.00"
          oninput="cuUpdateVariance(this, ${data.expectedCash})">
        <div id="cuVariance" style="font-size:12px;margin-top:4px;font-weight:600;">
          ${data.count ? (data.count.variance === 0 ? '✓ Till balances' : `${data.count.variance > 0 ? '+' : '−'}£${Math.abs(data.count.variance).toFixed(2)} ${data.count.variance > 0 ? 'over' : 'short'}`) : ''}</div>
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
    : `${d > 0 ? '+' : '−'}£${Math.abs(d).toFixed(2)} ${d > 0 ? 'over' : 'short'}`;
  el.style.color = d === 0 ? 'var(--success)' : 'var(--danger)';
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
    : `Till counted — ${v > 0 ? '+' : '−'}£${Math.abs(v).toFixed(2)} ${v > 0 ? 'over' : 'short'}.`,
    v === 0 ? 'success' : 'warning');
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
  toast(`£${amt} added to ${c.firstName}'s history!`, 'success');
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
      || (c.email || '').toLowerCase().includes(searchTerm);
  });
}

// ─────────────────────────────────────────────
//  TOPBAR BUTTONS
// ─────────────────────────────────────────────
function setupTopbarButtons() {
  document.getElementById('btnNewCustomer').addEventListener('click', openAddModal);
  // Discoverable entry to the command palette (Ctrl/Cmd+K also opens it).
  const btnNew = document.getElementById('btnNewCustomer');
  if (btnNew && !document.getElementById('btnPalette')) {
    const b = document.createElement('button');
    b.id = 'btnPalette';
    b.className = 'btn btn-outline';
    b.style.cssText = 'font-size:12px;padding:8px 12px;margin-right:8px;';
    b.title = 'Search everything (Ctrl+K)';
    b.innerHTML = '🔍 <span style="color:var(--muted);font-size:11px;">Ctrl K</span>';
    b.addEventListener('click', openPalette);
    btnNew.parentElement.insertBefore(b, btnNew);
  }
}

// ─────────────────────────────────────────────
//  MODAL
// ─────────────────────────────────────────────
function setupModal() {
  document.getElementById('btnCancelModal').addEventListener('click', closeModal);
  document.getElementById('customerModal').addEventListener('click', e => {
    if (e.target === document.getElementById('customerModal')) closeModal();
  });
  document.getElementById('btnSaveCustomer').addEventListener('click', saveCustomer);
  document.getElementById('fPhoneNumber').addEventListener('blur', checkPhoneDuplicate);
  document.getElementById('fEmail').addEventListener('blur', checkEmailDuplicate);
  document.getElementById('fFirstName').addEventListener('blur', checkNameDuplicate);
  document.getElementById('fLastName').addEventListener('blur', checkNameDuplicate);
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
function capName(s) {
  return String(s || '').trim().replace(/(^|[\s\-'’])([a-zà-ÿ])/g, (m, sep, ch) => sep + ch.toUpperCase());
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
  const ae = document.getElementById('fAccountEmail'); if (ae) ae.value = '';
  document.getElementById('fCountryCode').value = '+44';
  ['errFirstName','errLastName','errPhone'].forEach(id => document.getElementById(id).classList.remove('visible'));
  ['warnPhone','warnEmail','warnName'].forEach(id => document.getElementById(id).classList.remove('visible'));
}

function showModal() { document.getElementById('customerModal').classList.remove('hidden'); }
function closeModal() { document.getElementById('customerModal').classList.add('hidden'); }

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

  const payload = { firstName, lastName, phone: fullPhone, email: contactEmail, address,
    accountEmail,
    passportOnFile: document.getElementById('fPassportOnFile').checked };

  if (editId) {
    payload.id = editId;
    const res = await window.api.updateCustomer(payload);
    if (res.success) {
      const idx = customers.findIndex(c => c.id === editId);
      if (idx !== -1) customers[idx] = res.customer;
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
      }
    }
  } else {
    const res = await window.api.addCustomer(payload);
    if (res.success) {
      customers.push(res.customer);
      toast('Customer added!', 'success');
    }
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

function renderSimsTab() {
  const content  = document.getElementById('mainContent');
  const today    = localISO();
  const tomorrow = localISO(new Date(Date.now() + 86400000));

  const active   = sims.filter(s => s.status === 'active').length;
  const renewing = sims.filter(s => s.status === 'active' && (s.renewalDate === today || s.renewalDate === tomorrow));
  const totalRev = sims.reduce((sum, s) => sum + (s.history || []).reduce((a, h) => a + (h.amount || 0), 0), 0);

  const bannerHtml = renewing.length > 0 ? `
    <div class="renewal-banner">
      <span style="font-size:18px;">⚠️</span>
      <span><strong>${renewing.length} SIM${renewing.length > 1 ? 's' : ''} renewing ${renewing.some(s => s.renewalDate === today) ? 'TODAY' : 'TOMORROW'}:</strong>
      ${renewing.map(s => `<span style="margin-left:8px;">· ${escHtml(s.customerName)} (${escHtml(s.simNumber)})</span>`).join('')}</span>
    </div>` : '';

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
        <div class="stat-value purple">£${totalRev}</div>
        <div class="stat-sub">All charges</div>
      </div>
    </div>

    <div style="display:flex; gap:10px; margin-bottom:20px; flex-wrap:wrap; align-items:center;">
      <button class="btn btn-primary" onclick="openAddSimModal()">+ New SIM Plan</button>
      <input class="search-box" style="width:220px;" type="text" id="simSearch"
        placeholder="🔍 Search customer, number, provider..."
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
      <span id="simCount" style="font-size:12px;color:var(--muted);"></span>
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
      !(s.iccid        || '').toLowerCase().includes(term)) return false;
    if (simFilterPay === 'direct' && s.paymentType !== 'direct') return false;
    if (simFilterPay === 'through-me' && s.paymentType === 'direct') return false;
    if (simFilterStatus === 'active' && s.status !== 'active') return false;
    if (simFilterStatus === 'renewing' && !(s.renewalDate === today || s.renewalDate === tomorrow)) return false;
    if (simFilterStatus === 'week' && !(s.status === 'active' && s.renewalDate && s.renewalDate >= today && s.renewalDate <= in7)) return false;
    return true;
  });

  const countEl = document.getElementById('simCount');
  if (countEl) countEl.textContent = `${filtered.length} of ${sims.length}`;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="emoji">💳</div><p>No SIM plans yet.</p><small>Click "+ New SIM Plan" to add one.</small></div></td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(s => {
    const statusBadge =
      s.status === 'active'    ? `<span class="badge badge-active">Active</span>` :
      s.status === 'suspended' ? `<span class="badge badge-suspended">Suspended</span>` :
                                 `<span class="badge badge-cancelled">Cancelled</span>`;

    const isRenewingToday    = s.renewalDate === today;
    const isRenewingTomorrow = s.renewalDate === tomorrow;
    const renewalClass = isRenewingToday ? 'color:var(--danger);font-weight:700;' :
                         isRenewingTomorrow ? 'color:var(--warning);font-weight:700;' : '';
    const renewalLabel = isRenewingToday ? ' ⚠️ Today!' : isRenewingTomorrow ? ' ⚠️ Tomorrow' : '';

    return `<tr style="cursor:pointer;" onclick="if(!event.target.closest('button,select,a'))openManageSimModal('${s.id}')" title="Open SIM">
      <td><div class="customer-name">${escHtml(s.customerName || '—')}</div></td>
      <td>${escHtml(s.provider || '—')}</td>
      <td style="font-weight:600;font-size:12px;">${escHtml(s.simNumber || '—')}</td>
      <td style="font-size:12px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(s.plan || '—')}</td>
      <td style="font-size:12px;${renewalClass}">${fmtDate(s.renewalDate)}${renewalLabel}</td>
      <td style="font-size:12px;">${s.paymentType === 'direct' ? '👤 Direct' : '🔄 Through me'}</td>
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
        <input class="form-input" id="simNumber" type="text" placeholder="+44 7700 900000"
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
        <span style="font-size:11px;color:var(--muted);">Day of month DD is collected (e.g. 1 = 1st of each month)</span>
      </div>
      <div class="form-group" id="simCostGroup" style="display:${(!s || s.paymentType !== 'direct') ? 'block' : 'none'};">
        <label class="form-label">Provider Monthly Cost (£)</label>
        <input class="form-input" id="simMonthlyCost" type="number" min="0" step="0.01" placeholder="0.00" value="${s?.simMonthlyCost || ''}">
        <span style="font-size:11px;color:var(--muted);">What you pay the provider — DD charge = this + 10% (min £2)</span>
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
      body: `<strong>${customer ? escHtml(customer.firstName) + ' ' + escHtml(customer.lastName) : 'Customer'}</strong><br>
        ${escHtml(provider)} SIM — initial setup`,
      amount: setupFee,
      okLabel: 'Charge setup',
    }))) return;
    const setupDate = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
    newSimId = Date.now().toString();
    setupHistoryId = (Date.now() + 1).toString();
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
    ? `<div style="color:var(--muted);font-size:13px;padding:10px 0;">No history yet.</div>`
    : history.slice().reverse().map(h => `
        <div class="history-item">
          <span class="history-dot dot-blue"></span>
          <span class="history-desc">${escHtml(h.desc)}</span>
          <span class="history-date">${escHtml(h.date || '')}</span>
          <span class="history-amount">${h.amount > 0 ? '£'+h.amount : '—'}</span>
          <button class="action-btn danger" style="margin-left:8px;padding:3px 8px;font-size:11px;"
            onclick="deleteSimCharge('${id}','${h.id}')">✕</button>
        </div>`).join('');

  showDynamicModal(`
    <div class="modal-title">💳 ${escHtml(s.customerName)} — ${escHtml(s.provider)}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;font-size:13px;">
      <div style="color:var(--muted);">SIM Number</div><div style="font-weight:600;">${escHtml(s.simNumber||'—')}</div>
      <div style="color:var(--muted);">ICCID</div><div style="font-size:11px;">${escHtml(s.iccid||'—')}</div>
      <div style="color:var(--muted);">Email</div><div style="font-size:11px;">${escHtml(s.email||'—')}</div>
      <div style="color:var(--muted);">Plan</div><div>${escHtml(s.plan||'—')}</div>
      <div style="color:var(--muted);">Renewal</div><div>${fmtDate(s.renewalDate)}</div>
      <div style="color:var(--muted);">Payment</div><div>${s.paymentType === 'direct' ? '👤 Direct' : '🔄 Through me'}</div>
      ${s.paymentType !== 'direct' ? `
      <div style="color:var(--muted);">DD Day</div><div style="font-weight:600;">${s.ddDate ? `${s.ddDate}${s.ddDate===1?'st':s.ddDate===2?'nd':s.ddDate===3?'rd':'th'} of each month` : '—'}</div>
      <div style="color:var(--muted);">Next DD Amount</div><div style="font-weight:700;color:var(--success);">${s.simMonthlyCost ? '£'+ddMonthlyAmount(s.simMonthlyCost).toFixed(2) : '—'}</div>
      ` : ''}
      <div style="color:var(--muted);">Status</div><div>${s.status}</div>
    </div>

    <div class="section-divider">Service History</div>
    <div class="history-list" id="simHistoryList">${historyHtml}</div>

    <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:16px;">
      <div class="section-divider" style="margin-top:0;">Add Charge</div>
      ${multiSimDiscountPct(sims, s.customerId) > 0
        ? `<div style="font-size:12px;color:var(--gold);margin-bottom:8px;">🏷️ 3+ active plans — ${multiSimDiscountPct(sims, s.customerId)}% off applied to monthly/annual prefills.</div>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;">
        <div style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:160px;">
          <label style="font-size:11px;color:var(--muted);font-weight:600;">Type</label>
          <select class="form-input" id="simChargeType" onchange="onSimChargeTypeChange('${id}')" style="font-size:13px;">
            <option value="activation">🟢 Initial Setup — £${simChargePrice('activation')}</option>
            <option value="service">🔧 Service (roaming/swap/reactivation) — £${simChargePrice('service')}</option>
            <option value="sim-replacement">📦 SIM Replacement — £${simChargePrice('sim-replacement')}</option>
            <option value="monthly">${s.paymentType !== 'direct' && s.simMonthlyCost ? `📅 Monthly DD — £${ddMonthlyAmount(s.simMonthlyCost).toFixed(2)}` : '📅 Monthly Subscription'}</option>
            <option value="annual">📅 Annual Subscription — £${simChargePrice('annual')}</option>
            ${simMenu.map(m => `<option value="menu:${escHtml(String(m.id))}">🛒 ${escHtml(m.name)} — £${m.price.toFixed(2)}</option>`).join('')}
            <option value="custom">✏️ Custom</option>
          </select>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;width:80px;">
          <label style="font-size:11px;color:var(--muted);font-weight:600;">Amount £</label>
          <input class="form-input" id="simChargeAmount" type="number" value="${simChargePrice('activation')}" min="0" step="0.5" style="font-size:13px;">
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;flex:2;min-width:140px;">
          <label style="font-size:11px;color:var(--muted);font-weight:600;">Note (optional)</label>
          <input class="form-input" id="simChargeNote" type="text" placeholder="e.g. SIM swapped to new number" style="font-size:13px;">
        </div>
        <button class="btn btn-primary btn-sm" onclick="addSimCharge('${id}')">+ Add</button>
      </div>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
      <span style="font-size:13px;color:var(--muted);">Total charged: <strong style="color:var(--success);">£${totalCharged}</strong></span>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-outline btn-sm" onclick="openEditSimModal('${id}');void(0)">✏️ Edit Details</button>
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
  const pct = settingNum('collect_later_late_pct', 10) / 100;
  const min = settingNum('collect_later_late_min', 2);
  return cost + Math.max(cost * pct, min);
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
  const menuItem = type.startsWith('menu:') ? simMenu.find(x => String(x.id) === type.slice(5)) : null;
  const baseDesc = menuItem?.name || SIM_CHARGE_DESCS[type] || 'Custom charge';
  const desc   = note ? `${baseDesc} — ${note}` : baseDesc;
  if (!(await kcConfirm({
    title: 'Confirm SIM charge',
    body: `<strong>${escHtml(s.customerName || 'Customer')}</strong><br>${escHtml(desc)}`,
    amount,
    okLabel: 'Add charge',
  }))) return;
  if (!s.history) s.history = [];
  const historyId = Date.now().toString();
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
  // and arrears). Debit only — settled later by a wallet payment.
  window.api.chargeSim({ simId: s.id, customerId: s.customerId, historyId, amount, description: desc })
    .then(res => { if (!res?.success) toast(res?.error || 'Charge saved, but not billed to the wallet.', 'error'); })
    .catch(() => toast('Charge saved, but not billed to the wallet.', 'error'));
  toast(`Charge of £${amount} added ✅`, 'success');
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
  const confirmed = await window.api.confirmDelete(`Delete SIM plan for "${s.customerName}"?\n\nThis cannot be undone.`);
  if (!confirmed) return;
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
  document.getElementById(id).classList.toggle('error', isErr);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// Escape a name AND isolate its text direction. <bdi> stops a mixed
// Hebrew/Latin name (RTL) from visually reordering against adjacent LTR
// content — a badge, phone number, date or parenthetical. Inert for plain
// Latin names (no visual change), so it's safe to use everywhere a person's
// name is shown.
function nameHtml(str) { return `<bdi>${escHtml(str)}</bdi>`; }

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
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ─────────────────────────────────────────────
//  TICKETS & FLIGHTS (bookings)
// ─────────────────────────────────────────────
// Tables-native: rows live in the relational bookings table and creating a
// booking posts a BOOKING-<id> wallet charge to the append-only ledger.

const BOOKING_STATUSES = ['Booked', 'Ticketed', 'Completed', 'Cancelled'];

function bookingStatusBadge(status) {
  const styles = {
    Booked:    'background:rgba(185,185,249,0.45);color:#4434d4;',
    Ticketed:  'background:rgba(249,107,238,0.14);color:#c026d3;',
    Completed: 'background:rgba(34,197,94,0.15);color:var(--success);',
    Cancelled: 'background:rgba(239,68,68,0.15);color:var(--danger);',
  };
  // For flights, "Completed" reads more naturally as "Flown".
  const label = status === 'Completed' ? '✈️ Flown' : status;
  return `<span class="badge" style="${styles[status] || styles.Booked}">${escHtml(label)}</span>`;
}

function renderBookingsTab() {
  const content = document.getElementById('mainContent');
  const today = localISO();
  const active = bookings.filter(b => b.status !== 'Cancelled');
  const upcoming = active.filter(b => b.travelDate && b.travelDate >= today).length;
  const feesEarned = active.reduce((s, b) => s + (b.bookingFee || 0), 0);
  const totalCharged = active.reduce((s, b) => s + (b.price || 0) + (b.bookingFee || 0), 0);

  const rows = bookings.length === 0
    ? `<tr><td colspan="9"><div class="empty-state"><div class="emoji">✈️</div><p>No bookings yet.</p><small>Click "New Booking" to add the first one.</small></div></td></tr>`
    : bookings.map(b => `
      <tr style="cursor:pointer;" onclick="if(!event.target.closest('button,select,a'))openEditBookingModal('${escHtml(b.id)}')" title="Open booking">
        <td><div class="customer-name">${escHtml(b.customerName || '—')}</div>
            <div class="customer-email">${escHtml(b.passenger || '')}${(b.passengers || []).length ? ` · 👥 ${b.passengers.length}` : ''}</div></td>
        <td>${escHtml(b.route)}</td>
        <td>${escHtml(b.airline || '—')}<div class="customer-email">${escHtml(b.bookingReference || '')}</div></td>
        <td>${b.travelDate ? fmtDate(b.travelDate) : '—'}
            <div class="customer-email">${escHtml(b.departureTime || '')}${b.arrivalTime ? ' → ' + escHtml(b.arrivalTime) : ''}</div></td>
        <td>£${(b.price || 0).toFixed(2)}</td>
        <td>£${(b.bookingFee || 0).toFixed(2)}</td>
        <td>${bookingStatusBadge(b.status)}</td>
        <td style="cursor:pointer;" onclick="openCheckinModal('${escHtml(b.id)}')" title="Set check-in">${checkinChip(b)}</td>
        <td style="white-space:nowrap;">
          <button class="action-btn" onclick="openCheckinModal('${escHtml(b.id)}')" title="Online check-in">🛫</button>
          <button class="action-btn" onclick="openPassengersModal('${escHtml(b.id)}')" title="Passengers (DOB, passport)">👥</button>
          <button class="action-btn" onclick="openRemindModal('booking','${escHtml(b.id)}')" title="Remind me">⏰</button>
          <select class="form-input" style="width:110px;padding:5px 8px;font-size:12px;"
            onchange="changeBookingStatus('${escHtml(b.id)}', this.value)">
            ${BOOKING_STATUSES.map(s => `<option value="${s}" ${b.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </td>
      </tr>`).join('');

  content.innerHTML = `
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">Total Bookings</div><div class="stat-value">${bookings.length}</div></div>
      <div class="stat-card"><div class="stat-label">Upcoming Travel</div><div class="stat-value">${upcoming}</div></div>
      <div class="stat-card"><div class="stat-label">Booking Fees</div><div class="stat-value">£${feesEarned.toFixed(2)}</div></div>
      <div class="stat-card"><div class="stat-label">Total Charged</div><div class="stat-value">£${totalCharged.toFixed(2)}</div></div>
    </div>
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px;">
      <button class="btn btn-primary" onclick="openNewBookingModal()">+ New Booking</button>
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
  const fld = (label, inner) => `<label style="display:flex;flex-direction:column;gap:2px;font-size:10px;color:var(--muted);">${label}${inner}</label>`;
  return bkPassengers.map((p, i) => `
    <div style="border:1px solid var(--border);border-radius:8px;padding:8px 10px;margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <strong style="font-size:12px;">Passenger ${i + 1}</strong>
        <button type="button" class="action-btn" onclick="bkRemovePax(${i})" title="Remove">✕</button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${fld('Full name (as on passport)', `<input class="form-input" value="${escHtml(p.fullName || '')}" oninput="bkPassengers[${i}].fullName=this.value" style="width:200px;">`)}
        ${fld('Date of birth', `<input class="form-input" type="date" value="${escHtml(p.dob || '')}" onchange="bkPassengers[${i}].dob=this.value" style="width:150px;">`)}
        ${fld('Nationality', `<input class="form-input" value="${escHtml(p.nationality || '')}" oninput="bkPassengers[${i}].nationality=this.value" placeholder="e.g. British" style="width:140px;">`)}
        ${fld('Passport №', `<input class="form-input" value="${escHtml(p.passportNumber || '')}" oninput="bkPassengers[${i}].passportNumber=this.value" placeholder="${helperMasked ? 'hidden — check-in screen' : ''}" style="width:150px;">`)}
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
      style="padding:5px 12px;font-size:12px;margin-top:2px;">+ Add passenger</button>
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
    `<option value="${c.id}" ${c.id === preselectCustomerId ? 'selected' : ''}>${escHtml(c.firstName)} ${escHtml(c.lastName)} · ${escHtml(c.phone || '')}</option>`
  ).join('');
  const startFee = ticketsMenu.find(s => /start fee/i.test(s.name));
  const svcOptions = ticketsMenu
    .filter(s => !/start fee/i.test(s.name))
    .map(s => `<option value="${escHtml(s.id)}">${escHtml(s.name)} — £${s.price.toFixed(2)}</option>`)
    .join('');
  showDynamicModal(`
    <div class="modal-title">✈️ New Booking</div>
    <div class="form-grid">
      <div class="form-group form-full">
        <label class="form-label">Customer *</label>
        <select class="form-input" id="bkCustomer">
          <option value="">Select customer…</option>${customerOptions}
        </select>
      </div>
      <div class="form-group form-full">
        <label class="form-label">Passengers <span style="color:var(--muted);font-weight:400;">(name · date of birth · passport)</span></label>
        <div id="bkPaxEditor">${paxEditorHtml()}</div>
        <button type="button" class="btn btn-outline" onclick="bkAddPax()"
          style="padding:5px 12px;font-size:12px;margin-top:2px;">+ Add passenger</button>
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
          <span style="font-size:11px;color:var(--muted);">"Paid now" settles it immediately — no wallet debt.</span>
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
          ${startFee ? `<label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;">
            <input type="checkbox" id="bkStartFee" onchange="bkCalcFee()"
              style="width:14px;height:14px;accent-color:var(--accent);"> + start fee £${startFee.price.toFixed(2)}
          </label>` : ''}
        </div>
        <div id="bkFeeBreakdown" style="font-size:11px;color:var(--muted);margin-top:4px;"></div>
      </div>` : ''}
      <div class="form-group">
        <label class="form-label">Passport on file?</label>
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
          <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">
            <input type="checkbox" id="bkCheckinDone" style="width:15px;height:15px;accent-color:var(--accent);"> already done
          </label>
          <span id="bkCheckinDateWrap" style="display:none;align-items:center;gap:6px;">
            <span style="font-size:12px;color:var(--muted);">do it on</span>
            <input class="form-input" type="date" id="bkCheckinDate" style="width:150px;">
          </span>
        </div>
        <div style="font-size:11px;color:var(--muted);margin-top:4px;">"We do check-in" + a date raises a task reminder for that day.</div>
      </div>
      <div class="form-group form-full">
        <label class="form-label">Notes</label>
        <input class="form-input" id="bkNotes">
      </div>
    </div>
    <div style="margin-top:8px;padding:10px;border-radius:8px;background:var(--bg-secondary);font-size:12px;color:var(--muted);">
      Saving posts one wallet charge of <strong>price + fee</strong> to the customer's ledger (reference <code>BOOKING-…</code>).
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeDynamicModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveNewBooking()">✈️ Save Booking</button>
    </div>
  `);
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
  const parts = [`1 × £${svc.price.toFixed(2)}`];
  if (n > 1 && svc.repeatPrice !== null) parts.push(`${Math.min(n - 1, 4)} × £${Number(svc.repeatPrice).toFixed(2)}`);
  if (n > 5 && svc.repeatPrice !== null) parts.push(`${n - 5} × £${Number(svc.bulkPrice ?? svc.repeatPrice).toFixed(2)}`);
  if (startFee) parts.push(`start £${startFee.toFixed(2)}`);
  document.getElementById('bkFeeBreakdown').textContent =
    `${n} passenger${n === 1 ? '' : 's'}: ${parts.join(' + ')} = £${fee.toFixed(2)}`;
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

  const bkCust = customers.find(c => c.id === payload.customerId);
  if (!(await kcConfirm({
    title: 'Confirm booking charge',
    body: `<strong>${bkCust ? escHtml(bkCust.firstName) + ' ' + escHtml(bkCust.lastName) : 'Customer'}</strong><br>
      ${escHtml(payload.route)}${payload.airline ? ' · ' + escHtml(payload.airline) : ''} · ${fmtDate(payload.travelDate)}<br>
      Ticket £${payload.price.toFixed(2)}${payload.bookingFee ? ` + fee £${payload.bookingFee.toFixed(2)}` : ''}${payload.payment === 'paid' ? ' · paid now' : ' · on account'}`,
    amount: payload.price + (payload.bookingFee || 0),
    okLabel: 'Charge booking',
  }))) return;

  const res = await window.api.addBooking(payload);
  if (!res.success) { toast(res.error || 'Could not save the booking.', 'error'); return; }

  bookings.unshift(res.booking);
  await maybeCheckinTask(res.booking);
  closeDynamicModal();
  let chargeMsg = '';
  if (res.chargePosted) {
    chargeMsg = res.paidNow
      ? ` £${res.charged.toFixed(2)} paid in full.`
      : ` £${res.charged.toFixed(2)} on account — wallet balance £${res.balance.toFixed(2)}.`;
  }
  if (res.extras?.length) chargeMsg += ` Incl. ${res.extras.map(e => `${e.label} £${e.amount.toFixed(2)}`).join(', ')}.`;
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
  const cell = (lbl, val, raw) => val ? `
    <div style="display:flex;align-items:center;gap:6px;">
      <span style="color:var(--muted);">${lbl}:</span>
      <strong style="cursor:pointer;border-bottom:1px dashed var(--border);" title="Click to copy"
        onclick="copyText('${escHtml(String(raw != null ? raw : val)).replace(/'/g, "\\'")}','${lbl}')">${escHtml(val)}</strong>
    </div>` : '';
  const paxAll = (p) => [
    p.fullName && `Name: ${p.fullName}`, p.dob && `DOB: ${p.dob}`, p.nationality && `Nationality: ${p.nationality}`,
    p.passportNumber && `Passport: ${p.passportNumber}`, p.passportExpiry && `Expiry: ${p.passportExpiry}`,
    p.passportIssueDate && `Issued: ${p.passportIssueDate}`, p.issuingCountry && `Issuing country: ${p.issuingCountry}`,
  ].filter(Boolean).join('\n');
  const paxHtml = pax.length ? `
    <div class="section-divider" style="margin:4px 0 8px;">Passenger details <span style="color:var(--muted);font-weight:400;font-size:11px;">— click any value to copy</span></div>
    <div style="max-height:260px;overflow-y:auto;margin-bottom:12px;">
      ${pax.map((p, i) => `
        <div style="border:1px solid var(--border);border-radius:8px;padding:8px 10px;margin-bottom:8px;font-size:12px;line-height:1.7;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong style="font-size:13px;cursor:pointer;" title="Click to copy" onclick="copyText('${escHtml(String(p.fullName||'')).replace(/'/g, "\\'")}','name')">${escHtml(p.fullName || '(no name)')}</strong>
            <button type="button" class="btn btn-outline btn-sm" style="font-size:11px;padding:3px 10px;"
              onclick="copyText(paxCopyBlocks[${i}],'all details')">📋 Copy all</button>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 16px;margin-top:4px;">
            ${cell('DOB', p.dob && fmtDate(p.dob), p.dob)}
            ${cell('Nationality', p.nationality)}
            ${cell('Passport №', p.passportNumber)}
            ${cell('Expiry', p.passportExpiry && fmtDate(p.passportExpiry), p.passportExpiry)}
            ${cell('Issued', p.passportIssueDate && fmtDate(p.passportIssueDate), p.passportIssueDate)}
            ${cell('Issuing country', p.issuingCountry)}
          </div>
          ${(!p.passportNumber && !p.dob) ? '<div style="color:var(--warning);margin-top:4px;">⚠️ Missing details — open 👥 Passengers to fill them in.</div>' : ''}
        </div>`).join('')}
    </div>` : `<div style="font-size:12px;color:var(--muted);margin-bottom:12px;">No passenger details yet — add them via the 👥 button.</div>`;
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
        <label style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer;">
          <input type="checkbox" id="ciDone" ${b.checkinDone ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--accent);">
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
  return `<span class="badge" style="background:rgba(234,179,8,0.15);color:var(--warning);" title="Check-in not set">⚠️ ?</span>`;
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
function openEditBookingModal(id) {
  const b = bookings.find(x => x.id === id);
  if (!b) return;
  showDynamicModal(`
    <div class="modal-title">✈️ ${escHtml(b.customerName || 'Booking')} — ${escHtml(b.route || '')}</div>
    <div class="form-grid">
      <div class="form-group form-full">
        <label class="form-label">Passenger(s) summary</label>
        <input class="form-input" id="ebPassenger" value="${escHtml(b.passenger || '')}" placeholder="Names">
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
      <div class="form-group"><label class="form-label">Passport on file?</label>
        <div style="display:flex;gap:8px;align-items:center;">
          <input type="checkbox" id="ebPassport" ${b.passportOnFile ? 'checked' : ''}
            onchange="document.getElementById('ebPExpWrap').style.display=this.checked?'block':'none'">
          <div id="ebPExpWrap" style="display:${b.passportOnFile ? 'block' : 'none'};flex:1;">
            <input class="form-input" type="date" id="ebPExp" value="${escHtml(b.passportExpiry || '')}" title="Passport expiry">
          </div>
        </div></div>
      <div class="form-group form-full"><label class="form-label">Notes</label>
        <input class="form-input" id="ebNotes" value="${escHtml(b.notes || '')}"></div>
    </div>
    <div style="margin-top:8px;padding:10px;border-radius:8px;background:var(--bg-secondary);font-size:12px;color:var(--muted);">
      💷 Price <strong>£${(b.price || 0).toFixed(2)}</strong> + fee <strong>£${(b.bookingFee || 0).toFixed(2)}</strong> (read-only — adjust money via the customer's wallet).
      &nbsp;·&nbsp; <a href="#" onclick="closeDynamicModal();openPassengersModal('${escHtml(b.id)}');return false;">👥 Passengers</a>
      &nbsp;·&nbsp; <a href="#" onclick="closeDynamicModal();openCheckinModal('${escHtml(b.id)}');return false;">🛫 Check-in</a>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeDynamicModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveEditBooking('${escHtml(b.id)}')">💾 Save</button>
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
//  REPAIRS
// ─────────────────────────────────────────────
// Tables-native. Prices freeze into the ticket at open time; the wallet
// charge (REPAIR-<id>) posts once, when the repair is marked Collected.

let repairs = [];
let repairMenu = [];
const REPAIR_STATUSES = ['Open', 'In Progress', 'Ready', 'Collected', 'Cancelled'];
let repairFilter = 'all'; // all | active (open/in-progress) | ready (waiting for collection)

function repairStatusBadge(status) {
  const styles = {
    'Open':        'background:rgba(185,185,249,0.45);color:#4434d4;',
    'In Progress': 'background:#f5e9d4;color:#9b6829;',
    'Ready':       'background:rgba(249,107,238,0.14);color:#c026d3;',
    'Collected':   'background:rgba(34,197,94,0.15);color:var(--success);',
    'Cancelled':   'background:rgba(239,68,68,0.15);color:var(--danger);',
  };
  return `<span class="badge" style="${styles[status] || styles.Open}">${escHtml(status)}</span>`;
}

async function renderRepairsTab() {
  const content = document.getElementById('mainContent');
  content.innerHTML = `<div style="color:var(--muted);padding:30px;">Loading repairs…</div>`;
  [repairs, repairMenu] = await Promise.all([
    window.api.getRepairs(),
    window.api.getServiceMenu('repair'),
  ]);
  if (!Array.isArray(repairs)) repairs = [];

  const open = repairs.filter(r => r.status === 'Open' || r.status === 'In Progress');
  const ready = repairs.filter(r => r.status === 'Ready');
  const revenue = repairs.filter(r => r.status === 'Collected').reduce((s, r) => s + (r.total || 0), 0);

  const shown = repairFilter === 'ready' ? ready : repairFilter === 'active' ? open : repairs;
  const emptyMsg = repairFilter === 'ready' ? 'No repairs waiting for collection.'
    : repairFilter === 'active' ? 'No open repair tickets.' : 'No repairs yet.';
  const rows = shown.length === 0
    ? `<tr><td colspan="7"><div class="empty-state"><div class="emoji">🔧</div><p>${emptyMsg}</p><small>${repairFilter === 'all' ? 'Click "New Repair" to open the first ticket.' : 'Change the filter to see other tickets.'}</small></div></td></tr>`
    : shown.map(r => `
      <tr>
        <td><div class="customer-name">${escHtml(r.customerName || '—')}</div></td>
        <td>${escHtml(r.device || '—')}${r.kcPurchase ? ' <span class="badge" style="background:rgba(83,58,253,0.1);color:var(--accent);font-size:10px;">KC phone</span>' : ''}</td>
        <td style="font-size:12px;">${r.services.map(s => escHtml(s.name)).join('<br>') || '—'}</td>
        <td><strong>£${(r.total || 0).toFixed(2)}</strong></td>
        <td>${r.openedAt ? fmtDate(r.openedAt) : '—'}</td>
        <td>${repairStatusBadge(r.status)}</td>
        <td style="white-space:nowrap;">
          <button class="action-btn" onclick="openRemindModal('repair','${escHtml(r.id)}')" title="Remind me">⏰</button>
          <select class="form-input" style="width:120px;padding:5px 8px;font-size:12px;"
            onchange="changeRepairStatus('${escHtml(r.id)}', this.value)">
            ${REPAIR_STATUSES.map(s => `<option value="${s}" ${r.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </td>
      </tr>`).join('');

  content.innerHTML = `
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">Open Tickets</div><div class="stat-value">${open.length}</div></div>
      <div class="stat-card"><div class="stat-label">Ready to Collect</div><div class="stat-value">${ready.length}</div></div>
      <div class="stat-card"><div class="stat-label">Repairs Revenue</div><div class="stat-value">£${revenue.toFixed(2)}</div></div>
      <div class="stat-card"><div class="stat-label">Total Tickets</div><div class="stat-value">${repairs.length}</div></div>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:12px;">
      <select class="form-input" style="width:200px;" onchange="repairFilter=this.value; renderRepairsTab()">
        <option value="all" ${repairFilter==='all'?'selected':''}>Show: all tickets</option>
        <option value="active" ${repairFilter==='active'?'selected':''}>Open / in progress</option>
        <option value="ready" ${repairFilter==='ready'?'selected':''}>Waiting for collection</option>
      </select>
      <button class="btn btn-primary" onclick="openNewRepairModal()">+ New Repair</button>
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
    `<option value="${c.id}" ${preselectCustomerId === c.id ? 'selected' : ''}>${escHtml(c.firstName)} ${escHtml(c.lastName)} · ${escHtml(c.phone || '')}</option>`
  ).join('');
  const serviceChecks = repairMenu.map(m => `
    <label style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px;cursor:pointer;">
      <input type="checkbox" class="rpService" value="${escHtml(m.id)}"
        data-price="${m.price}" data-reg="${m.price}" data-kc="${m.kcPrice ?? ''}"
        onchange="updateRepairTotal()">
      <span style="flex:1;">${escHtml(m.name)}</span>
      <strong class="rpPriceLbl">£${m.price.toFixed(2)}</strong>
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
        <label for="rpKC" style="font-size:13px;cursor:pointer;">
          🏷️ Phone purchased at Kosher Connect — discounted prices
        </label>
      </div>
      <div class="form-group form-full">
        <label class="form-label">Services * <span style="color:var(--muted);font-weight:400;">(prices frozen at open)</span></label>
        <div style="max-height:220px;overflow-y:auto;padding:0 4px;">${serviceChecks ||
          '<div style="color:var(--muted);font-size:13px;">Price list unavailable.</div>'}</div>
      </div>
      <div class="form-group form-full">
        <label class="form-label">Notes</label>
        <input class="form-input" id="rpNotes">
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
      <div style="font-size:14px;">Total: <strong id="rpTotal" style="color:var(--success);">£0.00</strong>
        <span style="color:var(--muted);font-size:11px;">— charged to wallet on collection</span></div>
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
  document.getElementById('rpTotal').textContent = `£${total.toFixed(2)}`;
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
        ? `<span style="color:var(--muted);text-decoration:line-through;font-weight:400;">£${reg.toFixed(2)}</span> £${eff.toFixed(2)}`
        : `£${reg.toFixed(2)}`;
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
    body: `<strong>${rpCust ? escHtml(rpCust.firstName) + ' ' + escHtml(rpCust.lastName) : 'Customer'}</strong><br>
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
  toast(`Repair ticket opened — £${res.repair.total.toFixed(2)} on collection.`, 'success');
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
}

function openCollectRepairModal(id) {
  const r = repairs.find(x => x.id === id);
  if (!r) return;
  showDynamicModal(`
    <div class="modal-title">🔧 Collect repair — ${escHtml(r.customerName || '')}</div>
    <div style="font-size:14px;margin-bottom:12px;">${escHtml(r.device || 'device')} · total <strong>£${(r.total || 0).toFixed(2)}</strong></div>
    <div class="form-group">
      <label class="form-label">Payment</label>
      <select class="form-input" id="rcPay">
        <option value="account">Put on account (wallet)</option>
        <option value="cash">Paid now — 💵 Cash</option>
        <option value="card">Paid now — 💳 Card</option>
        <option value="card_on_file">Paid now — card on file (Stripe)</option>
        <option value="bank_transfer">Paid now — 🏦 Transfer</option>
      </select>
      <div style="font-size:11px;color:var(--muted);margin-top:4px;">"Paid now" settles it immediately — no wallet debt.</div>
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
      ? `Collected — £${res.repair.total.toFixed(2)} paid in full.`
      : `Collected — £${res.repair.total.toFixed(2)} on account. Balance £${res.balance.toFixed(2)}.`, 'success');
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
    if (bd) bd.innerHTML = `⏱ ${minutes} min at £${settingNum('online_hourly_rate', 45)}/hr (10-min minimum) = <strong>£${amount.toFixed(2)}</strong> — editable.`;
  }, 60);
}

async function renderServicesTab() {
  const content = document.getElementById('mainContent');
  content.innerHTML = `<div style="color:var(--muted);padding:30px;">Loading services…</div>`;
  if (svcTimerInterval) { clearInterval(svcTimerInterval); svcTimerInterval = null; }
  [serviceOrders, onlineMenu] = await Promise.all([
    window.api.getServiceOrders(),
    window.api.getServiceMenu('online'),
  ]);
  if (!Array.isArray(serviceOrders)) serviceOrders = [];
  if (!Array.isArray(onlineMenu)) onlineMenu = [];

  const today = localISO();
  const todays = serviceOrders.filter(o => (o.createdAt || '').slice(0, 10) === today);
  const revenue = serviceOrders.reduce((s, o) => s + (o.total || 0), 0);

  const orderRows = serviceOrders.length === 0
    ? `<tr><td colspan="5"><div class="empty-state"><div class="emoji">🖨️</div><p>No services charged yet.</p></div></td></tr>`
    : serviceOrders.map(o => `
      <tr>
        <td><div class="customer-name">${escHtml(o.customerName || '—')}</div></td>
        <td>${escHtml(o.serviceName)}${o.qty > 1 ? ` <span style="color:var(--muted);">× ${o.qty}</span>` : ''}</td>
        <td><strong>£${(o.total || 0).toFixed(2)}</strong></td>
        <td>${o.createdAt ? fmtDate(o.createdAt) : '—'}</td>
        <td style="font-size:12px;color:var(--muted);">${escHtml(o.notes || '')}</td>
      </tr>`).join('');

  const menuRows = onlineMenu.map(m => `
    <tr>
      <td>${escHtml(m.name)}</td>
      <td>£${m.price.toFixed(2)}</td>
      <td>${m.repeatPrice === null ? '—' : '£' + m.repeatPrice.toFixed(2)}</td>
    </tr>`).join('');

  content.innerHTML = `
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">Charged Today</div>
        <div class="stat-value">£${todays.reduce((s, o) => s + (o.total || 0), 0).toFixed(2)}</div>
        <div class="stat-sub">${todays.length} service${todays.length === 1 ? '' : 's'}</div></div>
      <div class="stat-card"><div class="stat-label">All-Time Revenue</div>
        <div class="stat-value">£${revenue.toFixed(2)}</div></div>
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
            <div style="font-weight:600;">Helping ${escHtml(t.customerName || 'customer')}</div>
            <div style="font-size:12px;color:${paused ? 'var(--gold)' : 'var(--muted)'};">${paused ? 'paused — resume to keep counting' : 'running'}</div>
          </div>
          <strong id="svcTimerElapsed" style="font-size:22px;font-feature-settings:'tnum';">0:00</strong>
          <span id="svcTimerProj" style="font-size:13px;color:var(--muted);"></span>
          ${paused
            ? `<button class="btn btn-outline" onclick="svcTimerResume()">▶ Resume</button>`
            : `<button class="btn btn-outline" onclick="svcTimerPause()">⏸ Pause</button>`}
          <button class="btn btn-primary" onclick="svcTimerStop()">⏹ Stop &amp; charge</button>
          <button class="btn btn-outline btn-sm" onclick="svcTimerDiscard()">✕ Discard</button>
        </div>`;
      }
      const opts = customers.map(c => `<option value="${c.id}">${escHtml(c.firstName)} ${escHtml(c.lastName)}</option>`).join('');
      return `
        <div class="table-card" style="margin-bottom:14px;padding:14px 18px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <span style="font-size:20px;">⏱</span>
          <span style="font-size:13px;color:var(--muted);">Hourly help timer (£${settingNum('online_hourly_rate', 45)}/hr, 10-min minimum)</span>
          <select class="form-input" id="svcTimerCustomer" style="flex:1;min-width:180px;min-height:0;padding:8px 12px;">
            <option value="">Who are you helping?</option>${opts}
          </select>
          <button class="btn btn-primary" onclick="svcTimerStart()">▶ Start timer</button>
        </div>`;
    })()}
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px;">
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
      if (p) p.textContent = `≈ £${amount.toFixed(2)} (${minutes} min, 10-min minimum)`;
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
    `<option value="${c.id}" ${preselectCustomerId === c.id ? 'selected' : ''}>${escHtml(c.firstName)} ${escHtml(c.lastName)} · ${escHtml(c.phone || '')}</option>`).join('');
  const svcOptions = onlineMenu.map(m =>
    `<option value="${escHtml(String(m.id))}">${escHtml(m.name)} — £${m.price.toFixed(2)}${m.repeatPrice !== null ? ` (${onlineRepeatFrom()}+ £${m.repeatPrice.toFixed(2)})` : ''}</option>`).join('');
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
            style="width:16px;height:16px;accent-color:var(--accent);cursor:pointer;">
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
    <div style="margin-top:8px;padding:10px;border-radius:8px;background:var(--bg-secondary);font-size:12px;color:var(--muted);" id="svBreakdown">
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
    ? `${qty} applications: ${atSingle} × £${svc.price.toFixed(2)} + ${atRepeat} × £${Number(svc.repeatPrice).toFixed(2)} = <strong>£${total.toFixed(2)}</strong>`
    : `${qty} × £${svc.price.toFixed(2)} = <strong>£${total.toFixed(2)}</strong>`;
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
  if (!(await kcConfirm({
    title: 'Confirm service charge',
    body: `<strong>${svCust ? escHtml(svCust.firstName) + ' ' + escHtml(svCust.lastName) : 'Customer'}</strong><br>
      ${escHtml(svLabel.trim())}${svPaid ? ' · paid now' : ' · on account'}`,
    amount: Number.isFinite(svTotal) ? svTotal : 0,
    okLabel: 'Charge service',
  }))) return;
  const res = await window.api.addServiceOrder({
    customerId,
    serviceId,
    qty: Math.max(1, parseInt(document.getElementById('svQty').value, 10) || 1),
    total: parseFloat(document.getElementById('svTotal').value),
    paidNow: document.getElementById('svPaid').checked,
    method: document.getElementById('svMethod').value,
    notes: document.getElementById('svNotes').value.trim(),
  });
  if (!res.success) { toast(res.error || 'Could not charge the service.', 'error'); return; }
  closeDynamicModal();
  const extraMsg = res.extras?.length ? ` Incl. ${res.extras.map(e => `${e.label} £${e.amount.toFixed(2)}`).join(', ')}.` : '';
  toast(`Charged £${res.order.total.toFixed(2)} — wallet balance £${res.balance.toFixed(2)}.${extraMsg}`, 'success');
  renderServicesTab();
}

// ─────────────────────────────────────────────
//  SHOP & STOCK (selling devices/accessories — separate from the rental fleet)
// ─────────────────────────────────────────────

let shopItems = [];
let shopSales = [];

const STOCK_CATEGORY_LABELS = { phone: '📱 Phone', accessory: '🔌 Accessory', sim: '💳 SIM', other: '📦 Other' };

async function renderShopTab() {
  const content = document.getElementById('mainContent');
  content.innerHTML = `<div style="color:var(--muted);padding:30px;">Loading shop…</div>`;
  const data = await kcFetch('/api/shop').then(r => r.json()).catch(() => null);
  if (!data || !data.success) {
    content.innerHTML = `<div class="empty-state"><div class="emoji">🛍️</div><p>Shop unavailable${data?.error ? ' — ' + escHtml(data.error) : ''}.</p></div>`;
    return;
  }
  shopItems = data.items; shopSales = data.sales;

  const today = localISO();
  const active = shopItems.filter(i => i.active);
  const inStock = active.reduce((s, i) => s + i.quantity, 0);
  const low = active.filter(i => i.quantity <= i.lowStockAt);
  const todaySales = shopSales.filter(s => (s.createdAt || '').slice(0, 10) === today);
  const revenue = shopSales.reduce((s, x) => s + x.total, 0);

  const lowBanner = low.length ? `
    <div style="margin-bottom:14px;padding:10px 14px;border-radius:8px;background:rgba(234,34,97,0.07);border:1px solid rgba(234,34,97,0.25);font-size:13px;">
      ⚠️ <strong>Low stock:</strong> ${low.map(i => `${escHtml(i.model)} (${i.quantity} left)`).join(' · ')}
    </div>` : '';

  const itemRows = active.length === 0
    ? `<tr><td colspan="7"><div class="empty-state"><div class="emoji">🛍️</div><p>No stock yet — add your first item.</p></div></td></tr>`
    : active.map(i => `
      <tr style="${i.quantity <= i.lowStockAt ? 'background:rgba(234,34,97,0.04);' : ''}">
        <td><strong>${escHtml([i.company, i.model].filter(Boolean).join(' '))}</strong>
          <div class="customer-email">${escHtml(i.code || '')}</div></td>
        <td>${STOCK_CATEGORY_LABELS[i.category] || escHtml(i.category)}</td>
        <td style="color:var(--muted);">${i.netPrice === null ? '—' : '£' + i.netPrice.toFixed(2)}</td>
        <td><strong>£${(i.sellingPrice || 0).toFixed(2)}</strong></td>
        <td style="color:${i.profit === null ? 'var(--muted)' : i.profit >= 0 ? 'var(--success)' : 'var(--danger)'};">
          ${i.profit === null ? '—' : '£' + i.profit.toFixed(2)}</td>
        <td style="font-weight:700;${i.quantity <= i.lowStockAt ? 'color:var(--danger);' : ''}">${i.quantity}</td>
        <td style="white-space:nowrap;">
          <button class="action-btn" onclick="openSaleModal('${i.id}')">💷 Sell</button>
          <button class="action-btn" onclick="openStockItemModal('${i.id}')">✏️</button>
        </td>
      </tr>`).join('');

  const saleRows = shopSales.length === 0
    ? `<div style="color:var(--muted);font-size:13px;padding:8px 0;">No sales recorded yet.</div>`
    : shopSales.slice(0, 25).map(s => `
      <div class="history-item" style="background:transparent;border-bottom:1px solid var(--border);border-radius:0;padding:8px 2px;">
        <div style="flex:1;min-width:0;">
          <div class="history-desc"><strong>${escHtml(s.item)}</strong>${s.qty > 1 ? ` × ${s.qty}` : ''} — ${escHtml(s.customerName || 'Walk-in')}</div>
          <div style="font-size:11px;color:var(--muted);">${s.imei ? 'IMEI ' + escHtml(s.imei) + ' · ' : ''}${escHtml(s.notes || '')}</div>
        </div>
        <div class="history-date" style="margin:0 12px;">${fmtDate(s.createdAt)}</div>
        <div class="history-amount">£${s.total.toFixed(2)}</div>
      </div>`).join('');

  content.innerHTML = `
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">Units In Stock</div><div class="stat-value">${inStock}</div></div>
      <div class="stat-card"><div class="stat-label">Low Stock</div>
        <div class="stat-value" style="color:${low.length ? 'var(--danger)' : 'var(--success)'};">${low.length}</div></div>
      <div class="stat-card"><div class="stat-label">Sold Today</div>
        <div class="stat-value">£${todaySales.reduce((s, x) => s + x.total, 0).toFixed(2)}</div>
        <div class="stat-sub">${todaySales.length} sale${todaySales.length === 1 ? '' : 's'}</div></div>
      <div class="stat-card"><div class="stat-label">All-Time Sales</div><div class="stat-value">£${revenue.toFixed(2)}</div></div>
    </div>
    ${lowBanner}
    <div style="display:flex;gap:10px;margin-bottom:14px;">
      <button class="btn btn-primary" onclick="openSaleModal()">🧾 Open Till</button>
      <button class="btn btn-outline" onclick="openStockItemModal()">➕ Add Item</button>
    </div>
    <div class="dash-cols">
      <div class="table-card">
        <div class="section-divider" style="margin:12px 14px 4px;">Inventory</div>
        <table>
          <thead><tr><th>Item</th><th>Category</th><th>Cost</th><th>Price</th><th>Profit</th><th>Qty</th><th></th></tr></thead>
          <tbody>${itemRows}</tbody>
        </table>
      </div>
      <div class="table-card" style="padding:8px 18px 14px;">
        <div class="section-divider" style="margin-top:12px;">Recent sales</div>
        <div>${saleRows}</div>
      </div>
    </div>`;
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
        <input class="form-input" id="siModel" value="${escHtml(i?.model || '')}" placeholder="e.g. Powerbank 10000">
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
let posLastSale = null; // { total, change } — shown as a banner until the next action

function openSaleModal(preselectItemId = null) { // name kept: every Sell button calls it
  const sellable = shopItems.filter(i => i.active && i.quantity > 0);
  if (!sellable.length) { toast('Nothing in stock to sell — add quantities first.', 'warning'); return; }
  posBasket = preselectItemId ? [{ itemId: preselectItemId, qty: 1, imei: '' }] : [];
  posCat = 'all';
  posMethod = 'cash';
  posLastSale = null;
  renderPosView();
}

const POS_CAT_ICONS = { phone: '📱', accessory: '🔌', sim: '📶', other: '📦' };

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
    `<option value="${c.id}">${escHtml(c.firstName)} ${escHtml(c.lastName)}</option>`).join('');
  const cats = [...new Set(shopItems.filter(i => i.active && i.quantity > 0).map(i => i.category))];
  content.innerHTML = `
    <div class="pos-shell">
      <div class="pos-main">
        <div style="display:flex;gap:8px;align-items:center;">
          <button class="btn btn-outline" onclick="closePosView()" style="white-space:nowrap;">← Exit till</button>
          <input class="form-input pos-scan" id="posScan" placeholder="🔍 Scan a barcode, or type to search…"
            autocomplete="off" oninput="posRenderTiles()"
            onkeydown="if(event.key==='Enter'){event.preventDefault();posScanEnter();}">
        </div>
        <div class="pos-cats">
          <button class="pos-cat${posCat === 'all' ? ' on' : ''}" onclick="posSetCat('all')">All</button>
          ${cats.map(c => `<button class="pos-cat${posCat === c ? ' on' : ''}" onclick="posSetCat('${c}')">
            ${POS_CAT_ICONS[c] || ''} ${STOCK_CATEGORY_LABELS[c] || escHtml(c)}</button>`).join('')}
        </div>
        <div id="posTiles" class="pos-tiles pos-tiles-full"></div>
      </div>
      <div class="pos-side">
        <div class="pos-receipt-head">🧾 Current sale</div>
        <div id="posLastSale"></div>
        <div id="posBasket" class="pos-receipt"></div>
        <div class="pos-summary">
          <select class="form-input" id="posCustomer" style="width:100%;min-height:0;padding:8px 12px;margin-bottom:8px;">
            <option value="walkin">🚶 Walk-in</option>
            ${customerOptions}
          </select>
          <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;">
            <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;flex-shrink:0;">
              <input type="checkbox" id="posPaid" checked onchange="posRenderTender()"
                style="width:15px;height:15px;accent-color:var(--accent);"> Paid now</label>
            <div class="pos-methods" id="posMethods">${posMethodsHtml()}</div>
          </div>
          <div id="posTender"></div>
          <div class="pos-total-row"><span>TOTAL</span><strong id="posTotal">£0.00</strong></div>
          <button class="btn btn-primary pos-charge" onclick="saveSale()">💷 Charge</button>
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

// Cash tender: quick notes + change due, exactly like a shop till.
function posRenderTender() {
  const el = document.getElementById('posTender');
  if (!el) return;
  const paid = document.getElementById('posPaid')?.checked;
  if (!paid || posMethod !== 'cash') { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;flex-wrap:wrap;">
      <input class="form-input" id="posTenderIn" type="number" min="0" step="0.01" placeholder="Cash given £"
        oninput="posChangeCalc()" style="width:110px;min-height:0;padding:7px 10px;">
      ${[5, 10, 20, 50].map(n => `<button class="pos-note" onclick="posTenderQuick(${n})">£${n}</button>`).join('')}
      <span id="posChange" style="font-weight:700;font-size:14px;margin-left:auto;"></span>
    </div>`;
  posChangeCalc();
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
  const change = given - posTotalNow();
  out.style.color = change < 0 ? 'var(--danger)' : 'var(--success)';
  out.textContent = change < 0 ? `£${Math.abs(change).toFixed(2)} short` : `Change £${change.toFixed(2)}`;
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
        <span style="color:var(--muted);font-size:12px;">${i.quantity} left</span>
        <span class="pos-tile-price">£${(i.sellingPrice || 0).toFixed(2)}</span>
      </div>
    </div>`).join('') || '<div style="color:var(--muted);font-size:13px;padding:6px;">No matching items.</div>';
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
    ? '<div style="color:var(--muted);font-size:13px;padding:10px 2px;">Scan a barcode or tap an item to start.</div>'
    : posBasket.map(l => {
        const i = shopItems.find(x => x.id === l.itemId);
        if (!i) return '';
        const lineTotal = (i.sellingPrice || 0) * l.qty;
        total += lineTotal;
        return `
        <div class="pos-line">
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;">${escHtml([i.company, i.model].filter(Boolean).join(' '))}</div>
            <div style="font-size:11px;color:var(--muted);">£${(i.sellingPrice || 0).toFixed(2)} each</div>
            ${i.category === 'phone' ? `<input class="form-input" placeholder="IMEI (scan)" value="${escHtml(l.imei)}"
              oninput="posImei('${i.id}', this.value)" style="width:100%;min-height:0;padding:4px 8px;font-size:11px;margin-top:3px;">` : ''}
          </div>
          <button class="action-btn" style="padding:2px 9px;" onclick="posQty('${i.id}',-1)">−</button>
          <strong style="min-width:18px;text-align:center;">${l.qty}</strong>
          <button class="action-btn" style="padding:2px 9px;" onclick="posQty('${i.id}',1)">+</button>
          <strong style="min-width:58px;text-align:right;font-feature-settings:'tnum';">£${lineTotal.toFixed(2)}</strong>
          <button class="action-btn" style="padding:2px 8px;color:var(--danger);" title="Void line"
            onclick="posQty('${i.id}',-999)">✕</button>
        </div>`;
      }).join('');
  const totalEl = document.getElementById('posTotal');
  if (totalEl) totalEl.textContent = `£${total.toFixed(2)}`;
  posChangeCalc();
}

function posShowLastSale() {
  const el = document.getElementById('posLastSale');
  if (!el) return;
  if (!posLastSale) { el.innerHTML = ''; return; }
  const canEmail = !!posLastSale.customerId;
  el.innerHTML = `
    <div class="pos-done">
      ✅ £${posLastSale.total.toFixed(2)} taken${posLastSale.change !== null
        ? ` — <strong>change £${posLastSale.change.toFixed(2)}</strong>` : ''}
      ${canEmail ? `<button class="btn btn-secondary" style="margin-top:8px;width:100%;"
        onclick="emailSaleReceipt(this)" ${posLastSale.emailed ? 'disabled' : ''}>
        ${posLastSale.emailed ? '✉️ Receipt sent' : '✉️ Email receipt'}</button>` : ''}
    </div>`;
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

async function saveSale() {
  if (!posBasket.length) { toast('The basket is empty.', 'error'); return; }
  const paidNow = document.getElementById('posPaid').checked;
  const given = parseFloat(document.getElementById('posTenderIn')?.value);
  const totalBefore = posTotalNow();
  if (paidNow && posMethod === 'cash' && Number.isFinite(given) && given < totalBefore) {
    toast(`Cash given (£${given.toFixed(2)}) is less than the total.`, 'error');
    return;
  }
  const res = await kcFetch('/api/shop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      op: 'sale',
      lines: posBasket,
      customerId: document.getElementById('posCustomer').value,
      paidNow,
      method: posMethod,
    }),
  }).then(r => r.json()).catch(() => null);
  if (!res || !res.success) { toast(res?.error || 'Could not record the sale.', 'error'); return; }

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
    change: paidNow && posMethod === 'cash' && Number.isFinite(given) ? Math.max(0, given - res.total) : null,
    customerId: custId && custId !== 'walkin' ? custId : null,
    lines: receiptLines,
    method: posMethod,
    paidNow,
    emailed: false,
  };
  posBasket = [];
  toast(`Sold ${res.lines} item${res.lines === 1 ? '' : 's'} — £${res.total.toFixed(2)}.`, 'success');
  posRenderTiles();
  posRenderBasket();
  posRenderTender();
  posShowLastSale();
  const scan = document.getElementById('posScan');
  if (scan) { scan.value = ''; scan.focus(); }
}

// ─────────────────────────────────────────────
//  TASKS
// ─────────────────────────────────────────────
// Tables-native to-do list. Also displays the keyed auto-tasks the system
// raises (BALANCE-<id> arrears, passport expiry, overdue rentals).

let tasksList = [];

function taskPriorityBadge(p) {
  const styles = {
    High:   'background:rgba(239,68,68,0.15);color:var(--danger);',
    Normal: 'background:rgba(185,185,249,0.45);color:#4434d4;',
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
      new Notification('KosherConnect — reminder', { body: r.label, icon: '/logo.png' });
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
    <div style="font-size:13px;color:var(--muted);margin-bottom:14px;">${escHtml(ctx.label)}</div>
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:14px;flex-wrap:wrap;">
      <span style="font-size:12px;color:var(--muted);">Quick (pops up in-app):</span>
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
    body.innerHTML = `<div style="color:var(--danger);padding:6px 0;">${(wk && wk.error) || (mo && mo.error) || 'Could not load the summary.'}</div>`;
    return;
  }
  const col = (title, rep) => {
    const rows = groupRevenue(rep.byType).map(([label, amt]) =>
      `<div style="display:flex;justify-content:space-between;font-size:13px;padding:5px 0;border-bottom:1px solid var(--border);"><span>${label}</span><strong style="font-feature-settings:'tnum';">£${amt.toFixed(2)}</strong></div>`).join('')
      || '<div style="color:var(--muted);font-size:13px;padding:6px 0;">No charges yet.</div>';
    return `<div style="flex:1;min-width:220px;">
      <div style="font-weight:600;margin-bottom:8px;">${title}</div>
      ${rows}
      <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:700;padding-top:10px;"><span>Billed</span><span>£${rep.charged.toFixed(2)}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--success);padding-top:2px;"><span>Received</span><span>£${rep.received.toFixed(2)}</span></div>
      ${rep.refunded ? `<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);padding-top:2px;"><span>Refunded</span><span>−£${rep.refunded.toFixed(2)}</span></div>` : ''}
    </div>`;
  };
  body.style.color = 'var(--text)';
  body.style.padding = '0';
  body.innerHTML = `
    <div style="display:flex;gap:28px;flex-wrap:wrap;">${col('This week (7 days)', wk)}${col('This month', mo)}</div>
    <div style="font-size:11px;color:var(--muted);margin-top:14px;">“Billed” is revenue charged; “Received” is money actually taken in (payments + top-ups).</div>`;
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
  { icon: '🛒', label: 'Point of Sale (Till)', sub: 'tool', run: () => goToTab('shop') },
  { icon: '📇', label: 'Manage Phone Inventory', sub: 'tool', run: () => openOnTab('rentals', openManagePhonesModal) },
  { icon: '🧾', label: 'Cash-up (Z-report)', sub: 'tool', run: () => openCashupModal() },
  { icon: '⏰', label: 'New reminder', sub: 'tool', run: () => openRemindModal('note', '') },
  { icon: '🔑', label: 'Change my password', sub: 'tool', run: () => openChangePasswordModal() },
  // ── Find (saved-filter views) ──
  { icon: '⏰', label: 'Show overdue rentals', sub: 'view', run: () => filterView('rentals', () => { filterStatus = 'overdue'; filterPaid = 'all'; }, renderRentalRows) },
  { icon: '💷', label: 'Rentals with a balance owing', sub: 'view', run: () => filterView('rentals', () => { filterPaid = 'debt'; filterStatus = 'all'; }, renderRentalRows) },
  { icon: '💰', label: 'Who owes money (arrears)', sub: 'view', run: () => filterView('customers', () => { customerFilter = 'arrears'; }, renderTableRows) },
  { icon: '✈️', label: 'Customers flying soon', sub: 'view', run: () => filterView('customers', () => { customerFilter = 'flight'; }, renderTableRows) },
  { icon: '🛂', label: 'Customers with passport on file', sub: 'view', run: () => filterView('customers', () => { customerFilter = 'passport'; }, renderTableRows) },
  { icon: '📶', label: 'SIMs that renew this week', sub: 'view', run: () => filterView('sim', () => { simFilterStatus = 'week'; simFilterPay = 'all'; }, renderSimRows) },
  { icon: '🔧', label: 'Repairs waiting for collection', sub: 'view', run: () => filterView('repairs', () => { repairFilter = 'ready'; }) },
  { icon: '💳', label: 'Payment / top-up for open customer', sub: 'context', run: () => selectedId ? openWalletModal(selectedId) : toast('Open a customer first, then run this.', 'warning') },
  // ── Admin (hidden for helpers) ──
  { icon: '📊', label: 'Business summary (revenue)', sub: 'admin', admin: true, run: () => openBusinessSummary() },
  { icon: '⚙️', label: 'Run automations now', sub: 'admin', admin: true, run: () => runSweepsNow() },
  { icon: '📤', label: 'Export CSV', sub: 'admin', admin: true, run: async () => { const r = await window.api.exportCSV(); toast(r?.success ? 'CSV exported.' : (r?.error || 'Export failed.'), r?.success ? 'success' : 'error'); } },
  { icon: '✉️', label: 'Add email address', sub: 'admin', admin: true, run: () => openOnTab('settings', openEmailAliasModal) },
  { icon: '🤖', label: 'New automation rule', sub: 'admin', admin: true, run: () => openOnTab('settings', openAutomationModal) },
  // ── Navigate ──
  ...['dashboard', 'customers', 'rentals', 'sim', 'wallet', 'bookings', 'repairs', 'services', 'shop', 'virtual', 'tasks', 'settings']
    .map(t => ({ icon: '↪', label: `Go to ${t}`, sub: 'navigate', run: () => goToTab(t) })),
];

// Commands the current user may run — admin-only entries are hidden for helpers.
function visibleCommands() {
  const isAdmin = !currentStaff || currentStaff.role === 'owner';
  return PALETTE_COMMANDS.filter(c => !c.admin || isAdmin);
}

function paletteSearch(q) {
  const needle = q.trim().toLowerCase();
  const digits = needle.replace(/\D/g, '');
  const out = [];
  const commands = visibleCommands();
  if (!needle) return commands.slice(0, 9);

  for (const c of commands) {
    if (c.label.toLowerCase().includes(needle)) { out.push(c); if (out.length >= 6) break; }
  }
  for (const c of customers) {
    if (out.length >= 12) break;
    const name = `${c.firstName} ${c.lastName}`;
    if (name.toLowerCase().includes(needle) ||
        (digits.length >= 4 && (c.phone || '').replace(/\D/g, '').includes(digits)) ||
        (c.email || '').toLowerCase().includes(needle)) {
      out.push({ icon: '👤', label: name, sub: c.phone || c.email || 'customer',
        run: () => goToTab('customers', { customerId: c.id }) });
    }
  }
  for (const p of phones) {
    if (out.length >= 12) break;
    const hay = `${p.number || ''} ${p.imei || ''} ${p.simId || ''}`.replace(/\D/g, '');
    if ((p.number || '').toLowerCase().includes(needle) ||
        (digits.length >= 5 && hay.includes(digits))) {
      out.push({ icon: '📱', label: p.number || '(no number)',
        sub: `${p.country || ''} · ${p.status}${p.imei ? ' · IMEI ' + p.imei : ''}`,
        run: () => openEditPhoneModal(p.id) });
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
  return out.slice(0, 12);
}

function paletteRender() {
  const list = document.getElementById('paletteList');
  if (!list) return;
  list.innerHTML = paletteResults.length === 0
    ? `<div style="padding:14px;color:var(--muted);font-size:13px;">No matches.</div>`
    : paletteResults.map((r, i) => `
      <div class="palette-item${i === paletteIndex ? ' active' : ''}" onclick="paletteRun(${i})">
        <span style="width:22px;text-align:center;">${r.icon}</span>
        <span style="flex:1;">${escHtml(r.label)}</span>
        <span style="color:var(--muted);font-size:11px;">${escHtml(r.sub)}</span>
      </div>`).join('');
}

function paletteRun(i) {
  const r = paletteResults[i];
  closePalette();
  if (r) r.run();
}

function openPalette() {
  if (document.getElementById('paletteOverlay')) return;
  const el = document.createElement('div');
  el.id = 'paletteOverlay';
  el.className = 'palette-overlay';
  el.innerHTML = `
    <div class="palette-box">
      <input class="palette-input" id="paletteInput" placeholder="Search customers, phones, IMEI… or type a command"
        autocomplete="off" spellcheck="false">
      <div id="paletteList"></div>
      <div style="padding:7px 14px;border-top:1px solid var(--border);font-size:11px;color:var(--muted);">↑↓ navigate · Enter open · Esc close · scan a barcode straight in</div>
    </div>`;
  el.addEventListener('mousedown', e => { if (e.target === el) closePalette(); });
  document.body.appendChild(el);
  const input = document.getElementById('paletteInput');
  paletteIndex = 0;
  paletteResults = paletteSearch('');
  paletteRender();
  input.focus();
  input.addEventListener('input', () => {
    paletteIndex = 0;
    paletteResults = paletteSearch(input.value);
    paletteRender();
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); paletteIndex = Math.min(paletteIndex + 1, paletteResults.length - 1); paletteRender(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); paletteIndex = Math.max(paletteIndex - 1, 0); paletteRender(); }
    else if (e.key === 'Enter') { e.preventDefault(); paletteRun(paletteIndex); }
    else if (e.key === 'Escape') { closePalette(); }
  });
}

function closePalette() {
  document.getElementById('paletteOverlay')?.remove();
}

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openPalette();
  }
});

// ── Priority suggestion engine ───────────────────────────────────────────
// Deterministic scoring over what the task IS (its reference) and its due
// date — the assistant proposes, the user disposes. Returns null when there
// is nothing to say (no opinion, already at the suggested level, or the
// same suggestion was rejected before).
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
      ? { priority: 'High', reason: `£${amt.toFixed(2)} outstanding — chase before it grows.` }
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

async function snoozeTask(id, choice) {
  if (!choice) return;
  let until = null;
  const base = parseLocalDate(localISO());
  if (choice === 'tomorrow')  { base.setDate(base.getDate() + 1); until = localISO(base); }
  if (choice === '3days')     { base.setDate(base.getDate() + 3); until = localISO(base); }
  if (choice === 'nextweek')  { base.setDate(base.getDate() + 7); until = localISO(base); }
  if (choice === 'pick') {
    const d = prompt('Snooze until (YYYY-MM-DD):', localISO(new Date(Date.now() + 14 * 86400000)));
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
    until = d;
  }
  if (choice === 'wake') until = '';
  if (await patchTask({ id, snoozedUntil: until })) {
    toast(until ? `Snoozed until ${fmtDate(until)}.` : 'Task is back in the list.', 'success');
    renderTasksTab();
  }
}

async function renderTasksTab() {
  const content = document.getElementById('mainContent');
  content.innerHTML = `<div style="color:var(--muted);padding:30px;">Loading tasks…</div>`;
  tasksList = await window.api.getTasks();
  if (!Array.isArray(tasksList)) tasksList = [];

  const today = localISO();
  const doneTasks = tasksList.filter(t => t.done);
  const snoozed = tasksList.filter(t => taskSnoozed(t, today));
  const live = tasksList.filter(t => !t.done && !taskSnoozed(t, today));
  const nowLane  = live.filter(t => t.priority === 'High' || (t.dueDate && t.dueDate <= today));
  const nextLane = live.filter(t => !nowLane.includes(t));
  const suggestions = live.map(t => [t, suggestTaskPriority(t, today)]).filter(([, s]) => s);

  const card = (t) => {
    const s = suggestTaskPriority(t, today);
    const overdueDue = t.dueDate && t.dueDate < today;
    return `
    <div class="task-card${t.done ? ' task-done' : ''}">
      <div style="display:flex;align-items:flex-start;gap:10px;">
        <input type="checkbox" ${t.done ? 'checked' : ''} style="margin-top:3px;cursor:pointer;width:15px;height:15px;accent-color:var(--accent);"
          onchange="toggleTaskDone('${escHtml(t.id)}', this.checked)">
        <div style="flex:1;min-width:0;">
          <div class="history-desc" style="${t.done ? 'text-decoration:line-through;' : ''}">${escHtml(t.title)}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">
            ${t.customerName ? '👤 ' + escHtml(t.customerName) + ' · ' : ''}${t.source !== 'manual' ? '🤖 auto · ' : ''}${t.dueDate ? `<span style="${overdueDue && !t.done ? 'color:var(--danger);font-weight:600;' : ''}">due ${fmtDate(t.dueDate)}</span> · ` : ''}${t.notes ? escHtml(t.notes) : ''}
          </div>
        </div>
        ${taskPriorityBadge(t.priority)}
      </div>
      ${!t.done ? `
      <div class="task-actions">
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
        <span style="white-space:nowrap;">
          <button class="btn btn-primary btn-sm" style="font-size:11px;padding:3px 10px;"
            onclick="acceptSuggestion('${escHtml(t.id)}', '${s.priority}')">✓ Accept</button>
          <button class="btn btn-outline btn-sm" style="font-size:11px;padding:3px 10px;"
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
          <div style="font-size:11px;color:var(--muted);">wakes ${fmtDate(t.snoozedUntil)}</div>
        </div>
        <button class="btn btn-outline btn-sm" style="font-size:11px;padding:3px 10px;"
          onclick="snoozeTask('${escHtml(t.id)}', 'wake')">⏰ Wake now</button>
      </div>
    </div>`;

  const lane = (title, list, empty) => `
    <div class="table-card" style="padding:8px 16px 12px;">
      <div class="section-divider" style="margin-top:10px;">${title} <span style="color:var(--muted);font-weight:400;">· ${list.length}</span></div>
      ${list.length ? list.map(card).join('') : `<div style="color:var(--muted);font-size:13px;padding:8px 0;">${empty}</div>`}
    </div>`;

  content.innerHTML = `
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">🔥 Now</div><div class="stat-value" style="color:${nowLane.length ? 'var(--danger)' : 'var(--success)'};">${nowLane.length}</div></div>
      <div class="stat-card"><div class="stat-label">📋 Next</div><div class="stat-value">${nextLane.length}</div></div>
      <div class="stat-card"><div class="stat-label">💤 Snoozed</div><div class="stat-value">${snoozed.length}</div></div>
      <div class="stat-card"><div class="stat-label">💡 Suggestions</div><div class="stat-value" style="color:${suggestions.length ? 'var(--accent)' : 'var(--text)'};">${suggestions.length}</div>
        ${suggestions.length ? '<div class="stat-sub">awaiting your call</div>' : '<div class="stat-sub">all agreed</div>'}</div>
    </div>
    <div class="table-card" style="padding:14px;margin-bottom:14px;">
      <div style="display:flex;gap:8px;align-items:center;">
        <input class="form-input" id="tkTitle" placeholder="Add a task…" style="flex:1;"
          onkeydown="if(event.key==='Enter')saveNewTask()">
        <input class="form-input" type="date" id="tkDue" style="width:150px;">
        <select class="form-input" id="tkPriority" style="width:110px;">
          <option value="Normal">Normal</option>
          <option value="High">High</option>
          <option value="Low">Low</option>
        </select>
        <button class="btn btn-primary" onclick="saveNewTask()">+ Add</button>
      </div>
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
  renderTasksTab();
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
    filterCustomer = ''; filterStatus = 'all'; filterPaid = 'all';
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
let dashCache = { money: null, tasks: null };

async function renderDashboardTab() {
  dashPaint(dashCache.money, dashCache.tasks, dashCache.money === null);

  const today = localISO();
  const [ledgerSummary, tasksData] = await Promise.all([
    kcFetch('/api/ledger?since=' + today).then(r => r.ok ? r.json() : null).catch(() => null),
    window.api.getTasks().catch(() => []),
  ]);
  dashCache = {
    money: ledgerSummary?.success ? ledgerSummary : dashCache.money,
    tasks: Array.isArray(tasksData) ? tasksData : (dashCache.tasks || []),
  };
  if (currentTab === 'dashboard') dashPaint(dashCache.money, dashCache.tasks, false);
}

function dashPaint(money, tasksList2, stillLoading) {
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

  // ── Featured money card (dark navy) ──
  const heroHtml = `
    <div class="dash-hero">
      <div class="dash-hero-label">Money in today</div>
      <div class="dash-hero-value">${stillLoading ? '…' : '£' + (money ? money.todayIn.toFixed(2) : '0.00')}</div>
      <div class="dash-hero-sub">${money && money.todayOut ? '£' + Math.abs(money.todayOut).toFixed(2) + ' charged out today' : (stillLoading ? '&nbsp;' : 'no charges yet today')}</div>
      <div class="dash-hero-divider"></div>
      <div class="dash-hero-label">Outstanding</div>
      <div class="dash-hero-value" style="font-size:26px;letter-spacing:-0.26px;">${stillLoading ? '…' : '£' + arrearsTotal.toFixed(2)}</div>
      <div class="dash-hero-sub">${arrears.length ? arrears.length + ' customer' + (arrears.length === 1 ? '' : 's') + ' in arrears' : (stillLoading ? '&nbsp;' : 'nobody owes money 🎉')}</div>
      ${arrears.length ? `<div class="dash-hero-divider"></div>` +
        arrears.slice(0, 8).map(a => `
          <div class="dash-hero-row${a.customerId ? ' dash-link' : ''}"${a.customerId
            ? ` onclick="goToTab('customers',{customerId:'${escHtml(String(a.customerId))}'})" title="Open ${escHtml(a.customerName)}"` : ''}>
            <span>${escHtml(a.customerName)}${a.customerId ? '' : ' <span style="color:var(--muted);font-size:11px;">(walk-in)</span>'}</span>
            <span class="amt">£${Math.abs(a.balance).toFixed(2)}${a.customerId ? ' <span class="feed-go" style="opacity:1;">›</span>' : ''}</span>
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
        [overdue.length ? `<span style="color:var(--danger);">${overdue.length} overdue</span>` : '',
         dueToday.length ? `${dueToday.length} due today` : ''].filter(Boolean).join(' · ') || 'all on schedule', 'rentals')}
      ${metric('Open Repairs', openRepairs.length,
        readyRepairs.length ? `<span style="color:var(--accent);">${readyRepairs.length} ready to collect</span>` : 'nothing waiting', 'repairs')}
      ${metric('Flights · Next 7 Days', travel7.length,
        `${travel7.length === 1 ? '1 flight' : travel7.length + ' flights'} this week${renewals7.length
          ? ` · <span class="dash-link" style="color:var(--gold);" onclick="event.stopPropagation();goToTab('sim')">${renewals7.length} SIM renewal${renewals7.length === 1 ? '' : 's'} ›</span>` : ''}`,
        'bookings')}
      ${metric('Open Tasks', openTasks.length,
        highTasks.length ? `<span style="color:var(--danger);">${highTasks.length} high priority</span>` : 'none urgent', 'tasks',
        highTasks.length ? 'color:var(--danger);' : '')}
    </div>`;

  // ── Needs-attention feed — each line deep-links to its problem page.
  // Handlers live in dashFeedActions (closures), not inline strings, so
  // customer names with quotes can't break the HTML.
  const attention = [];
  overdue.forEach(r => attention.push(['📱',
    `<strong>${escHtml(r.customerName || '?')}</strong> — rental overdue since ${fmtDate(r.toDate)}`,
    () => goToTab('rentals', { rentalSearch: r.customerName || '' })]));
  readyRepairs.forEach(r => attention.push(['🔧',
    `<strong>${escHtml(r.customerName || '?')}</strong> — repair ready to collect (£${(r.total || 0).toFixed(2)})`,
    () => goToTab('repairs')]));
  travel7.forEach(b => attention.push(['✈️',
    `<strong>${escHtml(b.customerName || '?')}</strong> — flies ${fmtDate(b.travelDate)} (${escHtml(b.route)})`,
    () => goToTab('bookings')]));
  renewals7.forEach(s => attention.push(['💳',
    `<strong>${escHtml(s.customerName || '?')}</strong> — SIM renews ${fmtDate(s.renewalDate)}`,
    () => goToTab('sim')]));
  highTasks.slice(0, 5).forEach(t => attention.push(['❗', escHtml(t.title), () => goToTab('tasks')]));

  const shown = attention.slice(0, 10);
  dashFeedActions = shown.map(a => a[2]);
  const attentionHtml = shown.length === 0
    ? `<div style="color:var(--muted);font-size:13px;padding:8px 0;">All clear. 🎉</div>`
    : shown.map(([icon, html], i) => `
        <div class="feed-item dash-link" onclick="dashFeedActions[${i}]()" title="Open">
          <span class="feed-icon">${icon}</span><span>${html}</span>
          <span class="feed-go">›</span>
        </div>`).join('');

  // Each row deep-links to its customer (same as the wallet tab's feed).
  const activityHtml = !money || money.recent.length === 0
    ? `<div style="color:var(--muted);font-size:13px;padding:8px 0;">No wallet activity yet.</div>`
    : money.recent.slice(0, 8).map(e => `
        <div class="history-item${e.customerId ? ' dash-link' : ''}"
          style="background:transparent;border-bottom:1px solid var(--border);border-radius:0;padding:9px 2px;"
          ${e.customerId ? `onclick="goToTab('customers',{customerId:'${escHtml(String(e.customerId))}'})" title="Open customer"` : ''}>
          <div style="display:flex;align-items:center;flex:1;min-width:0;">
            <div class="history-dot ${e.amount >= 0 ? 'dot-green' : 'dot-blue'}"></div>
            <div class="history-desc" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              ${escHtml(e.customerName || '—')} · ${LEDGER_TYPE_LABELS[e.type] || escHtml(e.type)}${e.description ? ' · ' + escHtml(e.description) : ''}</div>
          </div>
          <div class="history-date" style="margin:0 12px;">${fmtDate(e.at)}</div>
          <div class="history-amount" style="color:${e.amount >= 0 ? 'var(--success)' : 'var(--text)'};">
            ${e.amount >= 0 ? '+' : '−'}£${Math.abs(e.amount).toFixed(2)}</div>
          ${e.customerId ? '<span class="feed-go">›</span>' : ''}
        </div>`).join('') + `
        <div class="feed-item dash-link" onclick="goToTab('wallet')" style="color:var(--muted);font-size:12px;">
          <span style="flex:1;">Full ledger &amp; today's money</span><span class="feed-go">›</span>
        </div>`;

  content.innerHTML = `
    <div class="dash-head">
      <div>
        <div class="dash-date">${enDate}${hebDate ? ` &nbsp;·&nbsp; <span class="heb">${hebDate}</span>` : ''}</div>
        <div class="dash-greeting">${greeting}${staffFirstName ? ', ' + nameHtml(staffFirstName) : ''}.</div>
      </div>
      <div class="dash-actions">
        <button class="btn btn-outline" onclick="renderDashboardTab()" title="Reload today's money & tasks">↻ Refresh</button>
        ${(!currentStaff || currentStaff.role === 'owner') ? `<button class="btn btn-outline" onclick="openBusinessSummary()" title="Revenue by service — this week & month">📊 Summary</button>` : ''}
        <button class="btn btn-outline" onclick="openNewRentalModal()">📱 New Rental</button>
        <button class="btn btn-outline" onclick="openNewBookingModal()">✈️ New Booking</button>
        <button class="btn btn-outline" onclick="(async()=>{repairMenu=await window.api.getServiceMenu('repair');openNewRepairModal()})()">🔧 New Repair</button>
        <button class="btn btn-outline" onclick="document.querySelector('[data-tab=customers]').click();setTimeout(()=>document.getElementById('btnNewCustomer')?.click(),100)">👤 New Customer</button>
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
  content.innerHTML = `<div style="color:var(--muted);padding:30px;">Loading virtual numbers…</div>`;
  [virtualNumbers, vnPriceMatrix] = await Promise.all([
    window.api.getVirtualNumbers(),
    kcFetch('/api/vn-prices').then(r => r.ok ? r.json() : []).catch(() => []),
  ]);
  if (!Array.isArray(virtualNumbers)) virtualNumbers = [];
  if (!Array.isArray(vnPriceMatrix)) vnPriceMatrix = [];

  const active = virtualNumbers.filter(v => v.status === 'Active');
  const rows = virtualNumbers.length === 0
    ? `<tr><td colspan="7"><div class="empty-state"><div class="emoji">🔢</div><p>No virtual numbers yet.</p></div></td></tr>`
    : virtualNumbers.map(v => `
      <tr>
        <td><strong>${escHtml(v.number)}</strong></td>
        <td>${escHtml(v.customerName || '—')}</td>
        <td>${escHtml(v.platform || '—')}</td>
        <td>${v.billingEnabled && v.monthlyPrice
          ? `<strong>£${v.monthlyPrice.toFixed(2)}</strong><div class="customer-email">next ${fmtDate(v.nextBillingDate) || '—'}</div>`
          : '<span style="color:var(--muted);">—</span>'}</td>
        <td><span class="badge" style="${v.status === 'Active'
          ? 'background:rgba(34,197,94,0.15);color:var(--success);'
          : 'background:rgba(148,163,184,0.15);color:var(--muted);'}">${escHtml(v.status)}</span></td>
        <td>${v.shortcutUrl ? `<a href="${escHtml(v.shortcutUrl)}" target="_blank" rel="noopener" style="color:var(--accent);font-size:12px;">open ↗</a>` : '—'}</td>
        <td style="white-space:nowrap;">
          <button class="action-btn" style="font-size:11px;padding:4px 10px;"
            onclick="openRemindModal('vn','${escHtml(v.id)}')" title="Remind me">⏰</button>
          <button class="action-btn" style="font-size:11px;padding:4px 10px;"
            onclick="openVNBillingModal('${escHtml(v.id)}')">💷 Billing</button>
          <button class="action-btn" style="font-size:11px;padding:4px 10px;"
            onclick="toggleVNStatus('${escHtml(v.id)}', '${v.status === 'Active' ? 'Inactive' : 'Active'}')">
            ${v.status === 'Active' ? '⏸ Deactivate' : '▶ Activate'}</button>
          <button class="action-btn danger" style="font-size:11px;padding:4px 10px;"
            onclick="deleteVN('${escHtml(v.id)}', '${escHtml(v.number)}')">✕</button>
        </td>
      </tr>`).join('');

  content.innerHTML = `
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">Total Numbers</div><div class="stat-value">${virtualNumbers.length}</div></div>
      <div class="stat-card"><div class="stat-label">Active</div><div class="stat-value" style="color:var(--success);">${active.length}</div></div>
    </div>
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px;">
      <button class="btn btn-primary" onclick="openNewVNModal()">+ New Virtual Number</button>
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
            <td>${p.incomingOnly === null ? '—' : '£' + p.incomingOnly.toFixed(2)}</td>
            <td>${p.outgoing100 === null ? '—' : '£' + p.outgoing100.toFixed(2)}</td>
            <td>${p.unlimited === null ? '—' : '£' + p.unlimited.toFixed(2)}</td>
            <td>${p.paygBase === null ? '—' : '£' + p.paygBase.toFixed(2) + ' + rates'}</td>
          </tr>`).join('')}</tbody>
      </table>
    </div>` : ''}`;
}

function openNewVNModal(preselectCustomerId) {
  const customerOptions = customers.map(c =>
    `<option value="${c.id}" ${preselectCustomerId === c.id ? 'selected' : ''}>${escHtml(c.firstName)} ${escHtml(c.lastName)}</option>`
  ).join('');
  showDynamicModal(`
    <div class="modal-title">🔢 New Virtual Number</div>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Number *</label>
        <input class="form-input" id="vnNumber" placeholder="+1 732 555 0123">
      </div>
      <div class="form-group">
        <label class="form-label">Customer</label>
        <select class="form-input" id="vnCustomer">
          <option value="">— unassigned —</option>${customerOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Platform</label>
        <select class="form-input" id="vnPlatform">
          <option value="elid">elid</option>
          <option value="FreePBX">FreePBX</option>
          <option value="Other">Other</option>
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
    <div class="modal-title">💷 Monthly Billing — ${escHtml(v.number)}</div>
    <div style="color:var(--muted);font-size:13px;margin-bottom:14px;">
      ${v.customerName ? `Customer: <strong style="color:var(--text);">${escHtml(v.customerName)}</strong>` :
        '<span style="color:var(--danger);">⚠ No customer assigned — billing needs one.</span>'}
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
          style="width:16px;height:16px;accent-color:var(--accent);cursor:pointer;">
        <label for="vbEnabled" style="font-size:13px;cursor:pointer;">Billing enabled — the daily sweep posts one wallet charge per month</label>
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
    body: `<strong>${vnRec?.customerName ? escHtml(vnRec.customerName) : 'Customer'}</strong><br>
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
  content.innerHTML = `<div style="color:var(--muted);padding:30px;">Loading settings…</div>`;
  const [cfg, team, autos, aliases, menu, extra] = await Promise.all([
    window.api.getSettings(),
    kcFetch('/api/team').then(r => r.status === 403 ? null : r.json()).catch(() => null),
    kcFetch('/api/automations').then(r => r.status === 403 ? null : r.json()).catch(() => null),
    kcFetch('/api/email-aliases').then(r => r.status === 403 ? null : r.json()).catch(() => null),
    kcFetch('/api/services?all=1').then(r => r.ok ? r.json() : null).catch(() => null),
    kcFetch('/api/custom-charges').then(r => r.ok ? r.json() : null).catch(() => null),
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
            <td><span class="customer-name">${escHtml(m.fullName || '—')}</span>${m.isYou ? ' <span class="badge badge-rental">you</span>' : ''}</td>
            <td>${escHtml(m.email || '—')}</td>
            <td>
              <select class="form-input" style="width:110px;padding:5px 8px;font-size:13px;min-height:0;"
                onchange="changeTeamRole('${escHtml(m.id)}', this.value)" ${m.isYou ? 'disabled' : ''}>
                <option value="owner" ${m.role === 'owner' ? 'selected' : ''}>Admin</option>
                <option value="helper" ${m.role === 'helper' ? 'selected' : ''}>Helper</option>
              </select>
            </td>
            <td style="white-space:nowrap;">
              <button class="action-btn" style="font-size:11px;"
                onclick="openResetPasswordModal('${escHtml(m.id)}', '${escHtml(m.fullName || m.email)}')">🔑 Reset password</button>
              <button class="action-btn danger" style="font-size:11px;"
                onclick="removeTeamMember('${escHtml(m.id)}', '${escHtml(m.fullName || m.email)}', ${m.isYou})">✕ Remove${m.isYou ? ' (you)' : ''}</button></td>
          </tr>`).join('')}
        <tr>
          <td><input class="form-input" id="tmName" placeholder="Full name" style="min-height:0;padding:6px 10px;font-size:13px;"></td>
          <td style="white-space:nowrap;">
            <input class="form-input" id="tmEmail" type="email" placeholder="Email" style="min-height:0;padding:6px 10px;font-size:13px;width:46%;display:inline-block;">
            <input class="form-input" id="tmPassword" type="password" placeholder="Password (8+)" style="min-height:0;padding:6px 10px;font-size:13px;width:46%;display:inline-block;">
          </td>
          <td>
            <select class="form-input" id="tmRole" style="width:110px;padding:5px 8px;font-size:13px;min-height:0;">
              <option value="helper">Helper</option>
              <option value="owner">Admin</option>
            </select>
          </td>
          <td><button class="btn btn-primary btn-sm" onclick="saveNewTeamMember()">+ Add</button></td>
        </tr>
      </tbody></table>
      <div class="section-divider" style="margin:14px 14px 4px;">🔓 What helpers can see</div>
      <div style="padding:4px 14px 14px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
        ${['dashboard', 'customers', 'rentals', 'sim', 'wallet', 'bookings', 'repairs', 'services', 'shop', 'virtual', 'tasks', 'settings'].map(t => `
          <label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer;">
            <input type="checkbox" class="htTab" value="${t}" style="accent-color:var(--accent);cursor:pointer;"
              ${(cfg.settings.find(s => s.key === 'helper_tabs')?.textValue || '').split(',').includes(t) ? 'checked' : ''}>
            ${t}</label>`).join('')}
        <button class="btn btn-outline btn-sm" style="font-size:11px;" onclick="saveHelperTabs()">💾 Save access</button>
        <span style="font-size:11px;color:var(--muted);">Wallet, shop &amp; settings are also blocked server-side when unticked.</span>
      </div>`) : '';

  // ── Automations card (owner-only) — custom "when X, do Y" rules ──
  autoTriggers = autos?.triggers || autoTriggers;
  autoRulesCache = autos?.rules || [];
  const automationsHtml = autos?.success ? settingsCard('automations', '🤖 Automations',
    `${autos.rules.length} rule${autos.rules.length === 1 ? '' : 's'} — run in the daily sweep`, `
      <table><thead><tr><th>Rule</th><th>When</th><th>Raises</th><th>On</th><th></th></tr></thead>
      <tbody>
        ${autos.rules.length === 0 ? `<tr><td colspan="5" style="color:var(--muted);font-size:13px;padding:12px 16px;">No custom rules yet. The built-in sweeps (overdue, arrears, flights, passports, SIM renewals, VN billing) always run.</td></tr>` : ''}
        ${autos.rules.map(r => `
          <tr style="${r.enabled ? '' : 'opacity:0.5;'}">
            <td><strong>${escHtml(r.name)}</strong></td>
            <td style="font-size:12px;">${escHtml((autoTriggers[r.trigger]?.label || r.trigger).replace('N', r.threshold))}</td>
            <td style="font-size:12px;">📋 task <span class="badge badge-${r.priority === 'high' ? 'rental' : 'sim'}" style="font-size:10px;">${escHtml(r.priority)}</span></td>
            <td><label style="font-size:12px;cursor:pointer;"><input type="checkbox" ${r.enabled ? 'checked' : ''} onchange="toggleAutomation('${escHtml(r.id)}', this.checked)" style="accent-color:var(--accent);"> on</label></td>
            <td style="white-space:nowrap;">
              <button class="action-btn" onclick="openAutomationModal('${escHtml(r.id)}')">✏️</button>
              <button class="action-btn danger" onclick="deleteAutomation('${escHtml(r.id)}')">✕</button>
            </td>
          </tr>`).join('')}
      </tbody></table>
      <div style="padding:8px 14px 14px;">
        <button class="btn btn-outline btn-sm" onclick="openAutomationModal()">+ New automation rule</button>
        <span style="font-size:11px;color:var(--muted);margin-left:8px;">e.g. "owes £100+ → urgent task", "flight in 7 days → task".</span>
      </div>`) : '';

  // ── Email addresses card (owner-only) — Forward Email aliases ──
  const aliasesHtml = aliases === null ? '' : (aliases.success ? settingsCard('emails', '📧 Email addresses',
    `${aliases.aliases.length} @${escHtml(aliases.domain)} via Forward Email`, `
      <table><thead><tr><th>Address</th><th>Forwards to</th><th>Purpose</th><th>On</th><th></th></tr></thead>
      <tbody>
        ${aliases.aliases.length === 0 ? `<tr><td colspan="5" style="color:var(--muted);font-size:13px;padding:12px 16px;">No addresses yet — add the first one below (e.g. reminder@, admin@, receipts@).</td></tr>` : ''}
        ${aliases.aliases.map(a => `
          <tr style="${a.enabled ? '' : 'opacity:0.5;'}">
            <td><strong>${escHtml(a.address)}</strong></td>
            <td style="font-size:12px;">${a.recipients.map(escHtml).join('<br>') || '—'}</td>
            <td style="font-size:12px;color:var(--muted);">${escHtml(a.description || '—')}</td>
            <td><label style="font-size:12px;cursor:pointer;"><input type="checkbox" ${a.enabled ? 'checked' : ''}
              onchange="toggleEmailAlias('${escHtml(a.id)}', this.checked)" style="accent-color:var(--accent);"> on</label></td>
            <td style="white-space:nowrap;">
              <button class="action-btn" title="Edit forwarding / purpose" onclick="openEmailAliasModal('${escHtml(a.id)}')">✏️</button>
              <button class="action-btn" title="Generate SMTP password (for sending as this address)"
                onclick="generateAliasPassword('${escHtml(a.id)}', '${escHtml(a.address)}')">🔑</button>
              <button class="action-btn danger" onclick="deleteEmailAlias('${escHtml(a.id)}', '${escHtml(a.address)}')">✕</button>
            </td>
          </tr>`).join('')}
      </tbody></table>
      <div style="padding:8px 14px 14px;">
        <button class="btn btn-outline btn-sm" onclick="openEmailAliasModal()">+ New address</button>
        <span style="font-size:11px;color:var(--muted);margin-left:8px;">🔑 makes an SMTP password so the app (or Gmail send-as) can send from that address.</span>
      </div>`) : settingsCard('emails', '📧 Email addresses', 'not connected yet',
    `<div style="padding:8px 16px 14px;font-size:13px;color:var(--muted);">${escHtml(aliases.error || 'Unavailable.')}</div>`));

  const num = (id, val, step = '0.01') =>
    `<input class="form-input" type="number" step="${step}" id="${id}" value="${val}" style="width:90px;padding:6px 8px;font-size:13px;">`;

  const rateRows = cfg.rentalRates.map(r => `
    <tr>
      <td><strong>${escHtml(r.displayName)}</strong><div class="customer-email">${escHtml(r.countryCode)}</div></td>
      <td>${num(`rr_rate_${r.countryCode}`, r.ratePerDay)}</td>
      <td>${num(`rr_min_${r.countryCode}`, r.minCharge)}</td>
      <td>${num(`rr_cap_${r.countryCode}`, r.cap)}</td>
      <td>${num(`rr_period_${r.countryCode}`, r.capPeriodDays, '1')}</td>
      <td>${num(`rr_vnw_${r.countryCode}`, r.vnWeekly ?? '')}</td>
      <td>${num(`rr_vnm_${r.countryCode}`, r.vnPer30Days ?? '')}</td>
      <td style="white-space:nowrap;"><button class="btn btn-outline" style="font-size:12px;padding:5px 12px;"
        onclick="saveRentalRate('${escHtml(r.countryCode)}')">💾</button>
        <button class="action-btn danger" style="font-size:11px;" title="Remove country"
        onclick="deleteRateRow('rental_rates','${escHtml(r.countryCode)}')">✕</button></td>
    </tr>`).join('') + `
    <tr style="background:var(--bg-secondary);">
      <td><div style="font-size:10px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:0.3px;margin-bottom:4px;">➕ Add a country</div>
        <input class="form-input" id="rrNew_code" placeholder="FR" style="width:70px;padding:5px 7px;font-size:12px;min-height:0;text-transform:uppercase;">
        <input class="form-input" id="rrNew_name" placeholder="France" style="width:100px;padding:5px 7px;font-size:12px;min-height:0;margin-top:3px;"></td>
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
      <td style="white-space:nowrap;"><button class="btn btn-outline" style="font-size:12px;padding:5px 12px;"
        onclick="saveDamageRate('${escHtml(d.countryCode)}')">💾</button>
        <button class="action-btn danger" style="font-size:11px;" title="Remove country"
        onclick="deleteRateRow('damage_rates','${escHtml(d.countryCode)}')">✕</button></td>
    </tr>`).join('') + `
    <tr style="background:var(--bg-secondary);">
      <td><div style="font-size:10px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:0.3px;margin-bottom:4px;">➕ Add a country</div>
        <input class="form-input" id="drNew_code" placeholder="FR" style="width:70px;padding:5px 7px;font-size:12px;min-height:0;text-transform:uppercase;"></td>
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
    collect_later_late_pct:    { group: '📱 Rentals', label: '"Pay later" surcharge', help: 'Extra added when a customer takes the phone but pays afterwards.', unit: '% extra' },
    collect_later_late_min:    { group: '📱 Rentals', label: '"Pay later" minimum', help: 'The smallest "pay later" surcharge, even on cheap rentals.', unit: '£ minimum' },
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
  };
  const editable = cfg.settings.filter(s => s.numValue !== null && s.editable && !s.custom);
  const feeGroups = {};
  editable.forEach(s => {
    const m = FEE_META[s.key] || { group: '⚙️ Other', label: s.description || s.key, help: '', unit: s.unit };
    (feeGroups[m.group] = feeGroups[m.group] || []).push({ s, m });
  });
  const feeRow = ({ s, m }) => `
    <tr>
      <td style="max-width:340px;"><strong>${escHtml(m.label)}</strong>${m.help ? `<div style="color:var(--muted);font-size:11px;line-height:1.4;margin-top:2px;">${escHtml(m.help)}</div>` : ''}</td>
      <td style="white-space:nowrap;">${num(`st_${s.key}`, s.numValue)} <span style="color:var(--muted);font-size:11px;">${escHtml(m.unit || '')}</span></td>
      <td><button class="btn btn-outline" style="font-size:12px;padding:5px 12px;" onclick="saveSettingKey('${escHtml(s.key)}')">💾 Save</button></td>
    </tr>`;
  const settingRows = Object.entries(feeGroups).map(([group, items]) =>
    `<tr><td colspan="3" style="background:var(--bg-secondary);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;color:var(--muted);padding:6px 16px;">${group}</td></tr>` +
    items.map(feeRow).join('')).join('');

  emailAliasCache = aliases?.success ? aliases.aliases : [];

  // ── Service price menu card (admin-editable price list) ──
  menuItemsCache = menu?.success ? menu.items : [];
  const isAdmin = !currentStaff || currentStaff.role === 'owner';
  const catLabel = { repair: '🔧 Repairs', online: '🖨️ Online & print', tickets: '✈️ Tickets',
    phone: '📱 Phones', sim: '💳 SIM', other: '📦 Other' };
  const menuNum = (id, val) =>
    `<input class="form-input" type="number" step="0.01" id="${id}" value="${val ?? ''}" placeholder="—" style="width:76px;padding:5px 7px;font-size:12px;min-height:0;">`;
  const menuHtml = !isAdmin || !menu?.success ? '' : settingsCard('pricemenu', '🧾 Service price menu',
    `${menuItemsCache.length} services — what the charging screens offer`, `
      <div class="table-wrap"><table><thead><tr><th>Service</th><th>Price</th><th>KC price</th><th>Repeat</th><th>Bulk (tickets 6th+)</th><th>On</th><th></th></tr></thead>
      <tbody>
        ${['repair','online','tickets','phone','sim','other'].map(cat => {
          const items = menuItemsCache.filter(m => m.category === cat);
          if (!items.length) return '';
          return `<tr><td colspan="7" style="background:var(--bg-secondary);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;color:var(--muted);padding:6px 16px;">${catLabel[cat] || cat}</td></tr>` +
            items.map(m => `
            <tr style="${m.active ? '' : 'opacity:0.45;'}">
              <td><input class="form-input" id="mi_name_${m.id}" value="${escHtml(m.name)}" style="min-height:0;padding:5px 8px;font-size:12px;min-width:170px;"></td>
              <td>${menuNum(`mi_price_${m.id}`, m.price)}</td>
              <td>${menuNum(`mi_kc_${m.id}`, m.kcPrice)}</td>
              <td>${menuNum(`mi_rep_${m.id}`, m.repeatPrice)}</td>
              <td>${menuNum(`mi_bulk_${m.id}`, m.bulkPrice)}</td>
              <td><input type="checkbox" id="mi_active_${m.id}" ${m.active ? 'checked' : ''} style="accent-color:var(--accent);cursor:pointer;"></td>
              <td><button class="btn btn-outline" style="font-size:12px;padding:5px 12px;" onclick="saveMenuItem('${escHtml(String(m.id))}')">💾 Save</button></td>
            </tr>`).join('');
        }).join('')}
        <tr style="background:var(--bg-secondary);">
          <td><div style="font-size:10px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:0.3px;margin-bottom:4px;">➕ Add a service</div>
            <input class="form-input" id="miNewName" placeholder="New service name" style="min-height:0;padding:5px 8px;font-size:12px;min-width:170px;"></td>
          <td>${menuNum('miNewPrice', '')}</td>
          <td colspan="3">
            <select class="form-input" id="miNewCat" style="min-height:0;padding:5px 8px;font-size:12px;width:130px;">
              ${Object.entries(catLabel).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}
            </select>
          </td>
          <td></td>
          <td><button class="btn btn-primary btn-sm" onclick="addMenuItem()">+ Add</button></td>
        </tr>
      </tbody></table></div>
      <div style="padding:6px 14px 12px;font-size:11px;color:var(--muted);">Prices apply to new charges only. Untick "On" to retire a service — old charges keep their label.</div>`);

  // ── Extra charges card (owner-defined fees the engine applies for you) ──
  extraChargeCache = extra?.success ? extra.charges : [];
  const TARGET_LABEL = { booking: '✈️ Every flight booking', service: '🖨️ Every online/print service',
    sim: '💳 Every SIM setup', repair: '🔧 Every repair', rental: '📱 Every rental', any: '⭐ All of the above' };
  const extraHtml = !isAdmin || !extra?.success ? '' : settingsCard('extras', '➕ Extra charges',
    `${extraChargeCache.length} auto-applied — the app bills these for you`, `
      <div style="padding:8px 16px 4px;font-size:12px;color:var(--muted);line-height:1.5;">
        Define a fee once and the app adds it <strong>automatically</strong> every time you make that kind of charge —
        e.g. a £5 handling fee on every flight booking. "Automatic" always applies; "optional" you tick per charge.
        Wired for flight bookings, online/print services, SIM setups, repairs and rentals.</div>
      <div class="table-wrap"><table><thead><tr><th>Charge name</th><th>Amount</th><th>Added to</th><th>How</th><th>On</th><th></th></tr></thead>
      <tbody>
        ${extraChargeCache.length === 0 ? `<tr><td colspan="6" style="color:var(--muted);font-size:13px;padding:12px 16px;">None yet. Add one below — e.g. "Handling fee £5 → every flight booking → automatic".</td></tr>` : ''}
        ${extraChargeCache.map(c => `
          <tr style="${c.active ? '' : 'opacity:0.5;'}">
            <td><input class="form-input" id="ec_label_${c.id}" value="${escHtml(c.label)}" style="min-height:0;padding:5px 8px;font-size:12px;min-width:150px;"></td>
            <td>${num(`ec_amount_${c.id}`, c.amount)}</td>
            <td><select class="form-input" id="ec_target_${c.id}" style="min-height:0;padding:5px 8px;font-size:12px;">
              ${Object.entries(TARGET_LABEL).map(([k, l]) => `<option value="${k}" ${c.appliesTo === k ? 'selected' : ''}>${l}</option>`).join('')}
            </select></td>
            <td><select class="form-input" id="ec_mode_${c.id}" style="min-height:0;padding:5px 8px;font-size:12px;width:110px;">
              <option value="auto" ${c.mode === 'auto' ? 'selected' : ''}>Automatic</option>
              <option value="optional" ${c.mode === 'optional' ? 'selected' : ''}>Optional</option>
            </select></td>
            <td><input type="checkbox" id="ec_active_${c.id}" ${c.active ? 'checked' : ''} style="accent-color:var(--accent);cursor:pointer;"></td>
            <td style="white-space:nowrap;">
              <button class="btn btn-outline" style="font-size:12px;padding:5px 10px;" onclick="saveExtraCharge('${escHtml(c.id)}')">💾</button>
              <button class="action-btn danger" style="font-size:11px;" onclick="deleteExtraCharge('${escHtml(c.id)}')">✕</button>
            </td>
          </tr>`).join('')}
        <tr style="background:var(--bg-secondary);">
          <td><div style="font-size:10px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:0.3px;margin-bottom:4px;">➕ Add a charge</div>
            <input class="form-input" id="ecNew_label" placeholder="e.g. Handling fee" style="min-height:0;padding:5px 8px;font-size:12px;min-width:150px;"></td>
          <td>${num('ecNew_amount', '')}</td>
          <td><select class="form-input" id="ecNew_target" style="min-height:0;padding:5px 8px;font-size:12px;">
            ${Object.entries(TARGET_LABEL).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}
          </select></td>
          <td><select class="form-input" id="ecNew_mode" style="min-height:0;padding:5px 8px;font-size:12px;width:110px;">
            <option value="auto">Automatic</option><option value="optional">Optional</option>
          </select></td>
          <td></td>
          <td><button class="btn btn-primary btn-sm" onclick="addExtraCharge()">+ Add</button></td>
        </tr>
      </tbody></table></div>`);

  const sectionHead = (t, sub) => `
    <div style="margin:22px 2px 10px;display:flex;align-items:baseline;gap:10px;">
      <h3 style="font-size:15px;font-weight:700;letter-spacing:-0.2px;margin:0;">${t}</h3>
      ${sub ? `<span style="color:var(--muted);font-size:12px;">${sub}</span>` : ''}
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

  content.innerHTML = `
    <div style="margin-bottom:8px;padding:10px 14px;border-radius:8px;background:var(--bg-secondary);font-size:12px;color:var(--muted);display:flex;align-items:center;gap:12px;">
      <span style="flex:1;">Everything that runs the business — people, prices, messages and automation — lives here. Price edits apply to <strong>new</strong> charges only; existing tickets never reprice.</span>
      <button class="btn btn-outline btn-sm" onclick="openChangePasswordModal()" title="Change your own login password">🔑 My password</button>
      <button class="btn btn-outline btn-sm" onclick="runSweepsNow()" title="Overdue rentals, arrears, passport expiry, SIM renewals">⏰ Run sweeps now</button>
    </div>

    ${team?.success ? sectionHead('👥 People &amp; access', 'who works here and what they can see') + teamHtml : ''}

    ${sectionHead('💷 Prices &amp; charges', 'what you charge and any automatic extras')}
    ${pricingCards}

    ${aliasesHtml ? sectionHead('📧 Communications', 'email addresses for the business') + aliasesHtml : ''}

    ${automationsHtml ? sectionHead('🤖 Automation', 'jobs the daily sweep runs for you') + automationsHtml : ''}`;
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
    <div class="table-card" style="margin-bottom:12px;">
      <div onclick="toggleSettingsCard('${key}')"
        style="display:flex;align-items:center;gap:10px;padding:13px 16px;cursor:pointer;user-select:none;">
        <span id="scChev_${key}" style="font-size:11px;color:var(--muted);transition:transform 0.15s;display:inline-block;${open ? 'transform:rotate(90deg);' : ''}">▶</span>
        <strong style="font-size:14px;">${title}</strong>
        ${subtitle ? `<span style="color:var(--muted);font-size:12px;font-weight:400;">${subtitle}</span>` : ''}
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

async function deleteSettingKey(key) {
  const ok = await window.api.confirmDelete(`Remove the custom value "${key}"?`);
  if (!ok) return;
  const res = await window.api.deleteSetting('settings', key);
  if (!res.success) { toast(res.error || 'Could not remove.', 'error'); return; }
  toast('Removed.', 'warning');
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
          <span style="font-size:13px;color:var(--muted);white-space:nowrap;">@kosher-connect.com</span>
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
      <span style="color:var(--danger);">Any previous password for this address stops working immediately</span> — you'll need to update it wherever it's used (Vercel SMTP_PASS, Gmail send-as).`,
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
    <div style="font-size:13px;line-height:1.7;">
      <div style="margin-bottom:10px;color:var(--muted);">Copy these now — this password can't be viewed again (only regenerated).</div>
      <div style="display:grid;grid-template-columns:auto 1fr;gap:6px 12px;font-size:13px;">
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
    <div style="font-size:12px;color:var(--muted);margin-bottom:12px;">
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
    <div style="font-size:11px;color:var(--muted);margin-top:6px;">The rule raises a task in the daily sweep for every matching customer, and closes it automatically when the condition clears.</div>
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

// ─────────────────────────────────────────────
//  START
// ─────────────────────────────────────────────
initApp();
