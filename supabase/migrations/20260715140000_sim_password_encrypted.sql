-- SIM carrier passwords are encrypted at rest (AES-256-GCM, app-level). The
-- ciphertext token lives here; plaintext is stripped from legacy_extras and is
-- never returned on a normal read. Nullable — a SIM may have no password, and
-- with no encryption key configured nothing is stored here at all.
alter table sims add column if not exists password_encrypted text;
