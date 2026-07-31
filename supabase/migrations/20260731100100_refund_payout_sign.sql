-- 'refund_payout' joins the money-out (amount < 0) list of the ledger sign check.
-- Money going back to a customer is always negative: it consumes the credit the
-- matching 'refund' entry created. Separate migration so the enum value from
-- 20260731100000 is already committed.
alter table ledger drop constraint ledger_amount_sign;
alter table ledger add constraint ledger_amount_sign check (
  case
    when entry_type in ('top_up', 'payment', 'refund', 'rental_void')
      then amount > 0
    when entry_type in ('rental', 'rental_loss', 'sim_annual', 'sim_additional',
                        'sim_replacement', 'sim_service', 'repair',
                        'online_service', 'booking', 'phone_sale', 'stock_sale',
                        'virtual_number', 'extra_charge', 'sim_charge',
                        'refund_payout')
      then amount < 0
    else true  -- rental_adjustment, manual_adjustment: either direction
  end
);

-- The revenue aggregate has to learn the difference too. `charged` sums every
-- money-out row, which would book a refund payout as revenue earned — the exact
-- opposite of what happened. Exclude it there and give it its own column, so the
-- report can show credit issued ('refunded') apart from cash actually returned
-- ('paid_out'). Those two differ by precisely the refunds still owed.
--
-- Dropped rather than replaced: `create or replace function` cannot change a
-- function's output columns, and this adds one.
drop function if exists public.ledger_revenue_since(timestamptz);
create function public.ledger_revenue_since(p_from timestamptz)
returns table (entry_type text, charged numeric, received numeric,
               refunded numeric, paid_out numeric)
language sql
stable
set search_path = public
as $$
  select
    l.entry_type::text,
    coalesce(sum(-l.amount) filter (
      where l.amount < 0 and l.entry_type <> 'refund_payout'), 0)::numeric,
    coalesce(sum(l.amount) filter (
      where l.entry_type in ('payment', 'top_up') and l.amount > 0), 0)::numeric,
    coalesce(sum(l.amount) filter (
      where l.entry_type = 'refund' and l.amount > 0), 0)::numeric,
    coalesce(sum(-l.amount) filter (
      where l.entry_type = 'refund_payout' and l.amount < 0), 0)::numeric
  from ledger l
  where l.created_at >= p_from
  group by l.entry_type;
$$;

-- The drop took the grants with it — restore the trusted-operator-only surface.
revoke execute on function public.ledger_revenue_since(timestamptz) from public, anon, authenticated;
grant  execute on function public.ledger_revenue_since(timestamptz) to service_role;
