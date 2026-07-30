# Owner setup — main domain, sign-in email, Google consent screen

Written 30/07/2026. These three need dashboard access (Vercel, Supabase, Google
Cloud) and a registrar login, so they can't be done from the codebase. Each
section is in the order the steps must happen.

---

## 1. Connect the main domain (kosher-connect.com)

**Where things stand today** (DNS checked 30/07/2026):

| Host | Resolves to | That is |
|---|---|---|
| `app.kosher-connect.com` | 216.198.79.65, 64.29.17.65 | Vercel — this is the app, working |
| `kosher-connect.com` | 75.2.60.5 | Netlify's load balancer — **not** our Vercel project |
| `www.kosher-connect.com` | 18.208.88.157, 98.84.224.111 | AWS — a third host again, not Vercel |

Only `app.kosher-connect.com` is attached to the Vercel project. The apex and
`www` point somewhere else entirely, so whatever is on them today is served by
another account.

**Before changing anything:** open `https://kosher-connect.com` and
`https://www.kosher-connect.com` and see what is actually there. If an old site
is live on them, repointing the DNS takes it down. That is the one genuinely
irreversible-feeling step here, so it wants a decision, not a default.

**Decide what the main domain should serve.** Two sane options:

* **Redirect** — `kosher-connect.com` and `www` both 301 to
  `app.kosher-connect.com`. One site, one set of URLs, no SEO split. Simplest.
* **Serve the shop site directly** — the main domain shows the public welcome
  page, `app.` stays the staff app. Nicer for customers ("kosher-connect.com"
  on a business card), and it is what most shops do.

**Steps once decided:**

1. Vercel → project `kosher-connect-web` → Settings → Domains → **Add**
   `kosher-connect.com`, then `www.kosher-connect.com`.
2. Vercel then shows the exact records to create — an `A` record for the apex
   and a `CNAME` for `www`. Use the values Vercel shows on the day; they differ
   per account and change over time, so don't copy them from anywhere else.
3. At the registrar (wherever kosher-connect.com's DNS is hosted), replace the
   existing apex `A` record (currently 75.2.60.5) and the `www` record with
   Vercel's values.
4. Leave the `MX` records alone — those carry the email. Only touch `A`/`CNAME`
   for the apex and `www`.
5. Wait for Vercel to show both as Valid (usually minutes, up to a few hours),
   then check the site loads on all three hostnames.

---

## 2. Brand the one-time sign-in link email

The one-time link is sent by Supabase's own mailer, so it uses Supabase's stock
template — that's why it looks nothing like us. The replacement is written and
version-controlled at **`docs/email-templates/magic-link.html`**: same wordmark,
navy→gold keyline, message card and business footer as our receipts, plus the
six-digit fallback code.

1. Supabase → project **Kc-Live** → Authentication → Emails → **Magic Link**.
2. Subject: `Your Kosher Connect sign-in link`
3. Message body: paste the whole contents of
   `docs/email-templates/magic-link.html`. Leave `{{ .ConfirmationURL }}` and
   `{{ .Token }}` exactly as they are — Supabase fills those in.
4. Send yourself one from the portal and check it in Gmail on the phone.

**Two things worth checking while you're in there:**

* **Who it comes from.** Under Project Settings → Authentication → SMTP. On
  Supabase's built-in mailer the sender is a Supabase address and sends are
  rate-limited to a handful an hour — fine for a trickle, not for a busy day.
  Pointing it at our own sending domain makes the From line read Kosher Connect
  and lifts the limit.
* **Where the button points.** Until section 3 is done the link's host is
  `xsrtdwwzxdmnjdtjcdzd.supabase.co`, which looks like a phishing link to a
  careful customer, however smart the email looks.

---

## 3. Google sign-in showing the .supabase.co address

**Why it happens.** Sign in with Google sends the browser to
`https://xsrtdwwzxdmnjdtjcdzd.supabase.co/auth/v1/authorize` (pages/login.js).
Google shows the user the domain that will receive the sign-in, and that domain
is Supabase's, not ours. No amount of app-side code changes it — the address is
the thing Google is reporting.

There are two halves, and they need different things:

**a) The name and logo on the consent screen — free.**
Google Cloud console → Google Auth Platform → **Branding**: set App name to
`Kosher Connect`, upload the logo, set the home page to the site, and add
`kosher-connect.com` under Authorized domains. Google says brand verification
is not automatic and takes a few business days. This changes the headline to
"Sign in to continue to Kosher Connect".

**b) The domain itself — $10/month.**
It only becomes ours with the Supabase **Custom Domain add-on**: about
$0.0137/hour, i.e. **$10 a month** per project, billed by the hour and *not*
covered by the spend cap. Supabase's own Google guide recommends exactly this,
using something like `auth.kosher-connect.com`.

Order of operations if you want it (getting this wrong locks people out of
sign-in, so do it in this order):

1. Supabase → Settings → Add-ons → Custom Domain → enter `auth.kosher-connect.com`,
   then add the CNAME/TXT records it gives you at the registrar.
2. **Before activating**: in the Google Cloud console, add
   `https://auth.kosher-connect.com/auth/v1/callback` to the OAuth client's
   authorised redirect URIs — *in addition to* the existing supabase.co one, not
   replacing it.
3. Activate the domain in Supabase. OAuth starts advertising the new callback
   immediately.
4. Update `NEXT_PUBLIC_SUPABASE_URL` in Vercel to `https://auth.kosher-connect.com`
   and redeploy, and add the new host to Supabase's redirect allow-list.
5. Sign in with Google on a phone and on a desktop before telling anyone.

The old supabase.co host keeps working throughout, so there's no window where
sign-in is down if the steps are followed in that order.

**Note on the "vanity subdomain" option**: it is cheaper but it gives you
`something.supabase.co` — still supabase.co on the consent screen, so it does
not fix this complaint.
