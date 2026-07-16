-- audit C15 — preserve the intended monthly billing day-of-month.
--
-- advanceOneMonth() clamped the day to the shorter month (31 Jan -> 28 Feb) and
-- then reused the CLAMPED date as the next anchor, so a month-end subscription
-- drifted permanently earlier (28 Feb -> 28 Mar -> ...) and never returned to the
-- 31st. Storing an immutable anchor day and clamping THAT each month fixes it.
alter table virtual_numbers
  add column if not exists billing_anchor_day smallint
    check (billing_anchor_day is null or billing_anchor_day between 1 and 31);

-- Backfill from the current pointer. Rows that have not yet crossed a short month
-- still carry their true day; already-drifted rows lock in their current day (the
-- original intent is not recoverable) but stop drifting further. New rows are
-- self-healed by the sweep on their first billing run.
update virtual_numbers
  set billing_anchor_day = extract(day from next_billing_date)::smallint
  where billing_anchor_day is null and next_billing_date is not null;
