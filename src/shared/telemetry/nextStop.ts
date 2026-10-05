// The next stop ahead of a vehicle on its line (restyle: the vehicle card's "Next: RCA").
// Pure: no React Native or Expo imports.

import { ROUTE_STOP_MAX_DISTANCE_M } from '../config';
import { linePasses } from '../geo/line';
import { routeRound } from '../routing/loop';
import { vehicleChainageKm } from '../routing/progress';
import type { DirectedLine, RouteStop } from '../routing/types';
import type { VehicleSnapshot } from './vehicle';

// The closest stop ahead along the vehicle's line, among stops on that line, else the first on the
// leg after it; null when neither has one
export function nextStopOf(
  vehicle: Pick<VehicleSnapshot, 'lat' | 'lon' | 'lineId'> & { headingDeg?: number },
  lines: readonly DirectedLine[],
  stops: readonly RouteStop[],
): RouteStop | null {
  const [line, following] = routeRound(lines, vehicle.lineId);
  if (!line) return null;
  const ahead = (leg: DirectedLine, fromKm: number) => {
    let best: { stop: RouteStop; km: number } | null = null;
    // Every pass of the line by the stop counts: a street used twice passes it twice
    for (const stop of stops) {
      for (const pass of linePasses(leg.coordinates, stop, ROUTE_STOP_MAX_DISTANCE_M).passes) {
        if (pass.chainageKm > fromKm && (!best || pass.chainageKm < best.km)) best = { stop, km: pass.chainageKm };
      }
    }
    return best?.stop ?? null;
  };
  // Past the leg's last stop: the first stop of the leg it drives on to (B2)
  return ahead(line, vehicleChainageKm(line.coordinates, vehicle)) ?? (following ? ahead(following, Number.NEGATIVE_INFINITY) : null);
}
