# Offline UI harness

Renders the staff app with no server, no auth and no database, so a screen can
be **looked at** rather than reasoned about.

```bash
node ops/harness/render.mjs                                  # build app.html
node ops/harness/render.mjs --audit --width 390              # overflow report, every tab
node ops/harness/render.mjs --contrast --theme dark          # AA contrast, every tab
node ops/harness/render.mjs --targets --width 390            # touch targets under 24×24
node ops/harness/render.mjs --shot rentals --width 390 --theme dark
```

`--audit` prints one line per tab. It fails a tab when the page or the content
column scrolls sideways, when anything sits outside the content column without
being inside something meant to scroll, **or when the tab never rendered** — a
blank tab overflows by nothing, and the first version of this happily reported
"no tab overflows" while Settings sat on its spinner.

`--contrast` measures every run of text against what is actually painted behind
it, compositing translucent fills down to the first opaque ancestor — because a
wash over a card is where this goes wrong, and `getComputedStyle` alone will not
tell you. It applies the 4.5:1 threshold, or 3:1 for large text.

`--targets` runs the page with a coarse pointer and lists anything interactive
under WCAG 2.5.8's 24×24 CSS px. Coarse on purpose: the rules that enlarge these
are scoped to `pointer: coarse`, because the case that matters is the counter
tablet, not a narrow window.

Two traps, both already paid for:

- Chromium reports some colours as `color(srgb 0.88 0.44 0.54)` — 0–1 channels,
  not 0–255. Parse that as 0–255 and everything looks black; it invented a
  1.28:1 failure on a button that measures 5.45:1.
- A finding is only as good as the seed. Check the route in `pages/api/` before
  believing the app is wrong.

## How it works

`components/AppShell.js` is rendered to static HTML with React, `window.fetch`
is replaced with one that answers from `seed.json`, and the real
`public/main.js` is appended. main.js then boots the way it does in production —
same render functions, same markup, same stylesheet. `window.renderTab('sim')`
switches tabs from the test script.

Needs `playwright-core` for the screenshot and audit modes; Chromium is already
at `/opt/pw-browsers/chromium` in the session container. Building `app.html`
needs nothing but the repo.

## Public pages (`public.mjs`)

```bash
node ops/harness/public.mjs                       # welcome/join/portal/phone-guide × en+he
node ops/harness/public.mjs --shot join --lang he --width 390
```

The staff harness renders to static markup, which is fine because main.js paints
everything afterwards. These pages are different: **language lives in React
state**, set by a `useEffect` that reads `localStorage`, so static markup is
always English and the entire right-to-left half of the product is invisible to
it. So this one ships React + ReactDOM as UMD from `node_modules`, transpiles
the page into a browser bundle, sets `kcLang` before mounting, and lets React
run for real.

It fails a page that does not render, throws, or shows no `dir="rtl"` in Hebrew.

**It does not fail a page on width, and neither should you.** Inter comes from
Google Fonts and there is no network here, so Latin text falls back to a wider
face — measured 65px on the welcome nav alone, which is most of the 173px that
page "overflows" by. Hebrew is self-hosted (`public/fonts/heebo-var-hebrew.woff2`)
so it fares better. Widths are printed to be looked at with that in mind, never
treated as a defect on their own. When a width finding matters, re-measure it
with a squeeze applied (`* { letter-spacing: -0.07em }`) and see whether it
survives; the Rentals grid did, at 551px, which is how that one was believed.

## Keep the seed faithful

`seed.json` must match what the API really returns, field for field. An
unfaithful seed invents defects that do not exist. An early version of it
omitted `recent` from `/api/ledger` and made the dashboard throw; the seed was
wrong, not the dashboard, and half an hour went into proving which. When a tab
looks broken here, check the seed against the route in `pages/api/` before
believing it.

`/api/settings` returns `{rentalRates, damageRates, settings[]}` where
`settings` is an **array** of `{key, numValue, textValue}`. Rentals and repairs
carry a denormalised `customerName`; repairs carry `total`, not `price`.

## What it found

Worth stating, because it is the argument for keeping it:

- **Tickets & Flights, Repairs and Virtual Numbers were clipping their tables
  dead.** `.table-card` has `overflow: hidden` and never got `.table-wrap`'s
  `overflow-x: auto`, so 662px of the flights table — Price, Fee, Status,
  Check-in, the row actions — could not be reached by mouse, finger or keyboard.
- **The Rentals screen pushed its second column off a 1280px display.** A `1fr`
  grid track floored at the section header's 1066px min-content width, so Phone
  Inventory sat off the right edge on the screen the shop works from.
- **The wallet dropped the payment method on a phone**, because the ellipsis on
  a one-line row always eats the end and the end was "(cash)".

None of the three was visible by reading the CSS.
