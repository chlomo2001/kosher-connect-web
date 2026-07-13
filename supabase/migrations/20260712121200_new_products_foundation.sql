-- New products from the customer price list (30 Jun 2026) — part 1.
--
-- 1. USA phone WITHOUT SIM: its own rental-rates row (£2/day, min £15,
--    monthly £30). Priced automatically when the SIM toggle is off on a
--    USA rental (app + mapper map to this code).
-- 2. 'sim' service category (part 2 seeds the rows — a new enum value
--    cannot be used in the transaction that creates it).
-- 3. Standalone virtual-number bundle price matrix (reference table shown
--    on the Virtual Numbers tab; billing flow to come).

insert into rental_rates (country_code, display_name, rate_per_day, min_charge, cap, cap_period_days, vn_weekly, vn_per_30_days)
values ('USA-NoSIM', 'USA (no SIM)', 2, 15, 30, 30, 5, 10)
on conflict (country_code) do nothing;

alter type service_category add value if not exists 'sim';

create table if not exists vn_bundle_prices (
  id              uuid primary key default gen_random_uuid(),
  label           text unique not null,
  incoming_only   numeric(10,2),          -- per month, incoming calls only
  outgoing_100    numeric(10,2),          -- add-on: 100 outgoing minutes
  unlimited_price numeric(10,2),          -- per month, unlimited
  payg_base       numeric(10,2),          -- per month base + call rates
  sort            int not null default 0
);

alter table vn_bundle_prices enable row level security;
create policy vn_bundle_prices_staff_read on vn_bundle_prices
  for select to authenticated
  using (current_staff_role() in ('owner', 'helper'));
-- no write policies: the matrix changes via migrations only

insert into vn_bundle_prices (label, incoming_only, outgoing_100, unlimited_price, payg_base, sort) values
  ('Israeli Number',               10, 3, 22, 2,  1),
  ('USA Number',                   10, 1, 18, 2,  2),
  ('Belgium Number',               10, 2, 20, 2,  3),
  ('UK Landline',                  10, 2, 20, 2,  4),
  ('Israeli + USA',                12, 3, 25, 4,  5),
  ('Israeli + Belgium',            12, 3, 27, 4,  6),
  ('Israeli + UK',                 12, 3, 27, 4,  7),
  ('Israeli + USA + Belgium',      14, 3, 30, 6,  8),
  ('Israeli + UK + USA + Belgium', 16, 3, 35, 8,  9),
  ('Israeli + Belgium + UK',       16, 3, 30, null, 10),
  ('USA + UK',                     12, 2, 24, null, 11),
  ('USA + Belgium',                12, 2, 24, null, 12),
  ('USA + Belgium + UK',           14, 2, 28, null, 13),
  ('UK + Belgium',                 12, 2, 25, null, 14)
on conflict (label) do nothing;
