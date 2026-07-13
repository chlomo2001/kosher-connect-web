-- Flight check-in tracking per booking. Each booking records whether online
-- check-in is done, and if not, whose job it is:
--   checkin_done   — true once check-in is completed
--   checkin_by     — 'customer' (they do it) or 'us' (we do it for them)
--   checkin_date   — when we should do it (only meaningful when checkin_by='us');
--                    a task reminder is raised for that date.
alter table bookings
  add column if not exists checkin_done boolean not null default false,
  add column if not exists checkin_by   text,
  add column if not exists checkin_date  date;
