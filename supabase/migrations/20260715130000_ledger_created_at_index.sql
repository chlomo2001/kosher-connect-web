-- The cash-up / Z-report scans the ledger by created_at date range once per
-- day-view. Cheap now (small table) but this keeps that scan index-backed as
-- the ledger grows. IF NOT EXISTS so re-running the migration is a no-op.
create index if not exists ledger_created_at_idx on public.ledger using btree (created_at);
