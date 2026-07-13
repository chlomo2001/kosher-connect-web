-- Quantity tiers from the customer price list (30 Jun 2026):
--   tickets: Single / each passenger up to 5 / 6 passengers and above
--   online:  First application / Two or more
-- repeat_price = price per unit from the 2nd unit (up to the 5th for
-- tickets); bulk_price = per unit from the 6th (tickets only).
-- NULL repeat_price = flat service (e.g. the start fee), always charged once.

alter table service_prices
  add column if not exists repeat_price numeric(10,2),
  add column if not exists bulk_price   numeric(10,2);

update service_prices set repeat_price = v.rep, bulk_price = v.bulk, updated_at = now()
from (values
  -- tickets: single / each up to 5 / 6+
  ('25', 10.00, 5.00),   -- Ready Planned Journey       20 / 10 / 5
  ('26', 10.00, 5.00),   -- Plan Standard Journey       25 / 10 / 5
  ('27', 15.00, 10.00),  -- Plan Self-Transfer Journey  30 / 15 / 10
  ('28',  5.00, 5.00)    -- Check-in                    10 /  5 / 5
) as v(sid, rep, bulk)
where service_prices.service_id = v.sid;
-- '24' Single Ticket Start Fee stays NULL/NULL — flat £10, charged once.

update service_prices set repeat_price = v.rep, updated_at = now()
from (values
  -- online: first application / two or more
  ('16', 20.00),  -- Passport Application   25 / 20
  ('19', 35.00),  -- Settled Status         45 / 35
  ('20', 45.00),  -- ESTA (USA)             50 / 45
  ('21', 12.00),  -- ETA (Israel)           15 / 12
  ('22', 25.00),  -- ETA (UK)               30 / 25
  ('23',  0.08)   -- Printing per page      0.10 / 0.08
) as v(sid, rep)
where service_prices.service_id = v.sid;
