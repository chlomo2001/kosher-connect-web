-- Money aggregates computed IN the database, so the dashboard and revenue
-- report stay correct no matter how many rows exist. PostgREST caps a plain
-- SELECT at 1000 rows by default; the old code summed customer_balances and the
-- ledger client-side over unbounded SELECTs, so past that cap the "owed",
-- "in credit", "today in/out" and revenue totals would silently under-count.
-- Aggregating server-side returns a fixed handful of rows — never truncated.
--
-- SECURITY INVOKER (the default): only the service role (used by the API routes)
-- may read this financial data. EXECUTE is revoked from anon/authenticated and
-- granted to service_role only — the same default-privilege hole that made
-- adjust_stock_qty callable by anyone (cycle-1 finding) must not reappear here.

-- Sum of balances owed to the shop (negative) and held in credit (positive),
-- plus the head-counts, over EVERY customer.
create or replace function wallet_totals()
returns table (owed numeric, credit numeric, debtor_count bigint, creditor_count bigint)
language sql
stable
set search_path = public
as $$
  select
    coalesce(sum(balance) filter (where balance < 0), 0)::numeric,
    coalesce(sum(balance) filter (where balance > 0), 0)::numeric,
    count(*) filter (where balance < 0),
    count(*) filter (where balance > 0)
  from customer_balances;
$$;

-- Money-in / money-out since an instant (the day window, London-anchored by the
-- caller). Signed: money_out is negative, matching the ledger convention.
create or replace function ledger_day_flow(p_from timestamptz)
returns table (money_in numeric, money_out numeric)
language sql
stable
set search_path = public
as $$
  select
    coalesce(sum(amount) filter (where amount > 0), 0)::numeric,
    coalesce(sum(amount) filter (where amount < 0), 0)::numeric
  from ledger
  where created_at >= p_from;
$$;

-- Revenue report since an instant, grouped by entry_type. Each row carries the
-- charge total (positive; debit types only) for that type, plus the money
-- actually received (payment/top_up) and refunded — the caller sums across rows
-- for the headline figures and uses `charged` per type for the breakdown.
create or replace function ledger_revenue_since(p_from timestamptz)
returns table (entry_type text, charged numeric, received numeric, refunded numeric)
language sql
stable
set search_path = public
as $$
  select
    l.entry_type::text,
    coalesce(sum(-l.amount) filter (where l.amount < 0), 0)::numeric,
    coalesce(sum(l.amount) filter (where l.entry_type in ('payment', 'top_up')), 0)::numeric,
    coalesce(sum(l.amount) filter (where l.entry_type = 'refund'), 0)::numeric
  from ledger l
  where l.created_at >= p_from
  group by l.entry_type;
$$;

-- Lock EXECUTE to the trusted operator surface only.
revoke execute on function public.wallet_totals()                    from public, anon, authenticated;
revoke execute on function public.ledger_day_flow(timestamptz)       from public, anon, authenticated;
revoke execute on function public.ledger_revenue_since(timestamptz)  from public, anon, authenticated;
grant  execute on function public.wallet_totals()                    to service_role;
grant  execute on function public.ledger_day_flow(timestamptz)       to service_role;
grant  execute on function public.ledger_revenue_since(timestamptz)  to service_role;
