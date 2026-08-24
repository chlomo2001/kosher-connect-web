// The icon set, checked the three ways it has actually broken.
//
// 96 CSS-mask icons replaced the emoji through 23-24 Aug, and the conversion
// went wrong three times in three different ways. Each one is a check here,
// and each one is written so it can only pass for the right reason.
//
//   node ops/harness/icons.mjs
//
// (a) THE MASK DOES NOT RESOLVE. `mask: var(--kc-ic)` — the shorthand — computes
//     to none even when --kc-ic is set on the element, and double quotes inside
//     url("…") terminate the data URI at the first cx="12". Both painted
//     nothing and both looked like a missing icon rather than a broken rule.
//     So: build one button per icon name and demand a url() mask with real
//     width and height.
//
// (b) THE MARKUP REACHED AN ESCAPED SINK. STOCK_CATEGORY_LABELS is data — it
//     feeds a <select> and several escHtml'd rows — so `<i class="kc-ic…">`
//     rendered as literal text on the Shop tab and in five dialogs. Visible
//     text containing "kc-ic" or "<i class" is that, every time.
//
// (c) THE MARKUP REACHED AN ATTRIBUTE AND BROKE IT. This is the one the owner
//     caught on screen, and the reason the first version of this scan was
//     worthless: EQ_LABELS was interpolated into aria-label="…", the first
//     quote of class=" closed the attribute, and the parser turned the rest
//     into junk ATTRIBUTES plus loose text spilled over the toggles. The
//     leaked text carries no "kc-ic" at all — it reads `— mark returned/lost">`
//     — so innerText could never find it. Read the attribute NAMES instead.
//
// Every tab and every dialog, because (b) and (c) are per-sink, not per-page.
//
// The walk runs in ONE theme, deliberately. (b) and (c) are parse failures —
// whether markup reached a text sink or blew an attribute apart is decided by
// the string, not by the palette — so walking 15 tabs and 40 dialogs twice
// costs 25 seconds to re-answer a question that cannot have a second answer.
// (a) IS theme-dependent (the ink follows the button, and the dark palette is a
// different set of tokens rather than a filter over the light one), so that
// half runs in both. Same coverage, half the time, which is what lets this run
// in the pre-ship smoke rather than only overnight.
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { buildAppHtml, BROWSER_ENV } from './render.mjs'
import { MODALS } from './modals.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..', '..')
const require = createRequire(import.meta.url)
const { chromium } = require(path.join(ROOT, 'node_modules/playwright-core'))

const TABS = ['dashboard', 'customers', 'rentals', 'sim', 'bookings', 'wallet', 'repairs',
  'services', 'shop', 'koltorah', 'tasks', 'mail', 'settings', 'virtual', 'review']

// The names come from the stylesheet rather than a list kept beside it: a list
// would go stale the first time somebody adds an icon and forgets this file.
const ICON_NAMES = [...new Set(
  [...readFileSync(path.join(ROOT, 'styles/app.css'), 'utf8')
    .matchAll(/\.kc-ic-([a-z0-9-]+)\s*(?:,|\{|::)/g)].map((m) => m[1]))]

export async function run({ width = 1280 } = {}) {
  const file = buildAppHtml()
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: BROWSER_ENV })
  const problems = []
  let iconsSeen = 0

  for (const theme of ['light', 'dark']) {
    const page = await (await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme })).newPage()
    await page.goto('file://' + file, { waitUntil: 'load' })
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme)
    await page.waitForTimeout(900)

    // (a) every declared icon paints, in this theme.
    const bad = await page.evaluate((names) => {
      const out = []
      for (const n of names) {
        const b = document.createElement('button')
        b.className = `btn btn-outline kc-ic kc-ic-${n}`
        b.textContent = 'x'
        document.body.appendChild(b)
        const cs = getComputedStyle(b, '::before')
        const mask = cs.maskImage || cs.webkitMaskImage || ''
        const w = parseFloat(cs.width), h = parseFloat(cs.height)
        if (!/url\(/.test(mask) || !(w > 8) || !(h > 8)) out.push(`${n} (mask=${mask.slice(0, 16)} ${w}×${h})`)
        b.remove()
      }
      return out
    }, ICON_NAMES)
    if (bad.length) problems.push(`${theme}: ${bad.length} icon(s) do not paint — ${bad.slice(0, 4).join(', ')}`)

    // …and takes the button's own ink. Compared ACROSS variants that really do
    // differ, because an earlier version mutated style.color to prove this and
    // proved nothing — the mutation never took, so the two always matched.
    const follows = await page.evaluate(() => {
      const out = []
      for (const variant of ['btn-outline', 'btn-primary', 'btn-danger']) {
        const b = document.createElement('button')
        b.className = `btn ${variant} kc-ic kc-ic-save`; b.textContent = 'Save'
        document.body.appendChild(b)
        out.push({ variant, btn: getComputedStyle(b).color, icon: getComputedStyle(b, '::before').backgroundColor })
        b.remove()
      }
      return out
    })
    for (const f of follows) if (f.icon !== f.btn) problems.push(`${theme}: .${f.variant} icon is ${f.icon}, not the button's ${f.btn}`)
    if (new Set(follows.map((f) => f.btn)).size < 2) problems.push(`${theme}: the button variants share one ink, so "icon matches button" proves nothing`)

    // (b) + (c), over every tab and every dialog.
    const scan = async (where) => {
      const r = await page.evaluate(() => {
        const txt = document.body.innerText
        const literal = /kc-ic|<i class|aria-hidden="true"><\/i>/.test(txt)
        const junk = []
        for (const el of document.querySelectorAll('*')) {
          for (const a of el.attributes) {
            if (/^(kc-ic|aria-hidden=|class=|<|—)/.test(a.name) || a.name.includes('kc-ic') ||
                a.name.includes('/i') || a.name.includes('"')) junk.push(`<${el.tagName.toLowerCase()} ${a.name}>`)
          }
        }
        const tail = /"\s*>/.test(txt) ? (txt.match(/.{0,44}"\s*>/) || [''])[0] : ''
        // (d) THE NAME IS WELL-FORMED AND SAYS NOTHING. The card menus derived
        // their aria-label from the display label with `.replace(/^\S+\s/,'')`,
        // which stripped a leading emoji — and then stripped `<i` and nothing
        // else once the icon became markup, shipping
        //   class="kc-ic kc-ic-pound" aria-hidden="true"></i> Money
        // to a screen reader. The attribute parses; names.mjs sees a name and
        // passes. Only reading what the name SAYS finds it.
        const named = []
        for (const el of document.querySelectorAll('[aria-label],[title],[alt]')) {
          for (const a of ['aria-label', 'title', 'alt']) {
            const v = el.getAttribute(a)
            if (v && (/kc-ic|<\/?i[ >]|<span|<div|aria-hidden/.test(v))) named.push(`${a}="${v.slice(0, 48)}"`)
          }
        }
        const all = [...document.querySelectorAll('.kc-ic')]
        const unresolved = all.filter((e) => !/url\(/.test(getComputedStyle(e, '::before').maskImage || ''))
          .map((e) => e.className).slice(0, 3)
        return {
          literal, sample: literal ? (txt.match(/.{0,40}(kc-ic|<i class).{0,40}/) || [''])[0] : '',
          n: all.length, unresolved, junk: [...new Set(junk)].slice(0, 4), tail,
          named: [...new Set(named)].slice(0, 4),
        }
      })
      iconsSeen += r.n
      if (r.literal) problems.push(`${where}: markup in an escaped sink → ${r.sample.trim()}`)
      if (r.junk.length) problems.push(`${where}: BROKEN ATTRIBUTE → ${r.junk.join(' ')}`)
      if (r.tail) problems.push(`${where}: stray attribute tail → ${r.tail.trim()}`)
      if (r.named.length) problems.push(`${where}: markup read out as a NAME → ${r.named.join(' ')}`)
      if (r.unresolved.length) problems.push(`${where}: unresolved mask on ${r.unresolved.join(', ')}`)
    }

    if (theme !== 'light') { await page.close(); continue }   // see the note at the top

    for (const t of TABS) {
      await page.evaluate((x) => goToTab(x), t).catch(() => {})
      await page.waitForTimeout(380)
      await scan(`tab:${t}`)
    }
    // The dialogs carry their own sinks; five of the escaped-sink leaks were
    // only ever visible with a dialog open.
    await page.evaluate(async () => {
      const first = async (u, k) => { const d = await (await fetch(u)).json(); return (d[k] || d || [])[0]?.id }
      window.__kc = {
        customer: await first('/api/customers', 'customers'), rental: await first('/api/rentals', 'rentals'),
        sim: await first('/api/sims', 'sims'), supplierReturn: await first('/api/supplier-returns', 'returns'),
      }
    })
    for (const m of MODALS) {
      try {
        await page.evaluate((x) => goToTab(x), m[1]); await page.waitForTimeout(220)
        await page.evaluate((o) => { eval(o) }, m[2]); await page.waitForTimeout(380)
        await scan(`modal:${m[0]}`)
        await page.evaluate(() => { try { closeDynamicModal() } catch {} try { closeModal() } catch {} })
      } catch {}
    }
    await page.close()
  }
  await browser.close()
  return { problems, iconsSeen, declared: ICON_NAMES.length }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf('--width')
  const { problems, iconsSeen, declared } = await run({ width: i > -1 ? Number(process.argv[i + 1]) : 1280 })
  problems.slice(0, 10).forEach((p) => console.log('✗ ' + p))
  if (problems.length > 10) console.log(`  …and ${problems.length - 10} more`)
  console.log(problems.length
    ? `${problems.length} icon problem(s) — ${declared} icons declared`
    : `all ${declared} icons paint, and no markup reached a text sink or an attribute (${iconsSeen} drawn)`)
  process.exit(problems.length ? 1 : 0)
}
