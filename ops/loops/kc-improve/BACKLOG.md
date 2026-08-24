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

## STANDING RESEARCH TASK — eposnow.com (owner, 20 Aug 2026)

Owner: "epos now .com has so much more than us.. put it in the overnight loop
to steal ideas and structure and system."

**Run this at the start of a cycle whenever the backlog is thin.** Read
eposnow.com's product, pricing and help pages, and mine them for three things
in this order:

1. **Structure** — how they cut the product into areas, what they call things,
   what lives on one screen vs many. This shop's app grew screen by screen; a
   mature till product has had that argument already and it is worth reading
   their answer even where we disagree.
2. **System** — the workflows that join screens up: end-of-day, stock counts,
   staff permissions, multi-site, offline behaviour, reporting cadence.
3. **Ideas** — individual features worth having.

**Rules for the loop:**
- Ideas land in this file with a source URL and a one-line "why it fits KC" —
  they do NOT get built the same night. What suits a 400-till chain often does
  not suit a shop where one person knows every customer's name.
- Anything touching money, auth, consent or customer comms is 🔒 by default.
- Do not copy their words. The wording on our screens is the shop's own voice
  and it is a deliberate thing — read their structure, write our sentences.
- Say plainly where they are simply better. That is the point of looking.

Archive findings in `docs/IDEAS-EPOSNOW-<date>.md`, same shape as
`docs/IDEAS-2026-07-17.md`.

**First run: 21 Aug 2026 → `docs/IDEAS-EPOSNOW-2026-08-21.md`.** Read via web
SEARCH only — this environment's network policy blocks eposnow.com and every
review site at the egress proxy, so item 1 (structure: how they cut the product
into areas, what lives on one screen vs many) is the part answered least well
and wants re-running by anyone who can open the pages. Six ideas came out of it,
below.

### Ideas from that run (21 Aug 2026)

Sourced and argued in `docs/IDEAS-EPOSNOW-2026-08-21.md`. Not built the night
they were found — the standing task's own rule.

- [ ] **P1 · M** — **The shop is told, rather than having to look.** Their
      low-stock alert arrives daily by email; KC computes the same thing and
      waits on a badge for somebody to notice it.
      **Half built, 21 Aug: `lib/dailyDigest.mjs`** — pure, 18 assertions in
      `test/dailyDigest.test.mjs`. It SUMMARISES THE TASKS THE SWEEP ALREADY
      RAISES rather than re-deriving anything: overdue rentals, debts, passports,
      travel paperwork, carrier post and the rest are already tasks, and a second
      answer to "what needs doing" is the fault that bit this repo three times
      in one week. Groups by the raiser's own reference prefix, orders high
      priority → nearest deadline → oldest, caps each group and always says how
      many it left out.
      **And the email**, `lib/digestEmail.mjs` — renders, does not send, held by
      `test/digestEmail.test.mjs`. Split from the data half so that one keeps
      importing nothing; a test fails if either crosses back.
      **The read and the hand-off shipped 21 Aug** — `pages/api/cron/digest.js`,
      scheduled 06:30, deliberately after the 06:00 sweep so it never describes
      yesterday. It reads the open tasks, builds, and hands to `sendEmail`,
      whose gate does what it does for receipts: MAIL_LIVE unset → built,
      logged HELD, nothing leaves. Quiet morning → nothing at all. Held by
      `test/digestCron.test.mjs` (auth like the sweep, gate-only sending, no
      writes, scheduled after the sweep — the schedule test goes red if the
      order flips).
      **What is left is exactly two env vars, both the owner's:** `DIGEST_TO`
      (who it goes to; unset → the endpoint skips) and the house `MAIL_LIVE`
      flip. 🔒
      <!-- backlog-ok: code complete and scheduled; open only for the two
      owner-held env flips, DIGEST_TO and MAIL_LIVE -->
- [ ] **P2 · M** 🔒 — **A credit limit, and a real statement.** Their Customer
      Credit carries a per-customer limit, a balance owed, and a statement over a
      date range with an amount due and a due date. KC's wallet has no line at
      which somebody says stop — see the £10,925 of unbilled bookings (#12).
- [ ] **P2 · S** 🔒 — **Cash up per shift, not only per day.** `till_counts` is
      one row per date, so two people on one day is one variance nobody can
      attribute. Their end-of-day collection runs at end of shift too.
- [ ] **P2 · M** — **Stock history and discrepancy as a trail, not a number.**
      They report stock CHANGES over time; KC knows current stock and nothing
      about how it got there, so "we are three short" has no answer. Read-side
      only, built on writes the app already makes.
- [ ] **P3 · M** — **Customer types.** Their loyalty scheme hangs on customer
      types; KC has no categories at all, so there is no way to say "Kol Torah",
      "trade", "staff family". The types are the useful half for this shop; the
      points scheme is not. 🔒 the moment a type changes a price.
- [x] **P2 · S** — **Attach the customer BEFORE the sale, or it is anonymous** —
      **DONE 21 Aug.** Landed narrower and sharper than filed: a PAID walk-in is
      most of what this shop does and must not grow a question, so the guard is
      on **unpaid** walk-ins only. Untick "Paid now" with no customer and the
      charge posted against the built-in Walk-in account — a debt belonging to
      nobody that cannot be chased or moved onto a person later. Refused in the
      till and in `pages/api/shop.js`, before the idempotency key is burnt.
      Never happened: the walkin account's six ledger rows net to £0.00.

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

## From AHT portal reference (owner shared 2026-08-18 — see docs/DESIGN-NOTES-AHT.md)
Owner shared the AHT/Yordex charity portal as a UX reference. Full read + ranking
in the design note; the loop-safe (no money-read / no nav / no auth) items:
- [x] **P1 · M** — **Hebrew dates beside Gregorian** — **DONE.**
      `lib/hebrewDate.mjs` built and mirrored into main.js (`KC_HEBREW`), held by
      `test/hebrewDate.test.mjs`, `test/hebrewDateMirror.test.mjs` and
      `test/hebrewOnScreen.test.mjs`. Placement was the owner's call and he made
      it on 19 Aug — "the counter screens" — shipped the same day (`bc3e273`): a
      SIM's renewal, a rental's due-back day, a flight's travel date and the day
      a repair came in. It sat unticked here for two days after it shipped.
- [ ] **P2 · S** — **Direction badges** for ledger/till type — round colour-coded
      in/out/transfer/bank glyph in place of the text word. Pure display.
- [x] **P3 · S** — **"(N loaded)" count** in list search boxes — **DONE 21 Aug.**
      Landed as "12 of 797": a filtered list and an empty list looked identical,
      and with 797 SIMs and 788 customers that matters. Turned out the SIM tab
      and the Shop tab had each grown their OWN copy of the line and four lists
      had nothing — so `kcListCount` is one line, once, now used by Customers,
      Rentals, Phone Inventory, SIMs and Shop. Held by `test/listCount.test.mjs`.
- [ ] **P2 · S** — **Live "Preview" pattern** — show the computed result inline as
      the owner edits (receipt text, SMS draft, public account string).
- [ ] **P2 · M** — **Wizard stepper** component for multi-step flows (New Booking/
      Rental, POS order): numbered progress + disabled-until-valid Next.
Held for owner (money-read or nav decision, NOT loop-autofix): running-balance
column in Wallet; grouped sidebar sub-labels; בעזהשי״ת header phrase/placement.

## From the owner's list, 19 Aug (docs/OWNER-LIST-2026-08-19.md)
Twenty-one items sent overnight; full triage in the doc. Loop-safe UX ones:
- [x] **DONE 20 Aug** — **Extra-large text overflows the card** (owner #14).
      At 320px on the largest ramp the carrier-mail row's 📝 Task button painted
      33px outside its card; `.cm-actions` was a flex row with no wrap. Clean at
      320/390/1280 on both ramps.
- [x] **DONE 19 Aug** — **One dropdown style throughout** (owner #10). Was
      already fixed when re-checked on 20 Aug: `select.form-input`,
      `.country-select` and `.task-mini` share one look block, and measuring the
      three in the browser gives identical radius, border, background and font.
      `.task-mini` had also had no focus ring at all. `test/dropdownStyle.test.mjs`
      now holds it, since the drift happened once by each variant quietly
      growing its own look and nothing would have caught it.
- [x] **DONE 19 Aug** — **"Open" and "login details" sit too near** (owner #19).
      The two now sit in a flex row with a 12px gap and their own weights — a
      place to go and a name to sign in with, not one run-on string. No guard
      added: it is one inline-styled row, and a test asserting a gap value would
      break on any honest restyle.
- [x] **DONE 20 Aug** — **Overdue link drops the filter** (owner #15). The SIM
      roll-up now opens the `week` filter it counted; the repair-ready and
      flight lines had the same defect and were fixed with it, and a palette hit
      naming one booking opens that booking instead of the whole tab. The
      palette's repair hit still opens the tab — a repair has no record of its
      own and the list has no search term, so the alternative was inventing
      state. `test/attentionLinks.test.mjs` holds all of it.
- [x] **DONE 20 Aug** — **Marketing in the carrier queue** (owner #3). It was
      being DROPPED outright — no row, a Vercel log line the only trace — which
      broke the endpoint's own stated rule that nothing uncertain is discarded.
      Adverts are now filed with `resolved_at` set: out of the working queue,
      recoverable under "Everything" if the call was wrong. The classifier was
      deliberately NOT widened — the obvious signal (a utm_campaign link) also
      appears in Smarty's genuine port-completion mail.
- [ ] **P3 · S** — Owner items #7, #8, #9, #16 arrived with screenshots this
      session cannot see — **ask before guessing**.
Needs an owner decision first (do NOT loop-autofix): #20 forwarding carrier mail
to customers (live send, HOLD-gated), #12 auto-renew in Needs attention, #2/#6
make-anything-a-task, #4 customer document folders + portal visibility, #21 a
reply box on the message log, #13 wiring lib/identity.mjs to the Duplicates tool.

## UX / smoothness / delight
- [x] **P1 · M** — ~~"A comfortable view like Lightspeed has"~~ — **DONE 08-17**
      via the row overflow menu (see docs/DESIGN.md §Row actions). Measured
      before and after at every width:

      | | wrapped rows (cust / sim / rentals) | rentals width @1280 |
      |---|---|---|
      | before | 6/6 · 2/2 · 3/7 | +44px |
      | after ≥1440 | **0/6 · 0/2 · 0/7** | 0 |
      | after @1280 | 6/6 · 2/2 · 3/7 (2 controls, not 3) | **+32px** |

      Better or equal at every width measured, worse at none. **Rentals' ninth
      column went on the owner's call the same day** — Price now sits under the
      Balance it explains rather than in a column of its own — and the table
      fits 1280 exactly: +44px before all this, +32 after the menu, **0 now**.
- [ ] **P1 · L** — **"Google-feel" polish (owner ask 08-03**, after "why does
      business.google.com feel so much nicer/richer/smoother?"). Owner wants
      the **first three** of the four gaps. **Session 1 shipped 08-04**
      (see log): motion spec + type-ramp tokens + `docs/DESIGN.md` as the
      contract; tab/profile cross-fade; skeletons on the eight spinner tabs;
      modal entrances; first ramp-adoption sweep (all 15 half-step sizes) +
      toast tokens + last `transition: all` retired. **Remaining for
      sessions 2–3** (adoption, per DESIGN.md's ledger):
      1. ~~Type-ramp sweep of the ~455 remaining inline `font-size`s~~ —
         **DONE, and the count was stale. Measured 08-16**: main.js holds 563
         inline `font-size` declarations and 556 of them already use a ramp
         token. The seven survivors are all correct as they are — three are
         print CSS (paper does not have Simple Mode, and px is the right unit
         there) and four are emoji glyph sizes, not text. What is genuinely
         left of this line is moving inline `style="font-size:var(--fs-…)"`
         into classes, which changes nothing a user can see; treat it as
         tidying, not as a P1. The real defect underneath it was found by the
         new textscale sweep and fixed (2725713): `body` was a bare 15px, so
         every element that never set a size of its own was invisible to
         Simple Mode.
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
- [ ] **P1 · S** 🔒 — **Twilio is still a TRIAL account** (owner console
      screenshot 08-16: "Trial: £11.71", *"you can only send messages and make
      calls to verified phone numbers"*). Registered to `tech@kosher-connect.com`,
      opened 20 Jul; the credentials are already in Vercel (health 08-04:
      `sms: configured, provider twilio, mode test`). **So the code is done and
      the account is the blocker, not the app.** Two owner steps, in order:
      (1) **verify Shloime's own mobile** in Console → Phone Numbers → Verified
      Caller IDs — that alone makes the Settings → Messaging "send test SMS"
      button deliver; (2) **upgrade off trial** (card on the account) — until
      then LIVE is impossible by construction, because a real customer's number
      is not a verified number, and every trial message is prefixed
      "Sent from your Twilio trial account". **08-16 plan superseded 08-18:
      the owner BOUGHT a Twilio number**, the UK regulatory bundle
      (`BUb9a351…`, Mobile-Business) was approved the same evening, and the
      owner assigned it to the number immediately. So the number is
      regulatorily complete and replies become possible. What's left, in
      order: (1) upgrade off trial — the ONE remaining hard blocker;
      (2) put the number in the Messaging Service sender pool (or
      `TWILIO_FROM`); (3) TEST-mode proof send; (4) inbound-SMS endpoint
      before any copy says "just reply" — nothing receives yet. Runbook
      updated: `docs/TWILIO-SENDER.md`.
- [x] **P3 · done-but-dark** — **myPOS ↔ till** one-tap. **BUILT 08-04 and
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
- [x] **P2 · L** 🔒 — **Stripe** save-card + off-session charge + webhook — **DONE.**
      `pages/api/portal/save-card.js`, `pages/api/stripe/webhook.js` and the
      at-the-counter flow (`e0d2368`, "Save a card at the counter, in the app").
      The webhook writes `stripe_pm_id` on `setup_intent.succeeded`; verified in
      `docs/claims-audit.md`. Still on test keys — that flip is #7, not this.
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
- [x] **Purchase orders — DONE 08-17.** The missing middle of the buy side:
      suppliers and goods-in were both here, the ORDER was not, so "what is on
      its way and when was it promised" had no answer. Shop tab → "On order",
      with draft → ordered → received, an expected date that goes red when it
      passes, and Receive putting the quantities straight onto the shelf.
      Ordering posts nothing; only receiving moves anything, and it moves stock
      rather than the ledger. **NOTE: there are 0 suppliers on file** — the
      first order needs one adding (the Returns panel has the box).
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
- [ ] **P2 · S** — **Bank feed: the account exists now, the question moved.**
      Superseded 21 Aug. The 07-31 entry said the shop's money runs through
      Shloime's PERSONAL account, so no feed could be connected without pulling
      his personal transactions into KC's database — a privacy problem no
      filtering fixes, because the filtering happens after storage.
      **Owner, 21 Aug: there is a Revolut BUSINESS account in Hatsluche Ltd's
      name.** That removes the privacy blocker for that account.
      What is still open is narrower and worth asking plainly: **is the shop's
      takings actually landing in it yet**, or does day-to-day money still run
      through the personal account? Having the account and using it are not the
      same fact, and only the second one makes a feed safe to connect.
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
| 08-07 | **UX night (03:11 cron), six items — and the first two hours went on the instrument, not the product.** The public harness could not render a single image or the self-hosted Hebrew font (every asset path is absolute; on `file://` that is the filesystem root), mounted on an id globals.css does not style, and its `--theme dark` set only the OS preference — which globals.css deliberately ignores. So the brand rendered as broken-image alt text, Hebrew fell out of Heebo, every page looked as though its background stopped mid-screen, and **the dark half of /repair, /phone-guide and /portal had never once been rendered.** Fixed first (13498ca), because the alternative was a night of fixing phantoms: the "background stops mid-screen" defect existed nowhere but in the harness, and I nearly shipped a fix for it. | ✅ gate + full audit clean | tooling |
| 08-07 | **The public sub-pages printed the brand name twice** (5c6c45e): `logo-full-tight.png` *is* the wordmark — it reads KOSHER CONNECT — and /repair and /phone-guide set a text `<h1>Kosher Connect</h1>` beside it. 162px of a 350px bar spent saying the same thing twice, and the page's `h1` was the shop's name while its actual subject ("Book a repair") was an `h2` — on a page built to be found in search. Tag line stays, the real heading becomes the h1 (pinned to `--fs-h1` so the swap is invisible), hover affordance moves onto the mark. Brand block 282px → 109px. **Found on the way: the fixed theme toggle was sitting on top of "My account"** — the primary CTA — at 390, 640 and 768 in *both* languages, pre-existing at the two larger widths. Reserved the difference at the bar's inline end, the same way /welcome keeps its nav clear. | ✅ gate + public audit + contrast both themes + collision scan across 3 pages × 2 langs × 5 widths | owner live-test pending |
| 08-07 | **The repair form was pinned to one edge** (d31384c): /repair is a single 560px form in a 1320px shell and it sat hard left with 660px of empty canvas — the look of a layout that had lost its right-hand column. Centred; head block and footer travel with it. RTL mirrors correctly. | ✅ gate + shots EN/HE × L/D | owner live-test pending |
| 08-07 | **The repair confirmation did not read like one** (99cc453): the success card's headline is an `<h3>`; the rule styling it named an `<h4>`, so it never applied and the line fell through to `.w-section h3` — the 12px uppercase muted-grey *kicker* rule. The sentence telling a customer their request arrived was the smallest, greyest, shoutiest thing on the screen. Reached by driving the form to its success state, which no round had ever done. Third selector/tag mismatch in that block; the other two (`.rp-head h3`, `.pg-head h3`) targeted elements that never existed and went with the heading change. | ✅ gate + success state driven in EN/HE × 390/1280 × L/D + computed style read back (18px/700/--text vs 14.5px body) | owner live-test pending |
| 08-07 | **A modal that scrolls now says so** (a0763de, then 2b9db5e for the customer card): New Rental is 760px of form in an 810px box at a normal desktop height, so the last thing visible is a half-drawn Notes field and **Save sits below the fold** with no edge, no scrollbar gutter and no hint the dialog moves. Every modal sweep to date ran at 390px, where the cap does not bite — this only appears at the width the counter actually works at. Same technique the wide tables got in 678796e, turned through 90°: a `local` surface-coloured mask cancels the shadow at a reached edge, so a shadow only ever appears on a side with more content beyond it. Nothing moves — it is a signal, not a re-layout, deliberately so on a dialog that creates charges. The customer card needed a second pass: it has its own dotted surface and wins on specificity, which would have left the most-opened dialog in the app the only one with no cue. | ✅ gate + modal sweep 1280 & 390 × both themes + staff overflow/contrast audits | owner live-test pending |
| 08-07 | **/login joins the harness** (2b9db5e): the one public page it could not render, so the screen staff open every day had never been screenshotted. Renders clean in both themes at 390 and 1280 — nothing to fix, but it is covered now. | ✅ public audit | n/a (coverage) |
| 08-07 | **The repair failure message did not look like a failure**: `.w-card p` sets muted grey at 13.5px and outranks a bare `.rp-err` (0,1,1 against 0,1,0), so the line telling a customer their request did **not** send — the line carrying the phone number to call instead — rendered as quiet helper text and never once showed the danger colour the rule has always named. Scoped to `.rp-card`. Reached by stubbing a 429 and driving the form into its error state, which no round had done. Measured 6.9:1 light / 6.3:1 dark. | ✅ gate + error state driven EN/HE × L/D + computed colour read back | owner live-test pending |
| 08-07 | **The harness can sign in to the portal now**, and the customer dashboard — balance, statement, rentals, SIM renewal — was rendered for the first time. Session shape copied field for field from `pages/api/portal/me.js`; `/login` exempted from the `dir=rtl` assertion (staff door, English by design, was failing for doing the right thing). It found a defect on the first run: **the "Active" badge measured 4.46:1** against its own green wash on 11px text, an AA miss on the page customers read their balance from — the same bug `--success-ink` was added for in 4d9f4d0, a green tuned for a plain card reused as text on a wash of its own hue. 5.7:1 now. | ✅ gate + public contrast clean both themes after | owner live-test pending |
| 08-07 | **Thumb-sized targets on the customer-facing pages.** WCAG 2.5.8 (24×24) had only ever been measured on the staff app — the public pages are the phone-first half and had never been checked at all. Found 53: the welcome footer's three link columns are stacked standalone nav links on a 22px line box, the phone-guide's per-handset "Call us about the Nokia 105" is 19px, the two guide/repair rows under the services grid are 20px, the nav brand link 22px. Coarse pointer only, min-height only — type and spacing unchanged, each link grows 2px. **The 20 left are links inside a sentence** (phone and email runs in body copy), which 2.5.8 exempts; growing those would have broken the line box for no benefit. *Caught by the gate mid-item: a backtick inside a CSS comment closed the styled-jsx template literal and failed the build. Fixed, re-gated.* | ✅ gate + public audit + contrast both themes + target scan 53 → 20, all exempt | owner live-test pending |
| 08-08 | **UX night (03:10 cron), four items — and again the first one was the instrument.** The four staff **/tools/** pages (contacts, convert, ocr, transfer) sit in the sidebar and had never been rendered by *either* harness. They pull in `<AppStyles/>`, which is a bare `<link href="/app.css">` — generated at build time and a 404 on a `file://` page — so they painted with tokens but no layout: no card, no padding, text flush to x=0. Inlined after globals.css, matching the production cascade order that AppStyles exists to get right. Four screens are now reviewable for the first time. | ✅ gate + public audit + contrast both themes | tooling |
| 08-08 | **The tools pages' only exit was not thumb-sized.** "← Back to the app" is the sole way out of all four /tools/* pages — they carry no sidebar — and it rode a 14px line box, under WCAG 2.5.8's 24px. Coarse pointer only, min-height only. | ✅ gate + target scan clean | owner live-test pending |
| 08-08 | **Bookings hid its status control at 1280.** Measured every scrolling table at 1280/1440/1920: exactly one hid anything — bookings, by 47px. The actions cell was an inline-styled `white-space:nowrap` `<td>` holding three icon buttons and a 110px select, so its minimum was the *sum* of all four: 282px, the widest column in the table. Rentals was cured of precisely this in 015479b by wrapping `.row-actions`; bookings never adopted it. 1069 → 1022px, an exact fit, and the status select now wraps under the icons instead of sitting past the scroll edge. **Checked and left alone:** ~15 other `white-space:nowrap` action cells. None clips at any tested width, and action cells are fixed-width, so more rows cannot change that — no speculative churn. | ✅ gate + node --check + hidden-width scan at 3 widths + overflow audit at 5 | owner live-test pending |
| 08-08 | **The dashboard drill-downs had no keyboard focus ring** — the only such target in the app. The global ring is `:where(…, [tabindex]):focus-visible { box-shadow: var(--ring) }`, and `:where()` holds it at zero specificity *on purpose* so component rules win; `.stat-card` sets its own box-shadow at the same 0,1,0, and app.css loads after globals.css, so the tie went to the card's resting shadow. Found by tabbing every control on all 13 tabs. ⚠ **The trap generalises:** any future component that sets `box-shadow` and is focusable will defeat the ring the same way, silently. Noted in the rule. | ✅ gate + keyboard-focus sweep across 13 tabs (was 1 failure, now 0) + contrast both themes | owner live-test pending |
| 08-08 | *Method note, worth keeping:* the focus sweep first reported **five** failures including every text input and select. Four were mine — `.form-input`/`.search-box` transition `box-shadow` over 0.2s, and I read `getComputedStyle` in the same tick as `.focus()`, so I was measuring the *pre-transition* value. Re-run with a 260ms settle, only the stat-card survived. Any future focus/hover audit in this repo has to wait out the transition or it will invent defects. | n/a (method) | n/a |
| 08-08 | **The public touch-target check is now in the repo**, not in a scratch file: `node ops/harness/public.mjs --targets --width 390`. Runs the pages on a touch device (the 24px rules are scoped to `pointer: coarse`) and models WCAG 2.5.8's inline exemption honestly — adjacent TEXT NODES, stepping over the whitespace JSX leaves between prose and a link, plus an exemption for a control wrapped in a ≥24px `<label>` (the 1×1 file input inside `.tool-drop` is hidden on purpose; its drop zone is the target). **Proved in both directions:** clean as shipped, and it flags 8 instances the moment the `.tool-back` rule is removed. Fixed what it found on the portal footer (`.pd-foot a`). **Deliberately NOT wired into audit-all.sh yet** — 4 findings remain open below, and a check that goes red on arrival gets ignored. | ✅ gate + negative control | tooling |
| 08-08 | ⚠ **Four public touch targets still under 24×24, for the next night** — all the same shape, a contact link standing alone on its own line, which 2.5.8's inline exemption does not cover. `/welcome` ×4 in both languages (`0161 531 1386` 117×16 and 103×16, `support@kosher-connect.com` 235×16 and 201×16 — the markup is `<div><strong>label</strong><p><a mailto></a></p></div>` around `pages/welcome.js:740` and `:757`, so the rule belongs in welcome.js's own styled-jsx, not globals.css) and `/phone-guide` ×1 (`kosher-connect.com` 131×15, `pages/phone-guide.js:216`, a bare `<div><a>` inside the footer — `.pg-foot a` does NOT reach it, so find the real container first). I guessed a selector for these, watched it change nothing, and reverted it: **a guessed selector fixes nothing and hides the finding.** Reproduce with `--targets`. | n/a (found, not fixed) | next night |
| 08-09 | **UX night (04:09 cron), eight items. The theme of the night: everything that only exists while you are using it had never been measured.** The contrast sweep renders a static page, so dialogs, toasts, the command palette and the till were all invisible to it — that is how a 2.92:1 error toast passed every clean audit. Closed that whole class. | ✅ gate + full audit clean after each | — |
| 08-09 | **Cleared the four open public touch targets and wired `--targets` into `audit-all.sh`** (9615367, 6e1bf59). The condition I set myself last night — "a check that goes red on arrival gets ignored" — is met: it is green, so it is in. The four were the shape flagged on 08-08: a contact link alone on its own line, no inline exemption. | ✅ gate + target scan clean, public + staff | owner live-test pending |
| 08-09 | **Toasts were flush against the edge of a phone screen** (0d45150): `#toast-container` pinned `right: 24px` only, so at 320px the box started at x=0 and at 390px it had 6px. Pinned left as well as right; desktop geometry is byte-identical. | ✅ gate + geometry at 320/390/1280 | owner live-test pending |
| 08-09 | **The dark error toast measured 2.92:1** (5aaa99e). `--danger` is lightened for dark surfaces, so white on it is fine in light (4.80:1) and fails in dark — the exact bug `--danger-solid` was added for in 4d9f4d0 and never applied here. 7.51:1 now; light untouched. **This is the finding that named the night's theme:** it survived every audit because a toast only exists while one is on screen. | ✅ contrast measured with a real toast open, both themes | owner live-test pending |
| 08-09 | **`modals.mjs --contrast` — measure the dialogs while they are actually open** (35ca457), and fix the six it found: 49 text uses of `--danger` moved to `--danger-ink` (the literals used `color:var(--danger)`, the generated ones came from JS variables — the first sed caught half), `.avatar` and `.kc-cat-chip.on` to `--on-accent`, `.eq-slide-lbl-n` to `--ink-secondary`. | ✅ gate + node --check + modal sweep 390 both themes | owner live-test pending |
| 08-09 | **The empty ⌘K palette listed the same eight actions twice** (b113356). The Spotlight-style Quick-action tiles were added above the result list and nobody went back to the search feeding it: on an empty query `paletteSearch` returned the top nine commands, and the first eight are exactly the "create" commands the tiles already show. Empty query now returns what the tiles do not carry — the tools and saved views, the entries you cannot reach without knowing their name. Typed queries untouched. Found by adding the palette (empty *and* with a query typed) and the undo toast to the modal sweep; both are contrast-clean, this was the eyes-on finding. | ✅ gate + node --check + sweep 390 both themes | owner live-test pending |
| 08-09 | **The till had never been contrast-measured at all** (37fe88d) — it is not a tab (the tab sweep renders tabs) and not a dialog (the modal sweep opens dialogs), it is what the shop tab *becomes* when you press Sell. Three dark failures on the screen staff use for every sale: `.pos-cat.on` and `.pos-method.on` at 2.62:1 (white ink on the dark-lightened `--accent` — `--on-accent` now, as the category chips and avatar already do), and `.kc-chord` "Ctrl ⏎" at **1.01:1**, a different fault: it sets `--muted`, a *page*-ink token, while living inside a filled button, so in dark it landed on almost exactly the colour behind it. Chords inside `.btn` now inherit the button's ink. `.kc-view-chip.on` carries the same white-on-accent and went with them — pattern-matched, not measured, since the seed has no saved view. Also fixed the public touch-target row in `audit-all.sh`, which was printing the render summary instead of its own. | ✅ gate + full audit + till measured at 390/1280 × both themes | owner live-test pending |
| 08-09 | **The till's scan box read "🔍 Scan a barc" on a phone** (902d1c3): a 168px field holding a 312px placeholder, on the one control staff touch first for every sale; the palette's was 115px over its box. Measured every placeholder in the app against the box it sits in at 390px — tabs, dialogs, till, palette. These two were the only real ones; the rest fit or are textareas, which wrap. Short form under 640px, desktop text unchanged. | ✅ gate + node --check + placeholder scan re-run clean | owner live-test pending |
| 08-09 | **Settings section headers rendered two different ways down one phone screen** (8f0b43b): the header is a wrapping flex row, so whether the subtitle sits beside its label depends on how long someone made the string — SHOP inline, BUSINESS and PEOPLE & ACCESS stacked. Stacked for all below 640px. Desktop untouched: at 1280 every subtitle fits inline, which is why it only showed on the small screen. | ✅ gate + full audit + settings at 390 and 1280 | owner live-test pending |
| 08-09 | *Checked, nothing to fix (worth not re-checking):* the app at 1920 and 2560 (audit clean, tabs scale, nothing stranded); the four `/tools/*` pages now that app.css is inlined; the palette and undo toast for contrast in both themes; the modals at 1280 as well as 390. Also **not** a defect: the tasks tab's date field showing `mm/dd/yyyy` in screenshots — `<input type="date">` follows the *browser's* locale, not the page's, so a UK machine shows `dd/mm/yyyy`. Harness artefact. | n/a (coverage) | n/a |
| 08-07 | 🔒 **Open question for the owner — Hebrew rental dates on the portal.** The date range renders inside `<bdi dir="ltr">`, and a code comment records that as deliberate: left as RTL, the arrow pointed the range backwards (to-date first). But the dates are now *Hebrew* (`2 באוג׳ 2026`), so forcing the run LTR puts the day number on the wrong side of the month for a Hebrew reader. Both readings are defensible and the previous decision was reasoned and tested, so **nothing was changed**. The clean fix is probably to keep the base direction RTL and mirror the arrow (`←` in Hebrew) rather than force the text — but that is a Hebrew-typography judgement and wants a native reader, i.e. the owner. `pages/portal.js:789`. | n/a (flagged, not changed) | **owner to judge** |
| 08-06 | *Investigated, not a bug:* the public harness flags six `/welcome` nav links as "outside viewport" at 390px, including **My account**. They are `.sk-mobnav` chips in a container that genuinely scrolls (scrollWidth 1070 vs 390, `overflow-x:auto`), the desktop copy is `display:none` there, and the footer carries a third full-width copy. The harness note is a false positive — it does not model scrollable containers. No change made. | n/a (investigation) | n/a |
| 08-09 | **UX night (05:24 cron — the night's second firing, after the 04:09 run above), seven items. The theme of the night: the three pages nothing had ever rendered — and the dark state the harness could not tell apart from the other one.** /privacy, /terms and /refund are linked from the welcome footer and the sign-up form's privacy line, and no harness had opened one in four months. What was waiting there was not cosmetic. | ✅ gate ×5 + full audit clean after each (3c8621e wires the third theme state into audit-all.sh) | — |
| 08-09 | **The harness renders the legal pages, and its dark run stopped flattering them** (5b37b4b). The dark run set BOTH `data-theme="dark"` and an OS dark preference, which are two different customers: one pressed the toggle (OS probably still light), one never touched it on a dark phone. A stylesheet answering only to the OS passed the dark run while being wrong for everyone in the first group — which is exactly the bug below. `--theme` now takes `light | dark | dark-os` (a fourth, `light-os`, arrived with the toggle item) and each emulates one state and no other. | ✅ | tooling |
| 08-09 | **The privacy policy was unreadable in dark mode — 1.14:1** (865d613). `LEGAL_CSS` carried its dark palette only under `prefers-color-scheme`, but globals.css redefines `--text` under `:root[data-theme="dark"]` and outranks a bare `:root`: press the toggle and the card kept the light theme's white `--paper` while the ink went pale. Blank page, on all three legal documents, for every dark-mode customer. Paired the palette onto both selectors the way welcome.js already does, and collapsed two hand-maintained blue overrides into one `--link` that flips — `.legal-home` never got its override and sat at 3.04:1, which is the failure a non-flipping token invites. | ✅ measured 1.14 → clean in all three states | owner live-test pending |
| 08-09 | **Thumb-sized targets on the legal pages' six standalone links** (2674d78): back-link 151×18 and the four footer links 16px tall. Their separator is a middot, so 2.5.8's inline exemption does not reach them — unlike the `tel:`/`mailto:` runs inside the body copy, which are exempt and were left alone. Coarse pointer, min-height only. | ✅ target scan clean | owner live-test pending |
| 08-09 | **The dark-pairs check reads both directions now, and covers the legal shell** (7d2c1a6). It only ever looked for a `[data-theme="dark"]` rule missing its OS twin; tonight's defect was the mirror image, and it lived in a file the check did not list. Both directions, plus OS-dark rules written without a `:root:not([data-theme])` guard. Comments are stripped first — these files explain their theme decisions at length and the prose was being read as the rules. **Proved against the real thing:** restored to its pre-fix state the shell reports all three faults by name, welcome.js stays green. | ✅ + negative control | tooling |
| 08-09 | **Choosing light on a dark phone gave you the dark page back** (903af11). The toggle wrote `kcTheme='light'` and then *removed* `data-theme`, so an explicit light choice was indistinguishable from never having chosen — and that absent attribute is exactly what the OS-dark palettes on /welcome and the legal pages key on. Light is written out now in all three places that own the attribute (pre-paint script, staff `toggleTheme`, `ThemeToggle`). Nothing keys on the attribute merely being present, so the dark path is byte-identical. | ✅ + /welcome and /privacy both render light in the new `light-os` state | owner live-test pending |
| 08-09 | **The legal pages get the theme toggle every other public page has** (c1401f1) — they are the pages a search result drops someone into cold, and they were the only public pages with no way to change theme. In the header row beside the back-link, not `position:fixed`, which is how that control landed on top of /repair's "My account". Placing it exposed a state the toggle could not read: with no choice stored it asked `<html>` for `data-theme`, found nothing, and offered "go dark" on an already-dark page — first press did nothing visible. It reads the page's actual background in that one case now. | ✅ four states driven: terms light/dark/dark-os + portal on a dark OS (light by design), right icon and one-press flip in each | owner live-test pending |
| 08-09 | **The portal was cut off on a small phone, and worse in Hebrew** (5eb600e). Two faults on the page a customer opens to read their balance. The top bar's four controls do not fit one line on a narrow screen: "Sign out" ran 26px past the edge at 320 in English and, in Hebrew, off the *leading* edge at 320, 340, 360 **and 375** — an iPhone SE/mini. Both harnesses render 390 and 1280, and 390 is the first width where Hebrew fits, which is exactly why no sweep had seen it. The row wraps when it genuinely does not fit rather than at a guessed breakpoint (where it stops fitting depends on the language — Hebrew needs ~15px more), and side padding tightens below 420 to buy Hebrew back its single line at 390. Separately every `.pd-card` was 23px wider than the column holding it at 320: a grid item's default `min-width` is `auto`, so a `1fr` track will not shrink below its content's min-content width — `minmax(0, 1fr)` now. | ✅ gate + full audit + both edges measured at 320/340/360/375/390/412/430 × EN/HE: seven overflows before, none after | owner live-test pending |
| 08-09 | **The public harness runs 320px now** (its widths were 390/1280 while the staff one has always run 320). That gap is the whole reason the row above survived; it is green at 320 today, so it is wired into `audit-all.sh`. | ✅ | tooling |
| 08-09 | *Checked, nothing to fix:* the staff app in all its existing sweeps (overflow ×5 widths, contrast, targets, modals ×2 themes) — clean throughout, nothing regressed. Then, on the strength of the portal finding, the staff side at **320px** as well — every modal geometrically clean in both themes, no touch target under 24×24. The small-phone fault was the public half only. **Deliberately not touched:** translating the three legal documents into Hebrew. The welcome footer links to them with Hebrew labels and they are English-only, but legal wording is the owner's to approve, not a loop's to machine-translate. Flagged below. | n/a (coverage) | n/a |
| 08-09 | 🔒 **Open question for the owner — the legal pages are English-only.** /welcome, /portal, /repair and /phone-guide are all bilingual and the Hebrew welcome footer says מדיניות פרטיות · תנאים · החזרות — all three land on English documents. Translating a privacy policy, terms and a refunds policy is a content decision with legal weight; the loop should not machine-translate it. If you want it, the shell is ready (one `dir`/`lang` switch and a string table, the same shape /repair uses). | n/a (flagged) | **owner to judge** |

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

> **Un-hold email** — the same item as the 🔒 entry higher up this file, not a
> second one. Resend is configured and in TEST; every
      message redirects to the test inbox. Receipts, reminders and sign-in links
      reach nobody until `MAIL_TEST_TO` is removed and `MAIL_LIVE=true`
      (`docs/EMAIL-GO-LIVE.md`). Owner's flip. This also unblocks the status-SMS
      drafts and the review-ask on receipts.
> **Open a business bank account** — the same item as the 🔒 entry higher up
> this file. Unchanged and still the blocker: the shop's money runs through
> Shloime's personal account, so no bank feed can be connected without pulling
> his personal transactions in.
> **Fill in the Google Business Profile** (~20 min, owner) — the same item as
> the 🔒 entry higher up this file.
- [ ] **P1 · M** 🔒 — **241 SIM numbers with 2026 provider mail that the app has
      no record of**, plus 119 rows marked `active` with no mail since before
      2026. The SIM list is what the business runs on and it is out of step with
      the shop's own mailbox. Full write-up in `docs/GMAIL-SWEEP-2026-07-31.md`.
      **08-16: the pipe that stops this recurring is built** — carrier mail now
      forwards into `/api/inbound/mail`, pairs to a SIM on the per-SIM recipient
      address (417 exactly, 317 via the number in the message), and the daily
      sweep raises SIMNEW for numbers that are live at a carrier but absent from
      the app. Setup steps in `docs/INBOUND-MAIL.md`. Remaining: the owner's
      three config steps, then a queue screen for the unpaired pile
      (`sim_mail.resolved_at` is written by nothing yet).

### Money not being collected

- [ ] **P1 · M** 🔒 — **77 virtual numbers bill nobody.** `billing_enabled` is
      false on every row. The ELID subscription list shows roughly **£772/month**
      of recurring revenue across ~30 accounts. Blocked on the balance question
      below — turning billing on before that is settled risks double-charging
      people who already pay in the shop.
- [x] **P1 · S — ANSWERED by the owner, 21 Aug.** **The −£3,330.09 question.**
      There are TWO layers on ELID, which is what the import could not see:
      every customer has their own ELID account, and Shloime sits above them on
      a reseller platform. Money moves customer → shop → Shloime → ELID
      wholesale; ELID pays Shloime, and the balance sits on his reseller
      account. So the per-customer balances in the import are **ELID's own
      accrual meter on each customer's account, not a debt to KC** — which is
      exactly what the arithmetic in `docs/ELID-IMPORT-2026-08-06.md` showed
      (charges accrued, no payment ever posted).
      **So: no ELID balance is ever posted to a wallet, and the ~30 accounts are
      not blocked by customer debt.** The one thing that would overturn this is a
      customer paying ELID DIRECTLY rather than through the shop; the owner has
      not reported one, and it would need its own answer if it ever happens.

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
- [ ] **P2 · S** — Drop the undo/staging tables once the above are signed off.
      **Counted 21 Aug 2026: there are 61 of them** — 3 `undo_*` and 58 `zz_*`,
      the oldest from 29 July. The entry used to name two patterns and read as a
      tidy-up; at 61 tables it is most of what `list_tables` returns, which is
      its own cost every time anyone reads the schema. They are snapshots taken
      before bulk writes (the merges, the name splits, the flights import), so
      each one is only droppable once the write it guards is signed off — that
      is the work, not the DROP.

### Engineering hygiene

- [ ] **P1 · S** — **Turn on branch protection requiring the `verify` check.**
      `ci.yml` has said this since it was written; without it a red CI blocks
      nothing, as 08-06 demonstrated when two runs died in a GitHub Actions
      incident and neither stopped a merge.
- [ ] **P2 · M** — **`sims` has no typed number column.** All 840 SIM numbers
      live in `legacy_extras.simNumber` as untyped JSON, so nothing can index or
      constrain them.
      **Counted 21 Aug 2026** (797 rows now): 763 hold a usable UK mobile, 34
      hold none at all, and **exactly one number is on two plans** —
      07368293198, active on both Smarty (`pl-sim-284`) and giffgaff
      (`pl-sim-612`), same customer, and it is his own contact number. It reads
      like a port where the old plan was never closed; neither row carries a
      renewal date, so nothing in the app says which network is live. Raised as
      task `SIMDUP-7368293198` — the answer is the owner's, not a guess.
      **What the column is worth, and what it is not.** A typed column that
      nothing reads is the fault `docs/clarity-scan.md` T2.13 names, so it is
      only worth adding with the two things that need it: a **unique index**, so
      two plans can never claim one number again, and the carrier-mail matcher
      reading it instead of the blob. The unique index cannot go on while that
      one pair stands, which makes the task above the real first step.
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

---

## UX loop — night of 2026-08-16

| Item | Commit | Screens |
|------|--------|---------|
| Simple Mode reaches text that never asked for a size. `body { font-size: 15px }` was a bare pixel value, so anything WITHOUT its own font-size inherited a size the text-size control could not touch — "£80.00 still to pay" on the finishing card, the business summary's section headings and the task-list descriptions all sat at 15px while their neighbours grew 30%. It goes through `--fs-scale` like every other ramp step; `calc(15px * 1)` is byte-identical at Standard | 2725713 | every screen at text large/largest |
| `ops/harness/textscale.mjs` joins the nightly sweep (~37s): all ten tabs and every modal rendered at `standard` AND at `largest`, with the computed size of 1141 text elements diffed. Catches what neither render shows alone. Two kinds hold their size on purpose and are allow-listed with the reason beside each — the Aa button (it would grow under the finger pressing it) and the card-action glyph | c6c5428 | tooling |
| The type-ramp sweep was already done and the backlog's "~455 remaining" was stale — measured: 563 inline declarations, 556 on a ramp token, and all seven survivors correct (three print CSS, four emoji glyphs). Recorded as tidying so it stops being carried as a P1 | e770510 | backlog |
| SIM plans, bookings and repairs each printed a create button with the same label and action as the topbar's, visible in the same screenful ~350px below it. Customers, Wallet and the Dashboard never did; Rentals and Shop put theirs in a row of several, where it reads as a group. The first record on a phone moved up 40/40/38px | bfb6723 | SIM Plans, Tickets & Flights, Repairs |

| Ten interactive controls announced as nothing to a screen reader: two time fields sharing one label (the existing label pass names only a group's FIRST control), three fields headed by a plain `<span>` or a label outside any `.form-group`, the returned toggle (now `role=switch` with `aria-checked` following the knob), both halves of the equipment slider, and three table cells `kcMarkClickable` had turned into unnamed `role=button` tab stops because their only onclick was an `event.stopPropagation()` guard. `ops/harness/names.mjs` joins the nightly audit | 8e32f8b | Manage Rental, New booking, Manage SIM, Draft reminder + tooling |

| `render.mjs --long` stretches every seeded string to real shop length ("Yakov Mendl Bindinger (TomTom)", "Tomtom S/N ZO1357I02581") and joins the audit opposite `--empty`. Nothing failed today at 320/390/1280 — including the surname-first list, which wraps a long name and keeps the surname leading — so it is a guard, not a fix | f6463e9 | tooling |

| A banded stat that turns red now says why. "Available phones — 1 — Ready to rent" painted the 1 in danger red and left the words unchanged, so colour was the whole message; the sub-line now follows the band ("only 1 left to rent", "none left to rent", "4 due back today", "chase these") and neutral bands keep the card's own wording. Same principle the availability calendar got in July — colour may carry the news, never alone. Bands unchanged and still owner-tunable | 59accf3 | Rentals, Wallet |

Discovery: a text-scale diff written from scratch, which is what found the
`body` size — nine Simple Mode sweeps had looked at those screenshots and none
could see it, because the failure only exists BETWEEN two renders. Also swept
clean, no change needed: truncated text with no way to read the rest (nothing
at 320, 390 or 1280 — the only hits were `.kc-sr-only`, which is clipped on
purpose); the public pages' Hebrew; reduced motion.
Verified per item: gate (255 tests ×2 TZ + build) exit 0 and full audit-all
clean before each commit, plus harness re-renders of the touched screens.
Owner decisions pending: none new. The till's `.pos-methods` wrap stays ⚠.

## UX loop — night of 2026-08-20

| Item | Commit | Screens |
|------|--------|---------|
| `/manual` had silently dropped out of the offline page harness. The screenshot pipeline added `import fs from 'node:fs'` at module scope: Next strips `getServerSideProps` from the client bundle so the app never noticed, but the harness parses the module as written, and four checks (en/he × 390/1280) went from pass to fail. Server-only modules moved inside `getServerSideProps`, and `shots` defaults to `{}` because the harness renders components with no props — the pictures were always meant to degrade to the text page. Both held by `test/manualShots.test.mjs`, checked by putting the import back | f2b5b0a | /manual, tooling |
| The manual's contents was 29 screen names in one flat grid — a list you read start to finish to find anything, running to fourteen rows at 390px. It now carries the same three headings the page below already uses, word for word, so contents and page agree and a reader can aim at a section | 5d85d27 | /manual |

Discovery: the automated sweeps are all clean — contrast (light and dark), tap
targets, overflow at 390 and 320, text scale, loading ghosts, focus stops,
accessible names, card fit. Prior loops have done their work, so the night's
finding came from running the *public-page* harness, which is the one sweep
that renders whole pages rather than the app shell.

Two candidates investigated and deliberately **not** built:

- **Dark-mode variants of the 44 manual screenshots.** Rendered a real
  screenshot inside the manual's dark palette to judge it rather than guessing.
  The figure already carries a border and a muted caption and reads as an inset
  document, not glare. Dimming it would cost legibility of small text, which is
  the opposite of accessible. Shooting dark twins would add ~3 MB to the repo
  for colour fidelity on a reference page — poor value, and the owner has
  already flagged image weight. Left alone.
- **The portal ignoring the OS dark preference.** Looked like a real gap —
  `styles/globals.css` has 16 `[data-theme="dark"]` rules and no
  `prefers-color-scheme` twin for them. It is deliberate and documented at
  `styles/globals.css:1135-1141`: the stylesheet has no OS-dark palette at all
  and `html` pins `color-scheme: light`, so an OS-preference rule there would
  swap the dark artwork onto a light panel — the exact bug it replaced,
  inverted. Refuted by a comment that anticipated it.

## UX loop — night of 2026-08-15

| Item | Commit | Screens |
|------|--------|---------|
| Three kinds of keyboard stop that matched `:focus-visible`, were genuinely focused, and painted nothing: the Rentals drill-down cards (`.stat-card[role=button]` without `.dash-link`) and every scroll region `kcSyncScrollers` makes focusable for WCAG 2.1.1 — both lost the zero-specificity `--ring` to their own resting box-shadow, so both take an outline instead. Plus the sidebar, whose ring was translucent blue at 22% on navy: invisible, and it is how a keyboard gets anywhere | 07f9726 | Rentals, every scrolling table, the sidebar on every screen |
| `ops/harness/focus.mjs` joins the nightly sweep in both themes (~25s each) — the first check here that measures a STATE rather than geometry or colour, which is why three invisible stops survived every clean run. Must press a real Tab first (`:focus-visible` only matches once Chrome believes focus is keyboard-driven) and must wait out the transition (focus styles animate); both written at the top of the file. The palette's search box was the last real finding — `outline:none` is its design, so it lights its underline instead | 73f968b | tooling + ⌘K palette |
| Rentals only offers to Clear when something is actually filtered — the chip was unconditional, so the busiest staff screen carried a permanent control that mostly did nothing, sitting under three dropdowns all reading "all". Every other tab already asks `kcViewIsFiltered`; this one predates the helper | f3e03e8 | Rentals |
| The day-one state joins the nightly audit: `render.mjs --audit --empty` at 390px, so an empty tab has to render AND fit. An empty state is usually a centred block, which is the shape that escapes a narrow column when nobody is looking | ffd35fb+ | tooling |
| `render.mjs --empty` renders every collection empty — day one, or a search that matched nothing, a dimension the full seed could never show. Most empty states read well; two didn't. The dashboard clock put its seconds after the pulsing dot, so the strip read "04:07 · 42 · SATURDAY 15 AUGUST 2026" with a bare 42 among bulleted facts; seconds now join the time with a colon and the live dot moved to the end, where it also does the separating. And the wallet's empty feed announced "Recent activity · last 0" | cfa98eb | Dashboard, Wallet, tooling |

Discovery: a focus probe written from scratch, which took three attempts to
stop lying — programmatic `.focus()` does not match `:focus-visible`, and
computed styles read in the same tick return pre-focus values. Both traps are
now documented in the tool. Public pages re-eyeballed in Hebrew at 390 (repair,
portal): clean, including the bidi on prices and the Direct Debit Guarantee
line. Reduced-motion support checked and already complete — a global blanket
rule plus per-component overrides, nothing to do.
Verified per item: gate (255 tests ×2 TZ + build) exit 0 and full audit-all
clean before each commit, plus harness re-renders of the touched screen.
Owner decisions pending: none new from this loop. The till's `.pos-methods`
wrap stays ⚠ and unbuilt.

## UX loop — night of 2026-08-14

| Item | Commit | Screens |
|------|--------|---------|
| Harness renders British dates — every screenshot showed "08/14/2026" and prompted "mm/dd/yyyy" because a native date input takes its format from the browser's locale, which only LANG reaches (not `lang="en-GB"`, not Playwright's `locale`). All four launches share one BROWSER_ENV. Also registers three surfaces built 08-13 that no sweep had ever opened: the finishing card, the stacked New-pool card, the business summary | 0ba220f | tooling |
| Business summary: a period with no money in it said the same nothing five times (four £0.00 tiles, a 0% meter, "Nothing charged") — one line now, trend kept because that is where an empty week gets its meaning; a refunds-only period is not blank. And the revenue bars overflowed a 320px card in Simple Mode (label 138 + track 40 + amount 118 + gaps = 316 into 304), cutting the amount mid-figure and pushing the share % off screen — the row wraps, width-driven, so nothing moves where it already fitted | ba190ba | Dashboard → 📊 Business summary |
| Harness: a seed key may carry a query and wins by prefix. `/api/ledger` answers two shapes and the stub keyed only on the path, so the summary rendered as an empty period in every sweep — which is exactly how the overflow above survived every clean audit. `/api/ledger?report=1` now holds a real report payload | 9c535ca | tooling |
| The finishing card says what is still to pay: a part-paid rental left "£80 on account" in small muted grey beside a display-type £140, so the number the counter must act on was the quietest thing on the card. Own line, measured AA red, weight first so it survives greyscale. Only the two rental flows pass it — the two that already compute the figure; nothing is derived, nothing is charged | 25887f0 | Rentals → after save |
| audit-all sweeps the hardest corner of the grid: 320px at text `largest`, every tab. It was only ever run as separate axes (320 at standard, 390 at largest). Passes today, so it can only go red on a regression | 6cc326f | tooling |

Discovery: the modal sweep at 320 / text `largest` was run by hand over all 27
surfaces — everything clean except the till, which is the ⚠ item already logged
above and was not touched. Contrast measured on the three newly-registered
surfaces in both themes: clean. The business-summary bar overflow came from a
scratch fixture with real numbers in it, which is what prompted the seed fix.
Verified per item: gate (255 tests ×2 TZ + build) exit 0 and full audit-all
clean before each commit, plus harness re-renders of the touched screen at
390 dark and 320 / largest.
Owner decisions pending: none new from this loop. The till's `.pos-methods`
wrap stays ⚠ and unbuilt, and the modal sweep at largest stays out of
audit-all until it is fixed.

## UX loop — night of 2026-08-13

| Item | Commit | Screens |
|------|--------|---------|
| Hebrew calendar: the Hebrew day leads its own view — it shipped as the 9px 65%-opacity subtitle under a bold Gregorian date. The two spans are roles now, not languages; Gregorian months unchanged | 220daac | Rentals → Availability |
| Harness: the duplicate review joins the nightly modal sweep — needed a faithful `/api/customers/duplicates` fixture plus two customers a scan can plausibly pair | df3697a | tooling |
| Duplicate review: one card per pair, with OR between the sides so a pair still reads as a pair once a phone stacks it; header says WHY the scan flagged them (same phone / same name / ELID import / one side holds nothing); name buttons 17px → 24px | aadd235 | Customers → 👥 Duplicates |
| New rental: the multi-phone count stopped lying (never rewrote itself downward) and stopped overwriting the availability hint the date fields put in the same slot | c1bd25e | Rentals → New rental |
| Modal footers wrap — at Simple Mode largest, Manage Rental's "💾 Save changes" sat 53px off a 390px screen. Four modals shared the pattern; `.modal-actions-group` replaces the inline flex written out four times | b3e76d7 | Manage Rental, Edit Booking, House account, Stock item |
| `render.mjs --fs` — Simple Mode over the 13 tabs, wired into audit-all (tabs at large+largest, targets, dark contrast). Plus a 320px modal sweep, which found Manage SIM's Close button 26px off screen | aeccd1d | tooling + SIM Plans → Manage SIM |
| Kol Torah at counter width: section headings stopped breaking mid-phrase ("Conversion" / "jobs" beside a one-line description), and a job stopped stacking as CD / → / MP3 / × 3 — a 5-line row becomes 2 | fb0982a | Kol Torah |
| Consignment chips ellipsize instead of running off the screen — a real shiur title overflowed 320px by 51px, found by re-seeding every display string at the length the book actually reaches | 9cffb03 | Kol Torah |
| The hourly-timer picker shows its own prompt — squeezed to 189px at exactly 390px it read "Who are you helpi", though 320px was fine because the Start button had already wrapped away | a8cbb58 | Online & Print |
| The duplicate queue counts down as it is worked: settling a pair renumbers the rest and updates the total (they were counting against the figure at load), and working the queue to zero says so instead of leaving a heading over nothing | 44e72c3 | Customers → 👥 Duplicates |
| The same treatment generalised to `.badge-clip` and taken through the modals: a flight route ran 84px off the customer card, and a long email address ran the receipt tick-box off the wallet's Record payment modal | 4eb9dca | Customer card, Wallet, Kol Torah |
| One name and one case for the last four create buttons (SIM plan, job, number, charge a service — three of which the top bar and the tab called different things); two empty states that had no way out gained one; found by rendering all 13 tabs with the data emptied, which no sweep had done | 80f420d | SIM Plans, Kol Torah, Virtual Numbers, Online & Print, Rentals |

Discovery, four lenses, in the order they paid off: audit-all was clean before
any fix, so the night started by opening the surfaces built in the last 48h at
counter width (Hebrew calendar, multi-phone New Rental, bulk-return bar,
duplicate review — the last two of which no harness had ever opened); then the
modals at all three Simple Mode text sizes, which nothing had run since the
last modal changed, and at 320px, which nothing had ever run; then all 13 tabs
with the seed emptied, which found the copy that names buttons no longer
called that; then all 13 tabs and all 24 modals re-seeded with strings at the
length the book actually reaches ("Yakov Moishe Yehoishua Bindinger-Grinfeld
(Antwerp)"), which found three chips and one label escaping their containers.
Two lenses came back clean and are worth recording as such: focus rings on
every new surface, and the tab sweep in Simple Mode.
Verified per item: gate (tests ×2 TZ + build) exit 0, harness re-render of the
touched surface in both themes; audit-all clean end to end at the finish.

**Skipped, needs an owner decision:** the till overflows sideways at 320px from
Simple Mode `large` upward (+13px at large, +43px at largest — `.pos-methods`,
a row of payment-method buttons that will not wrap). It is a wrapping rule, not
charge logic, but the till is the customer-charge surface this loop does not
touch. Wiring the largest-size MODAL sweep into audit-all is held behind it, so
that check does not go red every night — the by-hand command sits in the script.

## UX loop — night of 2026-08-12

| Item | Commit | Screens |
|------|--------|---------|
| Login privacy/terms links: 24px touch targets (shipped at 13px tall with the OAuth-review row) | ad560a0 | /login |
| SIM manage modal wears status badges instead of raw lowercase enum; empty Next-DD dash no longer painted success-green; customer card/page drop the dangling "Since —" on imported customers; bookings passenger card hides ✕ on the only passenger; bookings row icon buttons gain aria-labels | ceaa6d3 | SIM Plans, Customers, Tickets & Flights |
| Harness: elements inside a designed horizontal scroller (welcome mobile chips) no longer reported as "outside viewport" — the false alarm cost tonight's first investigation | 4d7e896 | tooling |
| Portal speaks the legacy 'out' rental status: Hebrew customers saw raw English "out" in a grey badge and never got the "N days left" line | 446c5a8 | /portal EN+HE |
| One case for every create button: quick actions, tab primaries, modal titles, palette commands and empty-state copy all say "New rental / New booking / New repair / New customer" (three casings sat on one dashboard row) | 2ce8b3c | Dashboard, all four create flows |

Discovery: full audit-all clean before any fix (overflow ×5 widths, contrast
both themes, targets, modals ×2 themes, public EN+HE ×3 theme states, dark-rule
pairing) — so the night's items came from eyeballing screenshots: dashboard +
bookings at 1280, all 19 modals at 390 dark, portal HE at 390. Verified per
item: gate (255 ×2 TZ + build) exit 0, harness re-render of the touched screen.
Owner decisions pending: none new (Hebrew date-direction and legal-page
translation remain open from 08-07/08-09).

## UX loop — night of 2026-08-11

| Item | Commit | Screens |
|------|--------|---------|
| Availability: Today button appears when viewing another month; legend wraps as whole chips and takes its own row ≤640px | 0c3119c | Rentals → Availability |
| 390px topbar: all five controls (Ask/Search/primary/theme/Aa) fit one row — Aa no longer strands on line two | 6a2fd3d | every staff page |
| Sticky column headers in every scrolling table wrap (rentals + inventory split columns, settings cards, modal statement boxes) | cb36cd5 | Rentals, Settings, modals |

Discovery sweeps, both clean (no fix needed): 13-tab overflow audit at 390px;
new surfaces (pools modal, void modal, customer-card passport/house strips,
bulk bars) eyeballed at 390 light+dark; full public-page render EN+HE at
320/390/1280 light+dark — every page geometrically clean and RTL correct.
Verified per item: gate (tests ×2 TZ + build) exit 0, harness screenshots.
Owner decisions pending: none from this loop.

## UX loop — night of 2026-08-10

| Item | Commit | Screens |
|------|--------|---------|
| Capitals tidied on every displayed name (escName wraps all 85 name sites; imports showed lowercase) | 3d61e82 | all tables, cards, modal titles, pickers |
| Provider tints on the Virtual Numbers platform column (same badges as SIM Plans) | 611601a | Virtual Numbers |
| 390px: wallet arrears row — name no longer paints under the −£ amount; action button gets its own line | 09eef9f | Wallet, dashboard feed rows |
| 390px: topbar Ask/Search collapse to icons (aria-labels kept) — bar stops wrapping to three rows | (this commit) | every staff page |

Verified per item: gate (251 tests ×2 + build) green, harness screenshots
light+dark at 1280/390. Nothing skipped. Owner decisions pending: none from
this loop — but see the day's thread: 14 import-created customers may need
merging, and the "Card details" sheet with CCVs should be retired.

## UX loop — 2026-08-11 (owner-requested pair, prototype for judgment)

| Item | Commit | Screens |
|------|--------|---------|
| Line state control on Edit Phone: retire (dead/expired) / not working / permanent — number + rental history kept, line stops being offered; distinct table badges (were all wearing green "Available") | (this commit) | Rentals · Edit Phone modal, phones table |
| New Rental picker greets returning customers: lines they held before sort first with "↺ had <date>"; hint shows the count | (this commit) | Rentals · New Rental modal |

Verified: gate (255 tests ×2 TZ + build) exit 0; harness shots light+dark of
both modals. Reviewer sub-agent BLOCKed round 1 (3 findings, all fixed same
cycle: --danger-ink on the Not-working badge per the repo's measured AA
standard; Edit-modal status header taught the five non-available states so it
can't contradict the select; lastHeldByNote preserved on the available flip
like markPhoneBack). Also took its recommendations: retire/not_working blocked
while a live rental sits on the line (reconcile would silently undo it), picker
resort cleared when the customer is retyped, hint copy degendered + count from
data not glyph-sniffing. Owner live-judges on the dev branch before any ship
(their explicit ask, so no auto-ff).

## UX loop — night of 2026-08-17

| Item | Commit | Screens |
|------|--------|---------|
| Search that matches nothing offers "✕ Clear search" and quotes the term back — every other list already had this; Customers was a dead end with the term still in the topbar box | 429666b | Customers · empty state |
| Customers stops scrolling sideways on a phone: 711px of table in a 360px viewport became one card per person (name · email · phone · service chips · balance · buttons). Opt-in `.kc-stack-sm`, desktop table unchanged | ca022eb | Customers · list at ≤560px |
| Rentals gets the same treatment — the widest list in the app, 1026px inside a 360px viewport, so the balance, the status and every row button were off-screen. `.kc-stack-sm` grew `data-label` (a cell that only made sense under its header gets the header back: "From → To", "Price") and `.kc-stack-lead` (the select tick-box floats beside the name instead of taking a line) | 00f800a | Rentals · list at ≤560px |
| The last two targets in the app under the 24px floor, both in Settings: the rail's jump links were 226×**23** slivers (twenty of them, stacked 2px apart) and "Find a setting" was 226×**18**. Both now 34px. `--targets` reports a clean app for the first time | 39b2cd4 | Settings · rail at ≥1100px |
| SIM Plans stacks too — 884px inside a 360px viewport. Four labels (`SIM`, `Plan`, `Renews`, `Payment`), because a bare number next to a bare number next to a bare date is where a stacked table stops being readable. The plan column's clip-to-160px moved out of an inline style into `.kc-cell-clip`, so on a card it says the whole plan | a007663 | SIM Plans · list at ≤560px |
| Kol Torah's two tables stack: conversion jobs (+369px) and the titles catalogue (+391px). The titles table is a row of bare inputs, so stacked it becomes what it always was on a phone — an edit form, one field per line under its own word | 0c85ed9 | Kol Torah · jobs + titles at ≤560px |
| Phone inventory (+251px) stacks too, which leaves no list in the app scrolling sideways on a phone. New `.kc-drop-sm`: pool and pool-expiry are a USA-only fact, so on the other rows those two cells leave the card rather than say "N/A" twice | 71ba0b3 | Rentals · phone inventory at ≤560px |

## Owner request — 2026-08-17: one customer picker

> "something's wrong with this dropdown…. i need same customer dropdown logic
> throughout the system!…. copy from other places in our app, or even better,
> make it should always uses from the same place."

The screenshot was the Services help timer: 609 names in alphabetical order, two
Fishel Thalers and two Frishmans with nothing to tell them apart, no way to type.

There were **three** implementations of "pick a customer" — a plain `<select>`
in ten places, a bespoke type-ahead on the rental form, and a generic combo used
by SIM plans alone — plus a twelfth hand-rolled option list on the timer itself.
Now there is one: `customerPicker()` in `public/main.js`.

| | |
|---|---|
| Pickers now built by the one function | 11 (wallet, help timer, charge a service, rental, SIM plan, booking, repair, virtual number, Kol Torah job, Kol Torah shul, till) |
| Lines of picker code deleted | `kcCustomerOptions`, `customerComboHtml`, `filterCustomerDropdown`, `selectRentalCustomer`, `rentalPickerKey`, `customerDropdownRow`, `KC_COMBO_ADAPTERS`, `openNewCustomerCard`, `createCustomerFromCard`, the `__new_customer__` capture-phase interceptor |
| What every picker gained | recency-first list · search by phone digits · the number beside each name · arrow keys + Enter · a ✓ line naming who was picked · quick-add · drop-up/scroll instead of clipping |

Three real bugs fell out of the unification, each caught by the new harness:
`.table-card { overflow: hidden }` was clipping the timer's list to two pixels;
the till's list opened on a search for the words "🚶 Walk-in" and found nobody;
and clicking into an already-linked picker used to clear the pick (which is how
a shul's wallet link was being silently unset on edit).

New: `node ops/harness/picker.mjs` drives all eleven and fails if a twelfth ever
turns up hand-built. Verified: gate (429 tests ×2 TZ + build) exit 0, picker
harness green, modals/names/focus/contrast/targets sweeps clean.

## Owner request — 2026-08-17: the help timer, out of the app

> "build me that the online and print 'timer' should come up even when OUT of
> the app. like it should stay pinned (and movable) in front (say bottom right
> corner) of pc even while doing the work on othe sites. an extension maybe?"

Built as **Document Picture-in-Picture**, not an extension. An extension can
only draw inside a browser tab, so it would vanish the moment the work moved to
a program that is not the browser — which is much of what "online help" is. Doc
PiP is a real always-on-top OS window: it sits above every other window
(browser or not), drags anywhere, resizes, and survives switching tab, site and
desktop. No install, no store review, no permissions.

`⧉ Float on top` on the running-timer card and on the floating chip, plus a
command-palette entry. The window shows who is being helped, the clock, what it
will cost so far, and Pause/Resume + Stop. Stopping from the window brings the
app forward with the charge form already filled in. The in-app chip stands down
while the window is up, so there are never two clocks.

The price, and it is stated in the guide: Chrome or Edge (the shop's Mac runs
Chrome), and the app's tab must stay open — buried behind everything is fine,
closed is not. The button is not offered at all where the browser can't do it.

New: `node ops/harness/popout.mjs` drives the window in both themes — clock
moves, pause from the window pauses the app, stop from the window opens the
charge form with the customer and the money in it. Wired into `audit-all.sh`
alongside `picker.mjs`. Gate green.

## Owner request — 2026-08-17: Shmuel = Shmiel Y Bleier

Merged, on the owner's instruction ("merge, but only the name is duplicated —
all other records shall be at the merged contact"). Survivor **Bleier, Shmuel**
(`pl-shmuel-bleier`, +44 7703 572 578); `pl-smiel-yecheskel-bleier` folded in.
Snapshot taken first. Moved: 3 SIMs, 7 money lines. Result: one record, 4 SIMs
(1pMobile 07918 917728, two Lebara, Tello 3472328220), 22 flight bookings, 1
virtual number, 23 money lines, £1,085.00 balance, no orphans.

**Still open, for the owner.** That £1,085 is not credit he earned — it is
seven Stripe card payments dated 16 Aug (£670, £178, £120, £47, £35, £25, £10)
with no charges behind them, and the £670 is exactly the ticket price of his
Booked flight for 3 Nov. His 22 bookings carry £16,416 of tickets and £445 of
fees, and none of it was ever posted to his wallet. Needs a decision about
posting the missing charges, not a guess.

Three things the merge itself was missing, all fixed the same day:

| Gap | Fix |
|---|---|
| A merged-away spelling stopped being findable — the shop had typed "Shmiel" for a year, and search reads only the surviving name | `lib/customerSearch.mjs` — ONE `customerMatches()` for the Customers list, the picker and the palette (they had three), matching on `aka` as well as the current name. `merge.js` now writes `aka` on every merge. Mirror-tested |
| `merge_customers()` never moved `sim_mail`, and that FK is ON DELETE SET NULL — so a merge silently unlinked the duplicate's carrier mail and it would reappear in the queue as unpaired work | migration `20260817200000`, applied. This pair had none, but 470 customers carry a SIM the shop runs |
| The carrier login (`accountEmail`) was lost with the deleted record, though its SIMs were moving to the survivor | `merge.js` carries it into the gap (a survivor that has one keeps it) |

Gate green (435 tests ×2 TZ + build); picker + names sweeps clean.

## Owner request — 2026-08-17: the loading state

> "dont feel that this pre-loading thing is correct for each screen, and its
> also only half of the page's length"

Two faults in one sentence, both fixed.

**It should not usually be there at all.** Every one of these loads comes back
in well under a quarter of a second, so the ghost appeared and was replaced
inside 200ms — which does not read as loading, it reads as the page changing
its mind. The wait now starts empty and the ghost only arrives after 250ms, so
in normal use it is never seen. Cancellation is automatic rather than something
each render has to remember: the pending paint checks its render is still the
current one and that nothing has painted into the column since.

Five tabs turn out never to wait on the network at all (Shop, Repairs, Virtual
Numbers, Kol Torah, Settings) — they now show nothing instead of a ghost.

**When it is there it reaches the fold.** It was stopping at 658px of a 900px
screen. The row count is now measured from the viewport — and the pitch is 22px
per row, not 31: the 9px margins COLLAPSE between rows, which is what made the
first attempt still stop two-thirds of the way down. Ghost now ends at 874 of
900, rows and all.

Also fixed, same session, from the red toast in the corner of the owner's
screenshot: typing a name into a picker and reaching straight for the button
next to it threw the name away, so "Start timer" answered "Pick who you are
helping" about the person whose name was on screen a second earlier. A typed
name that matches exactly one person is now taken as that person — the same
bargain Enter already made. Ambiguous input is still refused rather than
guessed at.

New: `node ops/harness/loading.mjs` — fails if any tab flashes a ghost on a
fast load, or if a real (1.5s) wait ghosts short of the fold, at 1280 and 390.
Wired into `audit-all.sh`. Gate green.

## Owner request — 2026-08-17: "where is it editable from"

> [arrow pointing at "= £32.25 — editable"] "where is it editable from - u see
> i treid to change in notes but no real effect on calc"

The line claimed something was editable without saying **what** or **where**.
The nearest box to it was the Notes field, so that is what got edited — and
editing a note quite rightly moves no money, so the app looked like it was
ignoring them. What they were actually trying to do was charge 44 minutes
instead of 43.

The minutes are now the thing you type into, and the money follows:

| | |
|---|---|
| `⏱ [44] min at £45/hr = £33.00` | the number is an input; the total and the note follow it |
| Under ten minutes | charges the ten-minute minimum and says so — "(10-minute minimum — charging 10)" |
| A note the operator wrote themselves | left alone; only the app's own "Timed help — N min" is kept in step |
| A total typed by hand | wins, and the line says "— charging £25.00 instead" rather than going on claiming £37.50 |

Also cleared while here, at the owner's instruction: the last nine junk values
in the customer email column. Seven placeholders (`N/A`, `-`), one carrier name
("1pmobile" — its right place is the SIM's provider field, which already said
1pMobile, so it only had to come out of his email and that SIM's carrier-login
box), and one reference moved into a note. Plus one the first pass could not
see: a record whose typed column was already empty while the app's own copy
still said "N/A". Customer email column now: 0 junk, 38 real addresses, no
drift, 610 customers.

**Open, and worth a decision:** 29 SIMs hold a non-email in their carrier-login
field — 20 placeholders, 6 words (one literally reads "EMAIL ADDRESS"), 2 bare
punctuation, 1 all digits. That field is what inbound carrier mail pairs
against, so those SIMs can never be matched by address.

Verified: gate green (435 tests ×2 TZ + build), popout harness extended to
drive the minutes box, modals/names/contrast clean.

## Owner request — 2026-08-17: clean the 29 SIM carrier logins

The field inbound carrier mail pairs on held a non-email on 29 SIMs. Snapshot
taken, then:

| What it said | SIMs | What happened |
|---|---|---|
| `N/A`, `-`, `.` | 21 | Cleared — they only ever meant "no login" |
| `main account` | 5 | Cleared, and the fact kept as a note: five Red Pocket lines sit on the shop's own account rather than one of their own |
| A reference (`7435245347`, `5374101101730689.0926.699`) | 2 | Cleared, kept as a note on the SIM it belongs to |
| `EMAIL ADDRESS` | 1 | **`pl-sim-0` is the spreadsheet's HEADER ROW imported as a SIM** — no number, provider "UK SIM", currently attached to Fishel Cohen. Flagged in its notes, left for the owner to delete |

Carrier logins now: 734 real addresses, 0 junk, across 797 SIMs.

## Owner request — 2026-08-17: the mailbox column, and Carrier Mail moves

**Mailbox column + filter on SIM Plans.** The SIM estate turned out to be spread
over seven of the shop's own Gmail accounts, not one:

| Mailbox | SIMs |
|---|---|
| gittbilig@gmail.com | 336 |
| redfarbilig@gmail.com | 86 |
| shevabruches111@gmail.com | 64 |
| heimishecentre@gmail.com | 59 |
| hashomrimmcr@gmail.com | 55 |
| mendlhersh / shloimea1 | 30 |

Consolidating the *registered* addresses is 734 carrier logins one at a time,
so it happens opportunistically — each SIM moved as it is touched anyway. The
column is how that progress is watched: the base mailbox on every row (dots
collapsed, so `red.far.bilig` and `redfarbilig` are one thing), the full
per-SIM address in the tooltip, and a filter per mailbox plus "no carrier
account on file" for the 63 that can only ever pair by number.

The `+tag` is deliberately kept out of the cell and kept in the tooltip: the
tag identifies the SIM, but the base is what you scan for.

**Carrier Mail moved from Services to Manage.** The other four under Services
are things the shop sells; this is a queue of work arriving from carriers,
read at the same moment as Tasks and Confirm Data.

Verified: gate green, no overflow at 390/768/1280/1440, names and contrast
clean, picker sweep green.

## Owner request — 2026-08-17: dialogs behave like windows

> "i want every card should be expandable not only from bottom right corner,
> but from all 4 box endings and corners - like word textboxes"
> "can we do like windows does — press to arrange view right, left, big,
> small, or custom?"

Since 9 Aug a dialog could be pulled bigger by its bottom-right corner. That
was `resize: both`, and the browser only ever gives you that one corner — so
the other seven meant owning it.

| | |
|---|---|
| Eight grips | four edges, four corners, invisible until hovered |
| Drag by the title | the way every window on the machine works |
| ◧ ⛶ ◨ ▭ | left half · fill · right half · back to normal, beside the ✕ |
| Phones | untouched — a dialog there IS the screen, and a 6px grip nobody can hit is worse than none |

Two things that make it work rather than nearly work:

**The grips live on the overlay, not in the dialog.** The dialog scrolls its own
content, so anything inside it scrolls away from the edge it is supposed to
mark. They are painted over its edges and re-laid on every move.

**Pulling the left or top edge has to move the box as well as size it**, at the
pointer's speed, and stop moving when the width hits its floor — otherwise the
dialog slides out from under a hand that is no longer resizing anything. That
arithmetic is what `ops/harness/window.mjs` mostly exists to hold: it drags all
eight points and checks both numbers each time, then checks the grips are still
glued on, that it cannot be shrunk below 300×180 or pushed off screen, and that
a phone still gets the plain dialog.

Wired into `audit-all.sh`. Gate green; modals clean at 390 and 1280; names,
focus, contrast and targets all clean.

## Owner request — 2026-08-17: the sparkline, and middle-click

> "is this clickable and linked to summary?" · "with press on the middle button
> of the mouse instead of left button to open in a new tab - is this working
> throughout the app?"

**The sparkline was not clickable.** It was a picture of the month with nothing
behind it, which is exactly the kind of thing a person goes to click. It is now
a real `<button>` opening the **business summary** — the same money over the
same window, with the working shown. A button rather than a clickable div, so
it is one tab stop with a name and a focus ring; no chrome until hovered, so it
still reads as part of the figure above it rather than a control bolted under
it.

**Middle-click was not working, anywhere in the sidebar.** The nav rows were
`<div data-tab>` with a JS click handler — and middle-click, ⌘-click and "Open
link in new tab" all need an `href`. Every tab already has a real URL
(`pages/[tab].js`), so the rows are now real `<a href="/rentals">` and main.js
takes only the plain left click: anything with a modifier, or a non-primary
button, goes to the browser untouched.

Two things that had to move with it: the `role="button"`/`tabindex` shims came
off (an anchor already has both), and `goToTab()` stopped firing a synthetic
`.click()` — on an anchor that is a real navigation, i.e. a full page load in
place of an in-app switch.

Still not middle-clickable, and worth doing next: customer names inside tables
(`custNameLink`) use `href="#"`, so a middle click opens a copy of the current
page. They have a real route — `/customers/<id>` — so the same treatment works.

Verified: gate green, names/focus/contrast/targets clean, no overflow at
390/1280, modals + picker + window sweeps green.

## Owner request — 2026-08-17: customer names middle-click too

The follow-on from the sidebar. `custNameLink` — the helper behind a customer's
name on seven cards — used `href="#"`, so a middle click opened a second copy
of the page you were already on. Worse than nothing.

Every customer has a real URL (`/customers/<id>`, served by
`pages/customers/[id].js`), so that is the href now. Same for the customer name
on a task card, which was a `<span class="dash-link">` with no href at all.

The click handler's order is deliberate: `stopPropagation` **always** runs, so
the table row underneath never also fires and opens the customer in place
behind the new tab; `preventDefault` runs only for a plain left click.

Then, at the owner's ask, both buttons were made to agree: a plain click opens
the **profile** too (`kcOpenCustomerLink`), so one link means one destination
whichever button you press. `openCustomerById` is untouched — the duplicate
scanner and the command palette use it deliberately to land on the LIST with a
row selected, which is a different intention from opening one person.

Verified: gate green, names/focus/contrast clean, modals clean.

## Owner request — 2026-08-17: read everything from the business-only inbox

The shop's own reasoning, relayed: gitt.bilig has all the carrier mail but is a
mixed personal/business mailbox; 5311386k is business-only and already receives
everything forwarded from gitt.bilig. So point the app at the business-only one
and let it read the lot, forwarded included, instead of maintaining a carrier
filter in seven mailboxes.

**It works, and the code already supported it.** `matchSimForMail` looks up
EVERY recipient it finds, so a forwarded message carrying
`Delivered-To: <hub>` and `To: gitt.bilig+moshe@gmail.com` pairs on the second;
the hub, which no SIM is registered at, contributes nothing.

One thing did not work: the stored recipient was `recipients[0]`, which after a
forward is the hub on **every** message — so the queue would have read "sent to
5311386k@gmail.com" 800 times, which is the one fact that cannot help anyone
settle an ambiguous row. `matchSimForMail` now reports which address matched,
as written (dots intact — the canonical key has Gmail's dots stripped and looks
like a typo on screen), and that is what gets stored.

Two tests cover the two-hop path. `docs/INBOUND-MAIL.md` has the reasoning.

Still worth doing even so: the three carriers missing from the existing filters
(giffgaff 11 SIMs, Talk Home 5, Asda Mobile 4) — if the hub forwards
everything, they are covered automatically, which is exactly the argument for
doing it this way.

## Owner report — 2026-08-17: "why doesnt the windows thing work"

Because the surface they tried it on never got it. `kcWindowise` was wired into
the two shared dialog openers and the static customer modal — but the
**customer card** builds its own overlay and its own `innerHTML`, so it got
nothing. It is the surface staff have open longest.

Three faults behind the one report:

| | |
|---|---|
| The customer card had no chrome | `kcWindowise` now runs on it too |
| The snap bar was written into each opener's MARKUP | Injected by `kcWindowise` instead, so every dialog gets one — including any added later |
| "Fill the screen" filled 90% of it | The card carries `max-width:94vw;max-height:90vh` **inline**, and inline beats the stylesheet rule that lifts the caps. `kcWinPin` clears them; `kcWinReset` still restores the whole original style attribute |

Also fixed, same session and my own doing: the dark logo is served with
`immutable` for a year (next.config.js), and I changed the FILE in place on 17
Aug — so every existing visitor would have kept the old white knock-out until
their cache expired. The CSS now points at `?v=2`.

And the customer name is a link in every list now — rentals, SIM plans,
bookings, repairs, services — not only on cards. Which `--targets` immediately
caught as a regression: a name is a 13–16px tap target on a phone, under the
24px floor the rest of the app is held to. `.kc-namelink` gives it a real box
to hit at ≤560px and on any coarse pointer, and leaves desktop row density
exactly as it was.

Verified: gate green, window/picker/modals/names/focus/contrast/targets all
clean, public pages clean in EN+HE and all three theme states.

---

## Airline confirmations become bookings (18 Aug)

Owner: *"can we add a filter to the ch702 gmail to forward all airline tickets…
the app should match with customer name and suggest a task to confirm this
customer bought a ticket from x to x for this price? and take from there to
charge wallet etc."* — and then: *"it should come up as task needing
confirmation, and confirm booking details is better wording than just make the
booking, cuz it shall autofill (editable) the data it thinks is right."*

Built: `lib/ticketMail.mjs` (parser, 26 tests), `ticket_mail`, a branch in
`/api/inbound/mail`, `/api/ticket-mail`, the queue on Tickets & Flights, and
`ops/harness/tickets.mjs`. Setup in `docs/TICKET-MAIL.md`.

**Still open**

- The Gmail filter itself is the owner's to create in `ch7023518@gmail.com` —
  nothing arrives until it exists. Steps are in the doc.
- Return legs are recognised and shown, never raised. A booking holds one
  travel date.
- Attachment-only itineraries (a PDF and nothing in the body) parse `thin`.
  The OCR path already in the app is where that would go if it turns out to be
  common.
- The parser knows 23 airlines and ~70 airports. Both lists are in
  `lib/ticketMail.mjs` and both should grow from real mail, not from guessing.

## The sweep that could not go red (18 Aug)

`ops/harness/render.mjs` only ever printed its findings — it never exited
non-zero — and every check in `audit-all.sh` is piped through `tail -1`, whose
own exit status is what the script read. So on 17 Aug the log said

    1 tab(s) overflow at 320px / text largest
    …
    AUDIT: all checks reported clean.

Both are fixed: findings reach the exit code, and every check runs under
`bash -eo pipefail -c`. The overflow it had been hiding was the SIM tab's
mailbox filter — a `<select>` is as wide as its longest option, and
"📭 No carrier account on file" is a long option.

Wiring it up immediately caught two more things, both of which had been sitting
under that green light: the SIM tab's mailbox filter overflowing, and — once
pipefail was on — a `… | tail -3 | head -1` in the script itself, where `head`
closing the pipe kills `tail` with SIGPIPE and the run fails with nothing wrong.
`sed -n 1p` reads to the end and prints the same line.

**And a third, once the script could name the check that went red:** New
Rental, New Booking and Add SIM had all been scrolling sideways by 1px at 320px
whenever the customer picker was open. The picker's dropdown is allowed to be
wider than the box it hangs from (a Kol Torah row is 150px; a list of names is
not), and the `86vw` that allowed it is 275px at 320px — two pixels wider than
the content box of a dialog on that screen. `calc(100vw - 48px)` says the same
thing against what actually constrains it. That one was mine, from 17 Aug, and
`modals.mjs` had been reporting it into a pipe the whole time.

**Checked since:** every harness (`focus`, `names`, `picker`, `popout`,
`loading`, `window`, `tickets`, `textscale`, `theme-pairs`, `modals`, `public`)
and all fourteen `render.mjs` sweep variants were run individually and their
exit codes read. All exit 0 clean and non-zero on a finding.

## Dialogs became windows properly (18 Aug)

Owner, on the first version: *"the grip works, but after any expand, the card
instantly collapses"* · *"i cant scroll in background, so whats the idea of
pushing to right or left?"* · *"the ui here is all messed up"* · *"the view thing
should be only seen when hovering over the button like say the mac attachment"* ·
*"besides the corner grip, the whole card shall be movable by gripping at top"*.

Five faults, four of them mine from the day before:

1. **The collapse was two bugs wearing one coat.** A drag that ENDED over the
   backdrop fired a click whose target was the overlay, and the customer card —
   unlike #dynamicModal — had no press-started-on-the-backdrop guard, so sizing
   the card closed it. And the card's render function is also its repaint path:
   it rebuilds `overlay.innerHTML`, which threw the size away on every save.
2. **The snap bar was in the document flow**, floated beside the ✕. The card's
   two-line heading wrapped around it and the top of the card came apart. The
   chrome now lives in the overlay layer and is positioned in viewport
   coordinates — measured against the real ✕, not against a guess about where
   the corner is.
3. **Left/right snap was pointless while the dialog stayed modal.** It isn't
   any more: window mode drops the scrim and lets the pointer through, so the
   page behind scrolls and clicks. That is the answer to "whats the idea".
4. **`.kc-grip` was already taken** by the resizable-box handle, further down
   the same stylesheet and therefore winning: every window grip showed
   `cursor: ns-resize` and wore the other control's dotted triangle. Renamed to
   `.kc-wgrip`.
5. **Everything inside a dialog was laid out against the viewport.** A dialog
   with a fixed width can get away with that; one you can drag to 618px cannot
   — the Contact menu landed on the phone number. Windowed dialogs are now
   container-query contexts.

`ops/harness/window.mjs` covers all five. Each new check was mutation-tested.

**Worth doing next:** the rest of the card's internals still answer to media
queries. Only `.card-tools` and `.detail-stats` were converted, because those
are what visibly broke at half-screen. The next narrow-window bug will be in
whatever was not looked at.

## UX loop — night of 2026-08-18

| date | item | gate | accepted? |
|------|------|------|-----------|
| 08-18 | **A dialog dragged narrow now lays itself out narrow.** Every narrow-screen collapse in the app was written as `@media (max-width: 560px)`, from when the only way to get a narrow dialog was a narrow phone. A window pulled to its 300px floor on a 1280px screen is exactly as narrow and the media query never hears about it: the customer card's action tiles ran **39px** off its edge and the picker's dropdown **10px** off New Rental's. Three fixes — `repeat(3, 1fr)` → `minmax(0, 1fr)` (a bare `1fr` is `minmax(auto, 1fr)`, so a track will not shrink below "✈️ Flight"), the phone collapses restated as `@container` rules, and the picker's "allowed to be wider than its box" min-width dropped below 380px where there is no wider left to be. **The container rules had to MOVE to the foot of the sheet**: a container query carries no extra specificity, so sitting beside `.modal.kc-win` they lost to the plain component rules 900 lines below and did nothing at all | ✅ gate + window/tickets/modals harnesses + audit 320/390/largest | owner live-test pending |
| 08-18 | **Kol Torah's settle boxes say what they are.** `placeholder="£ collected"` did not fit its own 98px box and rendered as **"£ collectec"** — and a placeholder is the wrong thing to be truncating: it was the field's only accessible name, and it disappears the moment anyone types, which is exactly when "which box was the money we got?" gets asked. Both money boxes now carry a real label above them (Sold · Collected) with `£` as the placeholder. The title select's `max-width:230px` was also cutting its own option mid-price — "Shiur — Parshas Devarim — £8." — now `min(330px, 100%)`, which also stops the Return button being orphaned on a line of its own | ✅ gate + names + audit 320/390/largest + targets + dark contrast + shot | owner live-test pending |
| 08-18 | **Seven controls were hiding their own labels in Simple Mode** — and every one was clean at the standard text size, so nothing had ever seen them. Boxes sized in pixels against text that grows 30%: the SIM search lost **136px** of "Search customer, number, provider…", Rentals lost its scan and search hints, and the customer picker was cut to "Type a name or n…". Fixed at the cause — `.search-box` sized in `ch` so it grows with the type (the three inline `width:` overrides deleted with it), the picker's placeholder shortened to "Name or number…" so it fits the deliberately narrow rows, and three hand-rolled filter/sort selects put onto the shared `.kc-fs-sel` control they should always have used, which already solved this. **New sweep `ops/harness/clipped.mjs`** measures every placeholder and selected option against its own box at both text sizes, and is wired into `audit-all.sh` | ✅ gate + new sweep 0/0 at standard and largest + audit 320/1280/largest + targets + names + picker | owner live-test pending |
| 08-18 | **Kol Torah's nameless number boxes.** Three boxes in the busiest rows on the tab were a bare `1` and a bare `£` among eight controls — the New Job row's quantity and price, and the consignment row's quantity. Two carried an `aria-label` and one carried nothing but a currency symbol, so a screen reader was better served than the person looking at it. All three now sit in a wrapping `<label>` (How many · Price) on the same `.kt-fld` pattern as the Settle boxes, and their rows align on the control rather than the label. The details box keeps its placeholder deliberately: "e.g. 3 CDs of R' Shloime onto one SD" is an **example**, which is what a placeholder is actually for | ✅ gate + names + clipped + audit 320/390/largest + targets + dark contrast + shot | owner live-test pending |

| 08-18 | **The dead gutter beside four tables was a fix that stopped 40px too early.** Repairs, Bookings, Virtual Numbers and Shop each painted their header band and stripes 39px short of the card's right edge at 1280px. Chased it the wrong way twice — it is not padding (`0px`), not a missing `<th>` (7 header cells to 7 body cells), not `border-spacing`. The table is `display: block`, so the element fills the card while the table grid inside it shrink-wraps to its columns. **The owner reported this exact symptom on 10 Aug and it was fixed** — `.table-card > table { display: table; width: 100% }` — but behind `@media (min-width: 1320px)`, and the shop works at 1280. Threshold lowered to 1024px, which is where a card first has room to spare. Every table measured at 1024/1280/1440: the narrow ones now fill their card exactly, the wide ones (Bookings 987, Virtual 983) make the CARD scroll on `overflow-x: auto` — reachable either way, which is what the rule was written to guarantee | ✅ gate + audit at 320/390/768/1024/1280/1440 + reachability measured per table per width + picker + modals + targets + clipped + dark contrast | owner live-test pending |
| 08-18 | **The phone-width half of the same problem.** At 390px the Shop's two facet dropdowns were pinned to `flex: 1 1 40%` — 136px — so "Every category" read "Every catego" **at the ordinary text size**, and the task composer's priority box was a `width:110px` typed once that "Normal" outgrew in Simple Mode. A flex basis that starts from the text lets the dropdowns share their line when there is room and wrap when there is not, which is right either way. 390px is now clean at the standard size and wired into `audit-all.sh`; 390 × largest is deliberately NOT, and the reason is in the script | ✅ gate + clipped 390 clean + audit 320/390/largest + targets + names + modals | owner live-test pending |

| 08-18 | Tidy-up, no visible change: the phone rule for `.card-action-grid` still said `repeat(2, 1fr)` after the base rule and both container rules moved to `minmax(0, 1fr)`. A bare `1fr` is `minmax(auto, 1fr)` — the exact trap that let the action tiles run off the customer card — and leaving one of the four spellings behind is how it comes back | ✅ gate + audit 390/320-largest | preventive |

| 08-18 | **The wording, settled by the owner — and the verb was the answer.** The two search boxes already draw a magnifier, so "Search" and "Find" were being paid for twice; dropping the verb bought the room at no cost to meaning, on every screen rather than only phones. `simSearch` → "Name, number or provider…", `shopFacetQ` → "Item, code or barcode…" — **and the Shop's box, which had no magnifier, now gets one**, so it reads like the others and losing "Find" is natural. The icon is a token (`--kc-search-icon`) rather than a data URI copied twice. `.search-box` retuned **33ch → 26ch**: with the verbs gone the longest placeholder left is 22.7ch, so the boxes had been ~90px wider than anything they had to hold; 26ch lands back on the 280px they were drawn at and now grows with the type. Kol Torah's example kept as it is by owner decision, and `clipped.mjs` learned the difference — `data-ph="example"` is skipped and **counted out loud**, because an exemption nobody can see is how an allowlist rots into a blindfold. All four corners green, so **390 × largest is now wired into `audit-all.sh`** | ✅ gate + clipped clean at 1280/390 × standard/largest + audit 320/390/1280 + targets + names + modals + picker + dark contrast + shots | owner live-test pending |

**Found, not fixed — for the next night**

- ~~The tightest corner of the grid, 390px × largest text, has six controls that
  still cannot hold their own label.~~ **Three of the six fixed the same night**
  (see the row above). For the record, the original set was: Measured with the new sweep:
  `simSearch` −83px, `ktJobDetails` −55px, `shopFacetCat` −40px, `shopFacetQ`
  −24px, `shopFacetBrand` −9px, `tkPriority` −9px. Two of them (`shopFacetCat`,
  `shopFacetBrand`) are already short at 390px at the **standard** size, −30px
  and −6px. On a phone the box IS the screen, so widening cannot fix the search
  boxes — the honest fix is shorter wording, and **wording is the owner's call**:
  "Search customer, number, provider…" says what is searchable, which was the
  whole argument for sizing the box to it in the first place. The selects are
  fixable in CSS alone. `clipped.mjs` is wired into `audit-all.sh` at 1280 only
  for now, deliberately: adding 390 today would leave the sweep permanently red,
  and a red sweep nobody can act on is how the last one stopped being read.
- ~~Repairs / Bookings / Virtual / Shop: the table is 982px inside its 984px
  card but its rows are only 943px.~~ **Explained and fixed the same night** —
  see the row above.

## Carrier mail — the forwarding mailbox was drowning the answer (18 Aug)

Owner asked for the route query to be re-run. It answered its question — and
reading it turned up a bug underneath.

**The route question, settled.** Five of the shop's seven mailboxes have
delivered mail to the app, and **only gitt.bilig was ever given its own
forward**:

| source mailbox | messages | via the hub |
|---|---|---|
| gittbilig | 10 | 8 |
| shevabruches111 | 3 | 3 |
| shloimea1 · hashomrimmcr · elimelechgrunnfeld | 1 each | 1 each |

Every non-gittbilig message arrived carrying `gitt.bilig@gmail.com` AND
`5311386k@gmail.com` in its route, so the chain works end to end and the five
remaining per-mailbox forwards are unnecessary. **redfarbilig (86 SIMs) and
mendlhersh (16) have never appeared** — unconfirmed rather than broken; Lebara
renewals cluster monthly, so a quiet day proves nothing.

**The bug it exposed.** `matchSimForMail` unioned the candidates from every
recipient on the envelope. Once the mailboxes started forwarding through one
another, a message carried both the address that names ONE SIM and the postbox
it passed through:

    shevabruches111+s9@gmail.com     1 SIM    ← the answer
    gitt.bilig@gmail.com           308 SIMs   ← the postbox

309 candidates, no number in the text to narrow them, verdict `ambiguous` — on
a message whose answer was the first line of its own route. Three of the ten in
the queue were exactly this, each already solved: `+s9` → Mayer Kraus, `+s11` →
Mordcge Y Goldberg, `+s30` → Mendl Hersh Grinfeld, all three SIMs on file since
13 July. The narrowest address now wins, and a tie between two addresses each
naming a DIFFERENT single SIM stays ambiguous rather than being settled by
header order. Two tests named after both.

**And a re-pass, since a fix that leaves the wrong rows wrong is half a fix.**
Pairing only ever ran at the instant a message landed, so it was only as good as
the SIM list at that moment — and neither a SIM added later nor a better matcher
ever reached the pile already in the queue. The nightly sweep now re-reads it
through the same matcher on the same envelope (`route` holds it), writing back
only results certain enough to carry a `sim_id`.

**Spacing** (owner, with a screenshot): the queue's date column was a fixed
120px holding "18 Aug 2026 09:24", which `.cm-when` refuses to wrap — so it
spilled into the gap and the date almost touched the subject. `max-content`
sizes the track to the date, and follows Simple Mode for free.

## Tickets — a sender list can never be complete (18 Aug)

Owner: *"what about the 702 gmail tickets filter, is it set up? also, sometimes
its booked via 3rd party like wiki.com and much more."*

**Not set up** — `ticket_mail` has never held a row, so nothing has come down
that pipe yet. The alias and the Gmail filter are both still to do.

The third-party point is the one that mattered. The doc's original recipe was a
`from:` list, which is exactly the thing that cannot be finished: the shop books
through whoever is cheapest that week. Three changes so a **broad** filter is
the recommendation instead:

- The filter is now `from:(…) OR subject:("booking reference" OR "e-ticket" OR …)`.
  The sender list stopped being the gate and became the name-tagger — an agent
  nobody has heard of gets through on the phrases and still parses.
- **Anything on the tickets alias that is not ticket-shaped is dropped at the
  door** — no row, no body, no task. That is what makes a broad filter safe out
  of a PERSONAL mailbox: the subject terms will catch a hotel or an Amazon order
  now and then, and a false positive should leave no trace of somebody's private
  post in the shop's database. The one exception is Google's own forwarding
  confirmation, which is not ticket-shaped and is the message that carries the
  code to turn the forward on.
- Fifteen more agents named (Trip.com, Gotogate, Mytrip, eSky, TravelUp,
  Alternative Airlines, BudgetAir, Netflights, ebookers, CheapOair, Skyscanner,
  Kayak, Momondo, Flight Network, Booking.com), with a test that an agent NOT on
  the list still gets in on the phrases — the list is a convenience, not the
  gate, and the test is there to stop it quietly becoming the gate again.

## Round trips, and saying what was read (18 Aug)

Owner set up the ch7023518 filter — Gmail's own forwarding confirmation landed
at 10:13, which is the alias and the webhook proven end to end. Then: *"cant we
include roundtrips?! does the parser know how many passengers in booking and
suggest to confirm accordingly?"*

**Round trips are one booking with two dates.** `bookings.return_date`, nullable,
with a check constraint that a trip cannot come back before it leaves. One row
and not two on purpose: a return is one reference, one price and one booking
fee, so splitting it would either charge the fee twice or need a rule about
which half carries it — and the customer would appear twice in the register for
one trip. Every read that filters on `travel_date` is untouched; the outbound
date is still when the trip starts. The parser had been reading the return leg
all along and writing it into the notes as prose, where nothing could use it;
it now goes in its own field, on the New Booking form, the edit form and the
register (`12 Sept ↩ / back 26 Sept`).

**Passengers: it knew, and that was the problem.** The parser extracts the
names, fills the passenger editor and sets the fee calculator's count — and the
tiered fee therefore already prices for all of them the moment a service is
chosen. Nothing on the screen said so, which for the person confirming is the
same as it not happening. The form now says "**2 passengers** read from the
email — pick the service below and the fee prices for all 2."

**What it deliberately does NOT do is pick the service.** £20 ready-planned,
£25 standard and £30 self-transfer differ by how much work the shop did, and no
email can answer that. Auto-selecting one would be the app guessing at money,
which is the single thing this whole feature refuses to do.

**Still open:** the sweep's flight reminders and the check-in prompt all key on
the outbound date, so nothing prompts the check-in for the flight home. The date
is stored now, which was the hard part.

## A journey is made of flights (18 Aug)

Owner: *"sometimes its 2 passengers, each one chargable on his own, and sometimes
its 2 people like family under same customer"* and *"sometimes we do 2 airlines
for there and 2 additional for back.. all for one person's one time 2-way
journey."*

**Both were already in the data, written as prose in fields that cannot hold
them.** Worth recording, because it turned a design question into a reading
exercise:

| what the shop does | how it is stored today |
|---|---|
| split one PNR across payers | already separate bookings — `XU2WWH` is 3 bookings, 3 customers, £500 of tickets and **£150 of fees** |
| a self-transfer journey | `route "MAN_JFK"`, `airline "Aer lingus, Virgin"` — two airlines in one field |
| a round trip | `route "LGW-TLV-LTN"` — out of Gatwick, back into Luton, as one string |

11 bookings share a PNR with a different payer; 5 routes name three airports;
2 airline fields hold two airlines. Out of 394.

**The diagnosis:** a booking was being asked to be three things at once — a
payer's charge, a journey, and a flight. The payer's-charge half already works
(one booking, one wallet charge, which is why splitting is done by making
several). The flight half had nowhere to live, so `booking_legs` was added:
position, direction (out/return), airline, its OWN reference, origin,
destination, date, times, price.

**A leg belongs to the booking, not to a trip** — two payers on one itinerary
each get their own copy. Redundant on purpose: a booking stays a complete record
of what that person bought, every existing read is untouched, and cancelling one
payer's half cannot rewrite the other's. The booking's own route/airline/
travel_date stay authoritative for the sweeps and the register; legs are detail
beneath, never a second source of truth for money.

The register says so quietly — `Wizz +2 / AL9K2M +2 refs · 4 flights` — and the
editor is folded away behind "+ Add a flight", because 389 of 394 bookings are
one flight and always will be.

**Owner decision taken (18 Aug), on the split fee:** *staff choose at confirm
time* — a fee each, split evenly, or all on the organiser. So the fee stays on
the booking (as now) and the choice is made per trip rather than stored as a
rule. **The split flow itself is not built yet**; making several bookings by
hand still works, which is what the register shows people already doing.

**Found while reading:** the `MAN-YUL` booking has `airline: "Shmuel, Miriam"` —
passenger names landed in the airline field during the 9 Aug workbook import.
Left alone; it is data, not code, and the owner should see it first.

**Next, in order:** the split-across-payers flow with the three fee modes; then
attaching several ticket emails to ONE booking, which is how a self-transfer
journey actually arrives — as two or four separate confirmations, each landing
as its own card.

## The split, and the second email (18 Aug)

Owner: *"so do the split flow and the multi-email attach."*

**➕ Add to a booking.** A self-transfer journey does not arrive as one email —
it arrives as two or four, each landing as its own card asking to be booked.
Confirming them all would book one journey four times. The card now offers
attaching instead: the email becomes a `booking_legs` row on a booking that
already exists, carrying its OWN airline and its OWN PNR, and the card settles.
**No money moves**, and the modal says so in those words, because a button next
to three that all post charges must be unmistakable about which one does not.
A flight dated after the day the trip starts is guessed to be the way home —
worth guessing, trivially corrected.

**👥 Split across payers.** Offered only when the email names more than one
passenger. One booking per payer, one wallet charge each, sharing the
reference — which is what the register shows the shop already doing by hand.
The owner's decision (18 Aug) was that the fee rule *depends*, so it is chosen
at that moment: a fee each · split evenly · all on the first payer.

Three things it does that are easy to get wrong:

- **One confirmation for the whole split**, not one per booking. Three passport
  gates and three charge prompts for a single decision is how people learn to
  click through them.
- **The odd penny goes to the first payer.** £100.01 across three is
  33.35 / 33.33 / 33.33. Somebody carries it and it must be deterministic —
  the harness asserts the shares still total the ticket AND the fee.
- **Each booking gets its own idempotency token.** A partial failure is
  therefore safe: the ones that succeeded stay exactly one charge each, and the
  toast names how many landed instead of silently re-running the lot.

`ops/harness/tickets.mjs` checks the arithmetic directly rather than by reading
the screen — all three fee modes and the penny case. Mutation-tested: removing
the rounding correction and the all-on-one rule fails it.

**Still not built:** the check-in reminder for the return leg. Every sweep
reminder keys on the outbound date.

## Check-in for the flight home (18 Aug)

Owner: *"do the return check-in reminder too."*

Every check-in field was singular — one date, one done flag — so a round trip
prompted the check-in going out and never coming back. That is the half of the
trip where the customer is abroad and least able to sort it out themselves.
`return_checkin_date` + `return_checkin_done`; **`checkin_by` is deliberately
NOT duplicated**, because who does the check-in is a fact about the arrangement
with that customer, not about a direction of travel.

The form defaults each date to the day before its own flight and only asks
about the return once the journey has one — an empty second date on 389 of 394
bookings is noise, and noise is what stops people reading a form. The chip only
reads ✅ when BOTH legs are done: "done" on a booking with the flight home
outstanding would be the app saying the job is finished when it is half
finished.

**Two bugs found on the way, both worth more than the feature.**

**1. Check-in tasks were never keyed.** `/api/tasks` had no `reference` at all,
so a booking edited three times carried three identical "check in" reminders —
and the return leg would have doubled that again. The endpoint now accepts a
validated reference and refuses to open a second task against a reference that
is already open, which is the rule the sweep has always used.

**2. A round trip completed itself the morning after the outbound.** The
auto-complete rule (`travel_date < today → Completed`) was written when every
booking was one-way and was untouched by this morning's `return_date` work — so
a trip would have gone green in the register while the customer was still
abroad with a return to check in for, and the FLIGHT task would have closed with
it. Both now judge the journey on its LAST date. Mine, from this morning, and
exactly the kind of thing a new column does to old rules.

Harness: both defaults, the one-way case, and the chip's both-legs rule.
Mutation-tested — removing the return default and the both-legs condition fails
it.

---

## 18 Aug — the rest of the rules that only knew about the departure

Owner: *"yes sweep the rest of the travel_date readers"*, after the round-trip
auto-complete bug above. It was the right instinct — there were five more, and
three of them are worse than the one that prompted it.

`return_date` shipped this morning. Everything written before it asked the same
question, "is the travel date past?", and meant one of three different things:
when the trip **starts**, when it **ends**, or whether it **spans** a day. Only
the first is safe to key on the departure.

**Fixed — the document has to outlive the journey.**

| where | was | now |
|---|---|---|
| `lib/travelRules.mjs` `passportCheck` | six months beyond the **departure** | beyond the last day of the trip |
| `lib/travelRules.mjs` `coverageStatus` | ESTA/ETA valid on the **day they fly** | valid until they are home |
| `lib/bookingGate.mjs` + its browser copy | BLOCKs a passport that dies before takeoff | BLOCKs one that dies before they fly home |
| `cron/sweep.js` travel-requirement pass | trips departing in the next 120 days | those, **plus trips already under way** |

A passport that expires while the customer is in Israel is worse than one that
expires before they leave — they are turned away at a gate 2,000 miles from
here, not at Manchester. Under the old rule the app would have said *"✓ Passport
valid long enough"* about it. The wording follows the difference: **"expires
while they are away"** and **"runs out WHILE THEY ARE AWAY"** are not the same
sentence as "expires before travel", and staff have to act on them differently.

The sweep window widened for the same reason. It looked at trips departing from
today onwards, so somebody already abroad on an ETA lapsing next week had
dropped off the list the morning they flew — exactly when the reminder is worth
sending.

**Fixed — still travelling is not the same as still to depart.**
The register's ✈️ Upcoming travel filter and count, `customerUpcomingBookings`,
and the list of bookings offered when attaching a second ticket email all tested
`travelDate >= today`, so a customer mid-holiday vanished from every one of
them. All four now judge on the last day of the trip (`tripLastDay`).

**Fixed — and a rental has to cover the trip, not the day they leave.**
The "no phone booked yet" nudge and the profile's trip bundle counted a rental
as cover if it merely overlapped the departure date. A rental ending mid-trip is
not cover; it is a phone they had for the first week.

**Left alone, deliberately:** the flight-in-N-days reminder, "Flies TODAY", the
7-day dashboard count and the SMS reminders. Those genuinely ask about the
departure, and a return date must not move them.

**New: `test/bookingGateMirror.test.mjs`.** The gate has lived in two copies
since it shipped — `lib/bookingGate.mjs` and a hand-written mirror inside
`public/main.js` — with nothing checking they agreed. This morning's edit had to
be made twice, which is precisely how mirrors drift, so the test now lifts the
browser copy out of `main.js` and holds it to the module's verdict over nine
bookings. Mutation-tested: reverting either copy alone fails it.

## The manual, and why it is code (18 Aug)

Owner asked for "an instruction guide for the whole site… as simple as possible
but w/o missing any detail… updated live while we work on the site". The last
clause is the whole problem: `docs/` holds thirty-odd files and most are dated
snapshots, true the day they were written and never touched again. A manual that
goes stale is worse than none, because the helper covering the counter believes
it.

So the manual is not a document. It is `lib/manual.mjs` — one entry per screen —
with `docs/MANUAL.md` and the printable `/manual` page generated from it, and
`test/manual.test.mjs` holding it to the app:

| tooth | what makes it bite |
|---|---|
| coverage — screens | a tab in `ALL_TABS` with no entry fails |
| coverage — pages | a page in the harness `PAGES` registry with no entry fails, and its address is checked against the file it lives in |
| coverage — dialogs | every one of the 25 modals in the harness `MODALS` registry must be documented, on the screen it opens from |
| drift — names | a screen's name must equal its `TAB_META` label |
| drift — buttons | a written screen must name its own primary button, spelled the way the button is |
| freshness | `docs/MANUAL.md` is regenerated in memory and compared with what is committed |
| the ratchet | `DRAFT_BUDGET` must equal the number of drafts, so it can only go down — a new screen has to be written now, not "later" |

Plus two standing rules the tests enforce on the prose: no developer words (the
same jargon check the guides get), and **no prices, rates or periods** — those
live in Settings and BUSINESS_RULES.md, and a number copied into the manual is a
second price list waiting to disagree with the till.

**Mutation-tested, and one tooth was a fake.** The freshness check imported
`scripts/build-manual.mjs`, whose top-level code wrote the file — so the import
regenerated `docs/MANUAL.md` and then compared the fresh copy with itself. It
passed on a deliberately stale manual. The write is now guarded to run only as a
command; an import must be pure or the check it feeds is theatre. The other six
teeth were confirmed by breaking each one in turn.

**Where it is:** ❓ How do I…? → 📖 The full manual (new tab), and `/manual`
directly. Staff-only, behind the same cookie gate as the tools pages — it
describes how the shop is run.

**State:** 2 of 28 screens written out in full (Phone Rentals, and the manual
page itself); 26 are honest one-line entries marked as such on the page. The
prose lands screen by screen from here, each one dropping the budget by one.

**Finished the same day (18 Aug).** Owner: "work down the sidebar in order."
All 28 screens are now written out in full — 170 parts described, 91 rules that
bite, 70 named failures with what to do about them — shipped in four batches so
each landed readable rather than in one drop at the end.

The tests earned their keep while writing, not just afterwards. The drift check
caught the Kol Torah entry naming the button on the screen ("+ Add job") and not
the one in the topbar ("+ New job"); the label rule rejected bare emoji as button
names on Repairs; and the "too terse to help anyone" rule refused a two-line
description of the privacy page, which is what sent me to read its real section
headings instead of describing it in the abstract. Three corrections a human
reviewer would have had to notice, made by a test that runs in two seconds.

One deliberate loosening: the dialog check no longer insists a box is filed under
the tab the harness opens it from. The harness picks any tab that can reach a box
for a screenshot; the manual has to say where a PERSON finds it, and cash-up is
reached from Wallet and from the till, not from the dashboard. Coverage and
uniqueness are still enforced.

`DRAFT_BUDGET` is now 0, which is the interesting state: a new screen cannot be
added as a draft without deliberately raising a number in the test, in a diff a
human will see. The manual is finished, and staying finished is now the default
rather than the discipline.

## Owner-editable stock categories (18 Aug — DONE)

Owner: "why so little option on stock types/categories? didnt we implement
something about this from lightspeed?" — the Lightspeed thing was the FILTER
VIEW (17 Aug), not the category list. Categories were a hardcoded four.

DONE now: expanded to twelve sensible defaults in `lib/stockCategories.mjs`
(phone, sim, charger, cable, earphones, case, powerbank, memory, car,
repairpart, accessory, other), server + browser mirror + mirror test.

DONE — owner-editable in Settings, the full Lightspeed answer, built exactly
like `repair_stages` / `void_reasons`:
- a `stock_categories` settings key (comma-separated labels), edited in Settings.
- `lib/stockCategories.mjs` gains a `mergeCustom(settingsValue)` that appends the
  owner's categories to the defaults, keyed by a slug of the label.
- the server reads the setting when validating a saved item (it validates
  against `STOCK_CATEGORY_KEYS` today — that becomes defaults + custom).
- the browser dropdown/filter read the merged list.
- 'phone' stays load-bearing and non-removable (IMEI capture + phone_sale
  ledger); the editor must not let it be deleted or renamed away.
- emoji per custom category is a nice-to-have; a plain label is enough to ship.

## UX/UI night — 19 Aug 2026 (03:00–04:00)

The loop was refocused by the owner onto UX & UI, several items a night. The
July review's section B was the obvious ground and is nearly exhausted — B1–B8
and B10 are all shipped, and B9 (one-click take payment from the Customers list)
is money surface and out of this loop's scope. So the night's items came from
DISCOVERY: rendering real screens in the harness in states nobody had looked at
— the day-one empty seed, dark mode, and 390px.

| # | Shipped | What it was | Found by |
|---|---|---|---|
| 1 | `f3f0c78` | "Nothing waiting on you here" carried `kc-next kc-next-clear` and inherited the bordered card + accent stripe, so an empty queue shouted as loudly as an overdue phone — on most screens, most of the time | day-one empty seed at 390px |
| 2 | `6137c46` | Day one said "AVAILABLE PHONES · 0 · none left to rent" in alarm red. Nothing was rented and nothing was missing — the shop had not added a handset yet, and this is the first screen a new owner sees | same |
| 3 | `3fea997` | The wallet balance was a `.badge` inflated by inline styles to 7px 16px — **more padding than the real button beside it** — filled, rounded, and not clickable | customer card in DARK at 1280 |
| 4 | `4430327` | On a phone the next-action button wraps to its own line and `margin-left:auto` shoved it against the right edge, leaving a dead gap with a small target floating in it | tasks in dark at 390px |

### Found, NOT fixed — out of this loop's scope

- **The till's Charge button is fully lit on an empty basket.** `saveSale()`
  refuses with `toast('The basket is empty.', 'error')`, so the most prominent
  control on the shop's highest-traffic screen can only produce an error when
  the basket is empty. The fix is to disable Charge and Park while the basket is
  empty. NOT done here: it is the charge path, the loop excludes money surface,
  and a wrong disabled-state on that button stops the shop trading. Raised as an
  issue for the owner.

### Checked and genuinely clean (so nobody re-checks them)

- Hebrew welcome page: every section has content at heights within 150px of the
  English, compared section by section rather than eyeballed. The pale bands in
  the full-page shot are light backgrounds, not blanks.
- Nothing non-interactive is dressed as a control anywhere in `#mainContent`
  across all fifteen tabs (swept for filled + rounded + button-sized padding +
  no handler + sharing a row with a real control).
- Loading states, focus visibility, contrast in both themes, dark-rule pairing,
  and touch targets at 390 — all already green.

## The design audit's ten majors — 24 Aug 2026 (owner: "do them all")

Nine remaining (the tenth, undefined tokens, was fixed with the criticals).
Worked one at a time, gate green per commit, full `audit-all.sh` clean before
the ship. **Seven adopted, one rejected on evidence, one resolved the other
way** — an outside audit does not know this codebase's decisions, and three of
the nine turned on facts it did not have.

| Shipped | Major | What actually happened |
|---------|-------|------------------------|
| `13f0bd2` | No `:disabled` styling outside `.btn` | Fourteen control classes now dim to 0.5 with `not-allowed`. The third channel — no hover response — is done by scoping the nine hover rules `:not(:disabled)` rather than overriding them back, because those hovers change border, colour AND background in different combinations and a blanket reset would rot. Verified: all 14 report 0.5 + not-allowed disabled, 1.0 live |
| `b04a581` | Toggle animating `left`; PiP window's second palette | The rental toggle reflowed every frame of its slide; now `transform`, like the app's own `.eq-slide-knob`. The floating timer had drifted to Tailwind slate on `#ffffff` with only its blue matching the brand — tokens are now **copied** from the live app's computed root and re-copied on theme change |
| `19a2a1e` | Celebratory success toasts | Four **update** toasts silenced (the row repaints behind them). Two **creates** kept, de-celebrated — a new row lands alphabetically in a list of hundreds, usually below the fold. **The CSV export is NOT a fault and keeps its toast**: its effect is a downloaded file, nothing on screen changes. The SIM-edit silence supersedes a documented choice, and says so |
| `b2fdeb2` | Card-in-card; seven side-stripes | Duplicate review drew three boxes to compare two records; `.dup-side` loses its border and keeps its surface step (measured: bordered ancestors 3 → 2). **Four of the seven stripes encode status through their COLOUR and are untouched** — `.fwd-row`, `.chk-row`, `.kc-next`, `.kc-man-note` each have a second state the audit missed. `.nba-strip` stripe dropped, `.sms-quote` rule kept but neutral (a quotation's rule is a convention, not a SaaS stripe) |
| `960b1cc` | `--space-*` declared, never used | **Deleted rather than adopted.** 877 spacing values in the two sheets; **550 are off that 4/8/12/16/24 grid** — 10px ×107, 6px ×79, 14px ×70 — many with the measurement argued in the comment beside them. Tokenising the 327 on-grid values would leave 550 literals next to them, reading as less of a system; forcing all 877 on-grid would flatten decisions. A token set with no call sites is a claim the code does not keep |
| `d83b2e4` `def1760` | Two icon voices | Measured first: **~1,500 emoji, ~145 distinct, 235 of them in `lib/manual.mjs`** because they are part of button NAMES the manual must spell exactly. So the contradiction is closed the other way — the sidebar's "No emoji" comment now states the real policy and why the rail earns its exception. The **real** defect was inside that voice: `✅`+`✔` both meant "done" and `⚠️`+`⚠` both meant warning. Now one each, monochrome, theme-following; swept through main.js, AppShell.js, tools/ocr.js, the manual and two harness files |

### Rejected on evidence — settings section heads

`.sh-label` was called an 11px eyebrow at the top of its own hierarchy. It is
not an eyebrow: nothing beneath it restates it, it deliberately mirrors
`.nav-group-label` in the sidebar, and **its text is reused verbatim as the
settings rail's `.rail-group` headings** (`main.js:23610`). Making it a large
heading would break the rhyme with both. Reported, not changed.

### What the gate caught, and why it matters

Removing `.kc-popnote`'s 4px left edge as decoration turned the gate red on
`test/popNote.test.mjs`, which records that the thick edge is that banner's
**colour-independent** signal (WCAG 1.4.1). It looks exactly like the stripes
that were just cleared and is doing real work. Restored, with a comment so the
next sweep does not try again. The tickets harness also pinned `/✅/`; the
behaviour was unchanged, only the assertion was behind.

## The design audit's three bugs — 24 Aug 2026 (owner: "fix the 3 bugs")

A second pair of eyes ran over the staff app: the `hallmark` skill's audit verb
(installed 24 Aug, `89743c1`) against app.css, globals.css, AppShell.js and the
markup regions of main.js. It reported 3 critical, 10 major, 13 minor — and the
useful half of that is that **all three criticals were bugs, not taste**. Each
was verified by hand before it was believed, and again in a browser after the
fix. The design opinions among the majors are NOT adopted; they are a shortlist.

| Shipped | Bug | Evidence |
|---------|-----|----------|
| `aef1ed8` | Every staff page render-blocked on a Google Fonts request for **Inter in five weights** — a face that appears in **zero** font-family declarations in the repo. The real faces are self-hosted @font-face. | request listener on the rendered app: 3 → **0** requests to fonts.googleapis/gstatic |
| `c4e5d4b` | A literal white painted on `--success` / `--danger`, which **lighten** in dark exactly as `--accent` does. The Returned label measured **1.92:1**, Lost **2.92:1**, and the "!" on an overdue day **2.92:1** — the worst text contrast in the product, on the control that records whether a phone came back. Fixed with `--on-success` / `--on-danger`, the siblings `--on-accent` already implied. | measured on the real painted colours: dark **9.67 / 6.38 / 6.38**, light unchanged at 5.00 / 4.80 / 4.80 |
| `1afe61f` | `var(--primary)` has never existed here (only `--primary-deep`). An undefined custom property is invalid at computed-value time — it kills the whole declaration — so `outline: 2px solid var(--primary)` computed to `outline-style:none` and links in a read carrier email had **no keyboard focus indicator at all** (WCAG 2.4.7). The same scan found `--ink` ×2, `--fs-h2`, `--radius-md` and `--bg-primary` ×2: six live faults from one typo class. | ring now paints 2px solid accent in both themes; `test/cssTokens.test.mjs` names file+line for any undefined token, proven to fail on a reintroduced `--radius-md` |

The `--ink` one had done this before: app.css still carries the tombstone
*"audit U13 — was var(--ink), undefined → invisible in dark mode"*. A class of
bug that recurs is a missing test, not six missing fixes — hence the ratchet.
Comments are stripped before scanning, or that very tombstone reports itself.

**Not adopted, held as a shortlist** (owner's call, not the loop's): the unused
`--space-*` scale against 429 hand-typed values, the sidebar's "No emoji" rule
that the rest of the app breaks, seven decorative side-stripes, missing
`:disabled` styling on ~13 non-`.btn` controls, seven success toasts announcing
a change already visible on screen, and a hand-rolled toggle animating `left`.

## UX/UI night — 24 Aug 2026 (03:07–04:00)

Ground: full `audit-all.sh` clean (exit 0, run unpiped). The discovery lane was
FRESH EYES ON THE DAY'S OWN SHIPMENTS — the 37px rail, the calmed card header,
the letter-jump and the till bounce all landed within 24 hours, and the day's
surfaces in states nobody rendered is where the 22 Aug night found its three.

| # | Shipped | What it was | Found by |
|---|---------|-------------|----------|
| 1 | `2a184e5` | `kcTopModalOverlay` — the one answer to "which dialog is on top?", feeding the Tab trap and the letter-jump guard — listed five overlays out of nine. Tab in the house prompt walked the page BEHIND the dialog; Tab in a stacked modal was trapped inside the dialog underneath the one on screen; the second customer card and the palette were invisible to it. The global Escape walk had the same hole one layer wide: `kcPrompt` missing, so Escape on a prompt closed its PARENT and left the prompt standing. Both walks now run all nine layers in true z-order (3000→2000→1000→100→91→90); `test/topOverlay.test.mjs` pins membership, order, agreement between the walks, and ratchets a new modal-overlay id into the list before it can ship | reading the letter-jump guard's own dependency with fresh eyes |
| 2 | `34172ce` | Yesterday's phone-book jump was missing from the one place that lists the keyboard — the "?" help. One row (A–Z / א–ת, toggle-off spelled out); verified at 390px largest with zero overflow | asking "how would anyone learn this exists?" |
| 3 | `34fd15c` | The rail scrolls on short screens now (641d862, the right trade) — but Chromium's overlay scrollbar paints NOTHING at rest, and at 1280×640 eight rows (Settings among them) hid behind a fold that ends on a clean border and reads as the end of the menu. Even 1050px tall left 67px unannounced. A 26px sticky-pseudo fade now sits at whichever edge still hides rows — the same trailing-fade promise the welcome chip strip makes — painted from `var(--brand-dark)` so dark theme and the light-rail prototype recolour it free. Driven at 640/1050/1200 light+dark, collapsed 66px rail, phone drawer, light rail: fade present exactly when rows hide, gone when they don't | screenshotting the new rail one height shorter than anyone's desk |

Also drive-verified clean (13 behavioural checks, so nobody re-checks): the
prompt-over-dialog Escape/Tab flow end to end; letter-jump chip + honest empty
state + a letter pressed over an open customer card ignored; nav rows holding
37px at 640; the new help row at 390 largest.

GitHub tracker: both open issues (#5 print-shop quotes, #9 ownership) are
blocked on people, unchanged by the night — no comment noise added, nothing
found-not-fixed to file.

## UX/UI night — 23 Aug 2026 (03:07–04:00) — a short one, on purpose

Ground checked: CI green through `f11ec6e` (the Saturday-afternoon check-in
that queued while the session was idle), tree clean, main == branch.

The night's chosen lane was BIDI CORRECTNESS ON THE PORTAL — the footer bug of
21 Aug (".Hatsluche Ltd") proved the pattern exists in this codebase and no
geometry sweep can catch it. The sweep found the opposite of work:

### Checked and genuinely clean (so nobody re-checks them)

- **The Hebrew portal, light AND dark, rendered and read line by line.** The
  money templates (`יתרה לתשלום: £45.00`, the pay button with an embedded
  amount), Hebrew-localised dates ("2 באוג׳ 2026"), signed amounts in the
  transactions column (−£120.00 rendered sign-first), the KC-1042 bank
  reference inside Hebrew prose, and "Direct Debit" mid-sentence — all
  correctly ordered. Past sessions' 20 `<bdi dir="ltr">` wrappers are doing
  their job; the 10 Hebrew template functions that interpolate values all
  embed single LTR runs, which the bidi algorithm handles without help.

Nothing shipped, and that is the honest result: two consecutive nights of
fresh-eyes discovery (plus the weekend blocks) have drained the pool of
defects reachable without the owner. The no-invented-work rule outranks the
keep-busy rule. What remains needs him: money renames (Tier 1 #4/#5/#6),
issue #19's dialog styling, #13's half-built enum, the digest env flips, and
the Wizz decisions.

## UX/UI night — 22 Aug 2026 (03:07–05:30)

Ground was the WEEK'S NEW SURFACES in states nobody had rendered — the strip,
the story, the pop-note and the pulse all shipped in the last 24 hours against
390px light, and fresh eyes at 320/dark/largest and against a slowed network
found three real items. The full audit ran alongside and finished clean: zero ✗ across every section,
`AUDIT: all checks reported clean.`, exit 0 — including the three items above,
which shipped mid-run and were re-covered by the sections that followed.

| # | Shipped | What it was | Found by |
|---|---|---|---|
| 1 | `7a45342` | The common-jobs strip at 320px was a single-column wall of twenty questions burying the Contents — the page's own navigation — a screen and a half down. Bounded to ~5 visible rows, scrolling in place, under 560px only | rendering /manual one width narrower than it was designed at |
| 2 | `7f1b2b9` | 📜 Story opened only after the network answered — a dead-feeling button that invites a second press — and a slow answer for item A could paint itself under item B's title. Shell paints first; the fill checks the item id it was opened for and a late answer dies silently | pressing the dialog with a 500ms fetch instead of the harness's instant one |
| 3 | `689b923` | 📜 Story REPLACED the item-edit form it lives inside — a half-typed quantity was lost and closing landed on the tab. Now stacked over the form; proven by typing 77, opening the story, Escape: the 77 is still in the box | walking the actual mid-edit path a member of staff walks |

### Checked and genuinely clean (so nobody re-checks them)

- Pop-note at 320/dark/largest with a 140-char note: a tall tower but legible,
  wraps clean, no clipping — the cap bounds it.
- The tender advisory at 320/dark/largest: fits, no overflow.
- Four pulse toasts at once at 320px: stack readably, under half the screen.
- Empty stock story: "where the story starts" line renders as designed.
- The story dialog with a 60-char item name at 320/largest: fits, no sideways
  scroll.
- /manual in Hebrew keeps the (English) strip and stamp rendering cleanly.

## Weekend blocks — 21 Aug 2026, evening (owner away; standing ff instruction)

Worked from the owner's leaving brief: Epos ideas as far as they safely go,
other SaaS catches, ff everything non-money after a green gate WITH ITS EXIT
CODE CHECKED (a lesson bought mid-evening — see `cc6f61d`).

| Block | Shipped | What |
|---|---|---|
| A | `11c2eb7` | Manual stamp: date + content fingerprint, on screen, in MANUAL.md, and at the foot of every printed sheet; test forces the date forward when the words change |
| B | `c1f69f7` | E1's missing third: `/api/cron/digest` at 06:30 (after the sweep), sending only through the gated `sendEmail`; owner's flips are `DIGEST_TO` + `MAIL_LIVE` |
| C | `6e173b5` | 📌 Pop-up notes: card banner, page banner, till toast; escaped; 140-char cap; the loud channel kept scarce |
| D | `1408bb6` + `cc6f61d` | E4 stock story: derived trail, confessed opening figure, impossible counts called proven discrepancies. Second sha is the missing manual shot AND the ship-script fix after the gate ran red and shipped anyway |
| E | `6216eff` | STOCKLOW sweep tasks on the dashboard's own rule, closing on recovery; digest group added |
| J | `26ddab5` | Clarity-scan Tier 1 #7 and #8 closed as comments at the write site and the SIM form — not in applied migrations, and the scan says why. #4/#5/#6 held: renames of served fields and money labels are not weekend material |
| I | `3642620` | Claims re-sweep over the week's five new surfaces: four true, one false — the digest footer claimed "everything open, the same list the Tasks screen shows" while dropping snoozed tasks the screen shows. Reworded honestly, test re-pinned |
| H | `930fd07` | E6's last safe piece: the on-account-needs-a-customer rule now speaks in the tender area the moment "Paid now" is unticked on a walk-in — guard's own condition and wording, hard stops untouched |
| G | `3117ced` | Issue #16 closed: carrier post toasts within the minute it arrives — cheap pulse (count + headlines, never bodies), server-timestamp watermark, burst compression. 5 tests |
| F | `2cb3de5` | Common-jobs strip on /manual, drawn live from `lib/guides.mjs` (test makes a pasted question unshippable), print-hidden like the contents |

## UX/UI night — 21 Aug 2026 (03:20–05:30)

`audit-all.sh` reported clean, so the night started by not believing it. It had
printed a ✗ and signed off green in the same run, which turned out to be a
defect in the sweep rather than a fluke — and the finding it was sitting on was
real. After that the ground was the app's own dialogs: eighteen questions that
were still the browser's rather than the shop's.

| # | Shipped | What it was | Found by |
|---|---|---|---|
| 1 | `0281a43` | `public.mjs` counted its failures, printed "2 public-page check(s) failed" and exited **0** — the only one of nineteen harness scripts with no exit code — so `run()` saw success and the sweep said "all checks reported clean". `report()`'s return was thrown away too, so public-page contrast failures counted as nothing. And `tail -3 \| sed -n 1p` was showing one line of a two-line finding | reading the sweep's own output against its exit code |
| 2 | `bf59319` | The /manual contents links measured 155×23 on a phone — 26 of them, in **both** languages — under the 24px the rest of the app meets. This is the finding #1 had been hiding | the sweep, once it could fail |
| 3 | `4ae326e` | Eighteen dialogs were `window.confirm`/`window.prompt`: no dark mode, no text-size setting, no RTL, and phone chrome saying the BROWSER is asking at the moment the shop asks whether to delete a customer. `api.confirmDelete` was ten of them in one line | grep for native dialogs beside the house `kcConfirm`/`kcPrompt` |
| 4 | `71a509a` | Nothing in `ops/harness/` had ever opened `kcConfirm` or `kcPrompt`, though they are the ask before every destructive action — and the modal runner measures contrast on the live dialog, so they had never been contrast-checked either | writing an ad-hoc 320px check for #3 and noticing it would be thrown away |

| 5 | `712b56b` | The modal sweep announced "3 modal(s) flagged" on a run whose own line above said "2 distinct contrast failure(s)" — `bad += contrastAll.length` counted raw occurrences while `report()` dedupes and returns the real number. Two numbers for one answer, and the louder one was wrong | reading the sweep output added in row 4 |

The whole sweep is clean at the end of the night — `AUDIT: all checks reported
clean.`, no ✗ anywhere, exit 0 — and after row 1 that sentence means something.

### Found 21 Aug, NOT fixed — needs the owner

- [x] **P2 · S — DONE 21 Aug, once the owner answered.** The registered office
      is the **accountant's address**, ordinary practice for a small company
      here — so the objection that held this back (a registered office is often
      somebody's home, and publishing a home is not a script's call) does not
      apply, and it is published. It goes on the legal pages and on every
      receipt, always LABELLED and with "not the shop; come to the address
      above", because an unlabelled second address on a shop's website sends
      somebody to the wrong door. Deliberately NOT added to the small bilingual
      footers, which link to the legal pages instead. Original finding: `f896f2c` put the company number on every
      public page and every receipt, which was the missing half everyone notices.
      The other half is the **registered office address**, and checking the
      register showed the shop is not it: Companies House holds **158 Cromwell
      Road, Salford M6 6DE** for HATSLUCHE LTD (14138193, incorporated
      27 May 2022); the shop trades from 421 Bury New Road.
      A UK company must disclose its registered office on its website and its
      business letters, so naming only the trading address does not satisfy it.
      **Deliberately left for the owner rather than shipped:** that address may
      be a private home, and putting somebody's home on a live public website is
      not a gap a script gets to close. Two ways out and both are his — publish
      it, or move the registered office to an agent's address and publish that.
      Address confirmed against the live register the same day: Companies House
      shows "158 Cromwell Road, Salford, United Kingdom, M6 6DE", which is what
      shipped.

- [x] **P2 · XS — CHECKED 21 Aug, and it was a FALSE ALARM.** Nothing is
      overdue. The owner opened the live register: **accounts to 31 May 2025 are
      filed**, the next are for 31 May 2026 and not due until **28 February
      2027**, the confirmation statement was filed 26 May 2026 with the next due
      9 June 2027, and the company is Active.
      The scare came from a search snapshot that was a YEAR stale — it reported
      the 2025 accounts as still due by 28 Feb 2026. Flagged at the time as "may
      simply predate a filing" rather than as a problem, and that hedge was the
      right call: direct fetching of the register is blocked by this
      environment's egress policy, so search is the only route from here and its
      freshness cannot be assumed. **A search result about a live register is a
      lead, not a fact.**
      Recorded rather than deleted, because a false alarm that vanishes silently
      gets raised again by the next person to run the same search.

### Checked and genuinely clean (so nobody re-checks them)

- **Accessible names, all 15 tabs.** Every button, link, input, select and
  textarea computes a name the way a screen reader would (aria-labelledby →
  aria-label → `<label for>` → wrapping label → title → text). **Zero** without
  one, and placeholders were deliberately not counted as names.
  A regex over `main.js` had claimed five icon-only buttons with no name; all
  five were false — the pattern stopped at the first `${…}` and never saw the
  label after the icon (`✓ ${okLabel}`, `→ ${g.go}`, `£${n}`).
  Measure the rendered DOM, not the template source.
- **The scroll-wheel money hazard does not reproduce.** A focused
  `type="number"` used to take a wheel notch as an increment, which would have
  silently changed amounts on the charge-the-card dialog and the POS tender box.
  Filled the charge box with "20", focused, hovered, sent one notch: unchanged.
  Chromium no longer does this. Only the cosmetic spinner is left, across 51
  inputs, and that is not worth a global change on its own. Firefox is not
  available in this container, so no cross-browser claim is made either way.
- **The new dialogs at 320px with Simple Mode text largest.** `.modal`'s inline
  `width:430px`/`460px` does not defeat the stylesheet's `max-width:95vw`:
  304px wide inside a 320px viewport, 48px buttons, no inner overflow, no
  sideways page scroll.
