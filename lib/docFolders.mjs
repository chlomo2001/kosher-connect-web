// A folder per kind of document, for the staff side of a customer card.
//
// Owner's item 4, decided 19 August 2026: "folder view, staff only". The second
// half of that item — whether a customer sees their own documents in the portal
// — was deliberately NOT taken, and nothing here reaches the portal.
//
// Documents already attach per customer; what was missing was any grouping, so
// a customer with fourteen files was a flat list of filenames and finding their
// passport meant reading all fourteen. Folders are inferred rather than typed
// in, because a field somebody has to fill in is a field that ends up empty.
//
// PII note: this classifies on the FILENAME only. It never opens a document and
// never reads a passport number — passport data is booleans and counts
// everywhere outside the record itself.

/**
 * Ordered, and the order is the rule.
 *
 * A file called `passport.jpg` belongs in Passports, not in Photos, so the
 * name-based folders are all tried before the extension-based one. `other` has
 * no pattern and catches whatever is left, which means every document lands
 * somewhere and none is silently dropped from the view.
 */
// A folder's label is WORDS and its icon is a NAME, in separate columns. The
// label reaches the screen through escHtml — it is a heading, and a filename
// could put anything in it — so markup here would render as literal text, which
// is exactly what happened to the stock categories when they were converted.
export const FOLDERS = [
  ['passport', 'Passports & ID', /passport|\bid\b|identity|driving|licen[cs]e|birth ?cert/i, 'passport'],
  ['travel', 'Tickets & itineraries', /ticket|boarding|itiner|e-?ticket|flight|booking ?ref|pnr/i, 'plane'],
  ['money', 'Receipts & invoices', /receipt|invoice|\bbill\b|statement|payment|refund/i, 'receipt'],
  ['forms', 'Forms & agreements', /contract|agreement|\bform\b|terms|mandate|direct ?debit|\bdd\b|authoris/i, 'file'],
  ['photos', 'Photos & scans', /\.(jpe?g|png|heic|heif|webp|tiff?)$/i, 'camera'],
  ['other', 'Everything else', null, 'folder'],
]

const LABELS = Object.fromEntries(FOLDERS.map(([key, label]) => [key, label]))
const ICONS = Object.fromEntries(FOLDERS.map(([key, , , icon]) => [key, icon]))

/** Which folder one document belongs in. Always returns a key — never null. */
export function documentFolder(doc) {
  const name = String((doc && doc.filename) || '')
  for (const [key, , pattern] of FOLDERS) {
    if (pattern && pattern.test(name)) return key
  }
  return 'other'
}

/** The human name of a folder key. */
export function folderLabel(key) {
  return LABELS[key] || LABELS.other
}

/** The icon NAME for a folder key — the render site builds the element. */
export function folderIcon(key) {
  return ICONS[key] || ICONS.other
}

/**
 * Group documents into folders, in FOLDERS order, dropping the empty ones.
 *
 * Empty folders are omitted rather than shown as "0 items": a card listing six
 * headings for two documents reads as a filing cabinet somebody has not filled
 * in, when in fact there are only two documents.
 */
export function groupDocuments(docs = []) {
  const bucket = new Map()
  for (const doc of docs) {
    if (!doc) continue
    const key = documentFolder(doc)
    if (!bucket.has(key)) bucket.set(key, [])
    bucket.get(key).push(doc)
  }
  return FOLDERS
    .filter(([key]) => bucket.has(key))
    .map(([key, label]) => ({ key, label, docs: bucket.get(key), count: bucket.get(key).length }))
}
