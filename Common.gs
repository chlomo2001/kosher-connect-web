/**
 * Kosher Connect — Common.gs
 * Shared helpers used across the whole bound project (RentalEngine.gs,
 * SIMWatcher.gs, Bookings.gs, Repairs.gs, Seed.gs). Each helper here is
 * defined EXACTLY ONCE; no other file should redefine these names.
 *
 *   getSettingValue(key)            single source of truth for Settings rates
 *   round2_(x)                      round to 2 decimal places
 *   findRowById_(sheet, id)         find a row by column-A id → { row, values }
 *   nextIdInColumnA_(sheet)         next sequential numeric id (max col A + 1)
 *   idNameMap_(sheet, colId, colVal)  id → value lookup map
 *   headerIndex_(sheet)             header name → 0-based column index
 *   appendTask_(sheet, title, priority, rawText)   append a Tasks row
 */

/* Per-execution cache for the Settings tab (reset on each invocation). */
var _kcSettings = null;

/**
 * Look up a key in the Settings tab and return its Value as a number.
 * Throws if the key is missing — a missing rate must fail loudly, never
 * silently price at 0. This is the ONLY place rates are read; never hardcode.
 */
function getSettingValue(key) {
  if (!_kcSettings) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');
    if (!sheet) throw new Error('Settings tab not found.');
    var last = sheet.getLastRow();
    _kcSettings = {};
    if (last >= 2) {
      var rows = sheet.getRange(2, 1, last - 1, 2).getValues(); // Key | Value
      for (var i = 0; i < rows.length; i++) {
        var k = String(rows[i][0]).trim();
        if (k) _kcSettings[k] = rows[i][1];
      }
    }
  }
  if (!(key in _kcSettings)) {
    throw new Error('Setting not found: ' + key);
  }
  return Number(_kcSettings[key]);
}

/** Round to 2 decimal places. */
function round2_(x) {
  return Math.round((Number(x) || 0) * 100) / 100;
}

/** Find a row by id in column A. Returns { row, values } (row is 1-based). */
function findRowById_(sheet, id) {
  var last = sheet.getLastRow();
  if (last < 2) return null;
  var width = sheet.getLastColumn();
  var data = sheet.getRange(2, 1, last - 1, width).getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === id) return { row: i + 2, values: data[i] };
  }
  return null;
}

/** Next sequential id = max numeric value in column A + 1. */
function nextIdInColumnA_(sheet) {
  var last = sheet.getLastRow();
  if (last < 2) return 1;
  var vals = sheet.getRange(2, 1, last - 1, 1).getValues();
  var max = 0;
  for (var i = 0; i < vals.length; i++) {
    var v = vals[i][0];
    if (typeof v === 'number' && v > max) max = v;
  }
  return max + 1;
}

/** Map id (colId) → value (colVal), both 1-based, for a lookup sheet. */
function idNameMap_(sheet, colId, colVal) {
  var map = {};
  if (!sheet) return map;
  var last = sheet.getLastRow();
  if (last < 2) return map;
  var width = sheet.getLastColumn();
  var data = sheet.getRange(2, 1, last - 1, width).getValues();
  for (var i = 0; i < data.length; i++) {
    map[data[i][colId - 1]] = data[i][colVal - 1];
  }
  return map;
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

/**
 * Append a Tasks row. TaskID is computed here (max + 1) because script writes
 * don't fire the onEdit auto-numbering trigger. Source is always "Auto",
 * DueDate = today, Done = "n", CreatedAt = now. Columns are addressed by
 * header name so column order can't misalign the write.
 *
 * Tasks columns: TaskID, Title, DueDate, Source, Priority, Done, RawText, CreatedAt
 */
function appendTask_(tasksSheet, title, priority, rawText) {
  var idx = headerIndex_(tasksSheet);
  var width = tasksSheet.getLastColumn();
  var now = new Date();

  var row = new Array(width).fill('');
  row[idx['TaskID']] = nextIdInColumnA_(tasksSheet);
  row[idx['Title']] = title;
  row[idx['DueDate']] = now;
  row[idx['Source']] = 'Auto';
  row[idx['Priority']] = priority;
  row[idx['Done']] = 'n';
  row[idx['RawText']] = rawText;
  row[idx['CreatedAt']] = now;

  tasksSheet.appendRow(row);
}
