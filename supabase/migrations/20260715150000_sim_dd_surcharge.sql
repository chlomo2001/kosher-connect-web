-- #30 — the SIM monthly direct-debit surcharge shared the rental "Pay later"
-- surcharge keys, so editing one silently repriced the other. Give the SIM DD
-- its own keys, seeded to today's shared values so behaviour is unchanged
-- until the owner deliberately sets a different SIM surcharge.
insert into settings (key, num_value, description) values
  ('sim_dd_surcharge_pct', coalesce((select num_value from settings where key='collect_later_late_pct'), 10),
   'Extra % added to a through-me SIM monthly direct-debit amount (separate from the rental "Pay later" surcharge)'),
  ('sim_dd_surcharge_min', coalesce((select num_value from settings where key='collect_later_late_min'), 2),
   'Smallest SIM monthly surcharge, even on cheap plans')
on conflict (key) do nothing;
