// The live vehicles repository (L1): the route's vehicles from public.telemetry_latest, kept current
// by Realtime changes and a reload every LIVE_RELOAD_INTERVAL_S. The database decides who sees what
// (team accounts only in v0; moving vehicles hidden at night), so a signed-out phone simply gets no
// rows and the Live tab says "No data". Pure: the network sits behind LiveVehiclesPort.

import { LIVE_RELOAD_INTERVAL_S, LIVE_UI_REFRESH_INTERVAL_S } from '../../shared/config';
import type { DirectedLine } from '../../shared/routing/types';
import { rowToSnapshot, type LiveRow } from '../../shared/telemetry/liveRow';
import type { VehicleSnapshot } from '../../shared/telemetry/vehicle';
import type { DemoClock } from '../demo/demoVehicles';
import type { Unsubscribe, VehiclesRepository } from '../repositories/types';

export type LiveVehiclesPort = {
  // The route's active vehicles and their newest rows; rejects on a network or permission error
  load(routeCode: string): Promise<{ vehicleIds: string[]; rows: LiveRow[] }>;
  // Every insert or update of telemetry_latest for these vehicles
  watch(vehicleIds: readonly string[], onRow: (row: LiveRow) => void): Unsubscribe;
};

const MS_PER_S = 1000;

const systemClock: DemoClock = {
  now: () => Date.now(),
  setInterval: (callback, ms) => setInterval(callback, ms),
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
};

export function createLiveVehicles(
  port: LiveVehiclesPort,
  lines: readonly DirectedLine[],
  clock: DemoClock = systemClock,
): VehiclesRepository {
  return {
    source: 'live',
    subscribe: (routeCode, listener) => {
      let closed = false;
      let vehicleIds: string[] = [];
      let stopWatching: Unsubscribe = () => undefined;
      const snapshots = new Map<string, VehicleSnapshot>();

      const emit = () => {
        if (!closed) listener([...snapshots.values()]);
      };
      const apply = (row: LiveRow) => {
        // Rows arrive out of order after a reload; an older position never replaces a newer one
        const previous = snapshots.get(row.vehicle_id);
        if (previous && Date.parse(row.packet_ts) <= previous.lastPacketMs) return;
        const next = rowToSnapshot(row, routeCode, lines, previous);
        if (next) snapshots.set(row.vehicle_id, next);
      };
      const reload = async () => {
        try {
          const result = await port.load(routeCode);
          if (closed) return;
          // A vehicle that left the route or was deactivated is dropped
          for (const id of snapshots.keys()) if (!result.vehicleIds.includes(id)) snapshots.delete(id);
          result.rows.forEach(apply);
          if (result.vehicleIds.join() !== vehicleIds.join()) {
            vehicleIds = result.vehicleIds;
            stopWatching();
            stopWatching = port.watch(vehicleIds, (row) => {
              if (closed || !vehicleIds.includes(row.vehicle_id)) return;
              apply(row);
              emit();
            });
          }
          emit();
        } catch {
          // Offline or not allowed: keep what is known; its age turns it Stale, then No data
          emit();
        }
      };

      emit();
      void reload();
      // Ages move on between packets, so Live turns Stale on time
      const tick = clock.setInterval(emit, LIVE_UI_REFRESH_INTERVAL_S * MS_PER_S);
      const reloadTimer = clock.setInterval(() => void reload(), LIVE_RELOAD_INTERVAL_S * MS_PER_S);
      return () => {
        closed = true;
        clock.clearInterval(tick);
        clock.clearInterval(reloadTimer);
        stopWatching();
      };
    },
  };
}
