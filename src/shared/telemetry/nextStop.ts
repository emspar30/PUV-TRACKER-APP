// The next stop ahead of a vehicle on its line (restyle: the vehicle card's "Next: RCA").
// Pure: no React Native or Expo imports.

import { ROUTE_STOP_MAX_DISTANCE_M } from '../config';
import { projectOntoLine } from '../geo/line';
import type { DirectedLine, RouteStop } from '../routing/types';
import type { VehicleSnapshot } from './vehicle';

// The closest stop ahead along the vehicle's line, among stops on that line; null at the line's end
export function nextStopOf(
  vehicle: Pick<VehicleSnapshot, 'lat' | 'lon' | 'lineId'>,
  lines: readonly DirectedLine[],
  stops: readonly RouteStop[],
): RouteStop | null {
  const line = lines.find((candidate) => candidate.id === vehicle.lineId);
  if (!line) return null;
  const atKm = projectOntoLine(line.coordinates, vehicle).chainageKm;
  let best: { stop: RouteStop; km: number } | null = null;
  for (const stop of stops) {
    const projection = projectOntoLine(line.coordinates, stop);
    if (projection.offsetM > ROUTE_STOP_MAX_DISTANCE_M || projection.chainageKm <= atKm) continue;
    if (!best || projection.chainageKm < best.km) best = { stop, km: projection.chainageKm };
  }
  return best?.stop ?? null;
}
