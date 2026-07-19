-- Phase 2 Track B — phone-migration job logging (owner decision, 19 Jul).
--
-- One new line on the Online & Print price menu so a contact migration
-- (Nokia → Fig, spreadsheet → VCF, etc.) is charged like any other service and
-- lands on the customer's timeline and wallet — the offline converter apps
-- themselves are untouched. Prices are starting points: the owner edits them
-- in Settings → Service Price Menu like any other line.
insert into service_prices (service_id, name, category, price, repeat_price, active)
select '43', 'Contact Transfer / Phone Setup', 'online', 15.00, 10.00, true
where not exists (
  select 1 from service_prices
  where service_id = '43' or lower(name) = 'contact transfer / phone setup'
);
