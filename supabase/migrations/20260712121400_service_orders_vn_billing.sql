-- Online-services charging + standalone-VN recurring billing (part 1).
--
-- 1. service_orders: one row per charged online service (passport
--    application, ESTA, printing…). The wallet charge posts at creation
--    (SVC-<uuid>), an optional immediate payment posts alongside
--    (PAY-SVC-<uuid>). Repeat-application pricing: first unit at price,
--    units 2+ at repeat_price.
-- 2. virtual_numbers gains billing columns; the daily sweep posts one
--    idempotent monthly charge per billing period (VN-<id>-<YYYY-MM>).
-- 3. ledger_entry_type gains 'virtual_number' (sign rule added in part 2 —
--    a new enum value cannot be used in the transaction that creates it).

alter type ledger_entry_type add value if not exists 'virtual_number';

create table if not exists service_orders (
  id               uuid primary key default gen_random_uuid(),
  customer_id      uuid not null references customers(id),
  service_price_id uuid not null references service_prices(id),
  qty              int not null default 1 check (qty >= 1),
  unit_price       numeric(10,2) not null,
  total            numeric(10,2) not null,
  notes            text,
  created_at       timestamptz not null default now(),
  created_by       uuid references staff_profiles(id)
);

alter table service_orders enable row level security;
create policy service_orders_staff_all on service_orders
  for all to authenticated
  using (current_staff_role() in ('owner', 'helper'))
  with check (current_staff_role() in ('owner', 'helper'));

alter table virtual_numbers
  add column if not exists bundle_label      text,
  add column if not exists plan              text
    check (plan in ('incoming_only', 'outgoing_100', 'unlimited', 'payg')),
  add column if not exists monthly_price     numeric(10,2),
  add column if not exists billing_enabled   boolean not null default false,
  add column if not exists next_billing_date date;
