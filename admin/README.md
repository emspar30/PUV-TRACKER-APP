# Tunton admin console

A small web page where the research team reviews driver registrations (PRD 9.5; DRG5 in `docs/IMPLEMENTATION_PLAN_DRIVER_REGISTRATION.md`). Signed in with the one admin account (D4), it shows:

- **Registrations:** the ones waiting for review, oldest first, each with the CTTDM ID photo, the multicab photo with the typed plate under it, the route and the number. **Approve** sends the driver one text ("You're approved. Open Tunton Driver while connected to the internet."). **Reject** needs a reason, which the driver sees. Both photos are deleted at the decision (D1). Below the queue are the decided registrations.
- **Drivers:** the active driver phones, with **Retire** (the phone stops working at once and the multicab gets a new beacon secret, as `scripts/retire-device.ts` does).
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
