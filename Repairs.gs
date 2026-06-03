/**
 * Repairs.gs — timer-based service charging for the Kosher Connect master sheet.
 *
 * Google Apps Script + AppSheet build (no Next.js/React).
 * Relies on the existing appendLedgerEntry(customerId, type, amount, method,
 * reference, memo) from the Ledger code.
 *
 * Tabs used (literal names): Repairs, Settings (Ledger is written via
 * appendLedgerEntry).
 */

var REPAIRS_SHEET_NAME = 'Repairs';
var SETTINGS_SHEET_NAME = 'Settings';
var TIMER_TRIGGER_HANDLER = 'chargeCompletedTimers';

/**
 * chargeCompletedTimers()
 * For a 5-minute time-driven trigger. Scans Repairs for rows where TimerStart
 * and TimerStop are both set AND TimerSeconds is empty/0 (not yet charged),
 * charges the customer's wallet for the elapsed service time, then writes
 * elapsedSeconds into TimerSeconds to mark the row charged.
 *
 * The TimerSeconds cell IS the double-charge guard: once set (non-zero), the
 * row is skipped on the next sweep. Each row is wrapped in try/catch so one
 * bad row can't stop the loop.
 */
function chargeCompletedTimers() {
  var sheet = getSheetOrThrow_(REPAIRS_SHEET_NAME);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log('chargeCompletedTimers: no repair rows to scan.');
    return;
  }

  var index = headerIndex_(sheet);
  var required = ['RepairID', 'CustomerID', 'TimerStart', 'TimerStop', 'TimerSeconds'];
  for (var r = 0; r < required.length; r++) {
    if (!index.hasOwnProperty(required[r])) {
      throw new Error('"' + REPAIRS_SHEET_NAME + '" tab is missing a "' + required[r] + '" column.');
    }
  }

  var idCol = index['RepairID'];
  var custCol = index['CustomerID'];
  var startCol = index['TimerStart'];
  var stopCol = index['TimerStop'];
  var secsCol = index['TimerSeconds'];

  var minCharge = Number(getSettingValue_('OnlineServices_MinCharge'));
  var hourlyRate = Number(getSettingValue_('OnlineServices_HourlyRate'));
  if (isNaN(minCharge) || isNaN(hourlyRate)) {
    throw new Error('chargeCompletedTimers: OnlineServices_MinCharge / OnlineServices_HourlyRate ' +
                    'missing or non-numeric in the "' + SETTINGS_SHEET_NAME + '" tab.');
  }

  var width = sheet.getLastColumn();
  var data = sheet.getRange(2, 1, lastRow - 1, width).getValues();

  var charged = 0;

  for (var i = 0; i < data.length; i++) {
    var sheetRow = i + 2;
    var row = data[i];

    try {
      var startMs = toMillis_(row[startCol]);
      var stopMs = toMillis_(row[stopCol]);

      // Both timers must be set.
      if (isNaN(startMs) || isNaN(stopMs)) continue;

      // Skip rows already charged (TimerSeconds set and non-zero).
      if (!isUncharged_(row[secsCol])) continue;

      var elapsedSeconds = Math.round((stopMs - startMs) / 1000);
      if (elapsedSeconds <= 0) {
        Logger.log('chargeCompletedTimers: RepairID ' + row[idCol] +
                   ' has non-positive elapsed time (' + elapsedSeconds + 's) — skipping.');
        continue;
      }

      var repairId = row[idCol];
      var customerId = row[custCol];
      var charge = Math.max(minCharge, round2_(elapsedSeconds / 3600 * hourlyRate));
      var minutes = Math.round(elapsedSeconds / 60);

      appendLedgerEntry(
        customerId,
        'Charge',
        -charge,
        '',
        'TIMER-' + repairId,
        'Service time ' + minutes + ' min'
      );

      // Mark charged — this is the double-charge guard for the next sweep.
      sheet.getRange(sheetRow, secsCol + 1).setValue(elapsedSeconds);

      Logger.log('chargeCompletedTimers: charged ' + charge + ' to CustomerID ' + customerId +
                 ' for RepairID ' + repairId + ' (' + elapsedSeconds + 's, ' + minutes + ' min).');
      charged++;

    } catch (e) {
      Logger.log('chargeCompletedTimers: error on row ' + sheetRow +
                 ' (RepairID ' + row[idCol] + '): ' + e.message);
    }
  }

  Logger.log('chargeCompletedTimers: charged ' + charged + ' timer(s).');
}

/**
 * createTimerTrigger()
 * Installs the every-5-minutes time-driven trigger for chargeCompletedTimers.
 * Skips creation if one already exists (so it can't be installed twice).
 */
function createTimerTrigger() {
  var existing = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === TIMER_TRIGGER_HANDLER;
  });
  if (existing.length > 0) {
    Logger.log('createTimerTrigger: a trigger for ' + TIMER_TRIGGER_HANDLER + ' already exists — skipping.');
    return;
  }

  ScriptApp.newTrigger(TIMER_TRIGGER_HANDLER)
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log('createTimerTrigger: installed 5-minute trigger for ' + TIMER_TRIGGER_HANDLER + '.');
}

/**
 * deleteTimerTrigger()
 * Removes any time-driven triggers for chargeCompletedTimers.
 */
function deleteTimerTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === TIMER_TRIGGER_HANDLER) {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }
  Logger.log('deleteTimerTrigger: removed ' + removed + ' trigger(s) for ' + TIMER_TRIGGER_HANDLER + '.');
}

/* ================================================================== *
 * Private helpers
 * ================================================================== */

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

/** Reads a Settings value by Key (literal "Settings" tab, Key/Value columns). */
function getSettingValue_(key) {
  var sheet = getSheetOrThrow_(SETTINGS_SHEET_NAME);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return undefined;

  var index = headerIndex_(sheet);
  var keyCol = index.hasOwnProperty('Key') ? index['Key'] : 0;
  var valCol = index.hasOwnProperty('Value') ? index['Value'] : 1;

  var width = Math.max(keyCol, valCol) + 1;
  var data = sheet.getRange(2, 1, lastRow - 1, width).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][keyCol]).trim() === key) return data[i][valCol];
  }
  return undefined;
}

/** True when a TimerSeconds cell is empty or zero (i.e. not yet charged). */
function isUncharged_(v) {
  if (v === '' || v === null || v === undefined) return true;
  return Number(v) === 0;
}

/** Parses a cell value (Date or string) to epoch milliseconds, or NaN. */
function toMillis_(v) {
  if (v === '' || v === null || v === undefined) return NaN;
  if (Object.prototype.toString.call(v) === '[object Date]') return v.getTime();
  var t = new Date(v).getTime();
  return isNaN(t) ? NaN : t;
}

/** Rounds to 2 decimal places. */
function round2_(n) {
  return Math.round(n * 100) / 100;
}
