# Phase 2 — captured notes & feasibility (2026-07-16)

Raw thoughts from the owner's side, before Phase 2 begins. Feasibility notes are mine
(Claude), kept honest so we don't over-promise.

## Business context (new — informs everything)

- **Kol Torah Manchester** (recently acquired). Sells audio CDs in several shuls
  around town; also copies CDs → MP3 / SD cards, and does audio work via iTunes /
  MediaMonkey. → A distinct product line, likely its own module (title catalogue,
  per-shul consignment/stock, conversion jobs, takings per shul).
- **Phone-migration service.** Converts contacts between phones (e.g. Nokia C2-01 →
  a Fig "core" phone) using a set of PC apps: `xml→fig`, `VCF UK-prefix converter`,
  `Excel→VCF`, `CSV→VCF offline`, `NokiaB→VCF`, `VCF cleaner`. → Candidate to fold
  into the app as an in-browser contact-conversion utility (offline, no upload of
  personal contacts to a server).
- **IVR.** Currently offers only **Elid** and **OpenBPX** as options; needs to be an
  editable/extensible provider list he can add to.

## Requested features

### 4. Filter + Sort on every tab — ✅ BUILT (this session)

A shared `kcFilterSort()` / `kcViewApply()` control (public/main.js) now gives every
list tab the same two-dropdown filter + sort that Customers has:

| Tab | Filter | Sort |
| --- | --- | --- |
| Customers | (existing, unchanged) | (existing, unchanged) |
| Rentals | keeps its rich existing filters | **+ sort** (default / customer / due / most-owed / price) — default = no reorder, so nothing changes until you pick |
| SIM Plans | keeps its existing filters | **+ sort** (customer / renewal soonest·latest / provider / recent) |
| Bookings | **+ filter** (all / upcoming / completed / cancelled) | **+ sort** (travel soonest·latest / customer / recent / price) |
| Repairs | filter folded into the shared control (all / open / ready / collected / cancelled) | **+ sort** (recent / oldest / customer / total / status) |
| Online & Print | **+ filter** (all / today / last 7 days) | **+ sort** (recent / oldest / customer / total / service) |
| Shop | **+ filter** (all / low·out / in-stock) | **+ sort** (name / qty ↑·↓ / price / profit) |
| Virtual Numbers | **+ filter** (all / active / inactive / billing on) | **+ sort** (number / customer / monthly / platform / recent) |
| Tasks | **+ filter** (all / manual / auto / with-customer / overdue) | **+ sort** (smart / due / recent / A–Z) |

Selections persist in-memory per tab (survive re-renders). Verified: 32 unit tests +
a filter/sort core harness (5/5) + clean production build.

### 10. IVR / phone providers — ✅ BUILT (this session)

The virtual-number **Platform** used to be hard-coded (`elid / FreePBX / Other`). It's
now an owner-managed list:

- New settings key **`ivr_platforms`** (CSV) — migration
  `20260716140000_ivr_platforms.sql` seeds `elid,FreePBX,Other`. **Apply on deploy.**
- **Settings → Connectivity → "📞 IVR / phone providers"** card: edit the comma-separated
  list, shown as chips. Owner-only; server sanitises + de-dups.
- The **"Platform / IVR provider"** dropdown on a new virtual number is populated from
  this list; `pages/api/virtual-numbers.js` validates writes against it (safe fallback to
  the defaults if the setting is missing). Existing numbers keep their provider even if
  it's later removed from the list.
- So he can add **OpenBPX**, 3CX, Twilio, or any future provider without a code change.

### 9. Contact converter — integration suggestions (NOT a rebuild)

His offline PC apps already work (`xml→fig`, `VCF UK-prefix converter`, `Excel→VCF`,
`CSV→VCF offline`, `NokiaB→VCF`, `VCF cleaner`). Per his steer, we don't rebuild them —
we fold their *output* into the system so a migration job is tracked and billed:

1. **Log each migration as a service order.** Add a "Contact transfer / phone setup"
   line to the Online & Print price menu. When he migrates a customer's contacts, it's
   charged like any other service and lands on the customer's timeline + wallet — zero
   change to the converters themselves.
2. **Attach the VCF to the customer record.** The app already has customer documents
   (lib/documents.js). Save the exported `.vcf` (and/or the source export) against the
   customer, so next time they change phones the last-known contacts are one click away.
   VCF/CSV are already allowed document types.
3. **A "Contact Tools" reference card in Settings** — a small directory listing each
   offline app, what it converts (e.g. "Nokia C2-01 → Fig core"), and the local path, so
   any helper knows which tool to run for which handset. A launcher, not a rebuild.
   (Browsers are sandboxed — the web app can't start a Windows .exe — so this is a
   documented SOP + the job-logging above, which is the realistic "built-in" integration.)
4. **Only if he ever wants it in-app:** a thin, fully-offline in-browser VCF cleaner /
   UK-prefix fixer (no upload — contacts never leave the machine). Deferred, since his
   tools already do this; noted so the door stays open. Would need the exact
   input/output format specs from his apps to match their behaviour.

### 8. Kol Torah CD module — new module, needs scoping

Still needs a short scoping session (what does he track: titles catalogue, per-shul
stock/consignment, CD→MP3/SD conversion jobs, takings per shul, payments?).

## Needs owner input / has real limits

5. **"Deep-scan his Gmail accounts / Chrome history / Drives."**
   - Gmail + Google Drive: I *can* read them **if** those connectors are authorised in
     this session. It's a person's private mail, so I want an explicit go-ahead + a
     scope (which accounts, read-only, what I'm looking for) before doing a broad sweep.
   - **Chrome history is not reachable** unless it's exported to a file I can read.
6. **"Upload a video of the office."** — I can't watch video here. I *can* look at
   **still photos / screenshots** placed in the repo or shared, and reason about the
   space from those.
7. **"Weekly stock video that recognises stock status."** — Full shelf-video computer
   vision is unreliable to build and maintain. Dependable alternative: a weekly
   **stock-count reminder** + a **photo-per-shelf** the app logs, and/or lean on the
   **barcode scanner already in POS** for counts. Worth designing the lighter version.

## Status

11. The Stripe / design-critique workflow isn't running — it completed in an earlier
    session (design research + adversarial critic panel). Can re-run a fresh Phase-2
    design critique on request.
