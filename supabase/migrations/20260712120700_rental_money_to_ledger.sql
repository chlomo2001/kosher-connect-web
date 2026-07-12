-- Rental money joins the append-only ledger (step 3 of the money port).
--
-- The app may delete parent rows (a rental removed from the list, a repair
-- cleared); money history is NEVER deleted with them. Instead the related_*
-- pointer detaches (ON DELETE SET NULL) and the ledger rows stay on the
-- customer. The immutability trigger learns to allow exactly that one
-- mutation — a related_* pointer becoming NULL while every money-bearing
-- column is untouched. Everything else stays append-only.

alter table ledger
  drop constraint ledger_related_rental_id_fkey,
  add constraint ledger_related_rental_id_fkey
    foreign key (related_rental_id) references rentals(id) on delete set null;

alter table ledger
  drop constraint ledger_related_sim_id_fkey,
  add constraint ledger_related_sim_id_fkey
    foreign key (related_sim_id) references sims(id) on delete set null;

alter table ledger
  drop constraint ledger_related_repair_id_fkey,
  add constraint ledger_related_repair_id_fkey
    foreign key (related_repair_id) references repairs(id) on delete set null;

alter table ledger
  drop constraint ledger_related_booking_id_fkey,
  add constraint ledger_related_booking_id_fkey
    foreign key (related_booking_id) references bookings(id) on delete set null;

-- customer_id keeps its plain FK: a customer with money history cannot be
-- deleted (the app surfaces this as a friendly refusal).

create or replace function ledger_is_immutable() returns trigger
language plpgsql
set search_path = public
as $$
begin
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
    return new; -- FK detach on parent delete: pointers may only become NULL
  end if;
  raise exception 'ledger is append-only: no UPDATE/DELETE';
end;
$$;
