// Tracking one vehicle (L2): its simple ETA to the commuter's boarding point (PRD 19.2 D9) and where it
// is among the stops. Pure: no React Native or Expo imports.

import {
  ETA_MAX_KM,
  ETA_MIN_SAMPLES,
  ETA_MIN_SPEED_KMH,
  ETA_SAMPLE_WINDOW_S,
  ROUTE_STOP_MAX_DISTANCE_M,
} from '../config';
import { projectOntoLine } from '../geo/line';
import type { LatLon } from '../geo/haversine';
import type { DirectedLine, RouteStop } from '../routing/types';
import type { VehicleSnapshot } from '../telemetry/vehicle';

export type Eta =
  | { kind: 'approaching'; distanceKm: number; etaS: number; speedKmh: number }
  // Already past the boarding point on this line
  | { kind: 'passed' }
  // Shown as "ETA unavailable": the line does not pass the point, it is too far, or too few speeds
  | { kind: 'unknown'; reason: 'off_line' | 'too_far' | 'few_samples' };

const MS_PER_S = 1000;
const S_PER_H = 3600;

type Tracked = Pick<VehicleSnapshot, 'lat' | 'lon' | 'lineId' | 'lastPacketMs' | 'recentSpeeds'>;

export function etaTo(vehicle: Tracked, lines: readonly DirectedLine[], boarding: LatLon): Eta {
  const line = lines.find((candidate) => candidate.id === vehicle.lineId);
  if (!line) return { kind: 'unknown', reason: 'off_line' };
  const board = projectOntoLine(line.coordinates, boarding);
  if (board.offsetM > ROUTE_STOP_MAX_DISTANCE_M) return { kind: 'unknown', reason: 'off_line' };
  const distanceKm = board.chainageKm - projectOntoLine(line.coordinates, vehicle).chainageKm;
  if (distanceKm <= 0) return { kind: 'passed' };
  if (distanceKm > ETA_MAX_KM) return { kind: 'unknown', reason: 'too_far' };
  const fromMs = vehicle.lastPacketMs - ETA_SAMPLE_WINDOW_S * MS_PER_S;
  const samples = vehicle.recentSpeeds.filter((sample) => sample.atMs >= fromMs && sample.atMs <= vehicle.lastPacketMs);
  if (samples.length < ETA_MIN_SAMPLES) return { kind: 'unknown', reason: 'few_samples' };
  const mean = samples.reduce((sum, sample) => sum + sample.speedKmh, 0) / samples.length;
  const speedKmh = Math.max(ETA_MIN_SPEED_KMH, mean);
  return { kind: 'approaching', distanceKm, etaS: (distanceKm / speedKmh) * S_PER_H, speedKmh };
}

export type TrackProgress = {
  // The last stop the vehicle passed, the next one ahead, and the commuter's stop
  passed: RouteStop | null;
  next: RouteStop | null;
  mine: RouteStop | null;
};

// Stops on the vehicle's line, in travel order, split around the vehicle
export function trackProgress(vehicle: Pick<VehicleSnapshot, 'lat' | 'lon' | 'lineId'>, lines: readonly DirectedLine[], stops: readonly RouteStop[], mine: RouteStop | null): TrackProgress {
  const line = lines.find((candidate) => candidate.id === vehicle.lineId);
  if (!line) return { passed: null, next: null, mine };
  const atKm = projectOntoLine(line.coordinates, vehicle).chainageKm;
  const along = stops
    .map((stop) => ({ stop, projection: projectOntoLine(line.coordinates, stop) }))
    .filter(({ projection }) => projection.offsetM <= ROUTE_STOP_MAX_DISTANCE_M)
    .sort((a, b) => a.projection.chainageKm - b.projection.chainageKm);
  const behind = along.filter(({ projection }) => projection.chainageKm <= atKm);
  const ahead = along.filter(({ projection }) => projection.chainageKm > atKm);
  return { passed: behind[behind.length - 1]?.stop ?? null, next: ahead[0]?.stop ?? null, mine };
}

// True once, when the ETA first drops to the alert threshold
export function crossesAlert(previousEtaS: number | null, etaS: number | null, thresholdS: number): boolean {
  return etaS !== null && etaS <= thresholdS && (previousEtaS === null || previousEtaS > thresholdS);
}
