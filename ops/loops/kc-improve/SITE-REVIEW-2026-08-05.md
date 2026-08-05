# Kosher Connect — full-site review, 5 August 2026

Scope: public pages (/welcome, /repair, /phone-guide), customer portal, staff app, plus the
CSS/perf/harness layer. 14 lenses; every "confirmed" item was re-read in the code by a second pass
before it was written down, and italics mark where that pass corrected the original claim.

## TLDR

The site is in good shape: no critical defects, nothing losing money, no PII leak (the portal
passport check passes cleanly). What's left is a long tail of polish, and three genuine highs —
two of them at the till, one on the customer portal.

The single biggest lever is **feedback at the moment of waiting or failing**: the till goes quiet
for the whole card-machine round trip, a customer save that fails closes as if it worked, the
portal signs people out on a network blip, and a failed sign-in request still says "link is on its
way". All four are minutes of work and all four teach staff or customers not to trust the screen.

## Top 10 quick wins

Highest value per unit of effort, confirmed items only.

| # | What | Where | Why it matters | Effort |
|---|------|-------|----------------|--------|
| 1 | Disable the Charge button and label it "Waiting for the card machine…" during a POS charge | `public/main.js:9245, 9799-9855` | Nielsen #1 / Doherty — a 10-40s silent wait at the counter is indistinguishable from "my tap didn't register" | minutes |
| 2 | Only sign the portal out on `success:false`, never on a thrown fetch | `pages/portal.js:229-236` | Nielsen #9 — a blip deletes the refresh token and costs an emailed link round-trip | minutes |
| 3 | Guard the customer save: toast on failure, keep the modal open | `public/main.js:6301-6309` | Nielsen #1/#5 — typed data is silently lost while staff believe it saved | minutes |
| 4 | Reuse the rental type-ahead for the POS and Wallet customer pickers | `public/main.js:9204-9237, 5619-5621, 717-748` | Hick's Law / Baymard — a ~751-option native select, and a mis-pick charges the wrong wallet | hours |
| 5 | Repaint bank recon in place (`bankPaint()`) instead of re-skeletoning | `public/main.js:5909, 5950, 5959, 5977` | DESIGN.md §Loading: paint over, never clear-then-load; scroll position lost after every action | minutes |
| 6 | Swap `goToTab('cashup')` for `openCashupModal()` in the assistant | `public/main.js:10597` | Nielsen #1 — the announced action deterministically does nothing | minutes |
| 7 | Show the portal login error instead of the success card on non-2xx | `pages/portal.js:468-481` | Nielsen #1 — the form disappears, so there is no retry after a failed send | minutes |
| 8 | Parse `error_code` from the magic-link hash before wiping it | `pages/portal.js:261-278` | Nielsen #9 — an expired link lands on a bare login form with no explanation | minutes |
| 9 | Wrap the `.w-brand` logo in `<a href="/welcome">` on /repair and /phone-guide | `pages/repair.js:107`, `pages/phone-guide.js:107` | Nielsen #3/#4 — at ≤640px `globals.css:2380` hides the only exit off /repair | minutes |
| 10 | Replace "Bring the device in whenever suits you" with the live opening hours | `pages/repair.js:31, :51` | Nielsen #2 — the shop opens 2:00-6:30pm only; this invites a wasted morning trip | minutes |

## Trust & conversion — public pages and portal

#### H · A network blip signs portal customers out and deletes their refresh token — `pages/portal.js:229-236` (signOut at `:291-298`)
- **Why** `loadAccount`'s `.catch(() => signOut())` treats a transient fetch failure the same as an
  invalid token, and signOut removes `kc_portal_refresh` — the only session persistence. Worse than
  filed: `:269` prefers a stale sessionStorage token, so a same-tab reload after ~1h expiry
  deterministically wipes it without ever calling `refreshSession` (`:241-259`). Nielsen #9, and an
  emailed-link round trip is expensive on a filtered phone.
- **Fix** Sign out only on `success:false`; on a fetch rejection keep both tokens and render a
  localised "Couldn't load your account — check your connection" card with a Try-again button.

#### M · Login form claims "link is on its way" even when the request failed — `pages/portal.js:468-481` (success copy `:818-821`, he `:134`)
- **Why** `setSent(true)` runs unconditionally — 429s (`api/portal/request-link.js:20-22`), 503s and
  thrown fetches all render the success message, and the form is replaced, so there is no retry.
  Sibling handlers in the same file (`:408`, `:426`) do check. Nielsen #1. *Filed high, downgraded:
  the happy path is 200 and a 429 needs five submissions a minute; what remains is flaky mobile and
  transient 5xx.*
- **Fix** Show the generic success only on 2xx; otherwise surface the server message or "That didn't
  send — try again in a minute, or call 0161 531 1386" (en + he). 200s stay byte-identical, so
  enumeration safety is unchanged. Doesn't cover `request-link.js:33`, where a failed Supabase send
  returns 200 by design.

#### M · Expired or already-used sign-in link silently bounces back to the login form — `pages/portal.js:261-278`
- **Why** The landing effect reads only `access_token`/`refresh_token` then wipes the hash at `:270`
  before any error param is inspected. Supabase returns expired links as
  `#error=access_denied&error_code=otp_expired` — never read anywhere but the staff OAuth landing
  (`pages/auth/google.js:19`). Nielsen #9.
- **Fix** Parse `hash.get('error_code')` before the wipe; on `otp_expired`/`access_denied` show a
  localised line above the email field — "That sign-in link has expired — enter your email and we'll
  send a fresh one" — keeping the call-us fallback visible.

#### M · Follow-up enquiries are silently discarded while the sender is told "we've got it" — `pages/api/public/message.js:97-117`, `pages/api/public/repair.js:76-96`
- **Why** When an open task with reference `MSG-<sender>` exists the insert is skipped, yet the API
  returns `success:true` and the form shows "Thanks — we've got it." A second message ("my flight
  moved to Tuesday") never reaches staff. Nielsen #1 — a false success costs the trust the page just
  built.
- **Fix** When an open task matches, append the submission to that task's `raw_text` via `db.update`
  (timestamped line) instead of skipping the write. Keeps the anti-flood dedup. Both endpoints.

#### M · /phone-guide dead-ends on phone calls only, though the shop is open 2:00-6:30pm — `pages/phone-guide.js:182` (empty state `:138`, he `:55`)
- **Why** Closing CTA and empty state are both call-only, and at ≤640px `globals.css:2380` hides the
  back link too — so on a phone the only escape is an undecorated footer wordmark. Fogg B=MAT:
  motivation peaks mid-comparison, but the sole trigger fails out of hours, which is most of the
  browsing day.
- **Fix** Add an "or send us a message" link to `/welcome#contact` in `pg-foot` and the empty state
  (en + he). The optional cross-page prefill needs new read-on-mount code — treat as separate.

#### M · On phones the call trigger disappears once the hero scrolls away — `pages/welcome.js:426-433`; CSS `styles/globals.css:1019-1024`
- **Why** The sticky `.sk-mobnav` chips are all anchors/portal — no `tel:`. After the hero Call
  button (`:458`) scrolls off, no number appears until "Prefer to call?" near the foot of a ~6,700px
  page. Fitts / Fogg trigger placement; this audience is call-first.
- **Fix** Add a Call chip (`href={PHONE_TEL}`, number in `dir="ltr"`) to `.sk-mobnav` — rendered once
  from `t.nav`, so both languages get it. Put it **first** (the row scrolls horizontally, so a chip
  appended last sits off-screen at 390px) and style it distinctly so it doesn't read as a dead
  section chip. The scrollspy (`:323-339`) never matches it, which is correct.

#### M · Phones get no route back to the main site from /phone-guide and /repair — `styles/globals.css:2375-2380`; `pages/phone-guide.js:107`, `pages/repair.js:107`
- **Why** The 640px rule was written to hide in-page anchor pills, but on both pages `.w-anchor`
  carries a cross-page link to `/welcome` (`phone-guide.js:122`, `repair.js:122`) — so it hides an
  exit it was never meant to touch. /repair is the genuinely stranded one: its footer
  (`:174-176`) is a bare copyright line, and it's the page a customer sits on straight after
  submitting. Nielsen #3/#4 (logo links home).
- **Fix** Wrap the `.w-brand` logo+name in `<a href="/welcome">` on both pages.

#### M · Visual QA never sees /repair, and only ever sees /phone-guide empty — `ops/harness/public.mjs:26` (PAGES); fetch stub `:97-100`
- **Why** `repair.js` is a real 182-line bilingual page with no render, RTL, contrast or screenshot
  check. And `public.mjs` stubs `window.fetch` with a blanket `{success:true}`, so `d.models` is
  always `[]` — every phone-guide shot is the empty state, and the card layout, `pg-specs` list and
  `<bdi dir=ltr>` handling of Latin model names inside RTL have never been eyeballed.
- **Fix** Add `repair` to PAGES and make the fetch stub URL-aware so `/api/public/phone-guide`
  returns two sample models. **Do not** rename the seed.json key as originally proposed — seed.json
  isn't read by public.mjs at all, and `/api/phone-guide` is a separate staff endpoint
  (`public/main.js:12270`). Adding repair.js to theme-pairs.mjs is a no-op (no
  `prefers-color-scheme` in it).

#### L · No third-party proof; the verified Google profile is never linked — `pages/welcome.js:123-124` (rendered `:525-530`); cid at `:36`
- **Why** The social-proof band is a pure self-claim; the Business Profile cid appears only in JSON-LD
  and the map embed. Cialdini social proof / Fogg reputed credibility.
- **Fix** Owner work, not code: ask two or three regulars for one-line named quotes. **Do not** ship a
  "See our reviews on Google" link yet — the profile was verified on 03-08 and almost certainly has
  no reviews, so it would point at an empty card. The Visit card also deliberately has no Maps link
  (`:596-598` records that decision).

**Lower-priority, unverified:**
- **(unverified, M)** "renewal due — speak to us" is inert text — `pages/portal.js:48, 571`; the only `tel:` is the footer at `:792`. Make "speak to us" a `tel:` link in both languages.
- **(unverified, M)** Balance hero and Recent activity don't reconcile — `pages/api/portal/me.js:54` caps at 6 ledger rows with no running balance, so an older debt becomes unexplainable. Return ~12 rows plus "balance after" per line.
- **(unverified, L)** Opening hours missing from the /welcome footer — `pages/welcome.js:629-637`; render the already-fetched hours under the address.
- **(unverified, L)** No privacy reassurance beside the contact form — `pages/welcome.js:537-576`; one muted line linking /privacy, especially for the optional address field.
- **(unverified, L)** Prefill never updates when a visitor changes doors — `pages/welcome.js:479-480, 505-508`; allow replacement when the current text exactly equals a known prefill string.
- **(unverified, L)** /welcome's fail-state phone number is dead text — `pages/welcome.js:132, 575`; render it as a `tel:` anchor the way `repair.js:166-170` already does.
- **(unverified, L)** Two duplicate text CTAs under tiles that carry the same links — `pages/welcome.js:520-521`; delete both (and their T strings).
- **(unverified, L)** Three optional /join fields lengthen the one conversion path — `pages/welcome.js:542-566`; collapse email/reach-chips/address behind a quiet "New here?" disclosure.
- **(unverified, L)** Success copy promises contact but no timing — `pages/welcome.js:132`, `pages/repair.js:30`; add "we reply during opening hours, usually the same day".
- **(unverified, L)** `bookingReference` is returned but never rendered — `pages/api/portal/me.js:70`; drop it from the select (GDPR Art. 5(1)(c) minimisation). Note the passport check itself passes cleanly.

## Staff efficiency

#### H · Till and Wallet pick customers from a ~750-option native select with no search — `public/main.js:9204-9205, 9234-9237` (POS), `:5599-5601, 5619-5621` (Wallet)
- **Why** Customers sort "firstName lastName" (`sortCustomersAZ`, `:262-266`), so native type-ahead
  prefix-matches first names only — surname or phone lookup means scrolling ~751 options. Especially
  weak for this audience, where repeated first names are the norm and the surname discriminates.
  Hick's Law; Baymard (>10-15 options need search). Wallet has partial escapes (Ctrl-K, the customer
  card's Record button, inline arrears rows); **POS has none, and a mis-pick charges the wrong
  customer's wallet** (`:9881`).
- **Fix** Reuse the rental type-ahead (`:717-748` — name/phone/email/digit, capped at 10) for
  `#posCustomer` and `#wtCustomer`, parameterising its element IDs so all three share one component.
  Keep a hidden input with `id="posCustomer"` and all five `.value` reads (`:9285, 9535, 9578, 9846,
  9881`) keep working.

#### M · Bank reconciliation blanks to a skeleton and loses your place after every action — `public/main.js:5909, 5950, 5959, 5977` → `renderBankRecon()` `:5739-5740`
- **Why** Every confirm/ignore/reopen/undo re-skeletons and refetches, collapsing scroll to the top;
  working a statement means re-finding your row after each action. `docs/DESIGN.md:117` mandates
  "paint over, never clear-then-load", and `bankPaint()` (`:5751`) already does it for the filters.
  Doherty; Nielsen #7.
- **Fix** Patch the row state and counts inside `bankData`, call `bankPaint()`, refetch quietly in
  the background (still needed for the `proposeCapped` window).

#### M · New Rental dead-ends when the renter isn't a customer yet — `public/main.js:737-739` (only zero-match branch); picker markup `:1866-1876`
- **Why** The dropdown's empty state is "No customers found" with no create path, and the only
  `openAddModal()` entry points (`:601`, `:6036`) sit behind the modal overlay. Closing to add the
  customer means the next `openNewRentalModal()` rebuilds from scratch (`:3163-3175`;
  `closeDynamicModal` `:3224-3229` persists no draft). Nielsen #3. *Corrections: `#customerModal` is
  a separate overlay and doesn't clobber the rental modal by itself — the loss comes from having to
  close the rental modal to reach the button; and both dates default, with a restart path from the
  customer card via `openNewRentalModal(preselectCustomerId)`. A detour, not a dozen steps.*
- **Fix** On zero matches render `➕ Add "<typed name>" as new customer`, opening `openAddModal`
  prefilled and stacked over the rental modal; on save call `selectRentalCustomer(newId)` so the
  form underneath simply continues.

#### M · Customer-card tool strip is ten unlabelled emoji buttons, including a charge-card action — `public/main.js:4012-4028`; `ops/harness/modal_customer-card_light_390.png`
- **Why** Meanings live only in hover titles (no touch tooltip), and several emoji degrade to
  ambiguous monochrome glyphs at 390px. `📞` logs a call rather than placing one. NN/g icon
  usability; Nielsen #6. *`💳` is already gated behind a `prompt()` plus an idempotency ref, so an
  accidental tap charges nothing — the cost falls on a new helper, not the daily operator.*
- **Fix** Surface the `role=group` labels that already exist ("Contact / Money / Manage") as visible
  `--fs-micro` captions under each icon. Keep the confirm on `💳`.

#### M · Palette match is exact-substring, so natural phrasings find nothing — `public/main.js:10781-10797`
- **Why** `label.toLowerCase().includes(needle)` means "cash up", "cashup" and "z report" return
  nothing for "Cash-up (Z-report)" (`:10741`) — typing "cash" shows it, adding " up" makes it vanish
  mid-keystroke; "pos" finds nothing for "Point of Sale (Till)" (`:10739`). The recall aids (Pinned /
  Recent / quick actions) are hidden the moment you type (`:11048`). Nielsen #6; Baymard.
- **Fix** Strip non-alphanumerics from needle and label before matching, and add an optional `keys:[]`
  alias array per command (pos, till, eod, z report). The function already normalises phone digits.

#### M · Kol Torah is invisible to the command palette — `public/main.js:10768` (hand-written 12-id array) vs `TAB_META` `:599-613`
- **Why** Every tab id except `koltorah` is listed, so "kol" offers neither navigation nor "+ New
  Job" (`ktFocusNewJob`, `:10138`) — while the comment right above (`:10766-10767`) claims these
  entries read the same label map. Nielsen #4.
- **Fix** Derive the navigate entries from `Object.keys(TAB_META)` so the next tab can't be forgotten,
  and add a create command reading koltorah's primary. `visibleCommands()` already filters by `c.tab`
  against `allowedTabs`, so helper permissions survive.

#### M · Assistant's "today's takings" silently dead-ends on a non-existent tab — `public/main.js:10597` → `goToTab()` `:11751-11756`
- **Why** It prints "Opening the cash-up screen…" then clicks `.nav-item[data-tab="cashup"]`, which
  doesn't exist (verified against the rendered DOM in `ops/harness/app.html`) — optional chaining
  swallows the miss, the modal closes, nothing opens. Fires every time. Nielsen #1.
- **Fix** One line: `openCashupModal()` (`:5650`), already called the same way from `:5624`/`:10740`.

#### M · Cash-up can only count today — a missed close-out becomes unrecordable — `public/main.js:5650-5652, 5665, 5695`; both call sites (`:5624`, `:10740`) are zero-arg
- **Why** `localISO()` is hardcoded for fetch, title and save, with no date control. The API already
  accepts any date (`pages/api/cashup.js:67, 89`), so the restriction is purely client-side.
  Nielsen #5 — leave a recovery path for a predictable human miss. *Correction: no variance rolls
  forward arithmetically; the harm is the missed day gets no `till_counts` row, so the next physical
  count reads unexplainably over.*
- **Fix** Give `openCashupModal` a date parameter plus a "‹ previous day" stepper, passed through to
  GET and POST. While there, bind Enter in `#cuCounted` to `saveCashup`.

#### M · Charging a sale has no keyboard path — the till's most-repeated action needs the mouse — `public/main.js:9216-9218, 9399-9402` (scan field), `:9245` (Charge button)
- **Why** Every POS action deliberately refocuses the scan field (`:9254, 9268, 9340`), Enter on an
  empty field is a no-op, and no document-level handler covers POS mode. KLM: each scanner-driven
  sale pays a homing + pointing operator. *Overstated as "mouse-only" — `.pos-charge` is a native
  button, so Tab-then-Enter reaches it, and the till is deliberately touch-first. What's missing is
  a direct shortcut.*
- **Fix** Map Ctrl+Enter (or F9) in the scan field's keydown to `saveSale()` — a modifier stops a
  scanner's trailing Enter firing the confirm-free charge — and show it on the button.

#### L · The global-search button is labelled by its keyboard chord, "Ctrl K" — `public/main.js:6039-6047`; `ops/harness/shot_dashboard_light_390.png`
- **Why** "Search" exists only in the hover title, and at 390px the topbar reads "🤖 Ask / 🔍 Ctrl K /
  🌙" on a device with no Ctrl key. The palette is the only find-anything entry on 12 of 13 tabs
  (`search:true` occurs once, `:601`). Nielsen #2.
- **Fix** Label it "Search" and move the `Ctrl K` hint into a span hidden below 768px.

#### L · Empty `helper_tabs` signs a helper into a blank app with only a transient toast — `lib/auth.js:198-211` → `public/main.js:591, 361-363, 629-631`
- **Why** Fails closed to `[]`, which hides every nav item, makes `startTab` undefined and bails with
  a toast. Nielsen #9. *Unreachable through the product: migration `20260712121900_helper_tabs.sql`
  seeds 12 tabs, and `saveHelperTabs()` (`:13452`) plus `pages/api/settings.js:174` both refuse an
  empty selection. Only a bad restore gets you there.*
- **Fix** When `allowedTabs` is empty, paint a persistent full-screen notice — "No areas are enabled
  for your account; ask the owner to set Settings → Team".

**Lower-priority, unverified:**
- **(unverified, L)** Cash-up lives on Wallet, not at the till — `public/main.js:5624` vs Shop's action row `:8811-8814`; add the same 🧾 button beside Open Till.
- **(unverified, L)** The shortcuts crib sheet is only discoverable by knowing `?` — `public/main.js:11072-11082, 11127-11132`; add a palette command and a "?" hint in the sidebar footer.
- **(unverified, L)** Rental customer picker ignores Enter — `public/main.js:1871-1873, 741-745`; commit the single visible match the way `posScanEnter` (`:9405`) does.

## Accessibility & RTL

#### M · Customer card opens as a modal with no dialog role, focus move-in, Tab trap or focus return — `public/main.js:4159`; `kcTopModalOverlay` `:11336`; `dismissCustomerCard` `:4900`
- **Why** A bare `<div class="modal">` with no role/aria-modal/name; `customerCard` is absent from
  the Tab-trap list, so Tab wanders the dimmed page behind the scrim; nothing focuses the card on
  open and nothing restores focus on close. The comment at `:11141` claims all modals carry
  `role=dialog` — this one contradicts it. WCAG 4.1.2, 2.4.3. Escape does work (`:11145`).
- **Fix** Mirror `kcConfirm` (`:3251`): `role="dialog" aria-modal="true"` plus an aria-label with the
  customer's name; append `customerCard` to `kcTopModalOverlay`; save/restore focus. **Caveat:**
  `renderDetailPanel` is also the repaint path (see the `wasOpen` guard at `:4161`), so focus save
  and move-in must be gated on `!wasOpen`, or a mid-edit save yanks focus back to the card.

#### M · Opening hours stay in English on the Hebrew welcome page — `pages/welcome.js:284, 312, 611`; `pages/api/public/info.js:8, 15`
- **Why** The label is Hebrew ("שעות פתיחה") but the value prints raw inside the `dir="rtl"` wrap,
  with neither translation nor a `dir` guard — unlike the sibling address/phone/email rows
  (`:605, 615, 619`). There is no `opening_hours_he` key anywhere, so the owner can't fix it from
  Settings without breaking the EN page. Nielsen #2.
- **Fix** Add an `opening_hours_he` settings key beside `opening_hours` (clone the bespoke branch at
  `pages/api/settings.js:213-224`); render it when `lang==='he'`, falling back to the EN string
  wrapped in `dir="ltr"`. Leave the JSON-LD copy (`:272`) English.

#### L · All 49 dynamic action modals announce as nameless dialogs — `public/main.js:3176`
- **Why** `role="dialog" aria-modal="true"` with no `aria-labelledby`, though every payload opens
  with a `.modal-title` — 49 call sites, not the 17 originally filed. Worse: `autofocusFirstField`
  (`:3183`) moves focus into the first input, so the title is never announced at all. `kcConfirm`
  (`:3251`) and `kcShortcuts` (`:11097`) do it right. WCAG 4.1.2.
- **Fix** After setting innerHTML, id the first `.modal-title` and set `aria-labelledby` on the
  `.modal` div. One function fixes all 49. (The `role="heading"` half of the original is unneeded.)

#### L · Staff shell has zero landmarks, no h1, and the active tab isn't exposed — `components/AppShell.js:78, 88, 128, 129, 133, 148`; `syncNavActive` `public/main.js:477`
- **Why** All plain divs — no nav/main/header/h1 in the shell, one h2 and two h3 in 13,694 lines of
  main.js, no `aria-current`, no skip link. WCAG 1.3.1, 2.4.1. Internal surface with no known AT
  user, so this is insurance rather than live friction.
- **Fix** Attribute-only, zero CSS risk: `role="navigation" aria-label="Main"` on `.sidebar-nav`,
  `role="main"` on `#mainContent`, `role="banner"` on `.topbar`, `role="heading" aria-level="1"` on
  `#pageTitle`, `aria-current="page"` alongside `.active`. Nav items are `div.nav-item` (`:93`) and so
  aren't focusable at all — a larger gap this doesn't fix.

#### L · Persistent error toasts can only be dismissed with a mouse — `public/main.js:7035-7053`
- **Why** Error toasts deliberately never auto-clear, but dismissal is an `addEventListener` click on
  a plain div — no tabindex, no Enter/Space, and `kcScanClickable` (`:11307-11312`) only upgrades
  `[onclick]` attributes; Escape doesn't cover toasts either (`:11138-11146`). WCAG 2.1.1. The toast
  sits in a fixed corner without blocking the form, so live impact is near zero.
- **Fix** Append a real `<button aria-label="Dismiss">`. One function serves all 186 call sites.

#### L · Type-ahead controls have no combobox semantics; the palette drops focus on close — `public/main.js:11023-11061, 10875-10886, 11064-11066, 11335-11341`; picker `:717-748`
- **Why** Arrowing moves a CSS class over onclick divs — no `role=listbox/option`, no
  `aria-activedescendant`, no result-count live region, so a screen reader hears nothing.
  `closePalette` is a bare `.remove()` with no focus restore, and `paletteOverlay` is missing from
  the Tab-trap list. WCAG 4.1.2, 2.4.3. *Not inoperable: `kcScanClickable` stamps tabindex + role on
  every `[onclick]`, so both lists are Tab-reachable today.*
- **Fix** The part that bites a sighted keyboard user daily is the missing focus restore on Esc — wrap
  open/close in the existing `kcSaveReturnFocus`/`kcRestoreReturnFocus`. Full APG rework can wait.

**Lower-priority, unverified:**
- **(unverified, M)** Legal surface has no Hebrew — `pages/welcome.js:656-658` hardcodes EN Privacy/Terms/Refunds inside the translated HE footer, and privacy/terms/refund.js have no RTL handling at all. Translate the three labels first (minutes), then give the pages the phone-guide chrome, starting with /refund.
- **(unverified, M)** Portal HE rental date-range arrow points backwards — `pages/portal.js:681`; inside the forced-LTR `bdi`, keep `→` for both languages. Grep for other `isHe` arrow flips.
- **(unverified, M)** Public-form server errors surface in English inside the Hebrew UI — `pages/api/public/message.js:43-71` and repair.js return EN strings printed verbatim at `welcome.js:575` / `repair.js:91`. Return a stable `code` field and map it client-side. WCAG 3.1.2.
- **(unverified, L)** Hebrew portal ledger descriptions stay English — `pages/portal.js:642-643`; map the dozen fixed machine-generated templates at render time when `lang=he`.
- **(unverified, L)** Public sub-pages skip heading levels h1→h3→h4 — `pages/phone-guide.js:129, 149`, `pages/repair.js:129`; styling targets classes, so the tag swap is visually free.
- **(unverified, L)** HE back-links dropped the arrow EN keeps — `pages/phone-guide.js:42`, `pages/repair.js:42`; prefix with "→ ".
- **(unverified, L)** Phone-guide harness shots predate two shipped HE fixes (Aug 2 files vs Aug 4 commits fbb7d70, bf9280e) — re-render at the next harness run so future reviews stop chasing fixed bidi bugs.

## Mobile

#### L · Modal Save/Cancel row grazes the iOS Safari toolbar — `styles/globals.css:818-825` (`.modal`), `:795-800` (`.modal-overlay`)
- **Why** `vh` resolves to the large viewport, so with toolbars shown a maxed-out modal is taller
  than the visible area and, being centre-aligned, bleeds roughly half the excess past each edge —
  ~30px at the bottom on an iPhone 14, almost entirely inside the modal's own 28px padding. *The
  original framing is refuted: `.modal` carries `overflow-y: auto` on the very next line, so it IS
  the scroll container and Save/Cancel is always reachable; the login-card fix at `:1533-1535` is a
  different defect (adding scrolling, not dvh).*
- **Fix** Cheap and harmless: `max-height: 90vh; max-height: 90dvh;` plus `align-items: safe center`.

**Lower-priority, unverified:**
- **(unverified, M)** Welcome mobile nav hides "Visit us" and "My account" with no scroll cue — `pages/welcome.js:1004` hides scrollbars in both engines and the row ends flush at 390px. Wrap to two rows at ≤480px (bump the 122px `scroll-margin-top` at `:1013`) or add the `.table-wrap` fade cue (`globals.css:640-663`). "Visit us" is the top job for this audience.
- **(unverified, M)** Unguarded `IntersectionObserver` can hide welcome sections on old devices — `pages/welcome.js:350-353` adds `.js-on` (which hides every `.sk-reveal`) *before* constructing the observer; on iOS 11-12.1 the throw leaves content at `opacity:0`. Same at the scrollspy (`:331`). Two-line guard, and it matches the page's own documented progressive-enhancement intent.
- **(unverified, L)** Rental price line literally says "hover for why" on a 390px screen — `public/main.js:2162`; show the tooltip sentence as a visible muted line or an onclick toggle. WCAG 1.4.13.

## Feedback & errors

#### H · Till goes silent for the whole card-machine charge — `public/main.js:9245` (button), `:9825` (single 3s toast), `:9717`/`:9696-9707` (waits), `:26` (`kcBeginWrite` returns false silently)
- **Why** One info toast that auto-clears in 3s, then a poll of up to 180s with no busy indicator;
  the Charge button is never disabled and repeat taps are swallowed without a word. A real
  tap/PIN/issuer round trip is ~10-40s, past the ~10s persistent-indicator threshold, and the
  operator can't tell "waiting on the machine" from "my tap didn't register". ~12 other places
  already do `btn.disabled = true; btn.textContent = 'Creating…'`. Nielsen #1; Doherty. *No money
  risk: `kcBeginWrite` + the `posSaleRef` token (`:9815`) + the amount-matched `kcTillApproved` cache
  (`:9689-9693`) prevent a double charge.*
- **Fix** In `saveSale`, disable `.pos-charge` and relabel it "Waiting for the card machine…" while
  awaiting `kcTillCharge` (restore in `finally`); make `kcBeginWrite` toast "Still working on the
  last one…" when it blocks a tap.

#### M · Failed customer save closes the modal silently — typed data lost, staff believe it saved — `public/main.js:6301-6309` (`closeModal()` runs unconditionally); `clearModal()` `:6143`
- **Why** Neither the add nor the update branch has a failure path. `pages/api/customers.js` returns
  `{success:false}` on 400/404/413/409/500/503, and `window.api.addCustomer/updateCustomer`
  (`:32-42`) don't check `r.ok`, so those land as an object this form ignores; a network reject
  leaves an unhandled rejection through `guardReentry` (`:13634`). Every sibling handles it —
  `deleteCustomer` (`:6329-6333`), `saveCashup` (`:5719`), `reportSave` (`:1201`). The repo's own
  task #24 set this convention; this form was missed. Nielsen #1/#5; Baymard.
- **Fix** Before `closeModal()`, mirror `deleteCustomer`'s guard —
  `if (!res || !res.success) { toast(res?.error || 'Could not save the customer.', 'error'); return; }`
  — on both branches, and wrap the awaits in try/catch so a network failure keeps the modal open with
  the typed data.

#### L · Staff sign-in defeats password managers and code autofill — `pages/login.js:111-120` (email/password), `:95-99` (2FA code)
- **Why** No `name`, no `autoComplete`, no labels beyond placeholders; the 2FA input has
  `inputMode="numeric"` but no `maxLength` or `pattern`. Every other form in the repo is annotated
  (`portal.js:827`, `welcome.js:538`, `repair.js:145`) — login.js is the holdout. WCAG 1.3.5. *Fill
  isn't broken today — browsers detect `type="password"` heuristically; the attributes just make it
  deterministic, and `one-time-code` buys little for an emailed code on a desktop.*
- **Fix** `name` + `autoComplete="username"`/`"current-password"`, aria-labels on all three, and
  `maxLength={6} pattern="[0-9]*"` on the code field (the parts with daily value).

#### L · /repair's "Phone or email" field opens an email keyboard — `pages/repair.js:149`
- **Why** `autoComplete="tel"` paired with `inputMode="email"` — autofill offers a phone number while
  the keyboard has no digit row, the worst combination for an 11-digit number typed slowly. Baymard.
  *Half the original is refuted: `pages/welcome.js:540`'s bare default keyboard is the correct end
  state, not a second defect, since a field accepting either has no right `inputMode`.*
- **Fix** Drop `inputMode="email"`, keep `autoComplete="tel"`. Add `name` attributes to the four
  repair fields while you're there (autofill heuristics only; nothing functional breaks).

**Lower-priority, unverified:**
- **(unverified, M)** Fixed 3-second toast dismissal cuts off long money-critical warnings — `public/main.js:7050`; casualties include the 24-word "card machine approved after the till gave up — re-ring the SAME items" (`:9781`) and the email-HOLD note (`:5021`). Scale duration with length and make `warning` persist like errors.
- **(unverified, M)** Failed boot load of customers or bookings renders a convincing "No customers yet." — `public/main.js:315, 319` use `.catch(() => [])` without recording `loadFailed`, unlike rentals/phones/sims (`safeLoadArray`, `:293-305`). With 751 real customers behind it, that invites panic or duplicate re-entry. Route both through `safeLoadArray` and render `errorHtml()`.
- **(unverified, M)** Raw "Storage error" reaches staff from 26 API routes and ~44 toast sites — add a shared plain-English constant naming the consequence and the next step; keep `console.error` for the real cause.
- **(unverified, M)** Portal document Download fails silently — `pages/portal.js:357-365` has `catch { /* ignore */ }` and no else. Set the existing `docMsg` state to a localised failure string.
- **(unverified, L)** Money fields are `type="number"`, so a trackpad scroll over a focused field silently changes the figure — `public/main.js:1984, 5435, 5682, 9310` and ~35 more. One delegated wheel guard that blurs the active number input; longer term prefer `inputmode="decimal"` per GDS.
- **(unverified, L)** Booking passenger editor invites autofill into passport/name fields — `public/main.js:7215-7221`; add `autocomplete="off"`, matching the convention already documented at `components/AppShell.js:189-193`.
- **(unverified, L)** Card-on-file "Payment processing…" vanishes with no way to learn the outcome — `public/main.js:4377`; make it a persistent warning naming the next step, and refresh the wallet afterwards.

## Performance & consistency

#### M · main.js ships 764KB unminified with no long-cache — `next.config.js:32-36`; loaded at `components/AppShell.js:265`
- **Why** 779,773 bytes raw / 201KB gzipped on a stable path at Next's default `max-age=0`; the
  config's own NOTE flags this as a deferred owner-verify item. *Two corrections: terser 5 gives 31%
  off the wire (201KB → 139KB), not "roughly half"; and `max-age=0` means a 304 with no body, on an
  `afterInteractive` tag that isn't render-blocking — so "every boot pays a blocking RTT" overstates
  it. The full re-download happens only on the deploy after a change.*
- **Fix** Do the caching half now: `/main.js?v=<BUILD_ID>` from `AppShell.js:265` plus one immutable
  `headers()` rule. One line each, no new toolchain, and `ops/harness/render.mjs:63` (which reads
  `public/main.js` by literal path) keeps working. Leave terser for the owner-present deploy check
  the config already asks for — main.js is hand-edited near-daily and needs a source-map story.

#### M · Boot splash blocks first paint on the whole API load — `public/main.js:314-326` (11-way `Promise.all`), `hideBootLoader()` `:376`
- **Why** Staff watch "Loading your business…" until the slowest serverless call returns, including
  788 customers with full `legacy_extras` blobs (`lib/tableStore.js:71-88`). `skeletonHtml()`
  (`:6962`) and the dashboard's paint-from-cache pattern (`:11779-11800`) already exist; a cold start
  is long enough that `AppShell.js:269` carries a 12-second escape hatch. *Corrections: the fetches
  are parallel, so it's one round trip, not eleven; and the payoff is purely perceptual — every tab
  reads the arrays this fills, so staff can't look anything up any sooner.*
- **Fix** Paint the chrome plus the start tab's skeleton and call `hideBootLoader()` immediately;
  render the real tab when the `Promise.all` resolves. **Budget for the edge case the original
  missed:** `applyTabVisibility()` (`:589-593`) can only run after `/api/auth/me` lands, and the
  sidebar is server-rendered with the full NAV list — so revealing early flashes tabs a restricted
  helper may not have, then yanks them away.

**Lower-priority, unverified:**
- **(unverified, M)** Inter is the contract's typeface but is never loaded — `styles/globals.css:212, 2340` name it, the file header promises it, and no `@font-face` or file exists. Either self-host a Latin-subset woff2 (mirroring the David Libre pattern at `:18`) or delete "Inter" from both stacks and re-tune tracking, updating DESIGN.md either way.
- **(unverified, M)** All table data and form inputs render at weight 300 — `styles/globals.css:690, 848, 903, 1121`, below DESIGN.md's 400 floor; body was already bumped 300→400 as "too thin to read" (task #57). Same rationale applies to the cells staff read all day.
- **(unverified, M)** Input focus ring hardcodes a light-only glow — `styles/globals.css:890` uses `rgba(0,96,168,0.12)` while `.search-box` correctly uses `var(--ring)` (`:465`). Invisible on dark cards. One-line swap; DESIGN.md:42 already mandates the token.
- **(unverified, M)** Shop low-stock cue is an off-palette pink that disappears in dark — `public/main.js:8698, 8717` use `#ea2261`, which matches no token. Build `.row-lowstock`/`.banner-lowstock` from `--danger` washes with a dark override.
- **(unverified, M)** Motion hard rules broken — `.bizbar-fill` animates `width` over 500ms with a bespoke bezier (`globals.css:1568`), `.sidebar` animates `width` (`:529`), knobs animate `left` (`:1414`, `main.js:2808`). DESIGN.md:94-102 forbids all four. Move to `transform`; old shop hardware feels the reflow.
- **(unverified, M)** Staff-app display type (20/26/30/40/48 at weight 300) contradicts DESIGN.md's "adoption is done" — the shipped tier is internally consistent, so legalise it with `--fs-display` tokens and a doc update rather than squashing the app's signature look to the 28px cap.
- **(unverified, M)** No preload for /main.js — `components/AppShell.js:265`; the 201KB fetch waits on framework download + hydration. Add `<link rel="preload" as="script">`, keeping the URL in step with the versioned filename above.
- **(unverified, M)** Public pages ship the whole staff stylesheet — `pages/_app.js:1`; /welcome then inlines its own complete `SKY_CSS` anyway (`welcome.js:398`). Split the staff-only bulk into a sheet only AppShell links, and update the harness to load both.
- **(unverified, L)** Booking "Reuse passengers" strip still tinted with the retired indigo — `public/main.js:7256` (`#533AFD`); swap for `var(--accent-wash)`.
- **(unverified, L)** Radius contract says 8px; flagship surfaces ship 10-16px — `globals.css:820, 432, 1531, 731, 1771, 1797`. Add `--radius-xl`/`--radius-2xl` and amend DESIGN.md rather than re-squaring everything.
- **(unverified, L)** Brand PNGs are 10-20× oversized on first-paint surfaces — `logo-full-tight.png` 825×196 rendered at 32px, `logo.png` 326×334 at 56px on the boot splash. Export right-sized 2× variants and extend the immutable-header regex at `next.config.js:28`.

## Copy & content

#### M · /repair sets no expectations: no price anchors, no firm turnaround — `pages/repair.js:25` (EN), `:45` (HE)
- **Why** The only expectation-setting is "we'll come back with an honest price… Most jobs are done
  quickly", yet the shop already maintains 14 priced repair services
  (`supabase/migrations/20260712120200_seed.sql:45-58`, rendered at `public/main.js:8003-8010`) for
  exactly this audience's handsets. Nielsen #1. *Corrections: a vague turnaround line does exist in
  both languages, the success card already gives address and bell-5 wayfinding, and the Baymard
  abandonment research doesn't apply — this is a free enquiry, not a checkout, so the failure mode
  is hesitation, not lost payment.*
- **Fix** A short "What to expect" block (EN+HE) served by a tiny public endpoint modelled on
  `pages/api/public/phone-guide.js`. **Use per-model rows, not "from £X"** — screen prices span
  £25-£90 and there's a discounted `kcPrice` tier (`main.js:8005`), so a floor price anchors on the
  cheapest handset and creates counter disputes.

#### M · Repair confirmation says "bring it in whenever suits you"; the shop opens 2:00-6:30pm — `pages/repair.js:31` (EN), `:51` (HE); hours at `pages/api/public/info.js:8`
- **Why** Hours appear on /welcome alone (`welcome.js:310-313, 611`) — nowhere on /repair or
  /phone-guide. The problem isn't the Friday/Shabbos closure, which this audience assumes; it's the
  afternoon-only window, which makes "whenever suits you" invite a wasted morning trip. Nielsen #2.
- **Fix** Fetch `/api/public/info` as `welcome.js:310-313` does and replace "whenever suits you" with
  the hours line, so the owner's Settings value stays the single source of truth. The /repair half is
  load-bearing; the /phone-guide footer addition is optional.

**Lower-priority, unverified:**
- **(unverified, M)** "Shabbat" and "Shabbos" mixed in one rental summary — `public/main.js:2157` vs `:2162`, plus `:1604, 2945` vs `:12427`. Standardise display strings on "Shabbos" (the community's term and the public site's choice at `welcome.js:84-88`); leave function names alone.
- **(unverified, M)** Two date formats — `fmtDate()` (`public/main.js:667-673`) emits `05/08/2026` at 78 sites including customer-facing SMS drafts (`:5171-5177`), while SIM history, wallet and the portal (`portal.js:304`) render `5 Aug 2026`. Changing `fmtDate()` alone converges all 78; spot-check dense tables at 390px.
- **(unverified, M)** Phone-guide specs can't be compared across models — `styles/globals.css:2272-2278` wraps pills so the same spec sits differently on every card, and `phone-guide.js:154` skips empty values, so "no dual SIM" is indistinguishable from "not filled in". Render all four `SPEC_KEYS` in fixed order with "—", and grid them at ≥640px.
- **(unverified, M)** The phone guide never answers "which phone for whom" — no best-for line, no battery/standby fact (the top basic-phone question), warranty punted to a blanket "please ask" (`phone-guide.js:34`). Add an owner-editable "Best for" line and a battery spec.
- **(unverified, M)** No next step at the moment of decision on /phone-guide cards — `phone-guide.js:145-175` end at pros/cons; the first tappable number is after the whole list. Add a per-card "Call about this phone" link.
- **(unverified, M)** No FAQ anywhere on the public site — phone trouble abroad, SIM not working, unlocking, top-ups, returns, out-of-hours. A six-question `<details>` band on /welcome deflects calls for a two-person shop and helps local SEO.
- **(unverified, L)** Wallet Type options differ only in clipped parentheticals — `public/main.js:5426-5430`; front-load the distinguishing words and move the explanation to a helper line under the select.
- **(unverified, L)** Primary buttons split between Title Case and sentence case — e.g. `public/main.js:2015, 8046, 2458` vs `:3827, 5695, 4591`. Adopt sentence case and record the rule in DESIGN.md.
- **(unverified, L)** EN pricing line omits the unit the Hebrew has — `pages/welcome.js:78` says "services £5"; the HE twin (`:168`) says "per service".
- **(unverified, L)** Portal card titled "My SIM plan" over three plans — `pages/portal.js:44, 691`; pluralise by count in both languages.
- **(unverified, L)** Trade jargon "Ticketed" shown to portal customers — `pages/portal.js:68, 129`; relabel to "Ticket issued" / "הכרטיס הונפק" in the portal only, keeping the staff term.
- **(unverified, L)** Empty /phone-guide contradicts itself — the lead promises "Every handset below…" above "The guide is being written", and `api/public/phone-guide.js:26-29` returns `models:[]` on any error, so a DB hiccup shows this to real visitors. Suppress the lead and the orphaned footnotes when the list is empty.

## Checked and NOT worth doing

- **"Every input focus auto-zooms the page on iPhones (14px inputs)"** — already fixed.
  `styles/globals.css:1895-1902` sets `.form-input`, `.search-box`, `.palette-input` and the payment
  row to 16px under `@media (max-width: 768px)`, with a comment about exactly this. It's later in the
  cascade at equal specificity, so it wins on phones; `pages/portal.js:781, 825` inherit it. The
  viewport meta (`AppShell.js:58`) has no `maximum-scale`, so WCAG 1.4.4 is fine. Only residual gap:
  `.rp-form input/textarea` (`globals.css:2304-2307`) are a hardcoded 15px — a handful of fields on
  the standalone repair form, low at most.

## Counts

| | |
|---|---|
| Lenses run | 14 (persuasion, cogload, taskflow, forms, a11y, mobile, feedback, perf, portal, content, trust, hebrew, consistency, copy) |
| Raw findings | ~100 |
| After dedup | 89 (11 cross-lens duplicates merged) |
| Verified in code | 35 confirmed (3 high, 22 medium, 10 low after verifier re-ranking) |
| Passed through unverified | 53 (25 medium, 28 low) |
| Refuted | 1 |

---

## Deliberately not done

**Split the staff stylesheet off the public pages** (finding 38, medium).
`pages/_app.js` imports the whole 141KB / 722-rule `globals.css` globally, so
/welcome, /repair, /phone-guide and /portal all ship the staff app's CSS —
and /welcome then inlines its own complete `SKY_CSS` on top anyway.

The finding is real and the fix is known: move the staff-only bulk into a sheet
that only `AppShell` links, and teach the harness to load both. It is not done
because it is a restructuring of every rule in the file, the harness checks
geometry and contrast rather than "does this still look right", and it was the
last item in a long session — exactly the combination that ships a subtle
regression nobody notices for a week. The payoff is a faster first paint on
pages that already inline what they need.

Worth doing, on its own, with screenshots of every surface before and after.
Not worth doing tired, at the end of a queue.
