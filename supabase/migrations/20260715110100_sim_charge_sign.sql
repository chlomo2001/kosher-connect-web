-- 'sim_charge' joins the money-out (amount < 0) list of the ledger sign check —
-- SIM charges are always debits (settled later by a wallet payment).
alter table ledger drop constraint ledger_amount_sign;
alter table ledger add constraint ledger_amount_sign check (
  case
    when entry_type in ('top_up', 'payment', 'refund', 'rental_void')
      then amount > 0
    when entry_type in ('rental', 'rental_loss', 'sim_annual', 'sim_additional',
                        'sim_replacement', 'sim_service', 'repair',
                        'online_service', 'booking', 'phone_sale', 'stock_sale',
                        'virtual_number', 'extra_charge', 'sim_charge')
      then amount < 0
    else true  -- rental_adjustment, manual_adjustment: either direction
  end
);
