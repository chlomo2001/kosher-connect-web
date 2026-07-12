-- Kosher Connect — row-level security.
-- Three tiers keyed off current_staff_role():
--   1. ledger: append-only (insert + select; no update/delete policy at all)
--   2. owner-only: credentials tables + writes to pricing config
--   3. owner + helper: all remaining operational tables
-- No anon-role policy on ANY table (closes the open anon write on `store`).

-- ---------- 1. Ledger: append-only ----------

alter table ledger enable row level security;

create policy ledger_insert on ledger for insert to authenticated
  with check (current_staff_role() in ('owner', 'helper'));
create policy ledger_select on ledger for select to authenticated
  using (current_staff_role() in ('owner', 'helper'));
-- Deliberately no UPDATE/DELETE policy; the ledger_no_mutation trigger
-- backstops even table-owner sessions.

-- ---------- 2. Owner-only ----------

alter table master_account_credentials enable row level security;
create policy cred_owner_all on master_account_credentials for all to authenticated
  using (current_staff_role() = 'owner')
  with check (current_staff_role() = 'owner');

alter table sold_phone_credentials enable row level security;
create policy sold_cred_owner_all on sold_phone_credentials for all to authenticated
  using (current_staff_role() = 'owner')
  with check (current_staff_role() = 'owner');

-- Pricing config: read for staff, write owner-only.
alter table rental_rates enable row level security;
create policy rental_rates_select on rental_rates for select to authenticated
  using (current_staff_role() in ('owner', 'helper'));
create policy rental_rates_write on rental_rates for all to authenticated
  using (current_staff_role() = 'owner')
  with check (current_staff_role() = 'owner');

alter table damage_rates enable row level security;
create policy damage_rates_select on damage_rates for select to authenticated
  using (current_staff_role() in ('owner', 'helper'));
create policy damage_rates_write on damage_rates for all to authenticated
  using (current_staff_role() = 'owner')
  with check (current_staff_role() = 'owner');

alter table settings enable row level security;
create policy settings_select on settings for select to authenticated
  using (current_staff_role() in ('owner', 'helper'));
create policy settings_write on settings for all to authenticated
  using (current_staff_role() = 'owner')
  with check (current_staff_role() = 'owner');

-- Holidays: read for staff, write owner-only (calendar edits are pricing edits).
alter table holidays enable row level security;
create policy holidays_select on holidays for select to authenticated
  using (current_staff_role() in ('owner', 'helper'));
create policy holidays_write on holidays for all to authenticated
  using (current_staff_role() = 'owner')
  with check (current_staff_role() = 'owner');

-- staff_profiles: each user reads their own row; owner manages all.
alter table staff_profiles enable row level security;
create policy staff_read_self on staff_profiles for select to authenticated
  using (id = auth.uid() or current_staff_role() = 'owner');
create policy staff_owner_write on staff_profiles for all to authenticated
  using (current_staff_role() = 'owner')
  with check (current_staff_role() = 'owner');

-- ---------- 3. Owner + helper (read/write) ----------

do $$
declare t text;
begin
  foreach t in array array[
    'customers', 'master_accounts', 'pools', 'lines', 'stock_items',
    'service_prices', 'rentals', 'rental_items', 'sims', 'tasks',
    'virtual_numbers', 'repairs', 'repair_services', 'bookings',
    'sold_phones', 'reseller_links'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I on %I for all to authenticated
         using (current_staff_role() in (''owner'', ''helper''))
         with check (current_staff_role() in (''owner'', ''helper''))',
      t || '_staff_all', t);
  end loop;
end $$;

-- Column-level protection for owner-only fields on shared tables
-- (customers.stripe_pm_id, bookings.passport_expiry): RLS is row-level, so
-- enforce via helper views that exclude those columns; the app's helper role
-- must query these views, not the base tables.

create view customers_helper
  with (security_invoker = on) as
  select id, first_name, last_name, phone_country_code, phone_number,
         has_whatsapp, email_raw, email_normalized, address, city,
         drive_folder_url, notes, created_at, created_by, updated_at
  from customers;

create view bookings_helper
  with (security_invoker = on) as
  select id, customer_id, passenger, route, airline, booking_reference,
         travel_date, departure_time, arrival_time, price, booking_fee,
         status, passport_on_file, notes, created_at
  from bookings;
