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
export const ROUTING_P95_BUDGET_MS = 250;

// --- Route data checks (seeding now, the import script later)
// A stop is listed on a line only if it lies within the maximum distance of it
export const ROUTE_STOP_WARN_DISTANCE_M = 50;
export const ROUTE_STOP_MAX_DISTANCE_M = 150;
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
// RR2 trim: a leg is cut at its trim point (the terminal) only if the point lies this close to the
// line and the part beyond it is longer than the second value (Emjay, 2026-10-05)
export const ROUTE_TRIM_MAX_OFFSET_M = 150;
export const ROUTE_TRIM_MIN_TAIL_M = 300;
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
export const MAP_OVERZOOM_LEVELS = 4;
// LB1a glyph proof: in development builds only, print one test label ("Butuan") at the city centre.
// Off except while checking the offline fonts (passed 2026-10-05); real labels come with LB1b.
export const MAP_LABEL_PROOF_DEV = false;

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
export const DEMO_STOP_MIN_S = 20;
export const DEMO_STOP_MAX_S = 60;
// A route with no stops (R3, R5) stops this often along its line
export const DEMO_STOP_SPACING_KM = 1.2;
// Seats taken change by at most this many at each stop
export const DEMO_SEAT_CHANGE_MAX = 4;
// One vehicle per route sends for this long, then is silent for this long (Live, Stale, No data), then repeats
export const DEMO_SILENT_SEND_S = 60;
export const DEMO_SILENT_GAP_S = 660;
// How often demo positions are refreshed on screen
export const DEMO_TICK_MS = 1000;
// Speeds kept per vehicle for the stopped check, this far apart
export const DEMO_SPEED_SAMPLE_S = 5;
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

// --- Verification window and check-in (PRD 10.2, 8.4, 7.5). Defined now, used later.
export const ROUTE_SNAP_DISTANCE_M = 30;
export const MIN_DISPLACEMENT_M = 50;
export const GPS_ACCURACY_GATE_RELAY_M = 30;
export const GPS_ACCURACY_GATE_CHECKIN_M = 25;
export const CHECKIN_RADIUS_M = 60;
// A check-in lasts this long (PRD 7.5). The 5-minute reminder arrives with notifications in G1.
export const CHECKIN_LIFETIME_S = 900;
export const CHECKIN_REMINDER_S = 300;

// --- Night Mode window (PRD 10.4). Setting only in v0.
export const NIGHT_MODE_START = '21:00';
export const NIGHT_MODE_END = '04:59';
export const NIGHT_MODE_TZ = 'Asia/Manila';
// Asia/Manila is UTC+8 all year (no daylight saving).
export const MANILA_UTC_OFFSET_MIN = 480;

// --- Onboarding v2 and the greeting (PRD 19, D3 and D11)
// Asia/Manila hour at which each greeting period starts; night runs from the last to the first
export const GREETING_MORNING_START_H = 5;
export const GREETING_AFTERNOON_START_H = 11;
export const GREETING_EVENING_START_H = 17;
export const GREETING_NIGHT_START_H = 21;
// Preset avatars: ids 0 to AVATAR_COUNT - 1. A stated gender picks from its own set; no answer or
// "Prefer not to say" picks from all of them.
export const AVATAR_COUNT = 12;
export const AVATAR_IDS_MALE: readonly number[] = [0, 1, 2, 3, 4, 5];
export const AVATAR_IDS_FEMALE: readonly number[] = [6, 7, 8, 9, 10, 11];
// Frequent destinations kept on the phone (decision 5)
export const FREQUENT_DESTINATIONS_MAX = 3;

// --- BLE (PRD 10.1, 12.4). Only the smoothing function exists in v0.
export const RSSI_SMOOTHING_ALPHA = 0.3;
export const RSSI_PRESENCE_THRESHOLD_DBM = -65;

// --- SMS protocol v2 (PRD 12.3)
export const SMS_MAX_AGE_MIN = 30;
export const SMS_STALE_HEATMAP_MIN = 15;
export const SMS_SEQ_MODULUS = 10000;
// A sequence number is newer if it is 1 to this many ahead of the last one, modulo SMS_SEQ_MODULUS.
export const SMS_SEQ_NEWER_WINDOW = 5000;
