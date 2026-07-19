-- Phase 2 Track B — phone-migration job logging (owner decision, 19 Jul).
--
-- One new line on the Online & Print price menu so a contact migration
-- (Nokia → Fig, spreadsheet → VCF, etc.) is charged like any other service and
-- lands on the customer's timeline and wallet — the offline converter apps
-- themselves are untouched. Prices are starting points: the owner edits them
-- in Settings → Service Price Menu like any other line.
-- service_id is a numeric-string sequence shared across categories, so the
-- next free number is computed, never hardcoded (a fixed '43' collided with
-- the USA-SIM seed and silently skipped the insert — review finding).
insert into service_prices (service_id, name, category, price, repeat_price, active)
select
  (coalesce(max(nullif(regexp_replace(service_id, '\D', '', 'g'), '')::int), 0) + 1)::text,
  'Contact Transfer / Phone Setup', 'online', 15.00, 10.00, true
from service_prices
where not exists (
  select 1 from service_prices where lower(name) = 'contact transfer / phone setup'
);
