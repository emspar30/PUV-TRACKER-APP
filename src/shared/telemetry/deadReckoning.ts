// CF1 Estimated markers (PRD 7.3 as amended 2026-10-17): a vehicle silent for 90 s to 5 minutes is
// drawn where it probably is, moved along its own line at its recent speed from its last fix (dead
// reckoning). Display only: ETAs, alerts and arrival keep to the last real fix. Pure: no React
// Native or Expo imports.

import {
  COVERAGE_LIVE_MAX_AGE_S,
  ETA_SAMPLE_WINDOW_S,
  GHOST_MAX_AGE_S,
  GHOST_MAX_DISTANCE_KM,
  GHOST_MAX_SPEED_KMH,
  STATIONARY_SPEED_KMH,
} from '../config';
import { lineEndKm, pointAtChainage, type LineCoordinates } from '../geo/line';
import { directionAtKm, vehicleChainageKm } from '../routing/progress';
import { ageSeconds } from './coverage';
import { isStopped } from './stopped';
import type { VehicleSnapshot } from './vehicle';

const MS_PER_S = 1000;
const S_PER_H = 3600;
const HALF = 2;

export type DisplayPosition = { lat: number; lon: number; headingDeg: number; ghost: boolean };

// True while a silent vehicle is drawn as Estimated
export function isGhostAge(ageS: number): boolean {
  return ageS >= COVERAGE_LIVE_MAX_AGE_S && ageS < GHOST_MAX_AGE_S;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / HALF);
  return sorted.length % HALF === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / HALF;
}

// The speed the vehicle is moved at: the median of its speeds over the sample window before its
// last packet (its last speed without samples), capped; 0 when it was stopped or laying over
export function ghostSpeedKmh(vehicle: VehicleSnapshot): number {
  if (vehicle.layover || isStopped(vehicle.recentSpeeds, vehicle.lastPacketMs)) return 0;
  const fromMs = vehicle.lastPacketMs - ETA_SAMPLE_WINDOW_S * MS_PER_S;
  const window = vehicle.recentSpeeds.filter((sample) => sample.atMs >= fromMs && sample.atMs <= vehicle.lastPacketMs);
  const speed = window.length > 0 ? median(window.map((sample) => sample.speedKmh)) : vehicle.speedKmh;
  return speed < STATIONARY_SPEED_KMH ? 0 : Math.min(speed, GHOST_MAX_SPEED_KMH);
}

// Where to draw the vehicle now. Live and older Stale vehicles stay at their last fix; an Estimated
// one is moved speed × silence along its line, at most GHOST_MAX_DISTANCE_KM and never past the
// line's end, facing the line's direction there. Without its line it stays at the last fix.
export function displayPosition(vehicle: VehicleSnapshot, coordinates: LineCoordinates | undefined, nowMs: number): DisplayPosition {
  const ageS = ageSeconds(vehicle.lastPacketMs, nowMs);
  const atFix: DisplayPosition = { lat: vehicle.lat, lon: vehicle.lon, headingDeg: vehicle.headingDeg, ghost: false };
  if (!isGhostAge(ageS)) return atFix;
  const speedKmh = ghostSpeedKmh(vehicle);
  if (!coordinates || coordinates.length === 0 || speedKmh === 0) return { ...atFix, ghost: true };
  const fromKm = vehicleChainageKm(coordinates, vehicle);
  const toKm = Math.min(fromKm + Math.min((speedKmh * ageS) / S_PER_H, GHOST_MAX_DISTANCE_KM), lineEndKm(coordinates));
  if (toKm <= fromKm) return { ...atFix, ghost: true };
  const at = pointAtChainage(coordinates, toKm);
  return { lat: at.lat, lon: at.lon, headingDeg: directionAtKm(coordinates, toKm), ghost: true };
}
