-- Undoing a carrier-mail match, and making the undo stick.
--
-- Owner, 19 Aug: "any way to undo a non needs a human match?" There was not.
-- The endpoint had exactly two writes — pair, and dismiss — and pairing
-- requires a SIM id, so nothing could send a message back to the queue.
--
-- It matters most for the matches nobody chose. Of 36 filed messages, 33 were
-- filed automatically (28 by address, 4 by address+number, 1 by number) and
-- only 3 were picked by a person. A human pick is a deliberate act somebody
-- would remember; an automatic one happens silently, so a wrong one sits on the
-- wrong customer's line indefinitely with nobody prompted to look.
--
-- `unpaired_at` is what makes the undo hold. Clearing sim_id alone would put
-- the message back into exactly the state the nightly sweep hunts for
-- (resolved_at is null AND sim_id is null), so the next run would re-file it on
-- the same wrong SIM and the undo would quietly undo itself. The sweep skips
-- anything a person has unfiled.

alter table public.sim_mail add column if not exists unpaired_at timestamptz;
alter table public.sim_mail add column if not exists unpaired_by text;

comment on column public.sim_mail.unpaired_at is
  'Set when a person undid a match. The nightly re-pair pass skips these: a human has said the automatic answer was wrong, and re-deciding it would overrule them.';
