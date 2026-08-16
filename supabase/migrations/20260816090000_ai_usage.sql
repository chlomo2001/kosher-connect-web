-- What the AI features actually cost, metered by us.
--
-- Google does not report spend or quota back through the generateContent
-- endpoint — usage lives in Cloud billing, behind a service account with far
-- wider reach than the API key this app holds. But every Gemini response
-- carries `usageMetadata` with the exact token counts for that call, and until
-- now we threw it away.
--
-- So the app meters itself. One row per successful call, tagged with the
-- feature that spent it, which is the breakdown that answers the real question:
-- not "what did Gemini cost" but "what is the assistant costing me, and is the
-- OCR reader worth it".
--
-- Deliberately NOT a ledger: no money, no customer, nothing to reconcile. If a
-- write fails the AI call still succeeds — a meter must never be able to break
-- the thing it measures.
create table ai_usage (
  id             bigserial primary key,
  at             timestamptz not null default now(),
  -- The caller's own label ('AI reader', 'reply drafter', 'assistant planner',
  -- 'task prioritiser'), passed straight through from geminiGenerate.
  feature        text not null,
  -- Which model actually answered. The client falls through a candidate list
  -- when Google rotates names, so this is not a constant.
  model          text not null,
  prompt_tokens  integer not null default 0,
  output_tokens  integer not null default 0,
  total_tokens   integer not null default 0
);

-- Every read is "this period, by feature", newest first.
create index ai_usage_at_idx on ai_usage (at desc);

-- Same posture as the other operational tables: the service role writes from
-- the API routes, and nothing reaches it through the anon/publishable key.
alter table ai_usage enable row level security;
