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
- [ ] **P1 · M** — **Barcode/QR check-out ↔ return** — one scan flips rental status.
      (Booqable.) *(reuses the existing IMEI scanner.)*
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
