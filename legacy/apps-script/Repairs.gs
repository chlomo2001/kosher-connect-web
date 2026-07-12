/**
 * Kosher Connect — Repairs, price list & work timer
 * Companion to RentalEngine.gs / SIMWatcher.gs / Ledger.gs / Bookings.gs.
 *
 *   getPriceList(activeOnly)              price list as objects
 *   addPriceListItem(name, cat, price)    append a service (Active="y")
 *   updatePriceListItem(id, ...)          edit in place (retire via Active="n")
 *   openRepair(custId, desc, ids, notes)  open a ticket, price locked in
 *   updateRepairStatus(repairId, status)  status (+ ClosedAt on Collected)
 *   getRepairsForCustomer(customerId)     a customer's repairs, newest first
 *   getOpenRepairs()                      Open/In Progress, oldest first
 *   chargeCompletedTimers()               5-min sweep: bill finished timers
 *   createTimerTrigger() / deleteTimerTrigger()
 *
 * Timer model: ONE system only — the timestamp sweep. AppSheet (or whatever
 * front end) writes TimerStart and TimerStop on the Repairs row; the 5-minute
 * chargeCompletedTimers sweep bills the elapsed time and writes elapsedSeconds
 * into TimerSeconds, which is the charged-flag. (The old ScriptProperties
 * startTimer/stopTimer has been removed.)
 *
 * Reuses (same project, do NOT redefine):
 *   - getSettingValue, round2_, findRowById_, nextIdInColumnA_  (RentalEngine.gs)
 *   - appendTask_, lookupCustomerName_                          (SIMWatcher.gs)
 *   - appendLedgerEntry                                         (Ledger.gs)
 *   - headerIndex_                                              (Bookings.gs)
 *
 * appendLedgerEntry(customerId, type, amount, method, reference, memo) derives
 * the sign from `type`, so a 'Charge' is passed a POSITIVE magnitude.
 *
 * All columns are referenced by header name via headerIndex_ — never by a
 * fixed index — so adding/reordering columns can't misalign reads or writes.
 */

var KC_REPAIR_STATUSES = ['Open', 'In Progress', 'Done', 'Collected'];
var TIMER_TRIGGER_HANDLER = 'chargeCompletedTimers';

/* ============================================================
 * 1–3. PRICE LIST
 * ============================================================ */

/** Price list as objects. If activeOnly, only rows with Active = "y". */
function getPriceList(activeOnly) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('PriceList');
  var out = [];
  if (!sheet) return out;
  var last = sheet.getLastRow();
  if (last < 2) return out;

  var idx = headerIndex_(sheet);
  var width = sheet.getLastColumn();
  var data = sheet.getRange(2, 1, last - 1, width).getValues();
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var active = String(row[idx['Active']]).trim().toLowerCase();
    if (activeOnly && active !== 'y') continue;
    out.push({
      serviceId: row[idx['ServiceID']],
      name: row[idx['Name']],
      category: row[idx['Category']],
      price: Number(row[idx['Price']]) || 0,
      active: row[idx['Active']]
    });
  }
  return out;
}

/**
 * Append a new service (Active = "y"). ServiceID is computed here (script
 * writes don't fire the onEdit auto-number trigger). Returns the ServiceID.
 */
function addPriceListItem(name, category, price) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('PriceList');
  if (!sheet) throw new Error('"PriceList" tab not found.');
  var idx = headerIndex_(sheet);
  var width = sheet.getLastColumn();
  var serviceId = nextIdInColumnA_(sheet);
  var row = kcRowFromObject_(idx, width, {
    ServiceID: serviceId,
    Name: name,
    Category: category,
    Price: Number(price) || 0,
    Active: 'y'
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, width).setValues([row]);
  return serviceId;
}

/**
 * Update Name/Category/Price/Active on the row with this ServiceID. Rows are
 * never deleted — retire a service with active = "n". Returns the updated row
 * as an object, or { error } if not found.
 */
function updatePriceListItem(serviceId, name, category, price, active) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('PriceList');
  if (!sheet) return { error: 'PriceList tab not found' };
  var idx = headerIndex_(sheet);
  var found = findRowById_(sheet, serviceId);
  if (!found) return { error: 'ServiceID not found: ' + serviceId };

  sheet.getRange(found.row, idx['Name'] + 1).setValue(name);
  sheet.getRange(found.row, idx['Category'] + 1).setValue(category);
  sheet.getRange(found.row, idx['Price'] + 1).setValue(Number(price) || 0);
  sheet.getRange(found.row, idx['Active'] + 1).setValue(active);

  return {
    serviceId: serviceId,
    name: name,
    category: category,
    price: Number(price) || 0,
    active: active
  };
}

/* ============================================================
 * 4. OPEN REPAIR
 * ============================================================ */

/**
 * Open a repair ticket. The selected services' CURRENT prices are looked up
 * and frozen into the Services column as "Name:£Price, …" so later price-list
 * changes never alter this ticket. Total = sum of those prices.
 * Returns { repairId, total }.
 */
function openRepair(customerId, deviceDescription, selectedServiceIds, notes) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var priceMap = priceListMap_();
  var ids = normaliseIdList_(selectedServiceIds);

  var parts = [];
  var total = 0;
  for (var i = 0; i < ids.length; i++) {
    var svc = priceMap[ids[i]];
    if (!svc) { Logger.log('openRepair: unknown ServiceID ' + ids[i]); continue; }
    parts.push(svc.name + ':£' + svc.price);
    total += svc.price;
  }
  total = round2_(total);

  var repairsSheet = ss.getSheetByName('Repairs');
  if (!repairsSheet) throw new Error('"Repairs" tab not found.');
  var idx = headerIndex_(repairsSheet);
  var width = repairsSheet.getLastColumn();
  var repairId = nextIdInColumnA_(repairsSheet);
  var now = new Date();

  var row = kcRowFromObject_(idx, width, {
    RepairID: repairId,
    CustomerID: customerId,
    DeviceDescription: deviceDescription,
    Services: parts.join(', '),
    Total: total,
    Status: 'Open',
    OpenedAt: now,
    Notes: notes || ''
  });
  repairsSheet.getRange(repairsSheet.getLastRow() + 1, 1, 1, width).setValues([row]);

  var customerName = lookupCustomerName_(ss.getSheetByName('Customers'),
    customerId) || ('Customer #' + customerId);
  appendTask_(ss.getSheetByName('Tasks'),
    'New repair — ' + customerName + ' — ' + deviceDescription,
    'Normal',
    'Repair ' + repairId + ': ' + parts.join(', '));

  return { repairId: repairId, total: total };
}

/* ============================================================
 * 5. UPDATE REPAIR STATUS
 * ============================================================ */

/** Set a repair's Status (and ClosedAt when Collected). Returns the row obj. */
function updateRepairStatus(repairId, status) {
  if (KC_REPAIR_STATUSES.indexOf(status) < 0) {
    return { error: 'Invalid status "' + status + '". Use one of: ' +
      KC_REPAIR_STATUSES.join(', ') };
  }
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Repairs');
  if (!sheet) return { error: 'Repairs tab not found' };
  var idx = headerIndex_(sheet);
  var found = findRowById_(sheet, repairId);
  if (!found) return { error: 'RepairID not found: ' + repairId };

  sheet.getRange(found.row, idx['Status'] + 1).setValue(status);
  if (status === 'Collected') {
    sheet.getRange(found.row, idx['ClosedAt'] + 1).setValue(new Date());
  }

  var width = sheet.getLastColumn();
  var rowValues = sheet.getRange(found.row, 1, 1, width).getValues()[0];
  return repairObj_(rowValues, idx);
}

/* ============================================================
 * 6. WORK TIMER — 5-MINUTE SWEEP
 * ============================================================ */

/**
 * For a 5-minute time-driven trigger. Scans Repairs for rows where TimerStart
 * and TimerStop are both set AND TimerSeconds is empty/0 (not yet charged):
 *
 *   elapsedSeconds = round((TimerStop − TimerStart) / 1000)
 *   charge = max(OnlineServices_MinCharge,
 *                round2_(elapsedSeconds / 3600 × OnlineServices_HourlyRate))
 *   appendLedgerEntry(customerId, 'Charge', charge, '', 'TIMER-'+RepairID,
 *                     'Service time ' + mins + ' min')      // positive magnitude
 *
 * Then writes elapsedSeconds into TimerSeconds to mark the row charged.
 *
 * Dedupe: the ledger Reference 'TIMER-'+RepairID is the key — if a Ledger row
 * already carries it, the charge is skipped (and TimerSeconds is back-filled so
 * the row stops being rescanned). TimerSeconds being set is the second guard.
 * Each row is wrapped in try/catch so one bad row can't stop the loop.
 */
function chargeCompletedTimers() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Repairs');
  if (!sheet) throw new Error('"Repairs" tab not found.');
  var last = sheet.getLastRow();
  if (last < 2) {
    Logger.log('chargeCompletedTimers: no repair rows to scan.');
    return;
  }

  var idx = headerIndex_(sheet);
  var required = ['RepairID', 'CustomerID', 'TimerStart', 'TimerStop', 'TimerSeconds'];
  for (var r = 0; r < required.length; r++) {
    if (!idx.hasOwnProperty(required[r])) {
      throw new Error('"Repairs" tab is missing a "' + required[r] + '" column.');
    }
  }

  var minCharge = Number(getSettingValue('OnlineServices_MinCharge'));
  var hourlyRate = Number(getSettingValue('OnlineServices_HourlyRate'));
  if (isNaN(minCharge) || isNaN(hourlyRate)) {
    throw new Error('chargeCompletedTimers: OnlineServices_MinCharge / ' +
      'OnlineServices_HourlyRate missing or non-numeric in the "Settings" tab.');
  }

  var existingRefs = ledgerReferenceSet_();
  var width = sheet.getLastColumn();
  var data = sheet.getRange(2, 1, last - 1, width).getValues();
  var charged = 0;

  for (var i = 0; i < data.length; i++) {
    var sheetRow = i + 2;
    var row = data[i];

    try {
      var startMs = toMillis_(row[idx['TimerStart']]);
      var stopMs = toMillis_(row[idx['TimerStop']]);

      // Both timers must be set.
      if (isNaN(startMs) || isNaN(stopMs)) continue;

      // Skip rows already charged (TimerSeconds holds a positive integer).
      if (!isUncharged_(row[idx['TimerSeconds']])) continue;

      var elapsedSeconds = Math.round((stopMs - startMs) / 1000);
      if (elapsedSeconds <= 0) {
        Logger.log('chargeCompletedTimers: RepairID ' + row[idx['RepairID']] +
          ' has non-positive elapsed time (' + elapsedSeconds + 's) — skipping.');
        continue;
      }

      var repairId = row[idx['RepairID']];
      var reference = 'TIMER-' + repairId;

      // Dedupe on the ledger reference.
      if (existingRefs[reference]) {
        sheet.getRange(sheetRow, idx['TimerSeconds'] + 1).setValue(elapsedSeconds);
        Logger.log('chargeCompletedTimers: ledger already has ' + reference +
          ' — back-filled TimerSeconds, no new charge for RepairID ' + repairId + '.');
        continue;
      }

      var customerId = row[idx['CustomerID']];
      var charge = Math.max(minCharge, round2_(elapsedSeconds / 3600 * hourlyRate));
      var mins = Math.round(elapsedSeconds / 60);

      // Positive magnitude — appendLedgerEntry derives the sign from 'Charge'.
      appendLedgerEntry(customerId, 'Charge', charge, '', reference,
        'Service time ' + mins + ' min');
      existingRefs[reference] = true;

      // Mark charged — TimerSeconds is the charged-flag for the next sweep.
      sheet.getRange(sheetRow, idx['TimerSeconds'] + 1).setValue(elapsedSeconds);

      Logger.log('chargeCompletedTimers: charged ' + charge + ' to CustomerID ' +
        customerId + ' for RepairID ' + repairId + ' (' + elapsedSeconds +
        's, ' + mins + ' min).');
      charged++;

    } catch (e) {
      Logger.log('chargeCompletedTimers: error on row ' + sheetRow +
        ' (RepairID ' + row[idx['RepairID']] + '): ' + e.message);
    }
  }

  Logger.log('chargeCompletedTimers: charged ' + charged + ' timer(s).');
}

/**
 * Installs the every-5-minutes time-driven trigger for chargeCompletedTimers.
 * Skips creation if one already exists (so it can't be installed twice).
 */
function createTimerTrigger() {
  var existing = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === TIMER_TRIGGER_HANDLER;
  });
  if (existing.length > 0) {
    Logger.log('createTimerTrigger: a trigger for ' + TIMER_TRIGGER_HANDLER +
      ' already exists — skipping.');
    return;
  }

  ScriptApp.newTrigger(TIMER_TRIGGER_HANDLER)
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log('createTimerTrigger: installed 5-minute trigger for ' + TIMER_TRIGGER_HANDLER + '.');
}

/** Removes any time-driven triggers for chargeCompletedTimers. */
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

/**
 * fixLegacyTimerSeconds(apply)
 * One-off cleanup for stale TimerSeconds values left by the old timer system
 * (e.g. a "71170"-type integer, or a Date/duration value) on rows that were
 * never actually billed by the sweep — i.e. there is no 'TIMER-'+RepairID
 * entry in the Ledger. Clearing those cells lets chargeCompletedTimers bill
 * the row correctly on its next run.
 *
 * REPORT-ONLY by default: it logs exactly which cells it WOULD clear and
 * changes nothing. Eyeball the log, then run fixLegacyTimerSeconds(true) to
 * apply. Always report-first for a bulk fix that touches money.
 *
 * A row is left untouched when TimerSeconds is blank, or when the Ledger
 * already has its 'TIMER-'+RepairID entry (a legitimately charged row).
 */
function fixLegacyTimerSeconds(apply) {
  var doApply = (apply === true);
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Repairs');
  if (!sheet) throw new Error('"Repairs" tab not found.');
  var last = sheet.getLastRow();
  if (last < 2) {
    Logger.log('fixLegacyTimerSeconds: no repair rows to scan.');
    return;
  }

  var idx = headerIndex_(sheet);
  if (!idx.hasOwnProperty('RepairID') || !idx.hasOwnProperty('TimerSeconds')) {
    throw new Error('"Repairs" tab missing a RepairID or TimerSeconds column.');
  }

  var existingRefs = ledgerReferenceSet_();
  var width = sheet.getLastColumn();
  var data = sheet.getRange(2, 1, last - 1, width).getValues();

  var candidates = 0;
  var cleared = 0;

  Logger.log('fixLegacyTimerSeconds: ' + (doApply ? 'APPLY' : 'REPORT-ONLY') + ' mode.');

  for (var i = 0; i < data.length; i++) {
    var sheetRow = i + 2;
    var ts = data[i][idx['TimerSeconds']];

    if (ts === '' || ts === null || ts === undefined) continue; // nothing to clear

    var repairId = data[i][idx['RepairID']];
    var reference = 'TIMER-' + repairId;
    if (existingRefs[reference]) continue; // legitimately charged — leave it

    candidates++;
    var shown = (Object.prototype.toString.call(ts) === '[object Date]')
      ? ('Date(' + ts + ')')
      : (String(ts) + ' [' + typeof ts + ']');
    Logger.log('  row ' + sheetRow + '  RepairID ' + repairId +
      '  TimerSeconds=' + shown + '  — no ' + reference +
      ' in Ledger → ' + (doApply ? 'CLEARED' : 'would clear'));

    if (doApply) {
      sheet.getRange(sheetRow, idx['TimerSeconds'] + 1).clearContent();
      cleared++;
    }
  }

  if (doApply) {
    Logger.log('fixLegacyTimerSeconds: cleared ' + cleared + ' of ' +
      candidates + ' stale TimerSeconds cell(s).');
  } else {
    Logger.log('fixLegacyTimerSeconds: ' + candidates +
      ' stale TimerSeconds cell(s) would be cleared. ' +
      'Re-run as fixLegacyTimerSeconds(true) to apply.');
  }
}

/* ============================================================
 * 7–8. REPAIR QUERIES
 * ============================================================ */

/** All repairs for a customer, newest first (by OpenedAt then RepairID). */
function getRepairsForCustomer(customerId) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Repairs');
  var out = [];
  if (!sheet) return out;
  var last = sheet.getLastRow();
  if (last < 2) return out;

  var idx = headerIndex_(sheet);
  var width = sheet.getLastColumn();
  var data = sheet.getRange(2, 1, last - 1, width).getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][idx['CustomerID']] === customerId) out.push(repairObj_(data[i], idx));
  }
  out.sort(function (a, b) {
    var ta = a.openedAt ? new Date(a.openedAt).getTime() : 0;
    var tb = b.openedAt ? new Date(b.openedAt).getTime() : 0;
    if (tb !== ta) return tb - ta;        // newest first
    return b.repairId - a.repairId;
  });
  return out;
}

/** Open / In Progress repairs, oldest first (for the Action Center). */
function getOpenRepairs() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Repairs');
  var out = [];
  if (!sheet) return out;
  var last = sheet.getLastRow();
  if (last < 2) return out;

  var idx = headerIndex_(sheet);
  var width = sheet.getLastColumn();
  var data = sheet.getRange(2, 1, last - 1, width).getValues();
  for (var i = 0; i < data.length; i++) {
    var status = String(data[i][idx['Status']]).trim();
    if (status === 'Open' || status === 'In Progress') {
      out.push(repairObj_(data[i], idx));
    }
  }
  out.sort(function (a, b) {
    var ta = a.openedAt ? new Date(a.openedAt).getTime() : 0;
    var tb = b.openedAt ? new Date(b.openedAt).getTime() : 0;
    return ta - tb;                        // oldest first
  });
  return out;
}

/* ============================================================
 * HELPERS (uniquely named — not defined elsewhere in the project)
 * ============================================================ */

/** Map ServiceID → { name, category, price, active }. */
function priceListMap_() {
  var map = {};
  var list = getPriceList(false);
  for (var i = 0; i < list.length; i++) map[list[i].serviceId] = list[i];
  return map;
}

/** Normalise selected ids (array or comma string) to an array of numbers. */
function normaliseIdList_(ids) {
  if (ids === undefined || ids === null || ids === '') return [];
  var arr = Array.isArray(ids) ? ids : String(ids).split(',');
  var out = [];
  for (var i = 0; i < arr.length; i++) {
    var n = Number(String(arr[i]).trim());
    if (!isNaN(n)) out.push(n);
  }
  return out;
}

/** Build a Repairs row object, addressing every column by header name. */
function repairObj_(row, idx) {
  function val(name) { return idx.hasOwnProperty(name) ? row[idx[name]] : ''; }
  return {
    repairId: val('RepairID'),
    customerId: val('CustomerID'),
    deviceDescription: val('DeviceDescription'),
    services: val('Services'),
    total: Number(val('Total')) || 0,
    status: val('Status'),
    openedAt: val('OpenedAt'),
    closedAt: val('ClosedAt'),
    timerSeconds: Number(val('TimerSeconds')) || 0,
    timerStart: val('TimerStart'),
    timerStop: val('TimerStop'),
    notes: val('Notes')
  };
}

/**
 * Builds a row array of the given width, placing each value at its column by
 * header name (everything else blank). Logs and drops values for unknown
 * headers rather than writing them to the wrong column.
 */
function kcRowFromObject_(idx, width, valuesObj) {
  var row = [];
  for (var c = 0; c < width; c++) row.push('');
  Object.keys(valuesObj).forEach(function (k) {
    if (idx.hasOwnProperty(k)) row[idx[k]] = valuesObj[k];
    else Logger.log('kcRowFromObject_: no "' + k + '" column — value dropped.');
  });
  return row;
}

/** Set of all non-empty Ledger References (literal "Ledger" tab). */
function ledgerReferenceSet_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Ledger');
  if (!sheet) throw new Error('"Ledger" tab not found.');
  var set = {};
  var last = sheet.getLastRow();
  if (last < 2) return set;

  var idx = headerIndex_(sheet);
  if (!idx.hasOwnProperty('Reference')) {
    throw new Error('"Ledger" tab has no "Reference" column.');
  }
  var refs = sheet.getRange(2, idx['Reference'] + 1, last - 1, 1).getValues();
  for (var i = 0; i < refs.length; i++) {
    var ref = String(refs[i][0]).trim();
    if (ref !== '') set[ref] = true;
  }
  return set;
}

/**
 * True when a TimerSeconds cell does NOT represent a completed charge, so the
 * sweep should proceed. A row counts as "already charged" ONLY when the cell
 * holds a positive integer second-count (what chargeCompletedTimers writes).
 * Everything else — blank, zero, negative, non-integer, non-numeric text, or a
 * Date/duration value — is treated as "not charged, proceed", so a stray
 * format or value can never permanently block a charge.
 */
function isUncharged_(v) {
  if (v === '' || v === null || v === undefined) return true;          // blank
  if (Object.prototype.toString.call(v) === '[object Date]') return true; // date/duration
  var n = Number(v);
  if (!isFinite(n)) return true;        // non-numeric text
  if (n <= 0) return true;              // zero / negative
  if (Math.floor(n) !== n) return true; // non-integer
  return false;                         // positive integer → already charged
}

/** Parses a cell value (Date or string) to epoch milliseconds, or NaN. */
function toMillis_(v) {
  if (v === '' || v === null || v === undefined) return NaN;
  if (Object.prototype.toString.call(v) === '[object Date]') return v.getTime();
  var t = new Date(v).getTime();
  return isNaN(t) ? NaN : t;
}
