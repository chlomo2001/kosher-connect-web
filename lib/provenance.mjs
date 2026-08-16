// Where a record came from, and whether a human has vouched for it. Pure.
//
// The shop's data was loaded from spreadsheets — 1,865 records against 12 that
// a person typed — and nothing recorded which was which. `data_source` and
// `verified_at` now do, as COLUMNS. This module is the seam between those
// columns and the app-shaped objects the front end reads, and it exists mainly
// to enforce one rule:
//
//   PROVENANCE NEVER GOES INTO legacy_extras.
//
// Customers and SIMs round-trip through a JSON blob that stores the complete
// app object. Read `verifiedAt` onto the object, let it ride back through a
// save, and the blob acquires a stale copy of a column that the queue is
// actively changing — two answers to "has this been checked", diverging from
// the moment they are written. So the fields are added on the way OUT and
// stripped on the way IN, and the column stays the only answer.
const FIELDS = ['dataSource', 'verifiedAt', 'verifiedBy']

/** App object + the provenance columns from its row. Read side. */
export function withProvenance(appObj, row) {
  if (!appObj || typeof appObj !== 'object') return appObj
  return {
    ...appObj,
    dataSource: row?.data_source || 'app',
    verifiedAt: row?.verified_at || null,
  }
}

/** The same object with provenance removed, ready to store. Write side. */
export function stripProvenance(appObj) {
  if (!appObj || typeof appObj !== 'object') return appObj
  if (!FIELDS.some((f) => f in appObj)) return appObj   // nothing to do, keep identity
  const out = { ...appObj }
  for (const f of FIELDS) delete out[f]
  return out
}

/**
 * Does this record still need a human to confirm it?
 * Imported and unconfirmed — a spreadsheet's word for it, and nothing more.
 */
export const needsConfirming = (o) => o?.dataSource === 'import' && !o?.verifiedAt
