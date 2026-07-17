# Phase 2 — real launch plan (drafted Fri 17 Jul 2026, for after Shabbes)

The goal: all three surfaces live for the world — the staff app (`/`), the
customer portal (`/portal`) and the public site (`/welcome`) — running on a
production database with the real business data.

## Where things stand (verified 17 Jul, ~18:45 UK)

- **Branch** `claude/branch-status-check-ez7s3t` holds everything through the
  converter suite; the gate (61 tests ×2 timezones + production build) is green
  on every commit.
- **Vercel** stopped receiving pushes at ~13:33 (Git integration error:
  "Project Link not found"). Three commits are queued unbuilt. Reconnecting
  needs the GitHub login (psic770-ai) — Mechel, after Shabbes (§1).
- **Kc-staging** (`xsrtdwwzxdmnjdtjcdzd`) carries the full 43-migration chain
  AND the real business data (customers, SIMs from the Three import, phones,
  plans, rentals, ledger). It is the de-facto system of record today.
- **Kc-production** (`rcpqgujtutvpfzfsgzql`) is effectively EMPTY: one
  vestigial `store` table, 0 rows, one out-of-band migration from May. The
  migration chain has never run there. There is nothing on it to preserve.

## 0 · The one decision to make first: which database goes live

Because Kc-production is empty and Kc-staging holds the real data, there are
two honest options:

**Option A — promote Kc-staging to live (recommended).**
Rename Kc-staging → "Kc-live" and point the production deployment at it.
Zero data movement, zero drift risk — the DB the owner has been testing
against IS the launch DB. Then apply the migration chain to Kc-production
from scratch and use it as the new staging.
*Cost: the name says "staging" until renamed; nothing else.*

**Option B — fill Kc-production and cut over.**
Apply all 43 migrations to Kc-production (clean, since it's empty), then copy
the data across (pg_dump/restore or re-run the import scripts), then point
production at it. More moving parts, a data-freeze window, and every copy step
is a chance to lose a row. Only worth it if the "production" project must be
the live one for billing/organisational reasons.

Either way: **no migration ever runs on the live DB without the owner's
explicit go-ahead** (standing rule).

## 1 · Mechel — restore Vercel auto-deploys (needs the psic770-ai GitHub login)

1. vercel.com → team *Touch Design projects* → project **kosher-connect-web**
   → Settings → Git. It shows *"Error: Project Link not found"*.
2. **Remove Connection** (safe — the dialog itself says settings, env vars,
   domains and deployments are preserved), then **Connect Git Repository →
   GitHub → psic770-ai/kosher-connect-web**. Approve the GitHub prompt.
3. Optional sanity check on the GitHub side: github.com → Settings →
   Applications → Installed GitHub Apps → Vercel → Configure — the repo should
   be in the access list.
4. Back on Deployments → **Create Deployment** → branch
   `claude/branch-status-check-ez7s3t` → this builds everything queued.

## 2 · Ship the code

- Merge `claude/branch-status-check-ez7s3t` → `main` (that's what the
  production domain builds from).
- Production deploy happens automatically once §1 is done.

## 3 · Production environment variables (Vercel → Settings → Environment Variables)

Everything the code reads, with launch values:

| Variable | Value at launch | Notes |
|---|---|---|
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | the LIVE DB from §0 | the single most important pair |
| `DATA_BACKEND` | `tables` | relational layer (the `store` backend is retired) |
| `AUTH_MODE` | unset (auth ON) | never `off` in production |
| `PORTAL_ENABLED` | `1` | turns /portal from 404 to live |
| `PORTAL_GOOGLE` / `STAFF_GOOGLE` | `1` only after the Google provider is enabled in Supabase auth | optional at launch |
| `SIM_CRED_KEY` | owner holds it; paste into Vercel only | never in git — without it credential reveal stays off (fail-closed) |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` | LIVE keys | portal pay-by-card + save-card |
| `STRIPE_WEBHOOK_SECRET` | from the live-mode webhook (§4) | |
| `CRON_SECRET` | any long random string | protects /api/cron/sweep |
| `SMTP_HOST/PORT/USER/PASS`, `FORWARDEMAIL_API_KEY`, `MAIL_DOMAIN`, `MAIL_FROM` | set when ready | |
| `MAIL_LIVE` | **leave unset — email sending stays on HOLD** | drafts-only rule stands until the owner lifts it |
| `MAIL_TEST_TO` | owner's address | where test sends go while HOLD |

## 4 · Stripe live mode

1. Dashboard (live mode) → Developers → Webhooks → add endpoint
   `https://<production-domain>/api/stripe/webhook`; copy the signing secret
   into `STRIPE_WEBHOOK_SECRET`.
2. First £1 test payment through the portal, confirm the ledger entry posts,
   then refund it.

## 5 · Cron

`vercel.json` schedules `/api/cron/sweep` daily at 06:00 — verify it appears
under Vercel → Cron Jobs after the first production deploy, and that
`CRON_SECRET` matches.

## 6 · Owner smoke tests (the live-till list, still pending)

- Sign in + 2FA; dashboard loads with real numbers.
- New rental incl. the damage-waiver line (settings-driven 5%); Manage
  recalculates; status-SMS draft opens (and sends nothing).
- POS: sell the last unit of something from two tills (A1 oversell guard),
  double-click a sale (idempotency), part-pay from wallet credit.
- Portal: request a magic link, see balance/rentals, upload a document.
- /welcome in all three languages, light + dark; converters
  (/tools/contacts, /tools/transfer) with a real spreadsheet and an NBF.

## 7 · Open product decisions (owner)

- Should `/` send signed-out visitors to `/welcome` instead of `/login`?
- Keep or drop the "Serving the Heimishe community — Manchester" strapline.
- Yiddish copy needs the owner's read-through (chasidish orthography).
- Damage-waiver default 5% — confirm or adjust in Settings.
- When (if ever) to lift the email/SMS HOLD — currently everything is
  draft-only by design.

## 8 · Known deferred items

B5 (Rentals filter unify), B8 (mobile sidebar), family-trip customer name,
Canada/EU loss rates in the T&C schedule, pl-sim-32/pl-sim-51 carrier check.
