# Data layer (transitional): blob store → relational tables

The front end (`public/main.js`) is untouched — it still exchanges the same
app-shaped JSON with the same API routes. What changed is what the routes do
with it.

## Modes (selected at boot in `lib/db.js`)

| Env present | Mode | Behaviour |
|---|---|---|
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | **tables** | Reads/writes the relational schema (`supabase/migrations/`) |
| `SUPABASE_URL` + `SUPABASE_ANON_KEY` only | store | Previous behaviour: key-value `store` table |
| neither | files | Previous behaviour: gitignored `./data/*.json` |

Set `DATA_BACKEND=store` to force the old path even with a service key
(instant rollback switch). The service key is server-only — it never reaches
the browser; RLS remains intact for every other client. The API routes are the
trusted operator surface until staff auth lands.

## How tables mode works

- **Full fidelity:** each row's `legacy_extras` jsonb holds the complete app
  object; GET returns it verbatim — exact round-trip guaranteed
  (`lib/mappers.js` is pure and unit-tested).
- **Relational projection:** typed columns (FKs, enums, dates, money) are
  populated on every save, and the per-item A-series state is projected into
  `rental_items`. This is the dataset the post-cutover app will read directly.
- **Sync semantics:** customers keep per-record CRUD; rentals/phones/sims keep
  their whole-array POST, implemented as diff-sync (upsert by `legacy_id`,
  delete rows missing from the payload). Rentals/sims whose customer/phone
  can't be resolved are skipped and reported in the response
  (`{skipped:[...]}`) — the app re-sends them on the next save, so a skip
  self-heals once the parent syncs.
- **Cascade:** customer DELETE removes their rentals (+items via FK cascade)
  and sims first — mirroring the app's own in-memory cascade and avoiding the
  race with its fire-and-forget saves.
- Mapping notes: `phones.country==='UK'` splits into `UK-Intl`/`UK-UKmins` by
  `ukPlan`; SIM `paymentType` `through-me`/`direct` → `paid_by` `kc`/`customer`;
  colliding normalized email/phone uniques retry with the normalized keys
  nulled (raw values stay in extras).

## One-shot import (blob store → tables)

```
SUPABASE_URL=https://<target>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<target service key> \
SOURCE_SUPABASE_URL=https://<source>.supabase.co \
SOURCE_SUPABASE_KEY=<source key> \
node scripts/import-legacy.mjs
```

Uses the same mappers/sync code as the live routes; idempotent (re-run
refreshes). Omit `SOURCE_*` to import from local `./data/*.json`.

## Cutover checklist

1. Point staging env at Kc-staging with the service key; run the import from
   the production `store`; click through the app against staging.
2. Repeat for production (restore Kc-production, run migrations, import).
3. Later: staff auth (step 1), then move money logic onto the ledger (step 3),
   then teach main.js to read typed columns and drop `legacy_extras` +
   the `store` table.

## Staff authentication (added with the auth gate)

When tables mode is on, the app requires login. Model: Supabase Auth
(email/password) + `staff_profiles` decides who is staff and their role.
Session = httpOnly cookie (access + refresh token); every API route verifies
it server-side (`lib/auth.js` `withStaff`) and silently refreshes expired
tokens; the browser is bounced to `/login` on any 401.

**Bootstrap:** the first user ever to log in becomes the owner. Create the
account in Supabase Dashboard → Authentication → Users → *Add user* (email +
password, auto-confirm), then sign in at `/login`. Add helpers the same way,
then insert their `staff_profiles` row with role `helper` (owner-run SQL or a
future team screen).

Blob/file mode (no service key) skips the gate entirely, so local dev and the
legacy deployment behave as before.
