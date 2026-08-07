# Offline UI harness

```bash
npm i --no-save playwright-core     # once per session; deliberately not a dependency
bash ops/harness/audit-all.sh       # every check below, one summary line each
```


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

## Modals (`modals.mjs`)

```bash
node ops/harness/modals.mjs                       # all big modals, 390px light
node ops/harness/modals.mjs --theme dark --only customer-card
```

The tab audits stop at the tab: four rounds of eyeballing never opened a
modal, and the first run of this found the customer card's whole tool strip
(✕ Close included) off the right edge of a 390px screen. Opens each big
modal — plus the Customer-360 page (`customer-page` / `customer-page-log`),
which is not a modal but gets the same geometry + screenshot treatment via
its `.kc-cpage` panel — screenshots it (`modal_<name>_<theme>_<width>.png`
here, gitignored),
and flags a box that leaves the viewport, scrolls sideways, or has children
overhanging its right edge. A ✓ means the geometry is sane — it does NOT
mean the modal reads well. The screenshots are the deliverable; look at them.

The seed's `/api/ledger` carries both the dashboard shape (`recent`) and the
customer-card shape (`balance`/`entries`) in one object, because the fetch
stub strips query strings so `?customerId=` cannot select a different body.

## Public pages (`public.mjs`)

```bash
node ops/harness/public.mjs                       # welcome/portal/phone-guide/repair × en+he
node ops/harness/public.mjs --shot welcome --lang he --width 390
node ops/harness/public.mjs --shot repair --lang en --width 390 --theme dark
```

The staff harness renders to static markup, which is fine because main.js paints
everything afterwards. These pages are different: **language lives in React
state**, set by a `useEffect` that reads `localStorage`, so static markup is
always English and the entire right-to-left half of the product is invisible to
it. So this one ships React + ReactDOM as UMD from `node_modules`, transpiles
the page into a browser bundle, sets `kcLang` before mounting, and lets React
run for real.

Three things it has to get right to be worth trusting, each paid for:

- **It mounts on `#__next`.** globals.css styles that id, and a `width:100%`
  shell only fills the viewport because of it. On any other id the shell
  shrink-wraps and every page reads as though its background stops mid-screen —
  a defect that exists nowhere but here.
- **Assets are inlined as data URIs.** Every asset these pages name is an
  absolute path, which on `file://` resolves to the filesystem root and 404s.
  Uninlined, the brand renders as broken-image alt text and Hebrew falls back
  out of Heebo — the two things a screenshot is *for*. The `content:` swap that
  gives dark mode its own wordmark is keyed on `img[src="/logo-full-tight.png"]`,
  and survives because the selector and the attribute get the same data URI.
- **`--theme dark` sets `data-theme` on `<html>`, not just the OS preference.**
  globals.css deliberately carries no `prefers-color-scheme` palette (the
  reasoning sits beside the `:root[data-theme="dark"]` block), so a browser-level
  dark scheme changes *nothing* on these pages. Before this, `--theme dark`
  rendered a light page and the dark half of /repair, /phone-guide and /portal
  had never once been looked at. Screenshots carry the theme in the filename so
  a run can no longer overwrite its own light shot.

It fails a page that does not render, throws, or shows no `dir="rtl"` in Hebrew.

**It does not fail a page on width, and neither should you.** Inter comes from
Google Fonts and there is no network here, so Latin text falls back to a wider
face — measured 65px on the welcome nav alone, which is most of the 173px that
page "overflows" by. Hebrew is self-hosted (`public/fonts/heebo-var-hebrew.woff2`)
so it fares better. Widths are printed to be looked at with that in mind, never
treated as a defect on their own. When a width finding matters, re-measure it
with a squeeze applied (`* { letter-spacing: -0.07em }`) and see whether it
survives; the Rentals grid did, at 551px, which is how that one was believed.

## Half-written dark rules (`theme-pairs.mjs`)

```bash
node ops/harness/theme-pairs.mjs      # exits non-zero if any dark rule is written once
```

/welcome ships its own OS-dark palette, so each dark rule there needs both a
`:root[data-theme="dark"]` form (someone used the toggle) and a
`prefers-color-scheme` twin (someone never touched it). Eleven selectors had
only the first, so a visitor on a dark computer got the dark paper with
light-mode ink on it.

`styles/globals.css` is exempt and must stay exempt — it has no OS-dark palette
at all and `html` pins `color-scheme: light`, so an OS-preference rule there
would make the same bug in reverse. The reasoning is written out beside the
`.pd-logo` rule.

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

## css-diff.mjs — proving a refactor changed nothing

Everything above answers "is this broken?". This one answers a different
question: **"is this the same?"**

    node ops/harness/css-diff.mjs --save     # before
    …refactor…
    node ops/harness/css-diff.mjs --check    # after

It renders 80 scenes — 13 tabs at two sizes and themes, 19 modals in both
themes, 4 public pages in both languages at two sizes — walks every element in
each, and records 103 computed properties plus the box. ~29,000 elements. A
change that is genuinely presentational-neutral comes back identical; anything
else names the element and the property that moved.

Use it for stylesheet surgery: splitting a file, reordering rules, renaming a
token, deduplicating selectors. The rest of the harness measures whether the
page still fits and still contrasts, and will happily pass a page whose
headings have quietly lost 100 of their font-weight. This is the check that
catches that.

Two things worth knowing:

- **It freezes time before sampling.** Finite animations and transitions are
  run to their end, endless ones pinned to frame zero, through the Web
  Animations API. Without that, the welcome page's scroll-reveal and the login
  mesh sample a different frame every run — the first version reported 240
  changed elements against a completely unmodified build.
- **The baseline is dated.** Some screens render today's date, so a snapshot
  taken before midnight will differ from a check taken after it on exactly the
  date-driven screens (dashboard, rentals, the rental modals, cash-up) and
  nowhere else. That shape is the tell; re-baseline rather than go hunting.

The 22MB of snapshots live in `.css-snapshot/` and are gitignored — a local
yardstick, regenerated whenever you need one.

It found the regression that justified writing it. Splitting `globals.css` in
two left the iOS zoom guard — `@media (max-width:768px)` bumping small inputs
to 16px, written to sit last in the file — being overridden by the staff sheet
that now loaded after it. 730 elements, the zoom trap back on every phone at
the counter, and `audit-all.sh` passed the whole thing clean.
