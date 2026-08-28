-- Due back the day after the hire ends; late fees only after a week.
--
-- Owner, 28 August: "change rental returns rule - due date is always a day
-- after arrival - end of rental, (and come up as task, amber bla bla) but late
-- fees only once past 7 days."
--
-- One number carries both halves. `rental_return_grace_days` was seeded at 3 on
-- 27 August, when it meant only "how long before we chase". It now also decides
-- when the meter starts, so it moves to 7:
--
--   the day after end_date   due back. Amber on the row, a RETURNDUE task from
--                            the sweep, nothing charged.
--   after 7 days             overdue. Red, and the late fee starts counting
--                            FROM THERE — the first week is never billed.
--
-- Only the value and the description change; the key is the same one the app
-- already reads, so nothing needs re-pointing. Set it to 0 to charge from the
-- day the phone is due, which is what the app did before 27 August.

update settings
   set num_value = 7,
       description = 'Rentals: days past the return date before a hire is chased as overdue and late fees begin'
 where key = 'rental_return_grace_days';

insert into settings (key, num_value, description)
select 'rental_return_grace_days', 7,
       'Rentals: days past the return date before a hire is chased as overdue and late fees begin'
where not exists (select 1 from settings where key = 'rental_return_grace_days');
