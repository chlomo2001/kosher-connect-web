// The browser copy of the document folders, held to lib/docFolders.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { documentFolder, groupDocuments, folderLabel, FOLDERS } from '../lib/docFolders.mjs'

const SRC = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')
function liftMirror() {
  const m = SRC.match(/\/\/ ── KC_DOCFOLDERS mirror start ──\n([\s\S]*?)\n\/\/ ── KC_DOCFOLDERS mirror end ──/)
  assert.ok(m, 'KC_DOCFOLDERS mirror region not found in public/main.js')
  return new Function(`${m[1]}; return KC_DOCFOLDERS;`)()
}

const NAMES = [
  'passport-moshe.pdf', 'passport.jpg', 'Driving Licence.pdf', 'boarding pass LS1234.pdf',
  'itinerary-larnaca.pdf', 'receipt 12 Aug.pdf', 'receipt.png', 'direct debit mandate.pdf',
  'IMG_4821.jpeg', 'notes.txt', 'z.zip', '', 'WhatsApp Image - passport scan.jpeg',
]

test('the browser mirror files every document exactly where the lib does', () => {
  const B = liftMirror()
  assert.deepEqual(B.FOLDERS.map(f => f[0]), FOLDERS.map(f => f[0]),
    'the two disagree about which folders exist, or in what ORDER — and the order is the rule')
  for (const filename of NAMES) {
    const doc = { id: filename, filename }
    assert.equal(B.documentFolder(doc), documentFolder(doc), `differs for "${filename}"`)
  }
  for (const key of [...FOLDERS.map(f => f[0]), 'nonsense']) {
    assert.equal(B.folderLabel(key), folderLabel(key))
  }
  const docs = NAMES.map(f => ({ id: f, filename: f }))
  assert.deepEqual(B.groupDocuments(docs), groupDocuments(docs))
  assert.deepEqual(B.groupDocuments([]), groupDocuments([]))
  assert.deepEqual(B.groupDocuments([null, undefined]), groupDocuments([null, undefined]))
})

test('the folders are staff-side only — the portal has no document grouping', () => {
  // The owner took the staff half of item 4 and explicitly left the portal half
  // as a privacy decision. This holds that line.
  const portal = readFileSync(new URL('../pages/portal.js', import.meta.url), 'utf8')
  assert.ok(!/KC_DOCFOLDERS|docFolders|groupDocuments/.test(portal),
    'document folders reached the portal, which was not the decision taken')
})

test('a short list stays flat — folders would be furniture', () => {
  assert.match(SRC, /const FOLDER_FROM = 4;/, 'the threshold is gone')
  assert.match(SRC, /others\.length < FOLDER_FROM\s*\n?\s*\? others\.map\(row\)/,
    'a short list must render as it always did')
})
