# 002 — Introduce motion tokens and a strong ease-out for the /welcome reveal

- **Status**: DONE (e371932, 2 Aug 2026)
- **Commit**: c54b10d
- **Severity**: MEDIUM
- **Category**: Easing & duration / Cohesion & tokens
- **Estimated scope**: 1 file (`pages/welcome.js`), CSS only

## Problem

Every transition on `/welcome` is hand-typed with the browser's bare `ease`
keyword and a one-off duration. The scroll-reveal — the page's most prominent
motion — uses `ease` on a 600ms entrance:

```css
/* pages/welcome.js:915 — current */
.sk-reveal{opacity:0;transform:translateY(16px);transition:opacity .6s ease,transform .6s ease}
```

Per the animation playbook, an *entering* element should use a strong
`ease-out` (starts fast, feels responsive); the built-in `ease` is too weak for
a deliberate reveal. There are also six near-identical hand-typed transitions
with no shared token, so the motion drifts instead of reading as one system:

```
pages/welcome.js:733  transition:opacity .2s ease,transform .2s ease,visibility 0s .2s
pages/welcome.js:734  transition:opacity .2s ease,transform .2s ease
pages/welcome.js:740  transition:transform .12s ease,filter .12s ease
pages/welcome.js:856  transition:border-color .15s,background .15s
pages/welcome.js:915  transition:opacity .6s ease,transform .6s ease
```

## Target

Add two easing tokens to `:root` inside `SKY_CSS` and apply the strong ease-out
to the reveal. Values are taken verbatim from the playbook — do not approximate:

```css
/* target — add to the :root block in SKY_CSS */
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);      /* entrances / exits */
--ease-io:  cubic-bezier(0.77, 0, 0.175, 1);     /* on-screen movement */
```

```css
/* target — pages/welcome.js:915 */
.sk-reveal{transition:opacity .6s var(--ease-out),transform .6s var(--ease-out)}
```

Keep the 600ms duration: this is a marketing reveal, and the playbook's sub-300ms
budget is for interactive UI, not a scroll entrance. (If plan 001 is applied
first, keep its `.js-on`-scoped hidden state and only swap the easing on the
`transition` declaration.)

Optionally apply `var(--ease-out)` to the `.sk-top` back-to-top transitions
(`:733`/`:734`) and `.sk-btn` (`:740`) for cohesion — same token, same feel.
Leave the `.15s` colour transition on `:856` as bare `ease` is fine for a pure
colour change (playbook §2: hover/colour → `ease`).

## Repo conventions to follow

- `:root` custom properties already live at the top of `SKY_CSS` (exemplar: the
  `--sk-*` colour and `--sk-maxw` tokens, `pages/welcome.js:650`). Add the
  `--ease-*` tokens in that same `:root` block.
- All edits are inside the `SKY_CSS` template string; no external stylesheet.

## Steps

1. In the `:root` block of `SKY_CSS` (near `pages/welcome.js:650`), add the two
   `--ease-*` custom properties from **Target**.
2. At `pages/welcome.js:915`, change the reveal `transition` to use
   `var(--ease-out)` for both `opacity` and `transform`.
3. (Optional, cohesion) swap `ease` → `var(--ease-out)` on `:733`, `:734`,
   `:740`. Do not change durations.

## Boundaries

- Do NOT change any durations or delays — easing token only.
- Do NOT touch `components/AuthBackdrop.js` (its canvas motion is JS, not CSS).
- Do NOT add dependencies.
- If the `:root` block or `.sk-reveal` no longer matches (drift since c54b10d),
  STOP and report.

## Verification

- **Mechanical**: `bash ops/loops/green-keeper/gate.sh` prints
  `GATE: PASS — branch is shippable.`
- **Feel check**: serve the build, scroll `/welcome`, and in DevTools Animations
  panel set playback to 10%. Confirm each section's reveal now *decelerates* into
  place (moves fast at first, eases to a stop) rather than the softer symmetric
  `ease`. Confirm the total duration is unchanged (~600ms at 100%).
- **Done when**: the reveal uses `var(--ease-out)`, both tokens resolve (no
  literal `ease` left on the reveal), and the gate passes.
