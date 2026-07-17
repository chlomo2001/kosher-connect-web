-- Idempotency keys — a general claim table so a retry / double-click / parallel
-- submit of the same operation runs its side effects at most once.
--
-- The ledger is already idempotent on charge_reference (a duplicate charge row
-- is ignored). What that DOESN'T cover is a *non-ledger* side effect that runs
-- before the ledger row exists — e.g. two concurrent shop submits with the same
-- client token both decrement stock, then the ledger dedupes to one charge
-- (charged once, stock taken twice). A row here is claimed BEFORE any side
-- effect: the first submit inserts the key; a concurrent/repeat submit collides
-- on the primary key and short-circuits.
--
-- Service-role only (RLS on, no anon/authenticated policy → denied by default).

create table if not exists public.idempotency_keys (
  key         text primary key,
  scope       text,
  customer_id uuid,
  created_at  timestamptz not null default now()
);

alter table public.idempotency_keys enable row level security;
