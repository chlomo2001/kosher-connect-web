# Offline UI harness

Renders the staff app with no server, no auth and no database, so a screen can
be **looked at** rather than reasoned about.

```bash
node ops/harness/render.mjs                                  # build app.html
node ops/harness/render.mjs --audit --width 390              # overflow report, every tab
node ops/harness/render.mjs --shot rentals --width 390 --theme dark
```

`--audit` exits after printing one line per tab. It fails a tab when the page or
the content column scrolls sideways, and lists anything sitting outside the
content column that is **not** inside something meant to scroll.

## How it works

`components/AppShell.js` is rendered to static HTML with React, `window.fetch`
is replaced with one that answers from `seed.json`, and the real
`public/main.js` is appended. main.js then boots the way it does in production —
same render functions, same markup, same stylesheet. `window.renderTab('sim')`
switches tabs from the test script.

Needs `playwright-core` for the screenshot and audit modes; Chromium is already
at `/opt/pw-browsers/chromium` in the session container. Building `app.html`
needs nothing but the repo.

## Keep the seed faithful

`seed.json` must match what the API really returns, field for field. An
unfaithful seed invents defects that do not exist. An early version of it
omitted `recent` from `/api/ledger` and made the dashboard throw; the seed was
wrong, not the dashboard, and half an hour went into proving which. When a tab
looks broken here, check the seed against the route in `pages/api/` before
believing it.

`/api/settings` returns `{rentalRates, damageRates, settings[]}` where
`settings` is an **array** of `{key, numValue, textValue}`. Rentals and repairs
carry a denormalised `customerName`; repairs carry `total`, not `price`.

## What it found

Worth stating, because it is the argument for keeping it:

- **Tickets & Flights, Repairs and Virtual Numbers were clipping their tables
  dead.** `.table-card` has `overflow: hidden` and never got `.table-wrap`'s
  `overflow-x: auto`, so 662px of the flights table — Price, Fee, Status,
  Check-in, the row actions — could not be reached by mouse, finger or keyboard.
- **The Rentals screen pushed its second column off a 1280px display.** A `1fr`
  grid track floored at the section header's 1066px min-content width, so Phone
  Inventory sat off the right edge on the screen the shop works from.
- **The wallet dropped the payment method on a phone**, because the ellipsis on
  a one-line row always eats the end and the end was "(cash)".

None of the three was visible by reading the CSS.
