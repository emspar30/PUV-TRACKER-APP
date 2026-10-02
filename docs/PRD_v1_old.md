# Product Requirements Document (PRD)

**Project Title:** Commuter-Centric Crowdsourced PUV Tracker & Transit Assistance Ecosystem
**Application Title:** Tunton APP
**Target Locale:** Butuan City Public Transit Network (Routes 1, 2, 3, 4, 5, 12, and 14)
**Architecture Model:** 100% Passenger-Relay Crowdsourced Network (Zero Data Cost for Drivers)
**Target Platform:** Mobile Application (React Native / Expo Framework with TypeScript)
**Design Philosophy:** Industrial-Minimalist Bento Grid UI, Dark-Mode-First System, 8pt Mathematical Spatial Grid
**Status:** Final Draft for Panel Defense

---

## 1. Executive Summary & System Philosophy

### 1.1 Problem Statement & Municipal Context

The public transit network in Butuan City relies predominantly on franchised multicabs operating across established urban corridors (e.g., Bancasi, Libertad, Langihan, CSU Ampayon). The operational efficiency of this ecosystem is severely degraded by the "load-full" dispatch practice, creating unpredictable wait times and systemic geographic imbalances between passenger supply and vehicle demand. Prior hardware-dependent tracking interventions (IoT GPS modules) failed due to high initial capital expenditures, hardware maintenance overhead, and continuous cellular data subscription costs that local driver cooperatives cannot sustain.

### 1.2 Architectural Paradigm

This application transitions the transit intelligence network to a **100% Passenger-Relay Architecture**. By crowdsourcing location (GPS), kinematic state (accelerometer), and seat availability data exclusively from the smartphones of onboard commuters, the system completely removes the financial and hardware burden from the PUV driver. The application functions as a localized, offline-first utility. Critical transit computations—such as dynamic detour routing and LTFRB fare logic—execute directly on local device memory via SQLite and Turf.js, ensuring 100% reliability even in cellular dead zones.

---

## 2. System Architecture & Topology

The system operates across three highly decoupled nodes:

1. **The Commuter Node (iOS/Android):** Runs React Native. Responsible for Bluetooth Low Energy (BLE) scanning, hybrid GPS polling, spatial math (`Turf.js`), local SQLite database querying, and pushing lightweight JSON telemetry payloads to the cloud.
2. **The Cloud Broker (Firebase / Supabase):** Manages real-time state synchronization, Tokenomics ledgers, consensus moderation queues, and Auto-TTL (Time-To-Live) watchdogs.
3. **The Driver/Gateway Node (Android):** Operates under a strict "Zero Data Cost" constraint. A centralized, server-side Android phone (Gateway) intercepts cloud traffic and forwards it via local SMS to offline Android devices mounted in the PUVs. The driver's device parses the SMS natively to render visual heatmaps without internet access, while simultaneously broadcasting a BLE GATT advertisement to verify commuter presence.

---

## 3. Commuter Client Functional Specifications

### 3.1 Module 1: Onboarding, Identity & Profile Economics

**Objective:** Establish secure, privacy-preserving user profiles, automate statutory fare rules, and initialize the token wallet while preventing gamification exploits.

* **Classification & Discount Automation:** During the initial onboarding state, users must select their commuter classification (Regular, Student, Senior Citizen, Person with Disability). The application caches this state globally (`Zustand`) to automatically apply the Philippine statutory **20% fare discount multiplier** to all local LTFRB computations.
* **Privacy-Preserving Vector Identity:** To comply with data-minimization principles, the application strictly prohibits personal photograph uploads. Identity is managed through an array of 12 preset vector avatars utilized for public identification on the live map and community feed.
* **15-Day Edit Cooldown (Exploit Prevention):** To prevent malicious toggling of classifications for situational fare discounts, any profile modification triggers a persistent 15-day edit cooldown. The application writes a timestamp lock to the cloud database; during this window, the classification edit UI is programmatically disabled.
* **Hardware Fingerprinting:** Upon registration, the system captures the device's unique hardware identifier (Android ID / iOS IDFV) and hashes it. This ensures that users cannot evade system bans by wiping app data or creating new accounts.

### 3.2 Module 2: Offline Smart Routing, Navigation & Dynamic Fare Engine

**Objective:** Deliver "Google Maps-style" multimodal directional autonomy and financial transparency in environments completely devoid of cellular internet.

* **Offline Infrastructure & Vector Tiles:** The application bundle contains pre-downloaded MapLibre GL Native vector tiles (`.mbtiles` format) encompassing the Butuan City bounding box. A local SQLite database houses the exact GeoJSON polylines (Primary and Alternative) and station nodes for Routes 1, 2, 3, 4, 5, 12, and 14[INDEX: 1.1.2].
* **Smart Directions Engine (Turf.js Math):**
* Users drop a pin or use their active GPS coordinates as the Origin, and tap a Destination.
* The application executes the `turf.pointToLineDistance()` algorithm natively against the SQLite polyline tables to identify the optimal PUV route corridor.
* The engine generates a multimodal itinerary (e.g., *Walk 50m to SM City $\rightarrow$ Ride Route 2 $\rightarrow$ Walk 100m to Gaisano*).


* **Dynamic LTFRB Fare Calculation:** The application locally executes the standard LTFRB fare formula:
* **Base Fare:** ₱15.00 for the first 4.0 kilometers.
* **Incremental Fare:** +₱2.00 for every succeeding kilometer.
* The distance is strictly anchored to the static, authorized franchise polyline length between the boarding and alighting nodes, ensuring legal compliance even if the vehicle takes a physical detour. The 20% profile discount is auto-deducted before rendering the UI.


* **Selective Transparency Engine:** When the Smart Route is generated, the selected PUV polyline is rendered at 100% opacity in a high-contrast semantic color (e.g., Red for Route 1, Blue for Route 2). The remaining unused routes dynamically fade to an 8% opacity overlay to eliminate visual noise.
* **Blue Dot Offline Self-Tracking:** Utilizing passive GPS radio reception (which requires zero mobile data), the `MapLibre` client continuously renders the user's live position (pulsing blue dot) atop the offline map, allowing commuters to monitor their journey progress without an internet connection.

### 3.3 Module 3: Viewport-Centric Live PUV Tracker Map

**Objective:** Deliver a highly performant, real-time spatial awareness interface of active transit vehicles.

* **Viewport Culling (60 FPS Optimization):** The MapLibre engine calculates the geographical bounding box (`[west, south, east, north]`) of the active screen view. The React Native client selectively filters and renders *only* the telemetry markers that fall within these coordinates, aggressively culling off-screen nodes to preserve UI frame rates.
* **Telemetry UI Rendering:** Active PUV markers display three critical dimensions of data:
1. **Semantic Route Color** (e.g., Cyan for Route 4).
2. **Directional Heading Cone** dynamically bound to the device's compass/GPS heading.
3. **3-Tier Occupancy Halo:** **Green** (Empty: 0-6 seats), **Amber** (Few: 7-12 seats), **Red** (Full: 13-16 seats).


* **Stationary Status Bubble (Zero-AI Traffic Context):** If a broadcasting PUV’s speed drops below 2.0 km/h for a continuous window of 45 seconds, the UI automatically spawns a contextual text bubble above the vehicle icon (*"Stopped: Loading / Traffic"*). This provides commuters with wait-time context without requiring heavy predictive AI models.

### 3.4 Module 4: Station Check-In (Demand Signaling)

**Objective:** Allow waiting commuters to aggregate their presence, generating data for the driver's SMS Heatmap.

* **The Flow:** Commuters navigate to a recognized transit hub (e.g., Langihan Terminal, CSU Gate). They select their desired Route and tap "Check-In".
* **40-Meter Geofence Lock:** The system prevents fraudulent "couch check-ins" by calculating the Haversine distance between the user's live GPS and the hardcoded station coordinates. The Check-In API is blocked unless `distance <= 40 meters`.
* **15-Minute Auto-TTL Lifecycle (Ghost Demand Prevention):**
* Once checked in, the server sets a 15-minute Time-To-Live index on the document.
* At $T+5$ minutes: A local push notification prompts the user, *"Have you boarded yet?"*
* At $T+15$ minutes: The server forcibly purges the check-in document, decrementing the driver's SMS heatmap aggregate to ensure data freshness.



### 3.5 Module 5: Zero-Tap Passenger Relay Engine (BLE Proximity)

**Objective:** Create a frictionless, unfalsifiable boarding handshake using Bluetooth Low Energy.

* **Zero-Tap Boarding (BLE Detection):** Physical QR codes are obsolete. The commuter boards the multicab. The React Native app (`react-native-ble-plx`) constantly runs a low-power background scan for specific GATT service UUIDs. It detects the driver's BLE beacon, extracting the Route Number and Plate Number instantly.
* **State Hydration:** If the server detects that another commuter is already actively broadcasting telemetry from that specific PUV, the app fetches the current occupancy state (e.g., *Amber/Few*). The new boarding user is presented with a 1-tap confirmation UI to adopt or modify the state, drastically reducing input friction.
* **The Relay Baton (Farthest-Destination Priority):**
* To prevent redundant GPS polling and battery drain, the server clusters multiple passengers on the same PUV into a single map entity.
* The server evaluates the declared destination nodes of all clustered commuters. The commuter traveling to the **farthest geographical destination** is assigned as the **Primary Broadcaster** (GPS active).
* All other users become **Secondary Nodes** (GPS idled, but able to update seat counts).


* **Smart Destination Geofencing & Handoff:**
* When the Primary Broadcaster's device breaches a 50-meter radius of their set destination, the application triggers an automated 60-second arrival countdown.
* Upon expiration, the GPS listener is killed, Tracking Energy is awarded, and the server automatically promotes the next-farthest Secondary Node to Primary Broadcaster, ensuring a seamless telemetry stream on the live map.



### 3.6 Module 6: Resource Watchdogs & Hybrid Polling

**Objective:** Strictly limit battery consumption and mobile data egress on the commuter's device.

* **150m / 10s Hybrid Polling Configuration:**
* The background location listener (`expo-location`) is configured with a dual-parameter gate: `distanceFilter: 150` (meters) AND `timeInterval: 10000` (milliseconds).
* *Result:* If a PUV is stuck in traffic, no data is sent until it moves 150 meters. If the PUV is speeding on a highway, data is throttled to update only once every 10 seconds. This cuts data consumption by up to 90% compared to standard fitness trackers.


* **10-Minute GPS Decay:** If the device registers 0 meters of displacement for 10 consecutive minutes (e.g., the user forgets to terminate the app after going home), a system watchdog permanently kills the background location service and cancels the session.
* **Offline State Resilience (FIFO Buffer):** If cellular connectivity drops mid-transit, coordinate payloads are cached into a local First-In-First-Out (FIFO) SQLite ring buffer (maximum 20 points). Once the connection is restored, the buffer pushes the array to the cloud sequentially.

---

## 4. Driver Client Functional Specifications

### 4.1 Module 7: Zero-Data Offline UI & BLE Beacon Broadcast

**Objective:** Provide drivers with operational intelligence without requiring SIM load or internet access.

* **Offline Heatmap Rendering:** The driver mounts a low-end Android device on the dashboard. The application runs entirely offline, rendering a static map of their assigned route.
* **BLE Peripheral Broadcasting:** The application utilizes Android's native Bluetooth API to act as a Peripheral Advertiser. It continuously broadcasts a lightweight GATT advertisement packet (containing a custom Manufacturer Data payload matching the Route and Plate Number). This consumes <3% battery per hour and requires zero internet.

### 4.2 Module 8: Hardware-in-the-Loop SMS Interceptor

**Objective:** Deliver real-time commuter demand data to offline drivers for free.

* **The Cloud-to-Gateway Bridge:** The central server continuously counts active Station Check-Ins. It formulates a highly compressed string payload (e.g., `HM|R4|CSU:12|SM:4`). It pushes this payload via HTTPS to a dedicated Android Gateway phone plugged into a wall outlet (located at the researchers' campus or residence).
* **The SMS Dispatch:** The Gateway phone utilizes a standard unlimited-SMS prepaid promo. It runs an open-source SMS REST API bridge to immediately forward the compressed string as an SMS text to the driver's phone number.
* **Android `BroadcastReceiver` Engine:**
* The driver's offline application registers a native `BroadcastReceiver` mapped to the `android.provider.Telephony.SMS_RECEIVED` intent.
* When the SMS arrives, the app intercepts it silently in the background (the driver never sees a notification or opens an inbox).
* The regex engine parses `HM|R4|CSU:12|SM:4` and updates the offline UI to display a glowing heatmap node over the CSU and SM terminal icons, allowing the driver to adjust their dispatch timing intelligently.



---

## 5. Security, Verification & Anti-Spoofing Protocols

### 5.1 Terminal Beacon Collision & The Smart Queue (Zero-Tap Auto-Resolution)

**Problem:** In crowded terminals (e.g., SM City), multiple multicabs of the same route park side-by-side, causing overlapping BLE signals.
**Solution:**

1. **RSSI Attenuation Threshold:** The metal body of the PUV acts as a Faraday cage. The app mathematically filters out any BLE signal with a Received Signal Strength Indicator (RSSI) weaker than **-65 dBm**, eliminating 90% of adjacent vehicle interference.
2. **The Smart Queue (Idle State):** If two signals *still* pass the threshold, and the device accelerometer reads 0 km/h, the system *does not* ask the user to manually select the vehicle. It queues the report on the server with a *"Stopped: Loading"* status and places the Energy reward in escrow.
3. **Kinematic Divergence (Auto-Lock):** When the PUV finally departs, it physically separates from the adjacent vehicle. Within 15 meters, the incorrect BLE signal drops to 0. The application recognizes the remaining, moving beacon, locks the session to that specific Plate Number, and releases the Tracking Energy.

### 5.2 The 30-Second Kinematic Quarantine

Even with BLE, motion must be strictly verified to prevent a user from standing directly outside a parked PUV and generating a fake moving report.

* **OS Activity Recognition:** The native Android/iOS sensors must classify the user's physical cadence as `IN_VEHICLE`. (States like `WALKING`, `RUNNING`, or `STILL` trigger an immediate abort).
* **Polyline Snap:** The device's GPS must intersect within 30 meters of the primary route polyline.
* **50-Meter Displacement:** The device must physically travel a minimum of 50 continuous meters along the route.
* *Verdict:* Only upon passing all three physical tests is the report marked "Verified" and published to the public viewport.

### 5.3 Dynamic Detour Detection (Turf.js)

**Problem:** Bridge closures (e.g., Magsaysay Bridge repairs) force PUVs to take alternative routes. A rigid Polyline Snap rule would falsely flag all passengers on a detoured multicab as trolls and ban them.
**Solution:**

* The offline database stores a **GeoJSON Feature Collection** containing both the *Primary Polyline* and known *Alternative Polylines* (e.g., the Macapagal Bridge bypass).
* If the commuter deviates >30 meters from the Primary line, `Turf.js` executes a split-second secondary proximity check against the Alternative Polyline.
* If the GPS snaps to the Alternative Polyline and the OS still registers `IN_VEHICLE`, the system switches the session to **[Active Detour Mode]**. The UI updates the polyline to a dashed yellow warning line, and the tracking session remains perfectly valid.

### 5.4 Privacy-Preserving Static Night Mode (Anti-Stalking)

**Objective:** Prevent malicious actors from utilizing real-time GPS coordinates to ambush or stalk specific commuters at night.

* **Time-Based Trigger:** An automated chron-job forces the system into Strict Night Mode between **6:00 PM and 4:59 AM**.
* **Data Degradation:** Precise live GPS polling and moving UI map markers are completely disabled. The MapLibre renderer reverts to displaying only **Static Node Updates** (e.g., an icon placed statically at a terminal with the text: *"Route 4 passed CSU 3 minutes ago"*). This maintains macro-level transit awareness while destroying micro-level targeting capabilities.

### 5.5 Consensus Moderation & Hardware Bans

* **Flagging Taxonomy:** Commuters can report malicious map markers using predefined tags: `FALSE_LOCATION`, `SPAMMING`, or `NOT_A_PUV`, supported by an optional text description.
* **The 10-Strike Threshold:** A formal system strike is generated against the broadcaster ONLY if **10 unique commuters** flag the exact same report, OR if the broadcaster accumulates 10 unique flags across different reports within a 24-hour window.
* **Automated Suspension:** Accumulating 2 unshielded strikes executes a **7-Day Account Suspension**. This suspension is cryptographically tied to the smartphone's Hardware Device ID, making it impossible to evade by wiping the app cache or spoofing a new email address.

---

## 6. Gamification & Tokenomics System Specification

The crowdsourcing model requires psychological incentives to ensure participation, governed by a strict economic system to prevent spam-farming.

### 6.1 Tracking Energy Economy

* **Wallet Capacity:** A hard cap of **5 Tracking Energy** per user.
* **Consumption:** Activating the live tracking map viewport costs **1 Energy**. (Offline routing, offline maps, and the fare calculator remain permanently free, 0 Energy cost).
* **Replenishment Logic & Caps:**
* **Passive Refill:** +1 Energy every 12 hours (Caps at 2 passive refills per 24 hours).
* **Active Relay (With GPS):** +1.0 Energy (Awarded upon passing Kinematic Quarantine & Arrival Kill). Capped at 1 earn per day.
* **Active Relay (No GPS / Seat Update Only):** +0.5 Energy. Capped at 1 earn per day.
* **Station Check-In:** +0.3 Energy. Capped at 1 earn per day.
* *Design Philosophy:* A commuter who contributes data on their morning ride earns enough energy to view the map on their evening ride, creating a sustainable, self-funding loop.



### 6.2 Trust Points & Merit Shields

* **Trust Points:** Commuters earn a visible Trust Score (0-100 scale) for successful, verified relays.
* **Merit Conversion:** Every 1,000 Trust Points automatically converts into **1 Hidden Merit Point**.
* **Shield Mechanics:** A Merit Point acts as an automated consumable shield. If a highly active, legitimate commuter falls victim to a retaliatory mass-flagging event and receives a strike, the system silently consumes 1 Merit Point to absorb the strike, protecting their account from the 7-day hardware ban.

---

## 7. Data Models, Schemas & System Formulations

### 7.1 Local SQLite Schemas (Offline Data)

**Table: `franchise_routes**`

```sql
CREATE TABLE franchise_routes (
    route_id TEXT PRIMARY KEY,       -- e.g., 'R-04'
    route_color TEXT NOT NULL,       -- e.g., '#00F5D4'
    base_fare REAL DEFAULT 15.00,
    per_km_rate REAL DEFAULT 2.00,
    primary_geojson TEXT NOT NULL,   -- Stringified GeoJSON Feature
    detour_geojson TEXT              -- Stringified GeoJSON Feature Collection
);

```

### 7.2 Compressed SMS Payload Protocol (Heatmaps)

To fit maximum heatmap data within a single 160-character GSM SMS packet, the Node.js server compiles JSON arrays into a strict, pipe-delimited syntax.

* **Syntax Grammar:** `HM|<RouteID>|<StationCode>:<WaitCount>|...`
* **Example Payload:** `HM|R4|SM:12|CSU:5|RBN:0`
* **Driver Client Regex Parser:** `/^HM\|(R[0-9]{1,2})\|(?:([A-Z]{2,3}):([0-9]{1,3})\|?)+$/`
* *Group 1:* Route (R4)
* *Group 2/3:* Station (SM) and Count (12).



### 7.3 Mathematical Equations (Offline Algorithms)

**A. LTFRB Dynamic Fare Formulation:**
Let $D$ be the total route distance in kilometers (calculated via Turf.js line slice). Let $M$ be the profile discount multiplier (0.8 for Students/Seniors, 1.0 for Regular).


$$Fare = \left( 15.00 + \max(0, \lceil D - 4.0 \rceil) \times 2.00 \right) \times M$$

**B. Exponential Smoothing for BLE RSSI:**
To prevent the UI from flickering when BLE signals bounce off metal surfaces, the application applies an Exponential Moving Average (EMA) to the raw RSSI readings.


$$RSSI_t = \alpha \times RSSI_{raw} + (1 - \alpha) \times RSSI_{t-1}$$


Where $\alpha$ (the smoothing factor) is configured to **0.3** to prioritize stability over instantaneous volatility. The result must exceed the -65 dBm threshold for $\ge 3$ consecutive seconds to trigger boarding logic.

---

## 8. Non-Functional Requirements (ISO/IEC 25010 Quality Model)

1. **Performance Efficiency:**
* MapLibre rendering must sustain 60 FPS by executing aggressive off-screen vector culling.
* Turf.js spatial operations (point-to-line distance calculations for 7 routes) must execute in under 250ms on a standard low-end Android device (e.g., 3GB RAM).


2. **Reliability (Fault Tolerance):**
* The app must withstand total cellular connection loss indefinitely. Navigational routing and fare calculation logic must never crash or throw unhandled promise rejections in airplane mode.


3. **Security (Integrity):**
* Hardware Device IDs (fingerprinting) must be hashed using SHA-256 before transmission to prevent PII (Personally Identifiable Information) breaches.
* Strict Night Mode enforcement must be hardcoded to server time, preventing client-side clock manipulation from disabling the anti-stalking protocol.


4. **Operability (Usability):**
* Compliance with the 8pt spatial grid system ensures that all touch targets (especially the 1-tap BLE confirmation buttons) exceed 48x48 dp, ensuring safe operability in moving, vibrating vehicles.



---

## 9. Edge Cases & Disaster Recovery Matrix

| Scenario | System Diagnosis | Automated Failsafe Recovery |
| --- | --- | --- |
| **Driver's Phone Dies** | BLE Beacon disappears mid-transit. | Commuter device executes Kinematic Continuation. If speed remains >15 km/h, the session relies entirely on GPS and assumes the PUV is still active. Energy rewards are processed normally upon arrival kill. |
| **Commuter's Phone Dies** | Primary Broadcaster connection severed. | Cloud Broker detects missing WebSocket heartbeat (timeout: 30s). State transitions to next Secondary Node. The new node's GPS is remotely woken up, assuming Primary status. |
| **Complete Network Outage** | Zero cellular data available across the city. | System reverts to 100% offline mode. `MapLibre` displays blue-dot tracking over downloaded tiles. Fares and Smart Routes execute locally. Tracking features suspend silently until connection restores. |
| **SMS Gateway Sim Ban** | Telco flags Gateway SIM for FUP spam. | Node.js detects SMS API failure codes. The system buffers demand signals and falls back to a secondary Gateway SIM (if configured in hardware pool) or suspends heatmap delivery until the 24-hour block lifts. |

---

**End of Product Requirements Document**