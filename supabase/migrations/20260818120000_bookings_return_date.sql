-- A return flight is one purchase, not two bookings.
--
-- `bookings` has held a single `travel_date` since the initial schema, which
-- was fine while every booking was typed by hand and the return simply got its
-- own row. Reading confirmations out of the airline's own email made the gap
-- obvious: the mail says both legs, the parser reads both, and the app had
-- nowhere to put the second one — so it went into the notes as prose, where
-- nothing can use it. Owner, 18 Aug: "cant we include roundtrips?!"
--
-- WHY ONE ROW AND NOT TWO. A return is one reference, one price and one
-- booking fee. Splitting it across two bookings would either charge the fee
-- twice or need a rule about which half carries it, and the customer would
-- appear twice in the register for one trip. One row with two dates says what
-- actually happened.
--
-- Nullable, because most of the register is one-way and always will be. Every
-- read that filters on travel_date keeps working untouched: the outbound date
-- is still the date the trip starts.
alter table bookings add column if not exists return_date date;

comment on column bookings.return_date is
  'The return leg of a round trip, when there is one. NULL for a one-way. The '
  'trip STARTS at travel_date — sweeps and reminders key on that; this is what '
  'says when they are back, so a rental or SIM can be checked against it.';

-- Trips that come back before they leave are a typo, not a booking.
alter table bookings drop constraint if exists bookings_return_after_travel;
alter table bookings add constraint bookings_return_after_travel
  check (return_date is null or travel_date is null or return_date >= travel_date);
