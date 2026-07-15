-- Editable discount / tier threshold settings added during development. Seeded
-- idempotently so a fresh DB has the same knobs the Settings UI exposes:
--   multi_phone_discount_from — the Nth concurrent phone the discount starts on
--   multi_sim_discount_from   — the Nth active SIM plan the discount starts on
--   online_repeat_from        — the Nth application the repeat price kicks in on
insert into settings (key, num_value, description) values
  ('multi_phone_discount_from', 3, 'Multi-phone discount starts at the Nth concurrent phone'),
  ('multi_sim_discount_from',   3, 'Multi-SIM discount starts at the Nth active plan'),
  ('online_repeat_from',        4, 'Online services: repeat price applies from the Nth application')
on conflict (key) do nothing;
