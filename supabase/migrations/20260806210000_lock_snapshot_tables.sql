-- Lock every public table that has no row-level security.
--
-- Found 2026-08-06 by the Supabase security advisor: 16 tables sat in the
-- `public` schema with RLS disabled AND full DELETE/INSERT/SELECT/UPDATE
-- granted to `anon` and `authenticated`. `public` is exposed through
-- PostgREST and `anon` is the publishable key that ships in the browser, so
-- those tables were readable and writable by anyone holding it.
--
-- They were all snapshot / undo / import-staging tables, not app tables —
-- but several held real customer data. `undo_20260806_customers` was a
-- complete copy of the customers table (names, phone numbers, addresses,
-- emails); the zz_snapshot_ledger_* tables held money rows.
--
-- Cause: `CREATE TABLE ... AS SELECT` run directly against production
-- inherits the schema's default grants and starts with RLS off. Every
-- ad-hoc snapshot since 2026-07-29 carried the same defect.
--
-- Fix: revoke the anon/authenticated grants and switch RLS on. No policies
-- are added deliberately — RLS with no policy denies everything, which is
-- correct for a backup table. `service_role` bypasses RLS, so server-side
-- code and future restores are unaffected.
--
-- If you add another snapshot table by hand, run this again.

do $$
declare t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity = false
  loop
    execute format('revoke all on public.%I from anon, authenticated', t.relname);
    execute format('alter table public.%I enable row level security', t.relname);
    raise notice 'locked public.%', t.relname;
  end loop;
end $$;
