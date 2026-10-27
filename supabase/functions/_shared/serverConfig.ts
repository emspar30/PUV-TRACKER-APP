// Constants the server enforces (PRD 0.3). Pure TypeScript with no imports, so the same file is used
// by the Edge Function (Deno) and by the app, whose config module re-exports these values.
// Each value therefore has exactly one definition.

// Verification is off in Prototype v0 (PRD 0.7). Read in one place only: verifyReport.
export const ENABLE_VERIFICATION = false;

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
// The number check: a code of this many digits, valid this long and sent again only after this long.
// Each check is a text from the gateway SIM and anyone can start one, so they are limited per number
// and in total per Manila day (D6), and a code allows only a few wrong tries.
export const REGISTRATION_CODE_DIGITS = 6;
export const REGISTRATION_CHECK_TTL_MIN = 10;
export const REGISTRATION_CHECK_RESEND_MIN = 10;
export const REGISTRATION_CHECK_MAX_TRIES = 5;
export const REGISTRATION_CHECKS_PER_NUMBER_PER_DAY = 3;
export const REGISTRATION_CHECKS_PER_DAY = 20;
// After the number check, the photos and the submission must follow within this long
export const REGISTRATION_SUBMIT_WITHIN_MIN = 60;
// An approved setup must be collected within this many days, or the driver registers again
export const REGISTRATION_SETUP_TTL_DAYS = 7;
// Numbers starting with this are the live tests' made-up numbers: their checks are recorded but
// never texted
export const REGISTRATION_TEST_PHONE_PREFIX = '+6399900010';
// A plate has this many letters and digits (at least one of each); the database allows 16 characters
export const PLATE_MIN_CHARS = 3;
export const PLATE_MAX_CHARS = 10;
