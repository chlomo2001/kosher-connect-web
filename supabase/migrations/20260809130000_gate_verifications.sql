-- Council item 2 — the Charge Gate's audit trail.
--
-- The gate (lib/chargeGate.mjs) asks the questions that must be answered before
-- a rental can be closed and charged. Two of them are judgement calls rather
-- than facts — "the phone really is back early", "the customer is leaving with
-- a balance" — and those are allowed, but not anonymously. This table is where
-- the name goes.
--
-- One row per (rental, check) sign-off. Append-only in spirit: a re-signature
-- of the same check overwrites the previous one, because the question is "who
-- is standing behind this close", not "how many times was it clicked".
--
-- Deliberately NOT a general approvals table. Every row here is about handing a
-- phone back. If another surface ever needs a gate it gets its own table, so
-- neither one grows a `type` column and starts meaning two things at once.

create table if not exists gate_verifications (
  rental_id   uuid not null references rentals(id) on delete cascade,
  check_id    text not null,          -- 'balance' | 'dates' — see chargeGate.mjs
  verified_by text,                   -- the staff name as shown in the app
  note        text,
  verified_at timestamptz not null default now(),
  primary key (rental_id, check_id)
);

-- The read is always "what has been signed off for this rental", which the
-- primary key already serves. The second index is for the audit direction —
-- "what did this person sign off, and when" — which is the question asked after
-- something has gone wrong.
create index if not exists gate_verifications_by_person
  on gate_verifications (verified_by, verified_at desc);

alter table gate_verifications enable row level security;

-- Same posture as the rest of the operational tables: reachable only through
-- the service role the API uses, never from a browser key.
