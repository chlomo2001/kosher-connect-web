# Legacy: Google Apps Script backend (historical — NOT deployed from here)

**Status (decided 2026-07-12): the Sheets/Apps Script direction is abandoned.
Everything is built on the Next.js app** (`pages/`, `public/main.js`) with the
Supabase relational schema (`supabase/migrations/`, `docs/SCHEMA.md`).

These 13 files are kept as **reference only** — they contain design patterns
worth stealing, and record how the business logic worked during the Sheets era.
Do not extend them; do not deploy them.

## Good points already stolen into the new plan

| Pattern | Where it came from | Where it lives now |
|---|---|---|
| Append-only ledger, derived balances | `Ledger.gs` | `ledger` table + immutability trigger + `customer_balances` view |
| Sign derived from entry type | `Ledger.gs` `typeSign_` | `ledger_amount_sign` CHECK constraint |
| Idempotency references (`RENTAL-<id>`, `BOOKING-<id>`, `TIMER-<id>`…) | `Ledger.gs` / `Bookings.gs` / `Repairs.gs` | `ledger.charge_reference UNIQUE`; vocabulary in `docs/SCHEMA.md` |
| One refund per void, refund ≤ net charged, partial allowed | `WebConsole.gs` | schema + build rules |
| Preview-then-confirm destructive writes, locks around check→write | `WebConsole.gs` | pattern for the app's API routes |
| Settings edit-only + hardcoded type rules (money/percent/days) | `WebConsole.gs` | `settings` table + owner-only RLS; validation rules to port |
| Fail-loud missing rate (never price at £0) → RATEMISSING task | `Common.gs` / `WebConsole.gs` | build rule + keyed tasks (`tasks.reference`) |
| One OPEN task per reference, re-raisable after close | `Ledger.gs` collections sweep | `tasks_reference_open_key` partial unique index |
| Webhooks: never trust the POST body, re-fetch from source, terminal-vs-transient | `Ledger.gs` Stripe handler | pattern for Next API webhook routes (with real signature verification) |
| SIM renewal dedupe on message id | `SIMWatcher.gs` | `SIMRENEW-<messageId>` reference format |
| Pool scoring (expiry-fit + activation-fee bonus) | `PoolOptimiser.gs` | algorithm to port when pools land in the app |

## Known gaps in this snapshot (irrelevant now, recorded for honesty)

Six functions from the final live `RentalEngine.js` (charge sweep, derived
statuses, RENTAL-ADJ netting) and `Dashboard.js` were never captured here, so
this folder does not run as-is in Apps Script. It doesn't need to — see
`docs/AUDIT-main-vs-branch.md` for the full comparison that led to this
decision.
