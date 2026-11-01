# Field tests E1 to E9 (PRD 0.2 S10, 3.3, 17.1)

How to run the pre-pilot field experiments, what to record, and which settings each result changes. The tools are built (2026-11-02); what remains is the rides.

Record every result in `docs/device-tests.md`, including when a target is missed. After each experiment, tune the values in `src/shared/config/index.ts`, or `app_config` on the server, and nothing else.

## The field test log in the app

On each test phone: **Menu → Demo & simulation → Field test log**, then turn **Recording** on. While it records, the app notes:

| Event | When | Used by |
|---|---|---|
| `relay_start`, `relay_end` | A relay starts and ends (route, live map or Crowdsource) | Relay hours |
| `battery` | At relay start and every 5 minutes while relaying (`FIELD_BATTERY_SAMPLE_MIN`) | E4 |
| `sent` | Bytes in each telemetry batch | E6 |
| `gap` | Back in the app after the phone stopped Tunton in the background (minutes) | E5 |
| `rssi` | Each Bluetooth reading of a multicab beacon, at most one every 2 s (`FIELD_LOG_RSSI_EVERY_S`) | E1, E2 |
| `verified`, `not_verified` | The verification window's result, the seconds it took, and the reasons | V1a pass rate, E9 |
| `primary`, `secondary` | This phone's baton role changes (BT1) | Handoff time |

The screen sums them up: relays and hours, battery % per hour, KB per hour (target under 150), background gaps, the Bluetooth signal's median and range, the verified share and its median time, and handoffs. **Export as CSV** shares the whole log through Android's share sheet (Gmail, Drive, Messenger). **Clear the log** before each experiment, so one export holds one experiment. The log stays on the phone and is never sent to the server.

Write the phone model, Android version, the setting tried and the time on each run in `docs/device-tests.md`, with the exported CSV's file name.

## The experiments

### E1: Bluetooth signal inside a multicab
- **Set-up:** the driver phone mounted where it will ride (dashboard), beacon on. A rider phone with the log recording and Relay open (the scan runs while the form is open).
- **Vary:** phone in a pocket, a bag, the hand and on the seat; windows open and closed; five seat positions from the front to the back. At least 300 readings per setting (about 10 minutes at one reading every 2 s).
- **Record:** the median and range per setting (export after each).
- **Sets:** `RSSI_PRESENCE_THRESHOLD_DBM` (now -65, a hypothesis; backlog 117 says it is barely reached at a metre), `RSSI_SMOOTHING_ALPHA`.

### E2: Multicabs side by side at a terminal
- **Set-up:** two to four same-route multicabs with driver phones, parked side by side at SM City Butuan and one more terminal. A rider phone in each multicab in turn.
- **Record:** the readings of each beacon from inside one multicab; whether Relay picks the right one or says "several".
- **Sets:** the margin rule (`RSSI_MARGIN_DB`), the queue's beacon wait (`RELAY_QUEUE_BEACON_GONE_S`).

### E3: GPS accuracy at terminals
- **Set-up:** five terminals, open sky and under roofs, five phones; Demo data off, location on.
- **Record:** the accuracy the Check-in card reports, and whether At a stop is accepted within 300 m.
- **Sets:** `GPS_ACCURACY_GATE_CHECKIN_M`, `CHECKIN_STOP_MAX_M`.

### E4: Battery and heat
- **Set-up:** at least three phones; two-hour rides as Primary and as Secondary (two team accounts relaying the same multicab, BT1). The log recording, battery above 80% at the start.
- **Record:** battery % per hour from the summary; whether the phone felt hot.
- **Target:** PRD 3.3. **Sets:** `POSITION_SEND_DISTANCE_M`, `POSITION_SEND_INTERVAL_S`, `PRIMARY_MIN_BATTERY_PCT`, and whether a Secondary should slow its GPS.

### E5: Background survival
- **Set-up:** at least six phone brands (Samsung, Xiaomi, Oppo, Vivo, Realme, Infinix); 60-minute rides with the screen off, once with the battery exemptions from the in-app guide and once without.
- **Record:** the gaps in the summary, and whether the relay was still running when the screen came back.
- **Sets:** the vendor steps in the guide, `BACKGROUND_RELAY_GAP_MIN`.

### E6: Data use
- **Set-up:** one hour of relaying on the live map; also read Android's Settings, Network, Data usage for Tunton before and after.
- **Record:** KB per hour from the summary and from Android.
- **Target:** under 150 KB per hour (PRD 3.3). **Sets:** the send rule, the batch size.

### E7: SMS path
- **Set-up:** the gateway and driver phones on the pilot carrier for 7 days (DR5-M5, DR7 device tests).
- **Record:** latency, losses, and whether texts show in the driver's Messages app (backlog 132).
- **Sets:** the SMS worker's `SMS_PRIMARY_ENCODING` environment variable on Render, and `SMS_GATEWAY_DAILY_CAP`.

### E8: Routing speed
- **Set-up:** a phone with 3 GB of memory; My Rides trips on the pilot route, then on all seven routes.
- **Record:** the time from tapping a destination to the answer (a stopwatch, or a development build's log).
- **Target:** 250 ms.

### E9: Motion in traffic
- **Set-up:** honest rides in slow traffic, terminal queues, and walking beside a multicab. The log recording.
- **Record:** the verified share, the median time, and each `not_verified` reason.
- **Sets:** `MOTION_SPEED_FALLBACK_KMH`, `MOTION_SPEED_FALLBACK_S`, `VERIFY_WINDOW_S`, `VERIFY_WINDOW_MAX_S`, and whether V1b's in-vehicle signal (activity recognition) is needed on top.

## Also measure (PRD 3.3)

- **Time to the first boarding prompt:** from a check-in to "Did you board?" when a multicab of the route stops at the stop.
- **Verification pass rate on honest rides:** from E9's summary.
- **Handoff time:** the time between the Primary stopping and the backup phone's `primary` event.
