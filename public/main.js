// ─── API Bridge: replaces Electron IPC with fetch calls ───────────────────────
window.api = {
  getAllCustomers: () => fetch('/api/customers').then(r => r.json()),

  addCustomer: (c) => fetch('/api/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(c),
  }).then(r => r.json()),

  updateCustomer: (c) => fetch('/api/customers', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(c),
  }).then(r => r.json()),

  deleteCustomer: (id) => fetch('/api/customers?id=' + id, { method: 'DELETE' }).then(r => r.json()),

  confirmDelete: (msg) => Promise.resolve(window.confirm(msg)),

  exportCSV: () => fetch('/api/export-csv').then(async r => {
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

  getAllRentals: () => fetch('/api/rentals').then(r => r.json()),
  saveAllRentals: (data) => fetch('/api/rentals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(r => r.json()),

  getAllPhones: () => fetch('/api/phones').then(r => r.json()),
  saveAllPhones: (data) => fetch('/api/phones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(r => r.json()),

  getAllSims: () => fetch('/api/sims').then(r => r.json()),
  saveAllSims: (data) => fetch('/api/sims', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
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

// ─────────────────────────────────────────────
//  INIT — called directly since script loads after DOM is ready
// ─────────────────────────────────────────────
async function initApp() {
  await loadCustomers();
  rentals = await window.api.getAllRentals();
  phones  = await window.api.getAllPhones();
  sims    = await window.api.getAllSims();
  reconcilePhoneStatuses();
  renderCustomersTab();
  setupNav();
  setupSearch();
  setupModal();
  setupTopbarButtons();
}

function reconcilePhoneStatuses() {
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

async function loadCustomers() {
  customers = await window.api.getAllCustomers();
  filteredCustomers = [...customers];
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

function renderTab(tab) {
  const content = document.getElementById('mainContent');
  const searchBox = document.getElementById('searchBox');
  const btnNew = document.getElementById('btnNewCustomer');

  if (tab === 'customers') {
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
  } else {
    const labels = {
      virtual:  ['🔢', 'Virtual Numbers'],
      tasks:    ['✅', 'Tasks'],
      support:  ['🎫', 'Support Tickets'],
      settings: ['⚙️', 'Settings'],
    };
    const [icon, title] = labels[tab] || ['📌', tab];
    const parts = title.split(' ');
    document.getElementById('pageTitle').innerHTML = `${parts[0]} <span>${parts.slice(1).join(' ')}</span>`;
    searchBox.style.display = 'none';
    btnNew.style.display = 'none';
    content.innerHTML = `
      <div class="tab-placeholder">
        <div class="big">${icon}</div>
        <h2>${title}</h2>
        <p style="color:var(--muted)">This section is coming soon.</p>
      </div>`;
  }
}

// ─────────────────────────────────────────────
//  DATE FORMAT HELPER
// ─────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
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
        <strong>${escHtml(c.firstName)} ${escHtml(c.lastName)}</strong>
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

function getJewishHolidays() {
  const jewishHolidaysByYear = {
    2024: [
      '2024-04-22','2024-04-23','2024-04-28','2024-04-29',  // Pesach first 2 + last 2
      '2024-06-11','2024-06-12',                             // Shavuot
      '2024-10-02','2024-10-03',                             // Rosh Hashana
      '2024-10-11',                                          // Yom Kippur (1 day only)
      '2024-10-16','2024-10-17',                             // First 2 days Sukkot
      '2024-10-23','2024-10-24',                             // Shemini Atzeret + Simchas Torah
    ],
    2025: [
      '2025-04-12','2025-04-13','2025-04-18','2025-04-19',  // Pesach first 2 + last 2
      '2025-06-01','2025-06-02',                             // Shavuot
      '2025-09-22','2025-09-23',                             // Rosh Hashana
      '2025-10-01',                                          // Yom Kippur (1 day only)
      '2025-10-06','2025-10-07',                             // First 2 days Sukkot (fixed: was 05-06)
      '2025-10-13','2025-10-14',                             // Shemini Atzeret + Simchas Torah (fixed: was 12-13)
    ],
    2026: [
      '2026-04-01','2026-04-02','2026-04-07','2026-04-08',  // Pesach first 2 + last 2
      '2026-05-21','2026-05-22',                             // Shavuot
      '2026-09-11','2026-09-12',                             // Rosh Hashana
      '2026-09-20',                                          // Yom Kippur (1 day only)
      '2026-09-25','2026-09-26',                             // First 2 days Sukkot (fixed: was 24-25)
      '2026-10-02','2026-10-03',                             // Shemini Atzeret + Simchas Torah (fixed: was 01-02)
    ],
    2027: [
      '2027-04-21','2027-04-22','2027-04-27','2027-04-28',  // Pesach first 2 + last 2
      '2027-06-11','2027-06-12',                             // Shavuot
      '2027-10-01','2027-10-02',                             // Rosh Hashana
      '2027-10-10',                                          // Yom Kippur (1 day only)
      '2027-10-15','2027-10-16',                             // First 2 days Sukkot (fixed: was 14-15)
      '2027-10-22','2027-10-23',                             // Shemini Atzeret + Simchas Torah (fixed: was 21-22)
    ],
  };
  const result = new Set();
  Object.values(jewishHolidaysByYear).flat().forEach(d => result.add(d));
  return result;
}

const ALL_HOLIDAYS = getJewishHolidays();

function isShabbatOrHoliday(date) {
  const d = new Date(date);
  if (d.getDay() === 6) return true;
  return ALL_HOLIDAYS.has(d.toISOString().slice(0, 10));
}

function calcRentalPrice(fromDate, toDate, country = 'USA', ukPlan = 'standard') {
  let chargeableDays = 0;
  let totalDays = 0;
  const cur = new Date(fromDate);
  const end = new Date(toDate);
  while (cur <= end) {
    totalDays++;
    if (!isShabbatOrHoliday(cur)) chargeableDays++;
    cur.setDate(cur.getDate() + 1);
  }
  let ratePerDay, minCharge, maxCharge;
  if (country === 'UK') {
    if (ukPlan === 'unlimited') { ratePerDay = 2.5; minCharge = 20; maxCharge = 45; }
    else                        { ratePerDay = 2;   minCharge = 15; maxCharge = 40;   }
  } else if (country === 'Canada') { ratePerDay = 3; minCharge = 25; maxCharge = 45; }
  else if (country === 'Israel')   { ratePerDay = 3; minCharge = 20; maxCharge = 50; }
  else /* USA / EU / default */    { ratePerDay = 3; minCharge = 20; maxCharge = 45; }
  let price = chargeableDays * ratePerDay;
  if (chargeableDays > 0 && price < minCharge) price = minCharge;
  if (maxCharge !== null && price > maxCharge) price = maxCharge;
  return { chargeableDays, totalDays, price };
}

function countChargeableDays(fromDate, toDate) {
  let days = 0;
  const cur = new Date(fromDate);
  const end = new Date(toDate);
  while (cur <= end) {
    if (!isShabbatOrHoliday(cur)) days++;
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function calcLateFeeDays(rental) {
  const today = new Date().toISOString().slice(0, 10);
  if (rental.status === 'returned' || rental.toDate >= today) return 0;
  const lateDayStart = new Date(rental.toDate);
  lateDayStart.setDate(lateDayStart.getDate() + 1);
  return countChargeableDays(lateDayStart.toISOString().slice(0, 10), today);
}

function saveRentals(data) {
  rentals = data;
  window.api.saveAllRentals(data);
}
function savePhones(data) {
  phones = data;
  window.api.saveAllPhones(data);
}

let rentals = [];
let phones  = [];
let sims    = [];
let rentalSearchTerm = '';
let filterCustomer = '', filterStatus = 'all', filterPaid = 'all';

function renderRentalsTab() {
  const content = document.getElementById('mainContent');
  const activeRentals   = rentals.filter(r => r.status === 'active').length;
  const availablePhones = phones.filter(p => p.status === 'available').length;
  const totalRevenue    = rentals.reduce((s, r) => s + (r.price || 0), 0);
  const returningToday  = rentals.filter(r => r.status === 'active' && r.toDate === new Date().toISOString().slice(0,10)).length;

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
        <div class="stat-label">Total Revenue</div>
        <div class="stat-value purple">£${totalRevenue}</div>
        <div class="stat-sub">All rentals</div>
      </div>
    </div>

    <div style="display:flex; gap:10px; margin-bottom:20px; flex-wrap:wrap;">
      <button class="btn btn-primary" onclick="openNewRentalModal()">📱 New Rental</button>
      <button class="btn btn-outline" onclick="openManagePhonesModal()">⚙️ Manage Phones</button>
      <input class="search-box" style="width:240px;" type="text" id="rentalSearch"
        placeholder="🔍 Search customer or phone..."
        value="${rentalSearchTerm}"
        oninput="rentalSearchTerm=this.value; renderRentalRows()">
    </div>

    <div class="rentals-split">
      <div class="rentals-split-col">
        <div class="section-header">
          <div class="section-title">Active & Recent Rentals</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;align-items:center;">
          <input type="text" class="search-box" id="filterCustomer" placeholder="Filter by customer..."
            style="width:180px;" value="${filterCustomer}"
            oninput="filterCustomer=this.value;renderRentalRows()">
          <select id="filterStatus" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-secondary);color:var(--text);font-size:13px;"
            onchange="filterStatus=this.value;renderRentalRows()">
            <option value="all" ${filterStatus==='all'?'selected':''}>All statuses</option>
            <option value="active" ${filterStatus==='active'?'selected':''}>Active</option>
            <option value="overdue" ${filterStatus==='overdue'?'selected':''}>Overdue</option>
            <option value="returned" ${filterStatus==='returned'?'selected':''}>Returned</option>
            <option value="returned_incomplete" ${filterStatus==='returned_incomplete'?'selected':''}>Returned ⚠️</option>
          </select>
          <select id="filterPaid" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-secondary);color:var(--text);font-size:13px;"
            onchange="filterPaid=this.value;renderRentalRows()">
            <option value="all" ${filterPaid==='all'?'selected':''}>All paid</option>
            <option value="paid" ${filterPaid==='paid'?'selected':''}>Fully Paid</option>
            <option value="debt" ${filterPaid==='debt'?'selected':''}>Has Debt</option>
          </select>
          <button class="btn btn-outline" style="font-size:12px;padding:5px 12px;"
            onclick="filterCustomer='';filterStatus='all';filterPaid='all';renderRentalRows()">Clear</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th><th>Phone</th><th>From → To</th>
                <th>Days</th><th>Price</th><th>Paid</th><th>Status</th><th>Actions</th>
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

function getComputedStatus(r, today) {
  if (r.status !== 'returned') return r.toDate < today ? 'overdue' : 'active';
  const eq  = r.equipmentGiven || { phone: true, sim: true, plug: true, cable: true };
  const ret = r.returnedItems  || {};
  const incomplete = ['phone', 'sim', 'plug', 'cable'].some(k => (eq[k] ?? true) && ret[k] !== true);
  return incomplete ? 'returned_incomplete' : 'returned';
}

function renderRentalRows() {
  const tbody = document.getElementById('rentalTableBody');
  if (!tbody) return;
  const today = new Date().toISOString().slice(0, 10);

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
      const totalOwed = (r.price || 0) + calcLateFeeDays(r);
      const fullyPaid = (r.amountPaid || 0) >= totalOwed;
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
    if      (computedStatus === 'active' && r.toDate === today) statusBadge = `<span class="badge badge-sim">Due Today</span>`;
    else if (computedStatus === 'active')               statusBadge = `<span class="badge badge-rental">Active</span>`;
    else if (computedStatus === 'overdue')              statusBadge = `<span class="badge" style="background:rgba(239,68,68,0.15);color:var(--danger);">Overdue ⚠️</span>`;
    else if (computedStatus === 'returned')             statusBadge = `<span class="badge badge-active">Returned</span>`;
    else                                                statusBadge = `<span class="badge" style="background:rgba(251,146,60,0.15);color:#fb923c;">Returned ⚠️</span>`;

    const paid = r.amountPaid || 0;
    const debt = r.price - paid;
    const lateFee = calcLateFeeDays(r);
    const totalOwed = debt + lateFee;
    const debtColor = totalOwed > 0 ? 'color:var(--danger);' : 'color:var(--success);';
    return `<tr>
      <td>
        <div class="customer-name">${escHtml(r.customerName || '—')}</div>
        <div class="customer-email" style="font-size:11px;">${r.vn ? '🔢 +'+r.vnPrefix : ''}</div>
      </td>
      <td style="font-weight:600;font-size:12px;">${escHtml(r.phoneNumber || '—')}</td>
      <td style="font-size:11px;">${fmtDate(r.fromDate)}<br>${fmtDate(r.toDate)}</td>
      <td style="text-align:center;">${r.chargeableDays}d</td>
      <td style="color:var(--success);font-weight:700;">£${r.price}</td>
      <td style="font-weight:700;${debtColor}">${totalOwed > 0 ? '£'+totalOwed+' owed' : '✓ Paid'}</td>
      <td>${statusBadge}</td>
      <td>
        <div class="row-actions">
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

  const today = new Date().toISOString().slice(0,10);
  tbody.innerHTML = phones.map(p => {
    const poolExpired = p.poolExpiry && p.poolExpiry < today;
    let statusBadge;
    if (p.status === 'rented')         statusBadge = `<span class="badge badge-rental">Rented</span>`;
    else if (p.status === 'available' && p.poolExpiry && !poolExpired)
                                        statusBadge = `<span class="badge badge-sim">Available (active pool)</span>`;
    else if (poolExpired)               statusBadge = `<span class="badge" style="background:rgba(107,114,128,0.15);color:var(--muted);">Pool Expired</span>`;
    else                                statusBadge = `<span class="badge badge-active">Available</span>`;

    return `<tr>
      <td style="font-weight:600;font-size:12px;">${escHtml(p.number)}</td>
      <td>${p.country === 'USA' ? '🇺🇸' : p.country === 'Israel' ? '🇮🇱' : p.country === 'UK' ? '🇬🇧' : p.country === 'Canada' ? '🇨🇦' : '🇪🇺'} ${escHtml(p.country)}</td>
      <td style="font-size:12px;">${escHtml(p.pool || '—')}</td>
      <td style="font-size:11px;color:${poolExpired?'var(--danger)':'var(--muted)'};">${p.poolExpiry || '—'}</td>
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
function openNewRentalModal() {
  const customerOptions = customers.map(c =>
    `<option value="${c.id}">${escHtml(c.firstName)} ${escHtml(c.lastName)} · ${escHtml(c.phone||'')}</option>`
  ).join('');

  const availablePhoneOptions = phones
    .filter(p => p.status !== 'rented')
    .map(p => `<option value="${p.id}">${escHtml(p.number)} · ${escHtml(p.country)} · ${escHtml(p.company||'')} ${p.pool ? '(Pool: '+p.pool+')' : ''}</option>`)
    .join('');

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
        <label class="form-label">Phone *</label>
        <select class="form-input" id="rPhone" onchange="updateRentalPhoneInfo(); updateRentalCalc();">
          <option value="">— Select phone —</option>
          ${availablePhoneOptions}
        </select>
        <div id="rPhoneInfo" style="font-size:12px;color:var(--muted);margin-top:4px;"></div>
      </div>

      <div class="form-group">
        <label class="form-label">From Date *</label>
        <input class="form-input" type="date" id="rFrom" onchange="updateRentalCalc(); showHebrewDate('rFrom','rFromHeb')">
        <div class="hebrew-date-label" id="rFromHeb"></div>
      </div>
      <div class="form-group">
        <label class="form-label">To Date * (inclusive)</label>
        <input class="form-input" type="date" id="rTo" onchange="updateRentalCalc(); showHebrewDate('rTo','rToHeb')">
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
            <select class="form-input" id="rVNSub" onchange="document.getElementById('rVNPrice').value=this.value==='monthly'?10:5;">
              <option value="weekly">Weekly (£5)</option>
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
        <div style="display:flex;gap:18px;flex-wrap:wrap;">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;"><input type="checkbox" id="givenPhone" checked style="accent-color:var(--accent);"> 📱 Phone handset</label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;"><input type="checkbox" id="givenSIM"   checked style="accent-color:var(--accent);"> 💳 SIM card</label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;"><input type="checkbox" id="givenPlug"  checked style="accent-color:var(--accent);"> 🔌 Plug / Charger</label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;"><input type="checkbox" id="givenCable" checked style="accent-color:var(--accent);"> 🔋 Cable</label>
        </div>
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

  const today = new Date().toISOString().slice(0,10);
  const next7 = new Date(Date.now() + 7*86400000).toISOString().slice(0,10);
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

function updateRentalCalc() {
  const from = document.getElementById('rFrom')?.value;
  const to   = document.getElementById('rTo')?.value;
  const box  = document.getElementById('rCalcBox');
  const txt  = document.getElementById('rCalcText');
  if (!from || !to || to <= from) { box.style.display='none'; return; }
  const selPhone = document.getElementById('rPhone');
  const phone    = selPhone ? phones.find(p => p.id === selPhone.value) : null;
  const country  = phone?.country || 'USA';
  const ukPlan   = phone?.ukPlan  || 'standard';
  const { chargeableDays, totalDays, price } = calcRentalPrice(from, to, country, ukPlan);
  const excluded = totalDays - chargeableDays;
  const cap = country === 'UK' ? (ukPlan === 'unlimited' ? 45 : 40) : country === 'Canada' ? 45 : country === 'Israel' ? 50 : 45;
  let finalPrice = price;
  let discountLine = '';
  const addDiscount = document.getElementById('rAddDiscount')?.checked;
  if (addDiscount) {
    const dtype = document.getElementById('rDiscountType')?.value || 'percent';
    const dval  = parseFloat(document.getElementById('rDiscountValue')?.value) || 0;
    finalPrice  = dtype === 'percent' ? Math.max(0, price * (1 - dval / 100)) : Math.max(0, price - dval);
    if (dval > 0) discountLine = ` &nbsp;|&nbsp; <span style="color:var(--gold);font-size:12px;">-${dtype==='percent'?dval+'%':'£'+dval} discount → <strong>£${finalPrice.toFixed(2)}</strong></span>`;
  }
  box.style.display = 'block';
  txt.innerHTML = `
    <span style="color:var(--muted);">Total days:</span> ${totalDays} &nbsp;|&nbsp;
    <span style="color:var(--muted);">Shabbat/Yom Tov excluded:</span> <span style="color:var(--gold);">${excluded}</span> &nbsp;|&nbsp;
    <span style="color:var(--muted);">Chargeable days:</span> ${chargeableDays} &nbsp;|&nbsp;
    <strong style="color:var(--success);font-size:15px;">£${price}</strong>
    ${price >= cap ? ' <span style="color:var(--muted);font-size:11px;">(monthly cap)</span>' : ''}${discountLine}
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

  const customer = customers.find(c => c.id === customerId);
  const phone    = phones.find(p => p.id === phoneId);
  const { chargeableDays, totalDays, price } = calcRentalPrice(from, to, phone.country, phone.ukPlan || 'standard');

  let vnPrice = 0, vnPrefix = '', vnSub = '';
  if (addVN) {
    vnPrefix = document.getElementById('rVNPrefix').value;
    vnSub    = document.getElementById('rVNSub').value;
    vnPrice  = parseFloat(document.getElementById('rVNPrice').value) || 0;
  }

  const addDiscount   = document.getElementById('rAddDiscount').checked;
  const discountType  = addDiscount ? document.getElementById('rDiscountType').value : 'percent';
  const discountValue = addDiscount ? (parseFloat(document.getElementById('rDiscountValue').value) || 0) : 0;
  const discountedRental = addDiscount
    ? (discountType === 'percent' ? Math.max(0, price * (1 - discountValue / 100)) : Math.max(0, price - discountValue))
    : price;

  const totalPrice = discountedRental + vnPrice;
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
    status:       'active',
    createdAt:    new Date().toISOString(),
    returnedItems: {},
    equipmentGiven: {
      phone: document.getElementById('givenPhone').checked,
      sim:   document.getElementById('givenSIM').checked,
      plug:  document.getElementById('givenPlug').checked,
      cable: document.getElementById('givenCable').checked,
    },
  };

  rentals.push(rental);
  saveRentals(rentals);

  phone.status        = 'rented';
  phone.currentRental = rental.id;
  savePhones(phones);

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
  toast(`Rental saved! £${totalPrice} charged to ${customer.firstName}.`, 'success');
  renderRentalsTab();
}

// ══ RETURN MODAL ══
function openReturnModal(rentalId) {
  const r = rentals.find(x => x.id === rentalId);
  if (!r) return;

  showDynamicModal(`
    <div class="modal-title">↩ Return Phone — ${escHtml(r.phoneNumber)}</div>
    <div style="color:var(--muted);font-size:13px;margin-bottom:16px;">Customer: <strong style="color:var(--text);">${escHtml(r.customerName)}</strong> · Rental period: ${r.fromDate} → ${r.toDate}${new Date().toISOString().slice(0,10) > r.toDate ? '<div style="color:var(--danger);font-size:12px;margin-top:4px;">⚠️ Overdue — £1/chargeable day late fee applies</div>' : ''}</div>

    <div class="section-divider">What was returned?</div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:18px;">
      ${(r.equipmentGiven?.phone  ?? true)  ? `<label style="display:flex;align-items:center;gap:10px;cursor:pointer;"><input type="checkbox" id="retPhone" checked style="width:16px;height:16px;accent-color:var(--accent);"> <span>📱 Phone handset</span></label>` : ''}
      ${(r.equipmentGiven?.sim    ?? true)   ? `<label style="display:flex;align-items:center;gap:10px;cursor:pointer;"><input type="checkbox" id="retSIM"   checked style="width:16px;height:16px;accent-color:var(--accent);"> <span>💳 SIM card</span></label>` : ''}
      ${(r.equipmentGiven?.plug   ?? true)   ? `<label style="display:flex;align-items:center;gap:10px;cursor:pointer;"><input type="checkbox" id="retPlug"  checked style="width:16px;height:16px;accent-color:var(--accent);"> <span>🔌 Plug / Charger</span></label>` : ''}
      ${(r.equipmentGiven?.cable  ?? true)   ? `<label style="display:flex;align-items:center;gap:10px;cursor:pointer;"><input type="checkbox" id="retCable" checked style="width:16px;height:16px;accent-color:var(--accent);"> <span>🔋 Cable</span></label>` : ''}
    </div>

    ${r.country === 'USA' ? `
    <div class="section-divider">Pool status</div>
    <div class="form-group" style="margin-bottom:16px;">
      <label class="form-label">Is this phone still active in a pool?</label>
      <div style="display:flex;gap:10px;margin-top:6px;">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
          <input type="radio" name="poolStatus" value="active" id="poolYes" style="accent-color:var(--accent);">
          <span style="font-size:13px;">Yes — still active until:</span>
        </label>
        <input class="form-input" type="date" id="poolExpiry" style="padding:5px 10px;font-size:13px;width:150px;">
      </div>
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-top:8px;">
        <input type="radio" name="poolStatus" value="expired" id="poolNo" style="accent-color:var(--accent);" checked>
        <span style="font-size:13px;">No — pool expired, phone is free</span>
      </label>
    </div>` : ''}

    <div class="section-divider">Payment</div>
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:10px;font-size:13px;">
        <span style="color:var(--muted);">Total charge:</span>
        <strong style="color:var(--text);" id="retTotalDisplay">£${r.price}</strong>
      </div>
      <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px;">
        <span style="font-size:13px;color:var(--muted);white-space:nowrap;">Amount paid: £</span>
        <input class="form-input" type="number" id="retAmountPaid" value="${r.amountPaid || r.price}" min="0" step="0.5" style="width:100px;padding:7px 10px;">
        <div id="retDebtPreview" style="font-size:12px;"></div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;">
          <input type="checkbox" id="retAddDiscount" style="accent-color:var(--accent);"
            onchange="document.getElementById('retDiscountBox').style.display=this.checked?'flex':'none'; updateDebtPreview(${r.price})">
          🏷️ Discount at return
        </label>
        <div id="retDiscountBox" style="display:none;gap:6px;align-items:center;">
          <select id="retDiscountType" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-secondary);color:var(--text);font-size:13px;" onchange="updateDebtPreview(${r.price})">
            <option value="percent">%</option><option value="fixed">£</option>
          </select>
          <input type="number" id="retDiscountValue" value="0" min="0" step="0.5"
            style="width:70px;padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-secondary);color:var(--text);font-size:13px;" oninput="updateDebtPreview(${r.price})">
        </div>
      </div>
      <div>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;">
          <input type="checkbox" id="retFullyPaid" style="accent-color:var(--accent);"
            onchange="if(this.checked){document.getElementById('retAmountPaid').value=document.getElementById('retTotalDisplay').textContent.replace('£','');updateDebtPreview(${r.price})}">
          Mark as fully paid
        </label>
      </div>
    </div>

    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeDynamicModal()">Cancel</button>
      <button class="btn btn-primary" onclick="processReturn('${rentalId}')">✅ Confirm Return</button>
    </div>
  `);

  const totalForReturn = r.price;
  document.getElementById('retAmountPaid').addEventListener('input', function() {
    updateDebtPreview(totalForReturn);
  });
  updateDebtPreview(totalForReturn);
}

function updateDebtPreview(totalPrice) {
  const addDiscount = document.getElementById('retAddDiscount')?.checked;
  let effectiveTotal = totalPrice;
  if (addDiscount) {
    const dtype = document.getElementById('retDiscountType')?.value || 'percent';
    const dval  = parseFloat(document.getElementById('retDiscountValue')?.value) || 0;
    effectiveTotal = dtype === 'percent' ? Math.max(0, totalPrice * (1 - dval / 100)) : Math.max(0, totalPrice - dval);
  }
  const totalEl = document.getElementById('retTotalDisplay');
  if (totalEl) totalEl.textContent = '£' + effectiveTotal.toFixed(2);
  const paid = parseFloat(document.getElementById('retAmountPaid')?.value) || 0;
  const debt = effectiveTotal - paid;
  const el = document.getElementById('retDebtPreview');
  if (!el) return;
  if (debt <= 0) {
    el.innerHTML = '<span style="color:var(--success);">✓ Fully paid</span>';
  } else {
    el.innerHTML = '<span style="color:var(--danger);">Remaining debt: £' + debt.toFixed(2) + '</span>';
  }
}

async function processReturn(rentalId) {
  const r = rentals.find(x => x.id === rentalId);
  if (!r) return;

  const eq = r.equipmentGiven || { phone: true, sim: true, plug: true, cable: true };
  const retPhone  = (eq.phone  ?? true) ? (document.getElementById('retPhone')?.checked  ?? true) : false;
  const retSIM    = (eq.sim    ?? true) ? (document.getElementById('retSIM')?.checked    ?? true) : false;
  const retPlug   = (eq.plug   ?? true) ? (document.getElementById('retPlug')?.checked   ?? true) : false;
  const retCable  = (eq.cable  ?? true) ? (document.getElementById('retCable')?.checked  ?? true) : false;
  const poolActive = r.country === 'USA' ? (document.getElementById('poolYes')?.checked || false) : false;
  const poolExpiry = r.country === 'USA' ? (document.getElementById('poolExpiry')?.value || '') : '';
  const amountPaid = parseFloat(document.getElementById('retAmountPaid').value) || 0;

  const addRetDiscount   = document.getElementById('retAddDiscount')?.checked || false;
  const retDiscountType  = document.getElementById('retDiscountType')?.value  || 'percent';
  const retDiscountValue = parseFloat(document.getElementById('retDiscountValue')?.value) || 0;
  const effectivePrice   = addRetDiscount
    ? (retDiscountType === 'percent' ? Math.max(0, r.price * (1 - retDiscountValue / 100)) : Math.max(0, r.price - retDiscountValue))
    : r.price;

  r.status       = 'returned';
  r.returnedAt   = new Date().toISOString();
  r.returnedItems = { phone: retPhone, sim: retSIM, plug: retPlug, cable: retCable };
  r.amountPaid   = amountPaid;
  r.debt         = Math.max(0, effectivePrice - amountPaid);
  if (addRetDiscount && retDiscountValue > 0) {
    r.returnDiscount     = retDiscountValue;
    r.returnDiscountType = retDiscountType;
  }
  saveRentals(rentals);

  const phone = phones.find(p => p.id === r.phoneId);
  if (phone) {
    phone.status        = 'available';
    phone.currentRental = null;
    phone.poolExpiry    = poolActive && poolExpiry ? poolExpiry : null;
    savePhones(phones);
  }

  const country = r.country || 'USA';
  const phoneCharge = country === 'UK' ? 45 : country === 'Israel' ? 120 : 100;
  const plugCharge  = country === 'UK' ? 5 : 10;

  const today2 = new Date().toISOString().slice(0, 10);
  const missing = [];
  if (r.toDate < today2) {
    const lateDayStart = new Date(r.toDate);
    lateDayStart.setDate(lateDayStart.getDate() + 1);
    const lateDays = countChargeableDays(lateDayStart.toISOString().slice(0, 10), today2);
    if (lateDays > 0) missing.push({ item: `Late return (${lateDays}d × £1)`, price: lateDays });
  }
  if ((eq.phone  ?? true) && !retPhone) missing.push({ item: 'Phone handset',  price: phoneCharge });
  if ((eq.sim    ?? true) && !retSIM)   missing.push({ item: 'SIM card',       price: 10 });
  if ((eq.plug   ?? true) && !retPlug)  missing.push({ item: 'Plug/Charger',   price: plugCharge });
  if ((eq.cable  ?? true) && !retCable) missing.push({ item: 'Cable',          price: 5 });

  if (missing.length > 0) {
    const totalMissing = missing.reduce((s, m) => s + m.price, 0);
    const c = customers.find(x => x.id === r.customerId);
    if (c) {
      if (!c.history) c.history = [];
      c.history.push({
        type:   'rental',
        desc:   `Missing items: ${missing.map(m => m.item).join(', ')}`,
        amount: totalMissing,
        date:   new Date().toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }),
      });
      c.totalPaid = (c.totalPaid || 0) + totalMissing;
      await window.api.updateCustomer(c);
      const idx = customers.findIndex(x => x.id === r.customerId);
      if (idx !== -1) customers[idx] = c;
    }
    toast(`Return processed. Missing items charged: £${totalMissing}`, 'warning');
  } else {
    toast('Phone returned successfully! ✅', 'success');
  }

  closeDynamicModal();
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
    pool:       document.getElementById('pPool').value.trim(),
    poolExpiry: document.getElementById('pPoolExpiry').value || null,
    simId:      document.getElementById('pSIMID').value.trim(),
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
  showDynamicModal(`
    <div class="modal-title">✏️ Edit Phone — ${escHtml(p.number)}</div>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Pool Name</label>
        <input class="form-input" id="epPool" type="text" value="${escHtml(p.pool||'')}">
      </div>
      <div class="form-group">
        <label class="form-label">Pool Expiry</label>
        <input class="form-input" id="epExpiry" type="date" value="${p.poolExpiry||''}">
      </div>
      <div class="form-group">
        <label class="form-label">Company</label>
        <input class="form-input" id="epCompany" type="text" value="${escHtml(p.company||'')}">
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <select class="form-input" id="epStatus">
          <option value="available" ${p.status==='available'?'selected':''}>Available</option>
          <option value="rented"    ${p.status==='rented'?'selected':''}>Rented</option>
        </select>
      </div>
      ${p.country === 'UK' ? `
      <div class="form-group">
        <label class="form-label">UK Plan Type</label>
        <select class="form-input" id="epUKPlan">
          <option value="standard" ${(p.ukPlan||'standard')==='standard'?'selected':''}>Standard (UK minutes) – £2/day</option>
          <option value="unlimited" ${p.ukPlan==='unlimited'?'selected':''}>Unlimited International – £2.50/day</option>
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
  p.pool       = document.getElementById('epPool').value.trim();
  p.poolExpiry = document.getElementById('epExpiry').value || null;
  p.company    = document.getElementById('epCompany').value.trim();
  p.status     = document.getElementById('epStatus').value;
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
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px;">
        <span style="color:var(--muted);">Total charge:</span>
        <strong style="color:var(--text);">£${r.price + mgLateFee}</strong>
      </div>
      ${mgLateFee > 0 ? `<div style="font-size:12px;color:var(--muted);margin-bottom:8px;">of which £${mgLateFee} is a late fee</div>` : ''}
      <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px;">
        <span style="font-size:13px;color:var(--muted);white-space:nowrap;">Amount paid: £</span>
        <input class="form-input" type="number" id="mgPaid" value="${paid}" min="0" step="0.5"
          style="width:100px;padding:7px 10px;" oninput="mgUpdateDebt()">
      </div>
      <div style="margin-bottom:8px;">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;">
          <input type="checkbox" id="mgFullyPaid" style="accent-color:var(--accent);"
            onchange="if(this.checked){document.getElementById('mgPaid').value=document.getElementById('mgPrice').value;mgUpdateDebt();}else{document.getElementById('mgPaid').value='';mgUpdateDebt();}">
          Mark as fully paid
        </label>
      </div>
      <div id="mgDebtDisplay" style="font-size:13px;font-weight:600;color:${debt>0?'var(--danger)':'var(--success)'};">
        ${debt > 0 ? 'Remaining debt: £'+debt : '✓ Fully paid'}
      </div>
    </div>

    <div class="section-divider" style="margin-top:12px;">Equipment</div>
    <div style="margin-bottom:8px;">
      <div style="font-size:12px;color:var(--muted);margin-bottom:6px;">Given to customer</div>
      <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:10px;">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;"><input type="checkbox" id="mgGivenPhone" ${(r.equipmentGiven?.phone??true)?'checked':''} style="accent-color:var(--accent);"> 📱 Phone</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;"><input type="checkbox" id="mgGivenSIM"   ${(r.equipmentGiven?.sim??true)?'checked':''} style="accent-color:var(--accent);"> 💳 SIM</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;"><input type="checkbox" id="mgGivenPlug"  ${(r.equipmentGiven?.plug??true)?'checked':''} style="accent-color:var(--accent);"> 🔌 Plug</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;"><input type="checkbox" id="mgGivenCable" ${(r.equipmentGiven?.cable??true)?'checked':''} style="accent-color:var(--accent);"> 🔋 Cable</label>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:6px;">Returned by customer</div>
      <div id="mgReturnedItemsSection" style="display:flex;flex-direction:column;gap:6px;">
        ${(r.equipmentGiven?.phone  ?? true) ? `<label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13px;"><input type="checkbox" id="mgPhone" ${r.returnedItems?.phone!==false?'checked':''} style="accent-color:var(--accent);"> 📱 Phone handset returned</label>` : ''}
        ${(r.equipmentGiven?.sim    ?? true) ? `<label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13px;"><input type="checkbox" id="mgSIM"   ${r.returnedItems?.sim!==false?'checked':''} style="accent-color:var(--accent);"> 💳 SIM card returned</label>` : ''}
        ${(r.equipmentGiven?.plug   ?? true) ? `<label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13px;"><input type="checkbox" id="mgPlug"  ${r.returnedItems?.plug!==false?'checked':''} style="accent-color:var(--accent);"> 🔌 Plug / Charger returned</label>` : ''}
        ${(r.equipmentGiven?.cable  ?? true) ? `<label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13px;"><input type="checkbox" id="mgCable" ${r.returnedItems?.cable!==false?'checked':''} style="accent-color:var(--accent);"> 🔋 Cable returned</label>` : ''}
      </div>
      <div id="mgReturnItemsError" style="display:none;color:var(--danger);font-size:12px;margin-top:6px;">Please select at least one returned item.</div>
    </div>

    <div class="section-divider" style="margin-top:12px;">Discount</div>
    <div style="margin-bottom:16px;">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;">
        <input type="checkbox" id="mgAddDiscount" style="accent-color:var(--accent);" ${(r.discountValue||0)>0?'checked':''} onchange="document.getElementById('mgDiscountBox').style.display=this.checked?'flex':'none'; mgUpdateCalc()">
        🏷️ Apply discount
      </label>
      <div id="mgDiscountBox" style="display:${(r.discountValue||0)>0?'flex':'none'};gap:8px;align-items:center;margin-top:8px;">
        <select id="mgDiscountType" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-secondary);color:var(--text);font-size:13px;" onchange="mgUpdateCalc()">
          <option value="percent" ${(r.discountType||'percent')==='percent'?'selected':''}>% off</option>
          <option value="fixed"   ${r.discountType==='fixed'?'selected':''}>£ off</option>
        </select>
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
  const { chargeableDays, totalDays, price } = calcRentalPrice(from, to, country, ukPlan);
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

  document.getElementById('mgCalcText').innerHTML =
    `Total: ${totalDays}d &nbsp;|&nbsp; Shabbat/YT excluded: <span style="color:var(--gold);">${excl}</span> &nbsp;|&nbsp; Chargeable: ${chargeableDays}d &nbsp;|&nbsp; <strong style="color:var(--success);">£${price}</strong>${discountLine}`;
  document.getElementById('mgPrice').value = finalPrice.toFixed(2);
  document.getElementById('mgBasePrice').value = price;
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
  const price = parseFloat(document.getElementById('mgPrice')?.value) || 0;
  const paid  = parseFloat(document.getElementById('mgPaid')?.value)  || 0;
  const debt  = Math.max(0, price - paid);
  const el    = document.getElementById('mgDebtDisplay');
  if (!el) return;
  el.style.color = debt > 0 ? 'var(--danger)' : 'var(--success)';
  el.textContent = debt > 0 ? 'Remaining debt: £' + debt.toFixed(2) : '✓ Fully paid';
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

  if (isReturned) {
    const anyChecked = ['mgPhone','mgSIM','mgPlug','mgCable'].some(id => document.getElementById(id)?.checked);
    const errEl = document.getElementById('mgReturnItemsError');
    if (!anyChecked) {
      if (errEl) errEl.style.display = 'block';
      return;
    }
    if (errEl) errEl.style.display = 'none';
  }

  const today = new Date().toISOString().slice(0,10);
  let newStatus;
  if (isReturned) newStatus = 'returned';
  else if (newTo < today) newStatus = 'overdue';
  else newStatus = 'active';

  const oldPrice   = r.price;
  r.fromDate       = newFrom;
  r.toDate         = newTo;
  r.status         = newStatus;
  r.price          = newPrice;
  r.amountPaid     = newPaid;
  r.debt           = Math.max(0, newPrice - newPaid);
  r.chargeableDays = chargeableDays;
  r.totalDays      = totalDays;
  r.notes          = document.getElementById('mgNotes').value.trim();
  r.returnedItems  = {
    phone: document.getElementById('mgPhone')?.checked  ?? false,
    sim:   document.getElementById('mgSIM')?.checked    ?? false,
    plug:  document.getElementById('mgPlug')?.checked   ?? false,
    cable: document.getElementById('mgCable')?.checked  ?? false,
  };
  r.equipmentGiven = {
    phone: document.getElementById('mgGivenPhone').checked,
    sim:   document.getElementById('mgGivenSIM').checked,
    plug:  document.getElementById('mgGivenPlug').checked,
    cable: document.getElementById('mgGivenCable').checked,
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
  saveRentals(rentals);
  renderRentalsTab();
  toast('Rental deleted.', 'warning');
}

async function deletePhone(id) {
  const p = phones.find(x => x.id === id);
  if (p && p.status === 'rented') { toast('Cannot delete a phone that is currently rented.', 'error'); return; }
  const confirmed = await window.api.confirmDelete('Delete this phone from inventory?');
  if (!confirmed) return;
  phones = phones.filter(x => x.id !== id);
  savePhones(phones);
  renderRentalsTab();
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
      <button class="btn btn-outline" id="btnExportCSV">Export CSV</button>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Customer Name</th>
            <th>Phone</th>
            <th>Active Services</th>
            <th>Total Paid</th>
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

function renderTableRows() {
  const tbody = document.getElementById('customersTableBody');
  if (!tbody) return;

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
    const otherServices = (c.services || []).filter(s => s.type !== 'rental');
    const services = [
      ...activeCustomerRentals.map(r => `<span class="badge badge-rental">Rental ${r.country === 'USA' ? '🇺🇸' : r.country === 'UK' ? '🇬🇧' : r.country === 'Israel' ? '🇮🇱' : '🌍'}</span>`),
      ...otherServices.map(s => `<span class="badge badge-${s.type}">${escHtml(s.label)}</span>`),
    ].join('');

    const customerDebt = rentals
      .filter(r => r.customerId === c.id)
      .reduce((sum, r) => sum + Math.max(0, (r.price || 0) - (r.amountPaid || 0)) + calcLateFeeDays(r), 0);
    const customerPaid = rentals
      .filter(r => r.customerId === c.id)
      .reduce((sum, r) => sum + (r.amountPaid || 0), 0);

    return `
    <tr class="${selected}" data-id="${c.id}">
      <td>
        <div class="customer-name">${escHtml(c.firstName)} ${escHtml(c.lastName)}</div>
        <div class="customer-email">${escHtml(c.email || '')}</div>
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
    document.getElementById('detailPanelContainer').innerHTML = '';
    document.querySelectorAll('tr.selected').forEach(r => r.classList.remove('selected'));
  } else {
    selectedId = id;
    renderDetailPanel(id);
    document.querySelectorAll('tr[data-id]').forEach(r => {
      r.classList.toggle('selected', r.dataset.id === id);
    });
  }
}

function renderDetailPanel(id) {
  const c = customers.find(x => x.id === id);
  if (!c) return;
  const container = document.getElementById('detailPanelContainer');
  if (!container) return;

  const initials = ((c.firstName || '?')[0] + (c.lastName || '?')[0]).toUpperCase();
  const since = c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : '—';
  const addr = c.address ? `· ${escHtml(c.address)}` : '';
  const wa = c.hasWhatsapp ? ' · 📲 WhatsApp' : '';

  const history = c.history || [];
  const totalPaid = c.totalPaid || 0;
  const totalDebt = rentals
    .filter(r => r.customerId === c.id)
    .reduce((sum, r) => sum + Math.max(0, (r.price || 0) - (r.amountPaid || 0)) + calcLateFeeDays(r), 0);
  const customerPaid = rentals
    .filter(r => r.customerId === c.id)
    .reduce((sum, r) => sum + (r.amountPaid || 0), 0);
  const cActiveRentals = rentals.filter(r => r.customerId === c.id && (r.status === 'active' || r.status === 'overdue'));
  const otherServices = (c.services || []).filter(s => s.type !== 'rental');
  const activeVNs = otherServices.filter(s => s.type === 'vn').length;

  const dotColor = { rental: 'dot-blue', vn: 'dot-purple', sim: 'dot-gold', payment: 'dot-green' };

  const historyHTML = history.length === 0
    ? `<div style="color:var(--muted);font-size:13px;padding:10px 0;">No history yet.</div>`
    : history.slice().reverse().map(h => `
        <div class="history-item">
          <div style="display:flex;align-items:center;flex:1;">
            <div class="history-dot ${dotColor[h.type] || 'dot-blue'}"></div>
            <div class="history-desc">${escHtml(h.desc)}</div>
          </div>
          <div class="history-date" style="margin:0 16px;">${h.date}</div>
          <div class="history-amount">£${h.amount}</div>
        </div>`).join('');

  const allActiveServices = [
    ...cActiveRentals.map(r => ({ type: 'rental', label: `Rental ${r.country === 'USA' ? '🇺🇸' : r.country === 'UK' ? '🇬🇧' : r.country === 'Israel' ? '🇮🇱' : '🌍'}` })),
    ...otherServices,
  ];
  const servicesHTML = allActiveServices.length === 0
    ? `<span style="color:var(--muted);font-size:13px;">No active services.</span>`
    : allActiveServices.map(s => `<span class="badge badge-${s.type}" style="font-size:12px;padding:5px 12px;">${escHtml(s.label)}</span>`).join('');

  container.innerHTML = `
    <div class="detail-panel" id="detailPanel">
      <div class="detail-header">
        <div class="avatar">${initials}</div>
        <div style="flex:1;">
          <div class="detail-name">${escHtml(c.firstName)} ${escHtml(c.lastName)}</div>
          <div class="detail-meta">${escHtml(c.phone || '—')} · ${escHtml(c.email || 'No email')} ${addr}${wa} · Since ${since}</div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-outline" style="font-size:12px;padding:6px 14px;" onclick="openEditModal('${c.id}')">✏️ Edit</button>
          <button class="btn btn-outline" style="font-size:12px;padding:6px 14px;" onclick="toggleDetail('${c.id}')">✕</button>
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
          <div class="detail-stat-value" style="color:#a78bfa;">${activeVNs}</div>
        </div>
      </div>

      <div class="section-divider">Active Services</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px;">${servicesHTML}</div>

      <div class="section-divider">Add Manual Payment</div>
      <div class="add-payment-row" id="paymentRow-${c.id}">
        <select id="payType-${c.id}">
          <option value="rental">📱 Rental</option>
          <option value="vn">🔢 Virtual Number</option>
          <option value="sim">💳 SIM Plan</option>
          <option value="payment">💰 Payment</option>
        </select>
        <input type="text" id="payDesc-${c.id}" placeholder="Description..." />
        <input type="number" id="payAmt-${c.id}" placeholder="£0" min="0" step="0.5" />
        <button class="btn btn-primary" style="font-size:12px;padding:7px 14px;" onclick="addPayment('${c.id}')">+ Add</button>
      </div>

      <div class="section-divider" style="margin-top:18px;">History</div>
      <div class="history-list" id="historyList-${c.id}">${historyHTML}</div>

      <div class="section-divider" style="margin-top:18px;">New Service</div>
      <div class="service-actions">
        <button class="btn btn-rental" style="font-size:13px;padding:7px 16px;" onclick="openNewRentalModal()">📱 New Rental</button>
        <button class="btn btn-vn" style="font-size:13px;padding:7px 16px;" onclick="toast('Virtual Numbers — coming soon!','warning')">🔢 New Virtual Number</button>
        <button class="btn btn-sim" style="font-size:13px;padding:7px 16px;" onclick="toast('SIM Plans — coming soon!','warning')">💳 New SIM Plan</button>
      </div>
    </div>`;

  setTimeout(() => container.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
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
  document.getElementById('fAddress').value = c.address || '';
  document.getElementById('fWhatsapp').checked = !!c.hasWhatsapp;
  showModal();
}

function clearModal() {
  ['fFirstName','fLastName','fPhoneNumber','fEmail','fAddress'].forEach(id => {
    const el = document.getElementById(id);
    el.value = '';
    el.classList.remove('error');
  });
  document.getElementById('fWhatsapp').checked = false;
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
  const firstName = document.getElementById('fFirstName').value.trim();
  const lastName  = document.getElementById('fLastName').value.trim();
  const phoneNum  = document.getElementById('fPhoneNumber').value.trim();
  const code      = document.getElementById('fCountryCode').value.replace('-CA', '');
  const email     = document.getElementById('fEmail').value.trim();
  const address   = document.getElementById('fAddress').value.trim();
  const hasWa     = document.getElementById('fWhatsapp').checked;
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

  const payload = { firstName, lastName, phone: fullPhone, email, address, hasWhatsapp: hasWa };

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
  const confirmed = await window.api.confirmDelete(`Delete "${c.firstName} ${c.lastName}"?\n\nThis cannot be undone.`);
  if (!confirmed) return;
  rentals.filter(r => r.customerId === id && r.status !== 'returned').forEach(r => {
    const phone = phones.find(p => p.id === r.phoneId);
    if (phone) { phone.status = 'available'; phone.currentRental = null; }
  });
  rentals = rentals.filter(r => r.customerId !== id);
  sims    = sims.filter(s => s.customerId !== id);
  savePhones(phones);
  saveRentals(rentals);
  saveSims(sims);
  await window.api.deleteCustomer(id);
  customers = customers.filter(x => x.id !== id);
  if (selectedId === id) {
    selectedId = null;
    const container = document.getElementById('detailPanelContainer');
    if (container) container.innerHTML = '';
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

function saveSims(data) {
  sims = data;
  window.api.saveAllSims(data);
}

let simSearchTerm = '';

function renderSimsTab() {
  const content  = document.getElementById('mainContent');
  const today    = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

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
      <input class="search-box" style="width:260px;" type="text" id="simSearch"
        placeholder="🔍 Search customer, number, provider..."
        value="${escHtml(simSearchTerm)}"
        oninput="simSearchTerm=this.value; renderSimRows()">
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
  const today    = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const term     = simSearchTerm.toLowerCase();

  const filtered = sims.filter(s =>
    !term ||
    (s.customerName || '').toLowerCase().includes(term) ||
    (s.simNumber    || '').toLowerCase().includes(term) ||
    (s.provider     || '').toLowerCase().includes(term) ||
    (s.iccid        || '').toLowerCase().includes(term)
  );

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

    return `<tr>
      <td><div class="customer-name">${escHtml(s.customerName || '—')}</div></td>
      <td>${escHtml(s.provider || '—')}</td>
      <td style="font-weight:600;font-size:12px;">${escHtml(s.simNumber || '—')}</td>
      <td style="font-size:12px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(s.plan || '—')}</td>
      <td style="font-size:12px;${renewalClass}">${fmtDate(s.renewalDate)}${renewalLabel}</td>
      <td style="font-size:12px;">${s.paymentType === 'direct' ? '👤 Direct' : '🔄 Through me'}</td>
      <td>${statusBadge}</td>
      <td>
        <div class="row-actions">
          <button class="action-btn" onclick="openManageSimModal('${s.id}')">⚙ Manage</button>
          <button class="action-btn danger" onclick="deleteSim('${s.id}')">Delete</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function openAddSimModal() { openSimFormModal(null); }
function openEditSimModal(id) { openSimFormModal(id); }

function openSimFormModal(id) {
  const s = id ? sims.find(x => x.id === id) : null;
  const isEdit = !!s;

  const customerOptions = customers.map(c =>
    `<option value="${c.id}" ${s && s.customerId === c.id ? 'selected' : ''}>${escHtml(c.firstName + ' ' + c.lastName)}</option>`
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
      <div class="form-group">
        <label class="form-label">Password at Provider</label>
        <div class="password-wrap">
          <input class="form-input" id="simPassword" type="password" placeholder="Password"
            value="${escHtml(s?.password || '')}" autocomplete="off">
          <button class="pw-toggle" type="button" id="simPwBtn" onclick="toggleSimPassword()">👁</button>
        </div>
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
        <select class="form-input" id="simPayment">
          <option value="through-me" ${!s || s.paymentType === 'through-me' ? 'selected' : ''}>🔄 Through me</option>
          <option value="direct" ${s?.paymentType === 'direct' ? 'selected' : ''}>👤 Customer pays directly</option>
        </select>
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

function toggleSimPassword() {
  const inp = document.getElementById('simPassword');
  const btn = document.getElementById('simPwBtn');
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.textContent = inp.type === 'password' ? '👁' : '🙈';
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
  const fields = {
    customerId,
    customerName: customer ? `${customer.firstName} ${customer.lastName}` : '',
    provider,
    simNumber:   document.getElementById('simNumber').value.trim(),
    iccid:       document.getElementById('simIccid').value.trim(),
    email:       document.getElementById('simEmail').value.trim(),
    password:    document.getElementById('simPassword').value,
    plan:        document.getElementById('simPlan').value.trim(),
    renewalDate: document.getElementById('simRenewal').value,
    paymentType: document.getElementById('simPayment').value,
    status:      document.getElementById('simStatus').value,
  };

  if (editId) {
    const idx = sims.findIndex(s => s.id === editId);
    if (idx !== -1) sims[idx] = { ...sims[idx], ...fields };
  } else {
    sims.push({ id: Date.now().toString(), ...fields, history: [], createdAt: new Date().toISOString() });
  }

  saveSims(sims);
  closeDynamicModal();
  toast(editId ? 'SIM plan updated ✅' : 'SIM plan added ✅', 'success');
  renderSimsTab();
}

function openManageSimModal(id) {
  const s = sims.find(x => x.id === id);
  if (!s) return;
  const history = s.history || [];
  const totalCharged = history.reduce((sum, h) => sum + (h.amount || 0), 0);
  const pwMasked = s.password ? '••••••••' : '—';

  const historyHtml = history.length === 0
    ? `<div style="color:var(--muted);font-size:13px;padding:10px 0;">No history yet.</div>`
    : history.slice().reverse().map(h => `
        <div class="history-item">
          <span class="history-dot dot-blue"></span>
          <span class="history-desc">${escHtml(h.desc)}</span>
          <span class="history-date">${h.date}</span>
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
      <div style="color:var(--muted);">Password</div>
      <div style="display:flex;align-items:center;gap:6px;">
        <span id="mgSimPwText" style="font-size:13px;">${pwMasked}</span>
        ${s.password ? `<button class="pw-toggle" style="position:static;" onclick="toggleMgSimPw('${escHtml(s.password.replace(/'/g,"\\'"))||''}')">👁</button>` : ''}
      </div>
      <div style="color:var(--muted);">Plan</div><div>${escHtml(s.plan||'—')}</div>
      <div style="color:var(--muted);">Renewal</div><div>${fmtDate(s.renewalDate)}</div>
      <div style="color:var(--muted);">Payment</div><div>${s.paymentType === 'direct' ? '👤 Direct' : '🔄 Through me'}</div>
      <div style="color:var(--muted);">Status</div><div>${s.status}</div>
    </div>

    <div class="section-divider">Service History</div>
    <div class="history-list" id="simHistoryList">${historyHtml}</div>

    <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:16px;">
      <div class="section-divider" style="margin-top:0;">Add Charge</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;">
        <div style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:160px;">
          <label style="font-size:11px;color:var(--muted);font-weight:600;">Type</label>
          <select class="form-input" id="simChargeType" onchange="onSimChargeTypeChange()" style="font-size:13px;">
            <option value="activation">🟢 Initial Activation — £20</option>
            <option value="service">🔧 Service (roaming/swap/reactivation) — £5</option>
            <option value="sim-replacement">📦 SIM Replacement — £10</option>
            <option value="monthly">📅 Monthly Subscription — £2</option>
            <option value="annual">📅 Annual Subscription — £20</option>
            <option value="custom">✏️ Custom</option>
          </select>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;width:80px;">
          <label style="font-size:11px;color:var(--muted);font-weight:600;">Amount £</label>
          <input class="form-input" id="simChargeAmount" type="number" value="20" min="0" step="0.5" style="font-size:13px;">
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

const SIM_CHARGE_PRICES = { activation: 20, service: 5, 'sim-replacement': 10, monthly: 2, annual: 20 };
const SIM_CHARGE_DESCS  = {
  activation: 'Initial SIM Activation',
  service: 'Service (roaming / swap / reactivation)',
  'sim-replacement': 'SIM Replacement',
  monthly: 'Monthly Subscription',
  annual: 'Annual Subscription',
};

function onSimChargeTypeChange() {
  const type  = document.getElementById('simChargeType').value;
  const amtEl = document.getElementById('simChargeAmount');
  if (SIM_CHARGE_PRICES[type] !== undefined) amtEl.value = SIM_CHARGE_PRICES[type];
}

function toggleMgSimPw(pw) {
  const el = document.getElementById('mgSimPwText');
  if (!el) return;
  el.textContent = el.textContent === '••••••••' ? pw : '••••••••';
}

function addSimCharge(simId) {
  const s = sims.find(x => x.id === simId);
  if (!s) return;
  const type   = document.getElementById('simChargeType').value;
  const amount = parseFloat(document.getElementById('simChargeAmount').value) || 0;
  const note   = document.getElementById('simChargeNote').value.trim();
  const desc   = note ? `${SIM_CHARGE_DESCS[type] || 'Custom'} — ${note}` : (SIM_CHARGE_DESCS[type] || 'Custom charge');
  if (!s.history) s.history = [];
  s.history.push({
    id:     Date.now().toString(),
    type, desc, amount,
    date: new Date().toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }),
  });
  saveSims(sims);
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
  saveSims(sims);
  toast('SIM plan deleted.', 'warning');
  renderSimsTab();
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

function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ─────────────────────────────────────────────
//  START
// ─────────────────────────────────────────────
initApp();
