/**
 * Kosher Connect — Operator Console (web app) server bridge.
 *
 * Read-only server functions called from the HtmlService React front end via
 * google.script.run. Additive only: this file never writes the Ledger, computes
 * balances, or touches RentalEngine / the charge sweep / triggers. Any future
 * write screen must go through the existing server functions (appendLedgerEntry
 * et al., under LockService) — never write money state from here directly.
 *
 * doGet (the HtmlService entry that serves index.html) lives in Dashboard.js,
 * which already owned the project's single doGet.
 */

/**
 * List Customers rows for the console's Customers screen. Returns an array of
 * plain JSON-able objects (google.script.run serialises the return value).
 * Columns addressed by header name; dates stringified to stay JSON-safe.
 */
function getCustomersForConsole() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Customers');
  if (!sheet) return [];
  var last = sheet.getLastRow();
  if (last < 2) return [];

  var idx = headerIndex_(sheet);
  var rows = sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).getValues();
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var id = r[idx['CustomerID']];
    if (id === '' || id === null || typeof id === 'undefined') continue; // skip blank rows
    out.push({
      customerId: id,
      name: String(r[idx['Name']] || ''),
      phone: String(r[idx['Phone']] || ''),
      email: String(r[idx['Email']] || ''),
      city: idx.hasOwnProperty('City') ? String(r[idx['City']] || '') : '',
      createdAt: (idx.hasOwnProperty('CreatedAt') && r[idx['CreatedAt']])
        ? String(r[idx['CreatedAt']]) : ''
    });
  }
  return out;
}

/**
 * List Rentals rows for the console's Rentals screen. Read-only. Status is the
 * ENGINE-derived value (rentalDerivedStatus_ from RentalEngine.js — dates +
 * IsLost), computed server-side here, never in the front end. PriceCalc / LateFee
 * / Total / ChargeableDays are returned exactly as the charge sweep wrote them
 * (blank stays blank); this function computes/writes no money or Status.
 */
function getRentalsForConsole() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Rentals');
  if (!sheet) return [];
  var last = sheet.getLastRow();
  if (last < 2) return [];

  var idx = headerIndex_(sheet);
  var rows = sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).getValues();
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var id = r[idx['RentalID']];
    if (id === '' || id === null || typeof id === 'undefined') continue; // skip blank rows
    var status = rentalDerivedStatus_(r, idx);        // engine-derived, server-side

    // Standalone-refund eligibility, so a voided rental can be refunded LATER
    // (not only in the immediate post-void prompt). Computed for Cancelled rows
    // ONLY (bounded cost), reusing the same Ledger netting + the RENTAL-VOID-<id>
    // idempotency guard. refundable flips to false once a refund is posted.
    var refundable = false, netCharged = '';
    if (status === 'Cancelled') {
      var sum = rentalChargeSummary_(id);
      if (sum.charged && sum.netCharged > 0 && !ledgerHasReference_('RENTAL-VOID-' + id)) {
        refundable = true;
        netCharged = sum.netCharged;
      }
    }

    // Lost-but-loss-fee-not-yet-posted (e.g. IsLost set directly in AppSheet, or a
    // rate was missing) → the console offers a "Charge loss fee" remedy. Bounded to
    // Lost rows. Cancelled wins over Lost in rentalDerivedStatus_, so no overlap.
    var lossFeePending = (status === 'Lost') && !ledgerHasReference_('RENTAL-LOSS-' + id);

    out.push({
      rentalId: id,
      customerId: r[idx['CustomerID']],
      country: String(r[idx['Country']] || ''),
      phoneId: r[idx['PhoneID']],
      startDate: wcFmtDate_(r[idx['StartDate']]),
      returnDueDate: wcFmtDate_(r[idx['ReturnDueDate']]),
      actualReturnDate: wcFmtDate_(r[idx['ActualReturnDate']]),
      status: status,
      chargeableDays: wcNum_(r[idx['ChargeableDays']]),
      priceCalc: wcNum_(r[idx['PriceCalc']]),         // straight from the sheet (sweep output)
      lateFee: wcNum_(r[idx['LateFee']]),
      total: wcNum_(r[idx['Total']]),
      refundable: refundable,
      netCharged: netCharged,
      lossFeePending: lossFeePending,
      discountType: idx.hasOwnProperty('DiscountType') ? String(r[idx['DiscountType']] || '') : '',
      discountValue: idx.hasOwnProperty('DiscountValue') ? wcNum_(r[idx['DiscountValue']]) : ''
    });
  }
  return out;
}

/**
 * List Ledger rows for the console's Ledger screen. READ-ONLY. The Ledger is
 * append-only and the financial source of truth — this function only reads it;
 * it never writes, edits, or re-signs a row. Amount is returned exactly as
 * stored (charges are negative). Sorting/running-totals are display concerns
 * handled in the front end; the authoritative balance stays the Ledger-derived
 * one (sum of Amount, computed by AppSheet / getWalletBalance).
 */
function getLedgerForConsole() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Ledger');
  if (!sheet) return [];
  var last = sheet.getLastRow();
  if (last < 2) return [];

  var idx = headerIndex_(sheet);
  var rows = sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).getValues();
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var id = r[idx['EntryID']];
    if (id === '' || id === null || typeof id === 'undefined') continue; // skip blank rows
    out.push({
      entryId: id,
      customerId: r[idx['CustomerID']],
      type: String(r[idx['Type']] || ''),
      amount: wcNum_(r[idx['Amount']]),     // stored signed; charges negative
      method: String(r[idx['Method']] || ''),
      reference: String(r[idx['Reference']] || ''),
      memo: String(r[idx['Memo']] || ''),
      at: wcFmtDate_(r[idx['At']])
    });
  }
  return out;
}

/**
 * List Phones rows. Read-only. `status` is the intrinsic Phones.Status
 * (Available/Rented/Pool-Active/In-Repair/Lost) straight from the sheet.
 * `bookingState` is derived live from active/future Rentals on that phone
 * (read-only, via the engine's rentalDerivedStatus_): 'Rented now',
 * 'Reserved (future)', or 'Available'. No writes, no Status mutation.
 */
function getPhonesForConsole() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Phones');
  if (!sheet) return [];
  var last = sheet.getLastRow();
  if (last < 2) return [];

  var idx = headerIndex_(sheet);
  var rows = sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).getValues();
  var booking = phoneBookingStateMap_(ss);

  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var id = r[idx['PhoneID']];
    if (id === '' || id === null || typeof id === 'undefined') continue;
    out.push({
      phoneId: id,
      make: String(r[idx['Make']] || ''),
      model: String(r[idx['Model']] || ''),
      imei: String(r[idx['IMEI']] || ''),
      serial: String(r[idx['Serial']] || ''),
      poolId: idx.hasOwnProperty('PoolID') ? r[idx['PoolID']] : '',
      status: String(r[idx['Status']] || ''),
      condition: idx.hasOwnProperty('Condition') ? String(r[idx['Condition']] || '') : '',
      bookingState: booking[String(id)] || 'Available'
    });
  }
  return out;
}

/** PhoneID -> live booking state from active/future Rentals. Read-only. */
function phoneBookingStateMap_(ss) {
  var map = {};
  var rentals = ss.getSheetByName('Rentals');
  if (!rentals) return map;
  var last = rentals.getLastRow();
  if (last < 2) return map;
  var idx = headerIndex_(rentals);
  var rows = rentals.getRange(2, 1, last - 1, rentals.getLastColumn()).getValues();
  for (var i = 0; i < rows.length; i++) {
    var phoneId = rows[i][idx['PhoneID']];
    if (phoneId === '' || phoneId === null) continue;
    var st = rentalDerivedStatus_(rows[i], idx); // Out/Overdue/Booked/Returned/Lost
    var key = String(phoneId);
    if (st === 'Out' || st === 'Overdue') map[key] = 'Rented now';            // active wins
    else if (st === 'Booked' && map[key] !== 'Rented now') map[key] = 'Reserved (future)';
  }
  return map;
}

/**
 * List Tasks rows. Read-only. Surfaces the RATEMISSING / OVERDUE / BALANCE tasks
 * the engine raises. Sorting/flagging are display concerns in the front end.
 */
function getTasksForConsole() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tasks');
  if (!sheet) return [];
  var last = sheet.getLastRow();
  if (last < 2) return [];

  var idx = headerIndex_(sheet);
  var rows = sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).getValues();
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var id = r[idx['TaskID']];
    if (id === '' || id === null || typeof id === 'undefined') continue;
    out.push({
      taskId: id,
      title: String(r[idx['Title']] || ''),
      dueDate: wcFmtDate_(r[idx['DueDate']]),
      source: String(r[idx['Source']] || ''),
      priority: String(r[idx['Priority']] || ''),
      done: String(r[idx['Done']] || ''),
      reference: idx.hasOwnProperty('Reference') ? String(r[idx['Reference']] || '') : '',
      createdAt: wcFmtDate_(r[idx['CreatedAt']])
    });
  }
  return out;
}

/** List SIMs rows (identity + status). Read-only. */
function getSIMsForConsole() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('SIMs');
  if (!sheet) return [];
  var last = sheet.getLastRow();
  if (last < 2) return [];

  var idx = headerIndex_(sheet);
  var rows = sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).getValues();
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var id = r[idx['SIMID']];
    if (id === '' || id === null || typeof id === 'undefined') continue;
    out.push({
      simId: id,
      customerId: r[idx['CustomerID']],
      provider: String(r[idx['Provider']] || ''),
      alias: String(r[idx['Alias']] || ''),
      status: String(r[idx['Status']] || ''),
      renewalCycleDays: wcNum_(r[idx['RenewalCycleDays']]),
      nextRenewalDate: wcFmtDate_(r[idx['NextRenewalDate']]),
      paidBy: String(r[idx['PaidBy']] || ''),
      feeApplied: wcNum_(r[idx['FeeApplied']]),
      tier: idx.hasOwnProperty('Tier') ? String(r[idx['Tier']] || '') : '',
      billingOption: idx.hasOwnProperty('BillingOption') ? String(r[idx['BillingOption']] || '') : '',
      replacementsUsed: idx.hasOwnProperty('ReplacementsUsed') ? wcNum_(r[idx['ReplacementsUsed']]) : ''
    });
  }
  return out;
}

/** Format a sheet date cell as YYYY-MM-DD (script timezone), '' if blank/invalid. */
function wcFmtDate_(v) {
  if (v === '' || v === null || typeof v === 'undefined') return '';
  var d = (v instanceof Date) ? v : new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/** Return a numeric cell as a Number, or '' if blank/non-numeric (no computation). */
function wcNum_(v) {
  if (v === '' || v === null || typeof v === 'undefined') return '';
  var n = Number(v);
  return isNaN(n) ? '' : n;
}

/* ============================================================
 * CONSOLE WRITES (validated, server-side, under LockService)
 * ============================================================ */

/**
 * Create a Customer from the operator console — the ONLY console write path for
 * Customers. Written fresh and minimal; does NOT use the dead addCustomer /
 * checkDuplicate. Validates server-side, then dedupe + MAX+1 id + append run as
 * ONE atomic critical section under a script lock. Writes ONLY the Customers
 * sheet — no money / engine / Ledger / Status. NormalisedEmail is left blank
 * (AppSheet's App formula owns that column). Returns {ok:true, customer} or
 * {ok:false, error:'…'} with no write on any failure.
 *
 * payload: { name, phone, email?, city?, address?, notes? }
 */
function addCustomerFromConsole(payload) {
  payload = payload || {};
  var name = String(payload.name || '').trim();
  var phone = String(payload.phone || '').trim();
  var email = String(payload.email || '').trim();
  var city = String(payload.city || '').trim();
  var address = String(payload.address || '').trim();
  var notes = String(payload.notes || '').trim();

  // ---- validation (before any write / lock) ----
  if (!name) return { ok: false, error: 'Name is required.' };
  if (!phone) return { ok: false, error: 'Phone is required.' };
  var phoneKey = wcNormPhone_(phone);
  if (phoneKey.length < 9) {
    return { ok: false, error: 'Phone is too short — needs ≥ 9 digits (matches the AppSheet Phone rule).' };
  }
  var emailKey = email.toLowerCase(); // LOWER(TRIM); '' when email omitted
  if (emailKey && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailKey)) {
    return { ok: false, error: 'Email address looks invalid.' };
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    return { ok: false, error: 'Console is busy — please try again.' };
  }
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Customers');
    if (!sheet) return { ok: false, error: 'Customers tab not found.' };
    var idx = headerIndex_(sheet);
    var last = sheet.getLastRow();

    // ---- dedupe inside the lock: email when present, else normalised phone ----
    if (last >= 2) {
      var data = sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).getValues();
      for (var i = 0; i < data.length; i++) {
        var rid = data[i][idx['CustomerID']];
        if (emailKey) {
          var rEmail = String(data[i][idx['Email']] || '').trim().toLowerCase();
          if (rEmail && rEmail === emailKey) {
            return { ok: false, error: 'A customer with this email already exists — CustomerID ' + rid + '.' };
          }
        } else {
          var rPhone = wcNormPhone_(data[i][idx['Phone']]);
          if (rPhone && rPhone === phoneKey) {
            return { ok: false, error: 'A customer with this phone already exists — CustomerID ' + rid + '.' };
          }
        }
      }
    }

    // ---- id + append inside the lock (same MAX+1 the rest of the project uses) ----
    var newId = nextIdInColumnA_(sheet);
    var width = sheet.getLastColumn();
    var row = new Array(width).fill('');
    row[idx['CustomerID']] = newId;
    row[idx['Name']] = name;
    row[idx['Phone']] = phone;
    if (idx.hasOwnProperty('Email')) row[idx['Email']] = email;
    if (idx.hasOwnProperty('City')) row[idx['City']] = city;
    if (idx.hasOwnProperty('Address')) row[idx['Address']] = address;
    if (idx.hasOwnProperty('Notes')) row[idx['Notes']] = notes;
    // NormalisedEmail: intentionally left blank — AppSheet's App formula owns it.
    if (idx.hasOwnProperty('CreatedAt')) row[idx['CreatedAt']] = new Date();
    if (idx.hasOwnProperty('CreatedBy')) row[idx['CreatedBy']] = activeUserOrSystem_();

    sheet.getRange(sheet.getLastRow() + 1, 1, 1, width).setValues([row]);

    return {
      ok: true,
      customer: {
        customerId: newId, name: name, phone: phone, email: email,
        city: city,
        createdAt: (idx.hasOwnProperty('CreatedAt')) ? String(row[idx['CreatedAt']]) : ''
      }
    };
  } finally {
    lock.releaseLock();
  }
}

/** Normalise a phone for dedupe, matching the Customers.Phone Valid_If exactly:
 *  strip space + - ( ) . (the same SUBSTITUTE set AppSheet uses). */
function wcNormPhone_(p) {
  return String(p === null || typeof p === 'undefined' ? '' : p).replace(/[ +\-().]/g, '');
}

/* ---- New Rental: pure helpers (no sheet access — unit-testable) ---- */

var WC_RENTAL_COUNTRIES = ['USA', 'UK-UKmins', 'UK-Intl', 'Israel', 'Canada'];
var WC_VN_OPTIONS = ['None', 'Weekly', '30-day'];

/** Coerce a date input (yyyy-mm-dd string or Date) to a midnight Date, or null. */
function wcDateVal_(v) {
  if (v instanceof Date) {
    return isNaN(v.getTime()) ? null : new Date(v.getFullYear(), v.getMonth(), v.getDate());
  }
  if (v === '' || v === null || typeof v === 'undefined') return null;
  var s = String(v).trim();
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);     // ISO from <input type=date>
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  var d = new Date(s);
  return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** yyyy-mm-dd string for a Date (pure; no Utilities). */
function wcYmd_(d) {
  if (!d) return '';
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}

/** True if an [IsLost] cell is truthy (mirrors rentalIsLost_; local to keep this pure). */
function wcIsLost_(v) {
  if (v === true) return true;
  var s = String(v).trim().toLowerCase();
  return s === 'true' || s === 'yes' || s === 'y';
}

/** Shape/format validation for a rental payload (no sheet access). '' = valid. */
function rentalPayloadError_(p) {
  if (!p) return 'Missing payload.';
  if (WC_RENTAL_COUNTRIES.indexOf(String(p.country || '').trim()) < 0) {
    return 'Country is required and must be one of: ' + WC_RENTAL_COUNTRIES.join(', ') + '.';
  }
  var start = wcDateVal_(p.startDate);
  var due = wcDateVal_(p.returnDueDate);
  if (!start) return 'Start date is required.';
  if (!due) return 'Return due date is required.';
  if (due.getTime() < start.getTime()) return 'Return due date must be on or after the start date.';
  if (p.virtualNumber && WC_VN_OPTIONS.indexOf(String(p.virtualNumber)) < 0) {
    return 'Virtual number option is invalid.';
  }
  return '';
}

/**
 * Phone availability for a window. PURE: takes the phone's intrinsic Status and
 * the existing rentals on that phone as plain data. Returns an error string, or
 * '' if the phone is free. A still-out rental occupies [start, max(due, today)],
 * so an out-and-overdue phone keeps blocking. existing items:
 *   { rentalId, start:Date|null, due:Date|null, returned:bool, lost:bool }
 */
function phoneAvailabilityError_(phoneStatus, start, due, existing, today) {
  var st = String(phoneStatus || '').trim();
  if (st === 'In-Repair' || st === 'Lost') return 'Phone is ' + st + ' and cannot be rented.';
  for (var i = 0; i < existing.length; i++) {
    var e = existing[i];
    if (e.returned || e.lost) continue;            // came back / written off → not occupying
    if (!e.start || !e.due) continue;
    var exEnd = (e.due.getTime() > today.getTime()) ? e.due : today;   // max(due, today)
    if (start.getTime() <= exEnd.getTime() && e.start.getTime() <= due.getTime()) {
      return 'Phone is already booked for that window by RentalID ' + e.rentalId +
        ' (' + wcYmd_(e.start) + ' → ' + wcYmd_(e.due) + ').';
    }
  }
  return '';
}

/* ---- New Rental: server write ---- */

/**
 * Create a Rental from the operator console. Writes Rentals ONLY — a clean row
 * with NO price / ChargeableDays / Status / money (the charge sweep + AppSheet
 * own those). Server is the authoritative gate (AppSheet has no PhoneID Valid_If):
 * validates references + the period-overlap double-booking gate, then MAX+1 id +
 * append, all in one LockService critical section. Does NOT touch Phones.Status
 * or call bookRental. Returns {ok, rental, willChargeSoon, warning} or {ok:false,error}.
 *
 * payload: { customerId, country, phoneId, startDate, returnDueDate, virtualNumber? }
 */
function addRentalFromConsole(payload) {
  payload = payload || {};
  var perr = rentalPayloadError_(payload);
  if (perr) return { ok: false, error: perr };

  var country = String(payload.country).trim();
  var start = wcDateVal_(payload.startDate);
  var due = wcDateVal_(payload.returnDueDate);
  var vn = payload.virtualNumber ? String(payload.virtualNumber) : 'None';

  if (payload.customerId === '' || payload.customerId === null || typeof payload.customerId === 'undefined') {
    return { ok: false, error: 'CustomerID is required.' };
  }
  if (payload.phoneId === '' || payload.phoneId === null || typeof payload.phoneId === 'undefined') {
    return { ok: false, error: 'PhoneID is required.' };
  }
  // Form selects send strings; sheet CustomerID/PhoneID are numeric and
  // findRowById_ compares with === — so coerce to Number for the reference lookups
  // and store the numeric id on the row.
  var customerId = Number(payload.customerId);
  var phoneId = Number(payload.phoneId);
  if (isNaN(customerId)) return { ok: false, error: 'CustomerID must be numeric.' };
  if (isNaN(phoneId)) return { ok: false, error: 'PhoneID must be numeric.' };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); }
  catch (e) { return { ok: false, error: 'Console is busy — please try again.' }; }
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var custSheet = ss.getSheetByName('Customers');
    var phonesSheet = ss.getSheetByName('Phones');
    var rentalsSheet = ss.getSheetByName('Rentals');
    if (!custSheet || !phonesSheet || !rentalsSheet) {
      return { ok: false, error: 'A required tab (Customers/Phones/Rentals) is missing.' };
    }

    // references
    if (!findRowById_(custSheet, customerId)) {
      return { ok: false, error: 'CustomerID ' + customerId + ' does not exist.' };
    }
    var phone = findRowById_(phonesSheet, phoneId);
    if (!phone) return { ok: false, error: 'PhoneID ' + phoneId + ' does not exist.' };
    var pidx = headerIndex_(phonesSheet);
    var phoneStatus = String(phone.values[pidx['Status']] || '').trim();

    // overlap gate
    var today = wcDateVal_(new Date());
    var existing = phoneRentalsFor_(rentalsSheet, phoneId);
    var oerr = phoneAvailabilityError_(phoneStatus, start, due, existing, today);
    if (oerr) return { ok: false, error: oerr };

    // id + append (clean row — no price/Status/money)
    var ridx = headerIndex_(rentalsSheet);
    var width = rentalsSheet.getLastColumn();
    var newId = nextIdInColumnA_(rentalsSheet);
    var row = new Array(width).fill('');
    row[ridx['RentalID']] = newId;
    row[ridx['CustomerID']] = customerId;
    row[ridx['Country']] = country;
    row[ridx['PhoneID']] = phoneId;
    row[ridx['StartDate']] = start;
    row[ridx['ReturnDueDate']] = due;
    if (ridx.hasOwnProperty('VirtualNumber')) row[ridx['VirtualNumber']] = vn;
    rentalsSheet.getRange(rentalsSheet.getLastRow() + 1, 1, 1, width).setValues([row]);

    var willCharge = start.getTime() <= today.getTime();
    return {
      ok: true,
      rental: {
        rentalId: newId, customerId: customerId, country: country, phoneId: phoneId,
        startDate: wcYmd_(start), returnDueDate: wcYmd_(due), virtualNumber: vn
      },
      willChargeSoon: willCharge,
      warning: willCharge
        ? 'This rental starts today or earlier — the charge sweep will price it and post a real Ledger charge within ~5 minutes.'
        : ''
    };
  } finally {
    lock.releaseLock();
  }
}

/** Existing rentals on a phone, as plain overlap data (called inside the lock). */
function phoneRentalsFor_(rentalsSheet, phoneId) {
  var out = [];
  var last = rentalsSheet.getLastRow();
  if (last < 2) return out;
  var idx = headerIndex_(rentalsSheet);
  var rows = rentalsSheet.getRange(2, 1, last - 1, rentalsSheet.getLastColumn()).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][idx['PhoneID']]) !== String(phoneId)) continue;
    out.push({
      rentalId: rows[i][idx['RentalID']],
      start: wcDateVal_(rows[i][idx['StartDate']]),
      due: wcDateVal_(rows[i][idx['ReturnDueDate']]),
      returned: !!wcDateVal_(rows[i][idx['ActualReturnDate']]),
      lost: idx.hasOwnProperty('IsLost') ? wcIsLost_(rows[i][idx['IsLost']]) : false
    });
  }
  return out;
}

/* ============================================================
 * SETTINGS (PRICING) EDITOR — validated, server-side, edit-only
 * ============================================================
 * Edits EXISTING Settings keys in place. Never adds, renames, or removes a key
 * (that prevents a typo'd key silently breaking pricing). Every money-driving
 * value flows through updateSettingFromConsole, which validates by the key's
 * declared type, writes ONLY the Value cell under LockService, and never touches
 * the Key cell. The front end may not write Settings directly.
 *
 * Type determination is a server-owned HARDCODED rule table (settingRuleFor_):
 * *Percent and *Period matchers are tested BEFORE the generic money fallbacks,
 * so a percent/period key can never fall through to "money". A key matching NO
 * rule is reported editable:false and can never be written.
 */

var WC_SETTING_COUNTRIES = ['USA', 'UKUKmins', 'UKIntl', 'Israel', 'Canada'];

/** Country token -> human label for the Pricing screen. */
function wcCountryLabel_(c) {
  if (c === 'UKUKmins') return 'UK (UK mins)';
  if (c === 'UKIntl') return 'UK (Intl)';
  return c; // USA, Israel, Canada
}

/** Human label from a Settings key (drops the category prefix, de-camel-cases,
 *  strips a redundant trailing "Percent" since the unit chip already shows %). */
function wcSettingNiceLabel_(key) {
  var s = String(key || '').replace(/^[A-Za-z]+_/, '');   // drop first prefix segment
  s = s.replace(/Percent$/, '');                            // unit chip shows %
  s = s.replace(/([a-z0-9])([A-Z])/g, '$1 $2');             // camelCase -> spaces
  s = s.replace(/_/g, ' ').trim();
  return s || String(key || '');
}

/**
 * The hardcoded type rule for a Settings key, or null if it is not editable from
 * the console. Returns { type, unit, label, category, country?, integer, min, max }.
 * type is one of 'money' | 'percent' | 'days'. ORDER MATTERS: the *Period and
 * *Percent matchers precede the money matchers within each family, so a
 * discriminating suffix always wins over the generic money rule. Pure — no sheet
 * access — so it is unit-testable.
 */
function settingRuleFor_(key) {
  var k = String(key || '').trim();
  if (!k) return null;
  var m;

  // --- Rentals (per country). Cap PERIOD (days) tested before the £ rules. ---
  m = k.match(/^RentalCapPeriod_(.+)$/);
  if (m && WC_SETTING_COUNTRIES.indexOf(m[1]) >= 0) {
    return { type: 'days', unit: 'days', label: 'Cap period', category: 'Rentals', country: m[1], integer: true, min: 1, max: null };
  }
  m = k.match(/^RentalRate_(.+)$/);
  if (m && WC_SETTING_COUNTRIES.indexOf(m[1]) >= 0) {
    return { type: 'money', unit: '£/day', label: 'Rate', category: 'Rentals', country: m[1], integer: false, min: 0, max: null };
  }
  m = k.match(/^RentalMin_(.+)$/);
  if (m && WC_SETTING_COUNTRIES.indexOf(m[1]) >= 0) {
    return { type: 'money', unit: '£', label: 'Min', category: 'Rentals', country: m[1], integer: false, min: 0, max: null };
  }
  m = k.match(/^RentalCap_(.+)$/);
  if (m && WC_SETTING_COUNTRIES.indexOf(m[1]) >= 0) {
    return { type: 'money', unit: '£', label: 'Cap', category: 'Rentals', country: m[1], integer: false, min: 0, max: null };
  }

  // --- Virtual numbers ---
  if (k === 'VN_Weekly') return { type: 'money', unit: '£/week', label: 'Weekly', category: 'Virtual Numbers', integer: false, min: 0, max: null };
  if (k === 'VN_30day')  return { type: 'money', unit: '£/30 days', label: '30-day', category: 'Virtual Numbers', integer: false, min: 0, max: null };

  // --- Late return + damage ---
  if (k === 'LateReturn_PerDay') return { type: 'money', unit: '£/day', label: 'Late return per day', category: 'Late / Damage', integer: false, min: 0, max: null };
  if (/^Damage_/.test(k)) return { type: 'money', unit: '£', label: wcSettingNiceLabel_(k), category: 'Late / Damage', integer: false, min: 0, max: null };

  // --- SIM fees (Percent before money) ---
  if (/^SIM_/.test(k) && /Percent$/.test(k)) return { type: 'percent', unit: '%', label: wcSettingNiceLabel_(k), category: 'SIM fees', integer: false, min: 0, max: 100 };
  if (/^SIM_/.test(k)) return { type: 'money', unit: '£', label: wcSettingNiceLabel_(k), category: 'SIM fees', integer: false, min: 0, max: null };

  // --- Online services ---
  if (k === 'OnlineServices_HourlyRate') return { type: 'money', unit: '£/hr', label: 'Hourly rate', category: 'Online services', integer: false, min: 0, max: null };
  if (/^OnlineServices_/.test(k)) return { type: 'money', unit: '£', label: wcSettingNiceLabel_(k), category: 'Online services', integer: false, min: 0, max: null };

  // --- Collect-later (Percent before money) ---
  if (/^CollectLater_/.test(k) && /Percent$/.test(k)) return { type: 'percent', unit: '%', label: wcSettingNiceLabel_(k), category: 'Collect-later', integer: false, min: 0, max: 100 };
  if (/^CollectLater_/.test(k)) return { type: 'money', unit: '£', label: wcSettingNiceLabel_(k), category: 'Collect-later', integer: false, min: 0, max: null };

  return null; // not editable from the console
}

/**
 * Validate a raw value against a rule. Pure (no sheet access). Returns
 * { ok:true, value:<Number> } or { ok:false, error:'…' }. Rejects blank,
 * non-numeric, NaN/Infinity, and negatives for every type; 'days' additionally
 * requires a positive integer; 'percent' must be 0–100.
 */
function validateSettingValue_(rule, raw) {
  if (!rule) return { ok: false, error: 'This key is not editable from the console.' };
  if (raw === null || typeof raw === 'undefined') return { ok: false, error: 'Value is required.' };
  if (typeof raw === 'string' && raw.trim() === '') return { ok: false, error: 'Value is required.' };
  if (raw === '') return { ok: false, error: 'Value is required.' };
  var n = Number(raw);
  if (isNaN(n) || !isFinite(n)) return { ok: false, error: 'Value must be a number.' };
  if (rule.type === 'days') {
    if (!Number.isInteger(n)) return { ok: false, error: 'Must be a whole number of days.' };
    if (n < 1) return { ok: false, error: 'Must be at least 1 day.' };
  } else if (rule.type === 'percent') {
    if (n < 0 || n > 100) return { ok: false, error: 'Percent must be between 0 and 100.' };
  } else { // money
    if (n < 0) return { ok: false, error: 'Amount cannot be negative.' };
  }
  return { ok: true, value: n };
}

/** Find a numeric Settings value in already-read rows, or null. */
function wcSettingNumberFromRows_(rows, idx, key) {
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][idx['Key']] || '').trim() === key) {
      var n = Number(rows[i][idx['Value']]);
      return isNaN(n) ? null : n;
    }
  }
  return null;
}

/**
 * Read every Settings row for the Pricing screen, each annotated with its rule
 * (type/unit/label/category/country) so the front end never re-derives a key's
 * type. Read-only. row is the 1-based sheet row. Keys without a rule are returned
 * editable:false. The Value/min/max are JSON-safe (Number or '').
 */
function getSettingsForConsole() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');
  if (!sheet) return [];
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var idx = headerIndex_(sheet);
  if (!idx.hasOwnProperty('Key') || !idx.hasOwnProperty('Value')) return [];
  var rows = sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).getValues();
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var key = String(rows[i][idx['Key']] || '').trim();
    if (!key) continue;
    var rule = settingRuleFor_(key);
    out.push({
      key: key,
      value: wcNum_(rows[i][idx['Value']]),
      row: i + 2,
      editable: !!rule,
      type: rule ? rule.type : '',
      unit: rule ? rule.unit : '',
      label: rule ? rule.label : key,
      category: rule ? rule.category : 'Other',
      country: (rule && rule.country) ? rule.country : '',
      countryLabel: (rule && rule.country) ? wcCountryLabel_(rule.country) : '',
      integer: rule ? !!rule.integer : false,
      min: rule ? rule.min : '',
      max: (rule && rule.max !== null) ? rule.max : ''
    });
  }
  return out;
}

/**
 * Edit ONE existing Settings value from the console. The only Settings write
 * path. Rejects unknown/typed-out keys (no rule) and keys absent from the sheet
 * (never adds a row). Validates by type, then writes ONLY the Value cell under a
 * script lock — the Key cell is never touched. Returns { ok:true, key, oldValue,
 * newValue, row, warning } or { ok:false, error }. `warning` carries non-blocking
 * structural flags (cap below min; value set to 0) — the write still happens.
 */
function updateSettingFromConsole(key, value) {
  var k = String(key === null || typeof key === 'undefined' ? '' : key).trim();
  if (!k) return { ok: false, error: 'Key is required.' };
  var rule = settingRuleFor_(k);
  if (!rule) return { ok: false, error: '“' + k + '” is not an editable setting.' };
  var v = validateSettingValue_(rule, value);
  if (!v.ok) return { ok: false, error: v.error };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); }
  catch (e) { return { ok: false, error: 'Console is busy — please try again.' }; }
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');
    if (!sheet) return { ok: false, error: 'Settings tab not found.' };
    var idx = headerIndex_(sheet);
    if (!idx.hasOwnProperty('Key') || !idx.hasOwnProperty('Value')) {
      return { ok: false, error: 'Settings tab is missing Key/Value columns.' };
    }
    var last = sheet.getLastRow();
    if (last < 2) return { ok: false, error: 'Settings tab is empty.' };
    var rows = sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).getValues();

    // Find by EXACT trimmed key. Missing -> reject (never add). Duplicate -> reject.
    var foundRow = -1, oldValue = '';
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][idx['Key']] || '').trim() === k) {
        if (foundRow !== -1) {
          return { ok: false, error: 'Key “' + k + '” appears more than once in Settings — fix the sheet before editing.' };
        }
        foundRow = i + 2;
        oldValue = rows[i][idx['Value']];
      }
    }
    if (foundRow === -1) {
      return { ok: false, error: 'Key “' + k + '” does not exist in Settings — adding keys is not allowed.' };
    }

    // Non-blocking structural warnings (value still writes).
    var warnings = [];
    if (v.value === 0) warnings.push('Set to 0 — this zeroes/disables this charge.');
    if (/^RentalCap_/.test(k) && rule.country) {
      var minV = wcSettingNumberFromRows_(rows, idx, 'RentalMin_' + rule.country);
      if (minV !== null && v.value < minV) {
        warnings.push('Cap £' + v.value + ' is below Min £' + minV + ' for ' +
          wcCountryLabel_(rule.country) + ' — the minimum will always bind.');
      }
    }

    // Write ONLY the Value cell. Never the Key cell. Never append a row.
    sheet.getRange(foundRow, idx['Value'] + 1).setValue(v.value);
    Logger.log('updateSettingFromConsole: ' + k + ' ' + oldValue + ' -> ' + v.value +
      ' by ' + activeUserOrSystem_());

    return {
      ok: true, key: k, oldValue: wcNum_(oldValue), newValue: v.value,
      row: foundRow, warning: warnings.join(' ')
    };
  } finally {
    lock.releaseLock();
  }
}

/* ============================================================
 * CONSOLE VOID / DELETE (destructive — LockService)
 * ============================================================
 * Highest-destructiveness console writes: they remove rows and reverse money.
 * Two hard rules baked in here:
 *   1. LEDGER IS NEVER DELETABLE FROM THE CONSOLE. There is deliberately no
 *      ledger-delete function. The Ledger is append-only and the financial
 *      source of truth; the ONLY reversal is the refund flow below, which APPENDS
 *      a RENTAL-VOID-<id> credit and never edits/deletes the original charge.
 *      Do not add a ledger-delete here.
 *   2. Voiding and refunding are SEPARATE calls with SEPARATE confirmations.
 *      Voiding never moves money on its own.
 */

/**
 * Charged-state + net-charged for a rental, from the Ledger. Reuses
 * baseChargeState_ (RentalEngine.gs) for the base + RENTAL-ADJ netting, then adds
 * the RENTALRET-<id> return-extras AND the RENTAL-LOSS-<id> device-loss charges —
 * so a void→refund of a lost rental reverses base + loss together (no stranding).
 * Returns { charged, netCharged } (netCharged a positive £, floored at 0). Read-only.
 */
function rentalChargeSummary_(rentalId) {
  var ledger = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Ledger');
  if (!ledger) return { charged: false, netCharged: 0 };
  var st = baseChargeState_(ledger, rentalId); // base + ADJ netting (do not reinvent)

  var idx = headerIndex_(ledger);
  var retRef = 'RENTALRET-' + rentalId;
  var lossRef = 'RENTAL-LOSS-' + rentalId;
  var extraSum = 0, hasRet = false, hasLoss = false;
  if (idx.hasOwnProperty('Reference') && idx.hasOwnProperty('Amount')) {
    var last = ledger.getLastRow();
    if (last >= 2) {
      var rows = ledger.getRange(2, 1, last - 1, ledger.getLastColumn()).getValues();
      for (var i = 0; i < rows.length; i++) {
        var ref = String(rows[i][idx['Reference']]);
        if (ref === retRef) { extraSum += Number(rows[i][idx['Amount']]) || 0; hasRet = true; }   // return extras
        else if (ref === lossRef) { extraSum += Number(rows[i][idx['Amount']]) || 0; hasLoss = true; } // device loss
      }
    }
  }
  var charged = st.hasBase || st.adjCount > 0 || hasRet || hasLoss;
  var netCharged = round2_(st.nettedCharged + (-extraSum)); // -extraSum: charges are negative
  if (netCharged < 0) netCharged = 0;
  return { charged: charged, netCharged: netCharged };
}

/**
 * Void a rental. PREVIEW unless opts.confirm === true (the preview writes
 * nothing — it returns { charged, netCharged, wouldDelete } so the UI can show
 * the exact confirm). On confirm: a NEVER-CHARGED rental is hard-deleted; a
 * CHARGED rental is marked IsVoid='y' (no delete, NO refund — refund is the
 * separate refundRentalFromConsole call). Returns netCharged so the UI can offer
 * the refund step. Charged-state is re-evaluated inside the lock.
 *
 * opts: { confirm?: boolean }
 */
function voidRentalFromConsole(rentalId, opts) {
  opts = opts || {};
  if (rentalId === '' || rentalId === null || typeof rentalId === 'undefined') {
    return { ok: false, error: 'RentalID is required.' };
  }

  if (opts.confirm !== true) {
    var rs0 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Rentals');
    var found0 = rs0 ? findRowById_(rs0, rentalId) : null;
    var sum0 = rentalChargeSummary_(rentalId);
    return {
      ok: true, preview: true, exists: !!found0,
      charged: sum0.charged, netCharged: sum0.netCharged, wouldDelete: !sum0.charged
    };
  }

  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); }
  catch (e) { return { ok: false, error: 'Console is busy — please try again.' }; }
  try {
    var rentals = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Rentals');
    if (!rentals) return { ok: false, error: 'Rentals tab not found.' };
    var found = findRowById_(rentals, rentalId);
    if (!found) return { ok: false, error: 'RentalID ' + rentalId + ' not found (already deleted?).' };

    var sum = rentalChargeSummary_(rentalId); // authoritative, inside the lock
    if (!sum.charged) {
      rentals.deleteRow(found.row);            // never charged → safe hard-delete
      return { ok: true, deleted: true, voided: false, rentalId: rentalId, netCharged: 0 };
    }

    var idx = headerIndex_(rentals);
    if (!idx.hasOwnProperty('IsVoid')) {
      return { ok: false, error: 'Rentals sheet has no IsVoid column — add it (Yes/No) before voiding charged rentals.' };
    }
    // Write 'y' — the project's Yes/No convention (matches ynStore_ and the
    // IsVoid column's y/n data-validation; rentalIsVoid_ reads it case-tolerantly).
    rentals.getRange(found.row, idx['IsVoid'] + 1).setValue('y'); // → derived status Cancelled
    return { ok: true, deleted: false, voided: true, rentalId: rentalId, netCharged: sum.netCharged };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Refund a voided rental — the ONLY money reversal. Append-only: posts a Refund
 * (credit) keyed on RENTAL-VOID-<id>, never edits/deletes the original charge.
 * Idempotent: a second call is rejected (one RENTAL-VOID-<id> ever). Amount must
 * be 0 < amount <= netCharged (partial / kept-fee allowed). Lock-serialised.
 */
function refundRentalFromConsole(rentalId, amount) {
  if (rentalId === '' || rentalId === null || typeof rentalId === 'undefined') {
    return { ok: false, error: 'RentalID is required.' };
  }
  var voidRef = 'RENTAL-VOID-' + rentalId;

  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); }
  catch (e) { return { ok: false, error: 'Console is busy — please try again.' }; }
  try {
    var rentals = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Rentals');
    var found = rentals ? findRowById_(rentals, rentalId) : null;
    if (!found) return { ok: false, error: 'RentalID ' + rentalId + ' not found.' };
    var customerId = found.values[1]; // col 2 CustomerID

    if (ledgerHasReference_(voidRef)) {  // idempotency: never double-refund
      return { ok: false, error: 'RentalID ' + rentalId + ' was already refunded (' + voidRef + ').' };
    }

    var sum = rentalChargeSummary_(rentalId);
    if (!sum.charged || sum.netCharged <= 0) {
      return { ok: false, error: 'Nothing to refund — RentalID ' + rentalId + ' has no net charge.' };
    }

    var amt = Number(amount);
    if (isNaN(amt) || !isFinite(amt) || amt <= 0) {
      return { ok: false, error: 'Refund amount must be a positive number.' };
    }
    amt = round2_(amt);
    if (amt > sum.netCharged) {
      return { ok: false, error: 'Refund £' + amt.toFixed(2) + ' exceeds net charged £' +
        sum.netCharged.toFixed(2) + '.' };
    }

    var entryId = appendLedgerEntry(customerId, 'Refund', amt, '', voidRef,
      'Rental ' + rentalId + ' void refund', 'System');
    return {
      ok: true, rentalId: rentalId, refunded: amt, entryId: entryId,
      partial: amt < sum.netCharged, netCharged: sum.netCharged
    };
  } finally {
    lock.releaseLock();
  }
}

/** Count a customer's Rentals rows + Ledger entries (read-only). */
function customerRefCounts_(customerId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cid = String(customerId);
  var rentals = 0, ledgerEntries = 0;

  var rs = ss.getSheetByName('Rentals');
  if (rs && rs.getLastRow() >= 2) {
    var ridx = headerIndex_(rs);
    var rrows = rs.getRange(2, 1, rs.getLastRow() - 1, rs.getLastColumn()).getValues();
    for (var i = 0; i < rrows.length; i++) {
      if (rrows[i][ridx['RentalID']] === '' || rrows[i][ridx['RentalID']] === null) continue;
      if (String(rrows[i][ridx['CustomerID']]) === cid) rentals++;
    }
  }
  var ls = ss.getSheetByName('Ledger');
  if (ls && ls.getLastRow() >= 2) {
    var lidx = headerIndex_(ls);
    var lrows = ls.getRange(2, 1, ls.getLastRow() - 1, ls.getLastColumn()).getValues();
    for (var j = 0; j < lrows.length; j++) {
      if (lrows[j][lidx['EntryID']] === '' || lrows[j][lidx['EntryID']] === null) continue;
      if (String(lrows[j][lidx['CustomerID']]) === cid) ledgerEntries++;
    }
  }
  return { rentals: rentals, ledgerEntries: ledgerEntries };
}

/**
 * Delete a Customer. PREVIEW unless opts.confirm === true (preview returns the
 * rental / ledger counts + canDelete, writes nothing). On confirm: hard-delete
 * ONLY when the customer has zero Rentals rows AND zero Ledger entries; otherwise
 * reject with a clear message. Re-checked inside the lock. The Drive folder is
 * NOT deleted (left for manual cleanup).
 *
 * opts: { confirm?: boolean }
 */
function deleteCustomerFromConsole(customerId, opts) {
  opts = opts || {};
  if (customerId === '' || customerId === null || typeof customerId === 'undefined') {
    return { ok: false, error: 'CustomerID is required.' };
  }

  if (opts.confirm !== true) {
    var cs0 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Customers');
    var found0 = cs0 ? findRowById_(cs0, customerId) : null;
    var c0 = customerRefCounts_(customerId);
    return {
      ok: true, preview: true, exists: !!found0,
      rentals: c0.rentals, ledgerEntries: c0.ledgerEntries,
      canDelete: !!found0 && c0.rentals === 0 && c0.ledgerEntries === 0
    };
  }

  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); }
  catch (e) { return { ok: false, error: 'Console is busy — please try again.' }; }
  try {
    var customers = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Customers');
    if (!customers) return { ok: false, error: 'Customers tab not found.' };
    var found = findRowById_(customers, customerId);
    if (!found) return { ok: false, error: 'CustomerID ' + customerId + ' not found (already deleted?).' };

    var c = customerRefCounts_(customerId); // re-count inside the lock
    if (c.rentals > 0 || c.ledgerEntries > 0) {
      return { ok: false, error: 'CustomerID ' + customerId + ' has ' + c.rentals +
        ' rental(s) / ' + c.ledgerEntries + ' ledger entr' + (c.ledgerEntries === 1 ? 'y' : 'ies') +
        ' — void those first.' };
    }
    customers.deleteRow(found.row);
    return { ok: true, deleted: true, customerId: customerId };
  } finally {
    lock.releaseLock();
  }
}

/* ============================================================
 * DEVICE-LOSS FEE (standalone, operator-confirmed — LockService)
 * ============================================================
 * A lost phone is never returned, so this does NOT ride calcReturn. It is a
 * standalone money action mirroring void/refund: set IsLost='y' AND post the
 * Damage_Phone_<country> loss fee once (RENTAL-LOSS-<id>, idempotent). The loss
 * fee is ADDITIVE — the rental stays open (status Lost), never auto-voided. All
 * server-side: reuses the engine's damagePhoneKey_ / flagRentalRateMissing_ as
 * callable globals, so RentalEngine.js is untouched.
 */

/** Loss-fee amount for a rental's country = Damage_Phone_<country>, or null when
 *  that rate is missing/blank/non-numeric. Reuses the engine's damagePhoneKey_. */
function rentalLossFee_(country) {
  return settingNumberOrNull_(damagePhoneKey_(country));
}

/**
 * Mark a rental's phone Lost and charge the device-loss fee. PREVIEW unless
 * opts.confirm === true (preview writes nothing; returns the fee so the UI can
 * confirm the exact £). On confirm: sets IsLost='y' and posts RENTAL-LOSS-<id>
 * for Damage_Phone_<country>. Rate guard: a missing rate marks Lost but charges
 * NOTHING and raises RATEMISSING (re-click after fixing the rate charges it).
 * Idempotent on RENTAL-LOSS-<id>. Rejects an already-Cancelled or already-Returned
 * rental. The rental STAYS OPEN (loss is additive to the base; not auto-voided).
 *
 * opts: { confirm?: boolean }
 */
function markRentalLostFromConsole(rentalId, opts) {
  opts = opts || {};
  if (rentalId === '' || rentalId === null || typeof rentalId === 'undefined') {
    return { ok: false, error: 'RentalID is required.' };
  }
  var lossRef = 'RENTAL-LOSS-' + rentalId;

  if (opts.confirm !== true) {
    var rs0 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Rentals');
    var found0 = rs0 ? findRowById_(rs0, rentalId) : null;
    var country0 = found0 ? found0.values[2] : ''; // col 3 Country
    var fee0 = found0 ? rentalLossFee_(country0) : null;
    return {
      ok: true, preview: true, exists: !!found0,
      country: countryDisplay_(country0),
      lossFee: (fee0 === null ? '' : round2_(fee0)),
      rateMissing: (fee0 === null),
      alreadyCharged: ledgerHasReference_(lossRef)
    };
  }

  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); }
  catch (e) { return { ok: false, error: 'Console is busy — please try again.' }; }
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var rentals = ss.getSheetByName('Rentals');
    if (!rentals) return { ok: false, error: 'Rentals tab not found.' };
    var found = findRowById_(rentals, rentalId);
    if (!found) return { ok: false, error: 'RentalID ' + rentalId + ' not found.' };
    var idx = headerIndex_(rentals);
    var row = found.values;
    var customerId = row[1]; // col 2
    var country = row[2];    // col 3

    if (rentalIsVoid_(row, idx)) {
      return { ok: false, error: 'RentalID ' + rentalId + ' is Cancelled (voided) — cannot mark Lost.' };
    }
    if (wcDateVal_(row[6])) { // ActualReturnDate set → phone came back
      return { ok: false, error: 'RentalID ' + rentalId + ' was returned — loss does not apply (charge damage on return instead).' };
    }
    if (!idx.hasOwnProperty('IsLost')) {
      return { ok: false, error: 'Rentals sheet has no IsLost column.' };
    }

    // Record the status truth first (a lost phone is lost whether or not it can be priced).
    rentals.getRange(found.row, idx['IsLost'] + 1).setValue('y');

    if (ledgerHasReference_(lossRef)) {                 // idempotent: never double-charge
      return { ok: true, lost: true, charged: false, alreadyCharged: true, rentalId: rentalId };
    }

    var fee = rentalLossFee_(country);                  // rate guard: never £0 silently
    if (fee === null) {
      flagRentalRateMissing_(ss, rentalId, countryDisplay_(country), [damagePhoneKey_(country)],
        'device loss — marked Lost but no rate, not charged');
      return { ok: true, lost: true, charged: false, rateMissing: true, rentalId: rentalId };
    }

    var entryId = appendLedgerEntry(customerId, 'Charge', fee, '', lossRef,
      'Device loss — ' + countryDisplay_(country) + ' phone', 'System');
    return { ok: true, lost: true, charged: true, lossFee: round2_(fee), entryId: entryId, rentalId: rentalId };
  } finally {
    lock.releaseLock();
  }
}

/* ============================================================
 * PER-RENTAL DISCOUNT (operator-set — LockService)
 * ============================================================
 * Writes the DiscountType / DiscountValue columns the engine reads (calcRental
 * applies the discount to the post-cap rental portion only, before VN/late/damage).
 * Stored convention — the SOLE writer of these cells: 'Percent' / 'Amount' / '' (None,
 * stored blank). Setting a discount is money-affecting: the next sweep re-prices the
 * rental and posts a RENTAL-ADJ correction if the charge changed.
 */
function setRentalDiscountFromConsole(rentalId, type, value) {
  if (rentalId === '' || rentalId === null || typeof rentalId === 'undefined') {
    return { ok: false, error: 'RentalID is required.' };
  }
  // Normalise to the stored convention: 'Percent' | 'Amount' | '' (None → blank).
  var t = String(type || '').trim().toLowerCase();
  var storeType, storeValue;
  if (t === '' || t === 'none') {
    storeType = ''; storeValue = '';
  } else if (t === 'percent') {
    var p = Number(value);
    if (isNaN(p) || p < 0 || p > 100) return { ok: false, error: 'Percent discount must be 0–100.' };
    storeType = 'Percent'; storeValue = round2_(p);
  } else if (t === 'amount') {
    var a = Number(value);
    if (isNaN(a) || a < 0) return { ok: false, error: 'Amount discount must be ≥ 0.' };
    storeType = 'Amount'; storeValue = round2_(a);
  } else {
    return { ok: false, error: 'Discount type must be Percent, Amount, or None.' };
  }

  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); }
  catch (e) { return { ok: false, error: 'Console is busy — please try again.' }; }
  try {
    var rentals = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Rentals');
    if (!rentals) return { ok: false, error: 'Rentals tab not found.' };
    var found = findRowById_(rentals, rentalId);
    if (!found) return { ok: false, error: 'RentalID ' + rentalId + ' not found.' };
    var idx = headerIndex_(rentals);
    if (rentalIsVoid_(found.values, idx)) {
      return { ok: false, error: 'RentalID ' + rentalId + ' is Cancelled — cannot set a discount.' };
    }
    if (!idx.hasOwnProperty('DiscountType') || !idx.hasOwnProperty('DiscountValue')) {
      return { ok: false, error: 'Rentals sheet has no DiscountType/DiscountValue columns.' };
    }
    rentals.getRange(found.row, idx['DiscountType'] + 1).setValue(storeType);
    rentals.getRange(found.row, idx['DiscountValue'] + 1).setValue(storeValue);
    return {
      ok: true, rentalId: rentalId,
      discountType: storeType, discountValue: storeValue, cleared: storeType === '',
      warning: 'The 5-min sweep will re-price this rental and post a RENTAL-ADJ correction if the charge changed.'
    };
  } finally {
    lock.releaseLock();
  }
}
