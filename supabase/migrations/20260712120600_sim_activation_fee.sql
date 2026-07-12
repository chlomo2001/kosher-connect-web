-- SIM activation / initial-setup fee as a settings key (BUSINESS_RULES §2).
-- Previously hardcoded £20 in the SIM charge modal; distinct from
-- sim_annual_fee even though both happen to be £20 today.

insert into settings (key, num_value, description)
values ('sim_activation_fee', 20.00, 'SIM initial setup / activation charge')
on conflict (key) do nothing;
