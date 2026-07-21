-- Owner-editable travel requirement rules (2026-07-21).
--
-- The destination × nationality → authorisation-type matrix, moved out of code
-- so the owner can change a rule in Settings when reality changes (e.g. a new
-- ETA is introduced) without a code change. Seeded from the built-in defaults
-- (lib/travelRules.mjs BUILTIN_RULES) so behaviour is identical on day one.
-- Codes are stored (US/IL/CA/EU/UK × GB/US/IL/CA/BE/CH/HU/AT); the engine
-- normalises free-text nationality/destination to these before matching.

create table if not exists travel_requirement_rules (
  id           uuid primary key default gen_random_uuid(),
  destination  text not null,   -- US | IL | CA | EU | UK
  nationality  text not null,   -- GB | US | IL | CA | BE | CH | HU | AT
  auth_type    text not null,   -- ESTA | ETA_CA | ETA_IL | ETIAS | ETA_UK | VISA | NONE | CHECK
  note         text,
  active       boolean not null default true,
  updated_at   timestamptz not null default now()
);

create unique index if not exists travel_requirement_rules_cell
  on travel_requirement_rules (destination, nationality);

alter table travel_requirement_rules enable row level security;
create policy travel_requirement_rules_staff_all on travel_requirement_rules
  for all to authenticated
  using (current_staff_role() in ('owner', 'helper'))
  with check (current_staff_role() in ('owner', 'helper'));

insert into travel_requirement_rules (destination, nationality, auth_type, note, active) values
  ('US', 'GB', 'ESTA', '', true),
  ('US', 'US', 'NONE', '', true),
  ('US', 'IL', 'ESTA', '', true),
  ('US', 'CA', 'NONE', '', true),
  ('US', 'BE', 'ESTA', '', true),
  ('US', 'CH', 'ESTA', '', true),
  ('US', 'HU', 'ESTA', '', true),
  ('US', 'AT', 'ESTA', '', true),
  ('IL', 'GB', 'ETA_IL', '', true),
  ('IL', 'US', 'ETA_IL', '', true),
  ('IL', 'IL', 'NONE', '', true),
  ('IL', 'CA', 'ETA_IL', '', true),
  ('IL', 'BE', 'ETA_IL', '', true),
  ('IL', 'CH', 'ETA_IL', '', true),
  ('IL', 'HU', 'ETA_IL', '', true),
  ('IL', 'AT', 'ETA_IL', '', true),
  ('CA', 'GB', 'ETA_CA', '', true),
  ('CA', 'US', 'NONE', '', true),
  ('CA', 'IL', 'CHECK', 'Israeli passport holders usually need a visitor visa for Canada — an eTA only if they hold a valid US visa or held a Canadian visa in the last 10 years.', true),
  ('CA', 'CA', 'NONE', '', true),
  ('CA', 'BE', 'ETA_CA', '', true),
  ('CA', 'CH', 'ETA_CA', '', true),
  ('CA', 'HU', 'ETA_CA', '', true),
  ('CA', 'AT', 'ETA_CA', '', true),
  ('EU', 'GB', 'NONE', 'No visa for short stays; ETIAS is expected to become required for UK passports — confirm before travel.', true),
  ('EU', 'US', 'NONE', 'No visa for short stays; ETIAS is expected to become required — confirm before travel.', true),
  ('EU', 'IL', 'NONE', 'No visa for short stays; ETIAS is expected to become required — confirm before travel.', true),
  ('EU', 'CA', 'NONE', 'No visa for short stays; ETIAS is expected to become required — confirm before travel.', true),
  ('EU', 'BE', 'NONE', '', true),
  ('EU', 'CH', 'NONE', '', true),
  ('EU', 'HU', 'NONE', '', true),
  ('EU', 'AT', 'NONE', '', true),
  ('UK', 'GB', 'NONE', '', true),
  ('UK', 'US', 'ETA_UK', '', true),
  ('UK', 'IL', 'ETA_UK', '', true),
  ('UK', 'CA', 'ETA_UK', '', true),
  ('UK', 'BE', 'ETA_UK', '', true),
  ('UK', 'CH', 'ETA_UK', '', true),
  ('UK', 'HU', 'ETA_UK', '', true),
  ('UK', 'AT', 'ETA_UK', '', true)
on conflict (destination, nationality) do nothing;
