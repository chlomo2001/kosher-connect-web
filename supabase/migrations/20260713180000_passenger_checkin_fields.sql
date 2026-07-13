-- Extra passenger fields the airline check-in form needs, beyond the
-- name/DOB/passport-number/expiry already stored. Owner-approved 2026-07-13.
alter table booking_passengers
  add column if not exists nationality        text,
  add column if not exists passport_issue_date date,
  add column if not exists issuing_country     text;
