# Email — ALREADY CONFIGURED (corrected 08-04, verified against /api/health)

An earlier version of this file described a setup that was already done —
context lost to a session boundary, owner caught it. The live truth, from
`/api/health` on production (04 Aug):

    email: { configured: true, provider: resend, mode: test }
    sms:   { configured: true, provider: twilio, mode: test }

Resend is fully set up — account, domain, keys in Vercel — and the gate sits
in **TEST mode**: every email the app generates is redirected to the test
inbox (`MAIL_TEST_TO`). No customer can receive anything. SMS is in the same
state via Twilio.

**Owner rule (08-04): it stays this way until Shloime officially starts
using the app.** TEST mode satisfies that by construction.

## The only remaining step — the un-hold, on the owner's word

1. Remove `MAIL_TEST_TO` from Vercel env.
2. Set `MAIL_LIVE=true`.
3. Redeploy. `/api/health` should read `mode: live`.

Same two-var pattern for SMS when its day comes (`SMS_TEST_TO` → live flag —
check `lib/sms.js` for the exact names before flipping).

Everything sent in any mode is recorded in `email_log`, so what customers
*would* have received during test/hold is queryable before going live.
