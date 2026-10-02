// Single source of every threshold, fare value and feature flag (PRD 0.3).
// All values are starting hypotheses (PRD 17). No other module may contain a threshold literal.

// --- Verification (PRD 0.7). Read in one place only: verifyReport.
export const ENABLE_VERIFICATION = false;

// --- Position send rule (PRD 8.4)
export const POSITION_SEND_DISTANCE_M = 100;
export const POSITION_SEND_INTERVAL_S = 30;

// --- Stationary bubble (PRD 7.3)
export const STATIONARY_SPEED_KMH = 2;
export const STATIONARY_DURATION_S = 45;

// --- Liveness and coverage states (PRD 7.3, 8.4)
export const LIVENESS_TIMEOUT_S = 90;
export const COVERAGE_LIVE_MAX_AGE_S = 90;
export const COVERAGE_STALE_MAX_AGE_S = 600;
export const LIVE_UI_REFRESH_INTERVAL_S = 5;

// --- Telemetry timestamp limits (PRD 0.3, added after audit)
export const PACKET_MAX_AGE_S = 120;
export const PACKET_MAX_FUTURE_S = 30;

// --- Offline buffer (PRD 8.4). Defined now, used later.
export const OFFLINE_BUFFER_SIZE = 60;

// --- Occupancy, by seats taken (PRD 7.3)
export const VEHICLE_CAPACITY_SEATS = 16;
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

// --- Offline map (PRD 7.2)
// How far the map may zoom in past the tile set's last zoom level by stretching its tiles
export const MAP_OVERZOOM_LEVELS = 4;

// --- Verification window and check-in (PRD 10.2, 8.4, 7.5). Defined now, used later.
export const ROUTE_SNAP_DISTANCE_M = 30;
export const MIN_DISPLACEMENT_M = 50;
export const GPS_ACCURACY_GATE_RELAY_M = 30;
export const GPS_ACCURACY_GATE_CHECKIN_M = 25;
export const CHECKIN_RADIUS_M = 60;

// --- Night Mode window (PRD 10.4). Setting only in v0.
export const NIGHT_MODE_START = '21:00';
export const NIGHT_MODE_END = '04:59';
export const NIGHT_MODE_TZ = 'Asia/Manila';
// Asia/Manila is UTC+8 all year (no daylight saving).
export const MANILA_UTC_OFFSET_MIN = 480;

// --- BLE (PRD 10.1, 12.4). Only the smoothing function exists in v0.
export const RSSI_SMOOTHING_ALPHA = 0.3;
export const RSSI_PRESENCE_THRESHOLD_DBM = -65;

// --- SMS protocol v2 (PRD 12.3)
export const SMS_MAX_AGE_MIN = 30;
export const SMS_STALE_HEATMAP_MIN = 15;
export const SMS_SEQ_MODULUS = 10000;
// A sequence number is newer if it is 1 to this many ahead of the last one, modulo SMS_SEQ_MODULUS.
export const SMS_SEQ_NEWER_WINDOW = 5000;
