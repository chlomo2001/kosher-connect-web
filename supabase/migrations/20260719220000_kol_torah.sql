-- Phase 2 Track B — the Kol Torah module (owner scoping, 19 Jul: all four).
--
-- Kol Torah Manchester sells audio CDs on consignment in shuls around town and
-- does CD → MP3 / SD conversion work. Four pieces, one schema:
--   • kt_titles       — the catalogue (what exists, at what price)
--   • kt_shuls        — the venues, optionally linked to a customer record so
--                       settlements ride the normal wallet/ledger machinery
--   • kt_stock        — how many of each title each shul holds right now
--   • kt_movements    — the audit trail behind every stock change
--   • kt_settlements  — money collected from a shul (feeds the ledger when the
--                       shul is linked: stock_sale charge + payment received)
--   • kt_jobs         — conversion jobs, tracked like repairs (open → ready →
--                       collected); collecting a priced job charges the ledger
-- All tables are service-role only (RLS deny-all), same as the rest.

create table if not exists kt_titles (
  id         uuid primary key default gen_random_uuid(),
  code       text unique,                    -- short catalogue code, optional
  name       text not null,
  speaker    text,                           -- whose shiur / nigunim it is
  price      numeric not null default 0 check (price >= 0),
  active     boolean not null default true,
  notes      text,
  created_at timestamptz not null default now()
);

create table if not exists kt_shuls (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  contact     text,                          -- gabbai / phone
  customer_id uuid references customers(id) on delete set null,  -- wallet link
  active      boolean not null default true,
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists kt_shuls_customer_idx on kt_shuls (customer_id);

create table if not exists kt_stock (
  shul_id  uuid not null references kt_shuls(id) on delete cascade,
  title_id uuid not null references kt_titles(id) on delete cascade,
  qty      integer not null default 0 check (qty >= 0),
  primary key (shul_id, title_id)
);
create index if not exists kt_stock_title_idx on kt_stock (title_id);

create table if not exists kt_movements (
  id         uuid primary key default gen_random_uuid(),
  shul_id    uuid not null references kt_shuls(id) on delete cascade,
  title_id   uuid references kt_titles(id) on delete set null,
  delta      integer not null,               -- +delivered / −returned / −sold
  kind       text not null check (kind in ('delivery', 'return', 'sold', 'adjust')),
  note       text,
  client_ref text unique,                    -- idempotency: one movement per submit
  created_at timestamptz not null default now()
);
create index if not exists kt_movements_shul_idx  on kt_movements (shul_id, created_at desc);
create index if not exists kt_movements_title_idx on kt_movements (title_id);

create table if not exists kt_settlements (
  id         uuid primary key default gen_random_uuid(),
  shul_id    uuid not null references kt_shuls(id) on delete cascade,
  sold_value numeric not null default 0 check (sold_value >= 0),  -- £ of CDs sold
  received   numeric not null default 0 check (received >= 0),    -- £ collected
  method     text,
  note       text,
  client_ref text unique,                    -- idempotency: one settlement per submit
  created_at timestamptz not null default now()
);
create index if not exists kt_settlements_shul_idx on kt_settlements (shul_id, created_at desc);

create table if not exists kt_jobs (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid references customers(id) on delete set null,
  customer_name text,                        -- walk-in fallback
  kind          text not null check (kind in ('cd_to_mp3', 'cd_to_sd', 'cd_copy', 'audio_other')),
  details       text,
  qty           integer not null default 1 check (qty > 0),
  price         numeric not null default 0 check (price >= 0),   -- job total
  status        text not null default 'open' check (status in ('open', 'ready', 'collected', 'cancelled')),
  client_ref    text unique,                 -- idempotency: one job per submit
  created_at    timestamptz not null default now(),
  ready_at      timestamptz,
  collected_at  timestamptz
);
create index if not exists kt_jobs_customer_idx on kt_jobs (customer_id);
create index if not exists kt_jobs_open_idx on kt_jobs (status) where status in ('open', 'ready');

alter table kt_titles      enable row level security;
alter table kt_shuls       enable row level security;
alter table kt_stock       enable row level security;
alter table kt_movements   enable row level security;
alter table kt_settlements enable row level security;
alter table kt_jobs        enable row level security;
-- No policies on purpose: only the service-role API routes touch these tables.

-- Guarded consignment counter — the same race-closer pattern as
-- adjust_stock_qty: the qty can never go negative, two concurrent movements
-- resolve in the database, and a blocked move returns NULL instead of lying.
create or replace function kt_adjust_stock(p_shul uuid, p_title uuid, p_delta integer)
returns integer
language plpgsql
set search_path = public
as $$
declare new_qty integer;
begin
  if p_delta >= 0 then
    insert into kt_stock (shul_id, title_id, qty) values (p_shul, p_title, p_delta)
    on conflict (shul_id, title_id) do update set qty = kt_stock.qty + excluded.qty
    returning qty into new_qty;
  else
    update kt_stock set qty = qty + p_delta
    where shul_id = p_shul and title_id = p_title and qty + p_delta >= 0
    returning qty into new_qty;
  end if;
  return new_qty;  -- null = the guard blocked it (would have gone negative)
end $$;

-- Same default-privilege lock-down as adjust_stock_qty (cycle-1 finding):
-- EXECUTE for the trusted operator surface only.
revoke execute on function public.kt_adjust_stock(uuid, uuid, integer) from public, anon, authenticated;
grant  execute on function public.kt_adjust_stock(uuid, uuid, integer) to service_role;
