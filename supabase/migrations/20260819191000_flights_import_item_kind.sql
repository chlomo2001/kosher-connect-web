-- Not every line on the flights sheets is a flight. Tatty's tab carries IKEA
-- loan instalments and cash advances, Yoel Rotter's an old balance brought
-- forward. Those are money owed but they are not bookings, so they take a
-- ledger entry with no booking behind them -- 'item' marks them, and
-- entry_type says which kind of charge to raise.
alter table public.zz_flights_import_20260819 drop constraint zz_flights_import_20260819_kind_check;
alter table public.zz_flights_import_20260819 add constraint zz_flights_import_20260819_kind_check
  check (kind in ('line','item','payment'));
alter table public.zz_flights_import_20260819 add column if not exists entry_type text;
