-- Supabase advisor hardening (linter run 17 Jul 2026).
--
-- 1) adjust_stock_qty: 20260717070000 revoked PUBLIC, but anon/authenticated
--    hold their own EXECUTE grants via Supabase default privileges, so the
--    function was still callable through /rest/v1/rpc with the public API key.
--    Service-role-only was always the intent (see that migration's comment).
revoke execute on function public.adjust_stock_qty(uuid, int) from anon, authenticated;

-- 2) staff_read_self re-evaluated auth.uid() per row (auth_rls_initplan lint);
--    (select auth.uid()) lets the planner evaluate it once. Same semantics.
drop policy if exists staff_read_self on public.staff_profiles;
create policy staff_read_self on public.staff_profiles
  for select to authenticated
  using (id = (select auth.uid()) or current_staff_role() = 'owner');

-- 3) Covering indexes for every FK the linter flagged as unindexed.
create index if not exists customers_created_by_idx on public.customers (created_by);
create index if not exists ledger_created_by_idx on public.ledger (created_by);
create index if not exists ledger_related_booking_id_idx on public.ledger (related_booking_id);
create index if not exists ledger_related_repair_id_idx on public.ledger (related_repair_id);
create index if not exists ledger_related_sim_id_idx on public.ledger (related_sim_id);
create index if not exists lines_current_rental_id_idx on public.lines (current_rental_id);
create index if not exists lines_master_account_id_idx on public.lines (master_account_id);
create index if not exists pools_master_account_id_idx on public.pools (master_account_id);
create index if not exists rentals_country_code_idx on public.rentals (country_code);
create index if not exists rentals_created_by_idx on public.rentals (created_by);
create index if not exists rentals_device_stock_item_id_idx on public.rentals (device_stock_item_id);
create index if not exists repair_services_repair_id_idx on public.repair_services (repair_id);
create index if not exists repair_services_service_price_id_idx on public.repair_services (service_price_id);
create index if not exists service_orders_created_by_idx on public.service_orders (created_by);
create index if not exists service_orders_customer_id_idx on public.service_orders (customer_id);
create index if not exists service_orders_service_price_id_idx on public.service_orders (service_price_id);
create index if not exists sims_master_account_id_idx on public.sims (master_account_id);
create index if not exists sold_phones_customer_id_idx on public.sold_phones (customer_id);
create index if not exists sold_phones_sold_by_idx on public.sold_phones (sold_by);
create index if not exists stock_sales_created_by_idx on public.stock_sales (created_by);
create index if not exists stock_sales_customer_id_idx on public.stock_sales (customer_id);
create index if not exists stock_sales_stock_item_id_idx on public.stock_sales (stock_item_id);
create index if not exists tasks_customer_id_idx on public.tasks (customer_id);
create index if not exists till_counts_created_by_idx on public.till_counts (created_by);
create index if not exists virtual_numbers_customer_id_idx on public.virtual_numbers (customer_id);
create index if not exists virtual_numbers_line_id_idx on public.virtual_numbers (line_id);
