-- A SIM can receive its carrier mail at more than one address.
--
-- Owner, 19 Aug, after ten messages sat in the queue with nothing to match:
-- "do the list of addresses".
--
-- The shop gives a line a tagged address per carrier account, so mail about one
-- phone arrives at gitt.bilig+a12@ from one carrier and gitt.bilig+sidner@ from
-- another. A SIM could claim exactly one address — `legacy_extras->>'email'`, a
-- single string on 783 of 797 rows — so the second address belonged to nothing
-- and its mail could never be paired. That was the whole of the remaining
-- pending queue's largest slice.
--
-- The primary address is unchanged and stays the one shown and edited. This is
-- the also-known-as list: every address in it indexes to the same SIM, so which
-- address a message happened to arrive at stops mattering.
--
-- Deliberately NOT a backfill of the primary into the array. Two copies of the
-- same fact drift, and the matcher reads both the primary and the list.

alter table public.sims add column if not exists alt_emails text[] not null default '{}';

-- The matcher looks addresses up; GIN is what makes that a lookup rather than a
-- scan once this is in use across hundreds of SIMs.
create index if not exists sims_alt_emails_idx on public.sims using gin (alt_emails);

comment on column public.sims.alt_emails is
  'Other addresses this line receives carrier mail at, besides legacy_extras->>''email''. Every one pairs to this SIM. Adding an address two SIMs both claim leaves the matcher ambiguous, which is correct — it must never guess between two customers.';
