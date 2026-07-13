-- Sync live pricing to the customer-facing price list (30 Jun 2026),
-- confirmed authoritative by the owner on 12 Jul 2026.
--
-- Rental rates: "Monthly" on the list = the cap. UK-Intl drops to £2/day,
-- UK minimums rise, USA/Canada caps rise to £50.
-- Virtual-number add-on becomes per-country (£5/£10 USA+Canada,
-- £7/£15 Israel+UK); the global settings keys stay as fallback.

alter table rental_rates
  add column if not exists vn_weekly      numeric(10,2),
  add column if not exists vn_per_30_days numeric(10,2);

update rental_rates set rate_per_day = 3, min_charge = 20, cap = 50, vn_weekly = 5, vn_per_30_days = 10, updated_at = now() where country_code = 'USA';
update rental_rates set rate_per_day = 2, min_charge = 20, cap = 35, vn_weekly = 7, vn_per_30_days = 15, updated_at = now() where country_code = 'UK-UKmins';
update rental_rates set rate_per_day = 2, min_charge = 25, cap = 40, vn_weekly = 7, vn_per_30_days = 15, updated_at = now() where country_code = 'UK-Intl';
update rental_rates set                                              vn_weekly = 7, vn_per_30_days = 15, updated_at = now() where country_code = 'Israel';
update rental_rates set                              cap = 50,       vn_weekly = 5, vn_per_30_days = 10, updated_at = now() where country_code = 'Canada';
update rental_rates set                                              vn_weekly = 5, vn_per_30_days = 10, updated_at = now() where country_code = 'EU';

-- The price list names the model "FIG Touch Pro" (a separate FIG Touch Mini
-- exists); rename the existing menu rows to match.
update service_prices set name = 'FIG Touch Pro Screen/Hinges', updated_at = now() where service_id = '5';
update service_prices set name = 'FIG Touch Pro Charger Port',  updated_at = now() where service_id = '6';
update service_prices set name = 'FIG Touch Pro Camera/Torch',  updated_at = now() where service_id = '7';

-- New menu rows from the price list: FIG Touch Mini repair + 8 more phones.
insert into service_prices (service_id, name, category, price) values
  ('34', 'FIG Touch Mini Screen/Hinges', 'repair', 90),
  ('35', 'Show F2',    'phone', 125),
  ('36', 'Digit',      'phone', 105),
  ('37', 'Nokia 105',  'phone', 55),
  ('38', 'Nokia 110',  'phone', 60),
  ('39', 'TCL 4042',   'phone', 55),
  ('40', 'TCL 5041',   'phone', 35),
  ('41', 'Mini 3 SIM', 'phone', 30),
  ('42', 'Mini 2 SIM', 'phone', 25)
on conflict (service_id) do nothing;
