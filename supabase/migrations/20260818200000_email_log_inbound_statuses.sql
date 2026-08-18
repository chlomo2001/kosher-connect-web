-- The table never learnt the statuses the code grew. email_log_status_chk
-- allowed only the eight outbound outcomes, so three legitimate writes were
-- bounced by the database and the rows lost:
--   'received' / 'opt_out' — the inbound-SMS endpoint (354d9d0, built 17 Aug);
--     the shop's FIRST real reply (18 Aug) died on this constraint.
--   'invalid' — lib/sms.js files a refused-before-send attempt this way, and
--     has been losing that audit row for the same reason.
alter table email_log drop constraint email_log_status_chk;
alter table email_log add constraint email_log_status_chk check (
  status = any (array[
    'held', 'sent', 'redirected', 'failed', 'suppressed',
    'delivered', 'bounced', 'complained',
    'received', 'opt_out', 'invalid'
  ]::text[])
);
