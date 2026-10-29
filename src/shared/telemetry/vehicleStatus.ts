// VS1 (Emjay's V1 to V3, 2026-10-29): what a multicab is doing, for the mark on its map marker and
// the pill on its card. A recent relay about that multicab says it best: "Loading passengers" or
// "Heavy traffic", and "Not moving" counts as Stopped. A relay counts while it is in the feed and
// for at most VEHICLE_STATUS_RELAY_MAX_MIN; the newest one wins. Without one, the multicab's own
// speeds decide Stopped (or a demo layover); otherwise it is Moving. No "Unloading": no relay says
// it, and speed cannot tell it from loading (V2). Pure: no React Native or Expo imports.

import { VEHICLE_STATUS_RELAY_MAX_MIN } from '../config';
import type { FeedPhrase } from '../demo/feed';
import { isStopped } from './stopped';
import type { VehicleSnapshot } from './vehicle';

const MS_PER_MIN = 60_000;

export type VehicleStatus = 'moving' | 'stopped' | 'loading' | 'traffic';

// The parts of a relay the status needs
export type StatusRelay = { vehicleId: string | null; phrase: FeedPhrase | null; postedMs: number };

const STATUS_OF_PHRASE: Partial<Record<FeedPhrase, VehicleStatus>> = {
  loading: 'loading',
  heavy_traffic: 'traffic',
  not_moving: 'stopped',
};

export function vehicleStatus(
  vehicle: Pick<VehicleSnapshot, 'id' | 'recentSpeeds' | 'lastPacketMs' | 'layover'>,
  relays: readonly StatusRelay[],
  nowMs: number,
): VehicleStatus {
  const oldestMs = nowMs - VEHICLE_STATUS_RELAY_MAX_MIN * MS_PER_MIN;
  let newest: { status: VehicleStatus; postedMs: number } | null = null;
  for (const relay of relays) {
    if (relay.vehicleId !== vehicle.id || !relay.phrase || relay.postedMs < oldestMs || relay.postedMs > nowMs) continue;
    const status = STATUS_OF_PHRASE[relay.phrase];
    if (status && (!newest || relay.postedMs > newest.postedMs)) newest = { status, postedMs: relay.postedMs };
  }
  if (newest) return newest.status;
  return vehicle.layover === true || isStopped(vehicle.recentSpeeds, vehicle.lastPacketMs) ? 'stopped' : 'moving';
}
