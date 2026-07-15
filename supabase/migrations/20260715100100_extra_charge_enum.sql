-- 'extra_charge' ledger entry type — owner-defined auto extras (custom_charges).
-- Added out-of-band during development. Separate migration: a Postgres enum
-- value must be committed before it can be used, so the sign constraint that
-- references it lives in a later migration (mirrors the 121400 / 121500 split).
alter type ledger_entry_type add value if not exists 'extra_charge';
