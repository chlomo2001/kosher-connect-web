# kc-improve — backlog & log

The fuel for the improvement loop. Groom this at the start of each cycle; pick
ONE item (highest value ÷ effort, not blocked on an owner decision), build it,
verify, present for accept. Log outcomes at the bottom.

Legend: **P** = priority (1 high → 3 low) · **E** = effort (S/M/L) ·
🔒 = blocked on an owner decision.

## UX / smoothness / delight
- [ ] **P1 · S** — Owner live-test pass on this session's work (dark theme retune,
      login backdrop, dashboard clock+charts, dotted cards, ⌘K quick-actions,
      floating timer). All offline-verified; needs the real-browser sign-off.
- [ ] **P2 · M** — Dashboard metric-card **sparklines** (needs a trend data
      source — 30-day series per metric). Design the lightweight data feed first.
- [ ] **P2 · S** — ⌘K as the one global search + "Start timer" now in it; confirm
      it feels like the everywhere-search on the owner's machine, tune ranking.
- [ ] **P3 · S** — Optional: warm the sidebar navy a touch if it reads monotone
      next to the ivory (owner to judge live).
- [ ] **P3 · S** — Optional analog+pulse clock variant to compare vs the digital.

## Integrations
- [ ] **P1 · M** 🔒 — **Email delivery** go-live (Track A below) — provider + domain
      decision, `email_log` table, HOLD→TEST→LIVE. Unblocks receipts + portal
      sign-in + reminders. *DNS has lead time — decide first.*
- [ ] **P2 · L** 🔒 — **myPOS K300 ↔ till** one-tap (native wrapper). Long pole =
      myPOS developer-programme access; web-side plumbing can be stubbed now.
- [ ] **P2 · L** 🔒 — **Stripe** save-card + off-session charge + webhook (test keys
      first). Least urgent of the three; card-present already works.
- [ ] **P2 · S** — **Phone-migration job logging**: "Contact transfer / phone
      setup" service line + attach exported `.vcf` to the customer + a Settings
      "Contact Tools" reference card. (Suggestions already written; build them.)
- [ ] **P3 · S** 🔒 — **Gmail / Drive scan** — needs explicit owner go-ahead +
      scope (which accounts, read-only, what we're hunting) before any sweep.

## New business line
- [ ] **P1 · L** 🔒 — **Kol Torah CD module** — needs a 20-min scoping answer:
      titles catalogue? per-shul stock/consignment? CD→MP3/SD conversion jobs?
      takings per shul? payments? Then scope → build.

## Ops / go-live blockers (not features, but gate Phase-2 shipping)
- [ ] **P1 · S** — **Apply pending migrations on deploy**: `20260716140000`
      (ivr_platforms) and `20260715160000` (customer documents).
- [ ] **P1 · M** — **Production DB** `Kc-production` was RESTORE_FAILED — get it
      healthy, then apply migrations + reconcile history.
- [ ] **P1 · S** — **Vercel auto-deploy stalled** after `11630e2` — pushes aren't
      building; unblock the GitHub→Vercel integration (or Redeploy from dashboard).

## Log (append: date · item · gate · accepted?)
| date | item | gate | accepted? |
|------|------|------|-----------|
| _seed_ | backlog created from PHASE-2-NOTES + session threads | n/a | n/a |
