-- 'seen' — a text taken off the waiting list without a reply.
--
-- Shipped in the app on 30 Aug (task #71, "Seen, nothing needed") and NOT
-- shipped here, so every press was refused by the database. What the person at
-- the counter saw was "Could not reach the server." — the server was reached,
-- PostgREST rejected the write on this constraint, the throw landed outside the
-- handler's try, and a 500 HTML page came back where JSON was expected.
--
-- This is the second time. 20260818200000_email_log_inbound_statuses.sql widened
-- the same constraint for 'received', 'opt_out' and 'invalid', and its own note
-- records that the shop's FIRST real inbound reply died here. A status the code
-- writes and the table has never heard of is the failure mode of this column;
-- test/emailLogStatus.test.mjs now holds the two lists against each other so the
-- third time is caught before it ships.
alter table email_log drop constraint email_log_status_chk;
alter table email_log add constraint email_log_status_chk check (
  status = any (array[
    'held', 'sent', 'redirected', 'failed', 'suppressed',
    'delivered', 'bounced', 'complained',
    'received', 'opt_out', 'invalid',
    'seen'
  ]::text[])
);
