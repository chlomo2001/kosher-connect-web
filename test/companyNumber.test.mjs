// If you name the company, you name its number.
//
// A UK limited company must disclose its registered name, its registered number
// and its place of registration on its website and on its business letters and
// order forms. "Hatsluche Ltd" was named on /terms, /privacy, /refund,
// /welcome, /repair and in the LocalBusiness schema, and the number appeared in
// none of them — nor on a single receipt, and a receipt asking somebody for
// money is a business letter.
//
// Found by reading an invoice the owner was sent on 21 Aug: it carries the
// registration number in an "Other Information" block beside the bank details.
// Ours carried neither.
//
// The rule is deliberately shaped as "wherever the legal name appears" rather
// than a fixed list of files, because the way this gap got made was a seventh
// page naming the company and nobody remembering the sixth.
import test from 'node:test'
import assert from 'node:assert'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { COMPANY, registeredLine, companyNumberLine } from '../lib/company.mjs'

const ROOT = path.join(import.meta.dirname, '..')

test('the number is a real Companies House shape', () => {
  // Eight characters: eight digits, or two letters and six digits (SC…, NI…).
  assert.match(COMPANY.number, /^(\d{8}|[A-Z]{2}\d{6})$/,
    `"${COMPANY.number}" is not a company number`)
  assert.ok(COMPANY.legalName.length > 3)
  assert.ok(COMPANY.registeredIn.length > 3)
})

test('both lines name the number and where it is registered', () => {
  for (const line of [registeredLine(), companyNumberLine()]) {
    assert.ok(line.includes(COMPANY.number), `"${line}" omits the number`)
    assert.ok(line.includes(COMPANY.registeredIn), `"${line}" omits the place of registration`)
  }
  assert.ok(registeredLine().includes(COMPANY.legalName))
})

// ── the disclosure rule ────────────────────────────────────────────────────

// Files that identify the business to a customer. A page that merely mentions
// the name in passing is not a disclosure, so the rule looks for the pages that
// state what Kosher Connect legally IS.
const IDENTIFIES = /trading name of|Kosher Connect \(|legalName/

function pagesNamingTheCompany() {
  const out = []
  const walk = (dir) => {
    for (const e of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = path.join(dir, e.name)
      if (e.isDirectory()) { if (e.name !== 'api') walk(rel); continue }
      if (!e.name.endsWith('.js')) continue
      const src = readFileSync(path.join(ROOT, rel), 'utf8')
      if (src.includes(COMPANY.legalName) && IDENTIFIES.test(src)) out.push({ rel, src })
    }
  }
  walk('pages')
  return out
}

test('every page that identifies the business carries the number', () => {
  const pages = pagesNamingTheCompany()
  assert.ok(pages.length >= 3, `only ${pages.length} identifying pages found — the finder is wrong`)
  const bare = pages
    .filter((p) => !p.src.includes('company.mjs') && !p.src.includes(COMPANY.number))
    .map((p) => p.rel)
  assert.deepEqual(bare, [], 'these name Hatsluche Ltd without its registered number:\n  ' +
    bare.join('\n  ') + '\nImport { companyNumberLine } from lib/company.mjs and print it.')
})

test('every customer email carries it too — a receipt is a business letter', async () => {
  const { brandShell } = await import('../lib/email.js')
  const html = brandShell({ title: 'Receipt', bodyRows: '<tr><td>x</td></tr>' })
  assert.ok(html.includes(COMPANY.number), 'the email footer omits the company number')
  assert.ok(html.includes(COMPANY.registeredIn), 'the email footer omits the place of registration')
})

test('the number is written once, not copied around', () => {
  // The whole point of lib/company.mjs. A second literal is the beginning of
  // the two of them disagreeing.
  const hits = []
  const walk = (dir) => {
    for (const e of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue
      const rel = path.join(dir, e.name)
      if (e.isDirectory()) { walk(rel); continue }
      if (!/\.(js|mjs|json|md)$/.test(e.name)) continue
      if (rel === path.join('lib', 'company.mjs')) continue
      if (readFileSync(path.join(ROOT, rel), 'utf8').includes(COMPANY.number)) hits.push(rel)
    }
  }
  for (const d of ['lib', 'pages', 'components', 'public']) walk(d)
  assert.deepEqual(hits, [], 'the company number is hard-coded outside lib/company.mjs:\n  ' + hits.join('\n  '))
})
