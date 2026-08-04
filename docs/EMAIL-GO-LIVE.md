# Email go-live — kosher-connect.com (decided 08-04)

**Owner decision:** send from our own domain, **everything configured and
verified, but NOT sendable** until Shloime officially starts using the app.

The code already guarantees "ready but not sendable": `lib/email.js` has a
three-state gate and **HOLD is the default**. With a provider configured and
neither override set, every email is built and logged to `email_log` — and
nothing leaves the building. Sending requires deliberately setting an env var
(`MAIL_LIVE=true`), which is the one step this runbook tells you NOT to do.

## Setup (one sitting, ~20 minutes + DNS wait)

1. **Create a Resend account** — resend.com, free tier (100/day, 3,000/month —
   plenty for receipts and sign-in links). Sign up with a business Google
   account, not a personal one.
2. **Add the sending domain**: Resend dashboard → Domains → Add →
   **`mail.kosher-connect.com`** (a subdomain keeps the root domain's email
   reputation separate from anything else, and matches the app's example
   `MAIL_FROM`). Pick the **EU (Ireland)** region.
3. **Add the DNS records Resend shows** (an MX, an SPF TXT, and DKIM records —
   exact values only appear after step 2). kosher-connect.com's DNS lives
   where the domain was connected (Vercel → the team's Domains page → DNS
   records). Add them exactly as shown; then hit Verify in Resend. Usually
   minutes, can take a few hours.
4. **Create an API key** in Resend (Sending access is enough) and put TWO env
   vars into Vercel (project → Settings → Environment Variables, production):
   - `RESEND_API_KEY` = `re_…`
   - `MAIL_FROM` = `Kosher Connect <hello@mail.kosher-connect.com>`

   **Do NOT set `MAIL_LIVE` or `MAIL_TEST_TO`.** Their absence IS the hold.
5. **Bounce webhook**: Resend dashboard → Webhooks → add
   `https://app.kosher-connect.com/api/email/webhook` (events: bounced,
   complained). Hard bounces land in `email_suppressions` and are refused
   before any future send.
6. **Redeploy** (any push does it) and check `/api/health` — email should
   report `configured: true, provider: resend, mode: hold`.

## When Shloime officially starts (the un-hold, in two steps)

1. Set `MAIL_TEST_TO=<owner email>` for a day — every receipt/link redirects
   to that one inbox so you can see exactly what customers would get.
2. Happy? Remove `MAIL_TEST_TO`, set `MAIL_LIVE=true`, redeploy. Done.

## Notes

- Replies to `hello@mail.kosher-connect.com` are not received anywhere — the
  templates point people at support@kosher-connect.com / the shop number, and
  the support@ alias already forwards (Settings → Email addresses).
- Every attempt in every mode is recorded in `email_log`, so "what would have
  been sent while on hold" is queryable before flipping live.
