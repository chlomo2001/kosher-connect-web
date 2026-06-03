/**
 * Kosher Connect — Business Management System
 * Google Apps Script (bound to the master Google Sheet)
 *
 * Salford, UK — phone rentals, SIM reselling, repairs, sold phones,
 * wallet/ledger, tasks and supporting reference data.
 *
 * Entry points:
 *   setup()       — create any missing tabs, headers, dropdowns, named
 *                   ranges, banding, frozen rows and seed data. Safe to
 *                   re-run: existing tabs are skipped, never clobbered.
 *   resetSetup()  — DEV ONLY. Delete every managed tab and rebuild from
 *                   scratch. Destroys all data in those tabs.
 *   onEdit(e)     — simple trigger that auto-numbers ID columns and fills
 *                   per-tab default values on new rows.
 *
 * After running setup() once, open Triggers and confirm the installable
 * onEdit trigger exists (setup() installs it). The simple onEdit(e) below
 * also fires on its own; the installable copy is belt-and-braces so the
 * behaviour survives ownership/scope edge cases.
 */

/* ============================================================
 * CONFIGURATION
 * ============================================================ */

// How far down columns we pre-apply data validation. Generous but bounded
// so we never validate the whole 10M-cell sheet.
var MAX_VALIDATION_ROW = 2000;

// Reusable dropdown value lists (single source of truth).
var YN = ['y', 'n'];

/**
 * Full schema. Order of `headers` is authoritative — header text and
 * column position must match exactly. `autoId: true` means column A is an
 * auto-incrementing integer ID managed by onEdit. `validations` maps a
 * header name to its dropdown list. `defaults` maps a header name to the
 * value written into blank cells when a new row is created.
 */
var SCHEMA = [
  {
    name: 'Customers',
    autoId: true,
    headers: ['CustomerID', 'Name', 'Phone', 'Email', 'NormalisedEmail',
              'Address', 'City', 'DriveFolderURL', 'CardOnFile', 'Notes',
              'CreatedAt', 'CreatedBy'],
    validations: { CardOnFile: YN }
  },
  {
    name: 'Rentals',
    autoId: true,
    headers: ['RentalID', 'CustomerID', 'Country', 'PhoneID', 'StartDate',
              'ReturnDueDate', 'ActualReturnDate', 'VirtualNumber',
              'ChargeableDays', 'PriceCalc', 'LateDays', 'LateFee',
              'DamageCharges', 'Total', 'Status', 'ChecklistPhone',
              'ChecklistSIM', 'ChecklistPlug', 'ChecklistWire'],
    validations: {
      Country: ['USA', 'UK-UKmins', 'UK-Intl', 'Israel', 'Canada'],
      VirtualNumber: ['None', 'Weekly', '30-day'],
      Status: ['Booked', 'Out', 'Returned', 'Overdue', 'Lost'],
      ChecklistPhone: YN,
      ChecklistSIM: YN,
      ChecklistPlug: YN,
      ChecklistWire: YN
    }
  },
  {
    name: 'Phones',
    autoId: true,
    headers: ['PhoneID', 'Make', 'Model', 'IMEI', 'Serial', 'PoolID',
              'Status', 'Condition', 'Notes'],
    validations: {
      Status: ['Available', 'Rented', 'Pool-Active', 'In-Repair', 'Lost']
    }
  },
  {
    name: 'Pools',
    autoId: true,
    headers: ['PoolID', 'PoolNumber', 'ActivationDate', 'ExpiryDate',
              'LinesActive', 'Notes']
  },
  {
    name: 'SIMs',
    autoId: true,
    headers: ['SIMID', 'CustomerID', 'Provider', 'Alias', 'Status',
              'RenewalCycleDays', 'NextRenewalDate', 'PaidBy', 'FeeApplied',
              'Tier'],
    validations: {
      Provider: ['Lebara', 'Three', 'Smarty', 'USMobile', 'giffgaff',
                 'O2', 'Vodafone', 'Fizz', 'Other'],
      Status: ['Ordered', 'Active', 'RenewalPending', 'Cancelled'],
      PaidBy: ['KC', 'Customer'],
      Tier: ['Setup', 'Service', 'Unlimited']
    },
    defaults: { RenewalCycleDays: 30 }
  },
  {
    name: 'SoldPhones',
    autoId: true,
    headers: ['SaleID', 'PhoneCompany', 'Model', 'CustomerID', 'IMEI',
              'Serial', 'SecurityField', 'SoldAt', 'SoldBy']
  },
  {
    name: 'Repairs',
    autoId: true,
    headers: ['RepairID', 'CustomerID', 'DeviceDescription', 'Services',
              'Total', 'Status', 'OpenedAt', 'ClosedAt', 'TimerSeconds',
              'TimerStart', 'TimerStop', 'Notes'],
    validations: {
      Status: ['Open', 'In Progress', 'Done', 'Collected']
    }
  },
  {
    name: 'PriceList',
    autoId: true,
    headers: ['ServiceID', 'Name', 'Category', 'Price', 'Active'],
    validations: { Active: YN }
  },
  {
    name: 'Ledger',
    autoId: true,
    headers: ['EntryID', 'CustomerID', 'Type', 'Amount', 'Method',
              'Reference', 'Memo', 'At', 'By'],
    validations: {
      Type: ['Charge', 'Payment', 'Top-up', 'Auto-deduct', 'Refund',
             'LateFee'],
      Method: ['Cash', 'Card', 'Stripe', 'Wallet', 'StandingOrder']
    }
  },
  {
    name: 'Tasks',
    autoId: true,
    headers: ['TaskID', 'Title', 'DueDate', 'Source', 'Priority', 'Done',
              'RawText', 'CreatedAt'],
    validations: {
      Source: ['Manual', 'SMS', 'Auto'],
      Priority: ['High', 'Normal', 'Low'],
      Done: YN
    }
  },
  {
    name: 'ResellerLinks',
    autoId: false,
    headers: ['Provider', 'AccountMeta', 'ShortcutURL', 'Notes']
  },
  {
    name: 'DIDs',
    autoId: false,
    headers: ['Number', 'CustomerID', 'Platform', 'Status', 'ShortcutURL',
              'Notes'],
    validations: {
      Platform: ['elid', 'FreePBX', 'Other'],
      Status: ['Active', 'Inactive']
    }
  },
  {
    name: 'Settings',
    autoId: false,
    headers: ['Key', 'Value', 'Notes'],
    seed: settingsSeed_()
  },
  {
    name: 'Holidays',
    autoId: false,
    headers: ['Date', 'HebrewName', 'Chargeable', 'Region', 'Notes'],
    validations: {
      Chargeable: YN,
      Region: ['Diaspora', 'Israel']
    },
    seed: holidaysSeed_()
  }
];

/* ============================================================
 * SEED DATA
 * ============================================================ */

function settingsSeed_() {
  // [Key, Value, Notes]
  return [
    ['RentalRate_USA', 3, '£/day'],
    ['RentalMin_USA', 20, ''],
    ['RentalCap_USA', 45, ''],
    ['RentalRate_UKUKmins', 2, ''],
    ['RentalMin_UKUKmins', 15, ''],
    ['RentalCap_UKUKmins', 40, ''],
    ['RentalRate_UKIntl', 2.50, ''],
    ['RentalMin_UKIntl', 20, ''],
    ['RentalCap_UKIntl', 45, ''],
    ['RentalRate_Israel', 3, ''],
    ['RentalMin_Israel', 20, ''],
    ['RentalCap_Israel', 50, ''],
    ['RentalRate_Canada', 3, ''],
    ['RentalMin_Canada', 25, ''],
    ['RentalCap_Canada', 45, ''],
    ['VN_Weekly', 5, ''],
    ['VN_30day', 10, ''],
    ['LateReturn_PerDay', 1, ''],
    ['Damage_Charger_UK', 5, ''],
    ['Damage_Charger_Other', 10, ''],
    ['Damage_Phone_UK', 45, ''],
    ['Damage_Phone_USA', 100, ''],
    ['Damage_Phone_Israel', 120, ''],
    ['SIM_SetupFee', 20, ''],
    ['SIM_ServiceFee', 5, ''],
    ['SIM_UnlimitedMonthly', 2, ''],
    ['SIM_ProviderPaidFeePercent', 10, ''],
    ['SIM_ProviderPaidFeeMin', 2, ''],
    ['OnlineServices_MinCharge', 5, ''],
    ['OnlineServices_HourlyRate', 45, ''],
    ['CollectLater_LateFeePercent', 10, ''],
    ['CollectLater_LateFeeMin', 2, '']
  ];
}

/**
 * Fixed Yom Tov seed for the next three Jewish-year cycles (5787–5789),
 * covering autumn 2026 through spring 2029. Shabbos is NOT listed — it is
 * computed in the rental calculator via WEEKDAY(date)=7 (Saturday).
 *
 * Each diaspora date is non-chargeable (Chargeable = n). Israel keeps
 * one-day Yom Tov, so only the first day of Sukkos/Pesach, a single
 * Shmini Atzeres/Simchas Torah, and one day of Shavuos are seeded with
 * Region = Israel (Rosh Hashanah remains two days in Israel too).
 *
 * Dates were computed against the standard Hebrew calendar; verify against
 * a printed luach before relying on them for billing.
 */
function holidaysSeed_() {
  var cycles = [
    { // 5787
      rh:            ['2026-09-12', '2026-09-13'],
      yk:            ['2026-09-21'],
      sukkos:        ['2026-09-26', '2026-09-27'],
      shminiSimchas: ['2026-10-03', '2026-10-04'],
      pesach12:      ['2027-04-22', '2027-04-23'],
      pesach78:      ['2027-04-28', '2027-04-29'],
      shavuos:       ['2027-06-11', '2027-06-12']
    },
    { // 5788
      rh:            ['2027-10-02', '2027-10-03'],
      yk:            ['2027-10-11'],
      sukkos:        ['2027-10-16', '2027-10-17'],
      shminiSimchas: ['2027-10-23', '2027-10-24'],
      pesach12:      ['2028-04-11', '2028-04-12'],
      pesach78:      ['2028-04-17', '2028-04-18'],
      shavuos:       ['2028-05-31', '2028-06-01']
    },
    { // 5789
      rh:            ['2028-09-21', '2028-09-22'],
      yk:            ['2028-09-30'],
      sukkos:        ['2028-10-05', '2028-10-06'],
      shminiSimchas: ['2028-10-12', '2028-10-13'],
      pesach12:      ['2029-03-31', '2029-04-01'],
      pesach78:      ['2029-04-06', '2029-04-07'],
      shavuos:       ['2029-05-20', '2029-05-21']
    }
  ];

  var ytNote = 'Yom Tov — not chargeable.';
  var rows = [];

  // Informational / instruction rows (blank Date so they never match a
  // real rental day in the calculator).
  rows.push(['', 'Shabbos (every Saturday)', 'n', 'Diaspora',
    'CALCULATED, not listed individually: the rental calculator treats ' +
    'WEEKDAY(date)=7 (Saturday) as a non-chargeable Shabbos. Applies to ' +
    'both Diaspora and Israel.']);
  rows.push(['', 'NOTE: Chol HaMoed & minor fasts', 'y', 'Diaspora',
    'Chol HaMoed (intermediate days of Sukkos/Pesach) and minor fasts ' +
    '(Tzom Gedaliah, Asarah B\'Teves, Taanis Esther, Shiva Asar ' +
    'B\'Tammuz) ARE chargeable — they are normal rental days.']);

  cycles.forEach(function (c) {
    // ---- Diaspora rows (two-day Yom Tov) ----
    push_(rows, c.rh[0], 'Rosh Hashanah Day 1', 'Diaspora', ytNote);
    push_(rows, c.rh[1], 'Rosh Hashanah Day 2', 'Diaspora', ytNote);
    push_(rows, c.yk[0], 'Yom Kippur', 'Diaspora', ytNote);
    push_(rows, c.sukkos[0], 'Sukkos Day 1', 'Diaspora', ytNote);
    push_(rows, c.sukkos[1], 'Sukkos Day 2', 'Diaspora', ytNote);
    push_(rows, c.shminiSimchas[0], 'Shmini Atzeres', 'Diaspora', ytNote);
    push_(rows, c.shminiSimchas[1], 'Simchas Torah', 'Diaspora', ytNote);
    push_(rows, c.pesach12[0], 'Pesach Day 1', 'Diaspora', ytNote);
    push_(rows, c.pesach12[1], 'Pesach Day 2', 'Diaspora', ytNote);
    push_(rows, c.pesach78[0], 'Pesach Day 7', 'Diaspora', ytNote);
    push_(rows, c.pesach78[1], 'Pesach Day 8', 'Diaspora', ytNote);
    push_(rows, c.shavuos[0], 'Shavuos Day 1', 'Diaspora', ytNote);
    push_(rows, c.shavuos[1], 'Shavuos Day 2', 'Diaspora', ytNote);

    // ---- Israel rows (one-day Yom Tov; RH stays two days) ----
    var ilNote = 'Israel one-day Yom Tov — not chargeable.';
    push_(rows, c.rh[0], 'Rosh Hashanah Day 1', 'Israel', ilNote);
    push_(rows, c.rh[1], 'Rosh Hashanah Day 2', 'Israel', ilNote);
    push_(rows, c.yk[0], 'Yom Kippur', 'Israel', ilNote);
    push_(rows, c.sukkos[0], 'Sukkos Day 1', 'Israel', ilNote);
    push_(rows, c.shminiSimchas[0], 'Shmini Atzeres / Simchas Torah',
      'Israel', ilNote);
    push_(rows, c.pesach12[0], 'Pesach Day 1', 'Israel', ilNote);
    push_(rows, c.pesach78[0], 'Pesach Day 7', 'Israel', ilNote);
    push_(rows, c.shavuos[0], 'Shavuos', 'Israel', ilNote);
  });

  return rows;
}

function push_(rows, isoDate, name, region, note) {
  // Store an actual Date so the cell is a real date, not text.
  var parts = isoDate.split('-');
  var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  rows.push([d, name, 'n', region, note]);
}

/* ============================================================
 * PUBLIC ENTRY POINTS
 * ============================================================ */

/**
 * Create any missing tabs and configure them. Idempotent: a tab that
 * already exists is left untouched (headers/data preserved).
 */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  SCHEMA.forEach(function (cfg) {
    var sheet = ss.getSheetByName(cfg.name);
    if (sheet) {
      // Tab exists — re-run safety: skip rebuild, leave data alone.
      return;
    }
    sheet = ss.insertSheet(cfg.name);
    buildSheet_(sheet, cfg);
  });

  ensureNamedRanges_();
  ensureOnEditTrigger_();
  removeDefaultSheet_(ss);

  SpreadsheetApp.getActive().toast('Setup complete.', 'Kosher Connect', 5);
}

/**
 * DEV ONLY. Delete every managed tab and rebuild from scratch. All data in
 * those tabs is lost. A throwaway sheet is parked first so the spreadsheet
 * never drops below one tab while we delete.
 */
function resetSetup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var parking = ss.getSheetByName('__reset_parking__') ||
                ss.insertSheet('__reset_parking__');

  // Drop named ranges we own so rebuild starts clean.
  ss.getNamedRanges().forEach(function (nr) {
    var n = nr.getName();
    if (n.indexOf('KC_') === 0) nr.remove();
  });

  // Delete every managed tab.
  SCHEMA.forEach(function (cfg) {
    var sheet = ss.getSheetByName(cfg.name);
    if (sheet) ss.deleteSheet(sheet);
  });

  // Rebuild.
  setup();

  // Remove the parking sheet now that real tabs exist.
  var p = ss.getSheetByName('__reset_parking__');
  if (p && ss.getSheets().length > 1) ss.deleteSheet(p);
}

/* ============================================================
 * SHEET BUILDERS
 * ============================================================ */

function buildSheet_(sheet, cfg) {
  var headers = cfg.headers;

  // Headers.
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#0b5394').setFontColor('#ffffff');
  sheet.setFrozenRows(1);

  // Trim spare columns so the tab is exactly as wide as its schema.
  var maxCols = sheet.getMaxColumns();
  if (maxCols > headers.length) {
    sheet.deleteColumns(headers.length + 1, maxCols - headers.length);
  }

  // Ensure the grid is tall enough for the validation/banding ranges below
  // (a new tab defaults to 1000 rows; we reference up to MAX_VALIDATION_ROW).
  if (sheet.getMaxRows() < MAX_VALIDATION_ROW) {
    sheet.insertRowsAfter(sheet.getMaxRows(),
      MAX_VALIDATION_ROW - sheet.getMaxRows());
  }

  // Dropdown data validation.
  if (cfg.validations) applyValidations_(sheet, cfg);

  // Customers: self-maintaining NormalisedEmail via a single ARRAYFORMULA.
  if (cfg.name === 'Customers') applyNormalisedEmail_(sheet, cfg);

  // Seed data (Settings, Holidays).
  if (cfg.seed && cfg.seed.length) {
    sheet.getRange(2, 1, cfg.seed.length, cfg.seed[0].length)
      .setValues(cfg.seed);
  }

  // Readability.
  applyBanding_(sheet, headers.length);
  sheet.autoResizeColumns(1, headers.length);
}

function applyValidations_(sheet, cfg) {
  var headers = cfg.headers;
  Object.keys(cfg.validations).forEach(function (colName) {
    var col = headers.indexOf(colName) + 1;
    if (col < 1) return;
    var rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(cfg.validations[colName], true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(2, col, MAX_VALIDATION_ROW - 1, 1).setDataValidation(rule);
  });
}

/**
 * NormalisedEmail (column E) is filled for the whole column by one
 * ARRAYFORMULA in E2, so it applies to every existing and future row
 * automatically — no per-row formula maintenance.
 *
 * Inner normalisation matches the spec: strip dots and any "+tag" before
 * the @, then lower-case. (The spec wrote A2; the Email column is D, so
 * the live formula references D — A is the numeric CustomerID.)
 */
function applyNormalisedEmail_(sheet, cfg) {
  var emailCol = cfg.headers.indexOf('Email') + 1;       // D
  var normCol = cfg.headers.indexOf('NormalisedEmail') + 1; // E
  var colA1 = columnLetter_(emailCol) + '2:' + columnLetter_(emailCol); // D2:D
  var formula =
    '=ARRAYFORMULA(IF(' + colA1 + '="","",' +
    'LOWER(REGEXREPLACE(REGEXREPLACE(' + colA1 + ',"\\.",""),' +
    '"\\+.*(?=@)",""))))';
  sheet.getRange(2, normCol).setFormula(formula);
}

function applyBanding_(sheet, numCols) {
  // Remove any existing banding first so re-runs don't throw.
  sheet.getBandings().forEach(function (b) { b.remove(); });
  var range = sheet.getRange(1, 1, MAX_VALIDATION_ROW, numCols);
  var banding = range.applyRowBanding(
    SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false);
  // Header already styled blue; keep banding header colour subtle.
  banding.setHeaderRowColor('#0b5394');
}

/* ============================================================
 * NAMED RANGES
 * ============================================================ */

/**
 * Named ranges so scripts/AppSheet look values up by name, never by cell
 * position. All managed ranges are prefixed KC_ so resetSetup can find and
 * drop them.
 *   KC_Settings  — Settings!A2:C  (Key | Value | Notes) for key lookups
 *   KC_Holidays  — Holidays!A2:E  for the rental calculator
 */
function ensureNamedRanges_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  setNamedRange_(ss, 'KC_Settings', 'Settings', 'A2:C' + MAX_VALIDATION_ROW);
  setNamedRange_(ss, 'KC_Holidays', 'Holidays', 'A2:E' + MAX_VALIDATION_ROW);
}

function setNamedRange_(ss, name, sheetName, a1) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;
  var existing = ss.getNamedRanges();
  for (var i = 0; i < existing.length; i++) {
    if (existing[i].getName() === name) existing[i].remove();
  }
  ss.setNamedRange(name, sheet.getRange(a1));
}

/**
 * Look up a Settings value by key without hardcoding cell positions.
 * Returns the Value cell, or `fallback` if the key is absent.
 * Usage: getSetting('RentalRate_USA', 3)
 */
function getSetting(key, fallback) {
  var rng = SpreadsheetApp.getActiveSpreadsheet()
    .getRangeByName('KC_Settings');
  if (!rng) return fallback;
  var values = rng.getValues();
  for (var i = 0; i < values.length; i++) {
    if (values[i][0] === key) return values[i][1];
  }
  return fallback;
}

/* ============================================================
 * AUTO-INCREMENT + DEFAULTS (onEdit)
 * ============================================================ */

/**
 * Simple trigger. Fires on every edit. When a row gains data in a tab whose
 * column A is an auto-ID and that ID cell is still blank, assign the next
 * sequential integer and fill any per-tab default values.
 */
function onEdit(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  var cfg = schemaFor_(sheet.getName());
  if (!cfg || !cfg.autoId) return;

  var row = e.range.getRow();
  if (row <= sheet.getFrozenRows()) return; // header

  // The edit may span multiple rows (paste). Handle each.
  var firstRow = row;
  var lastRow = e.range.getLastRow();
  for (var r = firstRow; r <= lastRow; r++) {
    maybeAssignId_(sheet, cfg, r);
  }
}

function maybeAssignId_(sheet, cfg, row) {
  var width = cfg.headers.length;
  var rowRange = sheet.getRange(row, 1, 1, width);
  var values = rowRange.getValues()[0];

  // Skip if ID already present.
  if (values[0] !== '' && values[0] !== null) return;

  // Skip fully blank rows (e.g. a clear/delete edit).
  var hasData = false;
  for (var i = 1; i < width; i++) {
    if (values[i] !== '' && values[i] !== null) { hasData = true; break; }
  }
  if (!hasData) return;

  // Assign next ID = max existing numeric ID in column A + 1.
  sheet.getRange(row, 1).setValue(nextId_(sheet));

  // Fill per-tab default values where the cell is blank.
  if (cfg.defaults) {
    Object.keys(cfg.defaults).forEach(function (colName) {
      var col = cfg.headers.indexOf(colName) + 1;
      if (col < 1) return;
      var cell = sheet.getRange(row, col);
      if (cell.getValue() === '' || cell.getValue() === null) {
        cell.setValue(cfg.defaults[colName]);
      }
    });
  }
}

function nextId_(sheet) {
  var last = sheet.getLastRow();
  if (last < 2) return 1;
  var ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  var max = 0;
  for (var i = 0; i < ids.length; i++) {
    var v = ids[i][0];
    if (typeof v === 'number' && v > max) max = v;
  }
  return max + 1;
}

/**
 * Install an onEdit trigger if one isn't already attached, so auto-ID keeps
 * working even where the simple trigger can't run.
 */
function ensureOnEditTrigger_() {
  var existing = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existing.length; i++) {
    if (existing[i].getHandlerFunction() === 'onEdit') return;
  }
  ScriptApp.newTrigger('onEdit')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();
}

/* ============================================================
 * HELPERS
 * ============================================================ */

function schemaFor_(name) {
  for (var i = 0; i < SCHEMA.length; i++) {
    if (SCHEMA[i].name === name) return SCHEMA[i];
  }
  return null;
}

function columnLetter_(col) {
  var letter = '';
  while (col > 0) {
    var rem = (col - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    col = Math.floor((col - 1) / 26);
  }
  return letter;
}

function removeDefaultSheet_(ss) {
  // A fresh spreadsheet ships with an empty "Sheet1"; drop it once our tabs
  // exist, but never leave the file with zero sheets.
  var def = ss.getSheetByName('Sheet1');
  if (def && def.getLastRow() === 0 && ss.getSheets().length > 1) {
    ss.deleteSheet(def);
  }
}
