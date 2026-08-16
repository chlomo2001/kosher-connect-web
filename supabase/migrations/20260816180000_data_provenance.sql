-- Where every record came from, and whether a human has since vouched for it.
--
-- The shop's data was loaded from spreadsheets in July and August, and NOTHING
-- recorded that. `created_by` exists on customers but the POST route never sets
-- it, so all 609 rows read as "nobody created this" — the column cannot tell an
-- imported row from one typed at the counter.
--
-- What can tell them apart is the shape of the writes. An import lands hundreds
-- of rows inside a single minute; a person at the counter produces one. The
-- clustering is unambiguous here — customers arrived in eleven batches of 11 to
-- 104 rows, against five lone rows spread over a month:
--
--     2026-07-13 17:30   104 rows        2026-07-14 19:07   1 row
--     2026-07-13 17:32   100 rows        2026-07-26 12:36   1 row
--     2026-07-13 17:29    80 rows        2026-08-06 15:57   1 row
--     …                                   …
--
-- So `data_source` is derived from that: ten or more rows in one minute is an
-- import, anything sparser is a person. It is a JUDGEMENT, not a fact the
-- system recorded, which is exactly why it is written into a column that can be
-- corrected rather than re-derived on the fly by every reader.
--
-- `verified_at` is the point of the exercise (owner, 08-16): imported data has
-- never been checked by a human against reality, and until someone says "yes,
-- this is right", it is a spreadsheet's word for it. Manual rows are left with
-- data_source = 'app' and never enter the queue — a person typed them already.
--
-- From here on new rows should set data_source explicitly; the default is
-- 'app', because everything the API writes IS a person doing something.

alter table customers        add column data_source text not null default 'app',
                             add column verified_at timestamptz,
                             add column verified_by uuid references staff_profiles(id);
alter table sims             add column data_source text not null default 'app',
                             add column verified_at timestamptz,
                             add column verified_by uuid references staff_profiles(id);
alter table bookings         add column data_source text not null default 'app',
                             add column verified_at timestamptz,
                             add column verified_by uuid references staff_profiles(id);
alter table virtual_numbers  add column data_source text not null default 'app',
                             add column verified_at timestamptz,
                             add column verified_by uuid references staff_profiles(id);

-- Ten rows in one minute = a machine wrote them.
update customers c set data_source = 'import'
  from (select id from (select id, count(*) over (partition by date_trunc('minute', created_at)) n
                        from customers) t where n >= 10) b where b.id = c.id;
update sims s set data_source = 'import'
  from (select id from (select id, count(*) over (partition by date_trunc('minute', created_at)) n
                        from sims) t where n >= 10) b where b.id = s.id;
update bookings k set data_source = 'import'
  from (select id from (select id, count(*) over (partition by date_trunc('minute', created_at)) n
                        from bookings) t where n >= 10) b where b.id = k.id;
update virtual_numbers v set data_source = 'import'
  from (select id from (select id, count(*) over (partition by date_trunc('minute', created_at)) n
                        from virtual_numbers) t where n >= 10) b where b.id = v.id;

-- The queue read: "imported, nobody has confirmed it yet", oldest first.
create index customers_unverified_idx on customers (created_at)
  where data_source = 'import' and verified_at is null;
create index sims_unverified_idx on sims (created_at)
  where data_source = 'import' and verified_at is null;
create index bookings_unverified_idx on bookings (created_at)
  where data_source = 'import' and verified_at is null;
create index virtual_numbers_unverified_idx on virtual_numbers (created_at)
  where data_source = 'import' and verified_at is null;
