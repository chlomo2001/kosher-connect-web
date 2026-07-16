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

## Requested features (buildable)

4. **Filter + Sort on every tab** — mirror the Customers-tab control on Rentals, SIMs,
   VNs, Bookings, Repairs, Services, Shop, Tasks. Buildable now; a shared control.
10. **IVR provider list** — make Elid/OpenBPX a config-driven list. Small, buildable now.
9.  **In-app contact converter** — VCF/CSV/Excel ↔ phone formats, UK-prefix fix, cleaner.
    Buildable as a client-side (offline) web tool; needs the exact format specs from
    his existing PC apps to match their behaviour.
8.  **Kol Torah CD module** — new module; needs a short scoping session (what does he
    track: titles, stock per shul, conversion jobs, payments/consignment?).

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
