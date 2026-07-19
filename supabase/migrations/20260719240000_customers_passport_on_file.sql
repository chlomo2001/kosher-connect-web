-- customers.passport_on_file — added out-of-band on Kc-staging during
-- development but never versioned, caught by the schema-fingerprint diff while
-- rebuilding Kc-production from the chain (19 Jul). The customers read path
-- selects it on every load (lib/tableStore.js) and the customer card's
-- passport checkbox writes it, so a rebuilt database without this column
-- breaks the Customers tab outright. Idempotent: no-op where it already exists.
alter table customers add column if not exists passport_on_file boolean not null default false;
