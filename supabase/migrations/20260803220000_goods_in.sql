-- Goods-in v2 + lightweight accounts payable (owner ask 08-03, approved same
-- day: "they don't have a book yet" — so this IS the primary record, kept
-- deliberately light: invoice total + paid flag + per-supplier balance, no
-- aging reports, no bank reconciliation).
--
-- A delivery (goods_in) is a supplier drop with an optional invoice on it.
-- Its lines either link a stock_items row — arrival increments quantity and
-- refreshes the cost (net_price) via adjust_stock_qty — or stay free text
-- (consumables, job lots) with no stock effect.
--
-- Balance per supplier is computed in the API, not stored:
--   we owe = unpaid invoice totals − credited returns (credit notes owed to us).

create table goods_in (
  id            uuid primary key default gen_random_uuid(),
  supplier_id   uuid not null references suppliers(id),
  delivery_date date not null,
  invoice_ref   text,
  invoice_total numeric(10,2) check (invoice_total is null or invoice_total >= 0),
  paid          boolean not null default false,
  paid_at       date,
  notes         text,
  created_by    uuid references staff_profiles(id),
  created_at    timestamptz not null default now(),
  -- A paid invoice is dated; an unpaid one isn't (mirrors supplier_returns).
  constraint goods_in_paid_dated check (paid = (paid_at is not null))
);

create table goods_in_lines (
  id          uuid primary key default gen_random_uuid(),
  goods_in_id uuid not null references goods_in(id) on delete cascade,
  item_id     uuid references stock_items(id),
  description text not null,
  qty         int not null check (qty > 0),
  unit_cost   numeric(10,2) check (unit_cost is null or unit_cost >= 0)
);

create index goods_in_supplier_idx on goods_in (supplier_id, delivery_date desc);
create index goods_in_lines_parent_idx on goods_in_lines (goods_in_id);

alter table goods_in enable row level security;
create policy goods_in_staff_all on goods_in for all to authenticated
  using (current_staff_role() in ('owner', 'helper'))
  with check (current_staff_role() in ('owner', 'helper'));

alter table goods_in_lines enable row level security;
create policy goods_in_lines_staff_all on goods_in_lines for all to authenticated
  using (current_staff_role() in ('owner', 'helper'))
  with check (current_staff_role() in ('owner', 'helper'));
