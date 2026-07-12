-- Kosher Connect — initial relational schema (staging first, then production).
-- Source of truth: docs/SCHEMA.md. Conventions: snake_case, plural tables,
-- uuid PKs via gen_random_uuid(), timestamptz, all money numeric(10,2).

-- ============================================================
-- 1. ENUMS
-- ============================================================

create type user_role          as enum ('owner', 'helper');
create type payment_method     as enum ('cash', 'card', 'voucher', 'bank_transfer', 'wallet', 'other');
create type line_status        as enum ('available', 'rented', 'suspended', 'retired');
-- 'booked' added: the live engine derives Booked for future-start rentals.
create type rental_status      as enum ('booked', 'active', 'overdue', 'returned');
create type vn_selection       as enum ('none', 'weekly', 'per_30_days');
create type discount_type      as enum ('percent', 'fixed');
create type sim_billing_option as enum ('annual_plan', 'per_service');
create type sim_status         as enum ('active', 'renewal_pending', 'cancelled');
-- Who fronts SIM renewal money: KC (recovered from wallet) or the customer directly.
create type sim_payer          as enum ('kc', 'customer');
create type stock_category     as enum ('phone', 'accessory', 'sim', 'other');
create type service_category   as enum ('repair', 'online', 'tickets', 'phone');
create type task_source        as enum ('auto', 'manual', 'sms');
create type task_priority      as enum ('low', 'medium', 'high');  -- legacy 'Normal' maps to 'medium'
-- Per-item equipment state (A-series): three states, NOT a boolean.
create type item_kind          as enum ('phone', 'sim', 'plug', 'cable');
create type rental_item_status as enum ('undecided', 'returned', 'lost');
create type holiday_region     as enum ('diaspora', 'israel');

create type ledger_entry_type as enum (
  'rental', 'rental_adjustment', 'rental_void', 'rental_loss',
  'sim_annual', 'sim_additional', 'sim_replacement', 'sim_service',
  'repair', 'online_service', 'booking', 'phone_sale', 'stock_sale',
  'top_up', 'payment', 'refund', 'manual_adjustment'
);

-- ============================================================
-- 2. FOUNDATION
-- ============================================================

create table staff_profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       user_role not null default 'helper',
  full_name  text,
  created_at timestamptz not null default now()
);

-- SECURITY DEFINER with pinned search_path (prevents search-path hijack).
create function current_staff_role() returns user_role
language sql security definer stable
set search_path = public
as $$
  select role from staff_profiles where id = auth.uid()
$$;

create table customers (
  id                 uuid primary key default gen_random_uuid(),
  legacy_id          text unique,        -- old app id (Date.now()) — cutover mapping
  auth_user_id       uuid unique references auth.users(id),  -- future customer portal login
  first_name         text not null,
  last_name          text,
  phone_country_code text,
  phone_number       text,
  has_whatsapp       boolean not null default false,
  email_raw          text,
  email_normalized   text,
  address            text,
  city               text,
  drive_folder_url   text,
  stripe_pm_id       text,               -- owner-only (exclude from helper views)
  notes              text,
  created_at         timestamptz not null default now(),
  created_by         uuid references staff_profiles(id),
  updated_at         timestamptz not null default now()
);

create unique index customers_email_normalized_key
  on customers (email_normalized) where email_normalized is not null;
create unique index customers_phone_key
  on customers (phone_country_code, phone_number) where phone_number is not null;

-- ============================================================
-- 3. ACCOUNTS, POOLS, LINES (the rental fleet)
-- ============================================================

create table master_accounts (
  id            uuid primary key default gen_random_uuid(),
  provider      text not null,
  account_email text not null,           -- stored verbatim; do NOT normalize
  label         text,
  notes         text,
  created_at    timestamptz not null default now()
);

create table master_account_credentials (
  master_account_id    uuid primary key references master_accounts(id) on delete cascade,
  credential_encrypted text                -- app-layer encrypted; owner-only
);

create table pools (
  id                uuid primary key default gen_random_uuid(),
  master_account_id uuid not null references master_accounts(id),
  pool_number       text,
  activation_date   date,
  expiry_date       date,
  data_allowance_gb numeric(10,2),
  notes             text
);

create table lines (
  id                uuid primary key default gen_random_uuid(),
  legacy_id         text unique,         -- old app phone id — cutover mapping
  label             text,
  number            text,
  region            text,                 -- US / Canada / UK
  carrier           text,
  sub_brand         text,                 -- att / verizon / tmobile
  master_account_id uuid references master_accounts(id),
  pool_id           uuid references pools(id),
  iccid             text,
  wrap_imei         text,
  status            line_status not null default 'available',
  current_rental_id uuid,                 -- FK added after rentals
  renewal_date      date,
  replacement_value numeric(10,2),        -- optional per-line damage override
  notes             text,
  created_at        timestamptz not null default now()
);

-- ============================================================
-- 4. STOCK & SERVICE MENU
-- ============================================================

create table stock_items (
  id            uuid primary key default gen_random_uuid(),
  item_code     text,
  category      stock_category not null,
  company       text,
  model         text,
  description   text,
  net_price     numeric(10,2),
  selling_price numeric(10,2),
  profit        numeric(10,2) generated always as (selling_price - net_price) stored,
  quantity      int,
  active        boolean not null default true,
  updated_at    timestamptz not null default now()
);

create table service_prices (
  id         uuid primary key default gen_random_uuid(),
  service_id text unique not null,        -- legacy numeric id carried as text
  name       text not null,
  category   service_category not null,
  price      numeric(10,2) not null,
  active     boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 5. PRICING CONFIG + HOLIDAYS
-- ============================================================

create table rental_rates (
  country_code    text primary key,       -- 'USA','UK-UKmins','UK-Intl','Israel','Canada'
  display_name    text not null,
  rate_per_day    numeric(10,2) not null,
  min_charge      numeric(10,2) not null,
  cap             numeric(10,2) not null,
  cap_period_days int not null default 30,
  active          boolean not null default true,
  updated_at      timestamptz not null default now()
);

create table damage_rates (
  country_code      text primary key references rental_rates(country_code),
  phone_damage_loss numeric(10,2) not null,
  charger_missing   numeric(10,2) not null,
  sim_missing       numeric(10,2) not null,   -- BUSINESS_RULES §1.6: lost SIM £10
  updated_at        timestamptz not null default now()
);

create table settings (
  key         text primary key,
  num_value   numeric(10,2),
  text_value  text,
  description text,
  updated_at  timestamptz not null default now()
);

-- Deterministic Yom Tov calendar (2020–2125), seeded from the committed
-- generator (scripts/generate-holidays.mjs, @hebcal/core, flags.CHAG).
-- Pricing NEVER calls an external API: chargeable-day = not Saturday AND
-- not in this table for the rental's region.
create table holidays (
  holiday_date date not null,
  region       holiday_region not null,
  name         text,
  primary key (holiday_date, region)
);

-- ============================================================
-- 6. RENTALS (+ per-item equipment state)
-- ============================================================

create table rentals (
  id                   uuid primary key default gen_random_uuid(),
  legacy_id            text unique,      -- old app rental id — cutover mapping
  customer_id          uuid not null references customers(id),
  line_id              uuid not null references lines(id),
  device_stock_item_id uuid references stock_items(id),
  country_code         text not null references rental_rates(country_code),
  start_date           date not null,
  end_date             date not null,
  actual_return_date   date,
  vn_selection         vn_selection not null default 'none',
  vn_prefix            text,               -- chosen VN city/prefix (Lakewood, Monsey, …)
  chargeable_days      int,
  calendar_days        int,
  base_charge          numeric(10,2),
  late_days            int,
  late_fee             numeric(10,2),      -- frozen at return/save time
  damage_charges       numeric(10,2),
  total_charge         numeric(10,2),
  pricing_snapshot     jsonb,
  status               rental_status not null default 'booked',
  is_lost              boolean not null default false,
  is_void              boolean not null default false,
  discount_type        discount_type,
  discount_value       numeric(10,2),
  notes                text,
  created_at           timestamptz not null default now(),
  created_by           uuid references staff_profiles(id)
);

alter table lines add constraint lines_current_rental_fk
  foreign key (current_rental_id) references rentals(id);

-- Per-item three-state equipment tracking (replaces checklist booleans).
-- Carries the A-series model: given? / undecided-returned-lost / per-item
-- lost charge (reversible until the ledger entry is posted).
create table rental_items (
  id          uuid primary key default gen_random_uuid(),
  rental_id   uuid not null references rentals(id) on delete cascade,
  item        item_kind not null,
  given       boolean not null default true,
  status      rental_item_status not null default 'undecided',
  lost_charge numeric(10,2),
  unique (rental_id, item),
  check (lost_charge is null or status = 'lost')  -- a charge implies the item is lost
);

-- ============================================================
-- 7. SIMS
-- ============================================================

create table sims (
  id                    uuid primary key default gen_random_uuid(),
  legacy_id             text unique,     -- old app SIM id — cutover mapping
  customer_id           uuid not null references customers(id),
  master_account_id     uuid references master_accounts(id),
  provider              text,
  alias                 text,
  tier                  text,
  billing_option        sim_billing_option not null,
  replacements_used     int not null default 0,
  renewal_cycle_days    int,
  next_renewal_date     date,
  paid_by               sim_payer,           -- kc fronts it vs customer pays direct
  fee_applied           numeric(10,2),       -- £ recovered from wallet when paid_by='kc'
  provider_monthly_cost numeric(10,2),       -- basis for cost + max(10%, £2) DD pricing
  dd_collection_day     int check (dd_collection_day between 1 and 31),
  status                sim_status not null default 'active',
  created_at            timestamptz not null default now()
);

-- ============================================================
-- 8. TASKS, VIRTUAL NUMBERS, REPAIRS, BOOKINGS, SALES, RESELLER LINKS
-- ============================================================

create table tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  customer_id uuid references customers(id),
  due_date    date,
  source      task_source not null default 'manual',
  priority    task_priority not null default 'medium',
  done        boolean not null default false,
  done_at     timestamptz,
  raw_text    text,
  reference   text,                       -- keyed auto-tasks, e.g. 'BALANCE-<id>'
  created_at  timestamptz not null default now()
);

-- ONE OPEN task per reference; closed tasks keep theirs, so the same key can be
-- re-raised later (close BALANCE-x → re-open BALANCE-x). A plain UNIQUE would
-- permanently block re-raising.
create unique index tasks_reference_open_key
  on tasks (reference) where reference is not null and not done;

create table virtual_numbers (
  id           uuid primary key default gen_random_uuid(),
  number       text,
  customer_id  uuid references customers(id),
  line_id      uuid references lines(id),
  platform     text,
  status       text,
  shortcut_url text,
  notes        text,
  created_at   timestamptz not null default now()
);

create table repairs (
  id                 uuid primary key default gen_random_uuid(),
  customer_id        uuid not null references customers(id),
  device_description text,
  total              numeric(10,2),
  status             text,
  opened_at          timestamptz,
  closed_at          timestamptz,
  timer_seconds      int,
  timer_start        timestamptz,
  timer_stop         timestamptz,
  notes              text
);

create table repair_services (
  id               uuid primary key default gen_random_uuid(),
  repair_id        uuid not null references repairs(id) on delete cascade,
  service_price_id uuid references service_prices(id),
  price            numeric(10,2)          -- frozen at open time
);

create table bookings (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid not null references customers(id),
  passenger         text,
  route             text,
  airline           text,
  booking_reference text,
  travel_date       date,
  departure_time    time,
  arrival_time      time,
  price             numeric(10,2),
  booking_fee       numeric(10,2),
  status            text,
  passport_on_file  boolean,
  passport_expiry   date,                 -- owner-only (exclude from helper views)
  notes             text,
  created_at        timestamptz not null default now()
);

create table sold_phones (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid references customers(id),
  phone_company text,
  model         text,
  imei          text,
  serial        text,
  sold_at       timestamptz not null default now(),
  sold_by       uuid references staff_profiles(id)
);

create table sold_phone_credentials (
  sold_phone_id      uuid primary key references sold_phones(id) on delete cascade,
  security_encrypted text                  -- app-layer encrypted; owner-only
);

create table reseller_links (
  id           uuid primary key default gen_random_uuid(),
  provider     text not null,
  account_meta text,
  shortcut_url text,
  notes        text
);

-- ============================================================
-- 9. LEDGER (append-only; created last so related FKs all resolve)
-- ============================================================

create table ledger (
  id                 bigint generated always as identity primary key,
  customer_id        uuid not null references customers(id),
  charge_reference   text not null unique,   -- idempotency key (RENTAL-<id>, TIMER-<id>, …)
  entry_type         ledger_entry_type not null,
  amount             numeric(10,2) not null, -- signed; enforced by ledger_amount_sign
  method             payment_method,
  description        text,
  related_rental_id  uuid references rentals(id),
  related_sim_id     uuid references sims(id),
  related_repair_id  uuid references repairs(id),
  related_booking_id uuid references bookings(id),
  created_at         timestamptz not null default now(),
  created_by         uuid references staff_profiles(id),

  -- The sign convention is a CONSTRAINT, not a comment (the .gs project needed
  -- typeSign_() to enforce this; here the database does it):
  --   money in  (+): top_up, payment, refund, rental_void
  --   money out (−): every charge type
  --   either (≠ 0): rental_adjustment, manual_adjustment
  constraint ledger_amount_nonzero check (amount <> 0),
  constraint ledger_amount_sign check (
    case
      when entry_type in ('top_up', 'payment', 'refund', 'rental_void')
        then amount > 0
      when entry_type in ('rental', 'rental_loss', 'sim_annual', 'sim_additional',
                          'sim_replacement', 'sim_service', 'repair',
                          'online_service', 'booking', 'phone_sale', 'stock_sale')
        then amount < 0
      else true  -- rental_adjustment, manual_adjustment: either direction
    end
  )
);

-- Balance is always derived, never stored. security_invoker so RLS on ledger
-- applies to whoever queries the view.
create view customer_balances
  with (security_invoker = on) as
  select customer_id, coalesce(sum(amount), 0)::numeric(10,2) as balance
  from ledger
  group by customer_id;

-- Append-only enforcement (belt and braces on top of RLS).
create function ledger_is_immutable() returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'ledger is append-only: no UPDATE/DELETE';
end;
$$;

create trigger ledger_no_mutation
  before update or delete on ledger
  for each row execute function ledger_is_immutable();

-- ============================================================
-- 10. INDEXES (hot foreign keys / filters)
-- ============================================================

create index ledger_customer_id_idx        on ledger (customer_id);
create index ledger_related_rental_idx     on ledger (related_rental_id) where related_rental_id is not null;
create index rentals_customer_id_idx       on rentals (customer_id);
create index rentals_line_id_idx           on rentals (line_id);
create index rental_items_rental_id_idx    on rental_items (rental_id);
create index sims_customer_id_idx          on sims (customer_id);
create index tasks_open_idx                on tasks (done, due_date);
create index repairs_customer_id_idx       on repairs (customer_id);
create index bookings_customer_id_idx      on bookings (customer_id);
create index lines_pool_id_idx             on lines (pool_id);
create index holidays_region_idx           on holidays (region, holiday_date);
