-- Opening float for the daily cash-up (Z-report). The till starts each day
-- with some cash; the expected-cash total now adds this float and nets cash
-- refunds by sign, so a physical count can actually reconcile. The settings
-- editor is edit-only (it never creates keys), so the key must be seeded here
-- before the owner can set it in Settings. Defaults to 0 (no float).
insert into settings (key, num_value, description)
values ('till_opening_float', 0,
        'Cash the till starts each day with (opening float), added to the expected cash-up total')
on conflict (key) do nothing;
