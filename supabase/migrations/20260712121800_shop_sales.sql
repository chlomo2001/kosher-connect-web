-- The SHOP: selling actual devices & accessories (separate business line
-- from the rental fleet). stock_items existed unused since the initial
-- schema; this seeds the 13 phones from the customer price list, adds a
-- low-stock threshold, and creates the sale records. Money posts to the
-- ledger as phone_sale / stock_sale (SALE-<uuid>), decrementing stock.

alter table stock_items
  add column if not exists low_stock_at int not null default 1;

insert into stock_items (item_code, category, model, selling_price, quantity) values
  ('PH-01', 'phone', 'FIG Pro',    280, 0),
  ('PH-02', 'phone', 'FIG Core',   189, 0),
  ('PH-03', 'phone', 'NAVI C1',    169, 0),
  ('PH-04', 'phone', 'Croscall',   115, 0),
  ('PH-05', 'phone', 'QLYX Q7',    135, 0),
  ('PH-06', 'phone', 'Show F2',    125, 0),
  ('PH-07', 'phone', 'Digit',      105, 0),
  ('PH-08', 'phone', 'Nokia 105',   55, 0),
  ('PH-09', 'phone', 'Nokia 110',   60, 0),
  ('PH-10', 'phone', 'TCL 4042',    55, 0),
  ('PH-11', 'phone', 'TCL 5041',    35, 0),
  ('PH-12', 'phone', 'Mini 3 SIM',  30, 0),
  ('PH-13', 'phone', 'Mini 2 SIM',  25, 0)
on conflict do nothing;

-- One source of truth for sale prices: the shop. The service-menu phone
-- rows (added before the shop existed) retire.
update service_prices set active = false, updated_at = now() where category = 'phone';

create table if not exists stock_sales (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references customers(id),
  stock_item_id uuid not null references stock_items(id),
  qty           int not null check (qty >= 1),
  unit_price    numeric(10,2) not null,
  total         numeric(10,2) not null,
  imei          text,
  notes         text,
  created_at    timestamptz not null default now(),
  created_by    uuid references staff_profiles(id)
);

alter table stock_sales enable row level security;
create policy stock_sales_staff_all on stock_sales
  for all to authenticated
  using (current_staff_role() in ('owner', 'helper'))
  with check (current_staff_role() in ('owner', 'helper'));
