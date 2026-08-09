# DESIGN.md — the Kosher Connect design contract

The details are pre-decided **once, here**, so no screen disagrees with another
in the small ways. New UI copies from this document; a deviation is either a bug
or a change to this document — never a local exception. Token values live in
`styles/globals.css` (`:root` block); this file says **which token, when**.

Started 2026-08-04 as part of the "Google-feel" cycle (owner ask: the first
three gaps — content transitions, skeleton loading, a deep design system).
The Stripe-language analysis that inspired the flat look formerly lived at
this path; it is reference material, not the contract, and now lives at
`docs/STRIPE-REFERENCE.md`.

## Ink & surfaces

Every colour comes off a token — `--text` / `--ink-secondary` / `--muted` for
ink, `--surface` / `--surface2` / `--panel` / `--bg` for planes, `--border` /
`--border-subtle` / `--border-input` for hairlines, `--accent` (+ `--accent2`,
`--primary-*`) for the brand blue, and the semantic set (`--danger`, `--success`,
`--warning`, `--gold`, `--sim`, `--vn`). Dark mode works **only** because it
overrides these tokens — a literal hex in markup will not flip and is a bug
(the badge sweep, task #159, is the precedent).

## Spacing

One scale: `--space-1..6` → **4 / 8 / 12 / 16 / 24px**. Paddings, gaps and
margins in new code come off the scale (raw multiples of the scale are fine in
shorthand, e.g. `padding: 12px 16px`). Odd values — 5, 7, 9, 10, 14, 18px —
are legacy; collapse them to the nearest step when touching a surface, don't
add more.

## Radius

`--radius-sm` 4px (badges, micro-tags) · `--radius` 6px (buttons, inputs,
controls) · `--radius-lg` 8px (cards, panels, modals) · `--radius-xl` 12px (palette cards,
side panels, the larger modals) · `--radius-2xl` 16px (the biggest feature
surfaces). The xl pair records radii the flagship surfaces already shipped —
re-squaring them to 8px would have been a visual regression, so the contract
grew to fit instead. No pills except the already-established chips
(`.pd-chip`, filter chips).

## Elevation & borders

Flat by default: surfaces separate by hairline (`--border`) first, shadow
second. `--shadow-1` is the resting card shadow; `--shadow-2` is for things
that float (modals, dropdowns, popovers). Focus is always the `--ring` token —
never `outline: none` without it.

## Type

The ramp (tokens in `globals.css`):

| Token | px | Use |
| --- | --- | --- |
| `--fs-micro` | 11 | badges, table meta, timestamps |
| `--fs-small` | 12 | secondary text, dense tables |
| `--fs-body` | 13 | **app default** — body copy, controls, table cells |
| `--fs-ui` | 14 | emphasised body, inputs, buttons |
| `--fs-lead` | 16 | section leads, modal titles |
| `--fs-title` | 18 | card titles, big stats |
| `--fs-h1` | 22 | page headings |
| `--fs-hero` | 28 | hero numbers (dashboard money) |
| `--fs-overline` | 10 | UPPERCASE tracked section labels only — never body text |

**Simple Mode** (`--fs-scale`, Aug 09): every step above is written as
`calc(<px> * var(--fs-scale))`, and `data-fs` on `<html>` sets the multiplier —
absent = 1 (Standard, 13px body), `large` = 1.15 (15px), `largest` = 1.3 (17px).
The 🔠 button in the topbar and the till cycles it; `_document.js` applies the
saved choice before first paint, alongside the theme.

This is the whole of Simple Mode, and it is why the ramp exists. The app is
dense on purpose and that density is wrong for some of the people working
behind this counter; the cheap fix is a set of hand-picked "make these bigger"
rules, which yields 15px body copy beside 11px badges it no longer matches.
Because adoption is complete — every staff-app font-size is on a token — one
multiplier moves the entire product with its proportions intact, and there is
no second stylesheet and nothing to keep in step. **Any new off-ramp size
silently opts that text out of Simple Mode**, which is a second reason not to
add one.

The display tier scales too: a 48px heading over 17px body reads differently
from 48px over 13px, and holding it back is what would look like a bug. The
scale stops at 1.3 because past it the Rentals grid stops fitting a 390px
phone. Fixed-size chrome is exempt where growing it would be wrong — the 🔠
button itself keeps a literal 16px glyph, because a control that grows as you
press it walks out from under the pointer, and it is how you get back.

**Display tier** (`--fs-display-1..5` = 20 / 26 / 30 / 40 / 48px, weight 300):
page titles, the dashboard greeting and hero figures, login and tool headings,
the till total. This is page furniture, not reading copy — it sets its own
tracking and sits deliberately above the `--fs-hero` cap. It was shipped and
internally consistent before it was named; naming it beats squashing the app's
signature look. Body copy never uses it.

**Sentence case** for every button, label and heading — "Save changes", not
"Save Changes". Proper nouns keep their capitals. The app was split between the
two until Aug 05, which reads as two products stitched together.

Weights: 400 body · 500 labels/links · 600 emphasis · 700 headings/values.
400 is a floor for anything read as data: table cells and form inputs were
300 until Aug 05 — the same "too thin to read" call already made for body.
The display tier above is the one deliberate exception.
Money and tabular data set `font-feature-settings: "tnum"`.

**Adoption is done** (sessions 2–3, Aug 05): every staff-app and portal
font-size sits on a token. The rounding rule used, for anything that drifts
back: emphasis (weight ≥ 500, money) rounds UP to the nearest step; muted
secondary text rounds DOWN. Never introduce a new off-ramp size.

Deliberate non-token sizes, all allowed:
- **Glyphs and emoji used as icons** (▾ ✕ › ⏱ ⚠️, avatar-circle contents) —
  icon sizing, not typography.
- **`body` base 15px** ("body-md") — the inherited root for unstyled corners;
  real text always sets a token on top.
- **Public marketing surfaces** (`sk-*`, `w-*`, `pg-*`, `rp-*` on /welcome,
  /phone-guide, /repair) keep their own scale, including display sizes
  (38–150px) and half-steps — marketing type is composed per page, not ramped.

## Motion

The spec, per motion kind. Tokens: `--dur-1..4` = 120/180/260/400ms;
`--ease-out` (strong out — enters/exits), `--ease-in-out` (on-screen movement),
`--ease-emphasis` (drawers, iOS-like).

| Kind | Recipe |
| --- | --- |
| **Enter** (content, dropdown, toast) | fade + ≤6px rise/scale-in from ≥0.95 · `--dur-2` · `--ease-out` |
| **Exit** | fade only, faster than enter · `--dur-1` · `--ease-out` |
| **Move / morph** on screen | `--dur-2`–`--dur-3` · `--ease-in-out` |
| **Drawer / sheet** | `--dur-3`–`--dur-4` · `--ease-emphasis` |
| **Press feedback** | `transform: scale(0.97)` on `:active` · `--dur-1` · `--ease-out` |
| **Hover colour** | `--dur-2` · `ease` |
| **Constant** (spinner, shimmer) | `linear` |

Hard rules:

- **Never `ease-in` on UI.** It delays the exact moment being watched.
- **UI stays under 300ms** (`--dur-4` is for drawers and marketing only).
- **Keyboard-triggered and 100×/day actions don't animate** (⌘K palette opens
  instantly — keep it that way).
- **Never `scale(0)`**; enters start ≥0.95 + opacity 0.
- **Animate `transform`/`opacity` only**; no `transition: all`, no animated
  layout properties (width/height/top/margin).
- Reduced motion is handled by the **global umbrella** in `globals.css`
  (`prefers-reduced-motion` → 0.01ms durations). Token-driven motion inherits
  it for free; bespoke `animation:` rules still need their own guard only if
  they must keep running (loaders may slow instead of stop).

## Loading

Waiting is disguised, not announced:

- **Tab/section loads** use skeletons that mirror the incoming layout
  (`.kc-skel` shapes — shimmer via the `--border`→`--bg-secondary` gradient,
  `linear`, reduced-motion drops the shimmer and keeps the shapes).
- The logo spinner (`.kc-loading`) is for **small inline areas and modals**
  where a layout ghost would be noise.
- Async repaints must not blank what's already painted — paint over, never
  clear-then-load (the dashboard's `dashPaint` is the precedent).

## Where a rule lives

The stylesheet is in two halves, and which half a new rule belongs in is
decided by one question: **can this selector ever match on a public page?**

- `styles/globals.css` — imported by `pages/_app.js`, so every route gets it.
  Design tokens, `@font-face`, `@keyframes`, the reset, and everything /welcome,
  /portal, /phone-guide, /repair, /login and the legal pages use. **All tokens
  and all keyframes belong here**, including ones only the staff app consumes:
  the other sheet may use them, but must never be the only place they are
  defined.
- `styles/app.css` — the staff app's own chrome: sidebar, tables, till, modals,
  command palette, `/tools/*`. Copied comment-free to `public/app.css` at build
  time and linked by `components/AppStyles.js`, so the public pages never
  download it. A rule qualifies only if its selector names at least one class
  the public pages never render.

The staff sheet loads **after** globals.css and therefore wins ties. If you
write a rule in globals.css that has to beat the staff chrome — an accessibility
guard, say — it has to be stated in `styles/app.css` as well; there is a worked
example at the bottom of that file explaining why.

After any structural change to either sheet, run
`node ops/harness/css-diff.mjs --check` against a baseline taken before it.
Geometry and contrast checks pass things this catches.

## Adoption ledger

| Area | State |
| --- | --- |
| Colour tokens (light+dark) | ✅ swept (#159 badge pass) |
| Spacing/radius/elevation tokens | ✅ defined, ✅ major surfaces |
| Motion tokens | ✅ defined; buttons/rows/toasts consume them |
| Tab content transitions | ✅ `kcContentEnter()` + `.tab-enter` |
| Skeleton loading (heavy tabs) | ✅ `skeletonHtml()` on all 8 spinner tabs |
| Type-ramp tokens | ✅ defined and **adopted** (sessions 2–3, Aug 05) — staff app + portal fully tokenised |
| Display tier + radius xl/2xl | ✅ named Aug 05 (review batch 5) — contract grew to match shipped reality |
| Typeface | ✅ Aug 05: "Inter" removed from both stacks — it was named but never loaded, so it had never applied |
| Inline-style sweep (spacing/colour in `style=""`) | ⏳ pending — collapse opportunistically per surface |
