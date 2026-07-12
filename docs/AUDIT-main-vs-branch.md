# Deep Audit: `main` (web app) vs branch (Apps Script backend)
_Audited 2026-07-12 at branch HEAD `2aa2365` (main = `1854541`, fully contained in branch)._

## The real picture

Git has nothing to reconcile — `main` is a strict ancestor of the branch. The true comparison
is **two parallel implementations of the same business** living side by side in one repo:

| | `main` — Next.js web app | branch adds — Google Apps Script backend |
|---|---|---|
| Code | `public/main.js` (~2,760 lines) + thin API routes | 8 `.gs` files (~3,216 lines) |
| Storage | Supabase key-value table (raw REST) or gitignored JSON files | Google Sheets tabs (Customers, Rentals, Ledger, …) |
| Covers | Rentals UI, customers, phones, SIM plans, holiday engine, per-item lost/returned | Rental engine, wallet/Ledger, bookings, repairs+timers, SIM email watcher, seeds |
| Talks to each other | **No.** Nothing in the web app calls the `.gs` files, and vice versa. | |

`BUSINESS_RULES.md` is the declared source of truth for both.

## Rule-by-rule: who implements the business rules better

| Rule (BUSINESS_RULES.md) | Web app (`main.js`) | Apps Script (`.gs`) | Winner |
|---|---|---|---|
| §1.1 Daily rates / min / cap | Exact match, hardcoded (`calcRentalPrice`, main.js:571-592) | Settings-tab driven (`calcRental`, RentalEngine.gs:99) but **Settings values are stale vs the real price list** (documented at Seed.gs:8-26) | Web for correctness today; .gs architecture (settings-driven, fail-loud `getSettingValue`) is the better design |
| §1.2 Shabbos/YT exclusion | Pre-generated 2020–2125 Diaspora + Israel sets via @hebcal (main.js:280-569) | Holidays tab seeded only 5787–5789 (Code.gs:230), positional reads | **Web, clearly** — the holiday engine is main's crown jewel |
| §1.2 cap ⇒ all 30 days count | Not implemented (price clamp only) | Not implemented (price cap only) | Neither — open item |
| §1.3 VN add-on | Weekly £5 / monthly £10 with prefix picker (main.js:1033-1063) | Flat £5 regardless of weeks (RentalEngine.gs:124) — **undercharges multi-week rentals** | Web |
| §1.4 Late fee = £1/chargeable day | Holiday-aware (`calcLateFeeDays`, main.js:605-611), **frozen at save** (main.js:1658) | **Raw calendar days** incl. Shabbos/YT (RentalEngine.gs:162) — systematic overcharge, violates rules | **Web, clearly** |
| §1.5 Discounts (% or £) | Implemented (main.js:1140-1146) | **Not implemented** | Web |
| §1.6 Loss/damage charges | Per-item returned/lost/undecided with reversible charges, itemised breakdown, `returned_incomplete` state (the whole A-series) | Phone+charger only; **SIM missing = "no charge"** (RentalEngine.gs:176) despite §1.6 pricing it £10; no per-item model | **Web, clearly** |
| Wallet / ledger / payments | **Muddled**: `totalPaid` records charges not receipts; manual payments never clear rental debt (main.js:1238, 2013-2033) | Real double-entry-ish Ledger with `BOOKING-<id>` / `TIMER-<id>` dedupe tags, wallet balance, min-charge logic | **.gs, clearly** — this is the branch's crown jewel |
| Bookings (flights) | Doesn't exist | Full flow: addBooking → auto wallet charge, passport-expiry sweep | .gs (only implementation) |
| Repairs + billable timers | Doesn't exist | Clean single-sweep model, double dedupe guard, report-first legacy cleanup | .gs (only implementation) |
| SIM renewals | Manual charge entry, renewal banner (main.js:2306-2724) | Automated Gmail watcher + AI classification fallback, auto fee recovery | Complementary — web = manual ops, .gs = automation |

## Critical findings

### On the branch (.gs)
1. **[CRITICAL] `Ledger.gs` and `CustomerOnboarding.gs` are missing from the repo.** `appendLedgerEntry`, `getWalletBalance`, `autoDeduct`, `recordManualPayment`, `addCustomer` are called from 4+ files and defined nowhere. The repo cannot be deployed as-is, and the money-writing core cannot be audited.
2. **[CRITICAL] Charge-sign contradiction.** Bookings.gs:165 posts a **negative** 'Charge'; Repairs.gs:280 posts a **positive** 'Charge' and documents that Ledger derives sign from type. Exactly one is wrong — one flow is posting wrong-signed money.
3. **[HIGH]** Late fee counts Shabbos/YT (violates §1.4). Missing-SIM charge not implemented (§1.6). VN weekly is flat not per-week (§1.3).
4. **[HIGH]** `calcReturn` never posts to the Ledger and never flips the phone back to Available — phones are one-shot; no re-run guard on calcReturn.
5. **[HIGH]** `seedCustomers` writes literal values into the NormalisedEmail ARRAYFORMULA column → `#REF!`; also uses a third, incompatible email-normalisation rule (three exist: Code.gs formula strips ALL dots, Seed.gs keeps dots, SIMWatcher strips dots).
6. **[MEDIUM]** No LockService anywhere — BOOKING/TIMER dedupe guards and all `nextId*` are read-then-write races. Re-seeding demo data after `clearDemoData` collides with old `BOOKING-n` ledger tags → phantom balances. `seedPriceList` leaves ServiceID blank relying on onEdit, which never fires for script writes → 33 unaddressable rows.
7. Three parallel ID generators with different string-handling; positional vs header-addressed writes mixed on the same tabs; `getSetting` (silent-fallback pricing, dead code) contradicts fail-loud `getSettingValue`.

### On main (web app)
1. **[HIGH] The two "Fix:" commits were only half-applied.** Customer panel (main.js:1844-1846, 1922-1924) still uses live `calcLateFeeDays` for returned rentals, omits `lostChargesTotal`, and adds late fee outside the debt clamp — same bugs `e812ccb`/`1854541` fixed in the rentals tab.
2. **[HIGH]** `deleteCustomer` checks only legacy `returnedItems`, not `itemStatus` (main.js:2255-2257) — rentals returned via the new toggles still block customer deletion.
3. **[HIGH]** Money semantics muddled: `c.totalPaid` incremented by rental *price* on booking (a charge, not a receipt); manual payments don't reduce rental debt. Exactly the problem the .gs Ledger solves.
4. **[MEDIUM]** No auth; rentals/phones/sims POST replaces the whole array (last-writer-wins between two browsers); JSON-file fallback loses data on serverless deploys.
5. **[MEDIUM]** All "today" logic uses UTC `toISOString()` — Shabbat/holiday classification can shift a day near midnight UK time.
6. SIM provider passwords stored/displayed in plaintext, injected into onclick; a few unescaped HTML interpolations; `@supabase/supabase-js` is a dead dependency; new rentals still init legacy `returnedItems: {}`.

## "Best of both" map

**Keep from main (web app):**
- Holiday engine (2020–2125 diaspora/Israel sets + generator scripts)
- `calcRentalPrice` rate table (matches rules today)
- Frozen-at-save late fee model, holiday-aware late-day counting
- Entire A-series per-item lost/returned system (reversible charges, itemised breakdown, `returned_incomplete`)
- Overpaid-reconcile warning, Hebrew-date labels, duplicate-customer detection

**Keep from branch (.gs):**
- Ledger/wallet architecture: idempotency tags (`BOOKING-<id>`, `TIMER-<id>`), read-guard-then-post pattern (add LockService)
- Settings-driven pricing with fail-loud `getSettingValue` (reconcile values first)
- Repairs timer sweep model (two-guard dedupe, report-first legacy cleanup)
- Bookings flow + passport sweep; SIMWatcher automation
- `Common.gs` discipline: header-addressed access, single definition per helper

**Fix regardless of direction:** late-fee chargeable-day rule in .gs; missing-SIM £10 charge; VN per-week; the half-applied customer-panel fixes; `deleteCustomer` itemStatus check; recover/rewrite `Ledger.gs` and settle the sign convention.

## The open strategic question

The two systems share no data and duplicate the business logic. Before building further, decide the
target architecture: web app as the product with a real backend (port .gs money logic over), Sheets/Apps
Script as the operational system (port A-series logic over), or deliberately both with a sync boundary.
