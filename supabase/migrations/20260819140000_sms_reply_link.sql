-- Which inbound text an outbound one answers.
--
-- The reply box shipped without recording WHAT it replied to: a reply was
-- logged as an ordinary outbound message, so nothing in the data could say
-- whether a customer's question had been answered. Any "waiting for a reply"
-- count built on top of that would have been guesswork — "some message went to
-- that number afterwards" would let a renewal reminder mark a question answered.
--
-- The link lives on the OUTBOUND row rather than as a flag on the inbound one,
-- so the log stays a record of things that happened instead of a status board
-- that gets rewritten. It also keeps the audit: which message answered which.
--
-- Nullable, because almost every outbound message answers nothing.
alter table email_log
  add column if not exists replies_to uuid references email_log(id) on delete set null;

comment on column email_log.replies_to is
  'For an outbound reply, the inbound email_log row it answers. Null otherwise. '
  'A question counts as answered only when a row pointing at it has status ''sent'' — '
  'held and redirected never reached the customer (see lib/replyQueue.mjs).';

-- The query this exists for is "inbound rows with nothing pointing at them",
-- which reads the column as a filter on a small subset of a growing log.
create index if not exists email_log_replies_to_idx
  on email_log (replies_to) where replies_to is not null;
