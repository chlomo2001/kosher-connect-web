-- Accounts & subscriptions register — every external account the business
-- depends on (Vercel, Supabase, Resend, Twilio, elid, FreePBX server, carrier
-- logins, domain registrar…): where to log in, what it costs, when it renews.
-- Credentials are stored ONLY as secretbox ciphertext (AES-256-GCM under
-- SIM_CRED_KEY, same scheme as SIM carrier passwords) — never plaintext.
-- Service-role only (RLS deny-all), owner-only at the API layer.

create table if not exists business_accounts (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,                       -- 'Twilio', 'elid IVR', 'Three — yehoishebroier'
  category      text not null default 'other',      -- infrastructure|telecom|ivr|email|finance|other
  url           text,                                -- login page
  login_email   text,
  cred_cipher   text,                                -- secretbox 'v1:…' or null
  monthly_cost  numeric,                             -- £/month; null = free / unknown
  renewal_date  date,                                -- next renewal; null = rolling
  notes         text,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint business_accounts_category_chk check (category in
    ('infrastructure', 'telecom', 'ivr', 'email', 'finance', 'other'))
);
create index if not exists business_accounts_active_idx on business_accounts (active, category);
alter table business_accounts enable row level security;
-- No policy on purpose: only the service-role API routes touch this table.
