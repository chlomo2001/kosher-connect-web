# 001 — Make the scroll-reveal additive so /welcome is never blank without JS

- **Status**: DONE (e371932, 2 Aug 2026)
- **Commit**: c54b10d
- **Severity**: HIGH
- **Category**: Interruptibility / Accessibility (entry without JS)
- **Estimated scope**: 1 file (`pages/welcome.js`), ~4 small edits

## Problem

Every section below the hero on `/welcome` starts fully transparent and is only
revealed when an `IntersectionObserver` adds the `.in` class. If JavaScript is
disabled, blocked, slow, or throws before that effect runs, the entire page
below the hero stays permanently invisible. The reveal is currently subtractive
(content hidden by default, JS required to show it) when it should be additive
(content shown by default, JS only enhances the entrance).

```css
/* pages/welcome.js:915 — current */
.sk-reveal{opacity:0;transform:translateY(16px);transition:opacity .6s ease,transform .6s ease}
.sk-reveal.in{opacity:1;transform:none}
```

```jsx
// pages/welcome.js:320-327 — current: the ONLY thing that makes content visible
useEffect(() => {
  const els = document.querySelectorAll('.sk-reveal:not(.in)')
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target) } })
  }, { threshold: 0.12 })
  els.forEach((c) => obs.observe(c))
  return () => obs.disconnect()
}, [lang])
```

Note the reduced-motion branch (`pages/welcome.js:917`) already forces
`opacity:1`, which proves the visible state is the correct default — the no-JS
case simply was not covered.

## Target

Gate the hidden initial state on a `js-on` marker that only exists once React has
mounted. With no JS the marker is never added, so `.sk-reveal` keeps its natural
`opacity:1` and the page is fully readable; with JS the marker flips the sections
to hidden a frame before the observer reveals them on scroll.

```css
/* target — pages/welcome.js SKY_CSS */
/* Additive reveal: visible by default (no-JS reads the whole page); only
   hidden once JS has marked the root, then revealed on scroll. */
.sk-reveal{transition:opacity .6s ease,transform .6s ease}
.js-on .sk-reveal:not(.in){opacity:0;transform:translateY(16px)}
.sk-reveal.in{opacity:1;transform:none}
```

```jsx
// target — add near the top of the existing reveal useEffect (pages/welcome.js:320)
useEffect(() => {
  const root = document.querySelector('.sk')
  if (root) root.classList.add('js-on')
  const els = document.querySelectorAll('.sk-reveal:not(.in)')
  // ...rest unchanged...
}, [lang])
```

The reduced-motion rule at `pages/welcome.js:917` stays exactly as is; with the
new selector it keeps winning because it sets `opacity:1;transform:none`.

## Repo conventions to follow

- All `/welcome` CSS is one template string, `SKY_CSS`, injected via
  `<style dangerouslySetInnerHTML>`. Edit the rule in place; do not add a new
  `<style>` block or an external stylesheet.
- The page root element is `<div className="sk" ...>` (`pages/welcome.js:372`).
  It already carries `dir`/`lang`; adding a class in the effect is consistent
  with how `pick()` and the scrollspy already mutate DOM classes.
- Reduced motion is expressed as `@media (prefers-reduced-motion:reduce)` blocks
  in `SKY_CSS` (exemplar: `pages/welcome.js:917`). Do not introduce a JS
  `matchMedia` branch for this.

## Steps

1. In `SKY_CSS`, replace the `.sk-reveal` rule at `pages/welcome.js:915` so the
   hidden state is scoped under `.js-on` exactly as shown in **Target**. Leave
   `.sk-reveal.in` and the `@media (prefers-reduced-motion:reduce)` rule
   (`:917`) untouched.
2. In the reveal `useEffect` (`pages/welcome.js:320`), add the two lines that
   look up `.sk` and add the `js-on` class, before the
   `querySelectorAll('.sk-reveal:not(.in)')` line.
3. Do not change the observer, its threshold, its cleanup, or the `[lang]`
   dependency.

## Boundaries

- Do NOT touch `components/AuthBackdrop.js` or any other page.
- Do NOT change any markup/structure beyond adding the `js-on` class at runtime.
- Do NOT add dependencies.
- If the `.sk-reveal` rule or the reveal effect no longer matches the excerpts
  above (drift since commit c54b10d), STOP and report.

## Verification

- **Mechanical**: `bash ops/loops/green-keeper/gate.sh` prints
  `GATE: PASS — branch is shippable.` (runs `npm test` twice + production build).
- **No-JS check** (the whole point): build and serve
  (`npx next build && PORT=3111 npx next start`), then render with JS disabled —
  `node ops/harness/public.mjs` uses Playwright; add a throwaway check with
  `javaScriptEnabled:false` in a Playwright page pointed at
  `http://127.0.0.1:3111/welcome`, and confirm the footer text
  ("© 2026 Kosher Connect") is present and `opacity` on a `.sk-reveal` element
  computes to `1`. Remove the throwaway script afterward.
- **Feel check**: with JS on, scroll `/welcome` top to bottom and confirm each
  section still fades+rises once as it enters (the enhancement still works).
  Toggle `prefers-reduced-motion: reduce` (DevTools Rendering) and confirm every
  section is visible immediately with no movement.
- **Done when**: no-JS render shows all sections at `opacity:1`, JS-on render
  still animates the reveal, and the gate passes.
