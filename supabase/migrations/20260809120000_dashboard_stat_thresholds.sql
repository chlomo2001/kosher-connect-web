-- Council item 5 — the dashboard's colour thresholds become owner-editable.
--
-- Every stat card decided its colour on `> 0`. That is not a threshold, it is
-- "any at all": Outstanding went red the moment a single pound was owed, which
-- in a shop where some arrears are always in flight means the card is red every
-- day of the year. A card that is always red is a card nobody reads, and the
-- day it means something it gets ignored along with the rest.
--
-- Where "normal" stops is a question about this shop's trading, not about
-- software, so it belongs in Settings beside the fees. Each metric gets an
-- amber and a red step; the defaults below are a starting point for the owner
-- to move, not a claim about the business.
--
-- Values here are the same the client falls back to when settings have not
-- loaded yet (STAT_BANDS in public/main.js) — the two must stay in step, the
-- same rule already in force for FALLBACK_RATES.
--
-- Set a step to 0 to make that colour permanent, or to a number nothing will
-- reach to switch it off. Nothing here changes what is charged.

insert into settings (key, num_value, description) values
  ('dash_arrears_amber',    250.00, 'Dashboard: Outstanding turns amber at this £ owed'),
  ('dash_arrears_red',     1000.00, 'Dashboard: Outstanding turns red at this £ owed'),
  ('dash_overdue_amber',      1.00, 'Dashboard: overdue rentals turn amber at this many'),
  ('dash_overdue_red',        3.00, 'Dashboard: overdue rentals turn red at this many'),
  ('dash_tasks_amber',        1.00, 'Dashboard: high-priority tasks turn amber at this many'),
  ('dash_tasks_red',          5.00, 'Dashboard: high-priority tasks turn red at this many'),
  ('dash_phones_amber',       3.00, 'Rentals: available phones turn amber at or below this many'),
  ('dash_phones_red',         1.00, 'Rentals: available phones turn red at or below this many'),
  ('dash_returning_amber',    1.00, 'Rentals: returning today turns amber at this many'),
  ('dash_returning_red',      6.00, 'Rentals: returning today turns red at this many')
on conflict (key) do nothing;
