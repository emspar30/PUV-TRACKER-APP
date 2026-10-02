import { along, bearing, destination, length, lineString } from '@turf/turf';
import type { Position } from 'geojson';

const METERS_PER_KM = 1000;
const HALF_TURN_DEG = 180;
const HALF = 0.5;
const KM = { units: 'kilometers' } as const;

export type ArrowOptions = {
  // Distance between arrows along the line
  spacingM: number;
  // Length of each of the two wings of the V
  sizeM: number;
  // Angle between the line and each wing
  wingAngleDeg: number;
  // Distance from the start of the line to the first arrow; defaults to half the spacing
  startOffsetM?: number;
};

// Direction arrows for a directed line, as V shapes: [left wing end, tip, right wing end].
// The tip sits on the line and points the way the line runs. Drawn with an ordinary line layer,
// so the map needs no icon images, sprites or fonts.
export function directionArrows(coordinates: Position[], options: ArrowOptions): Position[][] {
  const { spacingM, sizeM, wingAngleDeg } = options;
  if (spacingM <= 0 || sizeM <= 0) throw new RangeError('spacingM and sizeM must be positive');

  const line = lineString(coordinates);
  const totalKm = length(line, KM);
  const spacingKm = spacingM / METERS_PER_KM;
  const sizeKm = sizeM / METERS_PER_KM;
  const firstKm = (options.startOffsetM ?? spacingM * HALF) / METERS_PER_KM;

  const arrows: Position[][] = [];
  for (let tipKm = firstKm; tipKm < totalKm; tipKm += spacingKm) {
    // The direction of travel at the tip is taken from a point one wing-length behind it
    const behindKm = Math.max(0, tipKm - sizeKm);
    if (behindKm === tipKm) continue;
    const tip = along(line, tipKm, KM);
    const heading = bearing(along(line, behindKm, KM), tip);
    const back = heading + HALF_TURN_DEG;
    const left = destination(tip, sizeKm, back - wingAngleDeg, KM);
    const right = destination(tip, sizeKm, back + wingAngleDeg, KM);
    arrows.push([left.geometry.coordinates, tip.geometry.coordinates, right.geometry.coordinates]);
  }
  return arrows;
}
