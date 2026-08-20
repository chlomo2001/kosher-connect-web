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
-- KC's five refusals, chosen for what they protect:
--   1. anon reading ledger        — the money book
--   2. anon reading customers     — the community's contact details
--   3. authenticated stranger reading another customer's rows — the portal
--      trust boundary (portal users are 'authenticated'; RLS must scope them)
--   4. deleting a ledger row      — the audit trail survives even a
--      compromised client credential
--   5. anon reading any zz_* snapshot or staging table — the undo copies,
--      which carry passport numbers, dates of birth and addresses. Added
--      19 Aug 2026 after the live database was found with 48 of them
--      readable through the publishable key; see the block for the detail.

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

  -- 5 · no snapshot or staging table is readable below service level.
  --
  --     This one is not hypothetical. On 19 Aug 2026 the Supabase advisor
  --     found 48 zz_* tables with RLS off AND a select grant to anon, which
  --     together mean every row was readable by anyone holding the
  --     publishable key — and that key ships in the browser bundle of the
  --     welcome page. Those tables are the worst possible ones to expose:
  --     they are undo snapshots of customers and booking passengers, so they
  --     carry passport numbers, dates of birth, phone numbers and addresses.
  --     20260819021500_lock_down_zz_snapshots.sql closed it and set the rule
  --     for new ones; this asserts the rule held through a restore.
  --
  --     Written as a loop over every zz_% table rather than a list, so a
  --     snapshot taken next month is covered without anyone remembering to
  --     add it here. A list would rot exactly the way the robots.txt
  --     allow-list did.
  declare
    t record;
    leaked text[] := '{}';
  begin
    for t in
      select c.relname
      from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
      where ns.nspname = 'public' and c.relkind = 'r' and c.relname like 'zz\_%'
      order by c.relname
    loop
      begin
        set local role anon;
        execute format('select count(*) from public.%I', t.relname) into n;
        if n > 0 then leaked := array_append(leaked, t.relname); end if;
      exception when insufficient_privilege then null;  -- refusal by grant: good
      end;
      reset role;
    end loop;
    if array_length(leaked, 1) is not null then
      broken := array_append(broken,
        format('anon can READ %s snapshot/staging table(s): %s',
               array_length(leaked, 1), array_to_string(leaked, ', ')));
    end if;
  end;

  if array_length(broken, 1) is null then
    -- The count is stated so a refusal quietly dropped from this file shows up
    -- as a smaller number rather than as the same reassuring word. It was '4'
    -- and stayed '4' when a fifth was added on 19 Aug 2026, which is the whole
    -- argument for saying it out loud.
    raise notice 'REFUSALS: all 5 held.';
  else
    raise warning 'REFUSAL BROKEN: %', array_to_string(broken, ' | ');
  end if;
end $$;

rollback;  -- nothing this script did survives, by construction
