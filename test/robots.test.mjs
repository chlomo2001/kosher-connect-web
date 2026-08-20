// The indexing contract, held both ways (port item A1, 18 Aug 2026).
//
// The trap this guards against shipped here for months: robots.txt said
// "Disallow: /" while almost no page carried a noindex tag. Disallow forbids
// FETCHING, not LISTING — a private URL learnt from any link could be listed
// as a bare URL, and the tag that would remove it sat on a page the crawler
// was forbidden to read. The contract is the inverse: crawling open, and
// EVERY page classified — public by name, or carrying its own noindex.
//
// The classification is a ratchet: a page added to pages/ tomorrow fails this
// test until someone says which it is. That is the point — the old allow-list
// rotted silently (it blocked /repair, a public page, because nobody knew the
// list was there to update).
import test from 'node:test'
import assert from 'node:assert'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.join(import.meta.dirname, '..')
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8')

// Public by decision (the owner's shop-front). Everything else must noindex.
const PUBLIC = new Set([
  'pages/welcome.js', 'pages/phone-guide.js', 'pages/repair.js',
  'pages/terms.js', 'pages/privacy.js', 'pages/refund.js', 'pages/login.js',
  // The per-service how-to pages a receipt links to (#18). Public because the
  // reader is a customer in an airport who is not going to sign in, and the
  // content is instructions rather than anything of theirs.
  'pages/help/[service].js',
])

// Pages whose markup comes from a shared shell — the tag lives there once.
const VIA_APP_SHELL = 'components/AppShell.js'

function pageFiles(dir = 'pages') {
  const out = []
  for (const name of readdirSync(path.join(ROOT, dir))) {
    if (name === 'api' || name.startsWith('_')) continue
    const rel = `${dir}/${name}`
    if (statSync(path.join(ROOT, rel)).isDirectory()) out.push(...pageFiles(rel))
    else if (name.endsWith('.js')) out.push(rel)
  }
  return out
}

const NOINDEX = /name="robots"\s+content="noindex/

test('robots.txt is default-open, with Disallow only where fetching is the harm', () => {
  const robots = read('public/robots.txt')
  assert.match(robots, /^Allow: \/$/m, 'crawling must be allowed so noindex tags can be read')
  assert.match(robots, /^Disallow: \/api\/$/m, 'the API is the one fetch-is-the-harm surface')
  const disallows = robots.match(/^Disallow: .*$/gm) || []
  assert.deepEqual(disallows, ['Disallow: /api/'],
    'a new Disallow needs its justification here and in the file — the bare "Disallow: /" trap must not return')
})

test('every page is classified: public by name, or carrying noindex', () => {
  const unclassified = []
  for (const rel of pageFiles()) {
    if (PUBLIC.has(rel)) continue
    const src = read(rel)
    const shelled = src.includes('AppShell')
    if (!NOINDEX.test(src) && !shelled) unclassified.push(rel)
  }
  assert.deepEqual(unclassified, [],
    'these pages are neither in the PUBLIC set nor noindexed — decide which they are')
})

test('the shared shell carries the tag for the pages that lean on it', () => {
  assert.match(read(VIA_APP_SHELL), NOINDEX)
})

test('public pages do NOT noindex themselves', () => {
  for (const rel of PUBLIC) {
    assert.ok(!NOINDEX.test(read(rel)), `${rel} is public but carries noindex`)
  }
})
