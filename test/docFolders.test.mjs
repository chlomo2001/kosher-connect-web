// Grouping a customer's documents (owner item 4, 19 Aug 2026).
//
// Staff side only. The owner explicitly did NOT take the second half of the
// item — whether a customer sees their own documents in the portal — so nothing
// here is reachable from the portal, and these tests are about one thing:
// finding a document on a card without reading every filename.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { documentFolder, groupDocuments, folderLabel, FOLDERS } from '../lib/docFolders.mjs'

const doc = (filename, extra = {}) => ({ id: filename, filename, status: 'published', ...extra })

test('a document goes where a person would look for it', () => {
  assert.equal(documentFolder(doc('passport-moshe.pdf')), 'passport')
  assert.equal(documentFolder(doc('Driving Licence.pdf')), 'passport')
  assert.equal(documentFolder(doc('boarding pass LS1234.pdf')), 'travel')
  assert.equal(documentFolder(doc('itinerary-larnaca.pdf')), 'travel')
  assert.equal(documentFolder(doc('receipt 12 Aug.pdf')), 'money')
  assert.equal(documentFolder(doc('direct debit mandate.pdf')), 'forms')
  assert.equal(documentFolder(doc('IMG_4821.jpeg')), 'photos')
  assert.equal(documentFolder(doc('notes.txt')), 'other')
})

test('a passport photographed on a phone is a PASSPORT, not a photo', () => {
  // The ordering rule, and the reason FOLDERS is an ordered list rather than a
  // map: nearly every passport in this shop arrives as a JPEG off a phone, so
  // matching on extension first would file all of them under Photos and make
  // the passport folder permanently empty.
  assert.equal(documentFolder(doc('passport.jpg')), 'passport')
  assert.equal(documentFolder(doc('WhatsApp Image - passport scan.jpeg')), 'passport')
  assert.equal(documentFolder(doc('receipt.png')), 'money')
  assert.equal(documentFolder(doc('boarding-pass.jpg')), 'travel')
})

test('everything lands somewhere — nothing is dropped from the view', () => {
  const docs = ['passport.pdf', 'ticket.pdf', 'receipt.pdf', 'form.pdf', 'a.jpg', 'z.zip', ''].map(f => doc(f))
  const groups = groupDocuments(docs)
  assert.equal(groups.reduce((n, g) => n + g.count, 0), docs.length,
    'a document went missing between the list and the folders')
  for (const d of docs) assert.ok(FOLDERS.some(([k]) => k === documentFolder(d)))
})

test('empty folders are not shown — six headings for two files reads as a fault', () => {
  const groups = groupDocuments([doc('passport.pdf'), doc('passport2.pdf')])
  assert.equal(groups.length, 1)
  assert.equal(groups[0].key, 'passport')
  assert.equal(groups[0].count, 2)
  assert.deepEqual(groupDocuments([]), [])
})

test('folders come back in a fixed order, whatever order the documents arrived', () => {
  const a = groupDocuments([doc('z.zip'), doc('passport.pdf'), doc('receipt.pdf')]).map(g => g.key)
  const b = groupDocuments([doc('receipt.pdf'), doc('z.zip'), doc('passport.pdf')]).map(g => g.key)
  assert.deepEqual(a, b)
  assert.deepEqual(a, ['passport', 'money', 'other'])
})

test('rubbish in a list does not take a customer card down', () => {
  assert.equal(documentFolder(null), 'other')
  assert.equal(documentFolder({}), 'other')
  assert.equal(documentFolder({ filename: null }), 'other')
  const groups = groupDocuments([null, undefined, doc('passport.pdf')])
  assert.equal(groups.length, 1)
  assert.equal(groups[0].count, 1)
})

test('every folder has a label, and an unknown key still reads as something', () => {
  for (const [key] of FOLDERS) assert.ok(folderLabel(key).length > 3, `${key} has no label`)
  assert.equal(folderLabel('nonsense'), folderLabel('other'))
})
