# Green-Keeper — loop state log

The loop's memory. It is read at the start of every run and appended at the
end, so a run **resumes** instead of starting from scratch. Never rewrite
history — append a new dated entry each run.

## Standing context (edit by hand as things change)
- Base branch the loop guards: `claude/branch-status-check-ez7s3t`
- Do-not-touch without human sign-off (money / auth / payments / schema):
  `lib/money.mjs`, `lib/stripe.js`, `pages/api/charge-card.js`,
  `pages/api/portal/pay.js`, `pages/api/stripe/**`, `pages/api/auth/**`,
  `supabase/migrations/**`. The loop may *propose* changes here but must open
  the PR as **draft**, labelled `needs-human`, and never mark it ready.
- Known-flaky / expected noise: the `MODULE_TYPELESS_PACKAGE_JSON` warning from
  `lib/mappers.js` is benign — not a failure.

## Metric to watch (the article's real one)
`cost per accepted change` — track accepted vs proposed below. If the
accepted rate drops under 50%, tighten the skill before adding a second loop.

| date | trigger | action taken | gate result | PR | accepted? |
|------|---------|--------------|-------------|-----|-----------|
| _seed_ | manual | scaffold created, gate proven green (32/32, both TZ) | PASS | — | n/a |

## Open threads for the next run
- (none yet)
