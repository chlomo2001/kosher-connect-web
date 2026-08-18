-- Rehearsal fixture for the restore-test harness itself (port item A3).
--
-- This is NOT KC's schema. It is a deliberately small stand-in that carries
-- one of everything compare.sh measures — a money-shaped table with rows to
-- digest, an FK, a check constraint, an index, a sequence with a position, a
-- view, a function + trigger, RLS with a policy, grants to anon/authenticated,
-- an enum — so the harness can be exercised end-to-end on a laptop with no
-- production data anywhere near it. The tables echo the ones that hold KC's
-- money (ledger, till sales, Kol Torah settlements, rental deposits) so a
-- drift planted here rehearses the drift that would matter there.
--
-- Usage (two scratch databases):
--   createdb live_sim   && psql live_sim   -X -f seed.sql
--   pg_dump live_sim | psql restored_sim         -- the "restore"
--   ./compare.sh <live_sim URL> <restored_sim URL>

create extension if not exists pgcrypto;

do $$ begin
  create role anon nologin;
exception when duplicate_object then null; end $$;
do $$ begin
  create role authenticated nologin;
exception when duplicate_object then null; end $$;

create type pay_method as enum ('cash', 'card', 'bank_transfer');

create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text
);

create table ledger (
  id bigint generated always as identity primary key,
  customer_id uuid references customers(id),
  amount_pennies bigint not null,
  method pay_method not null default 'cash',
  note text,
  constraint ledger_amount_nonzero check (amount_pennies <> 0)
);
create index ledger_customer_idx on ledger (customer_id);

create table stock_sales (
  id bigint generated always as identity primary key,
  sku text not null,
  qty int not null check (qty > 0),
  total_pennies bigint not null
);

create table kt_settlements (
  id bigint generated always as identity primary key,
  shul text not null,
  owed_pennies bigint not null
);

create table rentals (
  id bigint generated always as identity primary key,
  customer_id uuid references customers(id),
  deposit_pennies bigint not null default 0
);

create view money_today as
  select method, sum(amount_pennies) as pennies from ledger group by method;

create function ledger_no_delete() returns trigger language plpgsql as $$
begin
  raise exception 'ledger rows are never deleted';
end $$;
create trigger ledger_guard before delete on ledger
  for each row execute function ledger_no_delete();

alter table customers enable row level security;
alter table ledger enable row level security;
alter table stock_sales enable row level security;
alter table kt_settlements enable row level security;
alter table rentals enable row level security;

-- The portal boundary in miniature: authenticated sees only its own customer.
create policy customers_own on customers for select to authenticated
  using (id = nullif(current_setting('request.jwt.claim.customer_id', true), '')::uuid);
grant select on customers to authenticated;
grant select on money_today to authenticated;
-- anon gets NOTHING (that absence is itself an aspect compare.sh must carry
-- across, and refusals.sql probes it directly).

insert into customers (name, phone) values
  ('Mayer Kraus',           '07807 263476'),
  ('Mordche Grunfeld',      '07741 819046'),
  ('Mendl Hersh Grinfeld',  '07825 137082');

insert into ledger (customer_id, amount_pennies, method, note)
  select id, 2500, 'cash', 'rental week' from customers where name = 'Mayer Kraus';
insert into ledger (customer_id, amount_pennies, method, note)
  select id, -1200, 'card', 'refund'     from customers where name = 'Mordche Grunfeld';

insert into stock_sales (sku, qty, total_pennies) values
  ('CHARGER-USBC', 2, 1998), ('CASE-A15', 1, 799);

insert into kt_settlements (shul, owed_pennies) values ('Beis Medrash A', 15400);

insert into rentals (customer_id, deposit_pennies)
  select id, 10000 from customers where name = 'Mendl Hersh Grinfeld';
