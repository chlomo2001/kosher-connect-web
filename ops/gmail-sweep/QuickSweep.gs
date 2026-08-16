/**
 * Quick sweep of the shop's Gmail — runs INSIDE the account, no credentials leave Google.
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 * The 31 Jul sweep of 5311386k@gmail.com was run from a container with a `gws`
 * CLI and an OAuth token file. Both are gone: web sessions get a fresh
 * container every time, and those tokens were testing-mode, expired ~5 Aug.
 * Re-creating them means handling a refresh token, which is a secret — and
 * secrets never go through chat.
 *
 * This route avoids the problem completely. The script runs as the mailbox
 * owner, inside Google, and shares a finished Sheet with the owner's account.
 * Nothing to install, nothing to paste, no token anywhere.
 *
 * HOW TO RUN IT (about 3 minutes of clicking)
 *   1. Sign in to script.google.com as 5311386k@gmail.com — that account, not
 *      the owner's. Check the avatar top-right before starting.
 *   2. New project → name it "KC number sweep" → paste this whole file in,
 *      replacing what's there.
 *   3. Left bar → Services → + → Gmail API → Add. (This script uses the
 *      advanced service so it can read subject + snippet WITHOUT opening
 *      message bodies — far faster, and it never touches attachments.)
 *   4. Run → choose `sweep` → Review permissions → allow. Google will warn
 *      that the app is unverified; it is your own script in your own account.
 *   5. It runs for five minutes, then stops and tells you in the log whether
 *      it finished. If it says MORE TO DO, just press Run again. Repeat until
 *      it says DONE — each press picks up exactly where the last one stopped.
 *   6. The log prints the Sheet URL. It is already shared with SHARE_WITH.
 *
 * WHAT IT COLLECTS
 * One row per distinct UK mobile number seen in provider mail: the number, the
 * carrier that mailed about it, how many messages mentioned it, and the date of
 * the most recent one. That last column is the one that matters — it is what
 * separates a live plan from a ceased one.
 *
 * It reads ONLY subject and snippet, exactly like the July sweep, so the counts
 * are a floor: a number mentioned only deep inside a body is missed.
 */

// ── Settings ────────────────────────────────────────────────────────────────
// 60 days answers "what is live now". Widen to 365 for a full picture, but
// expect several more Run presses.
var DAYS = 60;

// The account is a provider feed — 25,393 of 26,210 messages, and one human in
// a hundred — so a broad sender match is safe here.
var QUERY = 'newer_than:' + DAYS + 'd (lebara OR 1pmobile OR "us mobile" OR ' +
            'smarty OR tello OR three OR asda OR giffgaff OR "talk home")';

// The finished Sheet is shared with this address automatically.
var SHARE_WITH = 'e.a.rothbart@gmail.com';

// Apps Script kills a run at 6 minutes. Stop at 5 and leave a clean cursor.
var STOP_AFTER_MS = 5 * 60 * 1000;

// ── The sweep ───────────────────────────────────────────────────────────────
function sweep() {
  var started = new Date().getTime();
  var props = PropertiesService.getScriptProperties();
  var sheet = openSheet_(props);
  var seen = loadSeen_(sheet);          // number → row index, for updates
  var pageToken = props.getProperty('pageToken') || null;
  var scanned = Number(props.getProperty('scanned') || 0);

  while (true) {
    if (new Date().getTime() - started > STOP_AFTER_MS) {
      props.setProperty('pageToken', pageToken || '');
      props.setProperty('scanned', String(scanned));
      Logger.log('MORE TO DO — ' + scanned + ' messages so far, ' + seen.count +
                 ' numbers. Press Run again.');
      return;
    }

    var page = Gmail.Users.Messages.list('me', {
      q: QUERY, maxResults: 500, pageToken: pageToken || undefined,
    });
    var ids = page.messages || [];
    for (var i = 0; i < ids.length; i++) {
      var m = Gmail.Users.Messages.get('me', ids[i].id, {
        format: 'metadata', metadataHeaders: ['Subject', 'From', 'Date'],
      });
      scanned++;
      var text = (m.snippet || '') + ' ' + header_(m, 'Subject');
      var from = header_(m, 'From');
      var when = new Date(Number(m.internalDate));
      var numbers = ukMobiles_(text);
      for (var n = 0; n < numbers.length; n++) record_(sheet, seen, numbers[n], from, when);
    }

    pageToken = page.nextPageToken;
    if (!pageToken) {
      props.deleteProperty('pageToken');
      props.setProperty('scanned', String(scanned));
      SpreadsheetApp.flush();
      Logger.log('DONE — ' + scanned + ' messages, ' + seen.count + ' numbers.');
      Logger.log('Sheet: ' + sheet.getParent().getUrl());
      return;
    }
  }
}

/** Start over from scratch (clears the cursor AND the sheet). */
function resetSweep() {
  PropertiesService.getScriptProperties().deleteAllProperties();
  Logger.log('Cursor cleared. Delete or rename the old sheet, then run sweep().');
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function header_(msg, name) {
  var h = (msg.payload && msg.payload.headers) || [];
  for (var i = 0; i < h.length; i++) if (h[i].name === name) return h[i].value || '';
  return '';
}

/**
 * UK mobiles in any of the shapes providers use: 07…, +447…, 447…, 00447….
 * Compared on the last 10 digits so all four shapes meet, and returned in that
 * form — the same key the app's SIM numbers are compared on.
 */
function ukMobiles_(text) {
  var out = [];
  var re = /(?:\+?44|0044|0)\s?7\d{3}\s?\d{3}\s?\d{3}/g;
  var hit;
  while ((hit = re.exec(String(text))) !== null) {
    var digits = hit[0].replace(/\D/g, '');
    var tail = digits.slice(-10);
    if (tail.length === 10 && tail.charAt(0) === '7' && out.indexOf(tail) === -1) out.push(tail);
  }
  return out;
}

/** Carrier from the sender address — good enough to group by, never a bill. */
function carrier_(from) {
  var f = String(from).toLowerCase();
  var names = ['lebara', '1pmobile', 'us mobile', 'usmobile', 'smarty', 'tello',
               'three', 'asda', 'giffgaff', 'talkhome'];
  for (var i = 0; i < names.length; i++) if (f.indexOf(names[i]) !== -1) return names[i];
  return 'other';
}

function openSheet_(props) {
  var id = props.getProperty('sheetId');
  if (id) {
    try { return SpreadsheetApp.openById(id).getSheets()[0]; } catch (e) { /* recreate */ }
  }
  var ss = SpreadsheetApp.create('KC number sweep — ' +
    Utilities.formatDate(new Date(), 'Europe/London', 'yyyy-MM-dd'));
  var sh = ss.getSheets()[0];
  sh.appendRow(['number (last 10)', 'carrier', 'messages', 'last seen']);
  sh.setFrozenRows(1);
  props.setProperty('sheetId', ss.getId());
  // Share, don't email: the numbers are customer data and stay inside Drive.
  DriveApp.getFileById(ss.getId()).addEditor(SHARE_WITH);
  Logger.log('Sheet created and shared: ' + ss.getUrl());
  return sh;
}

function loadSeen_(sheet) {
  var seen = { count: 0 };
  var last = sheet.getLastRow();
  if (last < 2) return seen;
  var values = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    seen[String(values[i][0])] = i + 2;
    seen.count++;
  }
  return seen;
}

function record_(sheet, seen, number, from, when) {
  var row = seen[number];
  if (!row) {
    sheet.appendRow([number, carrier_(from), 1, when]);
    seen[number] = sheet.getLastRow();
    seen.count++;
    return;
  }
  var cells = sheet.getRange(row, 3, 1, 2);
  var current = cells.getValues()[0];
  var latest = current[1] instanceof Date && current[1] > when ? current[1] : when;
  cells.setValues([[Number(current[0]) + 1, latest]]);
}
