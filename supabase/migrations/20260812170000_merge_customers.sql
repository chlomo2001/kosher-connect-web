-- Merge one customer record into another, atomically.
--
-- Until now the app could only delete an EMPTY ELID import (merge-elid.js);
-- two real records — each with SIMs, bookings, money — had to be merged by
-- hand in SQL. That is the shape of nearly every duplicate left in the book,
-- so it becomes a first-class, reviewable operation.
--
-- The ledger is append-only by trigger. A merge does not change any amount;
-- it re-parents rows to a different customer. That single exception is
-- allowed only while merge_customers() is running, gated on a transaction
-- local flag, so nothing else can move money between customers.

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

create or replace function public.merge_customers(p_dup uuid, p_survivor uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  moved jsonb := '{}'::jsonb;
  n integer;
begin
  if p_dup is null or p_survivor is null then
    raise exception 'both records are required';
  end if;
  if p_dup = p_survivor then
    raise exception 'cannot merge a record into itself';
  end if;
  if not exists (select 1 from customers where id = p_dup) then
    raise exception 'the duplicate record no longer exists';
  end if;
  if not exists (select 1 from customers where id = p_survivor) then
    raise exception 'the record to keep no longer exists';
  end if;

  perform set_config('app.merging_customers', '1', true);   -- true = this transaction only

  update sims set customer_id = p_survivor where customer_id = p_dup;
  get diagnostics n = row_count; moved := moved || jsonb_build_object('sims', n);
  update rentals set customer_id = p_survivor where customer_id = p_dup;
  get diagnostics n = row_count; moved := moved || jsonb_build_object('rentals', n);
  update bookings set customer_id = p_survivor where customer_id = p_dup;
  get diagnostics n = row_count; moved := moved || jsonb_build_object('bookings', n);
  update repairs set customer_id = p_survivor where customer_id = p_dup;
  get diagnostics n = row_count; moved := moved || jsonb_build_object('repairs', n);
  update virtual_numbers set customer_id = p_survivor where customer_id = p_dup;
  get diagnostics n = row_count; moved := moved || jsonb_build_object('virtual_numbers', n);
  update ledger set customer_id = p_survivor where customer_id = p_dup;
  get diagnostics n = row_count; moved := moved || jsonb_build_object('ledger', n);

  update tasks set customer_id = p_survivor where customer_id = p_dup;
  update sold_phones set customer_id = p_survivor where customer_id = p_dup;
  update service_orders set customer_id = p_survivor where customer_id = p_dup;
  update stock_sales set customer_id = p_survivor where customer_id = p_dup;
  update kt_shuls set customer_id = p_survivor where customer_id = p_dup;
  update kt_jobs set customer_id = p_survivor where customer_id = p_dup;
  update customer_documents set customer_id = p_survivor where customer_id = p_dup;
  update email_log set customer_id = p_survivor where customer_id = p_dup;
  update travel_authorisations set customer_id = p_survivor where customer_id = p_dup;

  delete from customers where id = p_dup;
  perform set_config('app.merging_customers', '0', true);
  return jsonb_build_object('ok', true, 'moved', moved);
end;
$function$;

comment on function public.merge_customers(uuid, uuid) is
  'Re-parents every record of p_dup onto p_survivor and deletes p_dup. Amounts are never altered; the append-only ledger guard permits only the owner change, only here.';

revoke all on function public.merge_customers(uuid, uuid) from public, anon, authenticated;
