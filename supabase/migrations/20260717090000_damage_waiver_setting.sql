-- Damage waiver: optional per-rental line, priced as a % of the (discounted)
-- rental. The app reads damage_waiver_pct (default 5 in code if the row is
-- missing); the owner edits it from Settings like any other fee.
insert into settings (key, num_value, description)
values ('damage_waiver_pct', 5, 'Damage waiver — % of the rental price, covers accidental damage (not loss)')
on conflict (key) do nothing;
