/**
 * Kosher Connect — SeedDemo.gs
 * Populates the empty tabs with realistic demo data. Where a tab is
 * logic-linked (Rentals, Bookings, Ledger) it drives the REAL engine
 * functions so totals and balances reconcile — it never hand-writes those
 * rows. Standalone inventory tabs are plain appends with computed IDs
 * (script writes don't fire Code.gs's onEdit auto-numbering).
 *
 * Run from the editor: seedDemoData().
 *
 * Real engines used (signatures verified in their files):
 *   bookRental(customerId, country, phoneId, startDate, returnDueDate, vnOption)
 *   calcReturn(rentalId, actualReturnDate, cPhone, cSIM, cPlug, cWire)
 *   checkOverdueRentals()                              (RentalEngine.gs)
 *   addBooking(customerId, passenger, route, airline, bookingRef, travelDate,
 *              departureTime, arrivalTime, price, bookingFee, passportOnFile,
 *              passportExpiry, notes)
 *   checkExpiringPassports()                           (Bookings.gs)
 *   recordManualPayment(customerId, amount, method, memo)   (Ledger.gs)
 *
 * Reuses nextIdInColumnA_ (Common.gs) for inventory IDs.
 *
 * Guard: if Rentals already has more than 1 data row, it logs a warning and
 * stops, so it can't double-seed.
 */

function seedDemoData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // ---- GUARD ----
  // Refuse if ANY demo tab already holds data. (A bare Rentals>1 check let a
  // partially-failed run — which leaves 1 rental + seeded inventory — slip
  // through and double-seed. This checks every tab the seeder writes.)
  if (!ss.getSheetByName('Rentals')) {
    Logger.log('seedDemoData: "Rentals" tab not found — run setup() first.');
    return;
  }
  var demoTabs = ['Rentals', 'Bookings', 'Phones', 'Pools', 'SIMs',
                  'ResellerLinks', 'DIDs', 'SoldPhones'];
  var populated = [];
  for (var g = 0; g < demoTabs.length; g++) {
    var gsh = ss.getSheetByName(demoTabs[g]);
    if (gsh && gsh.getLastRow() > 1) {
      populated.push(demoTabs[g] + ' (' + (gsh.getLastRow() - 1) + ')');
    }
  }
  if (populated.length) {
    Logger.log('seedDemoData: demo tabs already populated — ' + populated.join(', ') +
      '. Run clearDemoData() first. Aborting to avoid double-seeding.');
    return;
  }

  var summary = {};

  // ============================================================
  // 1. INVENTORY (standalone tabs — plain appends, computed IDs)
  // ============================================================
  var pools = seedPools_(ss);                 summary.pools = pools.count;
  var phones = seedPhones_(ss, pools.ids);    summary.phones = phones.count;
  summary.sims = seedSIMs_(ss);
  summary.resellerLinks = seedResellerLinks_(ss);
  summary.dids = seedDIDs_(ss);
  summary.soldPhones = seedSoldPhones_(ss);

  // ============================================================
  // 2. RENTALS — real bookRental / calcReturn / checkOverdueRentals
  // ============================================================
  // [custId, country, availableIndex, startOff, dueOff, vn, disposition,
  //  actualReturnOff, [cPhone,cSIM,cPlug,cWire]]
  var rentalSpecs = [
    [3,  'USA',        0, -28, -14, 'None',   'return',  -13, ['y', 'y', 'y', 'y']],
    [5,  'UK-UKmins',  1, -25, -11, 'Weekly', 'return',  -10, ['y', 'y', 'n', 'y']], // missing plug
    [7,  'Israel',     2, -21,  -7, 'None',   'return',   -6, ['y', 'y', 'y', 'y']],
    [9,  'UK-Intl',    3,  -7,   7, 'None',   'out',    null, null],
    [11, 'Canada',     4,  -3,  10, '30-day', 'out',    null, null],
    [13, 'USA',        5,  -5,   5, 'None',   'out',    null, null],
    [15, 'Israel',     6, -18,  -3, 'None',   'overdue',null, null],
    [17, 'UK-UKmins',  7, -20,  -5, 'Weekly', 'overdue',null, null]
  ];

  var booked = 0, returned = 0;
  for (var i = 0; i < rentalSpecs.length; i++) {
    var s = rentalSpecs[i];
    var phoneId = phones.available[s[2]];
    if (phoneId === undefined) {
      Logger.log('seedDemoData: no available phone for rental spec ' + i + ' — skipping.');
      continue;
    }
    var res = bookRental(s[0], s[1], phoneId, d_(s[3]), d_(s[4]), s[5]);
    if (!res || !res.ok) {
      Logger.log('seedDemoData: bookRental failed (cust ' + s[0] + '): ' +
        (res && res.error));
      continue;
    }
    booked++;

    if (s[6] === 'return') {
      var cl = s[8];
      var rr = calcReturn(res.rentalId, d_(s[7]), cl[0], cl[1], cl[2], cl[3]);
      if (rr && rr.error) {
        Logger.log('seedDemoData: calcReturn failed (rental ' + res.rentalId + '): ' + rr.error);
      } else {
        returned++;
      }
    }
  }

  // Flip past-due "Out" rentals to "Overdue" via the real sweep.
  var overdueResult = checkOverdueRentals();
  summary.rentalsBooked = booked;
  summary.rentalsReturned = returned;
  summary.rentalsOverdue = overdueResult ? overdueResult.overdue : 0;

  // ============================================================
  // 3. BOOKINGS — real addBooking (+ checkExpiringPassports)
  // ============================================================
  // [custId, passenger, route, airline, ref, travelOff, dep, arr, price, fee,
  //  passportOnFile, passportExpiryOff|null, notes]
  var bookingSpecs = [
    [4,  'Menachem Z Grunfeld', 'MAN-TLV', 'El Al',           'KC-AB1201', 20, '09:35', '17:10', 280, 20, 'y',  45, 'Window seat'],
    [6,  'Yakov Leitner',       'STN-TLV', 'Wizz Air',        'KC-AB1202', 35, '06:15', '13:40', 199, 15, 'n', null, ''],
    [8,  'Yochenen Domb',       'LTN-TLV', 'easyJet',         'KC-AB1203', 15, '11:05', '18:25', 320, 25, 'y',  75, 'Kosher meal requested'],
    [10, 'Tsudek Erlanger',     'MAN-JFK', 'Virgin Atlantic', 'KC-AB1204', 60, '10:20', '13:55', 150, 10, 'n', null, 'One-way'],
    [12, 'Moshe Goldhirsch',    'MAN-TLV', 'El Al',           'KC-AB1205', 28, '09:35', '17:10', 410, 30, 'y', 500, 'Return, extra legroom'],
    [14, 'Moishe C Samet',      'STN-TLV', 'Wizz Air',        'KC-AB1206', 42, '06:15', '13:40', 260, 20, 'n', null, ''],
    [16, 'Mechl Taub',          'LTN-JFK', 'JetBlue',         'KC-AB1207', 80, '12:00', '15:30', 175, 15, 'y',  60, 'Aisle seat'],
    [18, 'Kalmen E Soifer',     'MAN-TLV', 'El Al',           'KC-AB1208', 50, '09:35', '17:10', 295, 25, 'n', null, '']
  ];

  var bookingsAdded = 0;
  var chargeByCust = {};
  for (var b = 0; b < bookingSpecs.length; b++) {
    var bs = bookingSpecs[b];
    var passportExpiry = (bs[11] === null) ? '' : d_(bs[11]);
    var br = addBooking(bs[0], bs[1], bs[2], bs[3], bs[4], d_(bs[5]),
      bs[6], bs[7], bs[8], bs[9], bs[10], passportExpiry, bs[12]);
    if (br && br.bookingId) {
      bookingsAdded++;
      chargeByCust[bs[0]] = bs[8] + bs[9]; // price + fee (what addBooking charged)
    } else {
      Logger.log('seedDemoData: addBooking returned no id for cust ' + bs[0]);
    }
  }

  // Fire the 90-day passport expiry alert over the demo bookings.
  checkExpiringPassports();
  summary.bookingsAdded = bookingsAdded;

  // ============================================================
  // 4. WALLET / LEDGER — real recordManualPayment
  // ============================================================
  var payments = 0;

  // (a) Settle three flight customers exactly to zero.
  var zeroSpecs = [[4, 'Cash'], [6, 'Card'], [8, 'StandingOrder']];
  for (var z = 0; z < zeroSpecs.length; z++) {
    var cust = zeroSpecs[z][0];
    var amt = chargeByCust[cust];
    if (!amt) continue; // booking didn't post — skip
    var pr = recordManualPayment(cust, amt, zeroSpecs[z][1], 'Settle flight balance');
    if (pr && pr.entryId) payments++;
    else Logger.log('seedDemoData: payment failed (cust ' + cust + '): ' + (pr && pr.error));
  }

  // (b) Five top-ups for customers with no charges → positive balances.
  var topUps = [
    [19,  50, 'Cash'],
    [21, 100, 'Card'],
    [23,  75, 'StandingOrder'],
    [25, 120, 'Cash'],
    [27,  60, 'Card']
  ];
  for (var p = 0; p < topUps.length; p++) {
    var tr = recordManualPayment(topUps[p][0], topUps[p][1], topUps[p][2], 'Wallet top-up');
    if (tr && tr.entryId) payments++;
    else Logger.log('seedDemoData: top-up failed (cust ' + topUps[p][0] + '): ' + (tr && tr.error));
  }
  summary.paymentsRecorded = payments;

  // ============================================================
  // 5. SUMMARY
  // ============================================================
  Logger.log('seedDemoData complete:');
  Logger.log('  Phones:        ' + summary.phones);
  Logger.log('  Pools:         ' + summary.pools);
  Logger.log('  SIMs:          ' + summary.sims);
  Logger.log('  ResellerLinks: ' + summary.resellerLinks);
  Logger.log('  DIDs:          ' + summary.dids);
  Logger.log('  SoldPhones:    ' + summary.soldPhones);
  Logger.log('  Rentals:       ' + summary.rentalsBooked + ' booked (' +
    summary.rentalsReturned + ' returned, ' + summary.rentalsOverdue + ' overdue, rest Out)');
  Logger.log('  Bookings:      ' + summary.bookingsAdded + ' (charges posted to ledger)');
  Logger.log('  Payments:      ' + summary.paymentsRecorded +
    ' (3 settle-to-zero, 5 positive top-ups; uncovered booking customers stay negative)');
}

/**
 * Clear demo data so seedDemoData() can be re-run cleanly (e.g. after a
 * partial/failed run). Clears only the data rows (row 2 down) of the
 * inventory + Rentals/Bookings tabs, preserving headers, validations and
 * formatting.
 *
 * Deliberately does NOT touch Ledger, Tasks, Repairs, Customers, PriceList,
 * Settings or Holidays — those hold real/seed data this function can't safely
 * distinguish from demo rows. If a FULL seed run completed, its ledger
 * payments and auto-tasks must be removed by hand.
 */
function clearDemoData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tabs = ['Rentals', 'Bookings', 'Phones', 'Pools', 'SIMs',
              'ResellerLinks', 'DIDs', 'SoldPhones'];
  for (var i = 0; i < tabs.length; i++) {
    var sh = ss.getSheetByName(tabs[i]);
    if (!sh) { Logger.log('clearDemoData: tab not found — ' + tabs[i]); continue; }
    var last = sh.getLastRow();
    if (last < 2) { Logger.log('clearDemoData: ' + tabs[i] + ' already empty.'); continue; }
    sh.getRange(2, 1, last - 1, sh.getLastColumn()).clearContent();
    Logger.log('clearDemoData: cleared ' + (last - 1) + ' row(s) from ' + tabs[i] + '.');
  }
  Logger.log('clearDemoData: done. Ledger / Tasks / Repairs / Customers / ' +
    'PriceList / Settings / Holidays left untouched.');
}

/* ============================================================
 * INVENTORY SEEDERS (standalone — plain appends, computed IDs)
 * ============================================================ */

/** 4 USMobile pool rows. Returns { ids, count }. */
function seedPools_(ss) {
  var sheet = ss.getSheetByName('Pools');
  var base = nextIdInColumnA_(sheet);
  // PoolNumber, ActivationOff, ExpiryOff, LinesActive, Notes
  var specs = [
    ['+1 415 555 0142', -200, 165, 8, 'USMobile pool A'],
    ['+1 415 555 0188', -150, 215, 6, 'USMobile pool B'],
    ['+1 332 555 0203',  -90, 275, 5, 'USMobile pool C'],
    ['+1 332 555 0271',  -30, 335, 3, 'USMobile pool D']
  ];
  var rows = [], ids = [];
  for (var i = 0; i < specs.length; i++) {
    var id = base + i; ids.push(id);
    var s = specs[i];
    rows.push([id, s[0], d_(s[1]), d_(s[2]), s[3], s[4]]);
  }
  appendBlock_(sheet, rows);
  return { ids: ids, count: rows.length };
}

/**
 * 10 phones. First 8 Available (so the 8 bookRental calls succeed and flip
 * them to Rented), 1 Pool-Active (with a PoolID), 1 In-Repair.
 * Returns { ids, available, count }.
 */
function seedPhones_(ss, poolIds) {
  var sheet = ss.getSheetByName('Phones');
  var base = nextIdInColumnA_(sheet);
  // Make, Model, IMEI(15), Serial, Condition, Status, usesPool
  var specs = [
    ['FIG',       'Pro',     '356938035643801', 'FIGP-22A001', 'New',  'Available',   false],
    ['FIG',       'Core',    '356938035643802', 'FIGC-22A002', 'New',  'Available',   false],
    ['NAVI',      'C1',      '356938035643803', 'NAVI-21B003', 'Good', 'Available',   false],
    ['QIN',       'F21',     '356938035643804', 'QINF-23C004', 'Good', 'Available',   false],
    ['Sonim',     'XP3900',  '356938035643805', 'SNM-20D005',  'Good', 'Available',   false],
    ['Nokia',     'C2',      '356938035643806', 'NOK-19E006',  'Fair', 'Available',   false],
    ['Crosscall', 'Core-X3', '356938035643807', 'CRX-22F007',  'Good', 'Available',   false],
    ['QLYX',      'Q7',      '356938035643808', 'QLX-23G008',  'New',  'Available',   false],
    ['NAVI',      'C1',      '356938035643809', 'NAVI-21B009', 'Good', 'Pool-Active', true],
    ['Nokia',     '105',     '356938035643810', 'NOK-18H010',  'Fair', 'In-Repair',   false]
  ];
  var rows = [], ids = [], available = [];
  for (var i = 0; i < specs.length; i++) {
    var id = base + i; ids.push(id);
    var s = specs[i];
    var poolId = s[6] ? (poolIds[0] || '') : '';
    // PhoneID, Make, Model, IMEI, Serial, PoolID, Status, Condition, Notes
    rows.push([id, s[0], s[1], s[2], s[3], poolId, s[5], s[4], '']);
    if (s[5] === 'Available') available.push(id);
  }
  appendBlock_(sheet, rows);
  return { ids: ids, available: available, count: rows.length };
}

/** 8 SIMs against real CustomerIDs. Returns count. */
function seedSIMs_(ss) {
  var sheet = ss.getSheetByName('SIMs');
  var base = nextIdInColumnA_(sheet);
  // CustomerID, Provider, Alias, Status, CycleDays, NextRenewalOff, PaidBy, FeeApplied, Tier
  var specs = [
    [3,  'Lebara',   'yoelk',     'Active',         30, 12, 'KC',       20, 'Service'],
    [5,  'USMobile', 'menachemg', 'Active',         30, 25, 'Customer',  0, 'Unlimited'],
    [7,  'Three',    'yoelr',     'RenewalPending', 30,  3, 'KC',       15, 'Service'],
    [9,  'Smarty',   'yakovf',    'Active',         30, 18, 'Customer',  0, 'Service'],
    [11, 'Lebara',   'yishik',    'Active',         30,  8, 'KC',       20, 'Setup'],
    [13, 'USMobile', 'yakovl',    'RenewalPending', 30,  2, 'KC',       25, 'Unlimited'],
    [15, 'Three',    'yechielh',  'Active',         30, 27, 'Customer',  0, 'Service'],
    [17, 'Smarty',   'yochenend', 'Active',         30, 15, 'KC',       20, 'Service']
  ];
  var rows = [];
  for (var i = 0; i < specs.length; i++) {
    var s = specs[i];
    // SIMID, CustomerID, Provider, Alias, Status, RenewalCycleDays,
    // NextRenewalDate, PaidBy, FeeApplied, Tier
    rows.push([base + i, s[0], s[1], s[2], s[3], s[4], d_(s[5]), s[6], s[7], s[8]]);
  }
  appendBlock_(sheet, rows);
  return rows.length;
}

/** 6 reseller portal links (no ID column). Returns count. */
function seedResellerLinks_(ss) {
  var sheet = ss.getSheetByName('ResellerLinks');
  // Provider, AccountMeta, ShortcutURL, Notes
  var rows = [
    ['Lebara',   'KC-LEB-01', 'https://portal.example.com/lebara',   'Reseller portal'],
    ['Three',    'KC-THR-01', 'https://portal.example.com/three',    'Reseller portal'],
    ['Smarty',   'KC-SMA-01', 'https://portal.example.com/smarty',   'Reseller portal'],
    ['giffgaff', 'KC-GG-01',  'https://portal.example.com/giffgaff', 'Reseller portal'],
    ['O2',       'KC-O2-01',  'https://portal.example.com/o2',       'Reseller portal'],
    ['Vodafone', 'KC-VOD-01', 'https://portal.example.com/vodafone', 'Reseller portal']
  ];
  appendBlock_(sheet, rows);
  return rows.length;
}

/** 4 DIDs against real customers (no ID column). Returns count. */
function seedDIDs_(ss) {
  var sheet = ss.getSheetByName('DIDs');
  // Number, CustomerID, Platform, Status, ShortcutURL, Notes
  var rows = [
    ['+44 161 555 0101', 3,  'elid',    'Active', 'https://pbx.example.com/did/0101', ''],
    ['+44 161 555 0102', 9,  'FreePBX', 'Active', 'https://pbx.example.com/did/0102', ''],
    ['+44 161 555 0103', 15, 'elid',    'Active', 'https://pbx.example.com/did/0103', ''],
    ['+44 161 555 0104', 21, 'Other',   'Active', 'https://pbx.example.com/did/0104', '']
  ];
  appendBlock_(sheet, rows);
  return rows.length;
}

/** 6 sold phones against real customers. Returns count. */
function seedSoldPhones_(ss) {
  var sheet = ss.getSheetByName('SoldPhones');
  var base = nextIdInColumnA_(sheet);
  // PhoneCompany, Model, CustomerID, IMEI, Serial, SecurityField, SoldOff
  var specs = [
    ['FIG',   'Pro',    4,  '356938035644001', 'SLD-2201', 'Activation locked', -60],
    ['NAVI',  'C1',     8,  '356938035644002', 'SLD-2202', 'PIN set',           -45],
    ['QIN',   'F21',    12, '356938035644003', 'SLD-2203', 'Activation locked', -30],
    ['Nokia', 'C2',     22, '356938035644004', 'SLD-2204', 'PIN set',           -21],
    ['QLYX',  'Q7',     30, '356938035644005', 'SLD-2205', 'Activation locked', -10],
    ['FIG',   'Core',   35, '356938035644006', 'SLD-2206', 'PIN set',            -4]
  ];
  var rows = [];
  for (var i = 0; i < specs.length; i++) {
    var s = specs[i];
    // SaleID, PhoneCompany, Model, CustomerID, IMEI, Serial, SecurityField, SoldAt, SoldBy
    rows.push([base + i, s[0], s[1], s[2], s[3], s[4], s[5], d_(s[6]), 'seed']);
  }
  appendBlock_(sheet, rows);
  return rows.length;
}

/* ============================================================
 * LOCAL HELPERS
 * ============================================================ */

/** Append a 2D block of rows below the sheet's current data. */
function appendBlock_(sheet, rows) {
  if (!sheet || !rows.length) return;
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length)
    .setValues(rows);
}

/** A midnight-local Date offset from today by `offsetDays`. */
function d_(offsetDays) {
  var n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate() + offsetDays);
}
