/**
 * Kosher Connect — Customer onboarding
 * Companion to Code.gs / SIMWatcher.gs (same bound Apps Script project).
 *
 *   onEditTrigger(e)              installable onEdit: auto-ID + Drive folder
 *   createCustomerDriveFolder()   per-customer Drive folder, URL back to sheet
 *   installTriggers()             run ONCE to wire up onEditTrigger
 *
 * Customer creation lives in addCustomerFromConsole (WebConsole.gs). The dead
 * addCustomer / checkDuplicate / normalisePhone_ / normaliseEmail_ tree was
 * removed — it had no live caller.
 *
 * Customers columns (1-based):
 *   1 CustomerID   2 Name      3 Phone     4 Email     5 NormalisedEmail
 *   6 Address      7 City      8 DriveFolderURL  9 CardOnFile  10 Notes
 *   11 CreatedAt   12 CreatedBy
 *
 * NormalisedEmail (column E) is owned by the Customers!E2 ARRAYFORMULA (installed
 * by an earlier setup() build); the script no longer writes column E.
 */

var KC_CUSTOMERS = 'Customers';
var KC_PARENT_FOLDER = 'Kosher Connect Customers';

/* ============================================================
 * 1. INSTALLABLE onEdit TRIGGER
 * ============================================================ */

/**
 * Runs on every edit (installed by installTriggers). For any tab whose
 * column-A header ends in "ID" (CustomerID, RentalID, PhoneID, …): if an
 * edited row has data in column B but column A is empty, fill A with the next
 * sequential integer (max existing in A + 1). On the Customers tab, if column
 * D (Email) is filled, fill column E (NormalisedEmail) with the normalised
 * address.
 */
function onEditTrigger(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  var headerA = sheet.getRange(1, 1).getValue();
  var isIdTab = (typeof headerA === 'string') && /ID$/.test(headerA);
  var isCustomers = sheet.getName() === KC_CUSTOMERS;
  if (!isIdTab && !isCustomers) return;

  // The edit can span multiple rows (paste); handle each, skip the header.
  var startRow = Math.max(e.range.getRow(), 2);
  var endRow = e.range.getLastRow();

  for (var row = startRow; row <= endRow; row++) {
    // --- Auto-increment column A ---
    if (isIdTab) {
      var a = sheet.getRange(row, 1).getValue();
      var b = sheet.getRange(row, 2).getValue();
      if (isBlank_(a) && !isBlank_(b)) {
        sheet.getRange(row, 1).setValue(nextSequentialId_(sheet));
      }
    }

    // --- Customers: auto-create Drive folder if missing ---
    // NormalisedEmail (col E) is owned by the Customers!E2 ARRAYFORMULA — no
    // script write here.
    if (isCustomers) {
      try {
        var custId = sheet.getRange(row, 1).getValue();
        var custName = sheet.getRange(row, 2).getValue();
        var existingUrl = sheet.getRange(row, 8).getValue();
        if (!isBlank_(custId) && !isBlank_(custName) && isBlank_(existingUrl)) {
          createCustomerDriveFolder(custId, custName);
        }
      } catch (err) {
        Logger.log('Drive folder creation skipped on row ' + row + ': ' + err);
      }
    }
  }
}

/* ============================================================
 * 3. DRIVE FOLDER
 * ============================================================ */

/**
 * Create Drive folder "KC_[id]_[name]" inside the parent
 * "Kosher Connect Customers" (created if missing), write its URL into the
 * DriveFolderURL column (8) of the matching Customers row, and return the URL.
 */
function createCustomerDriveFolder(customerId, customerName) {
  var it = DriveApp.getFoldersByName(KC_PARENT_FOLDER);
  var parent = it.hasNext() ? it.next() : DriveApp.createFolder(KC_PARENT_FOLDER);

  // These folders hold passport scans. Keep the parent PRIVATE so children
  // never inherit link/public access, then force the new child PRIVATE too
  // (belt-and-braces even if the Drive default is already private). Named
  // collaborators, if any, are preserved — only anyone/link/domain access is
  // removed. Owner access is untouched and opening via URL still works.
  if (parent.getSharingAccess() !== DriveApp.Access.PRIVATE) {
    parent.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
  }

  var folder = parent.createFolder('KC_' + customerId + '_' + customerName);
  folder.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
  var url = folder.getUrl();

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(KC_CUSTOMERS);
  var last = sheet.getLastRow();
  if (last >= 2) {
    var ids = sheet.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (ids[i][0] === customerId) {
        sheet.getRange(i + 2, 8).setValue(url);
        break;
      }
    }
  }
  return url;
}

/* ============================================================
 * 3a. DRIVE FOLDER SHARING — AUDIT (read-only) + HARDEN
 * ============================================================ */

/** Extract a Drive file/folder id from a Drive URL. */
function driveIdFromUrl_(url) {
  var s = String(url);
  var m = s.match(/\/folders\/([a-zA-Z0-9_-]+)/) ||
          s.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
          s.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : '';
}

/**
 * READ-ONLY audit of customer Drive folder sharing. Logs, for the parent
 * "Kosher Connect Customers" and every folder linked from the Customers
 * DriveFolderURL column: sharing access (PRIVATE / ANYONE_WITH_LINK / ANYONE /
 * DOMAIN…), permission level, and any editors/viewers beyond the owner.
 * Writes nothing. Run from the editor as the folder-owning (script) account.
 */
function auditCustomerFolderSharing_() {
  var it = DriveApp.getFoldersByName(KC_PARENT_FOLDER); // parent first — children inherit it
  if (it.hasNext()) auditOneFolder_('PARENT "' + KC_PARENT_FOLDER + '"', it.next());
  else Logger.log('AUDIT: parent "' + KC_PARENT_FOLDER + '" not found (nothing created yet).');

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(KC_CUSTOMERS);
  if (!sheet) { Logger.log('AUDIT: no Customers tab.'); return; }
  var last = sheet.getLastRow();
  if (last < 2) { Logger.log('AUDIT: no customer rows.'); return; }

  var rows = sheet.getRange(2, 1, last - 1, 8).getValues(); // A=CustomerID(1) … H=DriveFolderURL(8)
  var audited = 0;
  for (var i = 0; i < rows.length; i++) {
    var customerId = rows[i][0], url = rows[i][7];
    if (isBlank_(url)) continue;
    var id = driveIdFromUrl_(url);
    if (!id) { Logger.log('AUDIT: CustomerID ' + customerId + ' — unparseable URL: ' + url); continue; }
    try { auditOneFolder_('CustomerID ' + customerId, DriveApp.getFolderById(id)); audited++; }
    catch (err) { Logger.log('AUDIT: CustomerID ' + customerId + ' — cannot open folder ' + id + ': ' + err); }
  }
  Logger.log('AUDIT: ' + audited + ' customer folder(s) checked.');
}

/** Log one folder's sharing access, permission, and non-owner editors/viewers. */
function auditOneFolder_(label, folder) {
  var access = folder.getSharingAccess();         // Access enum
  var perm = folder.getSharingPermission();        // Permission enum
  var owner = folder.getOwner() ? folder.getOwner().getEmail() : '(unknown)';
  var editors = folder.getEditors().map(function (u) { return u.getEmail(); });
  var viewers = folder.getViewers().map(function (u) { return u.getEmail(); });
  var extras = editors.concat(viewers).filter(function (e) { return e && e !== owner; });
  var a = String(access);
  var flag = (a === 'ANYONE' || a === 'ANYONE_WITH_LINK' || a === 'DOMAIN' || a === 'DOMAIN_WITH_LINK')
    ? '  <<< EXPOSED' : '';
  Logger.log('AUDIT ' + label + ': access=' + access + ' permission=' + perm + ' owner=' + owner +
    ' editors=[' + editors.join(', ') + '] viewers=[' + viewers.join(', ') + ']' +
    (extras.length ? ' sharedWith=[' + extras.join(', ') + ']' : '') + flag);
}

/**
 * Harden sharing on the parent + every customer folder: set each to PRIVATE,
 * which removes anyone/link/domain access. Named editors/viewers are NEVER
 * removed — they are LISTED for manual per-folder review. Owner access is
 * untouched and URL-opening still works for authorised users. Run from the
 * editor as the folder-owning (script) account. Serialised with a script lock.
 */
function hardenCustomerFolderSharing_() {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); }
  catch (e) { Logger.log('hardenCustomerFolderSharing_: could not acquire lock — skipping. ' + e); return; }
  try {
    var it = DriveApp.getFoldersByName(KC_PARENT_FOLDER); // parent first
    if (it.hasNext()) hardenOneFolder_('PARENT "' + KC_PARENT_FOLDER + '"', it.next());
    else Logger.log('hardenCustomerFolderSharing_: parent not found (nothing to harden yet).');

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(KC_CUSTOMERS);
    if (!sheet) { Logger.log('hardenCustomerFolderSharing_: no Customers tab.'); return; }
    var last = sheet.getLastRow();
    if (last < 2) return;

    var rows = sheet.getRange(2, 1, last - 1, 8).getValues();
    var hardened = 0;
    for (var i = 0; i < rows.length; i++) {
      var customerId = rows[i][0], url = rows[i][7];
      if (isBlank_(url)) continue;
      var id = driveIdFromUrl_(url);
      if (!id) { Logger.log('hardenCustomerFolderSharing_: CustomerID ' + customerId + ' — unparseable URL: ' + url); continue; }
      try { hardenOneFolder_('CustomerID ' + customerId, DriveApp.getFolderById(id)); hardened++; }
      catch (err) { Logger.log('hardenCustomerFolderSharing_: CustomerID ' + customerId + ' — cannot open folder ' + id + ': ' + err); }
    }
    Logger.log('hardenCustomerFolderSharing_: ' + hardened + ' customer folder(s) processed.');
  } finally {
    lock.releaseLock();
  }
}

/** Set one folder PRIVATE (kills anyone/link/domain). Lists — never removes —
 *  named editors/viewers beyond the owner for manual review. */
function hardenOneFolder_(label, folder) {
  var before = folder.getSharingAccess();
  var owner = folder.getOwner() ? folder.getOwner().getEmail() : '(unknown)';
  var editors = folder.getEditors().map(function (u) { return u.getEmail(); })
    .filter(function (e) { return e && e !== owner; });
  var viewers = folder.getViewers().map(function (u) { return u.getEmail(); })
    .filter(function (e) { return e && e !== owner; });

  if (String(before) !== 'PRIVATE') {
    folder.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    Logger.log('HARDEN ' + label + ': access ' + before + ' -> PRIVATE.');
  } else {
    Logger.log('HARDEN ' + label + ': already PRIVATE.');
  }
  if (editors.length || viewers.length) {
    Logger.log('  REVIEW ' + label + ' still shared with — editors=[' + editors.join(', ') +
      '] viewers=[' + viewers.join(', ') + '] (NOT removed — decide per folder).');
  }
}

/* Non-underscore wrappers so these appear in the editor's Run dropdown. */
function runFolderAudit()  { auditCustomerFolderSharing_(); }
function runFolderHarden() { hardenCustomerFolderSharing_(); }

/* ============================================================
 * 3b. DRIVE FOLDER SWEEP (time-driven — covers AppSheet adds)
 * ============================================================ */

/**
 * Idempotent time-driven sweep. AppSheet customer adds are API writes, which
 * never fire onEditTrigger, so those rows never get a Drive folder. This scans
 * the Customers tab and, for any row with a CustomerID + Name but a BLANK
 * DriveFolderURL, creates the folder via the EXISTING createCustomerDriveFolder
 * helper (same parent "Kosher Connect Customers", same KC_<id>_<name> scheme,
 * same column 8 write-back) — no second folder scheme.
 *
 * Column layout mirrors createCustomerDriveFolder: A=CustomerID, B=Name,
 * H(8)=DriveFolderURL. Blank-CustomerID rows are skipped. Rows that already
 * have a DriveFolderURL are never re-created. The whole run is serialised with
 * a script lock so two overlapping ticks can't double-create a folder.
 */
function sweepCustomerFolders_() {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    Logger.log('sweepCustomerFolders_: could not acquire lock — skipping run. ' + e);
    return;
  }
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(KC_CUSTOMERS);
    if (!sheet) { Logger.log('sweepCustomerFolders_: no Customers tab.'); return; }
    var last = sheet.getLastRow();
    if (last < 2) return;

    // A=CustomerID(1) … H=DriveFolderURL(8): the columns the helper reads/writes.
    var rows = sheet.getRange(2, 1, last - 1, 8).getValues();
    var created = 0, skippedBlank = 0;

    for (var i = 0; i < rows.length; i++) {
      var customerId = rows[i][0];
      var name = rows[i][1];
      var folderUrl = rows[i][7];

      if (isBlank_(customerId)) { skippedBlank++; continue; } // skip blank-CustomerID
      if (isBlank_(name)) continue;                           // need a name to title it
      if (!isBlank_(folderUrl)) continue;                     // already has one — never re-create

      try {
        createCustomerDriveFolder(customerId, name); // creates + writes URL to col 8
        created++;
      } catch (err) {
        Logger.log('sweepCustomerFolders_: folder creation failed for CustomerID ' +
          customerId + ' — ' + err);
      }
    }
    Logger.log('sweepCustomerFolders_: created ' + created + ' folder(s); ' +
      skippedBlank + ' blank-CustomerID row(s) skipped.');
  } finally {
    lock.releaseLock();
  }
}

/**
 * Run ONCE from the Apps Script editor to start the folder sweep. Installs a
 * time-driven trigger firing sweepCustomerFolders_() every 10 minutes. Safe to
 * re-run — it removes any existing sweepCustomerFolders_ trigger first.
 */
function createCustomerFolderSweepTrigger() {
  deleteCustomerFolderSweepTrigger();
  ScriptApp.newTrigger('sweepCustomerFolders_')
    .timeBased()
    .everyMinutes(10)
    .create();
  Logger.log('Customer folder sweep installed: every 10 minutes.');
}

/** Remove the time-driven trigger(s) for sweepCustomerFolders_. */
function deleteCustomerFolderSweepTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'sweepCustomerFolders_') {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }
  Logger.log('Removed ' + removed + ' sweepCustomerFolders_ trigger(s).');
}

/* ============================================================
 * 5. TRIGGER INSTALLER
 * ============================================================ */

/**
 * Run this ONCE from the Apps Script editor (select installTriggers in the
 * function dropdown, then Run, and approve the prompts). It installs the
 * installable onEdit trigger that drives onEditTrigger() for this spreadsheet.
 * Safe to re-run: it clears any existing onEditTrigger trigger first so you
 * never end up with duplicates.
 */
function installTriggers() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'onEditTrigger') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('onEditTrigger')
    .forSpreadsheet(ss)
    .onEdit()
    .create();
  Logger.log('Installed onEditTrigger (installable onEdit).');
}

/* ============================================================
 * HELPERS (uniquely named so they don't collide with Code.gs)
 * ============================================================ */

function isBlank_(v) {
  return v === '' || v === null || typeof v === 'undefined';
}

/** Next sequential id for a sheet = max numeric value in column A + 1. */
function nextSequentialId_(sheet) {
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
