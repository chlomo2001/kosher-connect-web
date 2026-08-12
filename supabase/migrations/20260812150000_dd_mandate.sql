-- Direct Debit (Bacs) phase 1 — see docs/DD-PLAN-2026-08-12.md.
-- A customer can hold a bank mandate ALONGSIDE their saved card:
-- stripe_pm_id stays cards-only, the mandate lives in its own columns, so
-- nothing existing changes meaning and either can exist without the other.
alter table public.customers
  add column if not exists stripe_dd_pm_id text,
  add column if not exists dd_mandate_status text
    check (dd_mandate_status in ('pending', 'active', 'cancelled'));

comment on column public.customers.stripe_dd_pm_id is
  'Stripe bacs_debit payment method id (pm_…) from the portal DD mandate setup — never a card';
comment on column public.customers.dd_mandate_status is
  'pending: setup started · active: chargeable · cancelled: revoked at the bank or detached';
