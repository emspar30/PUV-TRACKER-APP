// RL1 (PRD 8.1 step 8, 8.4; Emjay's D1 to D3, 2026-10-22): when a relay with GPS ends by itself.
// - Arrival: the rider stays within RELAY_ARRIVAL_RADIUS_M of the destination for
//   RELAY_ARRIVAL_COUNTDOWN_S; leaving the radius cancels the countdown.
// - Idle: the rider stays within RELAY_IDLE_RADIUS_M of one spot for RELAY_IDLE_MIN, or
//   RELAY_IDLE_TERMINAL_MIN at a terminal. Inside an active high-traffic zone (HIGH_TRAFFIC_ZONES) the
//   idle clock is held, so a long red light never ends a relay. A still phone gets no new fixes, so
//   the last known position counts as where the rider still is.
// - Cap: RELAY_SESSION_CAP_H after the start, or after the last "Keep sharing", the rider is asked
//   "Still riding?"; with no answer within RELAY_CAP_ANSWER_MIN the relay ends.
// - Get off soon (Emjay, 2026-11-02): once, when the rider first comes within RELAY_GET_OFF_WARN_M
//   of the destination after a reading farther out. Not when the relay starts that close.
// - Detour (Phase 2, owner 2026-11-22): farther than SHORT_DETOUR_FROM_M from the route line (and
//   from its terminals) is a short detour, allowed up to SHORT_DETOUR_MAX_M away and for
//   SHORT_DETOUR_MAX_MIN; past either the relay ends. Being stopped never ends it by itself, except
//   the idle rule above (kept while the phone cannot listen for the beacon during a relay).
// The watch is brought up to date with each position and clock tick (watchRelay) and read by relayEnd.
// Pure: no React Native or Expo imports.

import { inManilaWindow } from '../backend/rules';
import {
  HIGH_TRAFFIC_ZONE_RADIUS_M,
  HIGH_TRAFFIC_ZONES,
  RELAY_ARRIVAL_COUNTDOWN_S,
  RELAY_ARRIVAL_RADIUS_M,
  RELAY_CAP_ANSWER_MIN,
  RELAY_GET_OFF_WARN_M,
  RELAY_IDLE_MIN,
  RELAY_IDLE_RADIUS_M,
  RELAY_IDLE_TERMINAL_MIN,
  RELAY_SESSION_CAP_H,
  RELAY_TERMINAL_RADIUS_M,
  SHORT_DETOUR_FROM_M,
  SHORT_DETOUR_MAX_M,
  SHORT_DETOUR_MAX_MIN,
} from '../config';
import { haversineMeters, type LatLon } from '../geo/haversine';
import { projectOntoLine } from '../geo/line';
import { crossesAlert } from '../tracking/eta';

import type { RelayBroadcast } from './broadcast';

const MS_PER_S = 1000;
const MS_PER_MIN = 60_000;
const MS_PER_HOUR = 3_600_000;

export type RelayWatch = {
  // When the rider came within RELAY_ARRIVAL_RADIUS_M of the destination; null outside it
  arrivingSinceMs: number | null;
  // Where the rider has stood still and since when; null before the first position
  idle: { at: LatLon; sinceMs: number } | null;
  // When the cap's hours started (the start, or the last "Keep sharing")
  capFromMs: number;
  // When "Still riding?" was asked; null while not asked
  askedMs: number | null;
  // Metres to the destination at the last position; null before the first
  destinationM: number | null;
  // True once the rider has been told to get ready to get off
  getOffSoon: boolean;
  // Phase 2: since when the rider has been off the route line, and the farthest from it; null on it
  offRoute: { sinceMs: number; farthestM: number } | null;
};

export type RelayEnd = 'arrived' | 'idle' | 'capped' | 'detour';

export type HighTrafficZone = (typeof HIGH_TRAFFIC_ZONES)[number];

export function startWatch(startedMs: number): RelayWatch {
  return { arrivingSinceMs: null, idle: null, capFromMs: startedMs, askedMs: null, destinationM: null, getOffSoon: false, offRoute: null };
}

// Metres from the position to the route: its nearest line, or a terminal (a terminal's parking may
// sit off the line); null without lines (no detour check)
export function routeOffsetM(session: Pick<RelayBroadcast, 'lines' | 'terminals'>, position: LatLon): number | null {
  const lines = (session.lines ?? []).filter((line) => line.length > 0);
  if (lines.length === 0) return null;
  if (session.terminals.some((terminal) => haversineMeters(terminal, position) <= RELAY_TERMINAL_RADIUS_M)) return 0;
  return Math.min(...lines.map((line) => projectOntoLine(line, position).offsetM));
}

// Metres from the position to the zone: to its point, or to the stretch between its two points
export function zoneDistanceM(position: LatLon, zone: HighTrafficZone): number {
  return projectOntoLine(
    zone.points.map((point) => [point.lon, point.lat]),
    position,
  ).offsetM;
}

// The high-traffic zone the position is in at this time, or null. A rush-hour zone counts only in its hours.
export function activeZone(position: LatLon, nowMs: number, zones: readonly HighTrafficZone[] = HIGH_TRAFFIC_ZONES): HighTrafficZone | null {
  return (
    zones.find(
      (zone) =>
        (zone.hours === null || inManilaWindow(nowMs, zone.hours[0], zone.hours[1])) && zoneDistanceM(position, zone) <= HIGH_TRAFFIC_ZONE_RADIUS_M,
    ) ?? null
  );
}

// The watch after a position (or a clock tick with the same position). Without a position nothing changes.
export function watchRelay(watch: RelayWatch, session: RelayBroadcast, position: LatLon | null, nowMs: number): RelayWatch {
  if (!position) return watch;
  const destinationM = haversineMeters(position, session.destination);
  const arriving = destinationM <= RELAY_ARRIVAL_RADIUS_M;
  // The same once-only crossing as the tracking alert, on metres instead of seconds
  const getOffSoon = watch.getOffSoon || (watch.destinationM !== null && crossesAlert(watch.destinationM, destinationM, RELAY_GET_OFF_WARN_M));
  // In an active zone the idle clock starts again at every look, so it never runs out there
  const moved = !watch.idle || haversineMeters(watch.idle.at, position) > RELAY_IDLE_RADIUS_M || activeZone(position, nowMs) !== null;
  const offsetM = routeOffsetM(session, position);
  const offRoute =
    offsetM === null || offsetM <= SHORT_DETOUR_FROM_M
      ? null
      : { sinceMs: watch.offRoute?.sinceMs ?? nowMs, farthestM: Math.max(watch.offRoute?.farthestM ?? 0, offsetM) };
  return {
    ...watch,
    arrivingSinceMs: arriving ? (watch.arrivingSinceMs ?? nowMs) : null,
    idle: moved ? { at: { lat: position.lat, lon: position.lon }, sinceMs: nowMs } : watch.idle,
    destinationM,
    getOffSoon,
    offRoute,
  };
}

// True when the short detour went too far or lasted too long
export function detourExceeded(watch: Pick<RelayWatch, 'offRoute'>, nowMs: number): boolean {
  const off = watch.offRoute;
  return off !== null && (off.farthestM > SHORT_DETOUR_MAX_M || nowMs - off.sinceMs >= SHORT_DETOUR_MAX_MIN * MS_PER_MIN);
}

// How long the rider may stand still at this spot: longer at a terminal
export function idleLimitMin(session: RelayBroadcast, at: LatLon): number {
  return session.terminals.some((terminal) => haversineMeters(terminal, at) <= RELAY_TERMINAL_RADIUS_M) ? RELAY_IDLE_TERMINAL_MIN : RELAY_IDLE_MIN;
}

// True when "Still riding?" should be asked now
export function capDue(watch: RelayWatch, nowMs: number): boolean {
  return watch.askedMs === null && nowMs >= watch.capFromMs + RELAY_SESSION_CAP_H * MS_PER_HOUR;
}

export const askedWatch = (watch: RelayWatch, nowMs: number): RelayWatch => ({ ...watch, askedMs: nowMs });

// "Keep sharing": the cap's hours start again
export const renewedWatch = (watch: RelayWatch, nowMs: number): RelayWatch => ({ ...watch, capFromMs: nowMs, askedMs: null });

// Why the relay ends now, or null while it goes on
export function relayEnd(session: RelayBroadcast, watch: RelayWatch, nowMs: number): RelayEnd | null {
  if (watch.arrivingSinceMs !== null && nowMs - watch.arrivingSinceMs >= RELAY_ARRIVAL_COUNTDOWN_S * MS_PER_S) return 'arrived';
  if (detourExceeded(watch, nowMs)) return 'detour';
  if (watch.idle && nowMs - watch.idle.sinceMs >= idleLimitMin(session, watch.idle.at) * MS_PER_MIN) return 'idle';
  if (watch.askedMs !== null && nowMs - watch.askedMs >= RELAY_CAP_ANSWER_MIN * MS_PER_MIN) return 'capped';
  return null;
}

// Whole seconds left of the arrival countdown, or null when it is not running
export function arrivalLeftS(watch: RelayWatch, nowMs: number): number | null {
  if (watch.arrivingSinceMs === null) return null;
  return Math.max(0, Math.ceil((watch.arrivingSinceMs + RELAY_ARRIVAL_COUNTDOWN_S * MS_PER_S - nowMs) / MS_PER_S));
}

// Whole minutes until "Still riding?" is asked, the cap's hours having started at capFromMs
export function askInMin(capFromMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((capFromMs + RELAY_SESSION_CAP_H * MS_PER_HOUR - nowMs) / MS_PER_MIN));
}
