-- Three states the rental pool has always had, that the schema never did.
--
-- The `lines.status` enum was available/rented/suspended/retired, mirroring the
-- old LINE_STATUSES list in lib/mappers.js. Importing the real 114-line pool
-- (docs/RENTAL-POOL-MIGRATION.md) needs three more, and they are not
-- bookkeeping niceties — each one is a phone that must NOT be offered out:
--
--   permanent    the line lives with someone indefinitely, by arrangement.
--                Not a rental running late: it has no return date and must
--                never appear in the overdue chase. 9 lines in the pool.
--   not_working  broken or dead. Not stock. 2 lines.
--   unknown      the sheet said something we could not read. Deliberately a
--                real state rather than a guess — the app's review queue asks
--                a human instead of the importer inventing an answer. 2 lines.
--
-- Until now lib/mappers.js coerced anything unrecognised to 'available', which
-- is the one value meaning "safe to rent". That is fixed in the same change.
--
-- ADD VALUE IF NOT EXISTS is idempotent, so re-running this migration against a
-- database that already has them is a no-op. Note that a value added here
-- cannot be USED in the same transaction — the data load is a separate step.
alter type line_status add value if not exists 'permanent';
alter type line_status add value if not exists 'not_working';
alter type line_status add value if not exists 'unknown';
