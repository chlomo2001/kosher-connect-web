-- Staging for the flights-spreadsheet import.
--
-- The workbook the shop has kept since 2025 holds 50 customer tabs: flights on
-- top, a payments block underneath, a Balance at the foot. The app already had
-- the flights as bookings -- 356 of 395 with no charge against them, which is
-- why customers who owe thousands were showing £0.
--
-- The rows land here first rather than going straight into the ledger. The
-- ledger is append-only with no undo, so the import has to be inspectable
-- before it is applied and traceable after: every row keeps the sheet name and
-- the row number it came from, and the ledger entries it produces carry
-- matching charge_reference values.
--
-- RLS on and no grants, per 20260819021500_lock_down_zz_snapshots.sql -- this
-- carries passenger names.
create table if not exists public.zz_flights_import_20260819 (
  id            bigserial primary key,
  kind          text not null check (kind in ('line','payment')),
  sheet         text not null,
  sheet_row     int  not null,
  customer_id   uuid not null references public.customers(id),
  -- flight line
  passenger     text,
  route         text,
  airline       text,
  booking_reference text,
  travel_date   date,
  price         numeric,
  booking_fee   numeric,
  -- payment line
  amount        numeric,
  method        text,
  paid_on       date,
  label         text,
  unique (kind, sheet, sheet_row)
);

alter table public.zz_flights_import_20260819 enable row level security;
revoke all on public.zz_flights_import_20260819 from anon, authenticated;
revoke all on sequence public.zz_flights_import_20260819_id_seq from anon, authenticated;
