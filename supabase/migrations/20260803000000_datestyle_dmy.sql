-- British day-first date parsing (sweep 2026-08-02 #22).
--
-- DateStyle was 'ISO, MDY', so any slash-format string that slipped into a
-- date column parsed American: '08/07/2026' (8 July to everyone in this shop)
-- landed as 7 August. The API routes now validate dates to ISO yyyy-mm-dd
-- before writing, so ambiguous strings should never reach Postgres — this is
-- the backstop that makes one that does parse British instead of American.
--
-- Set on the database (covers every new connection) and on the roles
-- PostgREST logs in as, so a role-level setting can't shadow it.

alter database postgres set datestyle to 'ISO, DMY';
alter role authenticator set datestyle to 'ISO, DMY';
alter role postgres set datestyle to 'ISO, DMY';
