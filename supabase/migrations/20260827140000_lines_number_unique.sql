-- One phone number is one line.
--
-- Shloime found the same number twice in the Phone Rentals inventory on
-- 27 August (+1 845 828 1823, both in Pool 37, both available) and asked why it
-- was possible. Because nothing said it was not: `lines` carried exactly one
-- unique constraint, on `legacy_id`, which is an id this app generates. The
-- number — the thing that identifies a line to the carrier and to the customer
-- — had none.
--
-- Indexed on DIGITS, not on what was typed. "+1 845 828 1823", "1 845 828 1823"
-- and "18458281823" are one line at US Mobile and three different strings here,
-- so a plain UNIQUE(number) would catch only the laziest duplicate.
--
-- Partial, so the many lines with no number yet do not collide with each other.
create unique index if not exists lines_number_digits_uniq
  on lines ((regexp_replace(number, '\D', '', 'g')))
  where number is not null and regexp_replace(number, '\D', '', 'g') <> '';

-- The ICCID deserves the same index and does NOT get one yet, on purpose.
-- Production already holds a pair that would fail it: two lines created 74
-- seconds apart on 27 Aug (19297943933 and 19175443574) both claiming ICCID
-- 89012803331726323915. One of those is wrong and only Shloime knows which, so
-- deleting either from here would be guessing with his stock.
--
-- lib/lineIdentity.mjs refuses new ones today. The index goes on in a follow-up
-- migration once that pair is settled — and a task has been raised so it is not
-- forgotten.
