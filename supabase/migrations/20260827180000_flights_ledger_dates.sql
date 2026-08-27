-- The flights import stamped ledger rows with the TRAVEL date.
--
-- 422 entries carry "[flights-sheet]" in their description, from the August
-- import of the old flights spreadsheet. For 273 of them `created_at` is the
-- day the customer FLIES rather than the day the entry was recorded — spread
-- from March 2025 to November 2026, with 15 rows worth £3,573 dated into the
-- future on a table that is supposed to be a record of things that happened.
--
-- pages/api/cashup.js selects the day's ledger on created_at
-- (`created_at=gte.<start>&created_at=lt.<end>`, a London day), so those
-- charges surface in Z-reports on days when nothing was sold, and the days
-- they were actually entered look empty. ledger_revenue_since() reads the same
-- column. Everything else that touches created_at only orders by it, which is
-- how a flight booked once and travelling next November sat at the top of a
-- customer's portal history.
--
-- WHAT IS AND IS NOT BEING CHANGED. Only `created_at`, and only where it is
-- exactly equal to the booking's travel_date and that differs from the
-- booking's own created_at. No amount, no reference, no customer, no entry
-- type, no relation. The money is untouched: this corrects WHEN the row says
-- it was written, which the importer overrode with a value that was never true.
--
-- The new value is bookings.created_at — when the booking record was created
-- in KC (13 Jul - 19 Aug 2026, the import window). It is not the date the
-- customer originally booked the flight; that is not recorded anywhere and
-- travel_date is certainly not it. What it does give is the one thing
-- created_at is supposed to mean and currently does not: when this entry
-- entered the system, consistent with every other row in the table.
--
-- WHY THE TRIGGER COMES OFF. ledger_no_mutation forbids UPDATE and DELETE, and
-- both of its permitted branches require `new.created_at = old.created_at` —
-- the timestamp is deliberately inside the immutable set. That is right, and
-- it is why this is a migration with a snapshot rather than an ad-hoc UPDATE:
-- the guard is being lifted for one statement, in one transaction, over a named
-- set of rows, and put back.
--
-- UNDO: zz_snapshot_ledger_flightdates_20260827 holds every affected id with
-- its old and new stamp. To reverse, disable the trigger and set created_at
-- back from old_created_at.

begin;

alter table public.ledger disable trigger ledger_no_mutation;

update public.ledger l
   set created_at = s.new_created_at
  from zz_snapshot_ledger_flightdates_20260827 s
 where l.id = s.id
   and l.created_at = s.old_created_at;

alter table public.ledger enable trigger ledger_no_mutation;

commit;
