// Tracking one vehicle (L2): its simple ETA to the commuter's boarding point (PRD 19.2 D9) and where it
// is among the stops. B2: the distance follows the vehicle's round (routing/loop), so once it has
// passed the commuter the ETA counts on to its next time round instead of stopping. Pass the lines
// with their stand-in legs (withReturnLegs). Phase 2 (owner, 2026-11-22): the speed counts moving
// time only, a stop allowance per km is added, a stopped multicab's ETA holds instead of counting
// down, and a multicab on a short detour has its ETA paused. 2026-11-24 (field test: a rider level with
// the multicab saw about 6 km): a tracker within TRACK_HERE_M of the multicab is "Here"; a tracker
// behind the multicab on its own leg is Passed, with the next arrival kept apart, so a distance never
// wraps round the loop as if the multicab were still coming; and tracking aims at the stop ahead of
// the multicab nearest the tracker. Pure: no React Native or Expo imports.

import {
  COVERAGE_LIVE_MAX_AGE_S,
  ETA_MAX_KM,
  ETA_MIN_SAMPLES,
  ETA_MOVING_WINDOW_S,
  ETA_STOP_ALLOWANCE_S_PER_KM,
  LIVE_LINE_TIE_M,
  MAX_WALK_PER_LEG_M,
  ROUTE_STOP_MAX_DISTANCE_M,
  STATIONARY_SPEED_KMH,
  TRACK_HERE_M,
} from '../config';
import { lineEndKm, linePasses, type LineProjection } from '../geo/line';
import { haversineMeters, type LatLon } from '../geo/haversine';
import { routeRound } from '../routing/loop';
import { passesKm, vehicleChainageKm } from '../routing/progress';
import type { DirectedLine, RouteStop } from '../routing/types';
import type { VehicleSnapshot } from '../telemetry/vehicle';

export type Eta =
  // speedKmh: the moving speed; movingNow: the last speed was a moving one (a stopped multicab's ETA
  // holds between packets instead of counting down)
  // here: the tracker is within TRACK_HERE_M of the multicab (distance and time 0)
  | { kind: 'approaching'; distanceKm: number; etaS: number; speedKmh: number; movingNow: boolean; here?: true }
  // Already past the boarding point. nextRoundKm: how far the multicab drives round to it again, when
  // it can (shown apart, never as the distance to the boarding point)
  | { kind: 'passed'; nextRoundKm?: number }
  // Shown as "ETA unavailable": the line does not pass the point, it is too far, too few moving
  // speeds or no longer Live; "ETA paused" while the multicab is on a short detour. distanceKm is kept
  // whenever the line reaches the point, so arrival and the distance alerts do not depend on the ETA.
  | { kind: 'unknown'; reason: 'off_line' | 'too_far' | 'few_samples' | 'stale' | 'paused'; distanceKm?: number };

const MS_PER_S = 1000;
const S_PER_H = 3600;
const METERS_PER_KM = 1000;
const HERE_KM = TRACK_HERE_M / METERS_PER_KM;

// The measured distance along the route, whether or not the ETA is shown (null: off the line or passed)
export function etaDistanceKm(eta: Eta | null): number | null {
  if (!eta || eta.kind === 'passed') return null;
  return eta.distanceKm ?? null;
}

// The heading, when known, places the vehicle on the right pass of a line that uses a street twice
type Tracked = Pick<VehicleSnapshot, 'lat' | 'lon' | 'lineId' | 'lastPacketMs' | 'recentSpeeds' | 'offRouteSinceMs'> & { headingDeg?: number };

// The mean of the moving speeds (STATIONARY_SPEED_KMH or more) in the last ETA_MOVING_WINDOW_S before
// the last packet, so the time stood at a stop does not lower it; null with too few of them
export function movingSpeedKmh(vehicle: Pick<VehicleSnapshot, 'lastPacketMs' | 'recentSpeeds'>): number | null {
  const fromMs = vehicle.lastPacketMs - ETA_MOVING_WINDOW_S * MS_PER_S;
  const moving = vehicle.recentSpeeds.filter(
    (sample) => sample.atMs >= fromMs && sample.atMs <= vehicle.lastPacketMs && sample.speedKmh >= STATIONARY_SPEED_KMH,
  );
  if (moving.length < ETA_MIN_SAMPLES) return null;
  return moving.reduce((sum, sample) => sum + sample.speedKmh, 0) / moving.length;
}

// maxOffsetM: how far the boarding point may be from the line (a stop is close; a rider may walk to it).
// round: false keeps to the vehicle's own leg, so a vehicle past the point says 'passed' (route ranking).
export function etaTo(
  vehicle: Tracked,
  lines: readonly DirectedLine[],
  boarding: LatLon,
  maxOffsetM = ROUTE_STOP_MAX_DISTANCE_M,
  { round = true }: { round?: boolean } = {},
): Eta {
  if (haversineMeters(vehicle, boarding) <= TRACK_HERE_M) return { kind: 'approaching', distanceKm: 0, etaS: 0, speedKmh: 0, movingNow: false, here: true };
  const legs = routeRound(lines, vehicle.lineId);
  const found = distanceRound(round ? legs : legs.slice(0, 1), vehicle, boarding, maxOffsetM);
  if (found === null) return { kind: 'unknown', reason: 'off_line' };
  if (found === 'passed') return { kind: 'passed' };
  if (found.behind) return { kind: 'passed', nextRoundKm: found.km };
  const distanceKm = found.km;
  // Phase 2: on a short detour the marker stays where it left the route and the ETA waits for it
  if (vehicle.offRouteSinceMs !== undefined) return { kind: 'unknown', reason: 'paused', distanceKm };
  if (distanceKm > ETA_MAX_KM) return { kind: 'unknown', reason: 'too_far', distanceKm };
  const speedKmh = movingSpeedKmh(vehicle);
  if (speedKmh === null) return { kind: 'unknown', reason: 'few_samples', distanceKm };
  const upToPacket = vehicle.recentSpeeds.filter((sample) => sample.atMs <= vehicle.lastPacketMs);
  const last = upToPacket[upToPacket.length - 1];
  const movingNow = last !== undefined && last.speedKmh >= STATIONARY_SPEED_KMH;
  const etaS = (distanceKm / speedKmh) * S_PER_H + distanceKm * ETA_STOP_ALLOWANCE_S_PER_KM;
  return { kind: 'approaching', distanceKm, etaS, speedKmh, movingNow };
}

// L2: the ETA now, from one measured at the vehicle's last packet. A live position is up to a
// packet interval old (30 s from phones, PRD 8.4), so a moving vehicle has driven on at its speed
// for ageS; the time and distance count down between packets. A stopped one (Phase 2) holds its ETA
// until it moves. Once the position is older than Live (COVERAGE_LIVE_MAX_AGE_S) the ETA is hidden:
// the data is no longer good enough (D9). Arrival and the distance alerts keep to the measured
// distance, so a guess never ends tracking.
export function etaNow(eta: Eta, ageS: number, maxAgeS = COVERAGE_LIVE_MAX_AGE_S): Eta {
  if (eta.kind !== 'approaching') return eta;
  if (ageS >= maxAgeS) return { kind: 'unknown', reason: 'stale', distanceKm: eta.distanceKm };
  if (!eta.movingNow) return eta;
  const elapsedS = Math.max(0, ageS);
  return {
    ...eta,
    distanceKm: Math.max(0, eta.distanceKm - (eta.speedKmh * elapsedS) / S_PER_H),
    etaS: Math.max(0, eta.etaS - elapsedS),
  };
}

// How far the vehicle drives forward to the point: its next pass ahead on its own leg (a pass up to
// TRACK_HERE_M behind it counts as reached: 0), else the first pass on the following legs, round to
// its own leg again. Every pass counts, not just the nearest, because a line may use the same street
// twice. behind: the vehicle went by the point on its own leg more recently than it will next reach
// it (and that pass is at least as close to the point as the one ahead), so km is its next time
// round, not a distance to show. Null when no leg comes within maxOffsetM.
function distanceRound(
  round: readonly DirectedLine[],
  vehicle: LatLon & { headingDeg?: number },
  point: LatLon,
  maxOffsetM: number,
): { km: number; behind: boolean } | 'passed' | null {
  const [own, ...after] = round;
  if (!own) return null;
  const atKm = vehicleChainageKm(own.coordinates, vehicle);
  const onOwn = linePasses(own.coordinates, point, maxOffsetM).passes;
  const behindOwn = onOwn.filter((pass) => pass.chainageKm <= atKm - HERE_KM);
  const lastBehind = behindOwn[behindOwn.length - 1];
  const next = nextPass(onOwn, after, atKm, lineEndKm(own.coordinates), point, maxOffsetM);
  if (!next) return onOwn.length > 0 ? 'passed' : null;
  const behind = lastBehind !== undefined && lastBehind.offsetM <= next.offsetM + LIVE_LINE_TIE_M && atKm - lastBehind.chainageKm < next.km;
  return { km: next.km, behind };
}

// The vehicle's next pass by the point: ahead on its own leg (from TRACK_HERE_M behind it), else on
// the following legs, else round to its own leg again; null on a lone leg already past it
function nextPass(
  onOwn: readonly LineProjection[],
  after: readonly DirectedLine[],
  atKm: number,
  ownEndKm: number,
  point: LatLon,
  maxOffsetM: number,
): { km: number; offsetM: number } | null {
  const ahead = onOwn.find((pass) => pass.chainageKm > atKm - HERE_KM);
  if (ahead !== undefined) return { km: Math.max(0, ahead.chainageKm - atKm), offsetM: ahead.offsetM };
  if (after.length === 0) return null;
  let km = ownEndKm - atKm;
  for (const line of after) {
    const first = linePasses(line.coordinates, point, maxOffsetM).passes[0];
    if (first !== undefined) return { km: km + first.chainageKm, offsetM: first.offsetM };
    km += lineEndKm(line.coordinates);
  }
  return onOwn.length > 0 ? { km: km + onOwn[0].chainageKm, offsetM: onOwn[0].offsetM } : null;
}

// The stop to track to: of the stops the vehicle reaches before it comes round to its own leg again,
// the one nearest the tracker, if one is within MAX_WALK_PER_LEG_M of them
export function stopAheadNearest(
  vehicle: Pick<VehicleSnapshot, 'lat' | 'lon' | 'lineId'> & { headingDeg?: number },
  lines: readonly DirectedLine[],
  stops: readonly RouteStop[],
  tracker: LatLon,
): RouteStop | null {
  const [own, ...after] = routeRound(lines, vehicle.lineId);
  if (!own) return null;
  const atKm = vehicleChainageKm(own.coordinates, vehicle);
  const ahead = [...stopsAlong(own, stops).filter(({ km }) => km > atKm), ...after.flatMap((line) => stopsAlong(line, stops))];
  let best: { stop: RouteStop; distanceM: number } | null = null;
  for (const { stop } of ahead) {
    const distanceM = haversineMeters(tracker, stop);
    if (distanceM <= MAX_WALK_PER_LEG_M && (!best || distanceM < best.distanceM)) best = { stop, distanceM };
  }
  return best?.stop ?? null;
}

// Tracking (L2, 2026-11-24): "Here" when the tracker is within TRACK_HERE_M of the vehicle; Passed
// (with its next arrival) when the vehicle has gone by them; otherwise the ETA to the stop ahead of
// the vehicle nearest the tracker, or to the tracker themself when no stop ahead is near them.
export function trackEta(
  vehicle: Tracked,
  lines: readonly DirectedLine[],
  stops: readonly RouteStop[],
  tracker: LatLon,
): { eta: Eta; stop: RouteStop | null } {
  const toTracker = etaTo(vehicle, lines, tracker, MAX_WALK_PER_LEG_M);
  const reachable = toTracker.kind === 'approaching' ? !toTracker.here : toTracker.kind === 'unknown' && toTracker.reason !== 'off_line';
  const stop = reachable ? stopAheadNearest(vehicle, lines, stops, tracker) : null;
  if (!stop) return { eta: toTracker, stop: null };
  const toStop = etaTo(vehicle, lines, stop, ROUTE_STOP_MAX_DISTANCE_M);
  return toStop.kind === 'passed' || (toStop.kind === 'unknown' && toStop.reason === 'off_line') ? { eta: toTracker, stop: null } : { eta: toStop, stop };
}

// Each time the line passes a stop, in travel order (a stop on a street used twice is there twice)
function stopsAlong(line: DirectedLine, stops: readonly RouteStop[]) {
  return stops
    .flatMap((stop) => passesKm(line.coordinates, stop, ROUTE_STOP_MAX_DISTANCE_M).map((km) => ({ stop, km })))
    .sort((a, b) => a.km - b.km);
}

export type TrackProgress = {
  // The last stop the vehicle passed, the next one ahead, and the commuter's stop
  passed: RouteStop | null;
  next: RouteStop | null;
  mine: RouteStop | null;
};

// Stops on the vehicle's line, in travel order, split around the vehicle. Past the last stop of its
// leg, the next stop is the first one on the leg that follows.
export function trackProgress(
  vehicle: Pick<VehicleSnapshot, 'lat' | 'lon' | 'lineId'> & { headingDeg?: number },
  lines: readonly DirectedLine[],
  stops: readonly RouteStop[],
  mine: RouteStop | null,
): TrackProgress {
  const [line, following] = routeRound(lines, vehicle.lineId);
  if (!line) return { passed: null, next: null, mine };
  const atKm = vehicleChainageKm(line.coordinates, vehicle);
  const along = stopsAlong(line, stops);
  const behind = along.filter(({ km }) => km <= atKm);
  const ahead = along.filter(({ km }) => km > atKm);
  const next = ahead[0]?.stop ?? (following ? (stopsAlong(following, stops)[0]?.stop ?? null) : null);
  return { passed: behind[behind.length - 1]?.stop ?? null, next, mine };
}

// True once, when the ETA first drops to the alert threshold. The relay's get-off alert uses it on
// metres to the destination (shared/relay/limits).
export function crossesAlert(previousEtaS: number | null, etaS: number | null, thresholdS: number): boolean {
  return etaS !== null && etaS <= thresholdS && (previousEtaS === null || previousEtaS > thresholdS);
}

// B2: the tracked multicab has reached the commuter: within arrivedM now, or it was within passM at
// the last reading and the distance has since jumped by more than passM (it went by between
// readings and now counts to its next time round; GPS wobble at a stop is far smaller). Never on
// the first reading.
// passedNow (2026-11-24): the multicab now reads as Passed (it no longer counts round the loop), so
// a last reading within passM means it went by.
export function hasArrived(previousKm: number | null, km: number | null, arrivedM: number, passM: number, passedNow = false): boolean {
  if (previousKm === null) return false;
  if (passedNow) return previousKm * METERS_PER_KM <= passM;
  if (km === null) return false;
  return km * METERS_PER_KM <= arrivedM || (previousKm * METERS_PER_KM <= passM && (km - previousKm) * METERS_PER_KM > passM);
}

// The distance alerts (B2): the nearest threshold the vehicle has just come within, once each time
// it is crossed; null on the first reading, so tracking a vehicle already close does not alert
export function crossedDistance(previousKm: number | null, km: number | null, thresholdsM: readonly number[]): number | null {
  if (previousKm === null || km === null) return null;
  const crossed = thresholdsM.filter((thresholdM) => previousKm * METERS_PER_KM > thresholdM && km * METERS_PER_KM <= thresholdM);
  return crossed.length > 0 ? Math.min(...crossed) : null;
}
