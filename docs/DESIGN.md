# DESIGN.md — the Kosher Connect design contract

The details are pre-decided **once, here**, so no screen disagrees with another
in the small ways. New UI copies from this document; a deviation is either a bug
or a change to this document — never a local exception. Token values live in
`styles/globals.css` (`:root` block); this file says **which token, when**.

Started 2026-08-04 as part of the "Google-feel" cycle (owner ask: the first
three gaps — content transitions, skeleton loading, a deep design system).

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
controls) · `--radius-lg` 8px (cards, panels, modals). No pills except the
already-established chips (`.pd-chip`, filter chips).

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

Weights: 400 body · 500 labels/links · 600 emphasis · 700 headings/values.
Money and tabular data set `font-feature-settings: "tnum"`.

**Legacy half-steps** (11.5 / 12.5 / 13.5px) and strays (10, 15, 17px) exist in
older code. Collapse them to the ramp when you touch the surface; never
introduce a new off-ramp size. Display sizes above the ramp (38, 48px) are
allowed only on public marketing surfaces.

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

## Adoption ledger

| Area | State |
| --- | --- |
| Colour tokens (light+dark) | ✅ swept (#159 badge pass) |
| Spacing/radius/elevation tokens | ✅ defined, ✅ major surfaces |
| Motion tokens | ✅ defined; buttons/rows/toasts consume them |
| Tab content transitions | ⏳ this cycle |
| Skeleton loading (heavy tabs) | ⏳ this cycle |
| Type-ramp tokens | ✅ defined; adoption sweep **pending** (~470 inline font-sizes in main.js) |
| Inline-style sweep (spacing/colour in `style=""`) | ⏳ pending — collapse opportunistically per surface |
