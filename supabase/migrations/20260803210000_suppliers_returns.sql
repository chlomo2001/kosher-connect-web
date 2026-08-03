-- Suppliers & returns (RMA) — v1 of the buy side (owner ask 2026-08-03).
--
-- The shop tracked only what it sells. What it buys — and especially what it
-- sends BACK (the bag of defective phones worth a few hundred pounds waiting
-- for the wholesaler) — lived in nobody's head but Shloime's. These two
-- tables make the bag visible until the supplier settles it.
--
-- Deliberately NOT ledger money: claimed_value is what we believe the
-- supplier owes us for the return — a claim, not cash. It becomes ledger
-- money only when the credit actually arrives, and v1 leaves even that
-- recording to the human (goods-in is v2).

create table suppliers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  contact    text,          -- phone / email / rep name, free text
  notes      text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table supplier_returns (
  id            uuid primary key default gen_random_uuid(),
  supplier_id   uuid not null references suppliers(id),
  -- What's physically in the bag. Free text on purpose: returns are often
  -- "9 assorted Nokias, screens dead" — forcing SKU links would stop staff
  -- recording them at all. IMEIs ride separately so they stay searchable.
  items         text not null,
  imeis         text,
  claimed_value numeric(10,2) check (claimed_value is null or claimed_value >= 0),
  --   awaiting_send — boxed up, still in the shop (the invisible bag)
  --   sent          — with the courier / at the supplier, awaiting outcome
  --   credited / replaced / written_off — terminal outcomes
  status        text not null default 'awaiting_send'
                check (status in ('awaiting_send', 'sent', 'credited', 'replaced', 'written_off')),
  sent_at       date,
  resolved_at   date,
  notes         text,
  created_by    uuid references staff_profiles(id),
  created_at    timestamptz not null default now(),
  -- A terminal status must carry its resolution date and an open one must
  -- not — stops a half-updated row reading as settled (same shape as
  -- bank_txn_match_complete).
  constraint supplier_return_resolution check (
    (status in ('credited', 'replaced', 'written_off')) = (resolved_at is not null)
  ),
  -- Anything past awaiting_send has left the shop, so it must say when.
  constraint supplier_return_sent_dated check (
    status = 'awaiting_send' or sent_at is not null
  )
);

-- The dashboard asks "what's open?" — status first, newest first.
create index supplier_returns_open_idx on supplier_returns (status, created_at desc);

-- Tier 3 (owner + helper): operational tables, same as stock_items.
alter table suppliers enable row level security;
create policy suppliers_staff_all on suppliers for all to authenticated
  using (current_staff_role() in ('owner', 'helper'))
  with check (current_staff_role() in ('owner', 'helper'));

alter table supplier_returns enable row level security;
create policy supplier_returns_staff_all on supplier_returns for all to authenticated
  using (current_staff_role() in ('owner', 'helper'))
  with check (current_staff_role() in ('owner', 'helper'));
