-- Phase 2 email hardening — a send log and a suppression list, so delivery
-- (when it eventually goes live) is auditable and bounced / complained
-- addresses are never mailed again. Writing rows here does NOT send anything:
-- the HOLD/TEST/LIVE gate in lib/email.js is unchanged and HOLD stays the
-- default. Service-role only (RLS deny-all), same as customer_documents and
-- stripe_events.

-- One row per send ATTEMPT — including the ones the safety gate held back, so
-- "what would have gone out" is visible before the gate is ever lifted.
create table if not exists email_log (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  kind         text,                      -- 'sale' | 'payment' | 'magic-link' | …
  to_email     text not null,             -- intended recipient (the address on file)
  actual_to    text,                      -- where it really went (test redirect); null when held
  subject      text,
  status       text not null,
  provider     text,                      -- 'resend' | 'smtp'
  provider_id  text,                      -- provider message id, matched by the delivery webhook
  error        text,
  customer_id  uuid references customers(id) on delete set null,
  constraint email_log_status_chk check (status in
    ('held', 'sent', 'redirected', 'failed', 'suppressed', 'delivered', 'bounced', 'complained'))
);
create index if not exists email_log_created_idx  on email_log (created_at desc);
create index if not exists email_log_provider_idx on email_log (provider_id) where provider_id is not null;
create index if not exists email_log_to_idx       on email_log (to_email);
create index if not exists email_log_customer_idx on email_log (customer_id);
alter table email_log enable row level security;
-- No policy on purpose: only the service-role API routes touch this table.

-- Addresses we must not mail again. A hard bounce or a spam complaint inserts
-- here (via the delivery webhook); lib/email.js checks it before every send.
create table if not exists email_suppressions (
  email      text primary key,            -- normalised: trimmed + lower-cased
  reason     text not null,
  detail     text,
  created_at timestamptz not null default now(),
  constraint email_suppressions_reason_chk check (reason in ('bounce', 'complaint', 'manual'))
);
alter table email_suppressions enable row level security;
-- No policy on purpose: service-role only.
