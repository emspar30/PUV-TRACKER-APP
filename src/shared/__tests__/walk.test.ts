// Walking along the streets (Emjay, 2026-10-26): the walk to and from the multicab follows the roads
// of the offline map. A made-up L-shaped street, then the real Butuan streets.

import { walkGraph } from '../../data/seed/walkways';
import { WALKWAY_BASE } from '../../data/seed/walkways.generated';
import { haversineMeters, type LatLon } from '../geo/haversine';
import { projectOntoLine } from '../geo/line';
import { buildWalkGraph, walkPath, walksForTrip, walkToRoute } from '../routing/walk';

const SIZE = WALKWAY_BASE.extent * 2 ** WALKWAY_BASE.zoom;
// A pixel position near the base, as a coordinate
const at = (x: number, y: number): LatLon => ({
  lon: ((WALKWAY_BASE.x + x) / SIZE) * 360 - 180,
  lat: (Math.atan(Math.sinh(Math.PI * (1 - (2 * (WALKWAY_BASE.y + y)) / SIZE))) * 180) / Math.PI,
});

describe('a walk on an L-shaped street', () => {
  // East 300 px, then south 300 px (about 90 m each)
  const graph = buildWalkGraph(WALKWAY_BASE, ['1000,1000,300,0,0,300']);

  it('goes round the corner instead of cutting across', () => {
    const from = at(1000, 1010);
    const to = at(1290, 1300);
    const path = walkPath(graph, from, to);
    expect(path).not.toBeNull();
    const corner = at(1300, 1000);
    expect(path!.points.some((point) => haversineMeters(point, corner) < 1)).toBe(true);
    const straight = haversineMeters(from, to);
    expect(path!.lengthM).toBeGreaterThan(straight * 1.3);
    expect(haversineMeters(path!.points[0], from)).toBeLessThan(0.01);
    expect(haversineMeters(path!.points[path!.points.length - 1], to)).toBeLessThan(0.01);
  });

  it('stays on the segment when both ends are beside the same one', () => {
    const path = walkPath(graph, at(1050, 1005), at(1200, 1005));
    expect(path!.points).toHaveLength(4);
  });

  it('gives no walk when a point is far from every street', () => {
    expect(walkPath(graph, at(1000, 1010), at(3000, 3000))).toBeNull();
  });
});

describe('a walk from a dead end (Emjay, 2026-10-26)', () => {
  // Street A runs north from a dead end at (1000, 1000). Street B starts 50 px (about 15 m) east of
  // that dead end and runs east; the two only meet by a long way round through C.
  const graph = buildWalkGraph(WALKWAY_BASE, ['1000,1000,0,-1000', '1050,1000,1000,0', '1000,0,1050,0,0,1000']);

  it('steps across to the street a few metres away instead of going round', () => {
    const from = at(1000, 1000);
    const to = at(2050, 1010);
    const path = walkPath(graph, from, to);
    expect(path).not.toBeNull();
    // About 1,060 px straight east; round by C would be about 3,050 px
    expect(path!.lengthM).toBeLessThan(haversineMeters(from, to) * 1.1);
  });
});

describe('a walk to the route (Emjay, 2026-10-26)', () => {
  // The route runs north to south along x = 2000. Street N runs east from (1000, 1000) to the route;
  // street W runs south from (1000, 1000) to (1000, 2000), then street S east to the route. A dead-end
  // stub runs east from (1000, 1500) and stops 150 px (about 45 m) short of the route.
  const graph = buildWalkGraph(WALKWAY_BASE, ['1000,1000,1000,0', '1000,1000,0,500,0,500,1000,0', '1000,1500,850,0']);
  const route = [at(2000, 0), at(2000, 2500)].map((p) => [p.lon, p.lat]);

  it('boards where the streets first meet the route, not beside a straight-line point', () => {
    // From near the top of W: up to N and east, about 1,200 px, rather than down to S
    const walk = walkToRoute(graph, at(1000, 1200), route);
    expect(walk).not.toBeNull();
    expect(haversineMeters(walk!.reached, at(2000, 1000))).toBeLessThan(2);
  });

  it('never steps off a dead end across open ground to reach the route', () => {
    // From the stub: back to W and round by N or S, not 45 m across from the stub end
    const walk = walkToRoute(graph, at(1700, 1500), route);
    expect(walk).not.toBeNull();
    const reachedY = [at(2000, 1000), at(2000, 2000)].map((p) => haversineMeters(walk!.reached, p));
    expect(Math.min(...reachedY)).toBeLessThan(2);
  });

  it('steps straight on when the start is beside the route', () => {
    const walk = walkToRoute(graph, at(1990, 1500), route);
    expect(walk!.points).toHaveLength(2);
  });

  it('draws the ride from where each walk meets the route', () => {
    const line = [at(2000, 0), at(2000, 2500)].map((p) => [p.lon, p.lat]);
    const from = at(1000, 1200);
    const to = at(1000, 1950);
    // Planned in a straight line: board at y 1200, get off at y 1950
    const board = projectOntoLine(line, at(2000, 1200));
    const alight = projectOntoLine(line, at(2000, 1950));
    const walks = walksForTrip(
      graph,
      line,
      { boardChainageKm: board.chainageKm, alightChainageKm: alight.chainageKm, from: board.snapped, to: alight.snapped },
      from,
      to,
    );
    expect(haversineMeters(walks.boardAt, at(2000, 1000))).toBeLessThan(2);
    expect(haversineMeters(walks.alightAt, at(2000, 2000))).toBeLessThan(2);
    expect(walks.boardChainageKm).toBeLessThan(board.chainageKm);
    expect(walks.alightChainageKm).toBeGreaterThan(alight.chainageKm);
  });
});

describe('the streets of the offline map', () => {
  it('walks from the FSU stop to the SM City Butuan stop along the streets', () => {
    const fsu = { lat: 8.94755, lon: 125.54149 };
    const smb = { lat: 8.946137, lon: 125.533133 };
    const path = walkPath(walkGraph(), fsu, smb);
    expect(path).not.toBeNull();
    const straight = haversineMeters(fsu, smb);
    expect(path!.lengthM).toBeGreaterThanOrEqual(straight);
    expect(path!.lengthM).toBeLessThan(straight * 1.6);
  });
});
