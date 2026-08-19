-- The undo snapshots were readable by anybody holding the publishable key.
--
-- Found 19 Aug 2026 02:13, from the Supabase Advisor's "RLS Disabled in Public"
-- notices. The working agreement says to keep an undo snapshot before any bulk
-- data write, and that has been followed faithfully -- 55 zz_* tables between
-- 29 July and 12 August. Forty-eight of them had RLS switched off AND a SELECT
-- grant to `anon`, which together mean one thing: every row in them was
-- readable through PostgREST by anyone with the project's publishable key. That
-- key is public by design; it ships in the browser bundle of the welcome page.
--
-- What was exposed, by count and column name only (values are never quoted in a
-- migration, a log or a chat message -- passport numbers are PII):
--
--   zz_snapshot_booking_passengers_20260809   125 rows, carrying
--       passport_number, passport_issue_date, passport_expiry, dob, nationality
--   zz_snapshot_customers_20260809            740 rows, with phone, email, address
--   …and 26 further customer/booking snapshots with the same contact columns.
--
-- The seven snapshots taken 29 July - 2 August already had RLS on, so this was
-- a habit that lapsed rather than one that never existed.
--
-- Enabling RLS with no policy denies everything to `anon` and `authenticated`.
-- It cannot break the app: lib/db.js connects with SUPABASE_SERVICE_ROLE_KEY,
-- and service_role bypasses RLS. The grants are revoked as well, so the tables
-- are shut by two independent mechanisms rather than one.
--
-- NOT dropped. Most of these are long past any useful undo window and should
-- go, but deleting production data is the owner's call, not a migration's.

do $$
declare t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'zz\_%'
  loop
    execute format('alter table public.%I enable row level security', t.relname);
    execute format('revoke all on public.%I from anon, authenticated', t.relname);
  end loop;
end $$;

-- Anything created later under the same naming habit starts shut, so this is
-- not a one-off tidy-up that the next bulk write undoes.
comment on schema public is
  'Snapshot tables (zz_*) must be created with RLS enabled and no grants to anon/authenticated — see 20260819021500_lock_down_zz_snapshots.sql. They hold copies of customer and passenger rows.';
