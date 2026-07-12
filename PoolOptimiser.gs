/**
 * Kosher Connect — USMobile pool optimiser (Task 4)
 * Companion to RentalEngine.gs / SIMWatcher.gs (same Apps Script project).
 *
 *   getAvailablePhones(country)            Available + Pool-Active phones
 *   suggestPhone(returnDueDate)            best USA pool phone, ranked
 *   suggestPhoneForBooking(...)            phone suggestion + price for booking
 *   confirmPoolActivation(phoneId, poolId) mark a new line for activation
 *   releasePoolPhone(phoneId)              on return: keep in pool or free it
 *
 * Reuses helpers from sibling files (same global scope): toDate_, dayDiff_,
 * findRowById_ (RentalEngine.gs), appendTask_ (SIMWatcher.gs), calcRental
 * (RentalEngine.gs). Those files must be present in the project.
 *
 * Phones columns: 1 PhoneID 2 Make 3 Model 4 IMEI 5 Serial 6 PoolID
 *   7 Status 8 Condition 9 Notes
 * Pools  columns: 1 PoolID 2 PoolNumber 3 ActivationDate 4 ExpiryDate
 *   5 LinesActive 6 Notes
 */

var KC_POOL_KEEP_DAYS = 7;      // expiry must be >7 days out to keep a phone pooled
var KC_ACTIVATION_FEE = 8;      // $ saved by reusing an already-active line

/* ============================================================
 * 1. AVAILABLE PHONES
 * ============================================================ */

/**
 * Return every Phones row whose Status is "Available" or "Pool-Active", as an
 * array of objects. `country` is accepted for signature compatibility; the
 * list is the same regardless (pool scoring only matters for USA, handled in
 * suggestPhone).
 */
function getAvailablePhones(country) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Phones');
  var out = [];
  if (!sheet) return out;
  var last = sheet.getLastRow();
  if (last < 2) return out;

  var data = sheet.getRange(2, 1, last - 1, 9).getValues();
  for (var i = 0; i < data.length; i++) {
    var status = String(data[i][6]).trim(); // col 7
    if (status === 'Available' || status === 'Pool-Active') {
      out.push(phoneObj_(data[i], i + 2));
    }
  }
  return out;
}

/* ============================================================
 * 2. POOL OPTIMISER
 * ============================================================ */

/**
 * Suggest the best pooled phone for a rental returning on `returnDueDate`.
 * Scores each Available/Pool-Active phone that belongs to a pool by how well
 * the pool's ExpiryDate lines up with the return date, favouring already-active
 * lines (saves the $8 activation fee). Returns the top suggestion with up to
 * two ranked alternatives, or { error } if there are no pooled candidates.
 */
function suggestPhone(returnDueDate) {
  var due = toDate_(returnDueDate);
  if (!due) return { error: 'Invalid return date' };

  var pools = poolMap_();
  var phones = getAvailablePhones('USA');

  var ranked = [];
  for (var i = 0; i < phones.length; i++) {
    var p = phones[i];
    if (p.poolId === '' || p.poolId === null) continue; // must be in a pool
    var pool = pools[p.poolId];
    if (!pool) continue;                                 // pool row missing
    var expiry = toDate_(pool.expiryDate);
    if (!expiry) continue;                               // no expiry to score

    var overlap = dayDiff_(expiry, due); // expiry − return, in whole days
    var alreadyActive = (p.status === 'Pool-Active');
    ranked.push({
      score: scorePool_(overlap, alreadyActive),
      overlap: overlap,
      suggestion: buildSuggestion_(p, pool, overlap, alreadyActive)
    });
  }

  if (ranked.length === 0) {
    return { error: 'No phones available for this date range' };
  }

  ranked.sort(function (a, b) {
    if (b.score !== a.score) return b.score - a.score; // higher score first
    if (a.overlap !== b.overlap) return a.overlap - b.overlap; // tighter fit
    return a.suggestion.phoneId - b.suggestion.phoneId;
  });

  var top = ranked[0].suggestion;
  top.alternatives = ranked.slice(1, 3).map(function (r) { return r.suggestion; });
  return top;
}

/* ============================================================
 * 3. SUGGESTION FOR BOOKING (phone + price)
 * ============================================================ */

/**
 * Booking-flow wrapper: pick a phone and price the rental.
 *   - non-USA: first Available/Pool-Active phone, no scoring.
 *   - USA: suggestPhone(returnDueDate).
 * Always attaches priceBreakdown from calcRental(..., "Diaspora").
 * Returns { error } if nothing is available.
 */
function suggestPhoneForBooking(customerId, country, startDate, returnDueDate,
                                vnOption) {
  var result;

  if (String(country).toUpperCase() !== 'USA') {
    var phones = getAvailablePhones(country);
    if (phones.length === 0) {
      return { error: 'No phones available for this date range' };
    }
    var first = phones[0];
    result = {
      phoneId: first.phoneId,
      make: first.make,
      model: first.model,
      poolId: first.poolId,
      poolNumber: '',
      poolExpiry: '',
      overlapDays: null,
      alreadyActive: (first.status === 'Pool-Active'),
      reason: 'Non-USA rental — any available phone is fine.',
      alternatives: phones.slice(1, 3).map(function (p) {
        return {
          phoneId: p.phoneId, make: p.make, model: p.model,
          poolId: p.poolId, alreadyActive: (p.status === 'Pool-Active'),
          reason: 'Alternative available phone.'
        };
      })
    };
  } else {
    result = suggestPhone(returnDueDate);
    if (result.error) {
      return { error: 'No phones available for this date range' };
    }
  }

  result.priceBreakdown = calcRental(country, startDate, returnDueDate,
                                     vnOption, 'Diaspora');
  return result;
}

/* ============================================================
 * 4. CONFIRM POOL ACTIVATION (after booking a not-yet-active phone)
 * ============================================================ */

/**
 * Mark a previously "Available" phone as "Pool-Active" and raise a High task
 * to activate the line in the USMobile dashboard.
 */
function confirmPoolActivation(phoneId, poolId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var phonesSheet = ss.getSheetByName('Phones');
  var phone = findRowById_(phonesSheet, phoneId);
  if (!phone) return { ok: false, error: 'Phone not found: ' + phoneId };

  phonesSheet.getRange(phone.row, 7).setValue('Pool-Active'); // Status

  var make = phone.values[1];
  var model = phone.values[2];
  var pools = poolMap_();
  var poolNumber = (pools[poolId] && pools[poolId].poolNumber) || poolId;

  appendTask_(ss.getSheetByName('Tasks'),
    'Activate pool line for ' + (String(make) + ' ' + String(model)).trim() +
      ' — Pool ' + poolNumber,
    'High',
    'New USA rental booked — phone needs activating in USMobile dashboard ' +
      'before departure.');

  return {
    ok: true,
    phoneId: phoneId,
    poolId: poolId,
    status: 'Pool-Active',
    message: 'Phone marked Pool-Active; activation task created.'
  };
}

/* ============================================================
 * 5. RELEASE POOL PHONE (on return)
 * ============================================================ */

/**
 * Decide a returned USA phone's fate by how soon its pool expires:
 *   - expiry > 7 days away  → keep Pool-Active (re-rentable).
 *   - expiry within 7 days  → set Available and clear PoolID.
 *   - no pool/expiry        → set Available and clear PoolID.
 */
function releasePoolPhone(phoneId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var phonesSheet = ss.getSheetByName('Phones');
  var phone = findRowById_(phonesSheet, phoneId);
  if (!phone) return { ok: false, error: 'Phone not found: ' + phoneId };

  var poolId = phone.values[5]; // col 6
  var pools = poolMap_();
  var pool = (poolId !== '' && poolId !== null) ? pools[poolId] : null;
  var expiry = pool ? toDate_(pool.expiryDate) : null;
  var today = toDate_(new Date());

  var action, reason;
  if (expiry && dayDiff_(expiry, today) > KC_POOL_KEEP_DAYS) {
    var days = dayDiff_(expiry, today);
    phonesSheet.getRange(phone.row, 7).setValue('Pool-Active');
    action = 'kept-active';
    reason = 'Pool expires in ' + days + ' days (> ' + KC_POOL_KEEP_DAYS +
      ') — kept Pool-Active for re-rental.';
  } else {
    phonesSheet.getRange(phone.row, 7).setValue('Available'); // Status
    phonesSheet.getRange(phone.row, 6).setValue('');          // clear PoolID
    if (!expiry) {
      action = 'released';
      reason = 'No pool/expiry on record — set Available and cleared pool.';
    } else {
      var d2 = dayDiff_(expiry, today);
      action = 'released';
      reason = 'Pool expires in ' + d2 + ' days (<= ' + KC_POOL_KEEP_DAYS +
        ') — set Available and cleared pool.';
    }
  }

  return { ok: true, phoneId: phoneId, action: action, reason: reason };
}

/* ============================================================
 * HELPERS (uniquely named)
 * ============================================================ */

/** Build a phone object from a Phones row + its 1-based sheet row. */
function phoneObj_(row, sheetRow) {
  return {
    phoneId: row[0], make: row[1], model: row[2], imei: row[3],
    serial: row[4], poolId: row[5], status: String(row[6]).trim(),
    condition: row[7], notes: row[8], row: sheetRow
  };
}

/** Map PoolID → { poolNumber, activationDate, expiryDate, linesActive, row }. */
function poolMap_() {
  var map = {};
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Pools');
  if (!sheet) return map;
  var last = sheet.getLastRow();
  if (last < 2) return map;
  var data = sheet.getRange(2, 1, last - 1, 6).getValues();
  for (var i = 0; i < data.length; i++) {
    map[data[i][0]] = {
      poolNumber: data[i][1],
      activationDate: data[i][2],
      expiryDate: data[i][3],
      linesActive: data[i][4],
      row: i + 2
    };
  }
  return map;
}

/**
 * Higher score = better. Ideal overlap is 0–3 days (pool expires just after
 * return). Negative overlap (pool dies mid-rental) is heavily penalised; large
 * positive overlap (idle pool time) is penalised lightly. Already-active lines
 * get a tie-breaker bonus equal to the activation fee saved.
 */
function scorePool_(overlap, alreadyActive) {
  var s;
  if (overlap < 0) {
    s = -1000 + overlap * 10;        // worse the earlier it expires
  } else if (overlap <= 3) {
    s = 100 - overlap;               // 97–100, minimal waste
  } else {
    s = 90 - (overlap - 3) * 1.5;    // light, decreasing penalty
  }
  if (alreadyActive) s += KC_ACTIVATION_FEE;
  return s;
}

/** Assemble the suggestion object (incl. plain-English reason). */
function buildSuggestion_(phone, pool, overlap, alreadyActive) {
  return {
    phoneId: phone.phoneId,
    make: phone.make,
    model: phone.model,
    poolId: phone.poolId,
    poolNumber: pool.poolNumber,
    poolExpiry: pool.expiryDate,
    overlapDays: overlap,
    alreadyActive: alreadyActive,
    reason: reasonFor_(overlap, alreadyActive)
  };
}

function reasonFor_(overlap, alreadyActive) {
  var part1;
  if (overlap < 0) {
    var b = Math.abs(overlap);
    part1 = 'Pool expires ' + b + ' day' + plural_(b) +
      ' BEFORE return — risky, customer may lose service mid-rental.';
  } else if (overlap <= 3) {
    part1 = 'Pool expires ' + overlap + ' day' + plural_(overlap) +
      ' after return — minimal waste.';
  } else {
    part1 = 'Pool expires ' + overlap + ' days after return — some idle ' +
      'pool time.';
  }
  var part2 = alreadyActive
    ? 'Already active, saves $' + KC_ACTIVATION_FEE + ' activation fee.'
    : 'Needs activation ($' + KC_ACTIVATION_FEE + ' fee).';
  return part1 + ' ' + part2;
}

function plural_(n) {
  return n === 1 ? '' : 's';
}
