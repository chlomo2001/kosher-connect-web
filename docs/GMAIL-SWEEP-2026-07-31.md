# Gmail sweep — 5311386k@gmail.com — 31 July 2026

What the shop's Gmail knows that the app doesn't. Read every provider message
in the account, pulled every UK mobile number out of it, and compared that
against `sims.legacy_extras->>'simNumber'` in Kc-Live.

No numbers are listed in this file on purpose — the working list went to the
owner directly. This is the shape of the finding and how to reproduce it.

## The account

26,210 messages, and it is not correspondence — it is a provider feed:

| | |
|---|---|
| Lebara | ~78% of everything |
| messages **sent** from the account | 1 |
| messages from a human | 27 |

25,393 of them are from a provider we bill through (Lebara, 1pMobile, US
Mobile, Smarty, Tello, Three, Asda). Those are the ones read.

## Method

`scratchpad/harvest.py` — list every message id for the provider query, then
read Subject + snippet for each and regex out `07xxxxxxxxx`. Resumable: ids and
partial results checkpoint to disk after every 1,500 messages, because the
container restarted mid-run once and lost twenty minutes.

Compared on the **last 10 digits**, so `07…`, `447…` and `00447…` all meet.

Two limits worth knowing before trusting a number:

- Only Subject + snippet were read, not full bodies. Every number found is
  real; numbers mentioned only deep in a body were missed. **The counts are a
  floor.**
- **1pMobile never prints the number** — its mail says "ending NNNNN" and keys
  the account by the Gmail plus-address it was signed up with. So silence from
  1pMobile says nothing about whether a plan is alive.

## What came out

**926 distinct numbers** — 887 Lebara, 25 1pMobile, 4 US Mobile, 10 other.
The app holds 718 SIM numbers that parse as UK mobiles.

| | |
|---|---|
| in the mail **and** in the app | 474 |
| **in the mail, nowhere in the app** | **452** (241 still active in 2026) |
| in the app, never seen in the mail | 244 |

### 1. 241 live numbers the app has never heard of

241 of the unmatched numbers were still receiving provider mail **this year** —
124 of them in July alone. 237 are Lebara.

Spot-checked the 15 busiest against the whole database, not just `sims`:
fourteen appear **nowhere** — not in `sims`, not in `customers.phone_number`,
not in `virtual_numbers`. The fifteenth is a customer's own mobile with no SIM
record attached.

Supporting number: the app holds **545 Lebara SIMs**; the mail names **887
distinct Lebara numbers**.

Each one is a plan the shop is being billed for, or administers, with no record
on our side — so nothing charges the customer for it and nothing renews it in
the app.

### 2. 119 rows marked `active` with no provider mail this year

116 numbers are in the app and in the mail, but the mail stopped before 2026.
Every one of the 119 matching rows still reads `active`.

106 of the 116 are Lebara, and that is the sharp end: Lebara mails about every
live number every month, so a Lebara number with no 2026 mail has very likely
ceased. The other ten (1pMobile ×5, Smarty ×4, Three ×3, UK SIM ×1) prove
nothing either way — see the 1pMobile limit above.

## Not a join key

The owner tags provider signups with Gmail plus-addresses (`gitt.bilig+m20@`).
It looked like a per-number key and it isn't: **25 of 132 tags map to more than
one number.** Don't build the ingest around it.

## Reproduce

```
cd scratchpad
GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE=/root/.config/gws/accounts/5311386k.json \
  python3 harvest.py          # → numbers.json (resumable)
python3 -c "…"                # compare against sim_tails.txt
```

`gws` lives at `/opt/node22/bin/gws`. The account tokens are testing-mode and
expire ~2026-08-05.
