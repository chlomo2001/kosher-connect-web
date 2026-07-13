-- End-of-day cash-up (repair-shop POS pattern): one row per day recording
-- what the till SHOULD hold (cash payments in the ledger) vs what was
-- counted. Variance is derived, never typed.

create table if not exists till_counts (
  id         uuid primary key default gen_random_uuid(),
  count_date date not null unique,
  expected   numeric(10,2) not null,
  counted    numeric(10,2) not null,
  variance   numeric(10,2) generated always as (counted - expected) stored,
  notes      text,
  created_by uuid references staff_profiles(id),
  created_at timestamptz not null default now()
);

alter table till_counts enable row level security;
create policy till_counts_staff_all on till_counts
  for all to authenticated
  using (current_staff_role() in ('owner', 'helper'))
  with check (current_staff_role() in ('owner', 'helper'));
