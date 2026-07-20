-- Phone guide — the shop's handset catalogue as a living document the owner
-- edits in Settings without touching code: specs, price, pros and cons per
-- model. Powers the public /phone-guide page (active rows only).
-- Spec columns are free text on purpose ("Yes *(second SIM 2G)", "Optional")
-- so the guide can say things a boolean can't.
-- Seeded from the shop's own "Price List" doc (Phones tab, 30 June 2026).

create table if not exists phone_models (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  price        numeric,                              -- £; null = ask in shop
  sort_order   int not null default 100,             -- guide display order
  dual_sim     text,
  yiddish_text text,
  touch_screen text,
  texting      text,                                 -- 'Optional', 'With text', 'No text'…
  pros         text,                                 -- one point per line
  cons         text,                                 -- one point per line
  notes        text,                                 -- internal only, never public
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint phone_models_name_key unique (name)
);
create index if not exists phone_models_active_idx on phone_models (active, sort_order);
alter table phone_models enable row level security;
-- No policy on purpose: only the service-role API routes touch this table.

insert into phone_models (name, price, sort_order, dual_sim, yiddish_text, touch_screen, texting) values
  ('FIG Pro',    280, 1,  'Yes', 'Yes', 'Yes',  'Optional'),
  ('FIG Core',   189, 2,  'No',  'Yes', 'No',   'Optional'),
  ('NAVI C1',    169, 3,  'Yes', 'Yes', 'No',   'With text'),
  ('Croscall',   115, 4,  'Yes', 'No',  'No',   'With text'),
  ('QLYX Q7',    135, 5,  'Yes', 'Yes', 'No',   'No text'),
  ('Show F2',    125, 6,  'Yes (second SIM is 2G)', 'Yes', 'No',   'Optional — OTP (bank texts only)'),
  ('Digit',      105, 7,  'Yes (second SIM is 2G)', 'Yes', 'Semi', 'Optional — OTP (bank texts only)'),
  ('Nokia 105',   55, 8,  'Yes', 'Yes', 'No',   'Optional'),
  ('Nokia 110',   60, 9,  'Yes', 'Yes', 'No',   'Yes'),
  ('TCL 4042',    55, 10, 'Yes', 'No',  'No',   'Optional'),
  ('TCL 5041',    35, 11, 'Yes', 'No',  'No',   'Optional'),
  ('Mini 3 SIM',  30, 12, 'Yes', 'Yes', 'No',   'Yes'),
  ('Mini 2 SIM',  25, 13, 'Yes', 'Yes', 'No',   'Yes')
on conflict (name) do nothing;
