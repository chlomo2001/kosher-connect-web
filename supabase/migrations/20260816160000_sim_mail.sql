-- Carrier email, landed on the SIM it is about.
--
-- Lebara (and the rest) mail one address per SIM account — `gitt.bilig+moshe@
-- gmail.com`, `shevabruches111+14@gmail.com` — and Gmail funnels every one of
-- them into a single mailbox. That mailbox now auto-forwards to a Forward Email
-- alias whose recipient is /api/inbound/mail, so mail reaches the app as it
-- arrives instead of being swept for after the fact.
--
-- One row per message. `sim_id` is the pairing result, and it is nullable ON
-- PURPOSE: a message we cannot pair with certainty is kept with its confidence
-- and its extracted numbers so a human can settle it. Nothing is guessed and
-- nothing is dropped — the July sweep found 241 numbers live at a carrier that
-- the app had never heard of, and this table is where the next one shows up the
-- day it happens rather than a month later.
create table sim_mail (
  id            bigserial primary key,
  received_at   timestamptz not null default now(),
  -- RFC Message-Id. Unique so a Forward Email retry (or a second forwarding
  -- hop) cannot file the same message twice.
  message_id    text not null unique,
  -- The address we PAIRED on: the original per-SIM recipient, never the
  -- kosher-connect.com forwarding hop.
  recipient     text,
  from_address  text,
  carrier       text,
  subject       text,
  -- First few hundred characters of the body, whitespace collapsed. Enough to
  -- read the renewal/cancellation line; not a copy of the mailbox.
  snippet       text,
  -- 'address' | 'address+number' | 'number' | 'ambiguous' | 'unknown'
  confidence    text not null,
  -- UK mobiles found in the subject/body, as last-10 digits. For 'unknown'
  -- rows this is the lead: a live number nobody has written down.
  numbers       text[] not null default '{}',
  sim_id        uuid references sims(id) on delete set null,
  customer_id   uuid references customers(id) on delete set null,
  -- Set when a human resolves an ambiguous/unknown row, so the pairing queue
  -- empties instead of growing forever.
  resolved_at   timestamptz
);

-- The two reads that exist: "what came in lately" and "what still needs a
-- human", the second being the one Shloime works through.
create index sim_mail_received_idx on sim_mail (received_at desc);
create index sim_mail_pending_idx on sim_mail (received_at desc)
  where resolved_at is null and sim_id is null;
create index sim_mail_sim_idx on sim_mail (sim_id, received_at desc);

-- Same posture as the other operational tables: the service role writes from
-- the API routes, and nothing reaches it through the anon/publishable key.
alter table sim_mail enable row level security;
