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
- [ ] **P1 · S** — Shop oversell: guarded/atomic stock decrement
      (`shop.js:149,195`) — two tills can both sell the last unit. **Real bug.**
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
- [ ] **P2 · M** — **Per-SIM usage bar** (data left / days / expiry) in the portal.
      (Airalo.) *(display-only; the data feed is the work.)*
- [ ] **P2 · M** — **Customer-360 detail page** w/ an activity-log tab. (Stripe.)
- [ ] **P2 · M** — **⌘K acts on the current selection** (verbs, not just nav). (Linear.)
- [x] **P3 · M** — **NL snooze** ("remind me tomorrow 9am") on bookings/customers.
      *Shipped 07-27 (date-level) for the task snooze picker via `kcParseWhen`;
      time-of-day + the ⏰ remind modal can adopt the parser later.*

⚠ Money / consent / comms — human-reviewed, NOT loop-autofixed:
- [ ] **P1 · M** ⚠ — **Idempotency key on every charge/ledger write** (client-generated)
      so retries/double-clicks can't double-charge. (Stripe.) *Highest-leverage
      safety pattern; overlaps review A2. Do with owner.*
- [ ] **P2 · M** ⚠ — **Wallet balance as a tender** at the till (store credit). (Square.)
- [ ] **P2 · S** ⚠ — **Cash pay-in/pay-out log** + **Z-report variance** (expected vs
      counted) at shift close. (Loyverse.) *internal cash reconciliation.*
- [ ] **P2 · M** ⚠ — **Status-change auto-SMS** ("ready for collection", "conversion
      done") + **reply-to-approve**. (RepairShopr.) *gated on the email/SMS decision.*
- [x] **P2 · S** ⚠ — ~~Non-refundable damage waiver~~ — built 17 Jul, then **REMOVED
      by owner decision 20 Jul** (never confirmed; damage-charges schedule covers it).
      **Do not rebuild.**
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
- [ ] **P2 · S** — **Apply `20260731180000_bank_transactions.sql`.** Written,
      not applied anywhere. No hurry until something fills it.
- [ ] **P2 · M** — **Statement upload screen.** `lib/bankCsv.mjs` parses and is
      driveable from a script; the screen wants a real statement in front of it.
- [ ] **P3 · M** — **Provider client** (GoCardless Bank Account Data — free UK
      account-information tier; you connect under their FCA licence, not your
      own). Budget for **90-day consent expiry**: someone re-authenticates
      quarterly, and it should be a named job. Untestable without credentials.
- [ ] **P3 · M** — **Triage UI** for proposed matches. Design it against real
      transactions, not imagined ones.

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
