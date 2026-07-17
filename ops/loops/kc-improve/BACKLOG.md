# kc-improve — backlog & log

The fuel for the improvement loop. Groom this at the start of each cycle; pick
ONE item (highest value ÷ effort, not blocked on an owner decision), build it,
verify, present for accept. Log outcomes at the bottom.

Legend: **P** = priority (1 high → 3 low) · **E** = effort (S/M/L) ·
🔒 = blocked on an owner decision.

## From deep review 2026-07-16 (verified — see docs/REVIEW-2026-07-16.md)
Safe UX quick-wins (one kc-improve cycle, no money risk, offline-verifiable):
- [x] **P1 · S** — Toasts need a live region — DONE (fba63c4, B1+B10).
- [x] **P1 · S** — Booking status badges don't flip for dark theme — DONE (82d09fc, B2).
- [x] **P2 · S** — `user-select:none` blocks copying phone/IMEI/ref — DONE (097aa56, B3).
- [x] **P2 · S** — Two-column forms don't collapse on mobile — DONE (097aa56, B4).
- [ ] **P2 · M** — Unify the Rentals filter chrome into `kcFilterSort`
      (`main.js:1197-1242`) — it's the one tab that predates the shared control.
- [x] **P2 · L** — Keyboard-operate clickable rows + drill-downs — DONE (9fb80d7, B6).
- [x] **P2 · M** — Modal dialog semantics + focus trap — DONE (b4150a0, B7).

Correctness (human-reviewed, NOT loop-autofixed — touches money/inventory):
- [ ] **P1 · S** — Shop oversell: guarded/atomic stock decrement
      (`shop.js:149,195`) — two tills can both sell the last unit. **Real bug.**
- [ ] **P2 · S** — Cash-up/revenue day uses UTC not `Europe/London`
      (`cashup.js`,`ledger.js`) — BST 00:00-01:00 misattributed. Reuse the
      London-day helper the sweep already has.
- [ ] **P3 · S** — Customer `legacy_id = Date.now()` ms-collision
      (`customers.js:24`) — add a random suffix.

## From competitive research 2026-07-17 (big-tech / premium idea-hunt)
Scouted live product/help pages (Linear, Stripe, Square, Loyverse, Booqable,
RepairShopr/RepairDesk, Airalo/Holafly, Superhuman, Goodshuffle). Full sourced
table + URLs archived in `docs/IDEAS-2026-07-17.md`. **Safe = offline-verifiable,
no money/auth surface → eligible for the autonomous loop.** ⚠ = touches money/
consent/comms → human-in-the-loop only.

Safe (loop-eligible), ranked value ÷ effort:
- [ ] **P1 · S** — **Undo toast** on destructive actions (delete/void/status): 5–8s
      "Undone" revert instead of a confirm dialog. (Superhuman/Linear pattern.)
- [ ] **P1 · S** — **Shift+? shortcuts overlay** — context-aware cheat-sheet of the
      active keys; pairs with ⌘K. (Linear.)
- [ ] **P1 · S** — **Park/hold an open till sale** — suspend a named basket, resume
      later without losing it. (Loyverse.)
- [ ] **P1 · S** — **Maintenance/downtime block** on a phone/IMEI — removed from
      availability until cleared. (Booqable.)
- [ ] **P2 · S** — **Pinned + recently-visited** quick-nav in the top bar. (Stripe.)
- [ ] **P2 · S** — **Low-stock threshold** per accessory SKU → dashboard badge +
      list filter. (Loyverse.)
- [ ] **P2 · S** — **Quick-create keys** in ⌘K (type P → payment, etc.). (Stripe.)
- [ ] **P1 · M** — **Availability conflict detection** — warn before double-booking a
      specific unit across overlapping dates. (Booqable.) *(server guard exists for
      bookings; extend to rental units.)*
- [ ] **P1 · M** — **Barcode/QR check-out ↔ return** — one scan flips rental status.
      (Booqable.) *(reuses the existing IMEI scanner.)*
- [ ] **P1 · M** — **Saved views** — named filters per module (overdue rentals,
      unpaid statements, SIMs expiring 7d). (Linear.)
- [ ] **P2 · M** — **Per-SIM usage bar** (data left / days / expiry) in the portal.
      (Airalo.) *(display-only; the data feed is the work.)*
- [ ] **P2 · M** — **Customer-360 detail page** w/ an activity-log tab. (Stripe.)
- [ ] **P2 · M** — **⌘K acts on the current selection** (verbs, not just nav). (Linear.)
- [ ] **P3 · M** — **NL snooze** ("remind me tomorrow 9am") on bookings/customers.

⚠ Money / consent / comms — human-reviewed, NOT loop-autofixed:
- [ ] **P1 · M** ⚠ — **Idempotency key on every charge/ledger write** (client-generated)
      so retries/double-clicks can't double-charge. (Stripe.) *Highest-leverage
      safety pattern; overlaps review A2. Do with owner.*
- [ ] **P2 · M** ⚠ — **Wallet balance as a tender** at the till (store credit). (Square.)
- [ ] **P2 · S** ⚠ — **Cash pay-in/pay-out log** + **Z-report variance** (expected vs
      counted) at shift close. (Loyverse.) *internal cash reconciliation.*
- [ ] **P2 · M** ⚠ — **Status-change auto-SMS** ("ready for collection", "conversion
      done") + **reply-to-approve**. (RepairShopr.) *gated on the email/SMS decision.*
- [ ] **P2 · S** ⚠ — **Non-refundable damage waiver** (~5% line) as a deposit
      alternative. (Goodshuffle.) *customer charge.*
- [ ] **P3 · L** ⚠ — **Offline sale queue** + unsynced badge, auto-sync on reconnect.
      (Loyverse.) *money persistence — careful design.*

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
- [ ] **P1 · M** 🔒 — **Production DB** `Kc-production` is now `ACTIVE_HEALTHY`
      (2026-07-16, confirmed). BUT its migration ledger records only **1**
      migration (`20260514103821`) vs staging's **40** — a full history
      reconcile is needed (confirm actual schema, then mark migrations applied
      without re-running). Careful one-shot job; do with owner, don't auto-run.
- [ ] **P1 · S** — **Vercel auto-deploy stalled** after `11630e2` — pushes aren't
      building; unblock the GitHub→Vercel integration (or Redeploy from dashboard).

## Log (append: date · item · gate · accepted?)
| date | item | gate | accepted? |
|------|------|------|-----------|
| _seed_ | backlog created from PHASE-2-NOTES + session threads | n/a | n/a |
| 07-17 | B1+B10 toast live region + errors persist (fba63c4) | ✅ 32/32 ×2 + build | owner live-test pending |
| 07-17 | B2 booking badges dark-theme flip (82d09fc) | ✅ + harness L/D | owner live-test pending |
| 07-17 | B3+B4 selectable data cells + mobile form collapse (097aa56) | ✅ | owner live-test pending |
| 07-17 | B6 keyboard-operable rows (9fb80d7) | ✅ + harness (Enter/Space) | owner live-test pending |
| 07-17 | B7 modal role=dialog + focus trap (b4150a0) | ✅ | owner live-test pending |
| 07-17 | discover: big-tech idea-hunt → 30 ideas (02def6a) | n/a (research) | folded to backlog |
