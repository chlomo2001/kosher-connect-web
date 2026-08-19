-- A rate can now say whether a person has ever checked it.
--
-- Port item C1c, 19 August 2026. Built from the written brief; the source repo
-- (earothbart-ai/pixel-perfect-peek) cannot be reached from this session.
--
-- Every rate table carried `updated_at` and nothing else: the shop could see
-- WHEN a figure last moved but never whether anybody had confirmed it against
-- reality. The two are not the same thing, and the difference showed on 19 Aug
-- when the welcome page was found quoting GBP 3/day, GBP 20 minimum and GBP 45
-- cap while the live rate list said GBP 2, GBP 15 and GBP 30. Nothing was
-- broken; three numbers had simply drifted, and no screen had any way to know.
--
-- `confirmed_source` is mandatory at the point of confirming (enforced in the
-- API, not here, so the column can hold history for rows confirmed later). It
-- is what makes a confirmation evidence rather than a click: "checked against
-- the Lebara price list, 19 Aug" is a fact somebody can go back to.

alter table public.rental_rates      add column if not exists confirmed_at timestamptz;
alter table public.rental_rates      add column if not exists confirmed_by text;
alter table public.rental_rates      add column if not exists confirmed_source text;

alter table public.damage_rates      add column if not exists confirmed_at timestamptz;
alter table public.damage_rates      add column if not exists confirmed_by text;
alter table public.damage_rates      add column if not exists confirmed_source text;

alter table public.service_prices    add column if not exists confirmed_at timestamptz;
alter table public.service_prices    add column if not exists confirmed_by text;
alter table public.service_prices    add column if not exists confirmed_source text;

alter table public.vn_bundle_prices  add column if not exists confirmed_at timestamptz;
alter table public.vn_bundle_prices  add column if not exists confirmed_by text;
alter table public.vn_bundle_prices  add column if not exists confirmed_source text;

-- The half that makes "confirmed" mean anything.
--
-- Without this, confirming a rate once would keep it confirmed through every
-- later edit — so the tick would come to mean "somebody looked at an earlier
-- number", which is worse than no tick at all. Any change to the row drops the
-- confirmation, and the ONLY update that keeps it is the one that sets it.
create or replace function public.clear_rate_confirmation()
returns trigger
language plpgsql
security invoker
set search_path to 'public'
as $$
begin
  -- A confirmation is itself an update; that one keeps its own stamp.
  if new.confirmed_at is distinct from old.confirmed_at then
    return new;
  end if;
  -- Anything else changed the row, so nobody has checked what it says now.
  new.confirmed_at := null;
  new.confirmed_by := null;
  new.confirmed_source := null;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['rental_rates','damage_rates','service_prices','vn_bundle_prices']
  loop
    execute format('drop trigger if exists %I on public.%I', 'clear_rate_confirmation_' || t, t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.clear_rate_confirmation()',
      'clear_rate_confirmation_' || t, t);
  end loop;
end $$;
