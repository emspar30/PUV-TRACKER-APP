# Task: shared multicabs (abang) and selfie-based driver registration

You are working in the Tunton repository (Android app, Supabase backend, admin panel, SMS worker). Implement two changes on the **driver side**:

1. **Abang support.** One multicab (one plate) may be driven by 2 to 3 different drivers. Each driver keeps their own driver ID (DRV-0025, DRV-0026, ...) and their own phone number, but several drivers may share the same plate.
2. **New driver registration proof.** The driver no longer uploads a "CTTMD/CTTDM ID" photo. They take a **selfie holding an LTFRB document** (the old Driver's Academy ID or the Driver's Academy certificate), plus the existing multicab photo with the plate visible. An admin reviews it with a checklist.

Read this whole file before you start. The final defense is on **November 26, 2026**, so prefer small, safe changes over redesigns.

## 1. Background (why this is changing)

- Multicabs in Butuan are PUVs under the **LTFRB**, not the CTTMD (the CTTMD handles tricycles). Every mention of a "CTTMD ID" or "CTTDM ID" for drivers is wrong and must go.
- The LTFRB stopped issuing the Driver's Academy ID in 2024. Some drivers still hold the old ID; others only have the **Driver's Academy certificate**. The LTFRB gave the team a **list of drivers who received the certificate**, but the list may include drivers who no longer operate.
- In Butuan, several drivers often share one multicab in shifts ("abang"). Today the app treats the plate as unique, so a second driver of the same multicab cannot register. In the admin panel, the driver ID (DRV-0025, DRV-0026) is already an incremental ID; keep it.
- The driver app header currently shows "VEHICLE PLATE  TEST005" with the route badge. Keep that look.

## 2. Ground rules

- Read `CLAUDE.md`, `docs/PRD.md`, `docs/SCOPE_AND_LIMITS.md`, `docs/PROPOSAL_TRACEABILITY.md` and any privacy or driver docs first, and follow the repo's own conventions.
- **Never read, change or commit the manuscript files** (`docs/Manuscript_*`, any manuscript PDF). Never push.
- **Do not invent results or behavior.** If you cannot confirm how something works, say so in the report.
- Database changes go in a **new migration file**. Never edit an old migration. **Do not apply migrations to the remote/production Supabase project** and do not run `supabase db push`; tell me the exact command to run instead.
- Prefer dependencies that are already installed. If a change needs a **new native module** (anything that requires a new prebuild or native rebuild), **stop and ask me first**.
- **No automatic OCR, face recognition or document classification.** Verification stays a human decision (privacy and reliability reasons). Do not add any model.
- **Never import or store the LTFRB list** in the database, app or repo. The admin checks names against it outside the app. This was promised to the LTFRB in writing.
- Work on a new branch `feat/abang-selfie-registration`. Commit in small logical commits.

## 3. Phase 1: audit first (no code changes yet)

Find and list, with file paths and line numbers:

1. Every **unique constraint or unique index** involving the plate (tables, migrations, RLS, RPCs, edge functions).
2. Every place that **looks up a driver, device, beacon, SMS recipient or map marker by plate** and assumes one row (for example `.eq('plate', x).single()`, `maybeSingle()`, a `Map` keyed by plate, a plate used as a primary key or beacon identifier).
3. How the **beacon identity** is defined and how a commuter relay is matched to a vehicle (by device, by driver, or by plate).
4. How **SMS waiting counts** pick recipients, and whether the server knows if a driver's beacon is currently on (heartbeat, status SMS, last seen, or nothing).
5. The **registration flow**: screens, consent text, photo capture (camera vs gallery), storage bucket, admin review screen, decision record, photo deletion job.
6. Every user-facing or doc string mentioning **CTTMD, CTTDM**, or "driver ID photo".
7. The **Retire** action in the admin panel: what it deletes or disables.

Write the audit and your implementation plan to `docs/DRIVER_CHANGES_PLAN.md`. Then continue to Phase 2 without waiting, **unless** you hit one of the decisions listed in section 6.

## 4. Phase 2, part A: multiple drivers per plate (abang)

1. **Remove the unique constraint on plate.** Keep the plate column; it is still required.
2. **Normalize plates** on write and on compare: uppercase, trim, collapse inner spaces to one space (so "abd8909", "ABD 8909" and "ABD  8909" compare equal; decide on one canonical form and use a single helper for it everywhere, app and backend).
3. **Keep the phone number unique among active (non-retired) drivers.** One person, one phone, one account.
4. **Block exact duplicates**: the same phone cannot register the same plate twice (unique on normalized plate + phone, among active drivers).
5. **Fix every plate-based lookup** found in the audit so it uses the driver ID or the device record instead, and never assumes a single driver per plate.
6. **One active beacon per plate.** If a driver turns on the beacon while another driver of the same plate is already active, show: "Another driver is active on [PLATE]. Take over this unit?" On yes, the other driver's session for that plate ends. If the driver side is offline and the server cannot know who is active, do the check when online only, and document the limitation; do not invent a mechanism.
7. **Map markers and relays** must stay correct when two drivers share a plate. One multicab should never show as two markers because of shared plates. Explain in the report how you guaranteed this.
8. **SMS waiting counts** go only to drivers who are currently active (beacon on), if the server can know that. If it cannot, keep the current recipient rule and say so in the report; do not send to every driver of a plate by default.
9. **Retire** affects only that one driver. Retiring DRV-0026 must not affect DRV-0027 on the same plate.
10. **Admin drivers table**: add a small "Also on this plate: DRV-0027" note (or a count) per row. Keep the existing columns (Driver ID, Plate, Route, Number, Set up, View, Retire).

## 5. Phase 2, part B: selfie registration with an LTFRB document

**Driver app, registration screen**

1. New field: **"Full name (as written on your document)"**, required.
2. New choice: **"Your LTFRB document"** with exactly two options:
   - "Driver's Academy ID (old LTFRB ID)"
   - "Driver's Academy certificate (LTFRB)"
3. **Photo 1: selfie holding the chosen document**, so that the face and the name on the document are both visible. **In-app camera only, no gallery option.** Record the capture time.
4. **Photo 2: the multicab with the plate visible.** Unchanged, still required for every driver, including a second driver of an already-registered plate.
5. Short guidance under the selfie button: "Hold your document next to your face. Make sure your name on the document can be read. You may cover your address with your finger."
6. Remove every "CTTMD/CTTDM ID" label and replace it with the wording above.

**Consent screen** (rewrite the photo consent). It must say, in plain words:
- A selfie holding an LTFRB document and a photo of the multicab are taken to confirm the person is a real PUV driver.
- Only the Tunton research team's admin account can see them.
- Both photos are deleted as soon as the registration is approved or rejected; only a text record of the decision and its date is kept.
- The full name is kept only while the driver takes part, like the phone number and plate.
- The driver must agree before going on.
Keep the existing Data Privacy Act (R.A. 10173) reference.

**Admin review screen**

Show the selfie, the multicab photo, the typed name, the chosen document type, the plate and the route, and a checklist with Pass / Fail / N/A for each:

| Check | Rule |
|---|---|
| Document type | Looks like the LTFRB sample of the chosen type |
| Name match | Name on the document matches the typed name |
| On LTFRB list | Name is on the LTFRB Driver's Academy list (checked by the admin outside the app) |
| Face match | Face matches the photo on the old ID. N/A for the certificate (it has no photo) |
| Plate match | Plate in the multicab photo matches the typed plate, and it is a multicab |

- **Approve** is enabled only when Document type, Name match, On LTFRB list and Plate match are Pass, and Face match is Pass (old ID) or N/A (certificate).
- **Reject** requires choosing a reason from the failed checks.
- **Decision record** stores: driver ID, decision, the result of each check, document type, reviewer, date. It must **not** store any image, and must **not** store anything from the LTFRB list beyond the Pass/Fail result.
- **Photo deletion**: keep or extend the existing behavior so both photos are deleted right after approve or reject. Verify the deletion actually happens (test or code path with evidence).
- The **driver ID** (DRV-00xx) stays automatically assigned by the system. Nobody types it.

**Out of scope (do not build):** OCR, face recognition, automatic list matching, an in-person registration code, LTO license checks.

## 6. Stop and ask me if

- A new native module or a native rebuild is needed.
- The beacon identity is the plate itself and changing it would affect commuter relays already in the field.
- A data migration would change or delete existing driver rows (for example the test drivers TEST005, TEST006, ABD 8909).
- Anything in `docs/PRD.md` or `docs/SCOPE_AND_LIMITS.md` directly contradicts this task.

## 7. Tests and docs

- Run the existing test suite before and after. Add tests for: plate normalization; two drivers with the same plate and different phones both registering; the same phone + same plate rejected; plate lookups returning the right driver; Retire affecting only one driver; the Approve rule (certificate with Face N/A passes; old ID with Face Fail is blocked); the decision record containing no image fields; photos deleted after a decision.
- Run the type checker and linter the repo uses.
- Update `docs/PRD.md`, `docs/SCOPE_AND_LIMITS.md`, `docs/PROPOSAL_TRACEABILITY.md`, the privacy docs, and the feature row in `docs/TESTER_SURVEY.md` that mentions the CTTMD ID (new wording: "Driver app: registration with a selfie holding an LTFRB document, and a multicab photo"). Do not touch the manuscript.

## 8. Finish

1. `git status`: only files related to this task changed.
2. Commit on `feat/abang-selfie-registration`. **Do not push.**
3. Reply in 20 lines or fewer:
   - what changed (database, driver app, admin, SMS, docs);
   - the migration file name and the exact command for me to apply it;
   - test results (passed / failed counts);
   - every limitation or behavior you could not confirm (especially beacon-on knowledge for SMS and takeover when offline);
   - anything I must check on a real phone.
4. End with: **"Driver changes ready. Waiting for your review."** Then stop.
