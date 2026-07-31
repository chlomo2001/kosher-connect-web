// Scan-to-check-out / scan-to-return — the decision, isolated as a pure
// function so it can be unit-tested without a DOM (see test/rentalScan.test.mjs).
// public/main.js mirrors this as kcRentalScanResolve because the browser file
// has no bundler; change both together.
//
// One scan of a handset decides which half of the rental cycle you are in:
// a phone that is out comes back, a phone that is free goes out.
//
// The scan itself never writes. A return carries a late fee and possible
// lost-item charges, so 'return' only means "open Manage Rental with the
// Returned toggle flipped" — a human still presses Save.

const tail = s => String(s || '').replace(/\D/g, '').slice(-10);

/**
 * @param {string} raw          what the scanner typed (IMEI, or a phone number)
 * @param {Array}  phoneList    phones, each {id, imei, number, model, status, maintenance}
 * @param {Array}  rentalList   rentals, each {id, phoneId, status, customerName}
 * @returns {{action:'return'|'checkout'|'blocked'|'none', phoneId?:string, rentalId?:string, message:string}}
 */
export function resolveRentalScan(raw, phoneList = [], rentalList = []) {
  const q = String(raw || '').trim();
  if (!q) return { action: 'none', message: '' };
  const digits = q.replace(/\D/g, '');

  // IMEI is the barcode printed on the handset, so it wins. The number is the
  // fallback for a phone whose IMEI was never recorded. Both compare on the
  // last 10 digits, so 07…, 447… and 00447… all meet — the same rule the
  // Gmail sweep used. The 6/9-digit floors stop a short stray scan matching.
  const phone =
    (digits.length >= 6 && phoneList.find(p => tail(p.imei) && tail(p.imei) === tail(digits))) ||
    (digits.length >= 9 && phoneList.find(p => tail(p.number) && tail(p.number) === tail(digits))) ||
    null;
  if (!phone) {
    return { action: 'none', message: `Nothing matches “${q}”. Scan the IMEI on the handset, or type the number.` };
  }

  const label = [phone.model, phone.number].filter(Boolean).join(' · ') || phone.imei || 'phone';

  // An open rental wins over every other state. A phone that is out is out,
  // even if its inventory row drifted to something odd — the customer is
  // standing there with it.
  const open = rentalList.find(r => r.phoneId === phone.id && r.status !== 'returned');
  if (open) {
    return {
      action: 'return',
      phoneId: phone.id,
      rentalId: open.id,
      message: `${label} — back from ${open.customerName || 'the customer'}. Check the charges, then save.`,
    };
  }

  if (phone.maintenance) {
    return {
      action: 'blocked',
      phoneId: phone.id,
      message: `${label} is on maintenance hold${phone.maintenanceReason ? ` (${phone.maintenanceReason})` : ''} — clear the hold before renting it out.`,
    };
  }
  if (phone.status && phone.status !== 'available') {
    return { action: 'blocked', phoneId: phone.id, message: `${label} is marked ${phone.status}, not available to rent.` };
  }
  return { action: 'checkout', phoneId: phone.id, message: `${label} is free — starting a new rental.` };
}
