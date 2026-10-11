// Single source of every threshold, fare value and feature flag (PRD 0.3).
// All values are starting hypotheses (PRD 17). No other module may contain a threshold literal.

// --- Values the server enforces too. They are defined once, beside the Edge Function that uses them
// (which can only load files from its own folder), and re-exported here:
//   ENABLE_VERIFICATION (PRD 0.7; read in one place only: verifyReport), STATIONARY_SPEED_KMH (7.3),
//   PACKET_MAX_AGE_S and PACKET_MAX_FUTURE_S (0.3), VEHICLE_CAPACITY_SEATS (7.3),
//   PACKET_MAX_BYTES (8.4), INGEST_LOG_RETENTION_DAYS.
export {
  ENABLE_VERIFICATION,
  INGEST_LOG_RETENTION_DAYS,
  PACKET_MAX_AGE_S,
  PACKET_MAX_BYTES,
  PACKET_MAX_FUTURE_S,
  STATIONARY_SPEED_KMH,
  VEHICLE_CAPACITY_SEATS,
} from '../../../supabase/functions/_shared/serverConfig.ts';

// --- Position send rule (PRD 8.4)
export const POSITION_SEND_DISTANCE_M = 100;
export const POSITION_SEND_INTERVAL_S = 30;

// --- Stationary bubble (PRD 7.3). The speed threshold is one of the server values above.
export const STATIONARY_DURATION_S = 45;

// --- Liveness and coverage states (PRD 7.3, 8.4)
export const LIVENESS_TIMEOUT_S = 90;
export const COVERAGE_LIVE_MAX_AGE_S = 90;
export const COVERAGE_STALE_MAX_AGE_S = 600;
export const LIVE_UI_REFRESH_INTERVAL_S = 5;

// --- Username (PRD 19 D7; the same rule as set_username in the migration)
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
// ST2-B: the suggested username (a word pair and this many digits), retried if a pair is not allowed
export const USERNAME_SUGGEST_DIGITS = 3;
export const USERNAME_SUGGEST_ATTEMPTS = 5;
// ST2-B: places listed in the introduction before "Show more"
export const ONBOARDING_PLACES_PREVIEW = 5;
// D7 blocklist, checked on the phone (any case): names no one may take, and words no name may
// contain. A small English list for now; Emjay supplies the full English and Cebuano lists before
// any public release.
export const USERNAME_RESERVED: readonly string[] = [
  'admin', 'administrator', 'anonymous', 'commuter', 'deleted', 'demo', 'mod', 'moderator', 'null',
  'official', 'root', 'staff', 'support', 'system', 'team', 'tunton', 'undefined',
];
export const USERNAME_BLOCKED_WORDS: readonly string[] = [
  'bitch', 'cunt', 'faggot', 'fuck', 'nazi', 'nigga', 'nigger', 'pussy', 'shit', 'slut', 'whore',
];

// --- Tracking one vehicle and its ETA (L2; PRD 19.2 D9, plan decision 17). ETA = distance along the
// line to the boarding point / recent speed. Shown only with at least ETA_MIN_SAMPLES speeds from the
// last ETA_SAMPLE_WINDOW_S, within ETA_MAX_KM and at ETA_MIN_SPEED_KMH or faster; hidden otherwise
// (PRD 19.4). The distance is still known, so arrival and the distance alerts keep working.
export const ETA_MIN_SPEED_KMH = 5;
export const ETA_SAMPLE_WINDOW_S = 90;
export const ETA_MIN_SAMPLES = 2;
// PRD 19.4 (Emjay, 2026-10-08: back from B2's 60 km to the PRD value)
export const ETA_MAX_KM = 10;
// "Alert near arrival" fires once when the ETA drops to this (in-app banner and a short vibration)
export const TRACK_ALERT_ETA_S = 120;
// B2: in-app alerts (a toast and a short vibration) as the tracked multicab comes within each of these
export const TRACK_DISTANCE_ALERTS_M = [1000, 500, 250, 100] as const;
// B2: tracking ends by itself when the multicab is this close to the commuter's boarding point, or
// when it passed between two readings (the last reading within TRACK_ARRIVED_PASS_M, then a jump
// of more than that: it has gone by and is counting to its next time round)
export const TRACK_ARRIVED_M = 50;
export const TRACK_ARRIVED_PASS_M = 200;
// How long an in-app toast stays on screen
export const TOAST_VISIBLE_MS = 4000;
// Other vehicles fade to this while one is tracked
export const TRACK_OTHERS_OPACITY = 0.35;
// Demo mode: the commuter waits at this stop, until "Use my location" (G0) gives a real position
export const DEMO_COMMUTER_STOP_CODE = 'SMB';

// My Rides keeps this many recent rides (from "I boarded" at check-in, later from relay reports)
export const RECENT_RIDES_MAX = 5;

// --- Live vehicles from the database (L1)
// Speeds kept per vehicle for the stopped check (longer than STATIONARY_DURATION_S)
export const LIVE_SPEED_HISTORY_S = 120;
// Lines within this much of the nearest are compared by heading (two-way roads share a street)
export const LIVE_LINE_TIE_M = 30;
// The line's direction is read over this distance around the snapped point
export const LIVE_HEADING_PROBE_M = 20;
// The whole route is read again this often, in case a Realtime change was missed
export const LIVE_RELOAD_INTERVAL_S = 30;
// Development simulator (scripts/sim-ingest.ts): one packet per vehicle this often
export const SIM_INGEST_INTERVAL_S = 5;

// --- Offline buffer (PRD 8.4). Defined now, used later.
export const OFFLINE_BUFFER_SIZE = 60;

// --- Occupancy, by seats taken (PRD 7.3). The capacity is one of the server values above.
export const OCCUPANCY_GREEN_MAX_TAKEN = 6;
export const OCCUPANCY_AMBER_MAX_TAKEN = 12;

// --- Fare (PRD 12.4). TODO(placeholder): confirm against the official fare order.
// These are the defaults the seed writes into each route row; the fare engine reads the row.
export const FARE_BASE_PHP = 15.0;
export const FARE_BASE_KM = 4.0;
export const FARE_PER_KM_PHP = 2.0;
export const FARE_DISCOUNT_MULTIPLIER = 0.8;
export const FARE_REGULAR_MULTIPLIER = 1.0;
// TODO(placeholder): rounding to the nearest 0.25 is assumed (PRD 7.2). Set to null for no rounding.
export const FARE_ROUNDING_STEP_PHP: number | null = 0.25;
// Distances are rounded to this many decimals of a km before the per-km ceiling,
// so floating-point noise cannot add a kilometre.
export const FARE_DISTANCE_DECIMALS = 6;

export const CLASSIFICATIONS = ['regular', 'student', 'senior', 'pwd'] as const;
export type Classification = (typeof CLASSIFICATIONS)[number];
export const FARE_DISCOUNTED_CLASSES: readonly Classification[] = ['student', 'senior', 'pwd'];

// --- Routing (PRD 7.2, 3.3)
export const MAX_WALK_PER_LEG_M = 500;
// Check-in card: "2 min walk" from the distance, at an unhurried 80 m a minute (about 4.8 km/h)
export const WALK_SPEED_M_PER_MIN = 80;
// B3: an in-app reminder this long into a check-in, when the Check-in tab is not in front
export const CHECKIN_REMINDER_MIN = 5;
// B3: the "Safe travel" card after "I boarded" stays this long, then the card goes back to stations
export const CHECKIN_FAREWELL_S = 6;
export const ROUTING_P95_BUDGET_MS = 250;

// --- Route data checks (seeding now, the import script later)
// A stop is listed on a line only if it lies within the maximum distance of it
export const ROUTE_STOP_WARN_DISTANCE_M = 50;
export const ROUTE_STOP_MAX_DISTANCE_M = 150;
// RR3 (Emjay, 2026-10-08): a listed stop farther than ROUTE_STOP_MAX_DISTANCE_M from its route but
// within this is moved onto the nearest point of the line; one farther still is left out until its
// coordinates are corrected
export const ROUTE_STOP_SNAP_MAX_M = 500;
export const ROUTE_SIMPLIFY_TOLERANCE_M = 5;
// Route import (RR1, scripts/import-route.ts). Run on the PC, never at app runtime.
// A line with more points than this after simplification is reported
export const ROUTE_MAX_POINTS_PER_LINE = 1500;
// Points outside the map's tile bounds warn (more loudly beyond the first value); further
// outside than the second fails the import (Emjay, 2026-10-04: raised to 2 km for R5)
export const ROUTE_IMPORT_WARN_OUTSIDE_M = 1000;
export const ROUTE_IMPORT_FAIL_OUTSIDE_M = 2000;
// A line whose start and end are this close is a loop
export const ROUTE_LOOP_CLOSE_M = 100;
// R4 (closes_back): the traced line ends where it passed earlier when its end is this close to an
// earlier pass, at least ROUTE_CLOSE_BACK_MIN_GAP_M before the end
export const ROUTE_CLOSE_BACK_M = 30;
export const ROUTE_CLOSE_BACK_MIN_GAP_M = 1000;
// RR2 trim: a leg is cut at its trim point (the terminal) only if the point lies this close to the
// line and the part beyond it is longer than the second value (Emjay, 2026-10-05)
export const ROUTE_TRIM_MAX_OFFSET_M = 150;
export const ROUTE_TRIM_MIN_TAIL_M = 300;
// RR3 loop report: a self-overlap is the line coming back within the first value of a part at least
// the second value earlier; a near return (a block loop such as R. Calo, T. Sanchez, M. Calo) comes
// back within the third value of a part at least the fourth value earlier. Loops longer than the
// last value are listed for Emjay's confirmation; none fails the import.
export const ROUTE_OVERLAP_M = 20;
export const ROUTE_OVERLAP_MIN_GAP_M = 150;
export const ROUTE_NEAR_RETURN_M = 300;
export const ROUTE_NEAR_RETURN_MIN_GAP_M = 600;
export const ROUTE_LOOP_CONFIRM_M = 400;
// Stops reported per leg when they lie this close to it
export const ROUTE_STOP_REPORT_M = 150;
// Separate pieces of one line are joined only when the gap between them is at most this
export const ROUTE_SEGMENT_JOIN_M = 20;
// Coordinates must be near Butuan: longitude about 125 and latitude about 9, within this many degrees
export const ROUTE_EXPECTED_LON = 125.5;
export const ROUTE_EXPECTED_LAT = 9;
export const ROUTE_EXPECTED_SPREAD_DEG = 1;

// --- Local database start-up
// If the database is still locked by a previous start of the app, wait and try again this many times
export const DB_LOCK_RETRY_ATTEMPTS = 10;
export const DB_LOCK_RETRY_DELAY_MS = 500;

// --- Offline map (PRD 7.2)
// How far the map may zoom in past the tile set's last zoom level by stretching its tiles
// The OpenStreetMap credit shows in full this long when a map opens, then folds into an (i) button
export const MAP_ATTRIBUTION_SHOW_S = 5;
export const MAP_OVERZOOM_LEVELS = 4;
// LB1a glyph proof: in development builds only, print one test label ("Butuan") at the city centre.
// Off except while checking the offline fonts (passed 2026-10-05); real labels come with LB1b.
export const MAP_LABEL_PROOF_DEV = false;

// --- Map labels (LB1b; docs/LABELS_PLAN.md §3). Labels sit under the route lines and dim while a
// route is selected. "Map labels" in Settings, on by default, removes them when off.
export const LABEL_CITY_MIN_ZOOM = 11;
export const LABEL_BARANGAY_MIN_ZOOM = 13;
export const LABEL_MAJOR_ROAD_MIN_ZOOM = 13;
export const LABEL_STREET_MIN_ZOOM = 15;
// ST2-C3: building and other place names (schools, banks, churches ...) when zoomed in to the street
export const LABEL_POI_MIN_ZOOM = 16;
// Place names give way to streets when zoomed in: city names hide from 14, barangay names from 16
export const LABEL_CITY_MAX_ZOOM = 14;
export const LABEL_BARANGAY_MAX_ZOOM = 16;
export const LABEL_DIMMED_OPACITY = 0.5;
export const MAP_LABELS_DEFAULT = true;

// ST2-D: the tips tour starts this long after the Map tab first shows, once the map and cards are laid out
export const TOUR_START_DELAY_MS = 1200;

// --- Route lines on the map (UX3; PRD 7.2: other routes fade to 8% opacity)
// Lines are drawn only for a selected route; routes that are not selected are drawn this faint
export const UNSELECTED_ROUTE_OPACITY = 0.08;

// --- Demo mode (AF2, AF3; docs/APP_FEEL_PLAN.md). Simulated data on the phone only, always labelled
// "Demo". Emjay, 2026-10-04: on by default for the prototype and the panel; a Settings row turns it off.
export const DEMO_MODE_DEFAULT = true;
// One seed gives the same vehicles, speeds, stops and seats every time
export const DEMO_SEED = 20261004;
export const DEMO_VEHICLES_MIN_PER_ROUTE = 2;
export const DEMO_VEHICLES_MAX_PER_ROUTE = 3;
export const DEMO_SPEED_MIN_KMH = 15;
export const DEMO_SPEED_MAX_KMH = 35;
// B2: short stops, so demo vehicles keep moving like a multicab picking up and dropping off
export const DEMO_STOP_MIN_S = 8;
export const DEMO_STOP_MAX_S = 20;
// At a terminal, where a leg drives on into the next, the wait is longer, as real multicabs do
// (long enough to show Stopped, PRD 7.3)
export const DEMO_TERMINAL_MIN_S = 50;
export const DEMO_TERMINAL_MAX_S = 90;
// A route with no stops (R3, R5) stops this often along its line
export const DEMO_STOP_SPACING_KM = 1.2;
// Seats taken change by at most this many at each stop
export const DEMO_SEAT_CHANGE_MAX = 4;
// One vehicle per route sends for this long, then is silent for this long (Live, Stale, No data), then repeats
export const DEMO_SILENT_SEND_S = 60;
export const DEMO_SILENT_GAP_S = 660;
// At the end of a leg a vehicle drives on to the route's next leg when it starts within this
// distance; otherwise it lays over (shown as Stopped), then starts its trip again from the first leg
export const DEMO_LEG_JOIN_M = 300;
export const DEMO_LAYOVER_S = 30;
// Around that restart the marker is hidden this long on each side, so it never slides across the map
export const DEMO_RESTART_FADE_S = 1;
// How often demo positions are refreshed on screen
export const DEMO_TICK_MS = 1000;
// Speeds kept per vehicle for the stopped check, this far apart
export const DEMO_SPEED_SAMPLE_S = 5;
// Demo feed (Crowdsource tab, restyle): one slot of this many minutes holds 0 to DEMO_FEED_SLOT_MAX posts
export const DEMO_FEED_SLOT_MIN = 6;
export const DEMO_FEED_SLOT_MAX = 2;
// Demo check-in counts (C1): other people waiting at a station, 0 to this many, new every slot
export const DEMO_CHECKIN_OTHERS_MAX = 3;
export const DEMO_CHECKIN_SLOT_MIN = 5;
// Development stress setting: this many demo markers on the selected route (PRD 13: 55 FPS with 50)
export const DEMO_STRESS_MARKERS = 50;
export const DEMO_STRESS_DEV = false;

// --- Bottom sheet over the map (docs/DESIGN.md "Layout Principles")
// Visible height of the sheet at each snap point: a fixed peek, then shares of the screen height
export const SHEET_PEEK_DP = 72;
export const SHEET_HALF_FRACTION = 0.4;
export const SHEET_EXPANDED_FRACTION = 0.9;
// A release faster than this (dp per second) moves to the next snap point in that direction
export const SHEET_FLICK_VELOCITY_DP_S = 500;

// --- Blue dot (PRD 7.3), from the partner's GPS work (merge of b21b0c1). BLUE DOT ONLY: how often
// the foreground position is refreshed for display. Nothing is sent; the relay send rule is
// POSITION_SEND_DISTANCE_M and POSITION_SEND_INTERVAL_S above.
export const BLUE_DOT_UPDATE_INTERVAL_S = 2;
export const BLUE_DOT_UPDATE_DISTANCE_M = 5;
// Zoom used when the camera follows the blue dot
export const MAP_FOLLOW_ZOOM = 16;
// B8: skeletons show at least this long on a tab's first visit; longer on Crowdsource, Profile and
// Notifications, whose data comes over the network
export const SKELETON_MIN_MS = 400;
export const SKELETON_LONG_MS = 900;
// B8: a route framed this recently is framed again when the cards over the map change size (the
// bottom card swaps as the route is picked), so it sits in the space they leave
export const MAP_REFIT_WINDOW_MS = 1500;
// ST2-C3: the camera stays over the offline tiles: the screen edge stops at the tile edge at any zoom
// (the limit follows the visible area, rounded to MAP_VIEW_STEP_DEG; MAP_VIEW_START_DEG is assumed
// across before the first camera report), and it zooms out no further than MAP_MIN_ZOOM (the whole
// route area on a phone).
export const MAP_VIEW_START_DEG = 0.1;
export const MAP_VIEW_STEP_DEG = 0.004;
export const MAP_MIN_ZOOM = 11.5;

// --- Verification window and check-in (PRD 10.2, 8.4, 7.5). Defined now, used later.
export const ROUTE_SNAP_DISTANCE_M = 30;
export const MIN_DISPLACEMENT_M = 50;
export const GPS_ACCURACY_GATE_RELAY_M = 30;
export const GPS_ACCURACY_GATE_CHECKIN_M = 25;
// G0: a fix older than this is stale and refused wherever the gates apply (PRD 10.3)
export const LOCATION_FIX_MAX_AGE_S = 30;
// G0: the version of the location consent notice; a new notice asks again (PRD 7.1, 15.1)
export const LOCATION_CONSENT_VERSION = 1;
// G0: the development fake location source (emulator only): accuracies either side of both gates,
// and how old a "stale" fix is
export const FAKE_FIX_ACCURACY_OPTIONS_M = [10, 25, 28, 40] as const;
export const FAKE_FIX_DEFAULT_ACCURACY_M = 10;
export const FAKE_FIX_STALE_AGE_S = 120;
export const CHECKIN_RADIUS_M = 60;
// A check-in lasts this long (PRD 7.5). The 5-minute reminder arrives with notifications in G1.
export const CHECKIN_LIFETIME_S = 900;
export const CHECKIN_REMINDER_S = 300;

// --- Night Mode window (PRD 10.4). Setting only in v0.
export const NIGHT_MODE_START = '21:00';
export const NIGHT_MODE_END = '04:59';
export const NIGHT_MODE_TZ = 'Asia/Manila';

// --- Energy, feed and tracking (PRD 19, D1, D2, D14; SB1). The same values are the defaults of the
// server's app_config table, which is what the server enforces; these are for the app and the tests.
export const ENERGY_ENABLED_DEFAULT = false;
// ST2-D2: tracking one multicab costs Energy again, in the demo wallet too (Emjay, 2026-10-09: 1 per
// 30-minute session, PRD 11.1); the live switch is app_config.energy_enabled (20261012000000)
export const ENERGY_ENABLED_DEMO = true;
// The Energy balance, refill, history and earn lines. ST2-D: shown again (Emjay, 2026-10-09) so
// commuters see their balance grow as they check in and relay; tracking stays free (charging off, D1).
export const ENERGY_UI_VISIBLE = true;
export const ENERGY_WALLET_CAP = 5;
export const ENERGY_GPS_REPORT = 1.0;
export const ENERGY_NO_GPS_REPORT = 0.5;
export const ENERGY_CHECKIN = 0.3;
export const ENERGY_PASSIVE_AMOUNT = 1;
export const ENERGY_PASSIVE_INTERVAL_H = 12;
export const ENERGY_PASSIVE_DAILY_MAX = 2;
export const ENERGY_TRACKING_COST = 1;
export const TRACKING_SESSION_MIN = 30;
// SB2: the newest Energy history lines shown in Profile
export const ENERGY_HISTORY_LIMIT = 20;
// How often the refill countdown in the top bar and Profile updates
export const ENERGY_COUNTDOWN_TICK_S = 30;
// C1: how often the station counts reload while Check-in is open; RP1/N1: the feed lines read
export const CHECKIN_COUNTS_REFRESH_S = 30;
export const FEED_READ_LIMIT = 50;
export const FEED_LIFETIME_MIN = 60;
export const FEED_FLAG_HIDE_COUNT = 3;
// N1: the neutral author badges cycle through this many theme colours (PRD 19 D2)
export const FEED_BADGE_COLOR_COUNT = 6;
export const FEED_PHRASES = ['full', 'few_seats', 'not_moving', 'heavy_traffic', 'loading'] as const;
// B6: a relay names the nearest stop within this distance of the phone ("Near ..."), or none
export const FEED_STOP_NEAR_M = 500;
// B6: trust points for the Trusted badge: one per check-in and per relay nobody flagged (server:
// app_config.trust_badge_points)
export const TRUST_BADGE_POINTS = 5;
// B6: at most this many trust points a Manila day (server: app_config.trust_daily_max)
export const TRUST_DAILY_MAX = 3;
// B4: a relay with GPS shares the rider's location until they come this close to the destination
// they picked, or for this long at most
export const RELAY_DESTINATION_ARRIVED_M = 100;
export const RELAY_BROADCAST_MAX_MIN = 90;
// B4: how often the time limit is checked while the relay shares the location
export const RELAY_CHECK_S = 30;
// Asia/Manila is UTC+8 all year (no daylight saving).
export const MANILA_UTC_OFFSET_MIN = 480;

// --- Onboarding v2 and the greeting (PRD 19, D3 and D11)
// Asia/Manila hour at which each greeting period starts; night runs from the last to the first
export const GREETING_MORNING_START_H = 5;
export const GREETING_AFTERNOON_START_H = 11;
export const GREETING_EVENING_START_H = 17;
export const GREETING_NIGHT_START_H = 21;
// Preset avatars: ids 0 to AVATAR_COUNT - 1. A stated gender picks from its own set; no answer or
// "Prefer not to say" picks from all of them. ST2-C: Emjay's 16 illustrations, 10 male and 6 female.
export const AVATAR_COUNT = 16;
export const AVATAR_IDS_MALE: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
export const AVATAR_IDS_FEMALE: readonly number[] = [10, 11, 12, 13, 14, 15];
// ST2-C2: matches listed under From or To while typing in My Rides
export const PLACE_SEARCH_MAX_RESULTS = 6;
// Frequent destinations kept on the phone (decision 5)
export const FREQUENT_DESTINATIONS_MAX = 3;
// F5: badges from simple counts (PRD 19, D8); no ranking. The "first" badges need one.
export const BADGE_STOP_REGULAR_CHECKINS = 5;
export const BADGE_HELPING_HAND_REPORTS = 5;
export const BADGE_ROAD_REGULAR_REPORTS = 20;
// F3: a place saved from a map tap is named by its position, rounded to about 1 m
export const PLACE_ID_DECIMALS = 5;

// --- Connection (PRD 14: in a network outage live features pause with a visible banner). The app
// asks the server every CONNECTION_PROBE_S while live data is on; no answer in the timeout is offline.
export const CONNECTION_PROBE_S = 30;
export const CONNECTION_PROBE_TIMEOUT_MS = 5000;

// --- Privacy (PRD 15.1): the contact point for privacy questions and data requests (Emjay, 2026-10-08)
export const PRIVACY_CONTACT_EMAIL = 'emspar30@gmail.com';

// --- BLE (PRD 10.1, 12.4). Starting hypotheses, tuned by field experiments E1 and E2 (PRD 17.1).
export const RSSI_SMOOTHING_ALPHA = 0.3;
export const RSSI_PRESENCE_THRESHOLD_DBM = -65;
// The stronger of two beacons wins only if it leads by this much; otherwise ambiguous (PRD 10.1)
export const RSSI_MARGIN_DB = 8;
// A beacon is present after its smoothed signal stays above the threshold this long (PRD 10.1)
export const BEACON_PRESENCE_S = 3;
// DR2: a beacon not heard for this long is gone, whatever its last signal (hypothesis; E1)
export const BEACON_LOST_S = 10;
// The commuter app listens for this long once armed (PRD 8.1)
export const ARMED_SCAN_MIN = 15;

// --- Driver beacon (PRD 8.2, 9.2; DR2, docs/IMPLEMENTATION_PLAN_DRIVER.md section 6.1). Not a secret:
// every Tunton beacon advertises this service UUID, so commuter phones can filter on it.
export const BEACON_SERVICE_UUID = '45ca985d-065a-488b-b652-af6ec6cf1b4e';
export const BEACON_PAYLOAD_VERSION = 1;
// The rotating code changes every slot; the server accepts the current slot plus or minus the tolerance
export const BEACON_SLOT_S = 60;
export const BEACON_SLOT_TOLERANCE = 1;
// Advertising settings passed to the native module (PRD 9.2: balanced, about 250 ms; power tuned in E1)
export const BEACON_ADVERTISE_MODE = 'balanced';
export const BEACON_TX_POWER = 'medium';

// --- SMS protocol v2 (PRD 12.3)
export const SMS_MAX_AGE_MIN = 30;
export const SMS_STALE_HEATMAP_MIN = 15;
export const SMS_SEQ_MODULUS = 10000;
// A sequence number is newer if it is 1 to this many ahead of the last one, modulo SMS_SEQ_MODULUS.
export const SMS_SEQ_NEWER_WINDOW = 5000;
// One text SMS holds 160 GSM-7 septets; a data SMS 140 bytes, less the 7-byte port header
// (DATA_SMS_MAX_BYTES is confirmed on the pilot carrier in DR5)
export const SMS_TEXT_MAX_SEPTETS = 160;
export const DATA_SMS_MAX_BYTES = 133;
// The driver app listens for data SMS on this port (not a well-known port)
export const DATA_SMS_PORT = 8901;

// --- Heatmap dispatch (PRD 9.6; the SMS worker, DR6). Per route, the worker sends when a stop's
// count changes by DISPATCH_MIN_CHANGE or more, or every DISPATCH_INTERVAL_MIN while any count is
// above zero, and only between the operating hours (minutes after midnight, Asia/Manila; Q6: 05:00 to 21:00).
export const SMS_DISPATCH_MIN_CHANGE = 2;
export const SMS_DISPATCH_INTERVAL_MIN = 5;
export const SMS_OPERATING_START_MIN = 300;
export const SMS_OPERATING_END_MIN = 1260;

// --- Driver app (PRD 9.4; DR5). Waiting counts are shown in bands: 0, 1 to 4, 5 to 9, 10 or more.
export const HEATMAP_BAND_EDGES = [1, 5, 10] as const;
// Q5: exact numbers in the list (the map shows bands). Q11: bands only during Night Mode.
export const DRIVER_SHOW_EXACT_COUNTS = true;
export const DRIVER_NIGHT_BANDS_ONLY = true;
// The driver phone warns when its clock is off by more than this (PRD 8.2, 14)
export const CLOCK_DRIFT_WARN_S = 90;
// The clock estimate looks at the last few heatmap messages' carrier timestamps
export const CLOCK_DRIFT_SAMPLES = 5;

// --- Provisioning (PRD 9.5; DR3, DR4). A setup QR expires this long after it is printed.
export const PROVISIONING_QR_TTL_MIN = 15;
// Q12: the admin screens are behind a PIN of this many digits
export const ADMIN_PIN_DIGITS = 6;
