// What is on the disk at build time is not what is on the disk at request time.
//
// This has now bitten KosherConnect three times, in three different disguises:
//
//   1. public/app.css is generated, and the generator ran from an npm
//      `prebuild` hook. Vercel does not run `npm run build` — it detects Next
//      and runs `next build` — so the hook never fired, the file was missing,
//      /app.css fell through to the [tab] route, and the staff app served its
//      own sign-in page as a stylesheet. next.config.js requires the generator
//      directly now, and says why.
//   2. Same for public/guides.js, and the counter's help button would have been
//      empty on production only.
//   3. /manual built its picture list with fs.readdirSync(process.cwd() +
//      '/public/manual') inside getServerSideProps. `public/` is served by the
//      CDN and is NOT in a serverless function's bundle, so that threw ENOENT
//      on every request, the catch turned it into {}, and sixty screenshots
//      that were sitting on the CDN were never once shown to a reader.
//
// Every one of them worked locally, worked in the offline harness, and was
// invisible in production. Local success is not evidence. So: nothing a page
// can reach may touch the filesystem at request time.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.join(import.meta.dirname, '..')

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) { walk(full, out); continue }
    if (/\.(js|mjs|jsx)$/.test(name)) out.push(full)
  }
  return out
}

/** Resolve a relative import to a file on disk, or null. */
function resolve(from, spec) {
  if (!spec.startsWith('.')) return null
  const base = path.resolve(path.dirname(from), spec)
  for (const c of [base, `${base}.js`, `${base}.mjs`, `${base}.jsx`,
                   path.join(base, 'index.js'), path.join(base, 'index.mjs')]) {
    if (existsSync(c) && statSync(c).isFile()) return c
  }
  return null
}

/**
 * Every module a page can reach, following relative imports — static and
 * dynamic. lib/pngSize.mjs reads files and that is fine, because only the
 * build script and the tests import it; the rule is about REACHABILITY from a
 * page, not about which folder a file happens to sit in.
 */
function reachableFromPages() {
  const seen = new Set()
  const queue = walk(path.join(ROOT, 'pages'))
  while (queue.length) {
    const file = queue.pop()
    if (seen.has(file)) continue
    seen.add(file)
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(/(?:from|import|require)\s*\(?\s*['"]([^'"]+)['"]/g)) {
      const hit = resolve(file, m[1])
      if (hit && !seen.has(hit)) queue.push(hit)
    }
  }
  return [...seen]
}

const REACHABLE = reachableFromPages()

test('the import graph is actually being walked', () => {
  // A resolver that quietly resolves nothing would make every rule below pass.
  assert.ok(REACHABLE.length > 20, `only ${REACHABLE.length} modules reachable — the resolver has drifted`)
  assert.ok(REACHABLE.some((f) => f.includes(`lib${path.sep}manual`)), 'lib/ is not being reached from pages/')
})

test('nothing a page can reach touches the filesystem', () => {
  const bad = []
  for (const file of REACHABLE) {
    const src = readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
    const where = path.relative(ROOT, file)
    if (/from\s+['"]node:fs['"]|require\(['"]fs['"]\)|from\s+['"]fs['"]/.test(src)) bad.push(`${where}: imports fs`)
    if (/process\.cwd\(\)/.test(src)) bad.push(`${where}: builds a path from process.cwd()`)
  }
  assert.deepEqual(bad, [],
    'a page can reach code that reads the disk at request time — public/ and the repo are NOT on a serverless function\'s filesystem. Generate it at build time instead, the way lib/manualShots.mjs is.')
})

test('what production needs generated is generated where Vercel will run it', () => {
  // npm lifecycle hooks do not fire on Vercel: it runs `next build` directly.
  // Config load is the one hook that fires however the build is started.
  const cfg = readFileSync(path.join(ROOT, 'next.config.js'), 'utf8')
  for (const gen of ['build-app-css', 'build-guides']) {
    assert.match(cfg, new RegExp(`require\\('\\./scripts/${gen}`),
      `${gen} is not run from next.config.js — on Vercel it will not run at all`)
  }
})

test('the manual\'s picture list is committed, not generated at request time', () => {
  // The manifest is the fix for #3 above, so it has to actually be in the repo:
  // generated-but-gitignored would put us straight back where we were.
  const manifest = path.join(ROOT, 'lib/manualShots.mjs')
  assert.ok(existsSync(manifest), 'lib/manualShots.mjs is missing — run scripts/build-manual-shots.mjs')
  const ignore = readFileSync(path.join(ROOT, '.gitignore'), 'utf8')
  assert.ok(!/manualShots/.test(ignore), 'the manifest is gitignored — production would ship without it')
})
