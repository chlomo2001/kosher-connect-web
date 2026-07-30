// Import the rental-pool sheet into `lines`, leniently. See
// docs/RENTAL-POOL-MIGRATION.md for why this never rejects a row.
//
//   node scripts/import-rental-pool.mjs <file.xlsx>            # dry run (default)
//   node scripts/import-rental-pool.mjs <file.xlsx> --apply    # write to the DB
//   node scripts/import-rental-pool.mjs <file.xlsx> --json out.json
//
// Dry run is the default on purpose: the summary it prints is the thing worth
// showing the owner before anything is written, and re-reading a spreadsheet
// costs nothing while an unwanted 114-row upsert costs a cleanup.
//
// Writes go through the same /api/phones sync path the app uses, so there is
// no second way into the table with its own rules. Re-running is safe: ids are
// derived from the phone number, so rows update in place.
import { readFileSync } from 'node:fs'
import { buildPool, REVIEW_LABEL } from '../lib/rentalPoolImport.mjs'

const args = process.argv.slice(2)
const apply = args.includes('--apply')
// indexOf returns -1 when the flag is absent, and args[-1 + 1] is args[0] —
// the INPUT FILE. An earlier version of this line wrote the JSON dump over the
// spreadsheet it had just read. Read the flag explicitly, and never treat the
// value that follows --json as the input.
const jsonIdx = args.indexOf('--json')
const jsonOut = jsonIdx >= 0 ? args[jsonIdx + 1] : null
// The `jsonIdx < 0` guard matters for the same reason: without it, -1 + 1 = 0
// excludes argument zero, which is the input file.
const file = args.find((a, i) => !a.startsWith('--') && (jsonIdx < 0 || i !== jsonIdx + 1))

if (!file) {
  console.error('usage: node scripts/import-rental-pool.mjs <file.xlsx> [--apply] [--json out.json]')
  process.exit(1)
}
if (jsonIdx >= 0 && !jsonOut) {
  console.error('--json needs a destination path')
  process.exit(1)
}
// Belt and braces: whatever the arguments say, this script only ever reads the
// spreadsheet. Refuse to write anywhere that could be a source file.
if (jsonOut && (jsonOut === file || /\.(xlsx|xlsm|xls|csv)$/i.test(jsonOut))) {
  console.error(`Refusing to write JSON over a spreadsheet: ${jsonOut}`)
  process.exit(1)
}

// The sheet is read with the same library the Contacts Converter uses. Kept as
// a dynamic import so this script is the only thing that needs it.
const XLSX = await import('xlsx').catch(() => null)
if (!XLSX) {
  console.error('This script needs the `xlsx` package: npm i -D xlsx')
  process.exit(1)
}

const wb = XLSX.read(readFileSync(file), { cellDates: true })
const sheet = wb.Sheets.Rental
if (!sheet) {
  console.error(`No "Rental" sheet in ${file}. Sheets present: ${wb.SheetNames.join(', ')}`)
  process.exit(1)
}

// header:1 gives raw positional arrays — the header text in this sheet is
// unreliable (two columns have no name at all), so position is the contract.
//
// raw:true is load-bearing. With raw:false every cell comes back as its
// DISPLAY string, so the "till" dates arrive formatted (8/12/26) and get
// re-parsed as American month-first — which silently moved 26 rentals between
// "no return date" and "overdue". raw:true + cellDates:true hands us real Date
// objects and no reparsing happens at all.
const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, cellDates: true })
const rows = raw.slice(1).filter((r) => r.some((c) => c !== null && c !== undefined && String(c).trim() !== ''))

const today = new Date()
today.setHours(0, 0, 0, 0)
const { lines, summary } = buildPool(rows, { today })

const pct = (n) => `${Math.round((n / summary.total) * 100)}%`
console.log(`\n  ${summary.total} lines read from ${file}\n`)
console.log('  Status')
for (const [k, v] of Object.entries(summary.byStatus).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${String(v).padStart(4)}  ${k}`)
}
if (summary.duplicateNumbers) console.log(`\n  ⚠ ${summary.duplicateNumbers} duplicate phone numbers`)
console.log(`\n  Needs review: ${summary.needsReview} of ${summary.total} (${pct(summary.needsReview)})`)
for (const [code, n] of Object.entries(summary.reasons).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${String(n).padStart(4)}  ${REVIEW_LABEL[code] || code}`)
}
console.log(`\n  Clean and ready: ${summary.total - summary.needsReview}\n`)

if (jsonOut) {
  const { writeFileSync } = await import('node:fs')
  writeFileSync(jsonOut, JSON.stringify(lines, null, 2))
  console.log(`  Wrote ${jsonOut}\n`)
}

if (!apply) {
  console.log('  Dry run — nothing written. Re-run with --apply to import.\n')
  process.exit(0)
}

const base = process.env.KC_BASE_URL
const token = process.env.KC_IMPORT_TOKEN
if (!base || !token) {
  console.error('  --apply needs KC_BASE_URL and KC_IMPORT_TOKEN in the environment.\n')
  process.exit(1)
}

// The app owns whole-array sync for phones, so merge onto what is already
// there rather than replacing it: any line added in the app since the last
// import must survive this one.
const existing = await fetch(`${base}/api/phones`, { headers: { Cookie: token } }).then((r) => r.json())
const byId = new Map((Array.isArray(existing) ? existing : []).map((p) => [p.id, p]))
for (const l of lines) byId.set(l.id, { ...byId.get(l.id), ...l })
const merged = [...byId.values()]

const res = await fetch(`${base}/api/phones`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: token },
  body: JSON.stringify({ items: merged }),
}).then((r) => r.json())

if (res && res.success) console.log(`  Imported. ${res.synced} lines in the pool.\n`)
else { console.error('  Import failed:', res); process.exit(1) }
