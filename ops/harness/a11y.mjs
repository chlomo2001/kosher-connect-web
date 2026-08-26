// The structure a screen reader navigates by.
//
//   node ops/harness/a11y.mjs                    # staff app + public pages, en
//   node ops/harness/a11y.mjs --lang he
//   node ops/harness/a11y.mjs --only welcome
//
// The other sweeps here measure what a sighted mouse user meets: colour,
// geometry, overflow, focus rings. This one measures what is left when the
// screen is not being looked at — landmarks, headings, accessible names, alt
// text, and the skip link that lets somebody past the navigation.
//
// Written 26 Aug 2026 after doing the whole thing by hand once. That pass found
// the app's only Level A failure (WCAG 2.4.1: no skip link anywhere, and nine
// of thirteen public pages with no <main>), two heading-level skips hiding two
// CSS rules that had never matched, and a login page with no heading at all.
// None of that is visible to any check that was already running, and a
// structure nobody measures is a structure that rots — so it runs nightly now.
//
// FOUR RULES, and each one is here because the hand pass caught it:
//
//   1. Every surface has exactly one <h1> and no skipped heading levels.
//   2. Every image has an alt attribute — empty is fine and means decorative,
//      absent is not.
//   3. Every visible interactive control has an accessible name, computed the
//      way a browser computes it: aria-label, aria-labelledby, a <label for>,
//      a wrapping <label>, its own text, then title.
//   4. Every page has a content landmark, and wherever navigation repeats
//      there is a skip link that is FIRST in the tab order and lands on it.
//
// Rule 4 is driven, not read: the check presses Tab and then Enter, because
// the first version of this passed on source order while three pages were
// putting a position:fixed theme toggle ahead of the link.
//
// A page that autofocuses a field is exempt from the tab-order half of rule 4
// — focus starts in the field, so the first Tab necessarily moves away from the
// link. Sign-in pages do that deliberately and have no navigation to bypass.
//
// Exits non-zero on a finding.
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { buildAppHtml, BROWSER_ENV, TABS } from './render.mjs'
import { buildPublicHtml, PAGES } from './public.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(import.meta.url)
const { chromium } = require(path.join(ROOT, 'node_modules/playwright-core'))

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const lang = arg('--lang', 'en')
const only = arg('--only', null)

// Runs in the page. Kept as one function so the staff app and the public pages
// are held to the same rules rather than two drifting copies.
const INSPECT = () => {
  const root = document.getElementById('mainContent') || document.getElementById('__next') || document.body
  const out = { noAlt: [], unnamed: [], headings: [], h1: 0, main: false, skip: false, nav: false, autofocus: false }

  root.querySelectorAll('img').forEach((el) => {
    if (el.getAttribute('alt') === null && el.getAttribute('role') !== 'presentation'
        && el.getAttribute('aria-hidden') !== 'true') {
      out.noAlt.push((el.getAttribute('src') || '(no src)').slice(-44))
    }
  })

  // The accessible name, near enough: the orders a browser actually tries.
  const nameOf = (el) => {
    const aria = el.getAttribute('aria-label')
    if (aria && aria.trim()) return aria.trim()
    const by = el.getAttribute('aria-labelledby')
    if (by) { const t = document.getElementById(by); if (t && t.textContent.trim()) return t.textContent.trim() }
    if (el.id) {
      const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`)
      if (l && l.textContent.trim()) return l.textContent.trim()
    }
    const wrap = el.closest('label')
    if (wrap && wrap.textContent.trim()) return wrap.textContent.trim()
    if ((el.textContent || '').trim()) return el.textContent.trim()
    const t = el.getAttribute('title'); if (t && t.trim()) return t.trim()
    const ph = el.getAttribute('placeholder'); if (ph && ph.trim()) return ph.trim()
    // A named child counts: a link wrapping <span role="img" aria-label="…">
    // is announced by that label, and the first draft of this reported every
    // one of those as nameless.
    const kid = el.querySelector('[aria-label],[alt],[title]')
    if (kid) return (kid.getAttribute('aria-label') || kid.getAttribute('alt') || kid.getAttribute('title') || '').trim()
    return ''
  }
  root.querySelectorAll('button,a[href],input,select,textarea,[role="button"]').forEach((el) => {
    if (el.type === 'hidden' || el.getAttribute('aria-hidden') === 'true' || el.tabIndex < 0) return
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) return
    if (!nameOf(el)) {
      const cls = String(el.className || '').split(' ').filter(Boolean)[0] || ''
      out.unnamed.push(el.tagName.toLowerCase() + (cls ? '.' + cls : ''))
    }
  })

  let prev = 0
  document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((h) => {
    const lvl = Number(h.tagName[1])
    if (lvl === 1) out.h1++
    if (prev && lvl > prev + 1) out.headings.push(`h${prev}→h${lvl} at "${h.textContent.trim().slice(0, 30)}"`)
    prev = lvl
  })

  out.main = !!document.querySelector('main, [role="main"]')
  out.skip = !!document.querySelector('.kc-skip')
  out.nav = [...document.querySelectorAll('nav, [role="navigation"]')]
    .some((n) => n.querySelectorAll('a[href],button').length > 1)
  out.autofocus = !!document.querySelector('[autofocus]')
  return out
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: BROWSER_ENV })
const findings = []
const note = (where, what) => findings.push(`${where}: ${what}`)

async function judge(p, where, { isPage }) {
  const r = await p.evaluate(INSPECT)
  r.noAlt.forEach((s) => note(where, `image with no alt — ${s}`))
  ;[...new Set(r.unnamed)].forEach((s) => note(where, `control with no accessible name — ${s}`))
  r.headings.forEach((s) => note(where, `heading level skipped — ${s}`))
  if (isPage) {
    if (r.h1 !== 1) note(where, `${r.h1} <h1> elements, expected exactly 1`)
    if (!r.main) note(where, 'no <main> landmark')
    if (r.nav && !r.skip) note(where, 'repeated navigation with no skip link')
    if (r.skip && !r.autofocus) {
      await p.keyboard.press('Tab')
      const cls = await p.evaluate(() => String(document.activeElement?.className || ''))
      if (!cls.includes('kc-skip')) note(where, `the skip link is not first — Tab lands on "${cls || '(unnamed)'}"`)
      else {
        await p.keyboard.press('Enter')
        await p.waitForTimeout(120)
        const ok = await p.evaluate(() => location.hash === '#main' && !!document.getElementById('main'))
        if (!ok) note(where, 'the skip link does not land on #main')
      }
    }
  }
}

// ── the staff app, every tab ──
if (!only || only === 'app') {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-GB' })
  const p = await ctx.newPage()
  await p.goto('file://' + buildAppHtml(), { waitUntil: 'load' })
  await p.waitForTimeout(900)
  for (const tab of TABS) {
    await p.evaluate((t) => window.renderTab(t), tab).catch(() => {})
    await p.waitForTimeout(280)
    await judge(p, `app/${tab}`, { isPage: false })
  }
  await ctx.close()
}

// ── the public pages ──
for (const page of Object.keys(PAGES)) {
  if (only && only !== page) continue
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-GB' })
  const p = await ctx.newPage()
  await p.goto('file://' + buildPublicHtml(page, lang, null, 'light'), { waitUntil: 'load' })
  await p.waitForTimeout(600)
  await judge(p, `${page}/${lang}`, { isPage: true })
  await ctx.close()
}

await browser.close()
for (const f of findings) console.log('✗ ' + f)
console.log(findings.length
  ? `\n${findings.length} accessibility finding(s) — structure, names and landmarks (${lang})`
  : `every surface has its landmarks, headings, names and alt text (${lang})`)
process.exit(findings.length ? 1 : 0)
