-- After-cap day rate (owner decision, 17 Aug 2026).
--
-- Until now a rental that ran past the cap window simply bought another whole
-- month: the cap was multiplied by the number of 30-day windows the hire
-- spanned, so a 35-day USA hire cost 2 × £50 = £100.
--
-- The shop does not charge that. Past the first window every further day is a
-- flat £2, and each window is still capped in its own right, so:
--
--   USA · £3/day · min £20 · cap £50/30d · after-cap £2
--     30 days → £50    35 days → £60    65 days → £110
--
-- Per rate row rather than one global number, so a country whose costs differ
-- can be set on its own; £2 is the default every existing row starts at, which
-- is the figure the owner named for all of them today.
--
-- NOT NULL with a default: a null here would mean "no after-cap rate", which
-- lib/rentalMath.mjs reads as the OLD behaviour — correct as a fallback for an
-- unconfigured rate, but not something a row in this table should ever be.

alter table rental_rates
  add column if not exists after_cap_per_day numeric(10, 2) not null default 2;

comment on column rental_rates.after_cap_per_day is
  'Per-day charge for every cap window after the first. Each window is still clamped to cap.';
