-- How long a rental receipt gives the customer to pay, at minimum.
--
-- Owner, 20 Aug 2026, on the receipt for a rental left on account: "if not,
-- please pay till (7 days? or the due date of phone return?)". The answer
-- taken: the RETURN date, because that is the day the customer is at the
-- counter anyway — with this as the floor, so a two-day rental does not demand
-- payment the day after tomorrow. lib/rentalReceipt.mjs rentalPayBy().
--
-- A term of business, so it lives here with the price list rather than in an
-- email template.

insert into settings (key, num_value, description)
values ('rental_pay_days', 7, 'Minimum days a rental receipt gives to pay (the due date is the return date, or this, whichever is later)')
on conflict (key) do nothing;
