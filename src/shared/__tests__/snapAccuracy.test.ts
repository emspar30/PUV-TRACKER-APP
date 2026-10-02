// Measures the flat-map line snapping (src/shared/geo/line.ts) against the geodesic search of the
// mapping library it replaced. The figures printed here are quoted in docs/AUDIT_BACKLOG.md.

import { lineString, nearestPointOnLine, point } from '@turf/turf';
import type { Position } from 'geojson';

import { R4_LINES } from '../../data/seed/r4.placeholder';
import { projectOntoLine } from '../geo/line';

import { FIXTURE_OUTBOUND, KM_PER_DEG_LAT, KM_PER_DEG_LON } from './fixtures/routeFixture';

const SAMPLES = 2000;
const MAX_OFFSET_M = 600;

function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

// A winding 12 km line with 400 points, like a traced route
const winding: Position[] = Array.from({ length: 400 }, (_, i) => [
  125.5 + ((i / 399) * 12) / KM_PER_DEG_LON,
  9.0 + (0.15 * Math.sin(i / 6)) / KM_PER_DEG_LAT,
]);

const LINES: [string, Position[]][] = [
  ['placeholder Route 4 line (6 points, one 11 km segment)', R4_LINES[0].coordinates],
  ['straight fixture line (4 points)', FIXTURE_OUTBOUND.coordinates],
  ['winding line (400 points)', winding],
];

describe('flat-map snapping agrees with the geodesic search', () => {
  it.each(LINES)('on the %s', (label, coordinates) => {
    const random = seeded(7);
    const turfLine = lineString(coordinates);
    let worstChainageM = 0;
    let worstOffsetM = 0;

    for (let i = 0; i < SAMPLES; i += 1) {
      // A point near a random position on the line, up to 600 m to either side
      const index = Math.floor(random() * (coordinates.length - 1));
      const t = random();
      const [lonA, latA] = coordinates[index];
      const [lonB, latB] = coordinates[index + 1];
      const p = {
        lon: lonA + t * (lonB - lonA) + ((random() - 0.5) * 2 * MAX_OFFSET_M) / 1000 / KM_PER_DEG_LON,
        lat: latA + t * (latB - latA) + ((random() - 0.5) * 2 * MAX_OFFSET_M) / 1000 / KM_PER_DEG_LAT,
      };

      const mine = projectOntoLine(coordinates, p);
      const reference = nearestPointOnLine(turfLine, point([p.lon, p.lat]), { units: 'kilometers' });

      worstChainageM = Math.max(worstChainageM, Math.abs(mine.chainageKm - reference.properties.lineDistance) * 1000);
      worstOffsetM = Math.max(worstOffsetM, Math.abs(mine.offsetM - reference.properties.pointDistance * 1000));
    }

    console.log(
      `[snap accuracy] ${label}: over ${SAMPLES} points within ${MAX_OFFSET_M} m of the line, ` +
        `largest difference in distance along the line ${worstChainageM.toFixed(3)} m, ` +
        `in distance from the line ${worstOffsetM.toFixed(3)} m`,
    );
    expect(worstChainageM).toBeLessThan(2);
    expect(worstOffsetM).toBeLessThan(1);
  });
});
