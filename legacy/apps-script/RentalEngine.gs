/**
 * Kosher Connect — Rental pricing & lifecycle
 * Companion to Code.gs / SIMWatcher.gs / CustomerOnboarding.gs / Common.gs.
 *
 *   isNonChargeableDay(date, region)           Shabbos + Yom Tov check
 *   countChargeableDays(start, due, region)    inclusive chargeable-day count
 *   calcRental(country, start, due, vn, region) price breakdown
 *   calcReturn(rentalId, actualReturn, ...)    finalise a rental on return
 *   bookRental(custId, country, phoneId, ...)  create a Rentals row
 *   checkOverdueRentals()                      daily sweep → Overdue + Tasks
 *   createRentalTrigger()                      run ONCE to install daily trigger
 *
 * Shared helpers (getSettingValue, round2_, findRowById_, nextIdInColumnA_,
 * idNameMap_) now live in Common.gs — defined once there, used here.
 *
 * Rentals columns (1-based):
 *   1 RentalID  2 CustomerID  3 Country  4 PhoneID  5 StartDate
 *   6 ReturnDueDate  7 ActualReturnDate  8 VirtualNumber  9 ChargeableDays
 *   10 PriceCalc  11 LateDays  12 LateFee  13 DamageCharges  14 Total
 *   15 Status  16 ChecklistPhone  17 ChecklistSIM  18 ChecklistPlug
 *   19 ChecklistWire
 * Phones columns: 1 PhoneID 2 Make 3 Model 4 IMEI 5 Serial 6 PoolID
 *   7 Status 8 Condition 9 Notes
 *
 * Country tokens used by these functions: USA, UKUKmins, UKIntl, Israel,
 * Canada (matching the Settings keys, e.g. RentalRate_UKUKmins). The Rentals
 * tab's dropdown stores the dashed display form (UK-UKmins / UK-Intl); the
 * helpers below normalise between the two, so either form reads correctly.
 */

/* Per-execution cache (resets on every Apps Script invocation). */
var _kcHolidays = null;

/* ============================================================
 * 1. NON-CHARGEABLE DAY
 * ============================================================ */

/**
 * True if `date` should not be charged for the given region.
 *   (a) Saturday (Sheets WEEKDAY=7 / JS getDay()=6) → true, any region.
 *   (b) a Holidays row matches the date, Chargeable="n", and Region matches.
 */
function isNonChargeableDay(date, region) {
  var d = toDate_(date);
  if (!d) return false;
  if (d.getDay() === 6) return true; // Saturday = Shabbos

  if (!_kcHolidays) {
    _kcHolidays = {};
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Holidays');
    if (sheet) {
      var last = sheet.getLastRow();
      if (last >= 2) {
        // Date | HebrewName | Chargeable | Region
        var rows = sheet.getRange(2, 1, last - 1, 4).getValues();
        for (var i = 0; i < rows.length; i++) {
          var hd = toDate_(rows[i][0]);
          if (!hd) continue; // informational rows have a blank Date
          var chargeable = String(rows[i][2]).trim().toLowerCase();
          if (chargeable !== 'n') continue;
          var rgn = String(rows[i][3]).trim();
          _kcHolidays[dateKey_(hd) + '|' + rgn] = true;
        }
      }
    }
  }
  return _kcHolidays[dateKey_(d) + '|' + String(region).trim()] === true;
}

/* ============================================================
 * 2. CHARGEABLE DAY COUNT
 * ============================================================ */

/**
 * Count chargeable days from startDate to returnDueDate INCLUSIVE. The start
 * date itself is day 1. Returns 0 if the range is empty/inverted.
 */
function countChargeableDays(startDate, returnDueDate, region) {
  var d = toDate_(startDate);
  var end = toDate_(returnDueDate);
  if (!d || !end) return 0;

  var count = 0;
  while (d.getTime() <= end.getTime()) {
    if (!isNonChargeableDay(d, region)) count++;
    d = addDays_(d, 1);
  }
  return count;
}

/* ============================================================
 * 3. RENTAL PRICE
 * ============================================================ */

/**
 * Price breakdown for a rental.
 * Returns { chargeableDays, basePrice, afterMin, afterCap, vnAddOn, subtotal }.
 */
function calcRental(country, startDate, returnDueDate, vnOption, region) {
  var key = countryKey_(country);
  if (!region) region = (key === 'Israel') ? 'Israel' : 'Diaspora';

  var rate = getSettingValue('RentalRate_' + key);
  var min = getSettingValue('RentalMin_' + key);
  var cap = getSettingValue('RentalCap_' + key);

  var chargeableDays = countChargeableDays(startDate, returnDueDate, region);
  var basePrice = round2_(chargeableDays * rate);

  // Minimum: only when at least one chargeable day exists. Zero days = £0.
  var afterMin;
  if (chargeableDays === 0) {
    afterMin = 0;
  } else {
    afterMin = basePrice < min ? min : basePrice;
  }

  // Cap applies to the daily-rate calculation only (before add-ons/late fees).
  var afterCap = afterMin > cap ? cap : afterMin;

  // Virtual number add-on.
  var vk = vnKey_(vnOption);
  var vnAddOn = 0;
  if (vk === 'weekly') vnAddOn = getSettingValue('VN_Weekly');
  else if (vk === '30day') vnAddOn = getSettingValue('VN_30day');

  var subtotal = round2_(afterCap + vnAddOn);

  return {
    chargeableDays: chargeableDays,
    basePrice: basePrice,
    afterMin: round2_(afterMin),
    afterCap: round2_(afterCap),
    vnAddOn: round2_(vnAddOn),
    subtotal: subtotal
  };
}

/* ============================================================
 * 4. RETURN / FINALISE
 * ============================================================ */

/**
 * Finalise a rental on return. Looks up the Rentals row, computes late fee and
 * damage charges, writes the figures back, sets Status="Returned", and returns
 * a summary. Checklist args are truthy = item returned OK; false/"n"/"no" =
 * missing/damaged.
 */
function calcReturn(rentalId, actualReturnDate, checklistPhone, checklistSIM,
                    checklistPlug, checklistWire) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Rentals');
  var found = findRowById_(sheet, rentalId);
  if (!found) return { error: 'Rental not found: ' + rentalId };

  var r = found.values;
  var country = r[2];                 // col 3
  var returnDue = toDate_(r[5]);      // col 6
  var subtotal = Number(r[9]) || 0;   // col 10 PriceCalc
  var actual = toDate_(actualReturnDate);

  // Late days = whole days past the due date (never negative).
  var lateDays = Math.max(0, dayDiff_(actual, returnDue));
  var lateFee = round2_(lateDays * getSettingValue('LateReturn_PerDay'));

  // Damage: charge for missing/damaged Phone and Plug; SIM & Wire flagged only.
  var damage = 0;
  var notes = [];
  if (isNo_(checklistPhone)) {
    damage += getSettingValue(damagePhoneKey_(country));
    notes.push('Phone missing/damaged');
  }
  if (isNo_(checklistPlug)) {
    damage += getSettingValue(damageChargerKey_(country));
    notes.push('Charger/plug missing/damaged');
  }
  if (isNo_(checklistSIM)) notes.push('SIM missing (no charge)');
  if (isNo_(checklistWire)) notes.push('Wire missing (no charge)');
  damage = round2_(damage);

  var total = round2_(subtotal + lateFee + damage);

  // Write back (columns 7,11,12,13,14,15 and the checklist 16–19).
  sheet.getRange(found.row, 7).setValue(actual);
  sheet.getRange(found.row, 11).setValue(lateDays);
  sheet.getRange(found.row, 12).setValue(lateFee);
  sheet.getRange(found.row, 13).setValue(damage);
  sheet.getRange(found.row, 14).setValue(total);
  sheet.getRange(found.row, 15).setValue('Returned');
  sheet.getRange(found.row, 16, 1, 4).setValues([[
    ynStore_(checklistPhone), ynStore_(checklistSIM),
    ynStore_(checklistPlug), ynStore_(checklistWire)
  ]]);

  return {
    rentalId: rentalId,
    country: country,
    subtotal: subtotal,
    lateDays: lateDays,
    lateFee: lateFee,
    damageCharges: damage,
    total: total,
    status: 'Returned',
    notes: notes.join('; ')
  };
}

/* ============================================================
 * 5. BOOK RENTAL
 * ============================================================ */

/**
 * Create a Rentals row for an Available phone. Returns
 * { ok:true, rentalId, breakdown } or { ok:false, error }.
 */
function bookRental(customerId, country, phoneId, startDate, returnDueDate,
                    vnOption) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var phonesSheet = ss.getSheetByName('Phones');
  var phone = findRowById_(phonesSheet, phoneId);
  if (!phone) {
    return { ok: false, error: 'Phone not found: ' + phoneId };
  }
  if (String(phone.values[6]).trim() !== 'Available') { // col 7 Status
    return {
      ok: false,
      error: 'Phone ' + phoneId + ' is not Available (status: ' +
             phone.values[6] + ')'
    };
  }

  var breakdown = calcRental(country, startDate, returnDueDate, vnOption);

  var rentalsSheet = ss.getSheetByName('Rentals');
  var newId = nextIdInColumnA_(rentalsSheet);

  // Columns 1..19. Blanks left for the return-time fields.
  var row = [
    newId,                    // 1  RentalID
    customerId,               // 2  CustomerID
    countryDisplay_(country), // 3  Country
    phoneId,                  // 4  PhoneID
    toDate_(startDate),       // 5  StartDate
    toDate_(returnDueDate),   // 6  ReturnDueDate
    '',                       // 7  ActualReturnDate
    vnDisplay_(vnOption),     // 8  VirtualNumber
    breakdown.chargeableDays, // 9  ChargeableDays
    breakdown.subtotal,       // 10 PriceCalc
    '', '', '', '',           // 11-14 LateDays/LateFee/Damage/Total
    'Out',                    // 15 Status
    '', '', '', ''            // 16-19 checklist
  ];
  rentalsSheet.getRange(rentalsSheet.getLastRow() + 1, 1, 1, row.length)
    .setValues([row]);

  // Mark the phone Rented.
  phonesSheet.getRange(phone.row, 7).setValue('Rented');

  return { ok: true, rentalId: newId, breakdown: breakdown };
}

/* ============================================================
 * 6. OVERDUE SWEEP (daily)
 * ============================================================ */

/**
 * Scan Rentals with Status="Out" and ReturnDueDate < today. Mark each Overdue
 * and append a High-priority Task. Intended to run daily via a time trigger.
 */
function checkOverdueRentals() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var rentals = ss.getSheetByName('Rentals');
  var tasks = ss.getSheetByName('Tasks');
  var today = toDate_(new Date());

  var custNames = idNameMap_(ss.getSheetByName('Customers'), 1, 2);
  var phoneLabels = phoneLabelMap_(ss.getSheetByName('Phones'));

  var last = rentals.getLastRow();
  if (last < 2) return { scanned: 0, overdue: 0 };

  var data = rentals.getRange(2, 1, last - 1, 19).getValues();
  var overdueCount = 0;

  for (var i = 0; i < data.length; i++) {
    var status = String(data[i][14]).trim(); // col 15
    var due = toDate_(data[i][5]);            // col 6
    if (status !== 'Out' || !due) continue;
    if (due.getTime() >= today.getTime()) continue; // not yet overdue

    var sheetRow = i + 2;
    rentals.getRange(sheetRow, 15).setValue('Overdue');

    var custName = custNames[data[i][1]] || ('Customer #' + data[i][1]);
    var phoneLabel = phoneLabels[data[i][3]] || ('Phone #' + data[i][3]);

    appendOverdueTask_(tasks,
      'OVERDUE rental — ' + custName + ' — ' + phoneLabel,
      'RentalID: ' + data[i][0]);
    overdueCount++;
  }
  return { scanned: data.length, overdue: overdueCount };
}

/* ============================================================
 * 7. DAILY TRIGGER INSTALLER
 * ============================================================ */

/**
 * Run this ONCE from the Apps Script editor (select createRentalTrigger →
 * Run, approve the prompts). Installs a daily time-driven trigger for
 * checkOverdueRentals. Safe to re-run: clears any existing one first.
 */
function createRentalTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'checkOverdueRentals') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('checkOverdueRentals')
    .timeBased()
    .everyDays(1)
    .atHour(6) // ~06:00 in the script's timezone
    .create();
  Logger.log('Installed daily checkOverdueRentals trigger.');
}

/* ============================================================
 * HELPERS (uniquely named to avoid colliding with other files)
 * ============================================================ */

/** Normalise a country token to its Settings-key form (strip dashes). */
function countryKey_(country) {
  return String(country || '').replace(/-/g, '').trim();
}

/** Map a country to the Rentals dropdown display form. */
function countryDisplay_(country) {
  var k = countryKey_(country);
  if (k === 'UKUKmins') return 'UK-UKmins';
  if (k === 'UKIntl') return 'UK-Intl';
  return k; // USA, Israel, Canada
}

/** Virtual-number token: 'none' | 'weekly' | '30day'. */
function vnKey_(vn) {
  return String(vn || 'None').replace(/-/g, '').trim().toLowerCase();
}

/** Virtual-number value as stored in the Rentals dropdown. */
function vnDisplay_(vn) {
  var k = vnKey_(vn);
  if (k === '30day') return '30-day';
  if (k === 'weekly') return 'Weekly';
  return 'None';
}

/** Settings key for phone damage by country (UK/USA/Israel; others→UK). */
function damagePhoneKey_(country) {
  var k = countryKey_(country);
  if (k === 'USA') return 'Damage_Phone_USA';
  if (k === 'Israel') return 'Damage_Phone_Israel';
  return 'Damage_Phone_UK'; // UKUKmins, UKIntl, Canada, fallback
}

/** Settings key for charger/plug damage by country. */
function damageChargerKey_(country) {
  var k = countryKey_(country);
  return (k === 'UKUKmins' || k === 'UKIntl') ? 'Damage_Charger_UK'
                                              : 'Damage_Charger_Other';
}

/** A checklist value meaning "no / missing / damaged". */
function isNo_(v) {
  if (v === false) return true;
  return /^(n|no|false|0)$/i.test(String(v).trim());
}

/** Store a checklist value as 'y' / 'n'. */
function ynStore_(v) {
  return isNo_(v) ? 'n' : 'y';
}

/** Map PhoneID → "Make Model". */
function phoneLabelMap_(sheet) {
  var map = {};
  if (!sheet) return map;
  var last = sheet.getLastRow();
  if (last < 2) return map;
  var data = sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).getValues();
  for (var i = 0; i < data.length; i++) {
    map[data[i][0]] = (String(data[i][1] || '') + ' ' +
                       String(data[i][2] || '')).trim();
  }
  return map;
}

/** Append a Tasks row for an overdue rental (TaskID computed here). */
function appendOverdueTask_(tasksSheet, title, rawText) {
  var now = new Date();
  // Tasks: TaskID, Title, DueDate, Source, Priority, Done, RawText, CreatedAt
  var row = [
    nextIdInColumnA_(tasksSheet), title, now, 'Auto', 'High', 'n',
    rawText, now
  ];
  tasksSheet.getRange(tasksSheet.getLastRow() + 1, 1, 1, row.length)
    .setValues([row]);
}

/* ----- date utilities ----- */

/** Coerce a Date/string/serial to a midnight-local Date, or null. */
function toDate_(value) {
  if (value === '' || value === null || typeof value === 'undefined') {
    return null;
  }
  var d = (value instanceof Date) ? value : new Date(value);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays_(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Whole-day difference a − b (both coerced to midnight). */
function dayDiff_(a, b) {
  var da = toDate_(a), db = toDate_(b);
  if (!da || !db) return 0;
  return Math.round((da.getTime() - db.getTime()) / 86400000);
}

function dateKey_(d) {
  var m = d.getMonth() + 1;
  var day = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' +
         (day < 10 ? '0' + day : day);
}
