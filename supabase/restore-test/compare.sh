#!/usr/bin/env bash
# Does the restored database ACTUALLY equal the live one? (port item A3)
#
#   usage: compare.sh <LIVE_URL> <RESTORED_URL>
#
# A backup nobody has restored is a belief. This script is the measuring half
# of the restore test: point it at the live database and at a scratch project
# the backup was restored into, and it compares them across 19 aspects —
# structure, data, and crucially the parts restores quietly lose: GRANTS, row
# level security, policies, sequence positions. Every aspect prints PASS or
# FAIL with a diff; exit code is the number of failed aspects.
#
# It only ever READS. Run it against production without fear; never run a
# restore INTO production.

set -u
LIVE="${1:?usage: compare.sh <LIVE_URL> <RESTORED_URL>}"
RESTORED="${2:?usage: compare.sh <LIVE_URL> <RESTORED_URL>}"

Q() { psql "$1" -X -q -A -t -v ON_ERROR_STOP=1 -c "$2" 2>&1; }
FAILS=0
ASPECT=0

check() {  # check <name> <sql>
  ASPECT=$((ASPECT + 1))
  local name="$1" sql="$2" a b
  a="$(Q "$LIVE" "$sql")" ; b="$(Q "$RESTORED" "$sql")"
  if [ "$a" = "$b" ]; then
    printf '%2d  PASS  %s\n' "$ASPECT" "$name"
  else
    FAILS=$((FAILS + 1))
    printf '%2d  FAIL  %s\n' "$ASPECT" "$name"
    diff <(printf '%s\n' "$a") <(printf '%s\n' "$b") | sed 's/^/        /' | head -20
  fi
}

#  1 · tables
check "tables (public)" \
  "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1"

#  2 · columns — name, type, nullability, default
check "column definitions" \
  "select table_name||'.'||column_name||' '||data_type||' null='||is_nullable||' default='||coalesce(column_default,'-') from information_schema.columns where table_schema='public' order by table_name, ordinal_position"

#  3 · primary keys
check "primary keys" \
  "select conrelid::regclass::text||' '||conname||' '||pg_get_constraintdef(oid) from pg_constraint where contype='p' and connamespace='public'::regnamespace order by 1"

#  4 · foreign keys
check "foreign keys" \
  "select conrelid::regclass::text||' '||conname||' '||pg_get_constraintdef(oid) from pg_constraint where contype='f' and connamespace='public'::regnamespace order by 1"

#  5 · unique constraints
check "unique constraints" \
  "select conrelid::regclass::text||' '||conname||' '||pg_get_constraintdef(oid) from pg_constraint where contype='u' and connamespace='public'::regnamespace order by 1"

#  6 · check constraints (the email_log status incident, 18 Aug, was one of these)
check "check constraints" \
  "select conrelid::regclass::text||' '||conname||' '||pg_get_constraintdef(oid) from pg_constraint where contype='c' and connamespace='public'::regnamespace order by 1"

#  7 · indexes
check "indexes" \
  "select indexdef from pg_indexes where schemaname='public' order by 1"

#  8 · row counts, every table
ROWSQL="select string_agg(t.relname||'='||xpath_count.n::text, E'\n' order by t.relname) from (select relname from pg_class join pg_namespace n on n.oid=relnamespace where nspname='public' and relkind='r') t, lateral (select (xpath('/row/cnt/text()', query_to_xml('select count(*) as cnt from public.'||quote_ident(t.relname), false, true, '')))[1]::text::bigint n) xpath_count"
check "row counts (every public table)" "$ROWSQL"

#  9 · per-row md5 digest, every table (order-independent: md5s aggregated sorted)
DIGSQL="select string_agg(t.relname||'='||coalesce(d.digest,'empty'), E'\n' order by t.relname) from (select relname from pg_class join pg_namespace n on n.oid=relnamespace where nspname='public' and relkind='r') t, lateral (select (xpath('/row/d/text()', query_to_xml('select md5(coalesce(string_agg(h,'''' order by h),'''')) as d from (select md5(x::text) h from public.'||quote_ident(t.relname)||' x) rows', false, true, '')))[1]::text digest) d"
check "per-row md5 digest (every public table)" "$DIGSQL"

# 10 · sequences and their positions (a restore that resets these makes the
#      next insert collide with an existing key)
check "sequences and last_value" \
  "select schemaname||'.'||sequencename||' last='||coalesce(last_value::text,'-') from pg_sequences where schemaname='public' order by 1"

# 11 · views
check "views" \
  "select table_name||': '||view_definition from information_schema.views where table_schema='public' order by 1"

# 12 · functions and triggers
check "functions and triggers" \
  "select p.proname||' '||md5(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by 1"
check "trigger definitions" \
  "select tgname||' on '||tgrelid::regclass::text||' '||md5(pg_get_triggerdef(oid)) from pg_trigger where not tgisinternal and tgrelid::regclass::text not like 'pg_%' order by 1"

# 13 · RLS enabled flags — a table restored without RLS is wide open
check "row-level security enabled flags" \
  "select relname||' rls='||relrowsecurity::text||' force='||relforcerowsecurity::text from pg_class join pg_namespace n on n.oid=relnamespace where nspname='public' and relkind='r' order by 1"

# 14 · RLS policies — names, roles, using/check expressions
check "RLS policies" \
  "select schemaname||'.'||tablename||' '||policyname||' cmd='||cmd||' roles='||array_to_string(roles,',')||' using='||coalesce(qual,'-')||' check='||coalesce(with_check,'-') from pg_policies where schemaname='public' order by tablename, policyname"

# 15 · grants — what anon/authenticated/service_role may do. THE aspect
#      restores lose most often, and the one that turns into a breach.
check "table grants" \
  "select table_name||' '||grantee||' '||privilege_type from information_schema.role_table_grants where table_schema='public' order by 1"

# 16 · extensions
check "extensions" \
  "select extname||' '||extversion from pg_extension order by 1"

# 17 · custom types and enum values (order matters for enums)
check "custom types / enums" \
  "select t.typname||': '||coalesce(string_agg(e.enumlabel, ',' order by e.enumsortorder),'-') from pg_type t left join pg_enum e on e.enumtypid=t.oid join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype in ('e','c') group by t.typname order by 1"

# 18 · the migrations ledger — a restore that loses it makes every future
#      deploy re-apply history
check "migrations ledger" \
  "select coalesce(string_agg(version||' '||coalesce(name,''), E'\n' order by version), 'no supabase_migrations schema') from supabase_migrations.schema_migrations"

echo
if [ "$FAILS" -eq 0 ]; then
  echo "RESTORE COMPARE: all $ASPECT aspects match."
else
  echo "RESTORE COMPARE: $FAILS of $ASPECT aspects DIFFER — the backup does not faithfully restore."
fi
exit "$FAILS"
