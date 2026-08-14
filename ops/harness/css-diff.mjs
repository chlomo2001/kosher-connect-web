// Prove a stylesheet refactor changed nothing that anyone can see.
//
//   node ops/harness/css-diff.mjs --save      # snapshot the current build
//   …refactor the CSS…
//   node ops/harness/css-diff.mjs --check     # every element, still identical?
//
// Why this exists: audit-all.sh measures geometry (does anything overflow, is
// there enough contrast, is the tap target big enough). It cannot tell you that
// a heading lost 100 of its font-weight, or that a border went from solid to
// none — the page still fits, still contrasts, still passes. Splitting one
// stylesheet into two changes the cascade order of every rule that moves, and
// that is exactly the class of regression audit-all is blind to.
//
// So: render every screen, walk every element, and record what the browser
// actually computed for it. A refactor that is genuinely presentational-neutral
// produces a byte-identical snapshot. Anything else prints the element and the
// property that moved.
//
// The snapshot is keyed by structural path (child index from the document
// root), not by class name — renaming a class would otherwise silently look
// like "element deleted, different element added" and diff clean.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildAppHtml, TABS, BROWSER_ENV } from './render.mjs'
import { buildPublicHtml, PAGES } from './public.mjs'
import { MODALS } from './modals.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const require = createRequire(import.meta.url)
const SNAP = path.join(HERE, '.css-snapshot')

// The properties that carry how a thing looks. Deliberately not the full
// computed style: that is ~340 properties per element, most of them derived or
// constant, and the noise makes a real diff unreadable. These are the ones a
// cascade change actually moves.
const PROPS = [
  'display', 'position', 'top', 'right', 'bottom', 'left', 'float', 'clear',
  'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight', 'boxSizing',
  'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'borderTopStyle', 'borderRightStyle', 'borderBottomStyle', 'borderLeftStyle',
  'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
  'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius',
  'color', 'backgroundColor', 'backgroundImage', 'backgroundSize', 'backgroundPosition',
  'opacity', 'boxShadow', 'outlineWidth', 'outlineStyle', 'outlineColor', 'visibility',
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing',
  'textAlign', 'textDecorationLine', 'textTransform', 'whiteSpace', 'wordBreak',
  'overflowWrap', 'textOverflow', 'verticalAlign', 'listStyleType', 'direction', 'unicodeBidi',
  'overflowX', 'overflowY', 'zIndex', 'cursor', 'pointerEvents', 'userSelect',
  'flexDirection', 'flexWrap', 'justifyContent', 'alignItems', 'alignSelf',
  'flexGrow', 'flexShrink', 'flexBasis', 'order', 'gap', 'rowGap', 'columnGap',
  'gridTemplateColumns', 'gridTemplateRows', 'gridColumn', 'gridRow',
  'transform', 'transformOrigin', 'transitionProperty', 'transitionDuration',
  'animationName', 'animationDuration', 'objectFit', 'fill', 'stroke',
  'borderCollapse', 'tableLayout', 'backdropFilter', 'filter', 'content',
]

// Elements that paint nothing. Skipped, and — the part that matters — skipped
// WITHOUT consuming a child index, so adding a stylesheet link to the body
// doesn't renumber every element after it and turn one change into thousands.
const INVISIBLE_TAGS = ['HEAD', 'SCRIPT', 'STYLE', 'LINK', 'META', 'TITLE', 'NOSCRIPT']

// Runs inside the page. Returns one line per element: structural key, a label
// to make the diff readable, the box, then every property above.
const COLLECT = ([props, invisible]) => {
  const skip = new Set(invisible)
  const out = []
  const walk = (el, key) => {
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    const label = el.tagName.toLowerCase() +
      (el.id ? '#' + el.id : '') +
      (el.className && typeof el.className === 'string'
        ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '')
    const box = [r.x, r.y, r.width, r.height].map((n) => Math.round(n * 100) / 100).join(',')
    out.push(key + '\t' + label + '\t' + box + '\t' + props.map((p) => cs[p]).join('|'))
    let i = 0
    for (const child of el.children) {
      if (skip.has(child.tagName)) continue
      walk(child, key + '/' + (i++))
    }
  }
  walk(document.documentElement, '')
  return out.join('\n')
}

// Fonts are not on the machine (Inter comes from Google, and there is no
// network here), so text metrics settle a beat after load. Wait for the
// document's own fonts to be ready rather than guessing at a timeout.
//
// Then stop time. The first version of this tool reported 240 changed elements
// against an unmodified build: the welcome page's scroll-reveal was still
// easing and the login mesh drifts forever, so every run sampled a different
// frame. Freezing is done through the Web Animations API rather than by
// disabling motion in CSS, because overriding animation-duration would hide
// the very properties a motion regression shows up in. Finite animations and
// transitions are run to their end — the resting state a person actually sees;
// endless ones are pinned to frame zero. Twice, because finishing one can
// start another.
const freeze = async (p) => {
  for (let i = 0; i < 2; i++) {
    await p.evaluate(() => {
      for (const a of document.getAnimations()) {
        try {
          const t = a.effect && a.effect.getComputedTiming()
          if (t && t.iterations === Infinity) { a.pause(); a.currentTime = 0 } else { a.finish() }
        } catch { /* an animation that refuses to be pinned is left alone */ }
      }
    })
    await p.waitForTimeout(120)
  }
}

const settle = async (p) => {
  await p.evaluate(() => document.fonts.ready).catch(() => {})
  await p.waitForTimeout(400)
  await freeze(p)
}

async function staffScenes(browser, snap) {
  const file = buildAppHtml()
  for (const [w, theme] of [[1280, 'light'], [390, 'dark']]) {
    const ctx = await browser.newContext({ locale: 'en-GB', viewport: { width: w, height: 900 }, colorScheme: theme })
    const p = await ctx.newPage()
    await p.goto('file://' + file, { waitUntil: 'load' })
    await settle(p)
    for (const tab of TABS) {
      await p.evaluate((t) => window.renderTab(t), tab).catch(() => {})
      await p.waitForTimeout(260)
      // A tab swap builds new markup, and new markup starts new animations —
      // the ones frozen at load are gone. Freeze again, per tab.
      await freeze(p)
      snap[`staff/${tab}/${w}/${theme}`] = await p.evaluate(COLLECT, [PROPS, INVISIBLE_TAGS])
    }
    await ctx.close()
  }
}

// Modals are where the shared form classes actually live — .form-input, .btn,
// the whole customer card — so they are the surface a cascade change is most
// likely to break and the one the tab sweep above never opens.
async function modalScenes(browser, snap) {
  const file = buildAppHtml()
  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ locale: 'en-GB', viewport: { width: 390, height: 844 }, colorScheme: theme })
    const p = await ctx.newPage()
    await p.goto('file://' + file, { waitUntil: 'load' })
    await p.waitForTimeout(900)
    await p.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme)
    await p.evaluate(async () => {
      const first = async (u, k) => { const d = await (await fetch(u)).json(); return (d[k] || d || [])[0]?.id }
      window.__kc = {
        customer: await first('/api/customers', 'customers'),
        rental: await first('/api/rentals', 'rentals'),
        sim: await first('/api/sims', 'sims'),
        supplierReturn: await first('/api/supplier-returns', 'returns'),
      }
    })
    for (const [name, tab, js] of MODALS) {
      await p.evaluate((t) => window.renderTab(t), tab).catch(() => {})
      await p.waitForTimeout(200)
      try { await p.evaluate(js) } catch { continue }
      await p.waitForTimeout(300)
      await freeze(p)
      snap[`modal/${name}/${theme}`] = await p.evaluate(COLLECT, [PROPS, INVISIBLE_TAGS])
      await p.evaluate(() => {
        document.querySelectorAll('.modal-overlay, .modal').forEach((m) => m.classList.add('hidden'))
        if (typeof closeDynamicModal === 'function') try { closeDynamicModal() } catch {}
        if (typeof closeModal === 'function') try { closeModal() } catch {}
      })
      await p.waitForTimeout(120)
    }
    await ctx.close()
  }
}

async function publicScenes(browser, snap) {
  for (const page of Object.keys(PAGES)) {
    for (const lang of ['en', 'he']) {
      const file = buildPublicHtml(page, lang)
      for (const [w, theme] of [[390, 'light'], [1280, 'dark']]) {
        const ctx = await browser.newContext({ locale: 'en-GB', viewport: { width: w, height: 900 }, colorScheme: theme })
        const p = await ctx.newPage()
        await p.goto('file://' + file, { waitUntil: 'load' })
        await settle(p)
        snap[`public/${page}/${lang}/${w}/${theme}`] = await p.evaluate(COLLECT, [PROPS, INVISIBLE_TAGS])
        await ctx.close()
      }
    }
  }
}

const { chromium } = require(path.join(ROOT, 'node_modules/playwright-core'))
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: BROWSER_ENV })
const snap = {}
await staffScenes(browser, snap)
await modalScenes(browser, snap)
await publicScenes(browser, snap)
await browser.close()

const scenes = Object.keys(snap)
const elements = scenes.reduce((n, k) => n + snap[k].split('\n').length, 0)

if (process.argv.includes('--save')) {
  if (!existsSync(SNAP)) mkdirSync(SNAP)
  for (const k of scenes) writeFileSync(path.join(SNAP, k.replace(/\//g, '__') + '.txt'), snap[k])
  console.log(`saved ${scenes.length} scenes, ${elements} elements → ${path.relative(ROOT, SNAP)}`)
  process.exit(0)
}

// --check: compare, and say exactly which property moved on which element.
let diffs = 0
let missing = 0
for (const k of scenes) {
  const f = path.join(SNAP, k.replace(/\//g, '__') + '.txt')
  if (!existsSync(f)) { console.log(`? ${k} — no baseline`); missing++; continue }
  const was = readFileSync(f, 'utf8').split('\n')
  const now = snap[k].split('\n')
  const shown = []
  if (was.length !== now.length) {
    shown.push(`element count ${was.length} → ${now.length}`)
  }
  for (let i = 0; i < Math.min(was.length, now.length); i++) {
    if (was[i] === now[i]) continue
    const [key, label, box, vals] = now[i].split('\t')
    const [, , wasBox, wasVals] = was[i].split('\t')
    const a = (wasVals || '').split('|')
    const b = (vals || '').split('|')
    const moved = PROPS.filter((p, j) => a[j] !== b[j]).map((p, j) => p)
    const detail = PROPS.map((p, j) => (a[j] !== b[j] ? `${p}: ${a[j]} → ${b[j]}` : null)).filter(Boolean)
    if (wasBox !== box) detail.unshift(`box: ${wasBox} → ${box}`)
    shown.push(`${label} [${key}]  ${detail.slice(0, 4).join('  ·  ')}`)
  }
  if (shown.length) {
    diffs += shown.length
    console.log(`\n✗ ${k}`)
    for (const s of shown.slice(0, 8)) console.log('   ' + s)
    if (shown.length > 8) console.log(`   …and ${shown.length - 8} more`)
  }
}
console.log()
if (missing) console.log(`${missing} scene(s) had no baseline — run --save first`)
console.log(diffs
  ? `CSS-DIFF: ${diffs} element(s) render differently`
  : `CSS-DIFF: identical — ${scenes.length} scenes, ${elements} elements, ${PROPS.length} properties each`)
process.exit(diffs || missing ? 1 : 0)
