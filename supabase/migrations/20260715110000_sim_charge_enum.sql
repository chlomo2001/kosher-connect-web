-- 'sim_charge' ledger entry type — SIM charges (setup / service / replacement /
-- annual / monthly DD / menu) now post to the wallet ledger instead of living
-- only in the sim's client-side history blob, so SIM revenue is finally visible
-- to balances, arrears and cash-up. Separate migration: the enum value must be
-- committed before the sign constraint (next migration) can reference it.
alter type ledger_entry_type add value if not exists 'sim_charge';
