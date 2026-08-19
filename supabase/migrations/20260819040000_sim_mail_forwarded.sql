-- A carrier message can record that it was forwarded to the customer.
--
-- Owner item 20, 19 August 2026: forward important carrier mail to the
-- customer's own address, HOLD-gated, with an approval queue. Built from the
-- written brief; the source repo cannot be reached from this session.
--
-- Without these two columns the approval queue would offer the same message
-- again every time it is opened, and an owner working down the list would have
-- no way to tell what they had already sent from what they had not. A queue
-- that cannot forget is not a queue.
--
-- forwarded_to holds the address it actually went to, not the address on file
-- today. If a customer's email changes later, the record still says where the
-- message went — which is the only version of that fact worth keeping.

alter table public.sim_mail add column if not exists forwarded_at timestamptz;
alter table public.sim_mail add column if not exists forwarded_to text;

-- The queue reads "paired, not yet forwarded" on every open.
create index if not exists sim_mail_forwarded_idx
  on public.sim_mail (forwarded_at)
  where forwarded_at is null;
