-- Purchase orders — the missing middle of the buy side.
--
-- The shop already records suppliers, and goods-in when a delivery lands. The
-- order itself was never written down, so three questions had no answer: what
-- is on its way, when was it promised, and did what arrived match what was
-- ordered.
--
-- A purchase order is NOT a financial event. Ordering costs nothing and posts
-- nothing. Only RECEIVING moves anything, and what it moves is stock — what
-- the shop owes a wholesaler is a supplier balance, which goods-in already
-- handles. That line is what stops a draft order quietly inflating the stock
-- on hand, so it is enforced here as well as in the app: the status column
-- only allows the four states, and lib/purchaseOrders.mjs allows no transition
-- out of `received`, because re-receiving would add the quantities twice.

create table if not exists purchase_orders (
  id           uuid primary key default gen_random_uuid(),
  supplier_id  uuid not null references suppliers(id),
  reference    text,
  status       text not null default 'draft' check (status in ('draft', 'ordered', 'received', 'cancelled')),
  ordered_at   date,
  expected_at  date,
  received_at  timestamptz,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists purchase_order_lines (
  id             uuid primary key default gen_random_uuid(),
  po_id          uuid not null references purchase_orders(id) on delete cascade,
  -- Null for a free-text line ("box of assorted cables"): a note to a human
  -- that the app must not try to count onto a shelf.
  stock_item_id  uuid references stock_items(id),
  description    text,
  qty            integer not null check (qty > 0),
  unit_cost      numeric(10, 2),
  created_at     timestamptz not null default now()
);

create index if not exists purchase_orders_supplier_idx on purchase_orders (supplier_id);
create index if not exists purchase_orders_status_idx   on purchase_orders (status);
create index if not exists purchase_order_lines_po_idx  on purchase_order_lines (po_id);

alter table purchase_orders      enable row level security;
alter table purchase_order_lines enable row level security;

-- Same posture as every other operator table: the service role reaches it
-- through the API, nothing else does.
drop policy if exists purchase_orders_all on purchase_orders;
create policy purchase_orders_all on purchase_orders for all to authenticated
  using (false) with check (false);
drop policy if exists purchase_order_lines_all on purchase_order_lines;
create policy purchase_order_lines_all on purchase_order_lines for all to authenticated
  using (false) with check (false);

-- Receiving, as ONE statement. The quantities have to land on the shelf and
-- the order has to close together or not at all — a half-applied receive is a
-- stock count nobody can trust afterwards. Guarded on the current status, so
-- two people pressing Receive at once cannot add the delivery twice.
create or replace function receive_purchase_order(p_po_id uuid)
returns table (received integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  moved integer := 0;
begin
  update purchase_orders
     set status = 'received', received_at = now(), updated_at = now()
   where id = p_po_id and status = 'ordered';

  if not found then
    raise exception 'That order is not awaiting delivery.' using errcode = 'check_violation';
  end if;

  with add as (
    select stock_item_id, sum(qty)::int as qty
    from purchase_order_lines
    where po_id = p_po_id and stock_item_id is not null
    group by stock_item_id
  )
  update stock_items s
     set quantity = s.quantity + add.qty, updated_at = now()
    from add
   where s.id = add.stock_item_id;

  get diagnostics moved = row_count;
  return query select moved;
end;
$$;

revoke execute on function public.receive_purchase_order(uuid) from public, anon, authenticated;
grant  execute on function public.receive_purchase_order(uuid) to service_role;
