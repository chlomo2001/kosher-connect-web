/**
 * Kosher Connect — SIM provider email watcher
 * Companion to Code.gs / Common.gs (same bound Apps Script project / Sheet).
 *
 * watchSIMEmails() scans the Gmail inbox for unread mail from the SIM
 * providers, figures out which customer it belongs to from the "+alias"
 * in the recipient address, classifies it (renewal success / payment
 * failed / renewal pending / other), updates the SIMs + Tasks tabs, and
 * alerts the owner on failures. Processed mail is marked read + labelled
 * "KC-Processed" and de-duplicated by Gmail message-id so reruns are safe.
 *
 * On a successful renewal where the SIM is PaidBy=KC with a FeeApplied, the
 * fee is recovered from the customer's wallet via autoDeduct() (Ledger.gs).
 *
 * Shared helper appendTask_ now lives in Common.gs (defined once there).
 *
 * ────────────────────────────────────────────────────────────────────────
 * ONE-TIME ACTIVATION (run from the Apps Script editor):
 *   1. Make sure the Anthropic key is stored:
 *        Project Settings ▸ Script Properties ▸ add
 *        ANTHROPIC_API_KEY = sk-ant-...   (used only for ambiguous emails)
 *   2. In the function dropdown choose  createSIMEmailTrigger  and click Run.
 *      Approve the Gmail/Sheets scopes when prompted.
 *   3. That installs a time-driven trigger firing watchSIMEmails() every
 *      15 minutes. You never need to run watchSIMEmails by hand (though you
 *      can, to test). To stop the watcher, run  deleteSIMEmailTrigger.
 * ────────────────────────────────────────────────────────────────────────
 *
 * Tab names are matched exactly: Customers, SIMs, Tasks.
 *   SIMs : SIMID, CustomerID, Provider, Alias, Status, RenewalCycleDays,
 *          NextRenewalDate, PaidBy, FeeApplied, Tier
 *   Tasks: TaskID, Title, DueDate, Source, Priority, Done, RawText, CreatedAt
 */

/* ============================================================
 * CONFIG
 * ============================================================ */

var KC_PROCESSED_LABEL = 'KC-Processed';
var KC_PROCESSED_PROP = 'KC_PROCESSED_MSG_IDS'; // hidden Script Property
var KC_PROCESSED_CAP = 3000;                    // keep the id list bounded

// Cheap, fast model for the rare ambiguous classification.
var ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';

// Sender domains we treat as SIM-provider mail.
var SIM_PROVIDER_DOMAINS = [
  'lebara.co.uk', 'lebara.com',
  'three.co.uk',
  'smarty.co.uk',
  'usmobile.com',
  'giffgaff.com',
  'o2.co.uk',
  'vodafone.co.uk', 'vodafone.com',
  'fizz.ca'
];

// Subject keywords that also qualify an email as provider mail.
var SIM_SUBJECT_KEYWORDS = ['renewal', 'payment failed',
  'payment successful', 'plan renewed'];

/* ============================================================
 * MAIN ENTRY POINT (time-driven)
 * ============================================================ */

function watchSIMEmails() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var simsSheet = ss.getSheetByName('SIMs');
  var tasksSheet = ss.getSheetByName('Tasks');
  var customersSheet = ss.getSheetByName('Customers');
  if (!simsSheet || !tasksSheet || !customersSheet) {
    throw new Error('Missing a required tab (Customers / SIMs / Tasks). ' +
      'Run setup() first.');
  }

  var label = GmailApp.getUserLabelByName(KC_PROCESSED_LABEL) ||
              GmailApp.createLabel(KC_PROCESSED_LABEL);

  var processed = loadProcessedIds_();
  var threads = GmailApp.search(buildSearchQuery_(), 0, 50);

  for (var t = 0; t < threads.length; t++) {
    var thread = threads[t];
    var messages = thread.getMessages();
    var labelThisThread = false;

    for (var m = 0; m < messages.length; m++) {
      var msg = messages[m];
      if (!msg.isUnread()) continue;

      var id = msg.getId();
      if (processed[id]) continue;            // already handled on a prior run
      if (!isProviderMessage_(msg)) continue; // belongs to a different thread topic

      try {
        processMessage_(msg, simsSheet, tasksSheet, customersSheet);

        // Success → mark read, remember the id, flag thread for labelling.
        msg.markRead();
        processed[id] = true;
        labelThisThread = true;
        saveProcessedIds_(processed); // persist per-message so a timeout is safe
      } catch (err) {
        // Leave the message unread/unlabelled so the next run retries it.
        Logger.log('watchSIMEmails: error on message ' + id + ' — ' + err);
      }
    }

    if (labelThisThread) thread.addLabel(label);
  }
}

/* ============================================================
 * PER-MESSAGE PROCESSING
 * ============================================================ */

function processMessage_(msg, simsSheet, tasksSheet, customersSheet) {
  var subject = msg.getSubject() || '';
  var body = msg.getPlainBody() || '';
  var sender = msg.getFrom() || '';

  var alias = extractAlias_(msg);
  var sim = alias ? findSimByAlias_(simsSheet, alias) : null;

  if (!sim) {
    // ---- Branch B: no alias / no SIM match ----
    appendTask_(tasksSheet,
      'Unrecognised SIM email — link manually',
      'High',
      subject + '  |  ' + sender);
    return;
  }

  // ---- Branch A: alias matched ----
  var category = classifyEmail_(subject, body);
  var customerName = lookupCustomerName_(customersSheet, sim.customerId) ||
                     ('Customer #' + sim.customerId);

  if (category === 'RenewalSuccess') {
    setSimStatusAndDate_(simsSheet, sim, 'Active', /*advanceDate*/ true);

    // KC fronted this renewal → recover the fee from the customer's wallet.
    // (Customer-paid lines are not deducted.) autoDeduct lives in Ledger.gs.
    var deductNote = '';
    if (sim.paidBy === 'KC' && sim.feeApplied > 0) {
      var ded = autoDeduct(sim.customerId, sim.feeApplied,
        'SIM renewal — ' + sim.provider + ' (' + sim.alias + ')');
      deductNote = ' (deducted £' + sim.feeApplied + ' from wallet)';
      if (ded && ded.warning) {
        Logger.log('SIM renewal deduction left CustomerID ' + sim.customerId +
          ' in arrears: ' + ded.warning);
      }
    }

    appendTask_(tasksSheet,
      'SIM renewal success — ' + customerName + deductNote,
      'Normal', subject);

  } else if (category === 'PaymentFailed') {
    // Renewal did not go through: mark pending, do NOT advance the date.
    setSimStatusAndDate_(simsSheet, sim, 'RenewalPending', /*advanceDate*/ false);
    appendTask_(tasksSheet,
      'SIM renewal FAILED — ' + customerName,
      'High', subject);
    alertOwnerOfFailure_(customerName, subject, body);

  } else if (category === 'RenewalPending') {
    setSimStatusAndDate_(simsSheet, sim, 'RenewalPending', /*advanceDate*/ false);
    appendTask_(tasksSheet,
      'SIM renewal pending — ' + customerName,
      'Normal', subject);

  } else {
    // Other: matched a customer but not a renewal event — log for review,
    // leave SIM status untouched.
    appendTask_(tasksSheet,
      'SIM email — review — ' + customerName,
      'Low', subject);
  }
}

/* ============================================================
 * EMAIL PARSING
 * ============================================================ */

/** True if the message looks like SIM-provider mail (domain or keyword). */
function isProviderMessage_(msg) {
  var from = (msg.getFrom() || '').toLowerCase();
  for (var i = 0; i < SIM_PROVIDER_DOMAINS.length; i++) {
    if (from.indexOf(SIM_PROVIDER_DOMAINS[i]) >= 0) return true;
  }
  var subject = (msg.getSubject() || '').toLowerCase();
  for (var j = 0; j < SIM_SUBJECT_KEYWORDS.length; j++) {
    if (subject.indexOf(SIM_SUBJECT_KEYWORDS[j]) >= 0) return true;
  }
  return false;
}

/**
 * Pull the "+alias" out of the recipient address, checking the To header
 * and the Delivered-To header (from raw MIME). e.g.
 *   kosherconnect+yaakov@gmail.com → "yaakov"
 * Normalised: lower-cased, dots stripped. Returns '' if none found.
 */
function extractAlias_(msg) {
  var haystack = msg.getTo() || '';
  try {
    var raw = msg.getRawContent();
    var dt = raw.match(/^Delivered-To:\s*(.*)$/mi);
    if (dt) haystack += '\n' + dt[1];
    var to = raw.match(/^To:\s*(.*)$/mi);
    if (to) haystack += '\n' + to[1];
  } catch (e) { /* raw not available — To header alone is fine */ }

  var match = haystack.match(/\+([A-Za-z0-9._%+\-]+)@/);
  if (!match) return '';
  return normaliseAlias_(match[1]);
}

function normaliseAlias_(s) {
  return String(s).toLowerCase().replace(/\./g, '');
}

/* ============================================================
 * CLASSIFICATION (keywords first, Anthropic only if ambiguous)
 * ============================================================ */

/**
 * Returns one of: 'RenewalSuccess', 'PaymentFailed', 'RenewalPending',
 * 'Other'. Keyword matching decides confidently when it can; only genuinely
 * ambiguous mail (conflicting or no strong signals) reaches the API.
 */
function classifyEmail_(subject, body) {
  var text = ((subject || '') + '\n' + (body || '')).toLowerCase();

  var failed = /payment failed|payment was not|payment unsuccessful|unsuccessful|declined|could not (be )?process|unable to (process|take|collect)|failed to renew|renewal failed|insufficient/.test(text);
  var success = /payment successful|payment received|plan renewed|successfully renewed|renewal successful|thank you for your payment|payment confirmed|has been renewed/.test(text);
  var pending = /renewal (due|reminder|upcoming)|due to renew|will renew|expiring|expires|renews on|upcoming renewal|reminder/.test(text);

  if (failed && !success) return 'PaymentFailed';
  if (success && !failed) return 'RenewalSuccess';
  if (!failed && !success && pending) return 'RenewalPending';

  // Ambiguous: conflicting success+failure signals, or nothing strong.
  return classifyWithAnthropic_(subject, body);
}

function classifyWithAnthropic_(subject, body) {
  var key = PropertiesService.getScriptProperties()
    .getProperty('ANTHROPIC_API_KEY');
  if (!key) return 'Other'; // no key configured → safe default

  var prompt =
    'You classify SIM-provider emails for a phone reseller. Read the email ' +
    'and reply with EXACTLY ONE of these labels and nothing else:\n' +
    'RenewalSuccess  (a renewal/payment went through)\n' +
    'PaymentFailed   (a payment or renewal failed/was declined)\n' +
    'RenewalPending  (an upcoming renewal reminder, nothing charged yet)\n' +
    'Other           (anything else)\n\n' +
    'Subject: ' + subject + '\n\nBody:\n' + String(body).slice(0, 2000);

  var payload = {
    model: ANTHROPIC_MODEL,
    max_tokens: 16,
    messages: [{ role: 'user', content: prompt }]
  };

  try {
    var resp = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() !== 200) {
      Logger.log('Anthropic non-200: ' + resp.getContentText());
      return 'Other';
    }
    var data = JSON.parse(resp.getContentText());
    var out = (data.content && data.content[0] && data.content[0].text)
      ? data.content[0].text.trim() : '';
    var valid = ['RenewalSuccess', 'PaymentFailed', 'RenewalPending', 'Other'];
    for (var i = 0; i < valid.length; i++) {
      if (out.indexOf(valid[i]) >= 0) return valid[i];
    }
  } catch (e) {
    Logger.log('Anthropic call failed: ' + e);
  }
  return 'Other';
}

/* ============================================================
 * SHEET LOOKUPS / WRITES
 * ============================================================ */

/** Map header name → 1-based column index for a sheet's header row. */
function colMap_(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0];
  var map = {};
  for (var i = 0; i < headers.length; i++) map[headers[i]] = i + 1;
  return map;
}

/**
 * Find a SIM row by normalised alias. Returns
 * { row, customerId, cycleDays, provider, alias, paidBy, feeApplied, cols }
 * or null.
 */
function findSimByAlias_(simsSheet, alias) {
  var cols = colMap_(simsSheet);
  var last = simsSheet.getLastRow();
  if (last < 2) return null;
  var aliasCol = cols['Alias'];
  var custCol = cols['CustomerID'];
  var cycleCol = cols['RenewalCycleDays'];
  var provCol = cols['Provider'];
  var paidByCol = cols['PaidBy'];
  var feeCol = cols['FeeApplied'];

  var values = simsSheet.getRange(2, 1, last - 1, simsSheet.getLastColumn())
    .getValues();
  for (var i = 0; i < values.length; i++) {
    var rowAlias = normaliseAlias_(values[i][aliasCol - 1]);
    if (rowAlias && rowAlias === alias) {
      var cycle = Number(values[i][cycleCol - 1]) || 30;
      return {
        row: i + 2,
        customerId: values[i][custCol - 1],
        cycleDays: cycle,
        provider: provCol ? values[i][provCol - 1] : '',
        alias: alias,
        paidBy: paidByCol ? String(values[i][paidByCol - 1]).trim() : '',
        feeApplied: feeCol ? (Number(values[i][feeCol - 1]) || 0) : 0,
        cols: cols
      };
    }
  }
  return null;
}

/** Set SIM Status, and optionally advance NextRenewalDate = today + cycle. */
function setSimStatusAndDate_(simsSheet, sim, status, advanceDate) {
  simsSheet.getRange(sim.row, sim.cols['Status']).setValue(status);
  if (advanceDate) {
    var next = new Date();
    next.setDate(next.getDate() + sim.cycleDays);
    simsSheet.getRange(sim.row, sim.cols['NextRenewalDate']).setValue(next);
  }
}

/** Customer Name for a CustomerID, or '' if not found. */
function lookupCustomerName_(customersSheet, customerId) {
  var cols = colMap_(customersSheet);
  var last = customersSheet.getLastRow();
  if (last < 2) return '';
  var idCol = cols['CustomerID'];
  var nameCol = cols['Name'];
  var values = customersSheet
    .getRange(2, 1, last - 1, customersSheet.getLastColumn()).getValues();
  for (var i = 0; i < values.length; i++) {
    if (values[i][idCol - 1] === customerId) return values[i][nameCol - 1];
  }
  return '';
}

/* ============================================================
 * OWNER ALERT
 * ============================================================ */

function alertOwnerOfFailure_(customerName, subject, body) {
  var owner = Session.getActiveUser().getEmail() ||
              Session.getEffectiveUser().getEmail();
  if (!owner) {
    Logger.log('No owner email available — skipping failure alert.');
    return;
  }
  var quoted = String(body).slice(0, 4000)
    .split('\n').map(function (l) { return '> ' + l; }).join('\n');

  MailApp.sendEmail(owner,
    'KC ALERT: SIM payment failed — ' + customerName,
    'A SIM payment appears to have FAILED for ' + customerName + '.\n\n' +
    'Original subject: ' + subject + '\n\n' +
    '----- Quoted email -----\n' + quoted);
}

/* ============================================================
 * DEDUPE STORE (hidden Script Property, JSON array of message ids)
 * ============================================================ */

function loadProcessedIds_() {
  var raw = PropertiesService.getScriptProperties()
    .getProperty(KC_PROCESSED_PROP);
  var map = {};
  if (raw) {
    try {
      JSON.parse(raw).forEach(function (id) { map[id] = true; });
    } catch (e) { /* corrupt → start fresh */ }
  }
  return map;
}

function saveProcessedIds_(map) {
  var ids = Object.keys(map);
  // Keep the list bounded; drop the oldest if we exceed the cap.
  if (ids.length > KC_PROCESSED_CAP) {
    ids = ids.slice(ids.length - KC_PROCESSED_CAP);
  }
  PropertiesService.getScriptProperties()
    .setProperty(KC_PROCESSED_PROP, JSON.stringify(ids));
}

/* ============================================================
 * GMAIL SEARCH QUERY
 * ============================================================ */

function buildSearchQuery_() {
  var terms = [];
  for (var i = 0; i < SIM_PROVIDER_DOMAINS.length; i++) {
    terms.push('from:' + SIM_PROVIDER_DOMAINS[i]);
  }
  for (var j = 0; j < SIM_SUBJECT_KEYWORDS.length; j++) {
    var kw = SIM_SUBJECT_KEYWORDS[j];
    terms.push(kw.indexOf(' ') >= 0 ? 'subject:"' + kw + '"'
                                    : 'subject:' + kw);
  }
  // Unread, not already processed, within the last week, matching any term.
  return 'is:unread -label:"' + KC_PROCESSED_LABEL + '" newer_than:7d (' +
         terms.join(' OR ') + ')';
}

/* ============================================================
 * TRIGGER MANAGEMENT
 * ============================================================ */

/**
 * Run this ONCE from the Apps Script editor to start the watcher. Installs a
 * time-driven trigger that fires watchSIMEmails() every 15 minutes. Safe to
 * run again — it removes any existing watchSIMEmails trigger first so you
 * never end up with duplicates.
 */
function createSIMEmailTrigger() {
  deleteSIMEmailTrigger();
  ScriptApp.newTrigger('watchSIMEmails')
    .timeBased()
    .everyMinutes(15)
    .create();
  Logger.log('SIM email watcher installed: every 15 minutes.');
}

/** Remove the time-driven trigger(s) for watchSIMEmails(). */
function deleteSIMEmailTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'watchSIMEmails') {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }
  Logger.log('Removed ' + removed + ' watchSIMEmails trigger(s).');
}
