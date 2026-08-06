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
- [x] **P2 · M** — Unify the Rentals filter chrome into `kcFilterSort` — DONE (4c9c225, B5).
- [x] **P2 · L** — Keyboard-operate clickable rows + drill-downs — DONE (9fb80d7, B6).
- [x] **P2 · M** — Modal dialog semantics + focus trap — DONE (b4150a0, B7).

Correctness (human-reviewed, NOT loop-autofixed — touches money/inventory):
- [x] **P1 · S** — Shop oversell: guarded/atomic stock decrement — **DONE**.
      Verified 08-06: `pages/api/shop.js:212` reserves stock atomically for every
      distinct item *before* posting anything, with a re-read guard at :244.
      Two tills can no longer both sell the last unit.
- [x] **P2 · S** — Cash-up/revenue day uses UTC not `Europe/London` — **already
      done**; the checkbox was stale. Verified 07-31: every day boundary in
      `pages/api/cashup.js` and `pages/api/ledger.js` goes through
      `lib/localDay.mjs` (`londonDate` / `londonDayBoundsUtc` /
      `londonDayStartUtc`), and no bare UTC date-slicing survives in either.
- [x] **P3 · S** — Customer `legacy_id = Date.now()` ms-collision
      (`customers.js:24`) — DONE (this cycle). The client had minted
      collision-safe ids since #45; the server POST never adopted it, so two
      customers created in the same millisecond meant one save lost the race
      against the unique index. Now `lib/uid.mjs`, shared, and the suffix
      widened 3→6 digits — 3 digits hits even-odds collision at ~37 rows in one
      millisecond, which a bulk import passes instantly.

## From competitive research 2026-07-17 (big-tech / premium idea-hunt)
Scouted live product/help pages (Linear, Stripe, Square, Loyverse, Booqable,
RepairShopr/RepairDesk, Airalo/Holafly, Superhuman, Goodshuffle). Full sourced
table + URLs archived in `docs/IDEAS-2026-07-17.md`. **Safe = offline-verifiable,
no money/auth surface → eligible for the autonomous loop.** ⚠ = touches money/
consent/comms → human-in-the-loop only.

Safe (loop-eligible), ranked value ÷ effort:
- [x] **P1 · S** — **Undo toast** on destructive actions (delete/void/status): 5–8s
      *Shipped 07-27 for phone-inventory + customer-document deletes; other
      delete paths can adopt `kcUndoable` one by one.*
      "Undone" revert instead of a confirm dialog. (Superhuman/Linear pattern.)
- [x] **P1 · S** — **Shift+? shortcuts overlay** — DONE (39de3ef). Cheat-sheet of the
      active keys; pairs with ⌘K. (Linear.)
- [x] **P1 · S** — **Park/hold an open till sale** — suspend a named basket, resume
      later without losing it. (Loyverse.) DONE — "⏸ Park sale" snapshots the
      basket + customer/method/paid to localStorage (`kc_parked_sales`, cap 20)
      and clears the till; a "⏸ Parked (N)" header button opens a popover to
      Resume or discard. Resuming auto-holds the current basket first (no loss).
      Strictly pre-charge — never touches saveSale/ledger/stock.
- [x] **P1 · S** — **Maintenance/downtime block** on a phone/IMEI — DONE (this cycle).
      Edit Phone gains a 🔧 checkbox + reason; hidden from New Rental + pool picks.
- [x] **P2 · S** — **Pinned + recently-visited** quick-nav. (Stripe.) DONE —
      recently-visited (167fd9c) + pinning (9261f40): 📌 on a Recent card pins it
      to a "Pinned" row; localStorage, nav-only, keyboard-operable.
- [x] **P2 · S** — **Low-stock threshold** per accessory SKU → dashboard badge +
      list filter. (Loyverse.) DONE — the Shop tab already had the editable
      per-SKU threshold (`lowStockAt`), banner, filter, sort + row highlight;
      this cycle added the missing **dashboard surface**: a 📦 low-stock line in
      "Needs attention" (rolled-up count + first 3 SKUs) that opens Shop.
- [x] **P2 · S** — **Quick-create keys** in ⌘K — DONE. Empty-search palette shows a
      1–9 badge on each Quick action; the digit fires it. (Stripe.)
- [x] **P1 · M** — **Availability conflict detection** — warn before double-booking a
      *Shipped 07-27: New Rental was already date-aware; added the missing
      inline pre-warn to Manage Rental date edits.*
      specific unit across overlapping dates. (Booqable.) *(server guard exists for
      bookings; extend to rental units.)*
- [x] **P1 · M** — **Barcode/QR check-out ↔ return** — DONE (this cycle). One box
      on Rentals; scan the IMEI and the app picks the direction — out comes
      back, free goes out. Never writes: a return opens Manage Rental with the
      Returned toggle flipped so the late fee and lost-item charges stay in
      front of a human. Logic in `lib/rentalScan.mjs` (13 tests) + mirror.
- [x] **P1 · M** — **Saved views** — named filters per module (overdue rentals,
      unpaid statements, SIMs expiring 7d). (Linear.) *Shipped 07-27.*
- [ ] **P3 · M** — **Per-SIM usage bar** in the portal — TRIMMED 08-05: the
      days-to-renewal half shipped (amber/red proximity line, 73eb17c); the
      data-left half needs a usage feed that does not exist. Revisit only if a
      provider usage source ever lands.
      (Airalo.) *(display-only; the data feed is the work.)*
- [x] **P2 · M** — **Customer-360 detail page** w/ an activity-log tab. (Stripe.)
      DONE 08-03 on owner's direct ask — `/customers/<id>` is a real,
      auth-gated, refresh-safe URL; Overview | Activity sub-tabs; card ⤢ and
      ⌘K "Open full profile" open it. Card stays the quick counter tool.
- [x] **P2 · M** — **⌘K acts on the current selection** (verbs, not just nav).
      (Linear.) DONE 08-03 (0034941) — with a customer card open the palette
      leads with a "For <name>" row of six card verbs and a typed search
      matches them first (⌘K "pay" ↵ takes that customer's payment). The old
      one-off "Payment / top-up for open customer" command is superseded.
- [x] **P3 · M** — **NL snooze** ("remind me tomorrow 9am") on bookings/customers.
      *Shipped 07-27 (date-level) for the task snooze picker via `kcParseWhen`;
      time-of-day + the ⏰ remind modal can adopt the parser later.*

⚠ Money / consent / comms — human-reviewed, NOT loop-autofixed:
- [x] **P1 · M** ⚠ — **Idempotency key on every charge/ledger write** — **DONE**.
      Verified 08-06: `idempotency_keys` table live in production (holding rows),
      and the key is threaded through `ledger.js`, `charge-card.js`,
      `refund-card.js`, `payment-link.js`, `bookings.js`, `service-orders.js`,
      `shop.js`, `bank.js`. Retries and double-clicks can't double-charge.
- [x] **P2 · M** ⚠ — **Wallet balance as a tender** at the till — **DONE**.
      Verified 08-06: `posWallet` in `public/main.js:9390` carries the wallet
      portion of a split tender.
- [x] **P2 · S** ⚠ — **Cash pay-in/pay-out log** + **Z-report variance** — **DONE**.
      Verified 08-06: `pages/api/cashup.js` computes `expectedCash` via
      `lib/money.mjs` and reports `variance` (counted − expected) at shift close.
- [ ] **P2 · M** ⚠ — **Status-change auto-SMS** ("ready for collection", "conversion
      done") + **reply-to-approve**. (RepairShopr.) **Drafts BUILT 08-04** and
      HOLD-gated — they generate but never send. Genuinely open only in the sense
      that the send is off; unblocks with the email/SMS go-live decision below.
- [x] **P2 · S** ⚠ — ~~Non-refundable damage waiver~~ — built 17 Jul, then **REMOVED
      by owner decision 20 Jul** (never confirmed; damage-charges schedule covers it).
      **Do not rebuild.**
- [ ] **P3 · L** ⚠ — **Offline sale queue** + unsynced badge, auto-sync on reconnect.
      (Loyverse.) *money persistence — careful design.*

## UX / smoothness / delight
- [ ] **P1 · L** — **"Google-feel" polish (owner ask 08-03**, after "why does
      business.google.com feel so much nicer/richer/smoother?"). Owner wants
      the **first three** of the four gaps. **Session 1 shipped 08-04**
      (see log): motion spec + type-ramp tokens + `docs/DESIGN.md` as the
      contract; tab/profile cross-fade; skeletons on the eight spinner tabs;
      modal entrances; first ramp-adoption sweep (all 15 half-step sizes) +
      toast tokens + last `transition: all` retired. **Remaining for
      sessions 2–3** (adoption, per DESIGN.md's ledger):
      1. Type-ramp sweep of the ~455 remaining inline `font-size`s in
         main.js, surface by surface (eyeball each in the harness).
      2. Inline-style spacing/colour micro-decisions into tokens/classes.
      3. Odd paddings onto the 4/8/12/16/24 spacing grid.
      4. Considered + parked: customer-search dropdown enter animation —
         it re-renders per keystroke, so a naive animation would flicker;
         needs a first-open-only guard and a live feel-check.
      **Owner feel-check first**: transitions/skeletons/modal enters are
      offline-verified but feel is judged live — tune durations with the
      owner before sweeping further.
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
- [ ] **P1 · S** 🔒 — **Email un-hold** — Resend is ALREADY fully configured
      (verified /api/health 08-04: provider resend, mode TEST — everything
      redirects to the test inbox; Twilio SMS same state). Owner rule: stays
      test until Shloime officially starts on the app; then remove
      MAIL_TEST_TO + set MAIL_LIVE=true (docs/EMAIL-GO-LIVE.md). End-of-week
      Shloime session (tablet ~Thu 08-06): Twilio number verification, fresh
      Stripe `rk_live` into Vercel (health shows live-pk/test-sk mismatch),
      Wizz per-PNR receipt confirmations (ZMKWJP settled 08-04 — husband;
      refund legs post only against confirmed receipts).
- [ ] **P3 · done-but-dark** — **myPOS ↔ till** one-tap. **BUILT 08-04 and
      PARKED by owner decision 08-04** ("we wait and work manually with the
      current K300"). Facts that closed it: K300 will never do ePOS
      (support, ticket 4235846); Glass/SoftPOS is SDK-only, not
      ePOS-addressable, so the NFC tablet can't be till-triggered; Sigma is
      a kiosk device — the realistic buy was Carbon ~£174–250 or Ultra
      £229, not worth it at current card volume. The full cloud lane is
      merged and ships dark (env-gated on `MYPOS_EPOS_MODE`+credentials,
      205-test gate, mock verified). To wake it later: buy Carbon/Ultra →
      Partners Portal integration (POS Payments / Cash Register, has an
      approval step) → 3 keys + TID into Vercel env. No code work left.
- [ ] **P2 · L** 🔒 — **Stripe** save-card + off-session charge + webhook (test keys
      first). Least urgent of the three; card-present already works.
- [x] **P2 · S** — **Phone-migration job logging** — **DONE**. Verified 08-06:
      the Settings "Contact Tools" reference card is live (`public/main.js:12824`)
      as the phone-migration workbench SOP.
- [x] **P2 · M** — **Public repair-booking page** — **DONE and SHIPPED**.
      Verified 08-06: `pages/repair.js` exists and is live on production; staff
      sign-in was demoted from the welcome page in the same round.
- [ ] **P3 · S** 🔒 — **Gmail / Drive scan** — needs explicit owner go-ahead +
      scope (which accounts, read-only, what we're hunting) before any sweep.

## Local presence (Google Business Profile)
**VERIFIED 08-03** (owner screenshot: blue tick on "Kosher Connect, 421 Bury New
Rd, Salford M7 4DE" in the Business Profile manager). The shop now controls its
own card on Google Search + Maps — this is what the welcome page's Maps embed
was waiting on (see the `MAPS_QUERY` comment in `pages/welcome.js`: the card
only carries our name once a profile exists).
- [ ] **P1 · S** 🔒 — **Fill the profile in** (owner, ~20 min, in the GBP manager):
      opening hours (Su–Th 14:00–18:30 — keep in step with the `opening_hours`
      settings key), website `https://www.kosher-connect.com/`, phone
      0161 531 1386, category (mobile phone shop), the "left of Toy Zone, MMR
      Group building, ring bell 5" arrival note, and 3–5 real photos (shopfront,
      counter, rental phones). Profiles with photos + hours rank far better in
      "phone shop near me".
- [x] **P2 · S** — **Point the JSON-LD at the profile** — DONE 08-03 (b154bba).
      `hasMap` + `sameAs` on the `LocalBusiness` schema: the card's permanent
      Maps cid (decimal of 0xd095f9388a46f473, from the owner's place URL)
      plus the owner's share.google link.
- [ ] **P2 · S** 🔒 — **Reviews habit**: the profile's review link —
      `https://g.page/r/CXP0Roo4-ZXQEAI/review` (owner, 08-03) — on
      receipts/emails ("Happy with the service? Leave us a review"). Gated
      on the email decision; the ask-text can be drafted any time.
- [ ] **P3 · S** — **Map tile says "Hatsluche"** while the panel says Kosher
      Connect (owner screenshot 08-03): the tile label likely comes from an
      old auto-created record (Companies House name). Expected to self-heal
      within days of verification; if a separate Hatsluche pin survives a
      week, report it as a duplicate from its "Suggest an edit".
- [ ] **P3 · S** — GBP "products/services" entries mirroring the welcome page's
      services list (rentals, SIM plans, virtual numbers, repairs, Kol Torah).

## Suppliers & stock (owner ask 08-03 — "the business must track this all")
The buy side is invisible today: stock arrives from wholesalers, some of it is
defective and sits in a bag waiting to go back ("a few hundred quid of phones
to return to the sender"), and nothing in the app knows. Shop tab tracks
sell-side quantities only.
- [x] **P1 · M** — **v1: Suppliers + returns (RMA)** — a `suppliers` list
      (name, contact, notes); a **supplier return** record: supplier, items
      (free text or linked SKU/IMEI), claimed value £, status
      `awaiting-send → sent → credited / replaced / written-off`, dates,
      notes. Surfaces: a "Returns" card in Shop, a dashboard needs-attention
      line while anything sits in `awaiting-send`/`sent` (that bag stops
      being invisible). Migration + API + UI; no money posting in v1 — value
      is a claim, not a ledger entry, until the credit actually arrives.
- [x] **P2 · M** 🔒 — **v2: goods-in (purchases)** — record deliveries
      (supplier, date, lines → increments stock quantities, cost prices) so
      stock levels come from arrivals, not hand edits — and margin per SKU
      becomes knowable. *Owner approved the lightweight-AP middle path 08-03
      ("they don't have a book yet" — so this is the primary record): goods-in
      carries invoice ref/total + paid/unpaid, credited returns offset it,
      per-supplier running balance in the Shop tab. Deliberately no aging
      reports or bank reconciliation — revisit only if the owner asks for
      full AP once real books exist.*

## New business line
- [ ] **P1 · L** 🔒 — **Kol Torah CD module** — needs a 20-min scoping answer:
      titles catalogue? per-shul stock/consignment? CD→MP3/SD conversion jobs?
      takings per shul? payments? Then scope → build.

## Bank reconciliation (open banking)
Read-only half built and shipped 07-31 — `docs/OPEN-BANKING.md` for the
reasoning. A bank feed is a **reconciliation source, not a posting source**:
transactions land raw, a matcher proposes, a human confirms. `shouldAutoPost()`
returns false unconditionally and is tested, so removing that guard has to be
deliberate.
- [ ] **P1 · S** 🔒 — **Open a business bank account.** The blocker, and it is
      not technical. The shop's money runs through Shloime's personal account
      (owner, 07-31), so a live feed would pull his personal transactions into
      KC's database — a privacy problem no filtering fixes, because the
      filtering happens after the data is stored. **Do not connect a feed until
      the shop has its own account.**
- [x] **Statement upload + triage UI — BUILT 08-04 (owner-directed loop,
      c3f1d36).** Wallet → "Bank statements" (owner-only): upload a CSV under
      an account label (multiple accounts = multiple labels — owner: "maybe he
      has more than 1"), `/api/bank` proposes matches with reasons +
      confidence bands, a person confirms each one (posts an idempotent
      bank_transfer payment), undo posts the equal-and-opposite correction.
      Parser handles the real Revolut Business export (completed dates, Payer,
      Reference, Fee netting, DECLINED/REVERTED dropped, bank ID as the
      idempotency key) and still rejects unknown shapes with a plain
      explanation.
- [x] **P2 · S** — **Apply `20260731180000_bank_transactions.sql`** — **DONE**.
      Verified 08-06: `bank_transactions` exists in production, so the route no
      longer answers 503 and the triage UI is lit.
- [ ] **P3 · M** — **Provider client** (GoCardless Bank Account Data — free UK
      account-information tier; you connect under their FCA licence, not your
      own). Budget for **90-day consent expiry**: someone re-authenticates
      quarterly, and it should be a named job. **Still blocked on
      credentials AND on the business-account item above — do not stub it
      live** (re-affirmed by owner-directed scope 08-04).

## Ops / go-live blockers (not features, but gate Phase-2 shipping)
- [x] **P1 · S** — **Apply pending migrations on deploy**: `20260716140000`
      (ivr_platforms) and `20260715160000` (customer documents) — **stale.**
      Both were already recorded on Kc-Live; verified 07-31.
- [x] **P1 · M** 🔒 — **Production DB migration reconcile** — **DONE 07-31, and
      the drift was far smaller than this note claimed.** The note described a
      project called `Kc-production` with 1 migration (`20260514103821`) against
      staging's 40. That project no longer exists under that name: it became
      **`Kc-staging`** (`rcpqgujtutvpfzfsgzql`) and the 50-migration chain was
      built on it — that was task §0, already done. `20260514103821` sits at the
      head of *staging's* ledger, not production's.

      Real production is **`Kc-Live`** (`xsrtdwwzxdmnjdtjcdzd`), as CLAUDE.md
      says, and it was never in that state: it held **56** of the repo's 57
      migrations, with **nothing recorded that the repo doesn't have**. The one
      genuine gap was `customers_passport_on_file`, and only in the *ledger* —
      the column was already on the table (boolean, not null, default false),
      added out-of-band. Its migration is `add column if not exists`, so
      applying it was a no-op against the schema and simply recorded the row.

      Reconciled and both refund migrations applied the same way. Production is
      now **59/59 by name, both directions empty**. Note the recorded *versions*
      differ from repo filenames throughout (`apply_migration` stamps its own
      timestamp) — the ledger aligns by name, which is what the diff checks.
- [x] **P1 · S** — **Vercel auto-deploy stalled** after `11630e2` — **stale, not a
      fault.** Checked 07-31 against the Vercel API: the GitHub integration is
      healthy and has never stopped. Every push to the dev branch since 30 Jul
      built green (14 consecutive previews, `55f6832` → `bfdbc22`, all READY),
      and `11630e2` is an ancestor of `main`, well behind the deploys that
      followed it. Production last built `84ef4f2` on 30 Jul 22:32 — which *is*
      `origin/main`'s HEAD, so production is exactly up to date with main. The
      appearance of a stall was the dev branch running 14 commits ahead of a
      `main` nothing had been merged into: previews were building all along,
      production simply had nothing new to build. Nothing to unblock; shipping
      is an `--ff-only` merge away, on the owner's word.

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
| 07-17 | Shift+? keyboard shortcuts overlay (39de3ef) | ✅ + harness L/D | owner live-test pending |
| 07-17 | A1 atomic stock decrement (9293730) | ✅ + SQL guard proof | **owner live-till test wanted** |
| 07-17 | Idempotency claim keys (63b1b10) | ✅ | owner live-till test wanted |
| 07-17 | Wallet as till tender + split (3ba6700) | ✅ | **owner live-till test wanted** |
| 07-17 | T&C loss fees + Charger merge (73162e5) | ✅ 38/38 | owner approved ("T&C wins") |
| 07-17 | secretbox restore for creds (6660dae) | ✅ round-trip tests | key handoff to owner |
| 07-17 | Shloime docs: Three enrich (62 aliases/33 ICCIDs/10 creds), 2 Wizz bookings, 5 USA phones, 11 intl bundles + PAYG settings | staging SQL, verified | audit in session log |
| 07-17 | Damage waiver line — settings `damage_waiver_pct` (5%), New Rental + Manage, folds into price like weekly VN; also fixed monthly-VN Manage re-add bug | ✅ 38/38 | BUSINESS_RULES §1.7 |
| 07-17 | Status SMS drafts per rental (✉️ on row) — lifecycle-aware text, copy + comm-log, HOLD stays (nothing sent) | ✅ 38/38 | templates in code for now |
| 07-21 | Maintenance block on rental phones — 🔧 checkbox+reason in Edit Phone; excluded from New Rental picker, pool suggestions, dashboard available count; badge in inventory + palette | ✅ 103/103 ×2 + build + function-level assert | owner live-test pending |
| 07-22 | ⌘K recently-viewed (167fd9c) — last 6 opened customers/phones/SIMs as tiles in the palette empty state; nav-only, localStorage, reuses quick-action styling | ✅ 113/113 ×2 + build + node --check | owner live-test pending |
| 07-23 | ⌘K pinned favourites (9261f40) — 📌 on a Recent card pins it to a "Pinned" row atop the palette; unpin from its 📌. localStorage (kc_pinned_nav, max 8), nav-only, keyboard-operable | ✅ 113/113 ×2 + build + node --check + offline palette harness L/D | owner live-test pending |

| 07-24 | ⌘K quick-create number keys — each empty-search Quick action shows a 1–9 badge; pressing that digit (search empty) fires it. Palette-scoped, no money surface, +shortcuts-overlay entry | ✅ 113/113 ×2 + build + node --check + offline palette harness L/D | owner live-test pending |

| 07-25 | Dashboard low-stock surface — 📦 line in "Needs attention" (count + first 3 low SKUs) via a cached `/api/shop` read in dashCache; reuses the Shop tab's `lowStockAt` predicate + the existing feed renderer, opens Shop on click. Display-only, no money surface | ✅ 113/113 ×2 + build + node --check + isolated logic assertions (empty/few/many + XSS-escape) | owner live-test pending |

| 07-27 | NL snooze dates — task snooze "pick" prompt now takes natural language via `kcParseWhen`: ISO, UK d/m (past → next year), today/tomorrow, Nd/Nw, next week/month, weekday names or 3-letter prefixes (always the NEXT one); bad input gets a helpful error toast instead of silently dropping | ✅ 113/113 ×2 + build + node --check + 15 parser assertions | owner live-test pending |
| 07-27 | Manage-Rental conflict pre-warn — changing mgFrom/mgTo runs `phoneConflicts` (excluding the rental itself) and shows an inline red role=alert box naming the clashing booking (dates + customer) before save; server overlap guard stays authoritative. New Rental already filtered its picker by dates — this closes the Manage gap | ✅ 113/113 ×2 + build + node --check + isolated overlap assertions (extension clashes, own-window clean) | owner live-test pending |
| 07-27 | Undo toast (Gmail pattern) — `kcUndoable({label,commit,restore})`: row disappears immediately, server delete held 6s behind an Undo toast; timeout/second-action/page-hide commits, Undo restores with nothing sent. Wired into phone-inventory delete (replaces confirm) + customer-document delete; one pending action at a time | ✅ 113/113 ×2 + build + node --check + isolated state-machine assertions (undo≠commit, single flush, second-action flush, double-flush no-op) | owner live-test pending |
| 07-27 | Saved views — "☆ Save view" beside every kcFilterSort bar snapshots the current filter/sort (incl. dimension bars) as a named chip; chips apply on click, highlight when active, × deletes. localStorage `kc_saved_views` (cap 6/tab), applies via the normal re-validation so stale presets fall back safely. All 9 list tabs get it for free | ✅ 113/113 ×2 + build + node --check + offline chip harness L/D | owner live-test pending |
| 07-26 | Park/hold an open till sale — "⏸ Park sale" holds the basket (+customer/method/paid) to localStorage (cap 20) & clears the till; "⏸ Parked (N)" header popover resumes/discards; resume auto-holds the current basket first (no loss). Strictly pre-charge — no saveSale/ledger/stock touch | ✅ 113/113 ×2 + build + node --check + isolated hold-queue state-machine assertions (no-loss resume, newest-first, 20-cap, unique ids, discard) | owner live-test pending |

| 07-28 | Portal loading skeleton — shimmering placeholder cards in the dashboard's own layout instead of a login-style "Loading…" card that jumps shapes; aria-busy, reduced-motion safe | ✅ 113/113 ×2 + build + harness shot | owner live-test pending |
| 07-28 | Welcome nav scrollspy + mobile section chips — sticky bar underlines the section in view; ≤960px gets a swipeable chip strip (the nav links used to vanish entirely on phones), scroll-margin retuned for the taller mobile header; nav CTA nudged clear of the theme toggle | ✅ 113/113 ×2 + build + harness (desktop spy #intl, chip tap lands at 122px, chip highlight) | owner live-test pending |
| 07-28 | Portal sign-in back link — the signed-out card was a dead end; muted localised link to /welcome under the form | ✅ 113/113 ×2 + build + harness | owner live-test pending |
| 07-28 | Join/phone-guide mobile readability — globe canvas fades to 30% under 640px so line-work stops running through body text | ✅ 113/113 ×2 + build + before/after shots | owner live-test pending |
| 07-29 | Portal RTL bidi (a1de3d5) — the KC- bank reference split/reordered across lines in Hebrew (unusable to copy into a banking app); now a bold unbreakable dir=ltr bdi. Statement/SIM/flight row titles bdi-isolated so English ledger text can't shuffle in RTL. Found via 8-variant harness shots of the new dashboard cards | ✅ 114/114 ×2 + build + harness EN/HE × L/D × desktop/mobile | owner live-test pending |
| 07-29 | Phone-guide EN/HE toggle (ac19805) — the last English-only public page; same kcLang pattern as /join, owner-written model content bdi-isolated for RTL | ✅ 114/114 ×2 + build | owner live-test pending |
| 07-29 | Join contact chips tokenised (59fa0c4) — .jn-chip class with hover + focus-visible ring (was inline-styled with no keyboard affordance) | ✅ 114/114 ×2 + build | owner live-test pending |
| 07-29 | Welcome travel-band price lines verified EN/HE × 390px/1160px after the price-truth correction — clean wrap, LRM-isolated amounts render correctly in RTL; no change needed | ✅ harness shots | n/a (verification) |
| 07-29 | A11y: aria-label on the icon-only 💬 WhatsApp link on the customer card; confirmed the global :focus-visible ring already covers the new SIM-badge buttons and WhatsApp buttons | ✅ 114/114 ×2 + build + node --check | owner live-test pending |

| 07-31 | Calendar states without colour (b126b09) — "out"/"reserved"/"overdue" were three fills and nothing else, and the cells were empty `<td>`s so the grid read as blank to a screen reader. Reserved gets a diagonal stripe, overdue a "!", both mirrored in the legend; per-cell aria-label (date + state + customer); phone becomes `<th scope="row">`, day headers `scope="col"` | ✅ 114/114 ×2 + build + node --check + harness L/D **and greyscale** (4 states visibly distinct without colour) | owner live-test pending |
| 07-31 | Customer-card stats wrap (6cbe1a0) — `.detail-stats` was a hard 3-col with a ~134px min per label, so on a 330px screen it needed 426px in a 306px card and pushed the modal into horizontal scroll. auto-fit/minmax(132px) instead of a media query, because the deciding width is the card's, not the screen's | ✅ 114/114 ×2 + build + measured at 4 card widths (330/390 wrap, no overflow; 520/760 unchanged 3-up) | owner live-test pending |
| 07-31 | Way out of a filtered-empty list (51fbebd) — `kcViewIsFiltered`/`kcViewReset` + a "↺ Clear filters" button in all 7 filtered empty states. Also fixed two lying messages: Rentals said "No rentals yet — click New Rental" and SIM plans "No SIM plans yet" regardless of how many were on file, which with 800+ SIMs behind a filter reads as data loss. Reset leaves sort alone on purpose | ✅ 114/114 ×2 + build + node --check + 8 isolated reset-logic assertions (dimension & flat tabs, unknown tab, sort survives) | owner live-test pending |
| 07-31 | Delete looks destructive at rest (020d2da) — in `.row-actions` Delete was the same size/weight/muted-grey as Details 8px away; hover was the only signal and hover comes after you've aimed. Now 16px clear with a standing red tint on label + border | ✅ 114/114 ×2 + build + contrast measured 5.50:1 light / 5.45:1 dark (AA) | owner live-test pending |
| 07-31 | Accessible names on 20 icon-only buttons (b8b763e) — calendar month arrows, every ✏️/✕ pair in Settings, the 💾 saves, delete-SIM-charge, delete-VN, and the till's −/+/✕. Labels carry the row's own subject ("Edit Nokia 105", "Delete reminder@…") so repeated rows are distinguishable; verified against the browser's computed AX name incl. a product name containing a quote | ✅ 114/114 ×2 + build + node --check + AX-name check | owner live-test pending |

| 07-31 | Form controls get a programmatic name (8a186a0) — the `.form-group`-level fix the earlier finding asked for, not hand edits. One pass, on load and on every subtree the app inserts, binding in four steps of decreasing confidence: the group's own `<label>` → real `for=`/`id`; a `.section-divider` heading a group → `aria-labelledby`; a control in a table cell → its column header, walking colspan; a bare control → its placeholder, or a select's prompt option. Stops at authored text — a first option that is just the default value ("Normal") is left unnamed rather than given a misleading name | ✅ 140/140 ×2 + build + node --check + 16 fixture assertions (incl. the must-not-touch cases: label already `for=`, label wrapping its own checkbox, author's own aria-label, idempotency, observer path) + corpus re-count 202→34 of 231 | owner live-test pending |

| 07-31 | Scan to check out / take back (b84233a) — one box on Rentals: scan the handset's IMEI and the app picks the direction (out → back, free → out), matching IMEI first then the number on its last 10 digits. Never writes — a return opens Manage Rental with Returned pre-flipped and a "check the charges" line, so the late fee and lost-item charges still face a human before Save; a check-out preselects the phone only if the date-filtered picker offers it. An open rental beats a maintenance hold (the customer is standing there with it) | ✅ 153/153 ×2 + build + node --check + 13 module tests + mirror-parity across 17 inputs | owner live-test pending |
| 07-31 | Collision-safe customer ids — `pages/api/customers.js` minted `legacy_id` from bare `Date.now()`, so two customers created in the same millisecond raced the unique index and one save was lost. Now shared `lib/uid.mjs`, suffix widened 3→6 digits (3 collides at even odds by ~37 rows in a millisecond) | ✅ 153/153 ×2 + build + 6 uid tests + mirror-parity | owner live-test pending |

| 08-01 | Form fields overhung the modal on a phone (b81124a) — `.form-grid`'s bare `1fr` is `minmax(auto,1fr)`, and that `auto` floored the column at its min-content width (a 130px dial-code select + an input at its intrinsic ~226px = 364px). Inside a 95vw modal that overhangs: 23px of sideways scroll at 390px, 80px at 360px, right edge of every field clipped. `minmax(0,1fr)` + `min-width:0` on group/input/phone-row. The 560px one-column collapse had looked like it already solved this | ✅ 195/195 ×2 + build + measured 320/360/390/430 (scrollWidth == clientWidth, was 392 vs 369) and 600/1280 unchanged at `224px 224px` | owner live-test pending |
| 08-01 | Badge colour that could not flip for dark (2f24b0a) — B2 gave the booking badges a dark override in July; five families written inline afterwards never got one. Measured from composited pixels: repair "Open"/task "Normal" **1.39:1**, travel chips 2.32:1, Kol Torah open 2.65:1, travel cover note 3.43:1 — and the cream Reserved/Returned/In-Progress pair missed AA in **light** at 3.97:1, which nobody had checked. All repointed at tokens; two greens needed a new `--success-ink` (`--success` is tuned for a plain card and drops to 4.28:1 on a green wash — the problem `.badge-active` solved for itself in U16). The reload banner is the same bug inverted: white on `var(--danger)` is 4.80:1 light but 2.92:1 dark, so it takes a `--danger-solid` that is deliberately not overridden | ✅ 195/195 ×2 + build + node --check + 22 in-browser contrast measurements across both themes, worst now 4.62:1 + `test/themeTokens.test.mjs` (3 tests, carries the 3 strings that actually shipped so the guard is shown to fail on them) | owner live-test pending |
| 08-01 | Digits-only fields open a digits keyboard (40df659) — customer phone, handset number, SIM number, virtual number and ICCID were `type=text` with no inputMode, so a counter tablet opens full QWERTY. tel/numeric + `dir=ltr`; /join already did this right, which is what made the staff side stand out. autocomplete stays off here on purpose — staff type someone else's number | ✅ 195/195 ×2 + build + node --check + offline shell (field reports type=tel/inputMode=tel, still round-trips "7911 123456", keeps its label) | owner live-test pending |
| 08-01 | Autofill on the public /join form (6713881) — every field was `autoComplete="off"`, so a customer entering their **own** details on a phone had to type all of them. given-name / family-name / tel / email. Address stays off (the Places widget owns it), honeypot stays off. The staff customer form is the opposite case and keeps autocomplete off | ✅ 195/195 ×2 + build + page rendered offline and attributes read back (4 tokens set, address + honeypot still off, honeypot still tabIndex -1) | owner live-test pending |
| 08-01 | A list table now shows it has more to the side (678796e) — wide tables scroll inside their card so the page never scrolls sideways, but at 390px the customers table hides **339px** (Balance and the whole Actions column) and its edge lands flush on the card border, reading as a finished table. CSS-only scroll shadows: a `local` gradient pair masks the shadow at a reached edge, a `scroll` pair is pinned to the box, so a shadow only ever appears on a side with more table beyond it. The two vertically-scrolling wraps (Settings, rentals split) opt out — `local` layers would drift up and fake a horizontal edge | ✅ 195/195 ×2 + build + shots at both ends × both themes (right at rest, left at full scroll, opposite edge clean) + computed `background-image: none` confirmed on both exclusions | owner live-test pending |
| 08-01 | Keyboard can reach a sideways-scrolling table (5c1321a) — **and the first guess was wrong**: focusing a control scrolls it into view, so Edit/Details/Delete were always Tab-reachable at 339px off-screen. The real gap is columns with nothing focusable — Balance is plain text, so a keyboard-only user tabs row to row and never sees "£45.00 debt". `.table-wrap` becomes a named region with a tab stop, but only while it overflows; re-runs on resize and removes the attributes again. Follows the existing kcScanClickable/kcScanLabels pass | ✅ 195/195 ×2 + build + node --check + offline shell (390px → tabindex=0, role=region, "Customers — scrolls sideways", ArrowRight scrolls; 1280px → all three removed) | owner live-test pending |

| 08-01 | Three tabs were **cutting** their tables off, not scrolling them (f856237) — Tickets & Flights, Repairs and Virtual Numbers put the table straight inside `.table-card`, which shares that rule's `overflow:hidden` and never got `.table-wrap`'s `overflow-x:auto`. At 390px the flights table is 1022px wide and **662px was unreachable by mouse, finger or keyboard** — Price, Fee, Status, Check-in, the row actions. Repairs lost 476px, Virtual Numbers 487px; flights loses 12px even at 1280px. `display:block` makes the table its own scroll box — measured before/after, every column keeps an identical width, the overflow just becomes reachable. Deliberately no `role=region` on a `<table>`: it would stop being a table to a screen reader | ✅ 195/195 ×2 + build + node --check + measured at 390/1280 (unreachable 662 → 0) | owner live-test pending |
| 08-01 | The Rentals screen pushed its second column off the screen (8df2c14) — `.rentals-split` is `1fr 1fr` = `minmax(auto,1fr)`, floored at the section header's 1066px min-content. **Not a phone problem: at 1280px the tab the shop works from scrolled sideways by 648px with Phone Inventory entirely off the right edge and Delete cut in half.** minmax(0,1fr) + min-width:0 + let the header wrap (its control cluster is an inline flex row that never declared flex-wrap, so a rule reaches it without editing ten call sites). Now 496+496 at 1280, 362 at 390 | ✅ 195/195 ×2 + build + content-column overflow 0px across 8 tabs at 390/1280/1440; Customers' 189px confirmed pre-existing by re-measuring against the pre-tonight stylesheet | owner live-test pending |
| 08-01 | The wallet dropped the payment method on a phone (56ad9ca) — a ledger line is "name · type · description (method)" on one nowrap line, and an ellipsis always eats the END, so "(cash)" rendered entirely outside the visible box. On the wallet that is part of the money record. Narrow screens wrap instead; 1280px still truncates as before | ✅ 195/195 ×2 + build + node --check + measured at 390 (wraps, method inside view) and 1280 (one line, unchanged) | owner live-test pending |
| 08-01 | Settings + Kol Torah overflow (c0d453e) — the Settings intro banner is an inline flex row with no flex-wrap, 17px over at 390px; Kol Torah's shul grid is `minmax(340px,1fr)`, a hard floor, 34px over at 320px. `minmax(min(340px,100%),1fr)` lets it give way — the only hard minimum in the app big enough to matter | ✅ 195/195 ×2 + build + every tab clean at 320/390/768/1280/1440 | owner live-test pending |
| 08-01 | Text that missed AA on its own colour wash (4d9f4d0) — nine failures, one bug in different colours: a semantic token tuned for a plain card used as text on a wash of its own hue. `--danger-ink`/`--warning-ink` join `--success-ink`; `--muted` six points darker (table headers sit on `--surface2`, not `--bg` — 4.38:1 on 11px across nine tabs). Dark's one failure was the **primary button**: white on the lightened `--accent` = 2.62:1 on ten tabs, now a `--on-accent` token at 7.09:1; `.btn-danger` 2.92:1 → 7.51:1 in dark, light untouched at 4.80:1 | ✅ 195/195 ×2 + build + node --check + `--contrast` clean in both themes at 390 and 1280 | owner live-test pending |
| 08-01 | Offline UI harness, kept this time (a07a944, aa2f2ea) — `ops/harness/`: renders AppShell to static HTML, stubs `window.fetch` from `seed.json`, drops in the real `main.js`, so every tab can be looked at with no server/auth/database. `--audit` (overflow + **fails a tab that never rendered**) and `--contrast` (AA against composited backdrops). It found the three worst items above; none was findable by reading CSS. README leads with keeping the seed faithful, because an unfaithful seed invents defects — an early one omitted `recent` from /api/ledger and made the dashboard look broken | ✅ 195/195 ×2 + build; all 13 tabs render and none overflows at 320/390/768/1280/1440 | tooling |

| 08-01 | Touch targets at the counter (7b3a766) — WCAG 2.5.8 wants 24×24 CSS px; eight controls were under it at 390px, including bare 13×13 checkboxes and a 21px-tall "💰 Take payment". Scoped to `pointer: coarse` rather than a width breakpoint, because the case that matters is the counter tablet — a touch device at any width — and a mouse on a narrow window needs nothing. Checkbox sizing moved out of seven inline style attributes into one CSS rule; inline beats any stylesheet rule, which is exactly why the bump could not reach them. 8 → 1, the survivor being a customer name inline in a sentence, which 2.5.8 exempts | ✅ 195/195 ×2 + build + node --check + measured both pointer types at 1280 (fine: 16px checkbox, button unchanged; coarse: 24px) + `--targets` added to the harness | owner live-test pending |

| 08-01 | The tail of the labelling job (f5eac63) — July's pass fixed labels by rule and left 34 controls with nothing to borrow, "want authored labels, one at a time". Re-measured on the **rendered** app: 242 controls across twelve tabs, seven still unnamed. Written, each carrying its own row's subject ("Status for Chaim Kopilowitz — Alcatel 1", "Mark done: Chase Wizz refund for BNKYRW") so repeated rows are distinguishable. **242 of 242 now have an accessible name** | ✅ 195/195 ×2 + build + node --check + names read back out of the DOM (catches a template hole rendering "Status for undefined") | owner live-test pending |

| 08-01 | /welcome was half-dark on a dark OS (cb8ff8e) — dark rules there need two forms, `[data-theme="dark"]` for the toggle and a `prefers-color-scheme` twin for someone who never touched it. **Eleven selectors had only the first**, so a visitor arriving on a dark computer got the dark paper with light-mode ink on it; the ghost "My account" button had neither, at 2.86:1. Found by diffing the two sets, which is why it is eleven and not the two I would have spotted. Also `--sk-gold`: 6.51:1 on the dark paper, **2.80:1 on the white one**, used for 17px copy — text takes a `--sk-gold-ink` (brand gold darkened to the lightest value that clears AA, #8d612b), dark points it back at `--sk-gold`, decoration untouched. `ops/harness/theme-pairs.mjs` keeps it from recurring; globals.css is exempt **on purpose** (no OS-dark palette at all — an OS rule there would invert the bug) | ✅ 195/195 ×2 + build + public-page contrast clean in both themes × both languages; the contrast tool also had to stop guessing behind gradients, which had invented ten false failures on the hero | owner live-test pending |

| 08-02 | The public pages could not be copied — owner-reported. `body { user-select: none }` is staff-app chrome, but `globals.css` is imported in `_app.js`, so it landed on `/welcome`, `/join`, `/portal`, `/login` and `/phone-guide` too. Those pages already undo body's `display`/`height`/`overflow` in their own global block; `user-select` was the one part nobody undid, so the marketing copy behaved like a picture of itself — a visitor could not copy the phone number, or paste a line of the offer to a family member. July's B3 had opted `td, th, .copy-val, code, pre` back in for the counter, which is why this survived: none of those exist in a hero. Fixed by opting the five public shells back in, `-webkit-` included (this audience is mostly iOS Safari) | ✅ 195/195 ×2 + build + a real selection measured in-page on all four public pages, plus the counterfactual — rule removed, the `h1` goes back to `none` and 0 characters select | owner live-test pending |

| 08-02 | One public form instead of two — owner-decided. `/join` and the `/welcome` contact form filed the **identical** staff task (`source: auto`, medium, one-open-per-person); the only difference was the reference prefix, `SIGNUP-` vs `MSG-`. And "Join" promised an account nothing created — no customer row, no login, and an email field captioned "unlocks your online account". The two parts worth keeping moved onto the contact form: the extra fields (optional email, preferred-contact chips, address with Places) and the existing-customer lookup that stamps the task "⚠ Possibly an existing customer #123 — open their card" or "likely a NEW customer". `/join` 307s to `/welcome#contact` — deliberately temporary, a 308 is cached hard and hard to walk back. Places now loads on address **focus**, not page load, so the busiest page doesn't carry it. Caught mid-build: the new chips reused `.sk-chips`, which is already the feature bands' tick list and carries `justify-content:center` — renamed `.sk-reach-chips` | ✅ 195/195 ×2 + build + full offline audit clean + the form driven for real in both languages (5/5 fields named, chips are one radiogroup that toggles off, 34px targets, Maps absent until focus, no page errors) + the 307 read back out of `.next/routes-manifest.json` | owner live-test pending |

| 08-02 | Five found by **looking at the rendered screens**, not by reading code — the automated audits (overflow, contrast, targets, theme pairs) were all clean, so this round came from screenshotting tabs at 390px and eyeballing them. (1) **Phone numbers stacked four lines high** (75304e5) — fmtPhone groups digits for readability and a narrow column broke the number at every space; `.kc-phone` nowrap on the three table cells that render one, 75px/4 lines → 166px/1 line, fully visible at 768+ and a 64px scroll at 390. (2) **Empty-state message cut in half** (eaf0b21) — nine in-table empty states; `display:block` left the colspan cell at max-content so the sentence never wrapped (464px inside a 362px card) and `.table-wrap table`'s `min-width:560px` forced 200px more. Empty tables now drop the header and the minimum via `:has()`. All nine fit at 320/390/1280. (3) **The new-task box had nothing to type in** (5c5dc9f) — `flex:1` is basis 0, and three fixed-width siblings ate the row, leaving the title input **10px wide** at 390px; a task could not be added from a phone. 10px → 332px. (4) **Phone-guide footer hard-coded English on an RTL page** (fbb7d70) — untranslated *and* bidi-mangled ("2026 ©", ".Hatsluche Ltd"); now in the page's T map, reusing /welcome's approved wording. (5) **Kol Torah job type unreadable** (54eb37a) — the select had no width of its own and the table squeezed it to 64px at every size, so "CD → MP3" and "CD → SD card" both read "CD ·" (6) **Dashboard stat cards uneven** (9d0a6ad) — "Flights · Next 7 Days" was the only label long enough to wrap at 390px, leaving that card 16px taller than its neighbour; the qualifier was redundant with its own sub-line ("3 flights this week") so it is now just "Flights", matching every sibling. (7) **The till was unopenable in the harness, hiding two real defects** (c4fa707) — seed.json's shop items were the wrong shape (`name`/`price`/`stock` against the route's `company`/`model`/`quantity`/`sellingPrice`/`active`), so every item was filtered out and the till refused to open. With a faithful seed: the category chips rendered **two** icons (`POS_CAT_ICONS` prefixing a `STOCK_CATEGORY_LABELS` value that already had one — "🔌 🔌 Accessory", and 📶 beside 💳 for SIM), and "Cash given £" needed 124px in a 110px box so it always read "Cash give…" — the field the change is calculated from. The seed trap the README leads with, found on the README's own seed. | ✅ each item: 195/195 ×2 + build + `node --check` where main.js was touched + measured before/after in the harness (and the full audit re-run after each); with the seed now populated, re-checked that 32 tables with rows keep their header and only the 4 genuinely empty ones drop it | owner live-test pending |
| 08-02 | Owner-requested afternoon rerun of the night loop — aimed the eyeball pass at what no round had looked at: the seven un-eyeballed tabs at 390px light, a dark sweep of seven more, the till open in dark, and the availability calendar. Four shipped: (1) **One-value cells still stacking** (02ae6e4) — the `.kc-phone` pass covered three tables and missed the Virtual Numbers tab, "+1 732 555 0123" four lines high; the flights route "MAN → TLV" was the same shape of value over three. (2) **Kol Torah add-job row unusable** (f8686d8) — last round's skipped item; the customer select crushed to ~55px ("🕯 Wa"). min-width:150px on select + walk-in name, the same cure `#ktJobKind` got in 54eb37a; wrap scrolls, every field typeable. (3) **Availability calendar crushed itself** (b29f5bf) — it sits in an overflow-x:auto wrap with a position:sticky Phone column, built to scroll sideways, but `width:100%` let a 390px screen shrink-to-fit it: every 22px day column squeezed to **6px** — unreadable numbers, 6px tap targets, scroll never engaged. `min-width:max-content` restores the design (22px cells, sticky pins while scrolled, page overflow 0 at 390/1280); legend header wraps and each colour-key+word pair is now unbreakable. (4) **Seed trap, second round running** (0dd5103) — the wallet feed read "undefined" mid-money-line and dashed the date; the route returns `type`/`at`, the seed said `entryType`/`createdAt` plus a `rental_charge` type the enum spells `rental`. App right both times. **Looked at and dropped** (harness font fallback, per README: staff app renders without David Libre KC offline, so width claims on placeholder text are unproven live): Kol Torah "£ collected" placeholder clipping its last letter; timer select truncating "Who are you helping?". | ✅ each item: 195/195 ×2 + build + node --check where main.js touched + measured in the harness before/after (VN + route one line box; add-job inputs 150/150/132/200/80px, wrap scrolls; calendar 22px cells + sticky verified mid-scroll; wallet feed three labelled dated rows) + full audit re-run clean | owner live-test pending |

| 08-03 | **The modals, at last** — every eyeball round had stopped at the tab; teaching the harness to open dialogs (a660ae9, 9e20f1c: `modals.mjs`, 14 dialogs, wired into audit-all at 390px both themes) immediately found the customer card unusable at phone width (5ae1121): the whole tool strip — ✕ Close included — off the card's right edge (the headline's min-content was floored by an unbreakable account email and `.detail-header` never wrapped); wallet/history rows crushing "Rental · Nokia 105 rental — 2 weeks" six lines tall beside a centred date (`.history-main`, wraps ≤560px); "Balance: owes £45.00" wrapping thrice inside its badge. Desktop byte-identical. Two more seed traps paid for: `/api/ledger` needs the customer shape (`balance`/`entries`) beside the dashboard's `recent` (the stub strips `?customerId=`), and `/api/cashup` unseeded passes the success check then dies on `data.methods` | ✅ each: 195/195 ×2 + build + node --check + modal sweep clean ×2 themes + card re-measured (tools reachable, scrollX 0, rows 2-line) + 1280px header/rows unchanged | owner live-test pending |
| 08-03 | **Customer-360 page** (owner's direct ask) — the profile grown from a pop-over into a real page at `/customers/<id>`: `pages/customers/[id].js` (same `requireStaffCookie` gate as every tab) serves the shell, main.js reads the second path segment on boot and on popstate, so refresh, Back/Forward and a link pasted to a colleague all land on the profile. One builder (`buildCustomerPanelHtml(c, mode)`) now renders both surfaces — the card is byte-identical except a new ⤢ tool — and the page adds Stripe-style Overview \| Activity sub-tabs: Activity unfolds the full timeline the card keeps in `<details>`, every record dated, filterable by category chips, lifetime spend alongside. `renderDetailPanel` repaints whichever surface is up, so every existing save-refresh works on the page unchanged; ⌘K verbs act on the page too. Helpers without the Customers tab can't reach it (boot gate + render guard) | ✅ 198/198 ×2 + build + node --check + harness: modals sweep clean ×2 themes incl. two new permanent `customer-page` entries (390+1280 screenshots eyeballed) + 10-point functional probe (card→⤢→page, refresh-stays-on-page, chips filter, breadcrumb back, no card re-pop, selection cleared) | owner live-test pending |
| 08-03 | **⌘K context verbs** (0034941) — see the ticked idea-hunt item above. Verified by driving the palette in the harness: baseline unchanged with no card open, verbs render + rank first with one open, running one opens the right modal for the right customer, no overflow at 390px, no Recent pollution | ✅ 195/195 ×2 + build + node --check | owner live-test pending |

| 08-03 | **Google Business Profile verified** (owner) — noted under "Local presence" above with the follow-ups (fill-in, JSON-LD sameAs/hasMap, review link, services). No code shipped yet | n/a (milestone) | owner |
| 08-03 | **Wizz refund credit notes arrived** — 11 Wizz Air credit-note PDFs in the owner's Drive `wizz` folder, one per cancelled PNR, €27,550.71 total. Every PNR matches a Cancelled booking in the app. **This is the per-PNR "refund amount" data the £3,190 reconcile was blocked on** (amounts are per-PNR group totals in EUR; passed-on-to-customer status still unknown). One name mismatch: ZMKWJP invoice says Chaya Leifer, booking says Yitzhak Leifer | n/a (data) | awaiting owner go-ahead to post refund legs |
| 08-05 | **SHIPPED to production (owner "ff it", main @ 434821a):** everything from the two overnight sessions — bank reconciliation v1 (bank_transactions applied to Kc-Live during the ship; the spike migration's uuid FK corrected to the ledger's real bigint), all six welcome tiles clickable, the six UX-night items, docs. Deploy READY on all domains; /api/health ok | ✅ gate + Vercel READY + health | **live** |
| 08-05 | **Type ramp session 3** (49729fe, daylight judgement half): --fs-overline (10px) token names the uppercase tracked-label pattern; staff strays + half-steps collapsed by the rule "emphasis rounds up, muted rounds down" (sidebar, filter chips, palette, POS toast/scan/tile-price, tool pages, portal); DESIGN.md records what deliberately stays literal (glyph/emoji icon sizes, 15px body base, public marketing scale). Type adoption is now COMPLETE for staff app + portal. Spacing stays opportunistic-per-surface by contract | ✅ gate; harness audit + contrast clean; shop/dashboard screenshotted (caught + fixed a missing token definition that inflated the sidebar) | owner feel-check wanted |
| 08-05 | **UX night (02:06 cron), six items.** (1) Touch: task-card 👤 link hittable on coarse pointers (6b6b6c0). (2) Type ramp session 2: all 468 on-ramp inline font-sizes in main.js → --fs-* tokens, zero visual change (681ae5c). (3) Session 2b: same for the 120 on-ramp sizes in globals.css (522a777). (4) Kol Torah new-job form out of the table into a wrapping panel — no more sideways form-filling at 390px (fd7e229). (5) Portal SIM line: "Renews 12 Aug · in 7 days", amber ≤14 days, red overdue, EN+HE (73eb17c). (6) Kol Torah add-title form, same table-escape (be0161b). **Left for session 3 (daylight judgement): 20 off-ramp literals in main.js (10/15/20/24/26/30px), 31 fractional sizes in globals.css (12.5/13.5/…), spacing sweep** | ✅ gate per item; harness audit/contrast/targets all clean after each; Kol Torah + portal + dashboard screenshotted L/D; portal renewal states DOM-asserted in EN+HE | owner live-test pending |
| 08-04 | **Owner-directed night (23:08 trigger): bank reconciliation v1** (c3f1d36) — Wallet → 🏦 Bank statements (owner-only): CSV upload per account label (multiple accounts supported), Revolut Business export parsed for real (completed dates, Payer, Description+Reference merged, Fee netted, DECLINED/REVERTED dropped, bank ID = idempotency key), `/api/bank` proposes matches with reasons + confidence, human confirms each (idempotent bank_transfer payment; retry-safe — a replay never double-posts or reverses a good confirm), undo = equal-and-opposite correction + row reopens. GoCardless client untouched — still blocked on credentials + business account. **Needs `20260731180000_bank_transactions` applied at next ship (route 503s with that exact instruction until then)** | ✅ 216/216 ×2 + build + node --check; screenshotted light 1280 + dark 390 (button-clip at 390 found and fixed) | owner live-test pending |
| 08-04 | **Owner-directed night: every welcome tile is a door** (3073f38) — all six service tiles clickable: Kosher phones → /phone-guide; Accessories / Kol Torah / Flights / Online help → #contact with an empty-only seeded message per tile (band-prefill pattern, typed text never clobbered); EN+HE labels/CTAs, same hover affordance as the Repairs tile | ✅ 216/216 ×2 + build; live-harness click-through both languages (hash lands, message seeds, typed text survives) + EN/HE grid screenshots | owner live-test pending |
| 08-04 | **Google-feel session 1** — five items off the owner's three gaps. (1) **The contract** (ecf5153, 5fb3c8f): `docs/DESIGN.md` written as the design-system contract — which token when, per surface: spacing, radius, elevation, the new `--fs-*` type ramp (11/12/13/14/16/18/22/28), and a named motion spec (enter/exit/move/drawer/press/hover — each mapped to a duration + easing token, with the hard rules: never ease-in, UI < 300ms, keyboard actions never animate, transform/opacity only). The Stripi analysis that previously sat at that path moved honestly to `docs/STRIPE-REFERENCE.md` after the first commit accidentally replaced it. (2) **Tabs enter, they don't pop** (b831139): every renderTab paint (and the customer profile page) restarts a 180ms fade + 5px rise on #mainContent — one-frame innerHTML swaps gone. (3) **Waiting is disguised** (76f9e1e): the eight tabs that opened on a centred spinner (wallet, repairs, services, shop, Kol Torah, tasks, VN, settings) now paint `skeletonHtml()` — stat-card + table ghosts (two-column ghost where that's the layout) with a soft shimmer off the border/surface tokens; spinner stays for modals. (4) **Modals enter** (725d426): scrim fades, dialog rises from scale(0.97), pure CSS, exits deliberately instant; the last `transition: all` (.action-btn) pinned to its four real properties. (5) **Ramp adoption begins** (d69346e): all 15 fractional font-sizes in main.js onto `--fs-small`/`--fs-body`; toasts onto `--dur-3`/`--ease-out`. Checked and already right: press feedback exists app-wide, ⌘K palette correctly never animates, reduced-motion umbrella covers everything new for free | ✅ each item: 198/198 ×2 + build (+ node --check where main.js touched); skeletons screenshotted light+dark at 1280+390 (shapes mirror layout, dark flips on tokens); full modal sweep clean after the modal-enter change | **owner feel-check wanted** — durations are tuned blind; judge live and I'll adjust |
| 08-06 | **UX night — table legibility.** (1) **Rentals + Shop stop squeezing their tables into half the screen** (33c7d34): measured the rentals table at 1034px of content against 500px of column at 1280 and 820px at 1920 — clipped and side-scrolling at *every* desktop width, with `20 Aug 2026` broken to one word per line, five stacked lines a row. Both splits now stack; Shop returns to side-by-side above 1750px where both halves genuinely fit, Rentals would need ~2280px so it stays stacked. Dead Phone-Inventory alignment spacer retired. | ✅ 217/217 ×2 + build + 13 tabs × 5 widths × 2 themes | owner live-test pending |
| 08-06 | **Balance stops breaking mid-value** (91a6987): `£45.00 debt` was splitting over two lines in the Customers and Rentals balance columns. New `.kc-money` beside the existing `.kc-phone`. | ✅ 217/217 ×2 + build + no overflow at 320/390 | owner live-test pending |
| 08-06 | **Dates stop breaking mid-value, app-wide** (b97d1c4): `18 Aug 2026` was rendering as three lines in Bookings' Travel column; same cell in SIM Plans, Repairs, Online & Print, Kol Torah and Accounts. New `.kc-date`, applied to all seven date cells. | ✅ 217/217 ×2 + build + overflow audit | owner live-test pending |
| 08-06 | **Ledger feeds show what the money was for** (0b10fce): Wallet + Dashboard activity rows truncated `name · type · description (method)` at one line, so the ellipsis always ate the description and the payment method — `Menachem Adler · Payment · Rental…`. New `.kc-clamp-2` gives the description a second line. | ✅ 217/217 ×2 + build + audit clean | owner live-test pending |
| 08-06 | **The product declares itself en-GB** (bcd31e6): the document said `lang="en"`, so every staff notes textarea was spell-checked against a US dictionary — "colour", "organise", "authorised" all underlined — on a British-English product. Also affects screen-reader pronunciation and hyphenation. Public pages set their own subtree lang, so Hebrew/Yiddish untouched. ⚠ The same tag drives `<input type="date">` field order (the Tasks due-date box shows `mm/dd/yyyy`), but that half is **unverified**: headless Chromium renders US order regardless of page lang *or* browser locale, so it could not be reproduced either way. **Owner: glance at the Tasks date box in a real browser.** | ✅ 217/217 ×2 + build + full audit clean | owner live-test wanted |
| 08-06 | **Row action buttons wrap, so the rentals table fits at 1280** (015479b): `.row-actions` was a non-wrapping flex row, so the cell's *minimum* width was the sum of every button — a five-button rentals row pinned Actions at 357px, wider than Customer and Phone together, and left the table 49px over the content column with the last button under the scroll edge. Wrapping drops the minimum to the widest single button; measured fitting at 1280/1440/1600/1750/1920, and from 1440 the buttons still sit on one line. Completes the 33c7d34 item. | ✅ 217/217 ×2 + build + full audit clean | owner live-test pending |
| 08-06 | *Investigated, not a bug:* the public harness flags six `/welcome` nav links as "outside viewport" at 390px, including **My account**. They are `.sk-mobnav` chips in a container that genuinely scrolls (scrollWidth 1070 vs 390, `overflow-x:auto`), the desktop copy is `display:none` there, and the footer carries a third full-width copy. The harness note is a false positive — it does not model scrollable containers. No change made. | n/a (investigation) | n/a |

Found 07-31, FIXED 07-31 (8a186a0) — see the log row above:
- [x] **P2 · L** — **form controls with no programmatic label** — most sat under
      a visible `<label>` that has no `for=`, so they looked labelled and
      weren't. Re-measured properly on the app's real markup (template literals
      extracted with the `${…}` holes recursed into, then loaded as a document
      and asked the DOM for an accessible name): **202 of 231 unnamed → 34.**
      The first count of 274 came from a shallower extraction that blanked the
      holes; 231 is the truer denominator.
      The 34 left have no text anywhere to borrow — a lone number field beside
      another, a status `<select>` whose options are all values. They want
      authored labels, one at a time, not a rule.
- Verified clean while hunting: no hardcoded text colour in globals.css lacks
  a dark-theme override (the three that looked unguarded all have one — the
  first scan's selector matching was wrong). B2's class of bug has not
  regressed.

Held / owner input: family-trip sheet (£1,364 balance) needs the customer's
name before it's entered; Canada/EU loss rates — follow T&C schedule or stay?

🔒 **Owner decision — £3,190 owed on eleven cancelled Wizz bookings** (write-up:
`docs/BOOKINGS-DIG-2026-07-31.md`). The owner asked 31/07 whether "paid" in the
flights sheet might mean *Wizz paid the refund*. Resolved against the source —
the sheet (`Wizz AIr Tickets`, owned by ch7023518@gmail.com, shared 29/07) has
`Paid 1?`/`Paid 2?` for the customer paying the fare and the fee, and a separate
`Refunded?` for Wizz paying back. The reconcile read it correctly.

The real defect is one column along: **`Refunded?` is FALSE on all eleven.** The
customers paid £3,190, Wizz cancelled, Wizz has not refunded, and every booking
nets to £0 so the app calls them settled. The `cancelled unpaid` rows reverse
their charge correctly; the paid ones never got that reversal, and its absence
is what hides the debt. Reversing them moves each to +£X owed, £3,190 total.

Blocked on two things the data can't answer: (a) `Refunded?` is likely stale —
the owner's sent mail says refunds for ~70% of customers had already arrived;
(b) those emails direct customers to pay *Chlomo Grinfeld's* account on *his*
sheet, so whether KC is the principal decides whether this belongs in KC's
ledger at all. Snapshot before any write.

Independent of all of it: **the ledger had no refund leg** — money going back to
a customer had no entry type, so a settled refund and an owed one looked the
same. **DONE (this cycle).** `refund_payout` is the missing half: `refund` (+)
credits the wallet and means *we owe them*, `refund_payout` (−) records the
money actually handed back and cancels it. Migrations
`20260731100000`/`20260731100100` (enum, then sign check + revenue RPC), the
API kind (owner-only, sign applied server-side, tender required), the wallet
form, and tests. The revenue report now separates `refunded` (credit issued)
from `paidOut` (cash returned); the gap between them is `refundsOwed`.

**Both gating questions moved 31 Jul** (detail in `docs/BOOKINGS-DIG-2026-07-31.md`):
- **Principal — answered, it's KC.** Owner: Shloime owns the business and uses
  his account as part of KC. Known to need changing; not today's problem. So the
  correction belongs in KC's ledger.
- **`Refunded?` stale — confirmed** from five owner screenshots. Wizz money is
  already back on bookings the sheet marks FALSE.

But the fix is **not** the £3,190. That is what customers *paid*; Wizz refunds
less. MN8VSZ: paid £175, refunded £90. BNKYRW: paid £495, sent £285 — under the
fare in both, so it isn't just the fee being retained. Reversing amounts paid
would over-credit every customer.

Three states hide behind one FALSE, and only one is a debt: refunded-and-passed-on
(settled), refunded-and-held (**the live liability** — customer money in KC's
hands, 3 of the 5 screenshots), and not-yet-refunded (KC has a claim on Wizz,
owes the customer nothing). The refund leg records all three; it can't invent the
amounts.

🔒 **Now blocked on data, not a decision:** the per-booking refund amount and
whether it was passed on. Those live in `ch7023518@gmail.com`, which sessions
can't read — the connected mailbox is `e.a.rothbart@gmail.com`. Either Shloime
supplies the figures or that mailbox gets connected. Also unexplained: `XU2WWH`
appears twice in the eleven (£360 and £145), so a ref-keyed reversal is
ambiguous until that's resolved.

- [ ] **P2 · S** 🔒 — **Check-in + travel-requirements: built, never used.** 0 of
      101 bookings have `checkin_done` set and 0 have `destination_country`, so
      the whole 🛂 per-passenger visa/passport screen has never rendered a
      requirement. Owner to say whether the shop works this way at all before
      anything is built on top. Also 36 of 41 upcoming bookings have no passport
      on file (nothing expiring before travel, so not urgent).

🔒 **Owner decision — SIM records vs the shop's Gmail** (full write-up:
`docs/GMAIL-SWEEP-2026-07-31.md`; the number list went to the owner directly,
deliberately not in the repo). Read all 25,393 provider messages in
`5311386k@gmail.com` and compared every number found against `sims`:
- **241 numbers had provider mail in 2026 that the app has no record of** (124
  in July alone, 237 of them Lebara). Spot-checked the 15 busiest across the
  whole database — 14 appear nowhere at all. The app holds 545 Lebara SIMs; the
  mail names 887 distinct Lebara numbers.
- **119 rows still marked `active`** have had no provider mail since before
  2026. 106 are Lebara, where monthly mail is reliable enough for silence to
  mean something; the other 13 prove nothing (1pMobile never prints the number).
Not loop work — it's data about live customer plans and money. Needs the owner
to say which are his, which have ceased, and which should be entered.

---

## Reconcile 2026-08-06

The list had drifted: seven items were shipped but still showing open, so the
backlog was over-reporting remaining work by about a quarter. Each is now ticked
with the file/line or the production table that proves it — shop oversell,
idempotency keys, wallet-as-tender, Z-report variance, phone-migration logging,
the public repair page, and the `bank_transactions` migration. The status-SMS
item was reworded: it is built, it just doesn't send.

**Read this section before planning.** Items above with no "verified" note have
not been re-checked against the code and may have drifted the same way.

### Pre-launch, in the order I'd do them

- [ ] **P1 · S** 🔒 — **Un-hold email.** Resend is configured and in TEST; every
      message redirects to the test inbox. Receipts, reminders and sign-in links
      reach nobody until `MAIL_TEST_TO` is removed and `MAIL_LIVE=true`
      (`docs/EMAIL-GO-LIVE.md`). Owner's flip. This also unblocks the status-SMS
      drafts and the review-ask on receipts.
- [ ] **P1 · S** 🔒 — **Open a business bank account.** Unchanged and still the
      blocker: the shop's money runs through Shloime's personal account, so no
      bank feed can be connected without pulling his personal transactions in.
- [ ] **P1 · S** 🔒 — **Fill in the Google Business Profile** (~20 min, owner).
- [ ] **P1 · M** 🔒 — **241 SIM numbers with 2026 provider mail that the app has
      no record of**, plus 119 rows marked `active` with no mail since before
      2026. The SIM list is what the business runs on and it is out of step with
      the shop's own mailbox. Full write-up in `docs/GMAIL-SWEEP-2026-07-31.md`.

### Money not being collected

- [ ] **P1 · M** 🔒 — **77 virtual numbers bill nobody.** `billing_enabled` is
      false on every row. The ELID subscription list shows roughly **£772/month**
      of recurring revenue across ~30 accounts. Blocked on the balance question
      below — turning billing on before that is settled risks double-charging
      people who already pay in the shop.
- [ ] **P1 · S** 🔒 — **The −£3,330.09 question** (Shloime, Sunday 08-09). Do the
      ELID customers pay in the shop? The arithmetic in
      `docs/ELID-IMPORT-2026-08-06.md` shows the balances are accrued
      subscription charges with **no payment ever posted in ELID**, which points
      to an unmaintained meter rather than real arrears. Needs confirming before
      any balance touches the wallet ledger.

### ELID leftovers (detail in `docs/ELID-IMPORT-2026-08-06.md`)

- [ ] **P2 · S** — mrs-feld's number sits on two devices (hers and a
      Phone-Rentals one); 3 customers have two UK numbers each; 15 have only a
      foreign number, where a `1…`/`972…` is as likely to be a forwarding
      destination as a contact number.
- [ ] **P2 · S** — 12 DIDs whose owner is ambiguous (Grinfeld ×15, Gross ×9,
      Glick ×8 candidates). `chaskel lamm` → probably **Yechezkel Lamm**, but
      that is an inference.
- [ ] **P2 · S** — The 3 pre-existing `virtual_numbers` rows on `+44 20 7000 100X`
      match no real DID. Placeholders; confirm before overwriting.
- [ ] **P3 · S** — Drop the undo/staging tables (`undo_20260806_*`,
      `merge_map_20260806`, `rental_placeholders_20260806`, `elid_*_20260806`,
      and the older `zz_snapshot_*`) once the above are signed off.

### Engineering hygiene

- [ ] **P1 · S** — **Turn on branch protection requiring the `verify` check.**
      `ci.yml` has said this since it was written; without it a red CI blocks
      nothing, as 08-06 demonstrated when two runs died in a GitHub Actions
      incident and neither stopped a merge.
- [ ] **P2 · M** — **`sims` has no typed number column.** All 840 SIM numbers
      live in `legacy_extras.simNumber` as untyped JSON, and `customer_id` is
      NOT NULL — which is what forced 39 fake "Rental" customers into the list.
      Migration: make `customer_id` nullable, add `sim_number`, backfill.
- [ ] **P2 · S** — Supabase auth: **leaked-password protection is off** (one
      toggle), and `current_staff_role()` is a `SECURITY DEFINER` function any
      signed-in user can call over RPC. Check that's intended.
- [x] **P1 · S** — **16 public tables had RLS off and full `anon` CRUD** —
      **FIXED 08-06**. Every ad-hoc snapshot since 07-29, including a complete
      copy of the customers table, was readable and writable by anyone holding
      the publishable key. Revoked and RLS enabled; migration
      `20260806210000_lock_snapshot_tables.sql`. `CREATE TABLE … AS SELECT`
      against production is the trap — it inherits schema defaults and starts
      with RLS off. Re-run the migration after any new hand-made table.
