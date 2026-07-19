-- Phase 2 Workstream A — terminal (myPOS K300) results, keyed to the ledger.
--
-- When the till runs inside the "KosherConnect Till" wrapper on the K300, an
-- approved card tap posts its terminal references (myPOS ref, STAN, auth code,
-- brand, last 4) here against the SAME charge_reference as the ledger payment
-- row, so end-of-day card totals can be tied to the myPOS settlement line by
-- line. The ledger itself is append-only and stays untouched — this is a
-- sidecar, joined on charge_reference. Never more than the last 4 digits of a
-- card is stored (enforced in lib/posCard.mjs). Service-role only.

create table if not exists card_receipts (
  id               uuid primary key default gen_random_uuid(),
  charge_reference text not null,           -- matches ledger.charge_reference (PAY-SALE-…)
  provider         text not null default 'mypos',
  approved         boolean not null,
  amount           numeric,                 -- what the terminal approved, for cross-checking
  mypos_ref        text,
  stan             text,
  auth_code        text,
  card_brand       text,
  last4            text,
  error            text,                    -- decline reason, when approved = false
  created_at       timestamptz not null default now()
);
-- Many declined attempts may share a reference; at most ONE approved result.
create unique index if not exists card_receipts_approved_ref
  on card_receipts (charge_reference) where approved;
create index if not exists card_receipts_ref_idx on card_receipts (charge_reference);
alter table card_receipts enable row level security;
-- No policy on purpose: only the service-role API routes touch this table.
