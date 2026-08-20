-- The flights-import staging table must not constrain the customers table.
--
-- zz_flights_import_20260819.customer_id carried a foreign key to customers.
-- That looked tidy and was wrong: it made a record of what an import DID into
-- a constraint on what the shop may do NEXT. The first customer merge after
-- the import failed on it —
--
--   ERROR: update or delete on table "customers" violates foreign key
--   constraint "zz_flights_import_20260819_customer_id_fkey"
--
-- merge_customers() deletes the duplicate row, so any zz_ table holding an FK
-- to customers blocks every merge from then on. Snapshot and staging tables
-- are history; history should not veto the present.
--
-- The column stays, so the table still says which customer each staged row was
-- imported for. It is now a plain uuid: if that customer is later merged away,
-- the value records where the import went at the time, which is the truth a
-- staging table is for.
alter table public.zz_flights_import_20260819
  drop constraint if exists zz_flights_import_20260819_customer_id_fkey;

alter table public.zz_flights_scope_20260819
  drop constraint if exists zz_flights_scope_20260819_customer_id_fkey;

comment on column public.zz_flights_import_20260819.customer_id is
  'The customer this row was imported for, at import time. Deliberately NOT a
   foreign key — see 20260820133000_flights_staging_no_fk.sql. A staging table
   must never block a merge or a delete on the live table it describes.';
