-- Part 2: 'virtual_number' joins the money-out list of the ledger sign
-- constraint (separate migration — the enum value must be committed first).

alter table ledger drop constraint ledger_amount_sign;
alter table ledger add constraint ledger_amount_sign check (
  case
    when entry_type in ('top_up', 'payment', 'refund', 'rental_void')
      then amount > 0
    when entry_type in ('rental', 'rental_loss', 'sim_annual', 'sim_additional',
                        'sim_replacement', 'sim_service', 'repair',
                        'online_service', 'booking', 'phone_sale', 'stock_sale',
                        'virtual_number')
      then amount < 0
    else true  -- rental_adjustment, manual_adjustment: either direction
  end
);
