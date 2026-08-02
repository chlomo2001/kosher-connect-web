# 003 — Gate the button hover-lift behind a real pointer

- **Status**: TODO
- **Commit**: c54b10d
- **Severity**: LOW
- **Category**: Accessibility (false hover on touch)
- **Estimated scope**: 1 file (`pages/welcome.js`), CSS only

## Problem

The primary button lift is not gated behind a hover-capable pointer:

```css
/* pages/welcome.js:742 — current */
.sk-btn:hover{transform:translateY(-1px)}
```

On a touch device a tap fires a synthetic `:hover`, so the button lurches up 1px
on every press and the lift can "stick" until the next tap elsewhere. On the
counter tablet and on customers' phones — the majority of this page's traffic —
that reads as a glitch, not feedback.

## Target

Scope the hover lift to devices that actually have a fine, hovering pointer, per
the playbook:

```css
/* target — pages/welcome.js:742 */
@media (hover:hover) and (pointer:fine){
  .sk-btn:hover{transform:translateY(-1px)}
}
```

The existing press/disabled rules stay as they are — only the `:hover` rule moves
inside the media query. If you want tactile feedback on touch too, the button
already transitions `transform` (`pages/welcome.js:740`); an `:active` press is
optional and out of scope for this plan.

## Repo conventions to follow

- Media queries are written inline in `SKY_CSS`, e.g. the reduced-motion block at
  `pages/welcome.js:917` and the responsive breakpoints near
  `pages/welcome.js:923`. Add this one in the same style, adjacent to the
  `.sk-btn` rules.

## Steps

1. At `pages/welcome.js:742`, wrap the `.sk-btn:hover` rule in
   `@media (hover:hover) and (pointer:fine){ ... }` exactly as in **Target**.
2. Leave `.sk-btn` (`:740`), `.sk-btn:disabled` (`:743`), and the button colour
   variants untouched.

## Boundaries

- Do NOT change the transform value or the transition.
- Do NOT touch any other `:hover` rule in this pass unless it also applies
  movement (this plan is scoped to `.sk-btn`).
- If `.sk-btn:hover` no longer matches (drift since c54b10d), STOP and report.

## Verification

- **Mechanical**: `bash ops/loops/green-keeper/gate.sh` prints
  `GATE: PASS — branch is shippable.`
- **Feel check**: in DevTools, emulate a touch device (coarse pointer) and
  confirm tapping a button no longer nudges it up or leaves it lifted. On a
  desktop (fine pointer), confirm the -1px hover lift still happens.
- **Done when**: the lift is gone under coarse pointer, present under fine
  pointer, and the gate passes.
