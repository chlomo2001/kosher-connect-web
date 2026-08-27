-- Kosher Connect — close eight working tables to the anon key.
--
-- The undo snapshots taken during the 23-24 August migrations were created with
-- plain `create table … as select …`, which does not inherit row-level security.
-- Every other zz_/undo_ table in this database has RLS on; these eight did not,
-- and Supabase's own advisor flags them as critical.
--
-- Why it matters even though this app never ships an anon key: a Supabase anon
-- key is not a secret. It is designed to be public, and RLS is the entire reason
-- that is safe. With RLS off, anybody holding it could read — and write — 447
-- rows of real customer data:
--
--   sims_undo_20260823_fk              206   SIM plans
--   zz_snapshot_lines_20260824         112   phone lines
--   sim_mail_undo_20260823              94   carrier mail
--   zz_snapshot_lines_wipe_20260824    107   phone lines
--   zz_snapshot_rental_items_20260824   20   rental items
--   zz_snapshot_ledger_rentals_20260824 11   ledger rows
--   zz_snapshot_rentals_20260824         5   rentals
--   bookings_undo_20260823_issue12       2   bookings
--
-- Enabled with NO policies, deliberately. A table with RLS on and no policy is
-- readable by nobody through the anon or authenticated roles — which is the
-- correct state for a backup nothing is supposed to read. Nothing in this
-- repository references any of these eight names (checked), and the server
-- reaches Postgres with the service-role key, which bypasses RLS entirely, so
-- restoring from one of them by hand still works exactly as before.
--
-- These are working files, not schema. Once the owner is satisfied the August
-- migrations are settled they should be dropped rather than kept locked.

alter table sim_mail_undo_20260823                enable row level security;
alter table sims_undo_20260823_fk                 enable row level security;
alter table bookings_undo_20260823_issue12        enable row level security;
alter table zz_snapshot_rentals_20260824          enable row level security;
alter table zz_snapshot_rental_items_20260824     enable row level security;
alter table zz_snapshot_lines_20260824            enable row level security;
alter table zz_snapshot_ledger_rentals_20260824   enable row level security;
alter table zz_snapshot_lines_wipe_20260824       enable row level security;
