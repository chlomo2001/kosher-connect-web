-- Airline confirmations, landed as bookings waiting to be confirmed.
--
-- The shop books flights in a personal Gmail (`ch7023518@gmail.com`) and then
-- re-types the result into the app. That gap is where the money leaks: the
-- 31 July dig found Wizz Air tickets that were flown and never billed, and the
-- reconcile after it could only be settled from screenshots of that mailbox.
--
-- So the confirmation email comes to the app instead. One row per message,
-- parsed into the fields a booking needs, with a task raised against it —
-- "Confirm ticket: Shmuel Bleier — LTN → TLV, 12 Sept, £428.60" — and a review
-- card that turns it into a real booking (and therefore a wallet charge) in one
-- click.
--
-- WHAT THIS TABLE IS NOT: it is not bookings. Nothing here is money and nothing
-- here is a commitment; it is what an email appeared to say, kept next to what
-- a person decided about it. `booking_id` is the join between the two, set only
-- when someone at the counter confirmed it. A parser that wrote straight to
-- bookings would turn one bad regex into a customer billed for a stranger's
-- flight, which is why the confirm step exists and why it cannot be skipped.

create table ticket_mail (
  id                bigserial primary key,
  received_at       timestamptz not null default now(),
  -- RFC Message-Id. Unique, so a Forward Email retry or a second forwarding
  -- hop cannot file the same ticket twice — same guarantee as sim_mail.
  message_id        text not null unique,
  from_address      text,
  subject           text,
  -- Every recipient the message arrived with, hops included: which mailbox's
  -- filter actually sent it. Same reasoning as sim_mail.route.
  route_addresses   text[],

  -- ── what the mail appeared to say ──────────────────────────────────────
  airline           text,
  -- confirmation | cancellation | change. A cancellation must never quietly
  -- become a booking, and telling them apart at the door is how.
  kind              text not null default 'confirmation',
  booking_reference text,
  passengers        text[] not null default '{}',
  origin            text,           -- IATA, e.g. LTN
  destination       text,           -- IATA, e.g. TLV
  travel_date       date,
  -- Bookings hold one travel date; a return leg is a second booking. Kept here
  -- because the mail said it, and shown in the review card's notes so whoever
  -- confirms knows there is another leg to raise.
  return_date       date,
  departure_time    time,
  arrival_time      time,
  price             numeric(10,2),
  -- The airline's currency, NOT converted. A ticket priced in EUR is a
  -- conversation about the rate, not a number to guess.
  currency          text,
  -- full | partial | thin — how much of the mail parsed. Drives how loudly the
  -- review card asks for help.
  confidence        text not null default 'thin',
  -- The fields a person still has to type, by name.
  missing           text[] not null default '{}',

  -- ── who we think it is for ─────────────────────────────────────────────
  customer_id         uuid references customers(id) on delete set null,
  -- sure | likely | many | none. Only a clear winner sets customer_id at all;
  -- two customers with the same name preselect NOBODY (the shop has three
  -- pairs of these).
  customer_confidence text,
  -- The runners-up, so settling it is a click rather than a search.
  candidates          jsonb not null default '[]',

  -- The message text, for re-reading when the parser missed something. Bounded
  -- at ingest; not a copy of the mailbox.
  body              text,

  -- ── what a person decided ──────────────────────────────────────────────
  booking_id        uuid references bookings(id) on delete set null,
  resolved_at       timestamptz,
  -- Set when someone dismissed it rather than booking it, in their words.
  dismissed_reason  text
);

-- The two reads that exist: "what is waiting" (the queue on the Bookings tab)
-- and "what came in lately".
create index ticket_mail_received_idx on ticket_mail (received_at desc);
create index ticket_mail_pending_idx on ticket_mail (received_at desc)
  where resolved_at is null;
create index ticket_mail_customer_idx on ticket_mail (customer_id, received_at desc);

-- Same posture as sim_mail and the rest of the operational tables: the service
-- role writes from the API routes, and nothing reaches it through the anon key.
alter table ticket_mail enable row level security;
