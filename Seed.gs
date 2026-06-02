/**
 * Seed.gs — one-time visual seed for the Kosher Connect master sheet.
 *
 * Run seedCustomers() then seedPriceList() once each from the Apps Script editor.
 * Both functions are guarded so they cannot double-seed.
 *
 * ============================================================================
 * SETTINGS RECONCILIATION — DO NOT AUTO-APPLY
 * ============================================================================
 * The shop's live price list disagrees with the current Settings tab in
 * several places. These are listed here for manual review with Shloime.
 * Nothing in this file changes the Settings tab — reconcile by hand once the
 * correct figures are confirmed.
 *
 *   USA:              Settings cap £45            | price list monthly £50
 *   Canada:           Settings cap £45            | price list monthly £50
 *   UK Local:         Settings min £15 / cap £40  | price list min £20 / monthly £35
 *   UK International:  Settings £2.50/day,         | price list £2/day,
 *                       min £20, cap £45           |   min £25, cap £40
 *   Virtual Number:   Settings flat £5/week,       | price list varies by country
 *                       £10/30-day                 |   (£5–£7/week, £10–£15/month)
 *
 *   Not in Settings at all:
 *     - "without SIM" rental tiers (USA £2/day, £30/mo)
 *     - 15% discount for a third phone and beyond
 * ============================================================================
 */

/**
 * Normalise an email the same way addCustomer does:
 * trim, lowercase, and strip any "+alias" tag from the local part.
 * (e.g. test1+777@gmail.com -> test1@gmail.com)
 */
function normaliseEmail_(email) {
  if (!email) return '';
  var e = String(email).trim().toLowerCase();
  var at = e.indexOf('@');
  if (at < 0) return e;
  var local = e.slice(0, at);
  var domain = e.slice(at); // keeps the leading "@"
  var plus = local.indexOf('+');
  if (plus >= 0) local = local.slice(0, plus);
  return local + domain;
}

function pad2_(n) {
  return n < 10 ? '0' + n : '' + n;
}

/**
 * seedCustomers()
 * Appends 36 real customers to the Customers tab with obviously-fake
 * placeholder contact details (Ofcom reserved 07700 900xxx drama range +
 * example.com). Appends directly — does NOT route through addCustomer and
 * does NOT create Drive folders.
 *
 * Guard: refuses to run if the Customers tab already has more than 5 data rows.
 */
function seedCustomers() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Customers');
  if (!sheet) {
    Logger.log('seedCustomers: "Customers" tab not found — aborting.');
    return;
  }

  var lastRow = sheet.getLastRow();
  var dataRows = lastRow - 1; // exclude header row
  if (dataRows > 5) {
    Logger.log('seedCustomers: Customers tab already has ' + dataRows +
               ' data rows (>5). Refusing to seed to avoid double-seeding.');
    return;
  }

  // Next sequential CustomerID = max existing numeric ID + 1.
  var maxId = 0;
  if (dataRows > 0) {
    var existing = sheet.getRange(2, 1, dataRows, 1).getValues();
    for (var i = 0; i < existing.length; i++) {
      var n = parseInt(existing[i][0], 10);
      if (!isNaN(n) && n > maxId) maxId = n;
    }
  }

  var names = [
    'Menachem Zwi Grunfeld',
    'Yoel Kellner',
    'Yoel Rotter',
    'Yakov M Friedman',
    'Yishi Kohn',
    'Yakov Leitner',
    'Yechiel Chaim Halberstam',
    'Yochenen Domb',
    'Yisrael Geldzhaler',
    'Tsudek Erlanger',
    'Shmiel Solinsky',
    'Moshe Goldhirsch',
    'Moishe Yitschock Kahanah',
    'Moishe Chaim Samet',
    'Menachem Glazyaus',
    'Mechl Taub',
    'Shmeul Bleier',
    'Kalmen Eliezer Soifer',
    'Laibish Frankel',
    'Lipa Weiser',
    'Jacobson',
    'Israel Brief',
    'Harav Hirtske Frankel',
    'Harav Nachmen Kahana',
    'Elisha Halberstam',
    'Eliezer Aba Rothbart',
    'Eli Glausiusz',
    'Dovid Laib Grinfeld',
    'Eliezer Rapaport',
    'Elias Lehrer',
    'Abraham Kats',
    'Boruch Zvi Koppenheim',
    'Avrahom Kalmanowitz',
    'Ari Dachner',
    'Berel Hochhauser',
    'Avrohom Eiz'
  ];

  var NOTES = 'Imported from legacy ticket sheets — placeholder contact, pending migration';

  // Column order:
  // CustomerID | Name | Phone | Email | NormalisedEmail | Address | City |
  // DriveFolderURL | CardOnFile | Notes | CreatedAt | CreatedBy
  var rows = [];
  for (var j = 0; j < names.length; j++) {
    var seq = j + 1;                                  // 1..36
    var id = maxId + seq;                             // next sequential IDs
    var phone = '07700 9000' + pad2_(seq);           // 07700 900001 .. 07700 900036
    var email = 'customer' + pad2_(seq) + '@example.com';
    rows.push([
      id,                       // CustomerID
      names[j],                 // Name
      phone,                    // Phone (placeholder)
      email,                    // Email (placeholder)
      normaliseEmail_(email),   // NormalisedEmail
      '',                       // Address
      '',                       // City
      '',                       // DriveFolderURL (no folders for a visual seed)
      '',                       // CardOnFile
      NOTES,                    // Notes
      '',                       // CreatedAt
      'seed'                    // CreatedBy
    ]);
  }

  sheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
  Logger.log('seedCustomers: appended ' + rows.length + ' customers (CustomerID ' +
             (maxId + 1) + '..' + (maxId + rows.length) + ').');
}

/**
 * seedPriceList()
 * Appends the shop's real price list to the PriceList tab.
 * ServiceID is left blank (auto-fills); Active is set to "y".
 *
 * Guard: refuses to run if the PriceList tab already has more than 1 data row.
 */
function seedPriceList() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('PriceList');
  if (!sheet) {
    Logger.log('seedPriceList: "PriceList" tab not found — aborting.');
    return;
  }

  var lastRow = sheet.getLastRow();
  var dataRows = lastRow - 1; // exclude header row
  if (dataRows > 1) {
    Logger.log('seedPriceList: PriceList already has ' + dataRows +
               ' data rows (>1). Refusing to seed to avoid double-seeding.');
    return;
  }

  // [Name, Category, Price]
  var items = [
    // Repairs
    ['QIN F21 Screen', 'Repair', 50],
    ['QIN F21 Charger Port', 'Repair', 35],
    ['QIN F21 New Battery', 'Repair', 35],
    ['QIN F21 Screen+Battery', 'Repair', 70],
    ['FIG Touch Screen/Hinges', 'Repair', 75],
    ['FIG Touch Charger Port', 'Repair', 35],
    ['FIG Touch Camera/Torch', 'Repair', 25],
    ['Sonim XP3900 Screen/Hinges', 'Repair', 90],
    ['Sonim XP3900 Charger Port', 'Repair', 35],
    ['Sonim XP3900 New Battery', 'Repair', 25],
    ['Nokia C2/301 Screen', 'Repair', 25],
    ['Nokia C2/301 New Housing', 'Repair', 20],
    ['Nokia C2/301 Speaker', 'Repair', 20],
    ['Nokia C2/301 Screen+Housing', 'Repair', 35],

    // Online Services
    ['Regular online service (per hour)', 'Online', 45],
    ['Passport Application', 'Online', 25],
    ['Bank Opening', 'Online', 30],
    ['Tablet Use in Office', 'Online', 15],
    ['Settled Status Application', 'Online', 45],
    ['ESTA (USA)', 'Online', 50],
    ['ETA (Israel)', 'Online', 15],
    ['ETA (UK)', 'Online', 30],
    ['Printing (per page)', 'Online', 0.10],

    // Travel Tickets
    ['Single Ticket Start Fee', 'Tickets', 10],
    ['Ready Planned Journey', 'Tickets', 20],
    ['Plan Standard Journey', 'Tickets', 25],
    ['Plan Self-Transfer Journey', 'Tickets', 30],
    ['Check-in', 'Tickets', 10],

    // Phone Sales
    ['FIG Pro', 'Phone', 280],
    ['FIG Core', 'Phone', 189],
    ['NAVI C1', 'Phone', 169],
    ['Croscall', 'Phone', 115],
    ['QLYX Q7', 'Phone', 135]
  ];

  // Column order: ServiceID | Name | Category | Price | Active
  var rows = items.map(function (it) {
    return ['', it[0], it[1], it[2], 'y'];
  });

  sheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
  Logger.log('seedPriceList: appended ' + rows.length + ' price list items.');
}
