# Offline UI harness

```bash
npm i --no-save playwright-core       # once per session; deliberately not a dependency
bash ops/harness/audit-all.sh --smoke # ~90s — run this before a ship
bash ops/harness/audit-all.sh         # every check below; ~25-30 min, runs nightly
```

**Two speeds, since 24 Aug.** The full sweep is 31 checks and 37 browser
launches. It was being run inline in every session and before every ship, and
half an hour is how a check that is worth having turns into a check people
route around. It now runs **once a night** — the "KC nightly full audit"
routine at 01:00 London, ahead of the 03:00 UX loop, so that loop starts the
night with fresh findings — and a ship runs `--smoke`.

`--smoke` is a strict subset: every tab renders and none overflows at 390px,
every dialog still opens, every public page renders in both languages, every
control has a name, dark contrast, no half-written dark rule, and the icon set
intact. Those are the seven that have actually caught something on the way out
of the door. It is a
subset in the literal sense, so the full sweep does not re-run it — each line
below already covers it at more widths and both themes.


Renders the staff app with no server, no auth and no database, so a screen can
be **looked at** rather than reasoned about.

```bash
node ops/harness/render.mjs                                  # build app.html
node ops/harness/render.mjs --audit --width 390              # overflow report, every tab
node ops/harness/render.mjs --contrast --theme dark          # AA contrast, every tab
node ops/harness/render.mjs --targets --width 390            # touch targets under 24×24
node ops/harness/render.mjs --shot rentals --width 390 --theme dark
node ops/harness/render.mjs --audit --width 390 --fs largest    # Simple Mode
```

`--fs` is the third dimension beside width and theme: Simple Mode's text-size
steps (`standard` / `large` / `largest`, docs/DESIGN.md §Type), the same flag
`modals.mjs` takes. Everything here was laid out against 13px body copy and
`largest` is 17px, so it is the setting most likely to break a layout — and for
a long time the tab sweep could only be run in it by setting `data-fs` on
`<html>` by hand, which meant nobody did. `audit-all.sh` now runs it.

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

## The customer picker (`picker.mjs`)

```bash
node ops/harness/picker.mjs           # all 11 pickers, driven like a person drives them
```

There is one customer picker in the app — `customerPicker()` — and eleven
places call it. This opens every one of them and types in it: does it open on
who was in lately, does a surname filter, does a phone number filter, does the
number show beside each name, do arrow keys and Enter commit, does the hidden
input end up holding the id, does the ✓ line name the number, does a name
nobody has still offer "➕ Add … as a new customer", and is the list actually
*visible* rather than painted and clipped (the last one caught `.table-card`'s
`overflow: hidden` cutting the help timer's list down to two pixels).

It also fails if any `<select>` anywhere is still listing customers, which is
what stops a twelfth hand-built picker quietly appearing.

## The floating help timer (`popout.mjs`)

```bash
node ops/harness/popout.mjs           # opens the always-on-top window, light and dark
```

The timer's "⧉ Float on top" opens a Document Picture-in-Picture window — a
real always-on-top OS window with its own document, its own stylesheet and its
own copies of the buttons, which is exactly the kind of thing that works the
day it is written and rots unwatched. This opens it in both themes, watches the
clock move, pauses from the window and checks the APP agrees, then stops from
the window and checks the charge form comes up in the app with the customer and
the money already in it.

## Modals (`modals.mjs`)

```bash
node ops/harness/modals.mjs                       # all big modals, 390px light
node ops/harness/modals.mjs --theme dark --only customer-card
node ops/harness/modals.mjs --fs largest          # Simple Mode: 17px body copy
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

`--fs` is the third dimension, beside width and theme: Simple Mode's text-size
steps (`standard` / `large` / `largest`, docs/DESIGN.md §Type). Worth a pass
whenever a modal changes — every box in there was laid out against 13px body
copy and `largest` is 17px. Non-standard runs suffix the screenshot filename so
they cannot overwrite the standard shot. The tab sweep takes the same setting
by hand: set `data-fs` on `<html>` before calling `audit`.

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


## `icons.mjs` — the icon set, checked the three ways it has broken

```bash
node ops/harness/icons.mjs
```

96 CSS-mask icons replaced the emoji through 23-24 August and the conversion
went wrong three separate times. Each failure is now a check, and each check has
been proved in both directions — clean as shipped, red when the bug is put back:

1. **The mask does not resolve.** `mask: var(--kc-ic)` — the shorthand — computes
   to `none` even when the variable is set on the element, and a double quote
   inside `url("…")` ends the data URI at the first `cx="12"`. Both painted
   nothing, and both looked like a missing icon rather than a broken rule.
2. **The markup reached an escaped sink.** `STOCK_CATEGORY_LABELS` is *data* — a
   custom category's key is its label — so the render sites escape it and
   `<i class="kc-ic…">` showed as literal text on the Shop tab and in five
   dialogs. Negative control: putting markup back in that map turns up 24
   problems, naming `goods-in` and `supplier-return-manage` among others.
3. **The markup reached an attribute and broke it.** `EQ_LABELS` interpolated
   into `aria-label="…"`; the first quote of `class="` closed the attribute and
   the parser turned the rest into junk attributes plus loose text spilled over
   the toggles. **This is the one that reached the owner's screen**, and the
   reason the first version of this scan was worthless: the leaked text carries
   no `kc-ic` at all — it reads `— mark returned/lost">` — so `innerText` could
   never find it. It reads the attribute NAMES instead. Negative control:
   `✗ modal:rental-manage: BROKEN ATTRIBUTE → <div kc-ic> <div kc-ic-phone">`.

The tab-and-dialog walk runs in one theme on purpose. (2) and (3) are parse
failures, decided by the string and not by the palette, so walking 15 tabs and
40 dialogs twice costs 25 seconds to re-answer a question that cannot have a
second answer. (1) *is* theme-dependent — the icon takes the button's ink, and
the dark palette is a different set of tokens rather than a filter over the
light one — so that half runs in both. Same coverage, half the time, which is
what lets it run in `--smoke` rather than only overnight.

### What is deliberately still an emoji

The conversion is finished, and 137 lines of `public/main.js` still carry one.
That is not a backlog — it is the set of places a CSS mask icon cannot go, and
each was checked rather than assumed:

- **`<option>` text (65 lines).** An option element renders no child markup, so
  a filter view's label, a status dropdown or the till's category list can only
  ever say what it says in characters. This is the biggest group by far.
- **`title` / `aria-label` / `placeholder` attributes (14).** An attribute holds
  text. Putting markup in one is the bug that tore the equipment rows apart and
  the bug that had the customer-card menus reading `class="kc-ic…"` aloud.
- **Persisted data (a handful).** A comm-log entry, a task title and a void
  reason are written to the database and read back months later. `KC_LEGACY_ICONS`
  exists precisely because rows written before 24 Aug hold glyphs, and history is
  not rewritten to suit a stylesheet.
- **Escaped sinks that are also data.** `STOCK_CATEGORY_LABELS` is the standing
  example: a custom category's key IS its label, so every render site escapes it.
  The settings help text that lists those twelve keeps its emoji too — it is a
  legend for a list that shows emoji, and half-and-half in one sentence names
  things that look like that nowhere.
- **Comments (35).** Prose explaining what was measured and when. Rewriting a
  note that says `"💾 Save changes" sat 53px off a 390px screen` would falsify
  the record of a measurement.

Everything else — every button, title, badge, warning line, empty state, feed
row, menu item and label whose sink takes markup or takes a class — is an icon.

## `a11y.mjs` — the structure a screen reader navigates by

```bash
node ops/harness/a11y.mjs                 # staff app + every public page, en
node ops/harness/a11y.mjs --lang he
node ops/harness/a11y.mjs --only welcome
```

Every other sweep in here measures what a sighted mouse user meets: colour,
geometry, overflow, focus rings. This one measures what is left when the screen
is not being looked at — landmarks, heading order, accessible names, alt text,
and the skip link that lets somebody past the navigation.

It exists because on 26 Aug the whole thing was audited by hand once, and that
pass found the app's only **Level A** failure: WCAG 2.4.1, no skip link
anywhere and nine of thirteen public pages with no `<main>`. It also found two
heading-level skips, each of them hiding a CSS rule that had never matched
anything (`.pg-name h4` against markup that said `h3`), and `/login` with no
`<h1>` at all — "Welcome back" was a `div`. Nothing already running here could
see any of it, and a structure nobody measures is a structure that rots.

Four rules, one per thing that pass caught:

1. Exactly one `<h1>` per page, and no skipped heading levels.
2. Every image carries an `alt` attribute. Empty is fine and means decorative;
   **absent** is not.
3. Every visible interactive control has an accessible name, computed the way a
   browser computes one: `aria-label`, `aria-labelledby`, `<label for>`, a
   wrapping `<label>`, its own text, `title`, `placeholder`, then a named child
   — a link wrapping `<span role="img" aria-label="…">` is announced by that
   label, and the first draft reported every one of those as nameless.
4. Every page has a content landmark, and wherever navigation repeats there is
   a skip link that is **first in the tab order** and lands on it.

Rule 4 is *driven*, not read. The check presses a real `Tab` and then `Enter`,
because the first version of it passed on source order while three pages were
putting a `position: fixed` theme toggle ahead of the link — the markup was in
the right order and the keyboard still went somewhere else.

A page that autofocuses a field is exempt from the tab-order half: focus starts
in the field, so the first Tab necessarily moves away from the link. The sign-in
pages do that deliberately and have no navigation to bypass.

Both languages in the nightly sweep. The Hebrew pages are a different tree, not
a filter over the English one, and the skip link is a separate string in each.

One thing it is **not**: a substitute for reading. It checks structure, not
sense — an `alt` of "image" passes rule 2, and a button named "Click here"
passes rule 3. It catches rot, not bad writing.
