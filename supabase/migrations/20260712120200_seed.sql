-- Kosher Connect — config + service-menu seed. Operational data is NOT
-- imported here; the system starts empty and data migrates at cutover.

-- ---------- rental_rates (BUSINESS_RULES.md §1.1) ----------

insert into rental_rates (country_code, display_name, rate_per_day, min_charge, cap, cap_period_days) values
  ('USA',       'USA',            3.00, 20.00, 45.00, 30),
  ('UK-UKmins', 'UK (UK mins)',   2.00, 15.00, 40.00, 30),
  ('UK-Intl',   'UK (Intl mins)', 2.50, 20.00, 45.00, 30),
  ('Israel',    'Israel',         3.00, 20.00, 50.00, 30),
  ('Canada',    'Canada',         3.00, 25.00, 45.00, 30);

-- ---------- damage_rates (BUSINESS_RULES.md §1.6, incl. lost SIM £10) ----------

insert into damage_rates (country_code, phone_damage_loss, charger_missing, sim_missing) values
  ('UK-UKmins',  45.00,  5.00, 10.00),
  ('UK-Intl',    45.00,  5.00, 10.00),
  ('USA',       100.00, 10.00, 10.00),
  ('Israel',    120.00, 10.00, 10.00),
  ('Canada',    100.00, 10.00, 10.00);

-- ---------- settings ----------

insert into settings (key, num_value, description) values
  ('late_fee_per_day',           1.00, 'Late return: £ per chargeable day past due (Shabbos/YT excluded)'),
  ('vn_weekly',                  5.00, 'Virtual number: £ per week (minimum 1 week)'),
  ('vn_per_30_days',            10.00, 'Virtual number: flat £ for a 30-day rental'),
  ('sim_annual_fee',            20.00, 'SIM annual fee (owner-confirmed 2026-07-12)'),
  ('sim_additional_fee',        10.00, 'Additional SIM fee'),
  ('sim_service_fee',            5.00, 'SIM service fee'),
  ('sim_replacement_fee',       10.00, 'SIM replacement fee (after free allowance)'),
  ('free_replacements_default',  2.00, 'Free SIM replacements per customer'),
  ('online_min_charge',          5.00, 'Online services: minimum charge'),
  ('online_hourly_rate',        45.00, 'Online services: £ per hour'),
  ('collect_later_late_pct',    10.00, 'Collect-later surcharge: percent'),
  ('collect_later_late_min',     2.00, 'Collect-later surcharge: minimum £');

insert into settings (key, text_value, description) values
  ('replacement_reset_mode_default', 'lifetime', 'SIM replacement allowance reset mode'),
  ('send_customer_emails',           '0',        '1 = send balance-reminder emails; default OFF (placeholder addresses bounce)');

-- ---------- service_prices (33 rows — live shop price list) ----------

insert into service_prices (service_id, name, category, price) values
  ('1',  'QIN F21 Screen',                    'repair',  50.00),
  ('2',  'QIN F21 Charger Port',              'repair',  35.00),
  ('3',  'QIN F21 New Battery',               'repair',  35.00),
  ('4',  'QIN F21 Screen+Battery',            'repair',  70.00),
  ('5',  'FIG Touch Screen/Hinges',           'repair',  75.00),
  ('6',  'FIG Touch Charger Port',            'repair',  35.00),
  ('7',  'FIG Touch Camera/Torch',            'repair',  25.00),
  ('8',  'Sonim XP3900 Screen/Hinges',        'repair',  90.00),
  ('9',  'Sonim XP3900 Charger Port',         'repair',  35.00),
  ('10', 'Sonim XP3900 New Battery',          'repair',  25.00),
  ('11', 'Nokia C2/301 Screen',               'repair',  25.00),
  ('12', 'Nokia C2/301 New Housing',          'repair',  20.00),
  ('13', 'Nokia C2/301 Speaker',              'repair',  20.00),
  ('14', 'Nokia C2/301 Screen+Housing',       'repair',  35.00),
  ('15', 'Regular online service (per hour)', 'online',  45.00),
  ('16', 'Passport Application',              'online',  25.00),
  ('17', 'Bank Opening',                      'online',  30.00),
  ('18', 'Tablet Use in Office',              'online',  15.00),
  ('19', 'Settled Status Application',        'online',  45.00),
  ('20', 'ESTA (USA)',                        'online',  50.00),
  ('21', 'ETA (Israel)',                      'online',  15.00),
  ('22', 'ETA (UK)',                          'online',  30.00),
  ('23', 'Printing (per page)',               'online',   0.10),
  ('24', 'Single Ticket Start Fee',           'tickets', 10.00),
  ('25', 'Ready Planned Journey',             'tickets', 20.00),
  ('26', 'Plan Standard Journey',             'tickets', 25.00),
  ('27', 'Plan Self-Transfer Journey',        'tickets', 30.00),
  ('28', 'Check-in',                          'tickets', 10.00),
  ('29', 'FIG Pro',                           'phone',  280.00),
  ('30', 'FIG Core',                          'phone',  189.00),
  ('31', 'NAVI C1',                           'phone',  169.00),
  ('32', 'Croscall',                          'phone',  115.00),
  ('33', 'QLYX Q7',                           'phone',  135.00);
