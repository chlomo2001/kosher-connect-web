/**
 * Kosher Connect — To-Do list & SMS text-in via Twilio (Task 7)
 * Companion to RentalEngine.gs / SIMWatcher.gs / Ledger.gs.
 *
 *   addTask(title, dueDate, priority, source, rawText)
 *   parseTaskWithAI(rawText)  Anthropic → {title, dueDate, priority}
 *   smsWebhookHandler(e)      inbound Twilio SMS → task + confirmation reply
 *   doPost(e)                 SINGLE web-app entry: routes SMS vs Stripe
 *   addScriptProperties()     log which Script Properties are set / missing
 *
 * Reuses (same project, do not redefine): nextIdInColumnA_, findRowById_,
 * toDate_ (RentalEngine.gs); stripeWebhookHandler (Ledger.gs).
 *
 * Tasks columns (1-based):
 *   1 TaskID 2 Title 3 DueDate 4 Source 5 Priority 6 Done 7 RawText 8 CreatedAt
 */

var KC_TASK_PRIORITIES = ['High', 'Normal', 'Low'];
var KC_TASK_SOURCES = ['Manual', 'SMS', 'Auto'];
var KC_AI_MODEL = 'claude-haiku-4-5-20251001';

/* ============================================================
 * 1–4. TASK CRUD / QUERIES
 * ============================================================ */

/**
 * Append a Task row. TaskID computed here (script writes don't fire onEdit).
 * Done="n", CreatedAt=now. Priority defaults to Normal, Source to Manual, if
 * not a recognised value. Returns the new TaskID.
 */
function addTask(title, dueDate, priority, source, rawText) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tasks');
  var taskId = nextIdInColumnA_(sheet);

  var pri = KC_TASK_PRIORITIES.indexOf(priority) >= 0 ? priority : 'Normal';
  var src = KC_TASK_SOURCES.indexOf(source) >= 0 ? source : 'Manual';
  var due = toDate_(dueDate); // null for blank/invalid

  // 1 TaskID 2 Title 3 DueDate 4 Source 5 Priority 6 Done 7 RawText 8 CreatedAt
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, 8).setValues([[
    taskId, sanitizeCellText_(title), due ? due : '', src, pri, 'n',
    sanitizeCellText_(rawText || ''), new Date()
  ]]);
  return taskId;
}

/* ============================================================
 * 5. AI TASK PARSER
 * ============================================================ */

/**
 * Ask Anthropic to turn a free-text message into {title, dueDate, priority}.
 * Falls back to a trimmed-title task if the key is absent or parsing fails.
 */
function parseTaskWithAI(rawText) {
  var fallback = {
    title: String(rawText || '').substring(0, 80),
    dueDate: null,
    priority: 'Normal'
  };

  var key = PropertiesService.getScriptProperties()
    .getProperty('ANTHROPIC_API_KEY');
  if (!key) return fallback;

  var system = 'You are a task parser for a small business. Extract a task ' +
    'title and due date from the user\'s message. Respond only with valid ' +
    'JSON in this format: {"title": "string", "dueDate": "YYYY-MM-DD or ' +
    'null", "priority": "High or Normal or Low"}. If no date is mentioned, ' +
    'set dueDate to null. If urgency words like urgent, asap, today, tonight ' +
    'are used, set priority to High. Keep the title concise — under 10 words.';

  var payload = {
    model: KC_AI_MODEL,
    max_tokens: 200,
    system: system,
    messages: [{ role: 'user', content: String(rawText || '') }]
  };

  try {
    var resp = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() !== 200) {
      Logger.log('parseTaskWithAI non-200: ' + resp.getContentText());
      return fallback;
    }
    var data = JSON.parse(resp.getContentText());
    var text = (data.content && data.content[0] && data.content[0].text)
      ? data.content[0].text.trim() : '';
    // The model may wrap JSON in prose/fences; grab the first {...} block.
    var m = text.match(/\{[\s\S]*\}/);
    var parsed = JSON.parse(m ? m[0] : text);

    var priority = KC_TASK_PRIORITIES.indexOf(parsed.priority) >= 0
      ? parsed.priority : 'Normal';
    var dueDate = (parsed.dueDate && String(parsed.dueDate).toLowerCase() !== 'null')
      ? parsed.dueDate : null;
    var title = parsed.title ? String(parsed.title) : fallback.title;

    return { title: title, dueDate: dueDate, priority: priority };
  } catch (e) {
    Logger.log('parseTaskWithAI failed: ' + e);
    return fallback;
  }
}

/* ============================================================
 * 6. SMS WEBHOOK + doPost ROUTER
 * ============================================================ */

/**
 * SINGLE web-app entry point for the whole project. Routes Twilio inbound SMS
 * (form-encoded, carries From/Body) to smsWebhookHandler; everything else
 * (Stripe JSON) to stripeWebhookHandler in Ledger.gs.
 *
 * DEPLOY AS A WEB APP (covers BOTH Stripe and SMS — one URL):
 *   1. Apps Script ▸ Deploy ▸ New deployment ▸ "Web app".
 *   2. Execute as: Me.  Who has access: Anyone.
 *   3. Deploy, authorise, copy the /exec URL.
 *   4. Stripe: Developers ▸ Webhooks ▸ the /exec URL, event
 *        checkout.session.completed.
 *   5. Twilio: Phone Numbers ▸ Manage ▸ the KC number ▸ Messaging ▸
 *        "A message comes in": Webhook = the /exec URL, method HTTP POST.
 *   (Re-deploying makes a new URL — update both dashboards if you redeploy.)
 */
function doPost(e) {
  if (e && e.parameter &&
      (e.parameter.From !== undefined || e.parameter.Body !== undefined)) {
    return smsWebhookHandler(e);
  }
  return stripeWebhookHandler(e); // Ledger.gs
}

/**
 * Handle an inbound Twilio SMS: security-check the sender, parse the message
 * into a task, add it, and text back a confirmation. Always returns a 200
 * TwiML response — never an error to Twilio.
 */
function smsWebhookHandler(e) {
  var props = PropertiesService.getScriptProperties();

  // TOKEN GATE (fail closed) — runs before reading the message and before ANY
  // Anthropic call. This branch is reachable at the public /exec URL, so require
  // a shared secret in the URL (?token=...) matching the Script Property
  // TWILIO_WEBHOOK_TOKEN (separate from the Stripe token). doPost can't read
  // request headers, so a query-param token is the only gate available. If the
  // property is unset/empty, reject ALL requests — never fall open.
  var expectedToken = props.getProperty('TWILIO_WEBHOOK_TOKEN') || '';
  var gotToken = (e && e.parameter && e.parameter.token) ? e.parameter.token : '';
  if (!expectedToken || gotToken !== expectedToken) {
    Logger.log('SMS webhook: rejected — missing/invalid token.');
    return twiml_(); // empty 200, no action, no Anthropic call
  }

  var from = (e && e.parameter && e.parameter.From) ? e.parameter.From : '';
  var body = (e && e.parameter && e.parameter.Body) ? e.parameter.Body : '';

  var allowed = props.getProperty('SHLOIME_PHONE') || '';
  if (!phoneMatches_(from, allowed)) {
    Logger.log('Rejected SMS from ' + from);
    return twiml_(); // 200, no action
  }

  try {
    var parsed = parseTaskWithAI(body);
    addTask(parsed.title, parsed.dueDate, parsed.priority, 'SMS', body);
    sendTwilioSms_(from, 'Got it — added to your list: ' + parsed.title);
  } catch (err) {
    Logger.log('smsWebhookHandler error: ' + err);
  }
  return twiml_();
}

/* ============================================================
 * 7. SCRIPT PROPERTY CHECKLIST
 * ============================================================ */

/**
 * Log which required Script Properties are set vs missing (values never
 * logged). Run from the editor and read View ▸ Logs.
 */
function addScriptProperties() {
  var required = ['ANTHROPIC_API_KEY', 'STRIPE_SECRET_KEY', 'SHLOIME_PHONE',
    'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_NUMBER'];
  var props = PropertiesService.getScriptProperties();
  Logger.log('Script Properties status:');
  for (var i = 0; i < required.length; i++) {
    var v = props.getProperty(required[i]);
    Logger.log('  ' + required[i] + ': ' +
      (v && String(v).trim() !== '' ? 'SET' : 'MISSING'));
  }
}

/* ============================================================
 * HELPERS (uniquely named)
 * ============================================================ */

/** Send an SMS via Twilio's REST API using Basic auth. */
function sendTwilioSms_(to, message) {
  var props = PropertiesService.getScriptProperties();
  var sid = props.getProperty('TWILIO_ACCOUNT_SID');
  var token = props.getProperty('TWILIO_AUTH_TOKEN');
  var fromNumber = props.getProperty('TWILIO_NUMBER');
  if (!sid || !token || !fromNumber) {
    Logger.log('Twilio not fully configured — confirmation SMS skipped.');
    return;
  }
  var url = 'https://api.twilio.com/2010-04-01/Accounts/' + sid + '/Messages.json';
  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: { Authorization: 'Basic ' + Utilities.base64Encode(sid + ':' + token) },
    payload: { To: to, From: fromNumber, Body: message },
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() >= 300) {
    Logger.log('Twilio send failed: ' + resp.getResponseCode() + ' ' +
      resp.getContentText());
  }
}

/** Empty 200 TwiML response. */
function twiml_() {
  return ContentService
    .createTextOutput('<?xml version="1.0" encoding="UTF-8"?><Response></Response>')
    .setMimeType(ContentService.MimeType.XML);
}

/** Compare two phone numbers by their digits (ignoring +, spaces, dashes). */
function phoneMatches_(a, b) {
  var da = String(a || '').replace(/\D/g, '');
  var db = String(b || '').replace(/\D/g, '');
  if (!da || !db) return false;
  return da === db || da.slice(-10) === db.slice(-10); // tolerate +44/0 prefixes
}
