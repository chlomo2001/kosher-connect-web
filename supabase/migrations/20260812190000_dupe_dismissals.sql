-- "Not the same person" verdicts from the duplicate review screen.
--
-- These were first written to the settings table, which is deliberately
-- edit-only over a whitelist of pricing keys — so every dismissal failed with
-- "Could not save that." A verdict about two customers is not a setting: it
-- belongs with the customers, and it needs to survive a browser change and be
-- shared by whoever is at the counter.
--
-- The pair is stored ordered (a < b) so one verdict covers both directions,
-- and both sides cascade: merging or deleting a customer takes its verdicts
-- with it, since the pair can never come up again anyway.
create table if not exists public.customer_dupe_dismissals (
  customer_a uuid not null references public.customers(id) on delete cascade,
  customer_b uuid not null references public.customers(id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  dismissed_by text,
  primary key (customer_a, customer_b),
  constraint dupe_pair_ordered check (customer_a < customer_b)
);

comment on table public.customer_dupe_dismissals is
  'Pairs a human has judged NOT to be the same person, so the duplicate review never asks again.';

alter table public.customer_dupe_dismissals enable row level security;
-- Same posture as the rest of the schema: reached only through the service
-- role in the API layer, never from the browser.
revoke all on table public.customer_dupe_dismissals from anon, authenticated;
