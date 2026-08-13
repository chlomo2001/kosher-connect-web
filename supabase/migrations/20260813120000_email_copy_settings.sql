-- The wording of customer receipts, editable from Settings.
--
-- Subjects and the greeting/closing lines lived in pages/api/email.js, so
-- changing a comma meant a code edit and a deploy. Receipt copy gets tuned more
-- than once, and the person who wants it tuned is not the person deploying.
--
-- Four keys, all text. Placeholders are filled at send time:
--   {first}  the customer's first name        {name}   their full name
--   {total}  the receipt total, formatted     {amount} the payment amount
-- An empty value is not "no line" — the API falls back to the wording below, so
-- a blank can never ship a receipt with a missing greeting.
insert into settings (key, text_value, description) values
  ('email_receipt_subject',
   'Your Kosher Connect receipt — {total}',
   'Subject line on a receipt email. {total} is filled in.'),
  ('email_payment_subject',
   'Payment received — {amount}',
   'Subject line on a payment-received email. {amount} is filled in.'),
  ('email_greeting',
   'Dear {first}, thank you for coming in — here are your details for your records.',
   'Opening line inside every receipt email. {first} / {name} are filled in.'),
  ('email_closing',
   'Thank you for choosing Kosher Connect. If anything on this receipt looks wrong, simply reply to this email or call us and we’ll put it right.',
   'Closing line in the footer of every customer email.')
on conflict (key) do nothing;
