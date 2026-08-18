-- Check-in for the flight home.
--
-- A round trip has been one booking with two dates since this morning, but
-- every check-in field was singular — one date, one done flag — so the app
-- prompted the check-in for the flight OUT and never for the flight back. The
-- half of the trip nobody is reminded about is the half where a customer is
-- abroad, which is the worse half to get wrong.
--
-- `checkin_by` is deliberately NOT duplicated. Who does the check-in is a fact
-- about the arrangement with that customer, not about a direction of travel: if
-- the shop does it, it does both.
alter table bookings add column if not exists return_checkin_date date;
alter table bookings add column if not exists return_checkin_done boolean not null default false;

comment on column bookings.return_checkin_date is
  'When to do the check-in for the RETURN leg — typically the day before '
  'return_date. NULL when there is no return, or when the customer checks '
  'themselves in. `checkin_by` covers both legs.';
