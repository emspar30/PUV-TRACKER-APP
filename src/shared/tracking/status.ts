// Phase 2 (owner, 2026-11-22; docs/APP_CHANGES_PLAN.md): what the tracked multicab is doing, shown only
// in the Track view, so the map marker stays a simple position. Moving, Stopped (with how long, from
// its speeds) or Off route (a short detour within SHORT_DETOUR_MAX_MIN is temporary).
// Pure: no React Native or Expo imports.

import { SHORT_DETOUR_MAX_MIN, STATIONARY_SPEED_KMH } from '../config';
import { isStopped } from '../telemetry/stopped';
import type { VehicleSnapshot } from '../telemetry/vehicle';

const MS_PER_MIN = 60_000;

export type TrackStatus = { kind: 'moving' } | { kind: 'stopped'; minutes: number } | { kind: 'off_route'; temporary: boolean };

type Tracked = Pick<VehicleSnapshot, 'recentSpeeds' | 'lastPacketMs' | 'layover' | 'offRouteSinceMs'>;

// Whole minutes stopped: since the last moving speed, or since the oldest speed kept when none moved
export function stoppedMinutes(vehicle: Pick<VehicleSnapshot, 'recentSpeeds'>, nowMs: number): number {
  const moving = vehicle.recentSpeeds.filter((sample) => sample.speedKmh >= STATIONARY_SPEED_KMH);
  const fromMs = moving.length > 0 ? moving[moving.length - 1].atMs : (vehicle.recentSpeeds[0]?.atMs ?? nowMs);
  return Math.max(0, Math.floor((nowMs - fromMs) / MS_PER_MIN));
}

export function trackStatus(vehicle: Tracked, nowMs: number): TrackStatus {
  if (vehicle.offRouteSinceMs !== undefined) {
    return { kind: 'off_route', temporary: nowMs - vehicle.offRouteSinceMs < SHORT_DETOUR_MAX_MIN * MS_PER_MIN };
  }
  if (vehicle.layover === true || isStopped(vehicle.recentSpeeds, vehicle.lastPacketMs)) {
    return { kind: 'stopped', minutes: stoppedMinutes(vehicle, nowMs) };
  }
  return { kind: 'moving' };
}
