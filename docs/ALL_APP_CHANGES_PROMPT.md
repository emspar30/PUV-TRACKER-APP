# Task: apply all planned changes to the Tunton commuter app, driver app and admin panel

You are working in the Tunton repository (Android app, Supabase backend, admin panel, SMS worker). These changes come from the final defense panel's comments and from our field test on a real multicab. Work **phase by phase**, in the order below. Read this whole file before you start.

## 1. Ground rules

- Read `CLAUDE.md`, `docs/PRD.md`, `docs/SCOPE_AND_LIMITS.md`, `docs/PROPOSAL_TRACEABILITY.md` and any privacy or driver docs first, and follow the repo's conventions.
- **Never read, change or commit the manuscript files** (`docs/Manuscript_*`, any manuscript PDF). **Never push.**
- **Do not invent behavior or results.** If you cannot confirm how something works, say so.
- Every phase on its **own branch** (names below), branched from the previous phase's branch. Small logical commits.
- **Database:** only new migration files; never edit an old migration. **Never apply migrations to the remote/production Supabase project** and never run `supabase db push`; give me the exact command instead. Never delete or rewrite existing driver rows (test drivers TEST005, TEST006, ABD 8909 must keep working).
- **No new native module or prebuild** without asking me first.
- **No OCR, face recognition, document classification or any model.** Driver verification is a human decision.
- **Never import or store the LTFRB driver list** in the database, app or repo. The admin checks names outside the app (promised to the LTFRB in writing).
- Run the existing tests, type checker and linter **before and after each phase**. A phase is done only when they pass.

## 2. Phase 0: audit (no code changes)

For every item in Phases 1 to 5, check whether it already exists, with evidence (file path and line numbers, test, migration). Status: DONE / PARTIAL / NOT BUILT / NOT FOUND. Also record:
- every relay end or pause rule today, with its constants (speed, time, distance from route, beacon loss, destination);
- how ETA is computed (`eta.ts` and callers) and the "hidden under 5 km/h" rule;
- every unique constraint or lookup that assumes one driver per plate;
- how the beacon identity is defined and how a relay is matched to a vehicle;
- where fares and discounts are defined;
- how the beacon advertises (library, mode, transmit power, interval).

Write it to `docs/APP_CHANGES_PLAN.md`, then continue to Phase 1 **unless** you hit a stop condition in section 8. Skip any item that is already DONE.

## 3. Phase 1: selfie with an LTFRB document (branch `feat/selfie-ltfrb`)

Skip the parts already done on `feat/selfie-ltfrb-wording` if that branch exists; build on it.

**Driver app, registration**
1. Replace every "CTTMD ID", "CTTDM ID" or "driver ID photo" (driver app, admin, consent, docs) with the new wording.
2. New field: **"Full name (as written on your document)"**, required.
3. New choice: **"Your LTFRB document"**: "Driver's Academy ID (old LTFRB ID)" or "Driver's Academy certificate (LTFRB)".
4. **Photo 1: selfie holding the chosen document**, face and name visible. In-app camera only, no gallery; front camera by default if supported without native changes. Record the capture time. Guidance: "Hold your LTFRB document next to your face. Make sure your name on the document can be read. You may cover your address with your finger."
5. **Photo 2: the multicab with the plate visible.** Unchanged.

**Consent text** (plain words; keep the R.A. 10173 reference): the selfie and multicab photo confirm the person is a real PUV driver; only the research team's admin can see them; both photos are deleted once the registration is approved or rejected, keeping only a text record of the decision and date; the full name is kept only while the driver takes part.

**Admin review**
6. Show the selfie, multicab photo, typed name, document type, plate and route, with **Pass / Fail / N/A** per check:

| Check | Rule |
|---|---|
| Document type | Looks like the LTFRB sample of the chosen type |
| Name match | Name on the document matches the typed name |
| On LTFRB list | Checked by the admin outside the app |
| Face match | Matches the old ID photo; **N/A for the certificate** |
| Plate match | Plate in the photo matches the typed plate, and it is a multicab |

7. **Approve** only when Document type, Name match, On LTFRB list and Plate match are Pass, and Face match is Pass (old ID) or N/A (certificate). **Reject** requires a reason from the failed checks.
8. **Decision record**: driver ID, decision, each check result, document type, reviewer, date. **No image fields, nothing from the LTFRB list.**
9. **Both photos deleted** right after approve or reject. Prove it with a test or code path.
10. Driver ID (DRV-00xx) stays system-assigned.

## 4. Phase 2: stops, detours, Track view and ETA (branch `feat/relay-stops-detours`)

Field test context: the marker was correct, but arrival was delayed by unloading stops, traffic lights and traffic, and the multicab sometimes left its route line (for example, to a gas station). We do **not** want hand-mapped traffic zones; use signals the app already has.

Rules (make every number a named constant in one config place):
1. **Stopped is not ended.** While the commuter's phone still detects the driver's beacon, the relay continues even at 0 km/h.
2. **Short detours allowed:** up to **300 m** from the route polyline and **10 min**. During a detour, the map icon stays at the last on-route position and the ETA is paused.
3. **The relay ends only on:** beacon lost for a set time (use the existing value if there is one; otherwise propose one and explain), destination reached, manual stop, or detour limit exceeded.
4. **Map icon stays simple** (position only). The status ("Moving", "Stopped · 2 min", "Off route · temporary"), the ETA or "ETA paused", and "Updated x s ago" appear **only in the Track view**.
5. **ETA:** speed from moving time only, plus a small expected stop time per remaining stop or per km (propose the value, explain it, make it a constant). Stops must neither freeze nor break the ETA. Replace or adjust the "hidden under 5 km/h" rule accordingly.
6. Alerts ("Did you board?", 1 km to 100 m alerts, "Get ready to get off") must keep working while the multicab is stopped.
7. **Field test logging (privacy-safe, debug builds only or behind a setting):** predicted ETA at each update and the actual arrival time, and relay-to-map delay. No identity, no raw positions kept beyond the existing retention.

Tests: stopped with beacon (relay continues), beacon lost (relay ends after the limit), detour under and over the limits, ETA with stops, status labels.

## 5. Phase 3: shared plates, "abang" (branch `feat/abang`)

One multicab (one plate) may be driven by 2 to 3 drivers, each with their own driver ID and phone.
1. **Remove the unique constraint on plate** in a new migration. Keep plate required.
2. **Normalize plates** with one helper used everywhere (app and backend): uppercase, trim, collapse inner spaces.
3. **Phone unique among active (non-retired) drivers.** Block the same phone + same plate twice.
4. Fix every plate-based lookup found in Phase 0 to use the driver ID or device record.
5. **One active beacon per plate:** "Another driver is active on [PLATE]. Take over this unit?" On yes, the other driver's session ends. If the server cannot know who is active while offline, check only when online and document the limitation.
6. One multicab must never show as two markers. Explain how you guaranteed it.
7. **SMS waiting counts** only to the currently active driver if the server can know it; otherwise keep the current rule and say so. Never send to every driver of a plate by default.
8. **Retire** affects only that one driver.
9. Admin drivers table: add "Also on this plate: DRV-0027" (or a count). Keep existing columns.

Tests: normalization; two drivers same plate both register; same phone + same plate rejected; lookups return the right driver; Retire affects one driver; takeover.

## 6. Phase 4: fares and engagement (branch `feat/fares-feedback`)

1. Move all fares and discounts (students, senior citizens, PWDs) into **one config file** if they are not already, with a comment naming the source and date. Do not change the amounts; we will update them when the LTFRB PUJ General Fare Guide arrives.
2. Add an in-app link to the evaluation or feedback survey (a placeholder URL constant I will fill in).

## 7. Phase 5: driver beacon battery (branch `feat/beacon-battery`)

1. Report the current advertise mode, transmit power and interval.
2. Propose lower-power settings that should still let commuters' phones detect the beacon inside a multicab. Put them behind constants; **do not make them the default** until we retest in a real multicab.
3. Write a battery test procedure in `docs/APP_CHANGES_PLAN.md`: same phone, beacon on vs off, 1 to 2 hours, % per hour.

## 8. Stop and ask me if

- A new native module or native rebuild is needed.
- The beacon identity is the plate itself and changing it would affect relays already in the field.
- A migration would change or delete existing driver rows.
- `docs/PRD.md` or `docs/SCOPE_AND_LIMITS.md` directly contradicts a change.
- A phase's tests cannot be made to pass.

## 9. Docs

Update `docs/PRD.md`, `docs/SCOPE_AND_LIMITS.md`, `docs/PROPOSAL_TRACEABILITY.md`, the privacy docs, and the CTTMD row in `docs/TESTER_SURVEY.md` (new wording: "Driver app: registration with a selfie holding an LTFRB document, and a multicab photo"). Do not touch the manuscript.

## 10. Finish

1. `git status` on each branch: only files for that phase changed.
2. **Do not push.**
3. Reply in 25 lines or fewer:
   - per phase: done / skipped (already done) / stopped, with the branch name;
   - migration file names and the exact command for me to apply them;
   - test results per phase (passed / failed counts);
   - the thresholds you chose in Phase 2 and why;
   - every limitation you could not confirm (beacon-on knowledge for SMS, takeover when offline, front camera);
   - what I must check on a real phone and in a real multicab.
4. End with: **"All app changes ready. Waiting for your review."** Then stop.
