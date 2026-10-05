// The next stop ahead of a vehicle on its line (restyle: the vehicle card's "Next: RCA").
// Pure: no React Native or Expo imports.

import { ROUTE_STOP_MAX_DISTANCE_M } from '../config';
import { projectOntoLine } from '../geo/line';
import { routeRound } from '../routing/loop';
import type { DirectedLine, RouteStop } from '../routing/types';
import type { VehicleSnapshot } from './vehicle';

// The closest stop ahead along the vehicle's line, among stops on that line, else the first on the
// leg after it; null when neither has one
export function nextStopOf(
  vehicle: Pick<VehicleSnapshot, 'lat' | 'lon' | 'lineId'>,
  lines: readonly DirectedLine[],
  stops: readonly RouteStop[],
): RouteStop | null {
  const [line, following] = routeRound(lines, vehicle.lineId);
  if (!line) return null;
  const ahead = (leg: DirectedLine, fromKm: number) => {
    let best: { stop: RouteStop; km: number } | null = null;
    for (const stop of stops) {
      const projection = projectOntoLine(leg.coordinates, stop);
      if (projection.offsetM > ROUTE_STOP_MAX_DISTANCE_M || projection.chainageKm <= fromKm) continue;
      if (!best || projection.chainageKm < best.km) best = { stop, km: projection.chainageKm };
    }
    return best?.stop ?? null;
  };
  // Past the leg's last stop: the first stop of the leg it drives on to (B2)
  return ahead(line, projectOntoLine(line.coordinates, vehicle).chainageKm) ?? (following ? ahead(following, Number.NEGATIVE_INFINITY) : null);
}
