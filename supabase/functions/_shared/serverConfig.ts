// Constants the server enforces (PRD 0.3). Pure TypeScript with no imports, so the same file is used
// by the Edge Function (Deno) and by the app, whose config module re-exports these values.
// Each value therefore has exactly one definition.

// V1a (2026-11-02): verification is on (PRD 0.7 was off). Read in one place only: verifyReport.
export const ENABLE_VERIFICATION = true;

// A vehicle counts as stopped below this speed (PRD 7.3)
export const STATIONARY_SPEED_KMH = 2;

// Telemetry timestamp limits (PRD 0.3, added after audit)
export const PACKET_MAX_AGE_S = 120;
export const PACKET_MAX_FUTURE_S = 30;

// Seats taken may not exceed the vehicle capacity (PRD 7.3)
export const VEHICLE_CAPACITY_SEATS = 16;

// No multicab travels faster than this; a larger speed is a broken or forged packet
export const PACKET_MAX_SPEED_KMH = 200;

// A telemetry packet must stay small, to keep data use low (PRD 8.4)
export const PACKET_MAX_BYTES = 150;

// How long the writer audit log keeps a row
export const INGEST_LOG_RETENTION_DAYS = 30;

// T1: store and forward (PRD 8.4). A phone sends the positions it buffered as one batch of at most
// TELEMETRY_BATCH_MAX_POINTS, in at most TELEMETRY_BATCH_MAX_BYTES. Positions up to
// PACKET_BACKLOG_MAX_AGE_S old are kept as history (telemetry_raw); only a position within
// PACKET_MAX_AGE_S moves the marker.
export const TELEMETRY_BATCH_MAX_POINTS = 60;
export const TELEMETRY_BATCH_MAX_BYTES = 4096;
export const PACKET_BACKLOG_MAX_AGE_S = 1800;

// --- Driver setup (PRD 9.5). A setup QR, or a setup collected after approval, is accepted this long.
export const PROVISIONING_QR_TTL_MIN = 15;

// --- Driver registration (PRD 9.5 and 0.3; docs/IMPLEMENTATION_PLAN_DRIVER_REGISTRATION.md, owner
// decisions D1 to D6). The photos of the CTTDM driver ID and the multicab: the long side at most this
// many pixels, as JPEG, and never more than this many bytes. They are deleted at the decision (D1).
export const REGISTRATION_PHOTO_MAX_PX = 1600;
export const REGISTRATION_PHOTO_MAX_BYTES = 1_000_000;
// The number check. Since 2026-10-28 (owner) no text is sent: the function confirms its own code at
// once, so only the limits matter. Anyone can start a registration, and each start opens two photo
// upload links, so starts are limited per number and in total per Manila day (D6). The code, its
// lifetime, the resend wait and the wrong tries are kept for the database functions (and the SMS
// check, should it come back).
export const REGISTRATION_CODE_DIGITS = 6;
export const REGISTRATION_CHECK_TTL_MIN = 10;
export const REGISTRATION_CHECK_RESEND_MIN = 10;
export const REGISTRATION_CHECK_MAX_TRIES = 5;
export const REGISTRATION_CHECKS_PER_NUMBER_PER_DAY = 3;
export const REGISTRATION_CHECKS_PER_DAY = 20;
// After the number is entered, the photos and the submission must follow within this long
export const REGISTRATION_SUBMIT_WITHIN_MIN = 60;
// An approved setup must be collected within this many days, or the driver registers again
export const REGISTRATION_SETUP_TTL_DAYS = 7;
// A plate has this many letters and digits (at least one of each); the database allows 16 characters
export const PLATE_MIN_CHARS = 3;
export const PLATE_MAX_CHARS = 10;

// NM1 Night Mode stop view (PRD 10.4): an accepted position within NODE_PASS_RADIUS_M of a stop of the
// vehicle's route records that the route passed the stop, at most once per vehicle and stop every
// NODE_PASS_GAP_MIN. The stop view shows passages up to NIGHT_STOP_WINDOW_MIN old.
export const NODE_PASS_RADIUS_M = 50;
export const NODE_PASS_GAP_MIN = 10;
export const NIGHT_STOP_WINDOW_MIN = 60;

// RK1 (PRD 10.3): a position implying more than IMPOSSIBLE_SPEED_KMH from the vehicle's last one is
// rejected and booked as a risk event; the first SPEED_JUMP_ALLOWANCE_M of a jump are GPS wander
export const IMPOSSIBLE_SPEED_KMH = 120;
export const SPEED_JUMP_ALLOWANCE_M = 50;

// V1a verification window (PRD 10.2, S8). A relay is verified when, within the window, the multicab
// held MOTION_SPEED_FALLBACK_KMH for MOTION_SPEED_FALLBACK_S (no activity recognition, D6), every usable
// fix stayed within ROUTE_SNAP_DISTANCE_M of the route line, and it moved MIN_DISPLACEMENT_M along the
// line. A fix is usable at VERIFY_FIX_ACCURACY_M or better. The window is VERIFY_WINDOW_S, extended to
// VERIFY_WINDOW_MAX_S while the multicab is slow (traffic). Field values come from S10.
export const MOTION_SPEED_FALLBACK_KMH = 25;
export const MOTION_SPEED_FALLBACK_S = 20;
export const ROUTE_SNAP_DISTANCE_M = 30;
export const MIN_DISPLACEMENT_M = 50;
export const VERIFY_FIX_ACCURACY_M = 30;
export const VERIFY_WINDOW_S = 30;
export const VERIFY_WINDOW_MAX_S = 90;
