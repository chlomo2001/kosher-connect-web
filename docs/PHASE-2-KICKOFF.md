# Phase 2 — kickoff (start 2026-07-17)

## ✅ Day 1 happened Sunday 19 Jul — decisions taken + first wave shipped

**Decisions (owner, 19 Jul):** ① Email → **Resend** on `mail.kosher-connect.com`;
② Stripe card-on-file → **deposits + no-shows first**; ③ myPOS → owner
applies to the developer programme this week; ④ Kol Torah → **all four**
(titles, per-shul consignment, conversion jobs, takings).

**Shipped (all gated, on staging):**
- **Email hardening** (`d6b82a2`) — `email_log` (every attempt audited, even
  held ones), `email_suppressions` + Svix-verified Resend bounce/complaint
  webhook, Resend adapter preferred over SMTP. Still HOLD — inert until keys.
- **myPOS web plumbing** (`8aafffc`) — `window.KCTill` bridge contract,
  charge-first card flow in the till (approval cached per reference: a re-ring
  never taps the card twice), `card_receipts` settlement sidecar +
  `/api/pos/card-result`. Plain browsers: zero behaviour change.
- **Phone-migration logging** (`1f0641c`) — "Contact Transfer / Phone Setup"
  line on the Online & Print menu (£15/£10, owner-editable) + Contact Tools
  workbench card in Settings.
- **Kol Torah module** (`0a22f16`) — new tab: titles catalogue, per-shul
  consignment (guarded stock RPC + movement audit), settlements that post
  stock_sale/payment ledger rows on wallet-linked shuls, CD→MP3/SD jobs
  charging on collection.

**Owner next:** add the Resend domain + DNS, pull `RESEND_API_KEY` /
`MAIL_FROM` / `RESEND_WEBHOOK_SECRET` into Vercel (HOLD stays until
`MAIL_TEST_TO` walk-through); start the myPOS developer application; pull
Stripe **test** keys. Kc-production is **ACTIVE_HEALTHY again** (was
RESTORE_FAILED) — the §0 promote-vs-fill decision in LAUNCH-PHASE2.md is
now unblocked.

One page to start from. The detail already lives in **`PHASE-2-PLAN.md`**
(payments & email) and **`PHASE-2-NOTES.md`** (new lines, ideas, limits); this
is the sequencing, the decisions only you can make, and the Day-1 move.

## How we'll work — the improvement loop
Every improvement — a UX tweak, a smoothness fix, an integration — runs through
the **kc-improve loop** (`.claude/skills/kc-improve/`): discover the best next
idea → prototype it → verify against the objective gate (`gate.sh`: tests ×2 TZ
+ build) **and** the offline visual harness → you accept or reject. One idea per
cycle. Human owns "done." Backlog + log: `ops/loops/kc-improve/BACKLOG.md`.
The metric that says it's working: **cost per accepted change ≥ 50%**.

## The four tracks (priority order)
- **A — Go-live plumbing** *(from PHASE-2-PLAN.md)*: **Email → myPOS → Stripe.**
  Email first (lowest risk, DNS has lead time), myPOS in parallel (dev-programme
  review is the long pole), Stripe last (most surface area, least urgent).
- **B — New business line**: **Kol Torah CD module** (needs a scoping answer
  before build) + **phone-migration job logging** (ready to build now).
- **C — UX / smoothness / ideas**: the ongoing kc-improve backlog. First item:
  your live-test sign-off on this session's design work.
- **D — Data / integrations**: Gmail/Drive scan (needs your go-ahead + scope),
  dashboard sparklines (needs a trend data source).

## Decisions to bring Monday morning (each with my recommendation)
These unblock Day 1 — answering them is the real "prep."

1. **Email provider + sending domain.** → *Recommend:* **Resend** on a subdomain
   `mail.kosher-connect.com` (easy DKIM/SPF/DMARC + bounce webhooks). Alternative:
   keep Forward Email SMTP (no delivery webhooks). *You:* pick one; if Resend,
   who owns the DNS records for `kosher-connect.com`?
2. **Stripe — which cases go card-on-file first?** → *Recommend:* **deposits +
   no-shows** first (clear consent, high value), SIM direct-debits next. *You:*
   confirm, and who pulls the **test-mode** keys from the Stripe dashboard.
3. **myPOS developer-programme access** — needed to publish a custom app to the
   K300 (the long pole). *You:* confirm we have/can get developer access. GBP ✓
   and on-machine refunds ✓ are already confirmed.
4. **Kol Torah scope** — what to track: titles catalogue? per-shul
   stock/consignment? CD→MP3/SD conversion jobs? takings per shul? *You:* a few
   sentences and I'll scope the module.
5. **Gmail/Drive scan** — do you want it, and with what scope (which accounts,
   read-only, what we're looking for)? Private mail — explicit go-ahead only.

## Blockers to clear before anything ships (build can proceed regardless)
- **Vercel auto-deploy stalled** after `11630e2` — pushes aren't building. Clear
  the GitHub→Vercel integration (or hit Redeploy) so the branch goes live.
- **Production DB** `Kc-production` = RESTORE_FAILED — must be healthy before the
  two pending migrations (`20260716140000` ivr_platforms, `20260715160000`
  documents) can apply.

## Day 1 (Monday) — concrete
1. **You:** answer decisions 1–3 (email provider+domain, Stripe first-cases + who
   pulls test keys, myPOS dev access). Start the **email DNS** the moment the
   provider is picked — propagation is the lead time.
2. **Me, in parallel (no owner blocker):**
   - Build the **email hardening** that doesn't need the provider chosen: the
     `email_log` table + suppression, still behind HOLD.
   - Build **phone-migration job logging** (Track B, ready now).
   - Run a **kc-improve discover pass** to firm up the UX backlog while you
     live-test this session's work.
3. **Together, 20 min:** Kol Torah scoping so Track B's module can start.

Nothing here goes live by accident: test/sandbox keys first, email walks
HOLD→TEST→LIVE, card data never touches our DB — same discipline as Phase 1.
