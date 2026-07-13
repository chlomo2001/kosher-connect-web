-- Repair "Purchased at Kosher Connect" price tier (customer price list,
-- 30 Jun 2026). kc_price NULL = no KC tier for that job (charged regular).

alter table service_prices add column if not exists kc_price numeric(10,2);
alter table repairs add column if not exists kc_purchase boolean not null default false;

update service_prices set kc_price = v.kc, updated_at = now()
from (values
  ('1',  45.00),  -- QIN F21 Screen                 50 → 45
  ('2',  30.00),  -- QIN F21 Charger Port           35 → 30
  ('3',  30.00),  -- QIN F21 New Battery            35 → 30
  ('4',  60.00),  -- QIN F21 Screen+Battery         70 → 60
  ('5',  60.00),  -- FIG Touch Pro Screen/Hinges    75 → 60
  ('6',  30.00),  -- FIG Touch Pro Charger Port     35 → 30
  ('7',  20.00),  -- FIG Touch Pro Camera/Torch     25 → 20
  ('8',  80.00),  -- Sonim XP3900 Screen/Hinges     90 → 80
  ('9',  30.00),  -- Sonim XP3900 Charger Port      35 → 30
  ('10', 20.00),  -- Sonim XP3900 New Battery       25 → 20
  ('11', 20.00),  -- Nokia C2/301 Screen            25 → 20
  ('12', 15.00),  -- Nokia C2/301 New Housing       20 → 15
  ('13', 15.00),  -- Nokia C2/301 Speaker           20 → 15
  ('14', 30.00)   -- Nokia C2/301 Screen+Housing    35 → 30
) as v(sid, kc)
where service_prices.service_id = v.sid;
-- '34' FIG Touch Mini stays NULL — the list marks its KC column N/A.
