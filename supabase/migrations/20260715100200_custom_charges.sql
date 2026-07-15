-- Owner-defined "extra charges" the engine applies automatically to a chosen
-- charge type, either always ('auto') or as a per-charge toggle ('optional').
-- Created out-of-band during development; versioned here so a rebuild keeps the
-- auto-charge feature working instead of throwing "relation does not exist".
create table if not exists custom_charges (
  id         uuid primary key default gen_random_uuid(),
  label      text not null,
  amount     numeric not null check (amount >= 0),
  applies_to text not null check (applies_to in ('booking','service','sim','repair','rental','any')),
  mode       text not null default 'auto' check (mode in ('auto','optional')),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
