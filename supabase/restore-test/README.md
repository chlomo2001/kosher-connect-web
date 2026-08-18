# Restore test — what has and has NOT been proven

Dated **18 August 2026** (port item A3, built from the brief alone — the source
repo is not reachable from this environment).

A backup nobody has restored is a belief. This directory is the restore test in
two halves, and only one of them has run. **Do not read this page as "the
backup is proven." It is not.**

## The half that RAN (18 Aug 2026, in the development container)

The harness itself was built and exercised end-to-end against a local
PostgreSQL 16.13 pair — `live_sim` seeded from `seed.sql`, `restored_sim`
produced by `pg_dump | psql`, no production data anywhere near it:

- **Identical pair → all 19 aspects PASS** (the brief said 18; functions and
  triggers are counted separately here).
- **Planted drift → caught.** Three structural/data mutations (a revoked
  grant, one penny changed on one ledger row, a dropped NOT NULL) failed
  exactly aspects 2, 9 and 16. A second drill dropped an RLS policy, disabled
  RLS and over-granted — aspects 14, 15 and 16 failed.
- **`refusals.sql` exercised on BOTH sides**: all four refusals hold on a
  faithful copy, and on the deliberately broken copy it named the two broken
  ones (`anon can READ customer rows`, `authenticated-with-no-claim can READ
  customer rows`) while the still-guarded two kept holding. Exercising the
  broken path found and fixed a real bug in the script (the report crashed at
  the exact moment it had something to report).

So: the MEASURING INSTRUMENT is proven. The thing it is meant to measure is
not yet measured.

## The half that is HELD FOR THE OWNER

Restoring the real backup needs the Supabase account, which the unattended run
does not have and should not have. The live half is, deliberately together in
one sitting:

1. In the Supabase dashboard, create a scratch project (never touch Kc-Live).
2. Restore Kc-Live's latest backup into it (Dashboard → Database → Backups →
   restore to the scratch project).
3. Run the comparison, read-only on both sides:
   `./compare.sh "$KC_LIVE_URL" "$SCRATCH_URL"`
4. Run the refusals against the scratch copy:
   `psql "$SCRATCH_URL" -X -f refusals.sql`
5. Expect: 19 PASS and `REFUSALS: all 4 held.` Anything else is a finding
   about the BACKUP, and it was learnt on a scratch project instead of on the
   day the shop actually needed the restore.
6. Delete the scratch project, note the date here, and this page's headline
   changes from "belief" to "proven as of <date>".

## Files

| file | is |
|---|---|
| `compare.sh` | 19-aspect live-vs-restored comparison: tables, columns, PKs/FKs, unique + check constraints, indexes, row counts, per-row md5 digests, sequence positions, views, functions, triggers, RLS flags, RLS policies, **grants**, extensions, enum/custom types, the migrations ledger. Read-only; exit code = failed aspects. |
| `refusals.sql` | The four things a restored KC database must still refuse: anon reading `ledger`, anon reading `customers`, a signed-in stranger reading another customer's rows, deleting a `ledger` row. Runs in one rolled-back transaction — it cannot alter what it tests. |
| `seed.sql` | Rehearsal fixture for the harness itself — a miniature stand-in (NOT KC's schema) echoing the money tables, with one of everything the aspects measure. |
