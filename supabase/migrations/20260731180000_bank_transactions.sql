-- Open-banking spike: the landing table for a read-only bank feed.
--
-- The point of this table is what it is NOT. It is not the ledger and it must
-- never become a second one. A bank feed knows that money moved; it does not
-- know whose it is or what for, and the ledger requires both — every entry
-- needs a customer_id, an entry_type and a sign. Posting straight from a feed
-- would guess at both, into an append-only table where a wrong guess can only
-- be corrected forward, never removed.
--
-- So transactions land here raw, a matcher PROPOSES a link, and a human
-- confirms. Nothing in this migration can write to `ledger`.
--
-- Unlike the ledger this table is mutable: match_state is worked through as a
-- human triages. The immutable record stays the ledger's.
--
-- Applied to Kc-Live 05 Aug 2026 (ship of the reconciliation UI). The spike
-- version of this file typed matched_ledger_id as uuid; the real ledger's id
-- is BIGINT and the apply failed loudly — corrected here before applying.
-- See docs/OPEN-BANKING.md on why no live feed points at a personal account.

create table bank_transactions (
  id                uuid primary key default gen_random_uuid(),

  -- Provenance. `provider_txn_id` is the bank's own id for the movement and is
  -- the idempotency key: re-polling the same window re-inserts nothing.
  provider          text not null,
  provider_txn_id   text not null,
  account_ref       text not null,

  booked_at         timestamptz not null,
  -- Same sign convention as the ledger: + money in, - money out. Keeping them
  -- identical means a matched pair can be compared without a mental flip.
  amount            numeric(10,2) not null,
  currency          text not null default 'GBP',
  description       text,
  counterparty_name text,
  -- The provider payload, untouched. Matching rules will change; re-deriving
  -- from raw beats re-fetching from a provider that may no longer have it.
  raw               jsonb,

  -- ---- reconciliation state (human-driven) ----
  --   unmatched — nobody has looked
  --   proposed  — the matcher has a candidate, awaiting a human
  --   confirmed — a human agreed; matched_ledger_id is the entry it belongs to
  --   ignored   — genuinely not customer money (bank fees, transfers, personal)
  match_state       text not null default 'unmatched'
                    check (match_state in ('unmatched', 'proposed', 'confirmed', 'ignored')),
  matched_ledger_id bigint references ledger(id),
  matched_by        uuid references staff_profiles(id),
  matched_at        timestamptz,
  note              text,

  created_at        timestamptz not null default now(),

  -- One row per real-world movement.
  unique (provider, provider_txn_id),
  -- A confirmed match must say what it matched; an unconfirmed one must not
  -- claim to have. Stops a half-finished triage reading as done.
  constraint bank_txn_match_complete check (
    (match_state = 'confirmed' and matched_ledger_id is not null)
    or (match_state <> 'confirmed' and matched_ledger_id is null)
  )
);

-- The triage queue reads oldest-unmatched-first; the ledger-side lookup answers
-- "is this entry already reconciled?".
create index bank_transactions_triage_idx on bank_transactions (match_state, booked_at desc);
create index bank_transactions_ledger_idx on bank_transactions (matched_ledger_id)
  where matched_ledger_id is not null;

-- Owner-only, both directions. This is raw bank data: until the shop has its
-- own account it necessarily carries personal movements, and helpers have no
-- business reading it. Same tier as stored credentials.
alter table bank_transactions enable row level security;
create policy bank_txn_owner_all on bank_transactions for all to authenticated
  using (current_staff_role() = 'owner')
  with check (current_staff_role() = 'owner');
