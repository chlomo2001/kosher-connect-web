-- Who the shop actually served in a period (owner, 17 Aug — the Lightspeed
-- customer view: how many, how much each, how many came back).
--
-- Everything here is derived from the ledger, so it agrees with the money
-- figures beside it by construction. Nothing new is stored, and nothing needs
-- keeping in step.
--
-- Definitions, written down because each of them is a choice someone could
-- reasonably make differently:
--
--   served    a customer with at least one CHARGE in the period. Charges, not
--             payments: paying off an old debt is not being served again.
--   new       a customer whose FIRST EVER charge falls inside the period. Not
--             "created in the period" — a record imported from a spreadsheet
--             years ago is not a new customer the day someone finally bills it.
--   returning served, and had been charged at some point before the period.
--             served = new + returning, always.
--   spend     what they were charged in the period, not what they paid. What
--             they paid is a question about collection, and the tiles above
--             already answer it.
--
-- Days are London days, same as ledger_daily_series.

create or replace function ledger_customer_stats(p_from date, p_to date)
returns table (
  served bigint,
  new_customers bigint,
  returning_customers bigint,
  total_charged numeric,
  top_customer_id uuid,
  top_customer_charged numeric
)
language sql
stable
set search_path = public
as $$
  with charges as (
    select customer_id, -amount as amt, (created_at at time zone 'Europe/London')::date as day
    from ledger
    where amount < 0 and customer_id is not null
  ),
  in_period as (
    select customer_id, sum(amt) as charged
    from charges
    where day between p_from and p_to
    group by customer_id
  ),
  first_ever as (
    select customer_id, min(day) as first_day
    from charges
    group by customer_id
  )
  select
    (select count(*) from in_period),
    (select count(*) from in_period p join first_ever f using (customer_id) where f.first_day >= p_from),
    (select count(*) from in_period p join first_ever f using (customer_id) where f.first_day <  p_from),
    coalesce((select sum(charged) from in_period), 0)::numeric,
    (select customer_id from in_period order by charged desc limit 1),
    coalesce((select charged from in_period order by charged desc limit 1), 0)::numeric;
$$;

revoke execute on function public.ledger_customer_stats(date, date) from public, anon, authenticated;
grant  execute on function public.ledger_customer_stats(date, date) to service_role;
