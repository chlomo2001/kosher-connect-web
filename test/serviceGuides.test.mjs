// The per-service how-to pages, and the receipt link to them (#18).
//
// Owner, 20 Aug: "eventually also attaching a manual (per service)."
//
// The customer walks out with a rented phone and the receipt is the one thing
// they still have at the airport. This is the page it points at. Not the staff
// manual (lib/manual.mjs, one entry per screen) and not the staff walkthroughs
// (lib/guides.mjs) — a different reader entirely.
import test from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  SERVICE_GUIDES, guideById, guideForService, guideIds, guideUrl,
} from '../lib/serviceGuides.mjs'

const ROOT = path.join(import.meta.dirname, '..')
const API = readFileSync(path.join(ROOT, 'pages/api/email.js'), 'utf8')
const PAGE = readFileSync(path.join(ROOT, 'pages/help/[service].js'), 'utf8')

test('every guide is complete enough to be worth opening', () => {
  assert.ok(SERVICE_GUIDES.length >= 5, 'the shop sells more than a couple of things')
  for (const g of SERVICE_GUIDES) {
    assert.match(g.id, /^[a-z][a-z0-9-]*$/, `${g.id} is not a usable URL slug`)
    assert.ok(g.service && g.title && g.intro && g.updated, `${g.id} is missing a field`)
    assert.ok(g.sections.length >= 2, `${g.id} has ${g.sections.length} section(s)`)
    for (const s of g.sections) {
      assert.ok(s.heading, `${g.id} has a section with no heading`)
      assert.ok(s.points.length >= 2, `${g.id} · ${s.heading} has ${s.points.length} point(s)`)
      for (const p of s.points) {
        assert.ok(p.length > 25 && /[.?]$/.test(p),
          `${g.id} · ${s.heading}: "${p}" is a fragment, not a sentence`)
      }
    }
  }
})

test('slugs and services are unique — one guide per thing sold', () => {
  assert.equal(new Set(guideIds()).size, SERVICE_GUIDES.length)
  assert.equal(new Set(SERVICE_GUIDES.map((g) => g.service)).size, SERVICE_GUIDES.length)
})

// The same rule the manual keeps, for the same reason: the business has one
// price list, in Settings and BUSINESS_RULES.md. A second copy in a document
// the customer keeps is a second copy that will go wrong — and this one is
// harder to correct, because it is already in somebody's inbox.
test('no prices, rates, free-day lists or periods', () => {
  const BANNED = [
    [/£\s?\d/, 'a price'],
    [/\b\d+\s*%/, 'a rate'],
    [/\b\d+\s*(?:hours?|days?|weeks?|months?|years?)\b/i, 'a period'],
    [/\bper day\b|\bper week\b|\bper month\b/i, 'a rate'],
  ]
  for (const g of SERVICE_GUIDES) {
    const text = [g.title, g.intro, ...g.sections.flatMap((s) => [s.heading, ...s.points])].join(' ')
    for (const [re, what] of BANNED) {
      const hit = text.match(re)
      assert.ok(!hit, `${g.id} carries ${what}: "${hit && hit[0]}" — that belongs in Settings`)
    }
  }
})

test('lookups answer, and refuse politely when there is nothing', () => {
  assert.equal(guideById('phone-rental').service, 'rental')
  assert.equal(guideForService('rental').id, 'phone-rental')
  for (const missing of ['', null, undefined, 'nope', '../secrets']) {
    assert.equal(guideById(missing), null)
    assert.equal(guideForService(missing), null)
    assert.equal(guideUrl(missing), '')
  }
})

test('the receipt link is absolute — a mail client has no base URL', () => {
  assert.equal(guideUrl('rental', 'https://app.kosher-connect.com'),
    'https://app.kosher-connect.com/help/phone-rental')
  // A trailing slash on the base must not double up.
  assert.equal(guideUrl('rental', 'https://app.kosher-connect.com/'),
    'https://app.kosher-connect.com/help/phone-rental')
})

test('the rental receipt carries the link, whatever else failed', () => {
  const extras = API.slice(API.indexOf('async function rentalExtras(req, who, b)'))
  const body = extras.slice(0, extras.indexOf('\n}\n'))
  assert.match(body, /const guide = guideUrl\('rental', `https:\/\/\$\{req\.headers\.host\}`\)/)
  // Every exit from rentalExtras must carry it — the guide has nothing to do
  // with Stripe, so a missing webhook or a mint that threw must not cost it.
  const returns = body.match(/return \{[^}]*\}/g) || []
  assert.ok(returns.length >= 4, `only ${returns.length} return sites found — has the shape changed?`)
  for (const r of returns) {
    assert.match(r, /guideUrl: guide/, `this exit drops the guide link: ${r}`)
  }
})

test('a link, not an attachment', () => {
  const builder = API.slice(API.indexOf('function buildRental(copy, who, b, extras'))
  const body = builder.slice(0, builder.indexOf('\n}\n'))
  assert.match(body, /extras\.guideUrl \?/, 'no link, no sentence offering one')
  assert.match(body, /How to use your rented phone/)
  // Checked against the send itself, not against the word: an earlier version
  // of this assertion matched the comment explaining why there is no
  // attachment, which is a test that fails on its own documentation.
  assert.doesNotMatch(API, /attachments\s*:/,
    'a PDF gets stripped by filters and cannot be corrected after it has gone')
  const mailer = readFileSync(path.join(ROOT, 'lib/email.js'), 'utf8')
  assert.doesNotMatch(mailer, /attachments\s*:/, 'the mailer grows no attachment path for this')
})

test('the page is generated from the module, not written out again', () => {
  assert.match(PAGE, /from '\.\.\/\.\.\/lib\/serviceGuides\.mjs'/)
  assert.match(PAGE, /guideIds\(\)\.map/, 'the router builds from the same list')
  assert.match(PAGE, /guide\.sections\.map/)
  assert.match(PAGE, /content="index"/, 'a customer in an airport will not sign in')
  assert.match(PAGE, /fallback: false/, 'an unknown slug is a 404, not a blank page')
  // The shop's own contact details are on it — that is the point of a page
  // somebody reaches when everything else has failed.
  assert.match(PAGE, /0161 531 1386/)
})
