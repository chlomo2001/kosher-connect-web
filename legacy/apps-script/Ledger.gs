/**
 * Kosher Connect — Payments, wallet ledger & Stripe (Task 5)
 * Companion to RentalEngine.gs / SIMWatcher.gs / PoolOptimiser.gs.
 *
 *   appendLedgerEntry(...)            the ONLY writer of Ledger rows (append-only)
 *   getWalletBalance(customerId)      live balance = sum of Ledger amounts
 *   recordManualPayment(...)          Cash / Card / StandingOrder payment in
 *   autoDeduct(...)                   system deduction (e.g. Lebara annual fee)
 *   generateStripePaymentLink(...)    Stripe Payment Link for a top-up/charge
 *   stripeWebhookHandler(e)           Stripe webhook → Top-up on payment
 *   sendBalanceReminderEmail(id)      email a customer who is in arrears
 *   runCollectionsReminders()         daily sweep of negative balances
 *   createCollectionsTrigger()        run ONCE to install the daily sweep
 *
 * Reuses (same project, do not redefine): getSettingValue, round2_,
 * nextIdInColumnA_, findRowById_, idNameMap_ (RentalEngine.gs); appendTask_
 * (SIMWatcher.gs).
 *
 * Ledger columns (1-based):
 *   1 EntryID  2 CustomerID  3 Type  4 Amount  5 Method  6 Reference
 *   7 Memo  8 At  9 By
 */

/* ============================================================
 * 1. APPEND-ONLY LEDGER WRITER
 * ============================================================ */

/**
 * Append one Ledger row. This is the single point through which all money
 * movement is recorded — it never updates an existing row.
 *
 * The stored sign is DERIVED FROM `type`, so callers pass a magnitude and need
 * not worry about getting the sign right:
 *   in  (+): Payment, Top-up, Refund
 *   out (−): Charge, Auto-deduct, LateFee
 *
 * `by` is optional: defaults to the active user's email, or "System" when no
 * user is attached (triggers, webhook). Returns the new EntryID.
 */
function appendLedgerEntry(customerId, type, amount, method, reference, memo, by) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Ledger');
  if (!sheet) throw new Error('Ledger tab not found.');

  var signed = round2_(typeSign_(type) * Math.abs(Number(amount) || 0));
  var entryId = nextIdInColumnA_(sheet);
  var who = by || activeUserOrSystem_();

  var row = [
    entryId,            // 1 EntryID
    customerId,         // 2 CustomerID
    type,               // 3 Type
    signed,             // 4 Amount (signed)
    method || '',       // 5 Method
    reference || '',    // 6 Reference
    memo || '',         // 7 Memo
    new Date(),         // 8 At
    who                 // 9 By
  ];
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
  return entryId;
}

/* ============================================================
 * 2. LIVE BALANCE (always computed, never stored)
 * ============================================================ */

/** Sum of all Ledger Amount values for a customer = live wallet balance. */
function getWalletBalance(customerId) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Ledger');
  if (!sheet) return 0;
  var last = sheet.getLastRow();
  if (last < 2) return 0;

  var data = sheet.getRange(2, 1, last - 1, 4).getValues(); // EntryID..Amount
  var total = 0;
  for (var i = 0; i < data.length; i++) {
    if (data[i][1] === customerId) total += Number(data[i][3]) || 0;
  }
  return round2_(total);
}

/* ============================================================
 * 3. MANUAL PAYMENT IN
 * ============================================================ */

/** Record a Cash / Card / StandingOrder payment. Returns {entryId, newBalance}. */
function recordManualPayment(customerId, amount, method, memo) {
  var allowed = ['Cash', 'Card', 'StandingOrder'];
  if (allowed.indexOf(method) < 0) {
    return { error: 'Invalid method "' + method + '". Use one of: ' +
      allowed.join(', ') };
  }
  var entryId = appendLedgerEntry(customerId, 'Payment', amount, method, '',
    memo || '');
  return { entryId: entryId, newBalance: getWalletBalance(customerId) };
}

/* ============================================================
 * 5. AUTO-DEDUCT (system)
 * ============================================================ */

/**
 * System-triggered deduction (e.g. the £20 Lebara annual fee, or what the SIM
 * email watcher calls when a renewal is paid on the customer's behalf).
 * By = "System". Returns {entryId, newBalance, warning}.
 */
function autoDeduct(customerId, amount, reason, reference) {
  var entryId = appendLedgerEntry(customerId, 'Auto-deduct', amount, '',
    reference || '', reason || '', 'System');
  return withBalanceWarning_(entryId, customerId);
}

/* ============================================================
 * 6. STRIPE PAYMENT LINK
 * ============================================================ */

/**
 * Create a Stripe Payment Link for an ad-hoc amount (top-up or charge). The
 * Payment Links API needs a Price, so we first create a one-off Price (with an
 * inline product), then the link. CustomerID + memo go in the link metadata,
 * which Stripe copies onto the resulting Checkout Session so the webhook can
 * attribute the payment. Returns the payment link URL (string).
 *
 * Requires Script Property STRIPE_SECRET_KEY.
 */
function generateStripePaymentLink(customerId, amount, memo) {
  var key = PropertiesService.getScriptProperties()
    .getProperty('STRIPE_SECRET_KEY');
  if (!key) throw new Error('STRIPE_SECRET_KEY not set in Script Properties.');

  var pence = Math.round((Number(amount) || 0) * 100);
  if (pence <= 0) throw new Error('Amount must be greater than zero.');

  // 1) one-off Price + inline Product.
  var price = stripePost_('https://api.stripe.com/v1/prices', {
    'currency': 'gbp',
    'unit_amount': String(pence),
    'product_data[name]': memo || 'Kosher Connect payment'
  }, key);

  // 2) Payment Link carrying our metadata.
  var link = stripePost_('https://api.stripe.com/v1/payment_links', {
    'line_items[0][price]': price.id,
    'line_items[0][quantity]': '1',
    'metadata[customerId]': String(customerId),
    'metadata[memo]': memo || ''
  }, key);

  return link.url;
}

/* ============================================================
 * 7. STRIPE WEBHOOK (deployed web app)
 * ============================================================ */

/**
 * Stripe webhook endpoint.
 *
 * DEPLOY AS A WEB APP:
 *   1. Apps Script editor ▸ Deploy ▸ New deployment ▸ type "Web app".
 *   2. Execute as: Me.  Who has access: Anyone.
 *   3. Deploy, authorise, and copy the /exec Web app URL.
 *   4. Stripe Dashboard ▸ Developers ▸ Webhooks ▸ Add endpoint:
 *        - Endpoint URL: the /exec URL from step 3
 *        - Events to send: checkout.session.completed
 *   5. (Re-deploy creates a new URL — update Stripe if you redeploy.)
 *
 * Always returns HTTP 200 so Stripe never retries on our parsing issues; any
 * problem is logged instead. (Signature verification is optional and omitted;
 * see note below if you want to add it.)
 *
 * NOTE: the single doPost(e) web-app entry point lives in TodoSMS.gs — it
 * routes Twilio SMS posts to smsWebhookHandler and everything else (Stripe)
 * here. Do not define doPost in this file (only one doPost may exist).
 */
function stripeWebhookHandler(e) {
  // Apps Script doPost() cannot read request headers, so the Stripe-Signature
  // HMAC scheme is impossible here. Instead we (a) optionally gate on a secret
  // token in the webhook URL, and (b) NEVER trust the POST body — we re-fetch
  // the session straight from Stripe and credit only what Stripe reports.
  //
  // Transient vs terminal: TERMINAL outcomes (forged/unpaid/unknown/already
  // credited/bad token/wrong event) return 200 via stripeAck_() so Stripe stops
  // retrying. TRANSIENT failures (can't reach Stripe, key missing, unexpected
  // error) THROW — Apps Script then returns HTTP 500 and Stripe retries later,
  // so a real payment is never silently dropped.
  var props = PropertiesService.getScriptProperties();

  // Terminal: shared-secret token on the webhook URL is set but doesn't match.
  var expectedToken = props.getProperty('STRIPE_WEBHOOK_TOKEN');
  if (expectedToken) {
    var gotToken = (e && e.parameter) ? e.parameter.token : '';
    if (gotToken !== expectedToken) {
      Logger.log('Stripe webhook: rejected — bad/missing URL token.');
      return stripeAck_();
    }
  }

  // Terminal: unparseable body or an event type we don't act on.
  var event;
  try {
    event = JSON.parse(e.postData.contents);
  } catch (parseErr) {
    Logger.log('Stripe webhook: unparseable body — ' + parseErr);
    return stripeAck_();
  }
  if (!event || event.type !== 'checkout.session.completed') {
    return stripeAck_();
  }

  var sessionId = event.data && event.data.object && event.data.object.id;
  if (!sessionId) {
    Logger.log('Stripe webhook: event missing session id.');
    return stripeAck_();
  }

  // Transient: no secret key means we cannot verify — defer so Stripe retries
  // once the key is restored, rather than acking and losing the credit.
  var key = props.getProperty('STRIPE_SECRET_KEY');
  if (!key) {
    throw new Error('Stripe webhook: STRIPE_SECRET_KEY not set — deferring for retry.');
  }

  // Re-fetch the session from Stripe. stripeGet_ throws on transient failures
  // (auth/429/5xx/network) so this whole handler returns HTTP 500 and Stripe
  // retries; it returns null only on terminal 400/404 (forged/unknown id).
  var session = stripeGet_(
    'https://api.stripe.com/v1/checkout/sessions/' + encodeURIComponent(sessionId),
    key);
  if (!session) {
    Logger.log('Stripe webhook: session ' + sessionId +
      ' not found at Stripe — forged/terminal, not crediting.');
    return stripeAck_();
  }

  // Terminal: session exists but isn't actually paid.
  if (session.payment_status !== 'paid') {
    Logger.log('Stripe webhook: session ' + sessionId + ' payment_status="' +
      session.payment_status + '" — not crediting.');
    return stripeAck_();
  }

  // Terminal: customer is missing/unparseable/unknown.
  var meta = session.metadata || {};
  var customerId = meta.customerId;
  var custNum = Number(customerId);
  var custSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Customers');
  var known = customerId !== undefined && customerId !== '' &&
    !isNaN(custNum) && findRowById_(custSheet, custNum);
  if (!known) {
    Logger.log('Stripe webhook: unrecognised CustomerID "' + customerId +
      '" for session ' + sessionId + ' — not crediting.');
    return stripeAck_();
  }

  // Idempotency check + credit must be atomic: two deliveries of the same
  // session racing here would both read "not credited" and both write, doubling
  // real money. Serialise with a script lock so only one runs the check→write.
  var lock = LockService.getScriptLock();
  try {
    // Transient: couldn't get the lock in time — THROW so Stripe retries rather
    // than risk acking without having safely credited.
    lock.waitLock(30000);
  } catch (lockErr) {
    throw new Error('Stripe webhook: could not acquire lock for session ' +
      sessionId + ' — deferring for retry. ' + lockErr);
  }

  try {
    // Re-check under the lock: a racing delivery may have just credited it.
    if (ledgerHasReference_(sessionId, 'Top-up')) {
      Logger.log('Stripe webhook: session ' + sessionId +
        ' already credited — skipping.');
      return stripeAck_();
    }

    // Credit using the amount Stripe reports, not the (untrusted) POST body.
    var pounds = (Number(session.amount_total) || 0) / 100;
    appendLedgerEntry(custNum, 'Top-up', pounds, 'Stripe', sessionId,
      meta.memo || 'Stripe top-up', 'System');
    Logger.log('Stripe webhook: credited £' + pounds + ' to CustomerID ' +
      custNum + ' (session ' + sessionId + ').');

    return stripeAck_();
  } finally {
    lock.releaseLock();
  }
}

/** 200 ack that tells Stripe the event is handled — stop retrying. */
function stripeAck_() {
  return ContentService
    .createTextOutput(JSON.stringify({ received: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * GET a Stripe resource. Returns the parsed body on 2xx.
 * Returns null on 400/404 (malformed/unknown id — terminal, never retry).
 * THROWS on 401/403/429/5xx and network errors (transient — caller should let
 * the exception propagate so Stripe retries the webhook later).
 */
function stripeGet_(url, key) {
  var resp = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + key },
    muteHttpExceptions: true
  });
  var code = resp.getResponseCode();
  if (code >= 200 && code < 300) {
    return JSON.parse(resp.getContentText() || '{}');
  }
  if (code === 400 || code === 404) {
    Logger.log('Stripe GET ' + code + ' (terminal) for ' + url + ': ' +
      resp.getContentText());
    return null;
  }
  throw new Error('Stripe GET ' + code + ' (transient) for ' + url + ': ' +
    resp.getContentText());
}

/**
 * Canonical Ledger double-spend / idempotency guard (defined ONCE — do not
 * redefine elsewhere). True if any Ledger row's Reference equals `reference`.
 * If `type` is given, the row's Type must also match.
 *   ledgerHasReference_('BOOKING-42')                 → reference-only (Bookings)
 *   ledgerHasReference_(sessionId, 'Top-up')          → Stripe webhook
 *   ledgerHasReference_('SIMRENEW-…', 'Auto-deduct')  → SIM renewal
 */
function ledgerHasReference_(reference, type) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Ledger');
  if (!sheet) return false;
  var last = sheet.getLastRow();
  if (last < 2) return false;
  var idx = headerIndex_(sheet);
  if (!idx.hasOwnProperty('Reference')) {
    throw new Error('"Ledger" tab has no "Reference" column — cannot run ' +
      'the reference guard.');
  }
  var rows = sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).getValues();
  var wantedRef = String(reference);
  var filterType = (type !== undefined && type !== null && type !== '');
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][idx['Reference']]) !== wantedRef) continue;
    if (filterType && String(rows[i][idx['Type']]) !== String(type)) continue;
    return true;
  }
  return false;
}

/* ============================================================
 * 9. BALANCE REMINDER EMAIL
 * ============================================================ */

/**
 * Email a customer who is in arrears. Returns true if an email was sent,
 * false if the balance is not negative (or no email on file).
 */
function sendBalanceReminderEmail(customerId) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Customers');
  var cust = findRowById_(sheet, customerId);
  if (!cust) return false;

  var name = cust.values[1];   // col 2 Name
  var email = cust.values[3];  // col 4 Email
  var balance = getWalletBalance(customerId);
  if (balance >= 0) return false;        // nothing owed
  if (!email) {
    Logger.log('No email on file for CustomerID ' + customerId);
    return false;
  }

  var owed = Math.abs(balance).toFixed(2);
  GmailApp.sendEmail(email, 'Kosher Connect — outstanding balance',
    'Hi ' + name + ', you have an outstanding balance of £' + owed +
    ' on your Kosher Connect account. Please get in touch to settle this. ' +
    'Thank you.');
  return true;
}

/* ============================================================
 * 10. COLLECTIONS SWEEP (daily)
 * ============================================================ */

/**
 * Daily collections sweep. IDEMPOTENT — safe to run any number of times.
 *
 * For every customer seen in the Ledger:
 *   - balance < 0: upsert ONE High-priority Task keyed by the stable Reference
 *     "BALANCE-<CustomerID>". If an open one already exists it is updated in
 *     place (new amount, refreshed DueDate); otherwise a new one is created
 *     with the Reference set. Re-runs therefore never duplicate.
 *   - balance >= 0: close (Done="y") any open BALANCE task for that customer
 *     and do nothing else.
 *
 * Customer-facing email is gated behind the Settings flag SEND_CUSTOMER_EMAILS
 * (1 = on, anything else / missing = OFF). It is OFF by default because the
 * customer addresses on file are placeholders that bounce. Internal Task
 * alerts are always raised regardless of the flag.
 *
 * Requires a "Reference" column on the Tasks sheet (the dedup key).
 */
function runCollectionsReminders() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var names = idNameMap_(ss.getSheetByName('Customers'), 1, 2);
  var tasks = ss.getSheetByName('Tasks');
  if (!tasks) throw new Error('Tasks tab not found.');

  var tIdx = headerIndex_(tasks);
  if (!tIdx.hasOwnProperty('Reference')) {
    throw new Error('Tasks sheet has no "Reference" column — required as the ' +
      'BALANCE-<CustomerID> dedup key. Add it before running.');
  }

  var sendEmails = collectionsEmailsEnabled_();
  var ids = uniqueLedgerCustomerIds_();
  var created = 0, updated = 0, closed = 0, emailed = 0;

  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    var balance = getWalletBalance(id);
    var reference = 'BALANCE-' + id;

    if (balance >= 0) {
      // Back in credit: resolve the alert, send nothing.
      if (closeTaskByReference_(tasks, reference)) closed++;
      continue;
    }

    var owed = Math.abs(balance).toFixed(2);
    var name = names[id] || ('Customer #' + id);
    var title = 'Outstanding balance — ' + name + ' — £' + owed;
    var memo = 'Negative wallet balance £' + owed + ' (CustomerID ' + id + ').';

    var outcome = upsertTaskByReference_(tasks, reference, title, memo);
    if (outcome === 'created') created++;
    else if (outcome === 'updated') updated++;

    if (sendEmails && sendBalanceReminderEmail(id)) emailed++;
  }

  Logger.log('runCollectionsReminders — created: ' + created + ', updated: ' +
    updated + ', closed: ' + closed + ', emailed: ' + emailed +
    '  (customer emails ' + (sendEmails ? 'ON' : 'OFF') + ').');
  return {
    customers: ids.length, created: created, updated: updated,
    closed: closed, emailed: emailed
  };
}

/**
 * Read the SEND_CUSTOMER_EMAILS Settings flag. Returns true ONLY when the
 * value is numeric 1; a missing key, 0, or any non-numeric value means OFF.
 * (Read via getSettingValue so Settings stays the single source of truth.)
 */
function collectionsEmailsEnabled_() {
  try {
    return Number(getSettingValue('SEND_CUSTOMER_EMAILS')) === 1;
  } catch (e) {
    return false; // key absent → default OFF
  }
}

/**
 * Upsert a High-priority task keyed by Reference (generic — used for Outstanding
 * -balance BALANCE-<id> tasks and rental RATEMISSING-<id> tasks). If an OPEN
 * (Done!="y") task with this Reference exists, refresh its Title / RawText /
 * DueDate / Priority in place and return 'updated'. Otherwise append a new High
 * task carrying the Reference and return 'created'. Columns addressed by name.
 */
function upsertTaskByReference_(tasksSheet, reference, title, memo) {
  var idx = headerIndex_(tasksSheet);
  var width = tasksSheet.getLastColumn();
  var last = tasksSheet.getLastRow();
  var now = new Date();

  if (last >= 2) {
    var data = tasksSheet.getRange(2, 1, last - 1, width).getValues();
    for (var i = 0; i < data.length; i++) {
      var ref = String(data[i][idx['Reference']] || '').trim();
      var done = String(data[i][idx['Done']] || '').trim().toLowerCase();
      if (ref === reference && done !== 'y') {
        var row = data[i];
        row[idx['Title']] = title;
        row[idx['RawText']] = memo;
        row[idx['DueDate']] = now;
        row[idx['Priority']] = 'High';
        tasksSheet.getRange(i + 2, 1, 1, width).setValues([row]);
        return 'updated';
      }
    }
  }

  var newRow = new Array(width).fill('');
  newRow[idx['TaskID']] = nextIdInColumnA_(tasksSheet);
  newRow[idx['Title']] = title;
  newRow[idx['DueDate']] = now;
  newRow[idx['Source']] = 'Auto';
  newRow[idx['Priority']] = 'High';
  newRow[idx['Done']] = 'n';
  newRow[idx['RawText']] = memo;
  newRow[idx['CreatedAt']] = now;
  newRow[idx['Reference']] = reference;
  tasksSheet.getRange(tasksSheet.getLastRow() + 1, 1, 1, width).setValues([newRow]);
  return 'created';
}

/**
 * Close (Done="y") every open task with this Reference. Returns true if at
 * least one was closed. Generic — used when a customer's balance returns to
 * >= 0 (BALANCE-<id>) and when a rental is re-priced cleanly (RATEMISSING-<id>).
 */
function closeTaskByReference_(tasksSheet, reference) {
  var idx = headerIndex_(tasksSheet);
  var last = tasksSheet.getLastRow();
  if (last < 2) return false;
  var width = tasksSheet.getLastColumn();
  var data = tasksSheet.getRange(2, 1, last - 1, width).getValues();

  var closedAny = false;
  for (var i = 0; i < data.length; i++) {
    var ref = String(data[i][idx['Reference']] || '').trim();
    var done = String(data[i][idx['Done']] || '').trim().toLowerCase();
    if (ref === reference && done !== 'y') {
      tasksSheet.getRange(i + 2, idx['Done'] + 1).setValue('y');
      closedAny = true;
    }
  }
  return closedAny;
}

/**
 * Run ONCE from the editor (select createCollectionsTrigger ▸ Run, approve
 * prompts) to install the daily collections sweep. Safe to re-run.
 */
function createCollectionsTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'runCollectionsReminders') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('runCollectionsReminders')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();
  Logger.log('Installed daily runCollectionsReminders trigger.');
}

/* ============================================================
 * HELPERS (uniquely named)
 * ============================================================ */

/** Sign convention by ledger Type: +1 money in, −1 money out. */
function typeSign_(type) {
  switch (String(type)) {
    case 'Payment':
    case 'Top-up':
    case 'Refund':
      return 1;
    case 'Charge':
    case 'Auto-deduct':
    case 'LateFee':
      return -1;
    default:
      return 1; // unknown types treated as inflow; adjust if you add types
  }
}

/** Active user's email, or "System" in automation contexts. */
function activeUserOrSystem_() {
  try {
    var email = Session.getActiveUser().getEmail();
    return email || 'System';
  } catch (e) {
    return 'System';
  }
}

/** Shared {entryId, newBalance, warning} shape for autoDeduct. */
function withBalanceWarning_(entryId, customerId) {
  var newBalance = getWalletBalance(customerId);
  var warning = null;
  if (newBalance < 0) {
    warning = 'Balance negative — customer owes £' +
      Math.abs(newBalance).toFixed(2);
  }
  return { entryId: entryId, newBalance: newBalance, warning: warning };
}

/** POST form-encoded params to Stripe; return parsed JSON or throw. */
function stripePost_(url, params, key) {
  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: { Authorization: 'Bearer ' + key },
    payload: params, // object → application/x-www-form-urlencoded
    muteHttpExceptions: true
  });
  var code = resp.getResponseCode();
  var body = JSON.parse(resp.getContentText() || '{}');
  if (code < 200 || code >= 300) {
    var msg = (body.error && body.error.message) || resp.getContentText();
    throw new Error('Stripe ' + code + ': ' + msg);
  }
  return body;
}

/** Distinct CustomerIDs appearing in the Ledger. */
function uniqueLedgerCustomerIds_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Ledger');
  var out = [];
  if (!sheet) return out;
  var last = sheet.getLastRow();
  if (last < 2) return out;
  var col = sheet.getRange(2, 2, last - 1, 1).getValues(); // CustomerID
  var seen = {};
  for (var i = 0; i < col.length; i++) {
    var id = col[i][0];
    if (id === '' || id === null) continue;
    var k = String(id);
    if (!seen[k]) { seen[k] = true; out.push(id); }
  }
  return out;
}
