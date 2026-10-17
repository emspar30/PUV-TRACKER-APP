# SMS worker (DR6)

The worker turns live commuter check-ins into the waiting-count texts that driver phones receive (PRD 9.6). It runs on the team PC (plan Q3), talks to Supabase with the service role, and serves the gateway phone over HTTP. The gateway phone sends the texts; the worker never sends an SMS itself.

Every 30 s (`WORKER_CYCLE_S`) it:

1. reads the live waiting counts per route and stop;
2. for each route with an active driver phone, lists every stop of the route in riding order with its count (zeros included) and applies the dispatch rule (first of the day, a change of 2 or more, an empty stop that gets someone, every 5 minutes while anyone waits, one "cleared" message; at any hour since 2026-10-18, owner; it was 05:00 to 21:00 Manila);
3. for each phone on the route, reserves its sequence numbers, signs the messages with that phone's own key, encodes them as data or text SMS, and queues them (they expire after 10 minutes unsent);
4. checks the gateway's health and records alerts in `ops_alerts` (read in the dashboard; nobody is notified).

Code: `src/cycle.ts` (the cycle), `src/http.ts` (the gateway API), `src/health.ts` (alerts), `src/supabaseDeps.ts` (the database), `src/main.ts` (timer and server). The rules themselves live in `src/shared/sms/` and are shared with the apps. Tests: `__tests__/` (`npx jest services/sms-worker`), all with fake dependencies.

## Settings

Put them in `services/sms-worker/.env` (git-ignored, never committed). Missing values are also looked up in the repository's `.env`, where `EXPO_PUBLIC_SUPABASE_URL` stands in for `SUPABASE_URL`.

| Name | Value |
| --- | --- |
| `SUPABASE_URL` | The project URL (`https://….supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | The service role key. **Secret:** it bypasses every database rule. Only on the team PC |
| `SMS_PRIMARY_ENCODING` | `data` or `text`. Chosen with the carrier test (DR5-M5). Until then, `data` (it reached a Smart/TNT phone in DR5-M1) |
| `PORT` | Optional; 8787 by default |

The worker refuses to start if one is missing, and never prints a value.

## Run it

Development:

```
npm run worker:dev                                 # the worker, from the TypeScript source
npx tsx scripts/fake-gateway.ts                    # a stand-in gateway: pulls, prints, reports sent and delivered
npx tsx scripts/dev-checkin.ts --route R4 --station SMB   # a check-in as the team test account
npx tsx scripts/dev-checkin.ts --end               # end it ("I boarded")
npx tsx scripts/fake-gateway.ts --retire           # afterwards: switch the development gateway GW-99 off
```

The fake gateway registers a development gateway `GW-99` with a token it keeps in memory. Never run it while the real gateway is on: both would take messages from the same queue.

The team PC runs the one-file bundle (no `node_modules` needed to run it):

```
npm run worker:build                               # makes services/sms-worker/dist/worker.cjs
powershell -ExecutionPolicy Bypass -File scripts\run-worker.ps1
```

`run-worker.ps1` restarts the worker 10 s after it stops, and writes each day's output to `services/sms-worker/logs/worker-<date>.log`.

## Team PC (Q3)

1. **Node 22 or 24 LTS.** Check with `node --version`.
2. **Settings:** `services/sms-worker/.env` as above.
3. **Start at sign-in:** Task Scheduler, Create Task: trigger "At log on"; action `powershell.exe` with arguments `-ExecutionPolicy Bypass -File "<repo>\scripts\run-worker.ps1"`, start in `<repo>`; "Run whether user is logged on or not" off (it needs the signed-in session's files).
4. **No sleep during SMS hours:** Settings, System, Power: screen may turn off, but "Sleep" must be **Never** while plugged in. SMS hours are all day since 2026-10-18 (owner; they were 05:00 to 21:00).
5. **Reaching it from the gateway phone:**
   - development, over USB: `adb reverse tcp:8787 tcp:8787`, and the gateway's setup code uses `http://localhost:8787`;
   - the pilot: a **Cloudflare Tunnel** (`cloudflared`, installed on the PC only) gives the worker an `https://` address; the gateway's setup code uses that address. Release builds of the gateway accept HTTPS only.
6. **Check it:** open `https://<tunnel address>/healthz` in a phone browser: it says `ok`.

## The gateway's API (plan section 6.4)

| Request | Body | Answer |
| --- | --- | --- |
| `GET /healthz` | — | `ok` (no token, no data) |
| `POST /v1/pull` | `{ "max": 10 }` | `{ "messages": [{ "id", "to", "encoding": "data", "dataB64", "port" } or { …, "encoding": "text", "text" }] }` |
| `POST /v1/result` | `{ "id", "status": "sent" \| "delivered" \| "failed", "errorCode"?, "atMs" }` | `204`; `409` if that message is not the gateway's to report |
| `POST /v1/heartbeat` | `{ "batteryPct", "charging", "simReady", "signalLevel", "queueLocal", "appVersion" }` | `{ "pullEveryS": 10 }` |

Every `/v1` request needs `Authorization: Bearer <gateway token>`. A missing or wrong token gets `401` with no detail; a body over 4 KB gets `413`. A failed message goes back to the queue until its third attempt.

## Reading the logs

One JSON line per event: `at`, `level` (`info`, `warn`, `error`), `message`, and fields such as `routeId`, `reason` (`first`, `change`, `interval`, `cleared`), `phones`, `messages`. Phone numbers are masked (`+63917•••4567`); keys and tokens never appear. To check a log file for a full number: `Select-String -Path services\sms-worker\logs\*.log -Pattern '\+639\d{9}'` must find nothing.

| Message | Meaning |
| --- | --- |
| `worker started` | Settings read, server listening |
| `queued` | A route's texts were queued (`reason`, number of `phones` and `messages`) |
| `alert recorded` | A health problem went into `ops_alerts` (`kind`: `gateway_heartbeat`, `gateway_failures`, `latency_p90`) |
| `could not build messages for a phone` | One phone was skipped this time (others still got theirs) |
| `cycle failed` | The database could not be reached this cycle; the next one tries again |
