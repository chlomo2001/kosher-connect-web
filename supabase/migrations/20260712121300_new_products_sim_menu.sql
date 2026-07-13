-- New products from the customer price list — part 2: SIM-only monthly
-- products + TomTom, chargeable from the SIM charge modal ('sim' category
-- added in part 1). TomTom's after-sale service is £10 (repeat_price).

insert into service_prices (service_id, name, category, price, repeat_price) values
  ('43', 'USA SIM Only — monthly',              'sim', 35, null),
  ('44', 'UK SIM Only Local — monthly',         'sim', 15, null),
  ('45', 'UK SIM Only International — monthly', 'sim', 25, null),
  ('46', 'TomTom Update (PAYG)',                'sim', 25, 10)
on conflict (service_id) do nothing;
