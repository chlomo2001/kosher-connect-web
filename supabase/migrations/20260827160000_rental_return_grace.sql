-- How long a phone can sit past its return date before the shop chases it.
--
-- Shloime, 27 August: "the person is back, but hasnt retuned the phone/sim, so
-- the line doesnt have to be actively running, but still its not available yet
-- until physically back".
--
-- The sweep flipped a rental to overdue and raised a red "Rental overdue" task
-- the first morning after the travel dates ended — for a customer who landed
-- the night before and would drop the phone in on his way past. That is not a
-- problem, it is the ordinary end of a hire, and a task that fires on the
-- ordinary case is a task people learn to close without reading.
--
-- So there is now a quiet stage in between: home, phone not back yet. This
-- setting is where it stops being quiet. Days, counted from the return date.
-- Set it to 0 to go back to the old behaviour of chasing from day one.
--
-- The client falls back to RETURN_GRACE_DAYS in lib/rentalStage.mjs when
-- settings have not loaded — the two must stay in step, the same rule already
-- in force for FALLBACK_RATES and STAT_BANDS.

insert into settings (key, num_value, description) values
  ('rental_return_grace_days', 3.00, 'Rentals: days past the return date before a phone is chased as overdue')
on conflict (key) do nothing;
