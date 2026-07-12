# Kosher Connect — Database Schema (Supabase / Postgres)

Relational schema for the operator system. **The SQL source of truth is
`supabase/migrations/` — this doc explains the design.** Build into **staging
first**, review, then production.

**What this is:** the app works today but stores everything in a single
key-value `store` table (JSON blobs). This schema reorganises the same data
into proper relational tables — customers, lines, rentals, ledger — gaining
referential integrity, an append-only tamper-evident money ledger, per-role
access control (RLS), and closure of the open `anon`-role write on `store`.
The app keeps its behaviour; the storage layer underneath changes. Retire
`store` once cut over.

**Conventions:** `snake_case`; plural tables; `uuid` PKs via
`gen_random_uuid()`; `timestamptz`; **all money `numeric(10,2)`, never float**.
Start empty — seed config, the service menu, and the holiday calendar only.

## Migration files

| File | Contents |
|---|---|
| `20260712120000_initial_schema.sql` | enums, all tables, ledger + constraints, view, trigger, indexes |
| `20260712120100_rls.sql` | RLS policies (3 tiers) + helper views for owner-only columns |
| `20260712120200_seed.sql` | rental_rates, damage_rates, settings, 33 service prices |
| `20260712120300_seed_holidays.sql` | 2,223 Yom Tov dates 2020–2125 (diaspora + israel), generated from `scripts/generate-holidays.mjs` output |

## Deltas from the original draft (why)

1. **`rental_items` table replaces the four `checklist_*` booleans.** The
   A-series per-item model is three-state (`undecided / returned / lost`) with
   a per-item `lost_charge` — booleans can't hold it, and the itemised
   breakdown, reversible lost charges, and `returned_incomplete` display all
   depend on it. A CHECK ensures a `lost_charge` only exists on a `lost` item.
2. **`damage_rates.sim_missing` added** (£10 everywhere). BUSINESS_RULES §1.6
   prices a lost SIM; the old `.gs` engine forgot it — the schema must not.
3. **Ledger sign is a CHECK constraint, not a comment.** Money-in types
   (`top_up`, `payment`, `refund`, `rental_void`) must be positive; every
   charge type negative; `rental_adjustment`/`manual_adjustment` either way but
   never zero. (`payment` added as a distinct type — a cash payment against
   arrears is not semantically a "top-up".)
4. **`tasks.reference` uses a partial unique index (`where not done`)** — one
   *open* task per key. A plain UNIQUE would permanently block re-raising
   `BALANCE-<id>` after the earlier task closed.
5. **`sims` reshaped to the real business:** `paid_by` is `kc | customer` (who
   fronts renewal money — not a payment method); `fee_applied` is a £ amount
   (SIMWatcher deducts it); added `provider_monthly_cost` + `dd_collection_day`
   (the `cost + max(10%, £2)` DD rule needs them).
6. **`holidays` table instead of a runtime Hebcal API call.** Deterministic,
   offline, seeded 2020–2125 from the committed generator. An API outage must
   never block pricing.
7. **`rental_status` gains `booked`** (future-start rentals — the live engine's
   derived status). `Cancelled`/`Lost` remain flags (`is_void`, `is_lost`);
   display status is derived: `is_void → Cancelled`, else `is_lost → Lost`,
   else by dates.
8. **Security hardening:** `current_staff_role()` pins `search_path`;
   `customer_balances` and the helper views are `security_invoker` so RLS
   applies to the querying role.
9. **Restored app fields the draft dropped:** `customers.city`,
   `customers.has_whatsapp`, `rentals.notes`, `rentals.vn_prefix`.
10. **Ledger gains `related_repair_id` / `related_booking_id`** alongside
    rental/sim, plus indexes on every hot FK.

## Pricing logic

```
charge = min( max(chargeable_days × rate, min_charge),
              cap × max(1, ceil(calendar_days / cap_period_days)) )
        → discount (percent | fixed) off the rental portion only
        → + VN add-on (weekly £5/wk, or £10 flat per 30 days)
```

Two day-counts: **chargeable** days (exclude Saturdays + `holidays` rows for
the rental's region) drive the £; **calendar** days drive the cap window.
Late fee = `late_fee_per_day × chargeable` late days (same exclusions),
**frozen** onto the rental at return. Damage/loss from `damage_rates`
(phone / charger / SIM), with optional per-line `replacement_value` override.
Verify pricing across a real festival before go-live.

## Charge-reference vocabulary (ledger idempotency keys)

`RENTAL-<id>`, `RENTAL-ADJ-<id>-<n>`, `RENTALRET-<id>` (return extras:
late fee + damage), `RENTAL-VOID-<id>` (the one refund per void),
`RENTAL-LOSS-<id>`, `SIM-ANNUAL-<id>-<year>`, `SIM-ADDL-<id>`,
`SIM-REPL-<id>-<n>`, `SIM-SVC-<id>-<n>`, `SIMRENEW-<messageId>`,
`REPAIR-<id>`, `TIMER-<id>`, `BOOKING-<id>`, `SALE-<id>`,
`TOPUP-<paymentId>`, `REFUND-<ref>`, `BALANCE-<customerId>` (tasks).

## Row-level security (3 tiers)

- **Ledger:** insert + select for staff; *no* update/delete policy, plus an
  immutability trigger. Reversals are new offsetting rows.
- **Owner-only:** `master_account_credentials`, `sold_phone_credentials`;
  writes to `rental_rates` / `damage_rates` / `settings` / `holidays`.
  `customers.stripe_pm_id` and `bookings.passport_expiry` are excluded from
  helpers via the `customers_helper` / `bookings_helper` views.
- **Owner + helper:** all remaining operational tables.
- **No `anon` policy on any table.**

## Build rules

- Money always `numeric(10,2)`; balances always derived (`customer_balances`),
  never stored.
- Customer dedup: block on `email_normalized` and on
  `(phone_country_code, phone_number)`; soft-warn on name. Normalize Gmail
  dots/`+alias` for **customer** emails only — never
  `master_accounts.account_email`.
- Sensitive data (credentials, card token, passport expiry) app-layer
  encrypted and owner-only; never on a customer-facing surface.
- Every change is a committed migration. Staging → review → production.
  No dashboard edits.
- Legacy value mapping at cutover: task priority `Normal → medium`;
  Apps Script ledger `Type` → `entry_type` (`Charge` → per-flow type,
  `Auto-deduct` → `sim_*`/`manual_adjustment`, `Top-up` → `top_up`,
  `Payment` → `payment`, `LateFee` → folds into `RENTALRET-<id>`).

## Open items

- `sim_annual_fee`: draft said £12, the app's price list charges £20 —
  **confirm before go-live** (seeded 12, flagged in `settings.description`).
- Per-SIM provider credentials (email/password currently plaintext in the web
  app) should move under `master_accounts` + `master_account_credentials`;
  no plaintext credential column exists in this schema by design.
