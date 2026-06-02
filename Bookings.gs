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
 * Status defaults to "Booked". Returns the new BookingID.
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
  return nextId;
}

/* ------------------------------------------------------------------ *
 * 3. confirmBookingCharge
 * ------------------------------------------------------------------ */

/**
 * Looks up a booking and posts its charge to the customer's wallet via the
 * existing appendLedgerEntry(). Charge amount = -(Price + BookingFee).
 * Returns the new wallet balance from getWalletBalance(customerId).
 *
 * Double-charge guard: if a Ledger entry already exists with this booking's
 * BookingReference, it logs a warning, posts nothing, and returns the
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

  // Double-charge guard, keyed on BookingReference.
  if (bookingRef !== '' && bookingRef !== null && bookingRef !== undefined &&
      ledgerHasReference_(bookingRef)) {
    Logger.log('confirmBookingCharge: a Ledger entry with reference "' + bookingRef +
               '" already exists — refusing to charge again for BookingID ' + bookingId + '.');
    return getWalletBalance(customerId);
  }

  var amount = -(price + bookingFee);
  var memo = 'Flight ' + b.Route + ' (' + b.Airline + ')';

  appendLedgerEntry(customerId, 'Charge', amount, '', bookingRef, memo);
  Logger.log('confirmBookingCharge: posted ' + amount + ' to CustomerID ' + customerId +
             ' for BookingID ' + bookingId + ' (ref "' + bookingRef + '").');

  return getWalletBalance(customerId);
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
  var ledger = findSheetByHeaders_(['CustomerID', 'Type', 'Amount', 'Reference']);
  if (!ledger) {
    Logger.log('ledgerHasReference_: Ledger tab not found — cannot run double-charge guard.');
    return false;
  }
  var sheet = ledger.sheet;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  var refCol = ledger.index['Reference'] + 1;
  var refs = sheet.getRange(2, refCol, lastRow - 1, 1).getValues();
  var wanted = String(reference);
  for (var i = 0; i < refs.length; i++) {
    if (String(refs[i][0]) === wanted) return true;
  }
  return false;
}

/** Titles of Tasks rows that are not marked Done. */
function openTaskTitles_() {
  var tasks = findSheetByHeaders_(['Title', 'Priority', 'Done']);
  var map = {};
  if (!tasks) return map;
  var sheet = tasks.sheet;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return map;

  var titleCol = tasks.index['Title'];
  var doneCol = tasks.index['Done'];
  var width = sheet.getLastColumn();
  var data = sheet.getRange(2, 1, lastRow - 1, width).getValues();
  for (var i = 0; i < data.length; i++) {
    var done = String(data[i][doneCol]).toLowerCase();
    if (done === 'y' || done === 'true' || done === 'yes') continue;
    map[String(data[i][titleCol])] = true;
  }
  return map;
}

/** Appends a row to the Tasks tab, mapping by header. */
function appendTaskRow_(title, dueDate, priority) {
  var tasks = findSheetByHeaders_(['TaskID', 'Title', 'Priority']);
  if (!tasks) {
    Logger.log('appendTaskRow_: Tasks tab not found — skipping task "' + title + '".');
    return;
  }
  var sheet = tasks.sheet;
  var headers = tasks.headers;

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

/**
 * Finds the first sheet whose header row (row 1) contains all of the given
 * header names. Returns {sheet, headers, index} where index maps header ->
 * zero-based column, or null if no sheet matches.
 */
function findSheetByHeaders_(required) {
  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  for (var s = 0; s < sheets.length; s++) {
    var sheet = sheets[s];
    if (sheet.getLastColumn() < 1 || sheet.getLastRow() < 1) continue;
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      .map(function (h) { return String(h).trim(); });

    var index = {};
    for (var i = 0; i < headers.length; i++) {
      if (headers[i] !== '') index[headers[i]] = i;
    }

    var ok = required.every(function (h) { return index.hasOwnProperty(h); });
    if (ok) return { sheet: sheet, headers: headers, index: index };
  }
  return null;
}
