import { useEffect, useState } from 'react';

import { GHOST_TICK_MS } from '@/shared/config';
import { ageSeconds } from '@/shared/telemetry/coverage';
import { isGhostAge } from '@/shared/telemetry/deadReckoning';
import type { VehicleSnapshot } from '@/shared/telemetry/vehicle';

// CF1: the time Estimated markers are drawn at. The live feed ticks every few seconds; while any
// vehicle is Estimated this clock also ticks every GHOST_TICK_MS, so its marker glides along the
// line. With none, it is the feed's own time and no timer runs.
export function useGhostClock(vehicles: readonly VehicleSnapshot[], nowMs: number): number {
  const [tickMs, setTickMs] = useState(0);
  const clockMs = Math.max(nowMs, tickMs);
  const active = vehicles.some((vehicle) => !vehicle.hidden && isGhostAge(ageSeconds(vehicle.lastPacketMs, clockMs)));

  useEffect(() => {
    if (!active) return undefined;
    const handle = setInterval(() => setTickMs(Date.now()), GHOST_TICK_MS);
    return () => clearInterval(handle);
  }, [active]);

  return active ? clockMs : nowMs;
}
