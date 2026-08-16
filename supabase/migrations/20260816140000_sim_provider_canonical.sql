-- One spelling per carrier, on the data that already exists.
--
-- SIM provider is free text typed at the counter and it drifted: `lebara` 189
-- rows against `Lebara` 315, `three` 76 against `Three` 21, and four spellings
-- of giffgaff. Every per-provider count came out wrong unless the caller
-- remembered to lowercase, and the SIMs list showed the same carrier twice.
--
-- TWO fields, not one. `sims.provider` is the typed column, but the app reads
-- SIMs back from `legacy_extras` (tableStore.listApp → mappers.rowToApp), so
-- the blob is what staff actually see, and it is the one that had drifted
-- furthest — 49 rows already had a tidy column over a raw blob. Both are set
-- here, from the blob's value, because the blob is the app's truth.
--
-- The mapping is EXACT-MATCH and mirrors lib/simProvider.mjs, which now
-- canonicalises on write so this cannot drift back. Values that carry
-- information rather than a carrier name are deliberately absent from the
-- list and are left exactly as they are:
--
--     'Lebara Local x2'                 two lines on one record
--     'Lebara .. 1pmobile'              moved between carriers
--     'Lebara International'            a plan, not a carrier
--     'Three + Israeli number'          a second line
--     'US Mobile SIM card + UK number'  a second line
--     'GCS336096'  'sichul'  'ukraine 24'  'Bussiness phone system + internet'
--
-- Flattening those into "Lebara"/"Three" would delete lines the shop bills
-- for. 420 rows change; 377 keep the text they have.

-- Undo snapshot, taken before the write (owner rule for bulk data changes).
-- Restore with:
--   update sims s set provider = b.provider,
--                     legacy_extras = jsonb_set(s.legacy_extras, '{provider}',
--                                               to_jsonb(b.extras_provider))
--   from sims_provider_backup_20260816 b where b.id = s.id;
create table sims_provider_backup_20260816 as
  select id, legacy_id, provider, legacy_extras->>'provider' as extras_provider
  from sims;

alter table sims_provider_backup_20260816 enable row level security;

update sims s
   set provider = m.canon,
       legacy_extras = jsonb_set(s.legacy_extras, '{provider}', to_jsonb(m.canon))
  from (values
    ('1pmobile',           '1pMobile'),
    ('asda',               'Asda Mobile'),
    ('asda mobile',        'Asda Mobile'),
    ('giffgaf',            'giffgaff'),
    ('Giffgaff',           'giffgaff'),
    ('giffgaft',           'giffgaff'),
    ('lebara',             'Lebara'),
    ('redpoced',           'Red Pocket'),
    ('redpocked',          'Red Pocket'),
    ('smarty',             'Smarty'),
    ('talkhome',           'Talk Home'),
    ('tello',              'Tello'),
    ('three',              'Three'),
    ('us mobile',          'US Mobile'),
    ('US mobile',          'US Mobile'),
    ('US mobile SIM card', 'US Mobile')
  ) as m(raw, canon)
 where s.legacy_extras->>'provider' = m.raw;
