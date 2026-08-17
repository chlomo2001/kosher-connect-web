-- merge_customers() was missing one table: sim_mail.
--
-- Every other table that carries a customer_id is re-parented by the function.
-- sim_mail was added in August, after the function was written, and its
-- foreign key is ON DELETE SET NULL — so a merge did not fail on it, which is
-- worse: the duplicate's carrier mail quietly lost its customer and the
-- messages stopped belonging to anyone. The Carrier Mail queue would then show
-- them as unpaired work that had in fact already been settled.
--
-- Found on 17 Aug while merging Shmuel Bleier's two records. That pair had no
-- carrier mail on the losing side, so nothing was lost — but 470 of the shop's
-- customers have a SIM the shop runs, and the next merge would not have been
-- so lucky.
--
-- Everything else about the function is unchanged: one transaction, the same
-- guard flag around the append-only ledger, amounts never touched.

create or replace function merge_customers(p_dup uuid, p_survivor uuid)
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

  perform set_config('app.merging_customers', '1', true);

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
  -- The one that was missing. Reported like the rest, because carrier mail
  -- moving between records is exactly the kind of thing worth seeing.
  update sim_mail set customer_id = p_survivor where customer_id = p_dup;
  get diagnostics n = row_count; moved := moved || jsonb_build_object('carrier_mail', n);

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

revoke execute on function public.merge_customers(uuid, uuid) from public, anon, authenticated;
grant  execute on function public.merge_customers(uuid, uuid) to service_role;
