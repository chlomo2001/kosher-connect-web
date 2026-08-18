# CLAUDE.md — Kosher Connect working agreement

## Business
Hatsluche Ltd t/a Kosher Connect — kosher telecom shop at 421 Bury New Road, Salford M7 4ED
(0161 531 1386). Owner contact: e.a.rothbart@gmail.com. Services: international phone rentals,
UK SIM-only plan management, virtual numbers, flight bookings, phone repairs, accessories/POS,
online tech services, Kol Torah consignment. Audience is the orthodox Jewish community —
copy is British English and imagery/tone must fit the community.

## Deploy ritual
- Develop on the session dev branch; never commit straight to `main`.
- Before any ship: `bash ops/loops/green-keeper/gate.sh` must print `GATE: PASS — branch is shippable.`
- Ship to production without waiting to be asked (owner, 2026-08-10: "dont ask before ff"):
  once the gate passes, `--ff-only` merge the dev branch into `main`, push, switch back.
  Vercel auto-deploys `main`. Exception: work the owner explicitly asked to judge first
  (before/after prototypes) stays on the dev branch until their verdict.

## Standing approvals (granted by owner in chat)
- 2026-07-28: run Supabase `execute_sql` against production (Kc-Live, project
  `xsrtdwwzxdmnjdtjcdzd`) without asking before each query. Care still applies:
  keep an undo snapshot before bulk data writes; schema changes go through
  migration files, not ad-hoc DDL.

**A standing approval written here does not stop the permission prompt.** This
file is prose; the prompt is driven by the allowlist in `.claude/settings.json`.
Put the tool there too, in the **tracked** file — `.claude/settings.local.json`
is gitignored, and every web session clones the repo into a fresh container, so
an approval that lands only in the local file is thrown away with the container
and the owner gets asked again next session.

## The manual
- Every screen is described once in `lib/manual.mjs`. The printable page (`/manual`) and
  `docs/MANUAL.md` are generated from it — never edit those by hand.
- A change to what a screen does updates that screen's entry in the same commit.
  `test/manual.test.mjs` insists anyway: a new tab, a new dialog or a renamed primary
  button fails the gate until the manual matches.
- No prices, rates, free-day lists or periods in the manual. They live in Settings and
  BUSINESS_RULES.md, so the business has one price list and the till is holding it.

## Hard rules
- Secrets live only in Vercel env vars — never in code, the repo, or chat. Never ask the owner
  to paste secret keys into chat (non-secret `pk_` prefixes are fine).
- Live email/SMS sends stay HOLD-gated until the owner flips them on.
- Passport numbers are PII: booleans/counts only in chat, reports, and logs.
