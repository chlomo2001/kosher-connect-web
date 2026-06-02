/**
 * Bookings.gs — flight/travel bookings for the Kosher Connect master sheet.
 *
 * This Sheet is the database for a Google Apps Script + AppSheet build.
 * The Ledger functions appendLedgerEntry(customerId, type, amount, method,
 * reference, memo) and getWalletBalance(customerId) already exist in the
 * bound script and are called from here.
 *
 * Data-protection note: we deliberately do NOT store passport numbers or
 * dates of birth anywhere — only a PassportOnFile (y/n) flag and the
 * PassportExpiry date.
 */

var BOOKINGS_SHEET_NAME = 'Bookings';
var LEDGER_SHEET_NAME = 'Ledger';
var TASKS_SHEET_NAME = 'Tasks';

var BOOKINGS_HEADERS = [
  'BookingID', 'CustomerID', 'Passenger', 'Route', 'Airline',
  'BookingReference', 'TravelDate', 'DepartureTime', 'ArrivalTime',
  'Price', 'BookingFee', 'Status', 'PassportOnFile', 'PassportExpiry', 'Notes'
];

var BOOKING_STATUSES = ['Quoted', 'Booked', 'Ticketed', 'Flown', 'Cancelled'];

/* ------------------------------------------------------------------ *
 * 1. setupBookingsTab
 * ------------------------------------------------------------------ */

/**
 * Creates the Bookings tab (skips if it already exists), writes the header
 * row, adds Status and PassportOnFile dropdowns, and freezes the header.
 */
function setupBookingsTab() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(BOOKINGS_SHEET_NAME);
  if (sheet) {
    Logger.log('setupBookingsTab: "' + BOOKINGS_SHEET_NAME + '" tab already exists — skipping.');
    return;
  }

  sheet = ss.insertSheet(BOOKINGS_SHEET_NAME);

  // Header row.
  sheet.getRange(1, 1, 1, BOOKINGS_HEADERS.length).setValues([BOOKINGS_HEADERS]);
  sheet.getRange(1, 1, 1, BOOKINGS_HEADERS.length).setFontWeight('bold');
  sheet.setFrozenRows(1);

  var maxRows = sheet.getMaxRows();
  var bodyRows = maxRows - 1; // everything below the header

  // Status dropdown.
  var statusCol = BOOKINGS_HEADERS.indexOf('Status') + 1;
  var statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(BOOKING_STATUSES, true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, statusCol, bodyRows, 1).setDataValidation(statusRule);

  // PassportOnFile y/n dropdown.
  var ponfCol = BOOKINGS_HEADERS.indexOf('PassportOnFile') + 1;
  var ponfRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['y', 'n'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, ponfCol, bodyRows, 1).setDataValidation(ponfRule);

  Logger.log('setupBookingsTab: created "' + BOOKINGS_SHEET_NAME + '" tab.');
}

/* ------------------------------------------------------------------ *
 * 2. addBooking
 * ------------------------------------------------------------------ */

/**
 * Appends a Bookings row. BookingID = max in column A + 1.
 * Status defaults to "Booked". After appending, it immediately posts the
 * Price + BookingFee charge to the customer's wallet via
 * confirmBookingCharge() (the double-charge guard there, keyed on the
 * BOOKING-<id> tag, still applies).
 *
 * Returns { bookingId, balance } where balance is the new wallet balance.
 *
 * No passport number or DOB is accepted or stored — only the
 * passportOnFile flag and passportExpiry date.
 */
function addBooking(customerId, passenger, route, airline, bookingRef,
                    travelDate, departureTime, arrivalTime, price, bookingFee,
                    passportOnFile, passportExpiry, notes) {
  var sheet = getBookingsSheet_();
  var nextId = nextSequentialId_(sheet);

  var values = {
    BookingID: nextId,
    CustomerID: customerId,
    Passenger: passenger,
    Route: route,
    Airline: airline,
    BookingReference: bookingRef,
    TravelDate: travelDate,
    DepartureTime: departureTime,
    ArrivalTime: arrivalTime,
    Price: price,
    BookingFee: bookingFee,
    Status: 'Booked',
    PassportOnFile: passportOnFile,
    PassportExpiry: passportExpiry,
    Notes: notes
  };

  var row = BOOKINGS_HEADERS.map(function (h) {
    return values.hasOwnProperty(h) ? values[h] : '';
  });

  sheet.appendRow(row);
  Logger.log('addBooking: added BookingID ' + nextId + ' for CustomerID ' + customerId + '.');

  // Post the charge to the wallet ledger in the same step.
  var balance = confirmBookingCharge(nextId);

  return { bookingId: nextId, balance: balance };
}

/* ------------------------------------------------------------------ *
 * 3. confirmBookingCharge
 * ------------------------------------------------------------------ */

/**
 * Looks up a booking and posts its charge to the customer's wallet via the
 * existing appendLedgerEntry(). Charge amount = -(Price + BookingFee).
 * Returns the new wallet balance from getWalletBalance(customerId).
 *
 * The ledger entry's Reference field stores a stable "BOOKING-<id>" tag so
 * the charge can always be tied back to its booking. The airline
 * BookingReference (which can be blank in real data) is kept in the memo
 * when present.
 *
 * Double-charge guard: keyed on the BOOKING-<id> tag. If a Ledger entry with
 * that tag already exists, it logs a warning, posts nothing, and returns the
 * current (unchanged) balance.
 */
function confirmBookingCharge(bookingId) {
  var sheet = getBookingsSheet_();
  var booking = findBookingRow_(sheet, bookingId);
  if (!booking) {
    Logger.log('confirmBookingCharge: BookingID ' + bookingId + ' not found.');
    return null;
  }

  var b = booking.values;
  var customerId = b.CustomerID;
  var bookingRef = b.BookingReference;
  var price = Number(b.Price) || 0;
  var bookingFee = Number(b.BookingFee) || 0;

  var bookingTag = bookingReferenceTag_(bookingId);

  // Double-charge guard, keyed on the BOOKING-<id> tag.
  if (ledgerHasReference_(bookingTag)) {
    Logger.log('confirmBookingCharge: a Ledger entry tagged "' + bookingTag +
               '" already exists — refusing to charge again for BookingID ' + bookingId + '.');
    return getWalletBalance(customerId);
  }

  var amount = -(price + bookingFee);
  var memo = 'Flight ' + b.Route + ' (' + b.Airline + ')';
  if (bookingRef !== '' && bookingRef !== null && bookingRef !== undefined) {
    memo += ' — ref ' + bookingRef;
  }

  appendLedgerEntry(customerId, 'Charge', amount, '', bookingTag, memo);
  Logger.log('confirmBookingCharge: posted ' + amount + ' to CustomerID ' + customerId +
             ' for BookingID ' + bookingId + ' (tag "' + bookingTag + '").');

  return getWalletBalance(customerId);
}

/** Stable ledger Reference tag for a booking, used as the dedupe key. */
function bookingReferenceTag_(bookingId) {
  return 'BOOKING-' + bookingId;
}

/* ------------------------------------------------------------------ *
 * 4. getBookingsForCustomer
 * ------------------------------------------------------------------ */

/**
 * Returns the customer's bookings as objects (keyed by header),
 * newest TravelDate first.
 */
function getBookingsForCustomer(customerId) {
  var sheet = getBookingsSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var data = sheet.getRange(2, 1, lastRow - 1, BOOKINGS_HEADERS.length).getValues();
  var wanted = String(customerId);

  var rows = data
    .filter(function (r) { return String(r[1]) === wanted; }) // CustomerID is col 2
    .map(function (r) { return rowToObject_(BOOKINGS_HEADERS, r); });

  rows.sort(function (a, b) {
    return dateValue_(b.TravelDate) - dateValue_(a.TravelDate); // newest first
  });

  return rows;
}

/* ------------------------------------------------------------------ *
 * 5. checkExpiringPassports  (for a future daily trigger)
 * ------------------------------------------------------------------ */

/**
 * Scans Bookings for a PassportExpiry within the next 90 days and appends a
 * High-priority Tasks row for each. Skips bookings whose passport is not on
 * file and skips any passenger that already has an open (not-Done) matching
 * task, so a daily trigger won't pile up duplicates.
 *
 * The trigger itself is intentionally NOT installed here.
 */
function checkExpiringPassports() {
  var sheet = getBookingsSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log('checkExpiringPassports: no bookings to scan.');
    return;
  }

  var data = sheet.getRange(2, 1, lastRow - 1, BOOKINGS_HEADERS.length).getValues();

  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var horizon = new Date(today.getTime());
  horizon.setDate(horizon.getDate() + 90);

  var openTitles = openTaskTitles_();
  var added = 0;

  for (var i = 0; i < data.length; i++) {
    var b = rowToObject_(BOOKINGS_HEADERS, data[i]);

    if (String(b.PassportOnFile).toLowerCase() !== 'y') continue;

    var expMs = dateValue_(b.PassportExpiry);
    if (!expMs) continue; // no / unparseable expiry
    var exp = new Date(expMs);
    exp.setHours(0, 0, 0, 0);

    if (exp < today || exp > horizon) continue; // outside the next 90 days

    var title = 'Passport expiring soon — ' + b.Passenger;
    if (openTitles[title]) continue; // already flagged and not done

    appendTaskRow_(title, b.PassportExpiry, 'High');
    openTitles[title] = true;
    added++;
  }

  Logger.log('checkExpiringPassports: added ' + added + ' passport-expiry task(s).');
}

/* ================================================================== *
 * Private helpers
 * ================================================================== */

function getBookingsSheet_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BOOKINGS_SHEET_NAME);
  if (!sheet) {
    throw new Error('Bookings tab not found — run setupBookingsTab() first.');
  }
  return sheet;
}

/** Next sequential id = max numeric value in column A (below header) + 1. */
function nextSequentialId_(sheet) {
  var lastRow = sheet.getLastRow();
  var maxId = 0;
  if (lastRow >= 2) {
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      var n = parseInt(ids[i][0], 10);
      if (!isNaN(n) && n > maxId) maxId = n;
    }
  }
  return maxId + 1;
}

/** Finds a booking by BookingID; returns {rowIndex, values} or null. */
function findBookingRow_(sheet, bookingId) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  var data = sheet.getRange(2, 1, lastRow - 1, BOOKINGS_HEADERS.length).getValues();
  var wanted = String(bookingId);
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]) === wanted) {
      return { rowIndex: i + 2, values: rowToObject_(BOOKINGS_HEADERS, data[i]) };
    }
  }
  return null;
}

/** Maps a row array to an object keyed by the given headers. */
function rowToObject_(headers, row) {
  var obj = {};
  for (var i = 0; i < headers.length; i++) obj[headers[i]] = row[i];
  return obj;
}

/**
 * Parses a sheet value into a millisecond timestamp for comparison/sorting.
 * Handles Date objects, dd/MM/yyyy, and ISO-ish strings. Returns 0 if empty
 * or unparseable.
 */
function dateValue_(v) {
  if (v === '' || v === null || v === undefined) return 0;
  if (Object.prototype.toString.call(v) === '[object Date]') return v.getTime();

  var s = String(v).trim();

  // dd/MM/yyyy (the format used elsewhere in this sheet)
  var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime();
  }

  var t = Date.parse(s);
  return isNaN(t) ? 0 : t;
}

/** True if any Ledger row's Reference equals the given reference. */
function ledgerHasReference_(reference) {
  var sheet = getSheetOrThrow_(LEDGER_SHEET_NAME);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  var index = headerIndex_(sheet);
  if (!index.hasOwnProperty('Reference')) {
    throw new Error('"' + LEDGER_SHEET_NAME + '" tab has no "Reference" column — cannot run double-charge guard.');
  }

  var refs = sheet.getRange(2, index['Reference'] + 1, lastRow - 1, 1).getValues();
  var wanted = String(reference);
  for (var i = 0; i < refs.length; i++) {
    if (String(refs[i][0]) === wanted) return true;
  }
  return false;
}

/** Titles of Tasks rows that are not marked Done. */
function openTaskTitles_() {
  var sheet = getSheetOrThrow_(TASKS_SHEET_NAME);
  var map = {};
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return map;

  var index = headerIndex_(sheet);
  var titleCol = index['Title'];
  var doneCol = index['Done'];
  if (titleCol === undefined || doneCol === undefined) {
    throw new Error('"' + TASKS_SHEET_NAME + '" tab is missing a "Title" or "Done" column.');
  }

  var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  for (var i = 0; i < data.length; i++) {
    var done = String(data[i][doneCol]).toLowerCase();
    if (done === 'y' || done === 'true' || done === 'yes') continue;
    map[String(data[i][titleCol])] = true;
  }
  return map;
}

/** Appends a row to the Tasks tab, mapping by header. */
function appendTaskRow_(title, dueDate, priority) {
  var sheet = getSheetOrThrow_(TASKS_SHEET_NAME);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim(); });

  var values = {
    TaskID: Utilities.getUuid().substring(0, 8),
    Title: title,
    DueDate: dueDate,
    Source: 'Auto',
    Priority: priority,
    Done: 'n',
    RawText: '',
    CreatedAt: new Date()
  };

  var row = headers.map(function (h) {
    return values.hasOwnProperty(h) ? values[h] : '';
  });
  sheet.appendRow(row);
}

/** Returns the named sheet, or throws a clear error if it isn't found. */
function getSheetOrThrow_(name) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) {
    throw new Error('"' + name + '" tab not found in this spreadsheet.');
  }
  return sheet;
}

/** Maps header name -> zero-based column index for the sheet's row 1. */
function headerIndex_(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var index = {};
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i]).trim();
    if (h !== '') index[h] = i;
  }
  return index;
}
