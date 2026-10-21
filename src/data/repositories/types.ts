// Screens read live data only through these interfaces (AF2). Each has a demo implementation on the
// phone now (src/data/demo) and a Supabase implementation later (SB1, L1, C1), with no change to the
// screens. Until then the "none" implementation stands in: it has no data, so screens say "No data".
// Pure types: no React Native or Expo imports.

import type { EnergyKind, FeedPhrase } from '../../shared/backend/rules';
import type { FeedPost } from '../../shared/demo/feed';
import type { SeatTier } from '../../shared/telemetry/occupancy';
import type { VehicleSnapshot } from '../../shared/telemetry/vehicle';

// Where the data comes from. Every screen that shows "demo" data shows the "Demo" chip.
// 'live' reads the database (L1); 'none' has no data, so screens say "No data".
export type LiveSource = 'demo' | 'live' | 'none';

export type Unsubscribe = () => void;

export type VehiclesRepository = {
  source: LiveSource;
  // Calls the listener at once and whenever the route's vehicles change, until unsubscribed
  subscribe(routeCode: string, listener: (vehicles: readonly VehicleSnapshot[]) => void): Unsubscribe;
};

// A failed cloud call: 'sign_in' when there is no account (live data), else the message
export type CloudFailure = { ok: false; reason: 'sign_in' | 'error'; message?: string };

// CA1.1: a check-in costs Energy for each route pinged; not_enough_energy when the wallet is short
export type CheckInResult = { ok: true; expiresAtMs: number } | CloudFailure | { ok: false; reason: 'not_enough_energy' };

// C1: station check-ins. Demo keeps them on the phone; live calls check_in, checkin_counts and
// end_check_in. CA1.1: the check-in spends Energy for each route pinged inside the same call.
export type CheckinsRepository = {
  source: LiveSource;
  // People waiting per station code on a route (the caller included; a station with nobody is
  // left out), or null when unknown. The demo makes up counts for the route's `stationCodes`.
  waitingCounts(routeCode: string, stationCodes: readonly string[]): Promise<ReadonlyMap<string, number> | null>;
  // One route, or several at a shared stop (each counted, and each driver's SMS, separately)
  checkIn(routeCodes: readonly string[], stationCode: string, requestKey: string): Promise<CheckInResult>;
  // "I boarded" or "Cancel": the caller's count drops at once
  end(): Promise<void>;
};

export type ReportInput = {
  routeCode: string;
  // B4: optional; the seat tier is what the Relay panel always asks for
  phrase: FeedPhrase | null;
  seatTier: SeatTier | null;
  // The manual vehicle picker (D5, development builds); null when not picked
  vehicleId: string | null;
  // B6: the stop nearest to the phone when it was sent (sent even without GPS; no coordinates)
  stopCode: string | null;
  withGps: boolean;
  // DR8: the newest code of the multicab's beacon, when Bluetooth found it; the server checks it
  beaconHex?: string | null;
};

// postId: the new post's id, so the feed can mark the user's own posts "You" (EQ-7)
export type ReportResult = { ok: true; postId?: string } | CloudFailure | { ok: false; reason: 'no_username' };

// RP1: the Report button. Demo keeps the posts on the phone; live calls post_report and reads
// feed_posts. A report earns Energy (with GPS 1.0, without 0.5; once a Manila day each).
export type ReportsRepository = {
  source: LiveSource;
  post(input: ReportInput, requestKey: string): Promise<ReportResult>;
  // Live posts, newest first; null when unknown (signed out)
  recent(): Promise<readonly FeedPost[] | null>;
  // N1: flags someone else's post (flag_post; one flag per account). hidden: it reached
  // FEED_FLAG_HIDE_COUNT flags and went to the review queue
  flag(postId: string): Promise<FlagResult>;
};

export type FlagResult = { ok: true; hidden: boolean } | CloudFailure;

// One line of the Energy history; spends are negative
export type EnergyEntry = { kind: EnergyKind; amount: number; atMs: number };

// The wallet as the server sees it. `enabled` false means tracking is free (D1).
// nextRefillMs: when the next passive refill is due (the countdown); null while the wallet is full
export type EnergySnapshot = { balance: number; enabled: boolean; history: readonly EnergyEntry[]; nextRefillMs: number | null };

export type TrackingStart =
  | { ok: true; endsAtMs: number }
  | { ok: false; reason: 'not_enough_energy' | 'sign_in' | 'error'; message?: string };

// SB2: Tracking Energy (PRD 19, D1 and D14). Demo keeps a ledger on the phone; live calls the
// SB1 functions, which own every rule.
export type EnergyRepository = {
  source: LiveSource;
  // Books the passive refill when it is due, then reads the wallet; null when unknown (signed out)
  refresh(): Promise<EnergySnapshot | null>;
  // Starts a tracking session for one PUV; the same request key never pays twice
  startTracking(requestKey: string): Promise<TrackingStart>;
};

export type Repositories = {
  vehicles: VehiclesRepository;
};
