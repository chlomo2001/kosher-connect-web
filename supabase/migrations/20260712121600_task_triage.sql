-- Interactive task triage:
--   snoozed_until       — postponed tasks leave the Now/Next lanes until then
--   suggestion_rejected — the (db-style) priority the user rejected, so the
--                         same suggestion is not re-offered; a NEW suggestion
--                         (situation escalated) shows again

alter table tasks
  add column if not exists snoozed_until date,
  add column if not exists suggestion_rejected text
    check (suggestion_rejected in ('low', 'medium', 'high'));
