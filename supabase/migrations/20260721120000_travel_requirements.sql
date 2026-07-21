-- Travel requirements (prototype, owner-approved 2026-07-21).
--
-- Two additions:
--   1. bookings.destination_country — the trip's destination, so the
--      requirements engine (lib/travelRules.mjs) knows what's needed. Free
--      text; the app stores a short code (US/IL/CA/EU/UK) but any value is
--      accepted so it never blocks a save.
--   2. travel_authorisations — a per-traveller record of an ESTA / eTA /
--      ETA-IL / visa with its "valid until" date. An authorisation lives with
--      the passport for ~2 years and is reused across trips, so it is keyed to
--      the CUSTOMER (account) and traveller name, NOT to a single booking —
--      cancelling or deleting a booking must never lose it. No passport NUMBER
--      is stored here (that stays owner-only on booking_passengers); only the
--      authorisation reference, which staff already handle.

alter table bookings
  add column if not exists destination_country text;

create table if not exists travel_authorisations (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid not null references customers(id) on delete cascade,
  traveller_name text not null,
  type           text not null,            -- ESTA | ETA_CA | ETA_IL | ETIAS | ETA_UK | VISA
  country        text,                     -- destination code the auth is for (US/IL/CA/EU/UK)
  reference      text,                     -- application / approval number
  valid_from     date,
  valid_until    date,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists travel_authorisations_customer_idx
  on travel_authorisations (customer_id);

-- One live record per (customer, traveller, authorisation type): re-recording
-- an ESTA updates the same row rather than piling duplicates. Name is folded
-- to lower case so "Yankel Green" and "yankel green" don't split.
create unique index if not exists travel_authorisations_unique
  on travel_authorisations (customer_id, lower(traveller_name), type);

alter table travel_authorisations enable row level security;
create policy travel_authorisations_staff_all on travel_authorisations
  for all to authenticated
  using (current_staff_role() in ('owner', 'helper'))
  with check (current_staff_role() in ('owner', 'helper'));
