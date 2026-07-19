-- Fixes from the Phase-2 Day-1 adversarial review.
--
-- 1) Consignment movements get an idempotency token: "Deliver 10" retried
--    after a lost response must short-circuit, not land twice. (The base
--    kol_torah migration now includes this column for fresh databases; this
--    alter brings already-migrated databases in line.)
alter table kt_movements add column if not exists client_ref text unique;

-- 2) The Contact Transfer / Phone Setup seed originally hardcoded
--    service_id '43', which the USA-SIM seed already took — the not-exists
--    guard was always false and the line never appeared on the menu. Insert
--    it with the next free number instead (idempotent by name, so this is a
--    no-op wherever the corrected 20260719210000 already ran).
insert into service_prices (service_id, name, category, price, repeat_price, active)
select
  (coalesce(max(nullif(regexp_replace(service_id, '\D', '', 'g'), '')::int), 0) + 1)::text,
  'Contact Transfer / Phone Setup', 'online', 15.00, 10.00, true
from service_prices
where not exists (
  select 1 from service_prices where lower(name) = 'contact transfer / phone setup'
);
