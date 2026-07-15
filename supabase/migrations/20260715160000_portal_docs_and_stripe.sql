-- Portal phase 2 — customer documents (both directions) + Stripe self-pay prep.
--
-- Nothing here goes live on its own: the Documents API needs the 'customer-docs'
-- bucket (created below) and the portal enabled (PORTAL_ENABLED=1); Stripe stays
-- dormant until the keys are set. All access is through service-role API routes,
-- so these tables are RLS-locked with no public policy (deny-all to anon/auth).

-- ── Customer documents ─────────────────────────────────────────────────────
-- Staff publish documents to a customer; the customer can upload back (passport
-- photo, etc.), which lands as 'pending' for staff to approve before it counts.
create table if not exists customer_documents (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references customers(id) on delete cascade,
  storage_path  text not null,                       -- path within the 'customer-docs' bucket
  filename      text not null,
  content_type  text,
  size_bytes    bigint,
  source        text not null default 'staff',       -- 'staff' | 'customer'
  status        text not null default 'published',   -- 'published' | 'pending' | 'rejected'
  note          text,
  uploaded_by   text,                                -- staff id, or 'customer'
  created_at    timestamptz not null default now(),
  constraint customer_documents_source_chk check (source in ('staff', 'customer')),
  constraint customer_documents_status_chk check (status in ('published', 'pending', 'rejected'))
);
create index if not exists customer_documents_customer_idx
  on customer_documents (customer_id, created_at desc);
create index if not exists customer_documents_pending_idx
  on customer_documents (status) where status = 'pending';

alter table customer_documents enable row level security;
-- No policy on purpose: only the service-role API routes touch this table.

-- Private bucket for the files themselves. Service-role uploads/reads and issues
-- short-lived signed URLs; nothing is world-readable.
insert into storage.buckets (id, name, public)
values ('customer-docs', 'customer-docs', false)
on conflict (id) do nothing;

-- ── Stripe self-pay prep ───────────────────────────────────────────────────
-- A Stripe Customer id is needed to attach a saved card and to charge; the
-- existing stripe_pm_id column holds the saved payment method. Owner-only:
-- exclude from helper/staff views the same way stripe_pm_id already is.
alter table customers add column if not exists stripe_customer_id text;

-- Webhook idempotency: Stripe retries deliver the same event id more than once.
create table if not exists stripe_events (
  id           text primary key,     -- Stripe event id (evt_…)
  type         text,
  received_at  timestamptz not null default now()
);
alter table stripe_events enable row level security;
