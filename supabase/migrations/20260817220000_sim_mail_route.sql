-- Which way did this message actually come?
--
-- The shop's SIM accounts live in seven of its own Gmail mailboxes, and those
-- mailboxes forward into one business-only inbox (5311386k). The obvious move
-- is to point the app at that one inbox and let it forward everything — one
-- integration instead of seven.
--
-- Whether that WORKS turns on a question about Gmail that no amount of reading
-- settles: does a message which arrived at the hub by forwarding get forwarded
-- on again? Google documents one hard rule — "we forward all new messages to
-- the account, except for spam" — and a chained forward is exactly the shape
-- that can be marked as spam at the second hop, because the sending IP no
-- longer matches the domain in From.
--
-- So stop arguing and record it. Every message now stores the recipient chain
-- it arrived with, hops included. A message that came the long way carries the
-- hub in it; one that came direct does not. Two days of real traffic answers
-- the question outright, and the column keeps earning afterwards — when mail
-- from a mailbox stops arriving, this is what says which link broke.

alter table sim_mail add column if not exists route text[];

comment on column sim_mail.route is
  'Every recipient address the message arrived with, hops included, oldest hop '
  'first — Delivered-To, To, Cc, X-Forwarded-To. `recipient` holds only the one '
  'that identified the SIM. Use this to see which forwarding path delivered it.';
