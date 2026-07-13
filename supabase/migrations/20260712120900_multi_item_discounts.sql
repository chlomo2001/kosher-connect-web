-- Multi-item discounts from the customer price list (30 Jun 2026):
--   "Third phone and more: 15% Off"  → auto-applies to a customer's 3rd+
--                                       concurrent rental (manual discount wins)
--   "3 or more plans: 10% Off"       → prefills monthly/annual SIM charges

insert into settings (key, num_value, description) values
  ('multi_phone_discount_pct', 15, '3rd rental phone and more — % off'),
  ('multi_sim_discount_pct',   10, '3 or more SIM plans — % off recurring charges')
on conflict (key) do nothing;
