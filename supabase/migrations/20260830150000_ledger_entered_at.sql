-- A payment can be recorded for the day the money actually came in.
--
-- Owner, 30 Aug 2026: "when recording a payment it should be an option to set
-- as paid at a previous date." Money reaches a counter before it reaches the
-- app — cash on Friday entered on Sunday, a transfer noticed three days later —
-- and until now every entry was stamped with the moment somebody typed it. The
-- day's takings, the trend line and the revenue report all read created_at, so
-- Friday's cash was landing in Sunday's figures.
--
-- WHICH COLUMN MOVES, AND WHY THIS WAY ROUND. created_at becomes the day the
-- MONEY moved, because every report in the app already treats it as the money
-- date — ledger_day_flow, ledger_revenue_since, ledger_daily_series,
-- ledger_flow_between and ledger_customer_stats all group by it. Making that
-- column true means all five answer correctly with no change to any of them,
-- and no chance of one being missed.
--
-- The audit is not lost, it is gained: entered_at is new and records when the
-- row was actually written. Before this, "when was this typed" and "when was
-- the money taken" were one column pretending to be both; now they are two, and
-- the backfill below is exact — for every existing row they are the same thing.
alter table ledger add column if not exists entered_at timestamptz;
update ledger set entered_at = created_at where entered_at is null;
alter table ledger alter column entered_at set default now();
alter table ledger alter column entered_at set not null;

-- The append-only trigger pinned every field that matters except this one,
-- because it did not exist. A backdated entry whose entered_at could be edited
-- afterwards would be a backdated entry with no witness.
create or replace function public.ledger_is_immutable()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  -- Customer merge: same row, same money, new owner. Only merge_customers()
  -- sets this flag, and only for its own transaction.
  if tg_op = 'UPDATE'
     and coalesce(current_setting('app.merging_customers', true), '') = '1'
     and new.id = old.id
     and new.amount = old.amount
     and new.charge_reference = old.charge_reference
     and new.entry_type = old.entry_type
     and new.created_at = old.created_at
     and new.entered_at = old.entered_at
  then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.id = old.id
     and new.customer_id = old.customer_id
     and new.charge_reference = old.charge_reference
     and new.entry_type = old.entry_type
     and new.amount = old.amount
     and new.method is not distinct from old.method
     and new.description is not distinct from old.description
     and new.created_at = old.created_at
     and new.entered_at = old.entered_at
     and new.created_by is not distinct from old.created_by
     and (new.related_rental_id  is null or new.related_rental_id  = old.related_rental_id)
     and (new.related_sim_id     is null or new.related_sim_id     = old.related_sim_id)
     and (new.related_repair_id  is null or new.related_repair_id  = old.related_repair_id)
     and (new.related_booking_id is null or new.related_booking_id = old.related_booking_id)
  then
    return new;
  end if;
  raise exception 'ledger is append-only: no UPDATE/DELETE';
end;
$function$;
