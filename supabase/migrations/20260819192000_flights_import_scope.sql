-- The 35 customers the flights import covers, with the balance their sheet
-- states.
--
-- Two reasons this is a table and not a list in a script. The import charges
-- every booking a customer has that carries no charge, and 13 of the 35 had
-- nothing new to stage -- all their flights were already in the app -- so they
-- cannot be found from the staging rows alone. And the gap between what the
-- app now says and what the sheet said is the thing a human has to rule on,
-- so it belongs on the record rather than in a chat message.
create table if not exists public.zz_flights_scope_20260819 (
  customer_id   uuid primary key references public.customers(id),
  sheet_balance numeric not null,
  sheets        text
);
alter table public.zz_flights_scope_20260819 enable row level security;
revoke all on public.zz_flights_scope_20260819 from anon, authenticated;
