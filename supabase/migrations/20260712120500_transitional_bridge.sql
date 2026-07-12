-- Transitional bridge for the strangler-fig data-layer port (step 2).
--
-- legacy_extras holds the COMPLETE app-shaped object so the untouched
-- front end round-trips exactly; the typed columns are the relational
-- projection (FKs, enums, rental_items) that the new code queries.
-- Drop these columns at the end of cutover, when main.js reads the
-- typed columns directly.

alter table customers add column legacy_extras jsonb;
alter table lines     add column legacy_extras jsonb;
alter table rentals   add column legacy_extras jsonb;
alter table sims      add column legacy_extras jsonb;

-- The app's SIM status select includes 'suspended'.
alter type sim_status add value if not exists 'suspended';

-- The app's phone-country select includes 'EU', priced on the USA branch
-- (£3/day, £20 min, £45 cap). rentals.country_code FKs rental_rates, so the
-- row must exist.
insert into rental_rates (country_code, display_name, rate_per_day, min_charge, cap, cap_period_days)
values ('EU', 'EU', 3.00, 20.00, 45.00, 30)
on conflict do nothing;

insert into damage_rates (country_code, phone_damage_loss, charger_missing, sim_missing)
values ('EU', 100.00, 10.00, 10.00)
on conflict do nothing;
