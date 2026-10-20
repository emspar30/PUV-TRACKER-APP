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
