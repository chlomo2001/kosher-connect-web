-- Who holds a subscription, who pays for it, and how often it bills.
--
-- Owner, 25 Aug 2026, asked to focus on KC's own subscriptions — Gemini,
-- Twilio and the rest — alongside the ownership question in issue #9. Those
-- turn out to be the same question seen from two sides. The register
-- (business_accounts) already listed WHAT the shop uses; it had nowhere to say
-- whose account each one sits in or whose card pays it, which is exactly what
-- the ownership decision turns on.
--
-- Three identities were already in play with nothing recording which vendor
-- belonged to which: the Vercel team is held by touchdesigns.studio@gmail.com
-- (docs/OWNERSHIP-MIGRATION.md §1 flags that as the one answer to move away
-- from), and the register itself lists ch7023518@gmail.com and
-- git.bilig@gmail.com.
--
-- held_by and paid_by are deliberately separate. An account can sit under one
-- login while a different card pays it, and that gap is where a subscription
-- quietly becomes somebody else's leverage. Both are free text: the answers are
-- email addresses, card descriptions and company names, and forcing them into a
-- lookup table now would mean inventing the categories before the owner has
-- said what they are.
--
-- billing_period earns its place because monthly_cost is a lie without it —
-- Vercel and a domain registrar bill annually, and a register that totals
-- annual figures as monthly overstates the run rate by twelve.

alter table business_accounts
  add column if not exists held_by        text,
  add column if not exists paid_by        text,
  add column if not exists billing_period text;

comment on column business_accounts.held_by is
  'Whose account/login this subscription sits under (e.g. an email address). The ownership question, from the money side.';
comment on column business_accounts.paid_by is
  'What actually pays it — a card, a direct debit, a company. May differ from held_by.';
comment on column business_accounts.billing_period is
  'monthly | annual | usage | free. Without it, monthly_cost cannot be totalled honestly.';

-- Gemini is live and was missing from the register: lib/gemini.js writes
-- ai_usage rows, lib/aiCost.mjs carries its price table, and there are real
-- calls logged from 23 Aug 2026. A register that omits a vendor the app is
-- actually calling is worse than none, because it reads as complete.
insert into business_accounts (name, category, url, active, billing_period, notes)
select 'Google AI (Gemini)', 'infrastructure', 'https://aistudio.google.com', true, 'usage',
       'Added 25 Aug 2026 — was in use but missing from the register. Billed on usage; see the AI usage screen for spend.'
where not exists (
  select 1 from business_accounts where lower(name) like '%gemini%' or lower(name) like '%google ai%'
);
