# Supabase Advisor, 19 August 2026 — what each finding actually is

Raised by the owner at 02:13 with a screenshot: *"Advisor found 49 issues"*, four
of them marked **CRITICAL**. This is the verdict on each, and what was done.

## The four criticals were real, and are now closed

**RLS Disabled in Public** on `zz_snapshot_booking_passengers_20260809`,
`zz_snapshot_bookings_20260809`, `zz_snapshot_customers_20260809` and
`zz_snapshot_bookings_reclass_20260810` — and the Advisor was showing four of
what turned out to be **forty-eight**.

The working agreement says to keep an undo snapshot before any bulk data write,
and that has been followed faithfully: 55 `zz_*` tables between 29 July and
12 August. Forty-eight of them had RLS switched off **and** a `SELECT` grant to
`anon`. Those two facts together mean one thing — every row in them was readable
through PostgREST by anyone holding the project's publishable key, and that key
is public by design. It ships in the browser bundle of the welcome page.

What was exposed, by count and column name only (no values are quoted here, in
the migration, or in any log — passport numbers are PII):

| Table | Rows | Columns that matter |
|---|---:|---|
| `zz_snapshot_booking_passengers_20260809` | 125 | `passport_number`, `passport_issue_date`, `passport_expiry`, `dob`, `nationality` |
| `zz_snapshot_customers_20260809` | 740 | `phone`, `email`, `address` (+ `passport_on_file`) |
| 26 further customer/booking snapshots | — | the same contact columns |

The seven snapshots taken between 29 July and 2 August already had RLS on, so
this was a habit that lapsed rather than one that never existed.

**Fixed** — `supabase/migrations/20260819021500_lock_down_zz_snapshots.sql`,
applied to production 19 Aug 02:15. Every `zz_*` table now has RLS enabled and
the `anon` / `authenticated` grants revoked, so they are shut by two independent
mechanisms. Verified after applying: 55 tables, 55 with RLS, **0** readable by
`anon` or `authenticated`, and all 55 still readable by `service_role` — so any
restore from a snapshot still works.

It cannot have broken the app: `lib/db.js` connects with
`SUPABASE_SERVICE_ROLE_KEY`, and `service_role` bypasses RLS.

**Not dropped.** Most of these are long past any useful undo window and ought to
go, but deleting production data is the owner's call, not a migration's. Worth
doing deliberately, oldest first.

## Why the number went UP afterwards, and why that is right

The Advisor now reports more findings, not fewer — and that is the fix working.
Locking a table converts it from **RLS Disabled in Public** (critical, externally
facing) to **RLS Enabled No Policy** (informational). All four criticals are gone.

`RLS Enabled No Policy` × 84 is this database's correct posture, not a backlog.
Every table denies everything by default and is reached only by the server
holding the service-role key, which bypasses RLS. A table with no policy is a
table nobody can read with a public key. Adding permissive policies to silence
the notice would be the actual mistake.

## The two warnings

**`current_staff_role()` is SECURITY DEFINER and callable by `authenticated`.**
Checked, and it is correct as it stands:

```sql
select role from staff_profiles where id = auth.uid()
```

It takes no argument, is keyed on the caller's own `auth.uid()`, and can only
ever return the caller's own role — a portal customer calling it gets null. It
has to be `SECURITY DEFINER` to read `staff_profiles`, which itself has RLS,
and **44 policies across the schema are written in terms of it**. Switching it
to `SECURITY INVOKER` would break every one of them. Left alone deliberately;
this note is the record of that decision.

**Leaked-password protection is off.** Supabase can check new passwords against
HaveIBeenPwned. Worth turning on — Dashboard → Authentication → Policies. Owner
action; there is no API for it.

## Standing change

The `public` schema now carries a comment saying snapshot tables must be created
with RLS on and no grants, so the next bulk write does not quietly reopen this.
