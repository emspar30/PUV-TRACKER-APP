// AF3: vehicle marker features. No data vehicles are not drawn; the cone points along the heading
// and keeps its size on screen at any zoom.

import { headingCone, metersPerPixel, vehicleMarkerFeatures } from '../telemetry/markers';
import type { VehicleSnapshot } from '../telemetry/vehicle';

const NOW = 1_000_000_000;
const vehicle = (id: string, ageS: number, extra: Partial<VehicleSnapshot> = {}): VehicleSnapshot => ({
  id,
  label: 'DEMO 01',
  routeCode: 'T1',
  lineId: 'T1-OUT',
  lat: 9,
  lon: 125.5,
  headingDeg: 90,
  speedKmh: 20,
  seatsTaken: 3,
  lastPacketMs: NOW - ageS * 1000,
  recentSpeeds: [],
  demo: true,
  ...extra,
});

describe('vehicle marker features', () => {
  const cone = { lengthPx: 22, halfAngleDeg: 28, zoom: 14 };

  it('draws Live and Stale vehicles, not No data ones', () => {
    const { points } = vehicleMarkerFeatures([vehicle('a', 10), vehicle('b', 120), vehicle('c', 700)], NOW, cone);
    expect(points.features.map((feature) => [feature.properties.id, feature.properties.stale])).toEqual([
      ['a', false],
      ['b', true],
    ]);
  });

  it('carries the plate label, the seat tier, the stopped state the demo flag and the heading the icon turns to', () => {
    const stoppedSpeeds = Array.from({ length: 11 }, (_v, index) => ({ atMs: NOW - (50 - index * 5) * 1000, speedKmh: 0 }));
    const { points } = vehicleMarkerFeatures([vehicle('a', 0, { seatsTaken: 13, recentSpeeds: stoppedSpeeds })], NOW, cone);
    expect(points.features[0].properties).toEqual({ id: 'a', label: 'DEMO 01', tier: 'red', stale: false, ghost: false, stopped: true, status: 'stopped', demo: true, heading: 90 });
  });

  it('the cone points along the heading (east here) and is 22 px long on screen', () => {
    const { cones } = vehicleMarkerFeatures([vehicle('a', 0)], NOW, cone);
    const [centre, left, right] = cones.features[0].geometry.coordinates[0];
    expect(left[0]).toBeGreaterThan(centre[0]);
    expect(right[0]).toBeGreaterThan(centre[0]);
    expect(left[1]).toBeGreaterThan(centre[1]);
    expect(right[1]).toBeLessThan(centre[1]);
    const lengthM = 22 * metersPerPixel(9, 14);
    const tipEastM = ((left[0] - centre[0]) * 111195 * Math.cos((9 * Math.PI) / 180)) / Math.cos((28 * Math.PI) / 180);
    expect(tipEastM).toBeCloseTo(lengthM, 0);
  });

  it('metres per pixel halve with each zoom level', () => {
    expect(metersPerPixel(0, 0)).toBeCloseTo(78271.5, 0);
    expect(metersPerPixel(9, 13) / metersPerPixel(9, 14)).toBeCloseTo(2, 9);
  });

  it('a cone pointing north has its corners north of the vehicle', () => {
    const [centre, left, right] = headingCone(9, 125.5, 0, 50, 30);
    expect(left[1]).toBeGreaterThan(centre[1]);
    expect(right[1]).toBeGreaterThan(centre[1]);
    expect(left[0]).toBeLessThan(centre[0]);
    expect(right[0]).toBeGreaterThan(centre[0]);
  });
});
