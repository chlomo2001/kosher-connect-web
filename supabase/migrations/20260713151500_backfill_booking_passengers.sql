-- Backfill: older bookings stored passengers as one free-text field
-- ("Moshe, Bas-Sheva, Binyomin"). Split on commas / & / + / " and " and
-- give each name its own booking_passengers row, so every booking uses
-- the structured list. Skips bookings that already have passenger rows
-- (idempotent, safe to run on production after cutover). DOB/passport
-- stay empty — fill them in from the 👥 editor as customers come in.

insert into booking_passengers (booking_id, position, full_name)
select b.id, t.ord, trim(t.name)
from bookings b
cross join lateral unnest(
  regexp_split_to_array(b.passenger, '\s*(?:,|&|\+|\sand\s)\s*')
) with ordinality as t(name, ord)
where coalesce(trim(b.passenger), '') <> ''
  and trim(t.name) <> ''
  and not exists (select 1 from booking_passengers p where p.booking_id = b.id);
