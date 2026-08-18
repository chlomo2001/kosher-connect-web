-- A journey is made of flights, and the shop books them separately.
--
-- Owner, 18 Aug: "sometimes we do 2 airlines for there and 2 additional for
-- back.. all for one person's one time 2-way journey." A booking has held ONE
-- airline, ONE reference and ONE route since the initial schema, so a
-- self-transfer journey had nowhere to go and went in as prose:
--
--     route "MAN_JFK"      airline "Aer lingus, Virgin"
--     route "LGW-TLV-LTN"  ← out of Gatwick, back into Luton, as one string
--
-- Neither can be flown, checked in for, or reconciled against a carrier. The
-- shop's own price list has charged £30 for "Plan Self-Transfer Journey" all
-- along, so this is core business, not an edge case.
--
-- A LEG BELONGS TO THE BOOKING, NOT TO A TRIP. Two payers on the same itinerary
-- each get their own copy, which is redundant on purpose: a booking stays a
-- complete record of what that person bought, every existing read keeps working
-- untouched, and cancelling one payer's half cannot quietly rewrite the other's.
--
-- The booking's own route/airline/travel_date STAY as they are and stay
-- authoritative for the sweeps and the register — they describe the journey as
-- a whole (first origin, last destination, the day it starts). Legs add detail
-- beneath that; they do not replace it. A booking with no legs is a one-leg
-- booking and always was.
create table booking_legs (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null references bookings(id) on delete cascade,
  -- 1, 2, 3… in the order flown, outbound then return. The order matters more
  -- than any date, because a leg's date can be missing while its place in the
  -- journey never is.
  position      int not null,
  -- 'out' | 'return'. Which half of the journey this leg belongs to, so a
  -- four-leg round trip can say which two get you there and which two bring you
  -- home — without inferring it from dates that may not all be known.
  direction     text not null default 'out',
  airline       text,
  -- Each leg can carry its OWN reference: two airlines means two PNRs, and
  -- putting them in one field is what this table exists to stop.
  booking_reference text,
  origin        text,            -- IATA where known, free text otherwise
  destination   text,
  flight_date   date,
  departure_time time,
  arrival_time   time,
  -- What this leg cost, when the shop knows it. Often only the total is known,
  -- and that stays on the booking — this is nullable for exactly that reason.
  -- The booking's price remains what the customer is charged; leg prices are
  -- detail, never a second source of truth for money.
  price         numeric(10,2),
  notes         text,
  created_at    timestamptz not null default now(),

  constraint booking_legs_direction check (direction in ('out', 'return')),
  constraint booking_legs_position_positive check (position >= 1),
  -- One row per position per booking: re-saving an itinerary replaces it
  -- rather than growing it.
  unique (booking_id, position)
);

create index booking_legs_booking_idx on booking_legs (booking_id, position);

comment on table booking_legs is
  'The flights that make up one booking''s journey, in the order flown. A '
  'booking with no legs is a simple one-flight booking. The booking''s own '
  'route/airline/travel_date describe the journey as a whole and remain what '
  'the sweeps and the register read.';

alter table booking_legs enable row level security;
