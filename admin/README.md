# Tunton admin console

A small web page where the research team reviews driver registrations (PRD 9.5; DRG5 in `docs/IMPLEMENTATION_PLAN_DRIVER_REGISTRATION.md`). Signed in with the one admin account (D4), it shows:

- **Registrations:** the ones waiting for review, oldest first, each with the selfie holding the driver's LTFRB document (Driver's Academy ID or certificate), the multicab photo with the typed plate under it, the typed full name, the document type, the route and the number. The admin marks five checks Pass, Fail or N/A: Document type, Name match, On LTFRB list (checked outside the console; nothing from the list is saved), Face match (N/A for the certificate) and Plate match. **Approve** opens only when Document type, Name match, On LTFRB list and Plate match pass, and Face match passes (old ID) or is N/A (certificate); the database checks the same rule. It sends the driver one text ("You're approved. Open Tunton Driver while connected to the internet."). **Reject** needs a failed check and a reason picked from the failed checks, which the driver sees. The checks are kept with the decision; no image and nothing from the LTFRB list is. Both photos are deleted at the decision (D1). Below the queue are the decided registrations.
- **Drivers:** the active driver phones, with **Retire** (the phone stops working at once; the multicab gets a new beacon secret only when no other driver of it stays active). A multicab may have 2 or 3 drivers (abang), each with their own driver ID; each row says "Also on this plate: DRV-0027" when another driver shares the plate. Approving a registration for a plate that already has a driver adds the driver to the same multicab instead of replacing the phone.
- **Settings:** the admin PIN of the pilot driver phones (D5). Approving stays off until it is set.

It is React built with Vite, in the repository's own `package.json`. It uses `src/shared`, `src/strings/en.ts` (the `adminConsole` block) and the app's colour tokens; lint stops it from importing anything else from the apps. Everything goes through the `console_*` database functions, which refuse any account that is not in `admin_accounts`, and the private photo bucket, which only that account may read.

## Making the admin account (once)

1. Supabase dashboard, **Authentication, Users, Add user, Create new user**: the email and a strong password, with **Auto Confirm User** on.
2. Copy the new user's **UID** from the list.
3. **SQL Editor**: `insert into public.admin_accounts (user_id) values ('<UID>');`

More accounts can be added later the same way. Any other account can sign in but sees nothing: every list answers "This account is not the admin account".

## On the team PC

```bash
npm run admin:dev
```

Open <http://localhost:5173>. It reads `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the repository's `.env` (no other value from that file reaches the page). Changes to the code show at once.

`npm run admin:build` writes the finished page to `admin/dist` (git-ignored).

## Hosted on Render

`render.yaml` holds a second service, `tunton-admin`, a free static site next to the worker.

1. Push to GitHub. The Blueprint creates `tunton-admin` by itself (if it does not: **Blueprints**, the Tunton Blueprint, **Manual sync**).
2. In the Render dashboard, `tunton-admin`, **Environment**: add `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, the same values as in `.env`. Both are public (they ship in the apps), but they stay out of the repository like the worker's settings.
3. **Manual Deploy, Deploy latest commit**, so the page is built with them.
4. Open `https://tunton-admin.onrender.com` (the address Render shows) and sign in.

A static site does not sleep. It rebuilds by itself when `admin/`, the shared code, the strings or the packages change. Pushing also redeploys the worker when the packages change (its build filter includes `package.json`).

## First use

**Settings**, then set the admin PIN (6 digits) twice and **Save PIN**. It goes into every setup a phone collects from then on; phones already set up keep the PIN they have. The page sends only its salted hash.

## Keeping it safe

- The console's power is the admin account: a strong password, and **Sign out** on a computer others use.
- The page loads nothing but itself and the Supabase project (the content security policy in `render.yaml`), and asks search engines not to list it.
- Photo links work for 5 minutes (`CONSOLE_PHOTO_LINK_TTL_S`), and the photos are deleted at the decision.

## Two-step sign-in (2026-11-22)

After the email and password, the console asks for a 6-digit code from an authenticator app
(Google Authenticator, Microsoft Authenticator or similar). The first sign-in shows a QR code to scan;
after that, every sign-in asks for the current code. The database refuses every admin action from a
session without it (migration `20261122000002_admin_mfa.sql`), so a stolen password alone opens
nothing.

- Apply that migration only once the console in use has the two-step screen (this branch, locally with
  `npm run admin:dev`, or the hosted console after a push). Otherwise the admin cannot sign in.
- Backup authenticators: Settings, Two-step sign-in, "Add a backup authenticator" sets up the same
  account on a second phone (up to 3 in all). With more than one, the code screen asks which app the
  code comes from. The last one cannot be removed.
- Lost the phone with the authenticator app: sign in with a backup authenticator, then remove the lost
  one on Settings. Lost every one: in the Supabase dashboard open Authentication, Users, the admin
  account, and delete its MFA factors; the next sign-in sets it up again.

## Idle sign-out (2026-11-22)

The console signs out after 20 minutes without a click, key press, scroll or touch
(`ADMIN_IDLE_SIGNOUT_MIN`), and the sign-in page says why. This keeps a console left open on a shared
PC from staying signed in.

## Admin activity (2026-11-22)

Settings lists the newest 50 admin actions: approvals, rejections, retired phones and PIN changes,
with who (You, another admin, or System for the SQL editor and scripts) and when. Database triggers
write it (migration `20261122000003_admin_log.sql`), so every path is recorded, and no one can edit or
delete it.
