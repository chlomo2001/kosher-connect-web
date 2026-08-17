-- One row per DAY, for the dashboard's trend lines (owner, 17 Aug — the
-- Lightspeed dashboard puts a small line under each figure).
--
-- The existing aggregates answer "totals since an instant", which is the right
-- shape for a period and the wrong one for a trend: a sparkline needs the
-- shape of the days, not their sum. This returns that shape, and only that —
-- two numbers per day, at most a few hundred rows.
--
-- Days are LONDON days. Grouping on the raw timestamptz would cut the day at
-- UTC midnight, which through British Summer Time puts an hour of every
-- evening's takings on the following day's line — the same trap
-- lib/localDay.mjs exists to keep out of the cash-up.
--
-- Empty days are included. A gap in a trend line must read as "nothing came in
-- that day", not as a missing point the line quietly bridges over.

create or replace function ledger_daily_series(p_from date, p_to date)
returns table (day date, charged numeric, received numeric)
language sql
stable
set search_path = public
as $$
  with days as (
    select generate_series(p_from, p_to, interval '1 day')::date as day
  ),
  rows as (
    select
      (l.created_at at time zone 'Europe/London')::date as day,
      -- Same split as ledger_revenue_since: charges are the money-out rows,
      -- received is money actually in. The two copies must agree, so if one
      -- changes the other has to.
      coalesce(sum(-l.amount) filter (where l.amount < 0), 0)::numeric as charged,
      coalesce(sum(l.amount) filter (where l.entry_type in ('payment', 'top_up') and l.amount > 0), 0)::numeric as received
    from ledger l
    where (l.created_at at time zone 'Europe/London')::date between p_from and p_to
    group by 1
  )
  select d.day,
         coalesce(r.charged, 0)::numeric,
         coalesce(r.received, 0)::numeric
  from days d
  left join rows r on r.day = d.day
  order by d.day;
$$;

revoke execute on function public.ledger_daily_series(date, date) from public, anon, authenticated;
grant  execute on function public.ledger_daily_series(date, date) to service_role;
