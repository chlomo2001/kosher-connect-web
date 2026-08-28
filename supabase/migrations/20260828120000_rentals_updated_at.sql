-- A rental now says when it last changed, so a browser tab can be told it is
-- behind before it overwrites money.
--
-- The bug this closes (task #48, seen for real on 27 Aug): a rentals payload is
-- the WHOLE array, so a tab left open on a phone in the back of the shop holds
-- a complete copy of every rental as it was when that tab last loaded. Correct
-- a payment at the counter, then let the old tab save anything at all, and its
-- stale amountPaid goes back over the corrected one — and syncRentals' ledger
-- true-up faithfully posts a rental_adjustment to match, reversing money the
-- shop actually received. Teitelbaum's ledger went back to -£90 exactly that
-- way, twice.
--
-- The fix needs a version to compare against, which the table did not have:
-- created_at only says when the rental was written down. updated_at is bumped
-- by the trigger on every UPDATE, the client carries the value it loaded, and
-- lib/tableStore.js refuses a MONEY change that arrives from a copy older than
-- what is stored. Everything else in the payload still saves — the same
-- bargain the charge gate and the double-booking backstop already strike:
-- undo the one dangerous part, report it, never throw away the rest.
--
-- Backfilled to created_at rather than now(): a rental nobody has touched since
-- it was written has not been updated since, and stamping every row with the
-- migration's clock would make every tab open at that moment look stale.

alter table public.rentals
  add column if not exists updated_at timestamptz not null default now();

update public.rentals set updated_at = created_at where updated_at > created_at;

create or replace function public.rentals_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists rentals_touch_updated_at on public.rentals;
create trigger rentals_touch_updated_at
  before update on public.rentals
  for each row
  execute function public.rentals_touch_updated_at();

comment on column public.rentals.updated_at is
  'Bumped on every UPDATE. The client sends back the value it loaded as _rev; a money change arriving from an older copy is refused (see syncRentals).';
