# Driver changes: audit and plan (abang and LTFRB selfie registration)

Task: `docs/DRIVER_CHANGES_PROMPT.md`. Branch: `feat/abang-selfie-registration`. Audit date: 2026-11-19.
Owner decisions so far: audit first, then choose the scope; keep the test drivers (TEST005, TEST006,
ABD 8909) untouched; stop for approval after each part. Multicabs fall under the LTFRB, not the CTTMD.

## 1. Audit

### 1.1 Plate uniqueness

There is no unique constraint on the plate itself. One driver per multicab is enforced through
the vehicle instead:

- `vehicle_id` is made from the route and the plate: `route || '-' || replace(plate, ' ', '')`
  (`supabase/migrations/20261027000000_driver_registration.sql:304`). One plate on one route is
  therefore always one vehicle.
- `driver_devices_one_active_per_vehicle`, a unique index on `driver_devices (vehicle_id) where active`
  (`20261013000000_driver_side.sql:52`), allows one active phone per vehicle.
- `admin_provision_driver` refuses a vehicle that already has an active phone
  (`20261013000000_driver_side.sql:420-423`).
- `registration_collect` retires every active phone on the same plate before it provisions the new
  one (`20261027000000_driver_registration.sql:364-371`). **This is what blocks abang today:** a
  second driver of the same multicab would switch off the first.
- The database already writes plates in one form: upper case, single inner spaces
  (`driver_registrations.plate` check, line 91; `registration_submit`, line 285). Comparisons drop
  the spaces (`replace(plate, ' ', '')`).

### 1.2 Lookups by plate

- `registration_collect` (line 368): it finds the phones to retire by plate. It must stop doing so.
- `console_registrations` (line 420): the console's "a phone is already on this plate" warning. It
  picks the newest one (`limit 1`) and could list all of them instead.
- `console_decide` (line 451): `replaces_device` records the newest phone on the plate (`limit 1`).
- No app, Edge Function or worker code looks up a driver by plate. The worker, ingest and map all
  use `vehicle_id` or `device_id`.

### 1.3 Beacon identity and relays

- The beacon belongs to the **vehicle**, not to the driver phone: `vehicle_beacons` has one row per
  `vehicle_id`, with one `short_id` and one secret in Vault (`20261013000000_driver_side.sql:24-29`).
- `beacon_check` / `beacon_verify` answer with the vehicle, its route and its plate
  (`20261014000000_beacon_verify.sql`). Relays and map markers are keyed by `vehicle_id`: ingest
  upserts `telemetry_latest` on `vehicle_id` (`supabase/functions/ingest/index.ts:67`).
- Each provisioning **replaces** the vehicle's beacon secret (`admin_provision_driver`, lines
  425-428). Retiring a phone also replaces it (`admin_retire_device`, lines 472-478).
- **Consequence for abang.** If drivers of one multicab share the vehicle (same `vehicle_id`), they
  must share its beacon secret. In that case:
  - Map markers stay one per multicab without extra work, because markers are keyed by vehicle.
  - A second driver's setup must reuse the existing secret, not replace it. Otherwise the first
    driver's beacon stops validating.
  - Retiring one driver must not replace the secret while another driver is active. Otherwise it
    breaks the other driver's beacon. This is the stop condition in the prompt's section 6: see
    decision Q1.

### 1.4 SMS recipients and "beacon on"

- `worker_devices()` returns every active phone with its route (`20261013000000_driver_side.sql:168-181`).
  The worker sends each route's counts to every active phone on that route.
- **The server cannot know whether a driver's beacon is on.** After setup, the driver app has no
  internet link to Tunton: SMS only goes from the gateway to the phone, and no heartbeat goes back.
  The only server-side sign of a multicab is a commuter relay, and that is per vehicle, not per
  driver.
- So "SMS only to the driver whose beacon is on" cannot be built without a new uplink. Under the
  current rule, both abang drivers of a multicab get the counts. See decision Q3.

### 1.5 Registration flow

- **Screen:** `src/driver/app/register.tsx`. It has a number check, the plate, the route and two
  photos. Both photos come from the in-app `CameraView` (`expo-camera`, already installed), with
  `facing="back"` (line 447). There is no gallery option today.
- **API:** `src/driver/features/registration/api.ts` and the Edge Function
  `supabase/functions/driver-registration/index.ts`.
- **Storage:** private bucket `driver-registrations`, JPEG only, 1 MB at most. Files are
  `<check id>/id.jpg` and `<check id>/vehicle.jpg` (`registration_submit`, lines 279-280). Only the
  admin may read or delete them.
- **Admin review:** `admin/src/Registrations.tsx` and `RegistrationCard.tsx`. Decisions go through
  `console_decide`, which accepts approve or reject with a free-text reason.
- **Decision record:** `driver_registrations` keeps the status, the reason, `decided_by`,
  `decided_at` and `photos_deleted_at`.
- **Photo deletion:**
  - `admin/src/api.ts:51-62` deletes both files right after the decision.
  - It checks the bucket when storage answers short.
  - Then it calls `console_photos_deleted`, which clears the paths and stamps the time.
  - There is no server-side cleanup job for photos.

### 1.6 CTTMD / CTTDM mentions

- `src/strings/en.ts`, lines 1636, 1655, 1656, 1928, 1930 and 1949 (driver app and admin wording).
- `admin/README.md:5`.
- `supabase/functions/_shared/serverConfig.ts:39` (a comment).
- `docs/PRD.md`, lines 581, 978, 1069 and 1203 (1203 is the change log; a new entry will be added,
  and the old entry stays).
- `docs/PROPOSAL_TRACEABILITY.md:51`.
- `docs/TESTER_SURVEY.md:120`.
- `docs/IMPLEMENTATION_PLAN_DRIVER.md` and `docs/IMPLEMENTATION_PLAN_DRIVER_REGISTRATION.md` are
  historical plans. They keep their text, plus a one-line note.
- `docs/SCOPE_AND_LIMITS.md` has no mention.

### 1.7 Retire

`console_retire(device, notice_ttl_min)` (`20261029000000_retire_notice_data.sql:16`) does the
following in one transaction:

1. It queues a signed "removed" data SMS to the phone.
2. It calls `admin_retire_device`, which marks the phone inactive and expires its queued SMS.
3. That call also overwrites the phone's SMS key in Vault.
4. It also **replaces the vehicle's beacon secret**.

Step 4 is the part that would break another driver on the same multicab.

## 2. Plan

### Part A: abang (multiple drivers per multicab)

All of Part A goes in one new migration. It changes no existing rows.

1. **Drivers share the vehicle.** Drop `driver_devices_one_active_per_vehicle`. In its place, add a
   unique index on `driver_devices (phone_e164) where active`: one phone, one active account. The
   vehicle keeps one beacon (`short_id` and secret), so the map shows one marker per multicab.
   - Before applying it, check that no two active rows share a number today (a query you run).
2. **Setup (`registration_collect`).** It retires only an active phone with the **same number**
   (the "Set up again" case), not every phone on the plate.
   - If the vehicle already has a beacon, the new driver receives the existing secret.
   - A new `admin_provision_driver` variant allows several active phones per vehicle and does not
     replace an existing beacon secret.
   - Same phone with the same plate: the old device is retired and the new one replaces it. That
     prevents duplicate accounts.
3. **Retire.** Retiring one driver replaces the beacon secret only when no other driver of that
   vehicle stays active (decision Q1).
4. **Admin.**
   - The Drivers table gets an "Also on this plate: DRV-0027" note.
   - The registration card lists every active driver on the plate.
5. **Plate form.** One shared helper in `src/shared` (upper case, trim, single spaces) is used by
   the app. The database keeps its check.
6. **Not built:**
   - The takeover dialog: the server cannot know who is on (1.4).
   - Per-driver SMS: see Q3.

### Part B: LTFRB selfie registration

1. **Migration** (new file):
   - `driver_registrations` gets:
     - `full_name`, required for new registrations and at most 80 characters;
     - `document_type`: `academy_id` or `academy_certificate`;
     - `checks`: jsonb holding Pass/Fail/N/A for document, name, list, face and plate, with no
       images and no list data.
   - Existing rows keep null in these columns.
   - A new `registration_submit` takes the name and the document type.
   - A new `console_decide` takes the checks and applies the approve rule on the server too:
     - document, name, list and plate must all be Pass;
     - face must be Pass for the ID, or N/A for the certificate;
     - a reject needs a failed check as its reason.
   - The full name is cleared when the driver is retired.
2. **Driver app:**
   - The name field and the two-option document choice are added.
   - The selfie uses the **front** camera, in-app only, with the capture time recorded.
   - The selfie gets its guidance text.
   - The multicab photo is unchanged.
   - The consent screen is rewritten as in the prompt, keeping R.A. 10173.
   - Storage paths stay the same (`id.jpg` now holds the selfie), so the bucket and the Edge
     Function's upload links do not change.
3. **Admin:**
   - The card shows the selfie, the multicab photo, the name, the document type, the plate and the
     route.
   - Each check gets a Pass/Fail/N/A control.
   - Approve stays disabled until the rule passes.
   - Reject offers the failed checks as reasons.
   - Photo deletion stays as in 1.5, with a test.
4. **Wording:** every CTTMD/CTTDM mention in 1.6 becomes LTFRB wording.

### Docs and tests

- **Docs:** PRD 9.5 and section 15, PROPOSAL_TRACEABILITY D3, SCOPE_AND_LIMITS (the
  limits in 1.4), and the TESTER_SURVEY row. The manuscript is not touched.
- **Tests:** the ones listed in the prompt's section 7, apart from the takeover. Migration tests
  read the SQL, as the existing ones do.
- **Release:** the driver app needs a new APK. No new native module is needed.
- **Applying:** the migrations are applied by the owner. The command is given at each step.

## 3. Decisions for the owner

**Answered 2026-11-19:**

| Question | Decision |
|---|---|
| Q1 | (a) Keep the secret while another driver of the multicab is active |
| Q2 | Skip the takeover dialog |
| Q3 | Send to all of the multicab's drivers, and record the cost as a limitation |
| Q4 | Part B (selfie registration) first; Part A after it, if time allows |

The options as they were put:

- **Q1. Retiring one abang driver.**
  - (a) Keep the beacon secret while another driver of the multicab is active. A lost, retired
    phone can then still advertise valid codes, unless it receives the retire SMS (which stops its
    beacon).
  - (b) Always replace the secret. Every other driver of that multicab must then "Set up again".
- **Q2. Takeover dialog.** Skip it: the server cannot know who is on. With a shared beacon, two
  phones on at once still show as one multicab.
- **Q3. SMS.** Both abang drivers of a multicab get the counts, as the current rule does. This
  doubles the SMS for that multicab against `SMS_GATEWAY_DAILY_CAP` (100). The alternative is new
  work: an online "I'm driving" check-in from the driver app.
- **Q4. Scope before Nov 26.** Part B only, Part A only, or both. Part B is smaller and visible in
  the demo. Part A changes the beacon setup on live phones.
