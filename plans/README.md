# Animation plans — /welcome and public surface

Produced by the `improve-animations` audit on commit `c54b10d` (2 Aug 2026).

**Scope note.** The current `/welcome` is the Sky telecom redesign (task #141).
The heavy motion from the earlier design — services ticker, self-drawing hairline,
logo cursor orb — is **no longer on the page**. The wireframe-globe parallax now
lives only in `components/AuthBackdrop.js`, used on `/login`, `/portal`,
`/phone-guide` and `/auth/google` (not `/welcome`), and it audits clean:
reduced-motion draws a single static frame with no rAF loop or listeners, the
loop pauses while the tab is hidden, and resizes are coalesced to one per frame.
So the live motion surface is small, and these three plans cover it.

| # | Title | Severity | Status |
| --- | --- | --- | --- |
| 001 | Make the scroll-reveal additive (no blank page without JS) | HIGH | TODO |
| 002 | Motion tokens + strong ease-out for the reveal | MEDIUM | TODO |
| 003 | Gate the button hover-lift behind a real pointer | LOW | TODO |

## Recommended order

1. **001** first — it's the only correctness issue (page unreadable if JS fails)
   and it rewrites the `.sk-reveal` rule that 002 also edits.
2. **002** second — it changes the easing on the same `.sk-reveal` transition, so
   apply it on top of 001's `.js-on`-scoped selector.
3. **003** any time — independent, touches only `.sk-btn:hover`.

All three are `pages/welcome.js` CSS/JS only, no new dependencies, and each is
verified by `bash ops/loops/green-keeper/gate.sh` plus the feel-check in the plan.

## Not turned into plans (verified acceptable)

- **AuthBackdrop globe rotation/twinkle** — constant motion on an occasional-view
  brand backdrop, reduced-motion handled. By design.
- **Smooth scroll** (`pages/welcome.js:666`) — already gated on
  `prefers-reduced-motion: no-preference`.
- **`.sk-paid` success banner and contact-form success swap** — candidate *missed
  opportunities* (a brief fade would soften each state change), noted in the audit
  but additive, not corrective. Raise as backlog if wanted.
- **Dead parallax branch** — AuthBackdrop's `welcome-shell` scroll-parallax
  (`components/AuthBackdrop.js:99`) never activates now that `/welcome` doesn't use
  the backdrop. Harmless; clean up opportunistically, not a motion fix.
