// Tracking one vehicle (L2): its simple ETA to the commuter's boarding point (PRD 19.2 D9) and where it
// is among the stops. B2: the distance follows the vehicle's round (routing/loop), so once it has
// passed the commuter the ETA counts on to its next time round instead of stopping. Pass the lines
// with their stand-in legs (withReturnLegs). Pure: no React Native or Expo imports.

import {
  ETA_MAX_KM,
  ETA_MIN_SAMPLES,
  ETA_MIN_SPEED_KMH,
  ETA_SAMPLE_WINDOW_S,
  ROUTE_STOP_MAX_DISTANCE_M,
} from '../config';
import { lineLengthKm, projectOntoLine } from '../geo/line';
import type { LatLon } from '../geo/haversine';
import { routeRound } from '../routing/loop';
import type { DirectedLine, RouteStop } from '../routing/types';
import type { VehicleSnapshot } from '../telemetry/vehicle';

export type Eta =
  | { kind: 'approaching'; distanceKm: number; etaS: number; speedKmh: number }
  // Already past the boarding point, on a route with no way round to it again
  | { kind: 'passed' }
  // Shown as "ETA unavailable": the line does not pass the point, it is too far, or too few speeds
  | { kind: 'unknown'; reason: 'off_line' | 'too_far' | 'few_samples' };

const MS_PER_S = 1000;
const S_PER_H = 3600;
const METERS_PER_KM = 1000;

type Tracked = Pick<VehicleSnapshot, 'lat' | 'lon' | 'lineId' | 'lastPacketMs' | 'recentSpeeds'>;

// maxOffsetM: how far the boarding point may be from the line (a stop is close; a rider may walk to it).
// round: false keeps to the vehicle's own leg, so a vehicle past the point says 'passed' (route ranking).
export function etaTo(
  vehicle: Tracked,
  lines: readonly DirectedLine[],
  boarding: LatLon,
  maxOffsetM = ROUTE_STOP_MAX_DISTANCE_M,
  { round = true }: { round?: boolean } = {},
): Eta {
  const legs = routeRound(lines, vehicle.lineId);
  const distanceKm = distanceRound(round ? legs : legs.slice(0, 1), vehicle, boarding, maxOffsetM);
  if (distanceKm === null) return { kind: 'unknown', reason: 'off_line' };
  if (distanceKm === 'passed') return { kind: 'passed' };
  if (distanceKm > ETA_MAX_KM) return { kind: 'unknown', reason: 'too_far' };
  const fromMs = vehicle.lastPacketMs - ETA_SAMPLE_WINDOW_S * MS_PER_S;
  const samples = vehicle.recentSpeeds.filter((sample) => sample.atMs >= fromMs && sample.atMs <= vehicle.lastPacketMs);
  if (samples.length < ETA_MIN_SAMPLES) return { kind: 'unknown', reason: 'few_samples' };
  const mean = samples.reduce((sum, sample) => sum + sample.speedKmh, 0) / samples.length;
  const speedKmh = Math.max(ETA_MIN_SPEED_KMH, mean);
  return { kind: 'approaching', distanceKm, etaS: (distanceKm / speedKmh) * S_PER_H, speedKmh };
}

// How far the vehicle drives to the point: ahead on its own leg, else on through the following legs
// and round to its own leg again. Null when no leg passes within maxOffsetM of the point.
function distanceRound(round: readonly DirectedLine[], vehicle: LatLon, point: LatLon, maxOffsetM: number): number | 'passed' | null {
  const [own, ...after] = round;
  if (!own) return null;
  const atKm = projectOntoLine(own.coordinates, vehicle).chainageKm;
  const onOwn = projectOntoLine(own.coordinates, point);
  const ownPasses = onOwn.offsetM <= maxOffsetM;
  if (ownPasses && onOwn.chainageKm > atKm) return onOwn.chainageKm - atKm;
  if (after.length === 0) return ownPasses ? 'passed' : null;
  let km = lineLengthKm(own.coordinates) - atKm;
  for (const line of after) {
    const projection = projectOntoLine(line.coordinates, point);
    if (projection.offsetM <= maxOffsetM) return km + projection.chainageKm;
    km += lineLengthKm(line.coordinates);
  }
  return ownPasses ? km + onOwn.chainageKm : null;
}

// The stops on a line, in travel order
function stopsAlong(line: DirectedLine, stops: readonly RouteStop[]) {
  return stops
    .map((stop) => ({ stop, projection: projectOntoLine(line.coordinates, stop) }))
    .filter(({ projection }) => projection.offsetM <= ROUTE_STOP_MAX_DISTANCE_M)
    .sort((a, b) => a.projection.chainageKm - b.projection.chainageKm);
}

export type TrackProgress = {
  // The last stop the vehicle passed, the next one ahead, and the commuter's stop
  passed: RouteStop | null;
  next: RouteStop | null;
  mine: RouteStop | null;
};

// Stops on the vehicle's line, in travel order, split around the vehicle. Past the last stop of its
// leg, the next stop is the first one on the leg that follows.
export function trackProgress(vehicle: Pick<VehicleSnapshot, 'lat' | 'lon' | 'lineId'>, lines: readonly DirectedLine[], stops: readonly RouteStop[], mine: RouteStop | null): TrackProgress {
  const [line, following] = routeRound(lines, vehicle.lineId);
  if (!line) return { passed: null, next: null, mine };
  const atKm = projectOntoLine(line.coordinates, vehicle).chainageKm;
  const along = stopsAlong(line, stops);
  const behind = along.filter(({ projection }) => projection.chainageKm <= atKm);
  const ahead = along.filter(({ projection }) => projection.chainageKm > atKm);
  const next = ahead[0]?.stop ?? (following ? (stopsAlong(following, stops)[0]?.stop ?? null) : null);
  return { passed: behind[behind.length - 1]?.stop ?? null, next, mine };
}

// True once, when the ETA first drops to the alert threshold
export function crossesAlert(previousEtaS: number | null, etaS: number | null, thresholdS: number): boolean {
  return etaS !== null && etaS <= thresholdS && (previousEtaS === null || previousEtaS > thresholdS);
}

// The distance alerts (B2): the nearest threshold the vehicle has just come within, once each time
// it is crossed; null on the first reading, so tracking a vehicle already close does not alert
export function crossedDistance(previousKm: number | null, km: number | null, thresholdsM: readonly number[]): number | null {
  if (previousKm === null || km === null) return null;
  const crossed = thresholdsM.filter((thresholdM) => previousKm * METERS_PER_KM > thresholdM && km * METERS_PER_KM <= thresholdM);
  return crossed.length > 0 ? Math.min(...crossed) : null;
}
