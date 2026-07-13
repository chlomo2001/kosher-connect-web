-- Per-passenger details for flight bookings (owner-approved 2026-07-13):
-- each passenger on a booking gets their own row with name, DOB and
-- passport number + expiry. Passport fields are OWNER-ONLY on API reads
-- (same rule as bookings.passport_expiry): helpers may enter them at the
-- counter but never see them back. Rows die with their booking.

create table if not exists booking_passengers (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid not null references bookings(id) on delete cascade,
  position        int not null default 1,
  full_name       text not null,
  dob             date,
  passport_number text,
  passport_expiry date,
  created_at      timestamptz not null default now()
);

create index if not exists booking_passengers_booking_idx
  on booking_passengers (booking_id);

alter table booking_passengers enable row level security;
create policy booking_passengers_staff_all on booking_passengers
  for all to authenticated
  using (current_staff_role() in ('owner', 'helper'))
  with check (current_staff_role() in ('owner', 'helper'));
