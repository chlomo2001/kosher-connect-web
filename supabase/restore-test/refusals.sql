-- What the restored database must REFUSE (port item A3).
--
-- Matching structure proves the backup restored; these prove the restored
-- database still says NO where no is the point. Run with a superuser-ish
-- connection (it flips roles itself):
--
--   psql "$RESTORED_URL" -X -f refusals.sql
--
-- Every block sets the role an attacker would hold, tries the thing, and
-- reports REFUSED (good) or 'REFUSAL BROKEN' (the restore lost a guard —
-- stop and find out which aspect of compare.sh missed it). The script never
-- commits: everything runs inside one rolled-back transaction, so it cannot
-- damage the scratch database it is testing.
--
-- KC's four refusals, chosen for what they protect:
--   1. anon reading ledger        — the money book
--   2. anon reading customers     — the community's contact details
--   3. authenticated stranger reading another customer's rows — the portal
--      trust boundary (portal users are 'authenticated'; RLS must scope them)
--   4. deleting a ledger row      — the audit trail survives even a
--      compromised client credential

\set ON_ERROR_STOP off
begin;

do $$
declare
  n bigint;
  broken text[] := '{}';
begin
  -- 1 · anon must not read the ledger
  begin
    set local role anon;
    execute 'select count(*) from public.ledger' into n;
    if n > 0 then broken := array_append(broken, 'anon can READ ledger rows'); end if;
  exception when insufficient_privilege then null;  -- refusal by grant: good
  end;
  reset role;

  -- 2 · anon must not read customers
  begin
    set local role anon;
    execute 'select count(*) from public.customers' into n;
    if n > 0 then broken := array_append(broken, 'anon can READ customer rows'); end if;
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- 3 · a signed-in stranger must not read another customer's rows.
  --     'authenticated' with no matching JWT claim must see NOTHING —
  --     RLS scopes portal reads to the caller's own customer id.
  begin
    set local role authenticated;
    execute 'select count(*) from public.customers' into n;
    if n > 0 then broken := array_append(broken, 'authenticated-with-no-claim can READ customer rows'); end if;
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- 4 · nobody below service level deletes from the ledger
  begin
    set local role authenticated;
    execute 'delete from public.ledger';
    get diagnostics n = row_count;
    if n > 0 then broken := array_append(broken, 'authenticated can DELETE ledger rows'); end if;
  exception when insufficient_privilege then null;
  end;
  reset role;

  if array_length(broken, 1) is null then
    raise notice 'REFUSALS: all 4 held.';
  else
    raise warning 'REFUSAL BROKEN: %', array_to_string(broken, ' | ');
  end if;
end $$;

rollback;  -- nothing this script did survives, by construction
