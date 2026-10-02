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

// A telemetry packet must stay small, to keep data use low (PRD 8.4)
export const PACKET_MAX_BYTES = 150;

// How long the writer audit log keeps a row
export const INGEST_LOG_RETENTION_DAYS = 30;
