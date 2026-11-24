// 2026-11-24 field test: phone A relayed a multicab, phone B (in the same multicab) tracked it and saw
// about 6 km instead of about 0. The tracker level with the multicab was taken as just behind it, so the
// distance wrapped round the whole loop. These tests place the vehicle and the tracker at the same
// point (straight two-way route, a loop route, both directions) and check Here, Passed and the stop
// ahead of the vehicle nearest the tracker. Fixtures only.

import { MAX_WALK_PER_LEG_M, TRACK_ARRIVED_M, TRACK_ARRIVED_PASS_M, TRACK_HERE_M } from '../config';
import { lineLengthKm } from '../geo/line';
import { routeRound, withReturnLegs } from '../routing/loop';
import { etaDistanceKm, etaTo, hasArrived, stopAheadNearest, trackEta } from '../tracking/eta';
import { FIXTURE_OUTBOUND, FIXTURE_RETURN, FIXTURE_STOPS, pointAt } from './fixtures/routeFixture';

const LINES = [FIXTURE_OUTBOUND, FIXTURE_RETURN];
const NOW = Date.UTC(2026, 10, 24, 2, 0, 0);
const S = 1000;
const EAST = 90;
const WEST = 270;
const NORTH = 0;
const SOUTH = 180;
const speeds = (kmh: number) => [0, 1, 2].map((i) => ({ atMs: NOW - i * 5 * S, speedKmh: kmh }));
const vehicleAt = (point: { lat: number; lon: number }, lineId: string, headingDeg?: number) => ({
  ...point,
  lineId,
  headingDeg,
  lastPacketMs: NOW,
  recentSpeeds: speeds(20),
});

// A loop route like R4's downtown loop, one stored leg: east 4 km, north 500 m, west 2 km, south 500 m
// back onto the street, then west on it to the start. withReturnLegs adds the stand-in back leg.
const ll = (km: number, northM = 0) => [pointAt(km, northM).lon, pointAt(km, northM).lat];
const LOOP_LINE = { ...FIXTURE_OUTBOUND, id: 'L9', routeCode: 'L9', coordinates: [ll(0), ll(4), ll(4, 500), ll(2, 500), ll(2), ll(0)] };
const LOOP = withReturnLegs([LOOP_LINE]);
const LOOP_STOPS = [
  { code: 'L0', name: 'Start', ...pointAt(0) },
  { code: 'L1', name: 'One km', ...pointAt(1) },
  { code: 'L3', name: 'Three km', ...pointAt(3) },
  { code: 'LN', name: 'Loop top', ...pointAt(3, 500) },
];

describe('the tracker at the same point as the multicab: Here, never a loop away', () => {
  it.each([
    ['outbound, heading east', 'T1-OUT', EAST],
    ['return, heading west', 'T1-RET', WEST],
    ['outbound, no heading', 'T1-OUT', undefined],
    ['return, no heading', 'T1-RET', undefined],
  ])('two-way street, %s', (_name, lineId, heading) => {
    const eta = etaTo(vehicleAt(pointAt(3), lineId, heading), LINES, pointAt(3));
    expect(eta).toMatchObject({ kind: 'approaching', distanceKm: 0, etaS: 0, here: true });
    expect(etaDistanceKm(eta)).toBe(0);
  });

  it.each([
    ['on the street, eastbound (first pass)', pointAt(1), EAST],
    ['on the loop top, westbound', pointAt(3, 500), WEST],
    ['on the loop side, northbound', pointAt(4, 250), NORTH],
    ['on the loop side, southbound', pointAt(2, 250), SOUTH],
    ['on the street, westbound (second pass)', pointAt(1), WEST],
  ])('loop route, %s', (_name, point, heading) => {
    const eta = etaTo(vehicleAt(point, 'L9', heading), LOOP, point);
    expect(eta).toMatchObject({ kind: 'approaching', distanceKm: 0, here: true });
  });

  it(`within ${TRACK_HERE_M} m is Here; a little further is a distance, not Here`, () => {
    const vehicle = vehicleAt(pointAt(3), 'T1-OUT', EAST);
    expect(etaTo(vehicle, LINES, pointAt(3, TRACK_HERE_M - 5))).toMatchObject({ here: true });
    const ahead = etaTo(vehicle, LINES, pointAt(3 + (TRACK_HERE_M + 30) / 1000));
    expect(ahead.kind === 'approaching' && !ahead.here && ahead.distanceKm).toBeCloseTo(0.08, 2);
  });

  it(`a tracker up to ${TRACK_HERE_M} m behind along the line, off to the side, is reached (0), not a loop away`, () => {
    // 40 m behind and 40 m off the street: 57 m away, so not Here, but never the 6 km round either
    const eta = etaTo(vehicleAt(pointAt(1), 'L9', EAST), LOOP, pointAt(1 - 0.04, 40));
    expect(eta.kind).toBe('approaching');
    expect(etaDistanceKm(eta)).toBe(0);
  });

  it('the same point on the stand-in back leg of a loop', () => {
    const back = routeRound(LOOP, 'L9~back')[0];
    expect(back.id).toBe('L9~back');
    expect(etaTo(vehicleAt(pointAt(3, 500), 'L9~back', EAST), LOOP, pointAt(3, 500))).toMatchObject({ here: true });
  });
});

describe('the tracker behind the multicab: Passed, with the next arrival apart', () => {
  it('two-way street, both directions', () => {
    const lengthKm = lineLengthKm(FIXTURE_OUTBOUND.coordinates);
    const east = etaTo(vehicleAt(pointAt(3.3), 'T1-OUT', EAST), LINES, pointAt(3));
    expect(east.kind === 'passed' && east.nextRoundKm).toBeCloseTo(lengthKm - 3.3 + (lengthKm - 3), 1);
    const west = etaTo(vehicleAt(pointAt(2.7), 'T1-RET', WEST), LINES, pointAt(3));
    expect(west.kind === 'passed' && west.nextRoundKm).toBeCloseTo(2.7 + 3, 1);
    expect([etaDistanceKm(east), etaDistanceKm(west)]).toEqual([null, null]);
  });

  it('loop route: 300 m behind on the street is Passed, never about 6 km away', () => {
    const eta = etaTo(vehicleAt(pointAt(1.3), 'L9', EAST), LOOP, pointAt(1));
    expect(eta.kind).toBe('passed');
    expect(etaDistanceKm(eta)).toBeNull();
  });

  it('a tracker ahead is still approaching, on a loop and on its way back', () => {
    expect(etaDistanceKm(etaTo(vehicleAt(pointAt(1), 'L9', EAST), LOOP, pointAt(2)))).toBeCloseTo(1, 1);
    // Westbound on the street's second pass, the tracker 1 km further west
    expect(etaDistanceKm(etaTo(vehicleAt(pointAt(2), 'L9', WEST), LOOP, pointAt(1)))).toBeCloseTo(1, 1);
  });

  it('a tracker on another street near the leg ahead is not taken as passed', () => {
    // A return leg 300 m north on its own street; the tracker on it, 300 m from the outbound behind
    const northDeg = pointAt(0, 300).lat - pointAt(0).lat;
    const northReturn = { ...FIXTURE_RETURN, coordinates: FIXTURE_RETURN.coordinates.map(([lon, lat]) => [lon, lat + northDeg]) };
    const eta = etaTo(vehicleAt(pointAt(3.5), 'T1-OUT', EAST), [FIXTURE_OUTBOUND, northReturn], pointAt(3, 300));
    expect(eta.kind).not.toBe('passed');
  });
});

describe('the target: the stop ahead of the multicab nearest the tracker', () => {
  it('picks the stop ahead nearest the tracker, and measures to it', () => {
    // Multicab at 0.5 km eastbound, rider 100 m from stop BBB (2 km)
    const vehicle = vehicleAt(pointAt(0.5), 'T1-OUT', EAST);
    const tracker = pointAt(2.1, 20);
    expect(stopAheadNearest(vehicle, LINES, FIXTURE_STOPS, tracker)?.code).toBe('BBB');
    const { eta, stop } = trackEta(vehicle, LINES, FIXTURE_STOPS, tracker);
    expect(stop?.code).toBe('BBB');
    expect(etaDistanceKm(eta)).toBeCloseTo(1.5, 1);
  });

  it('a stop behind the multicab is never the target', () => {
    // Multicab past AAA heading east, rider at AAA: AAA is behind it (Passed)
    const vehicle = vehicleAt(pointAt(0.6), 'T1-OUT', EAST);
    const { eta, stop } = trackEta(vehicle, LINES, FIXTURE_STOPS, pointAt(0));
    expect(stop).toBeNull();
    expect(eta.kind).toBe('passed');
  });

  it(`no stop ahead within ${MAX_WALK_PER_LEG_M} m of the tracker: measures to the tracker`, () => {
    const vehicle = vehicleAt(pointAt(0.5), 'T1-OUT', EAST);
    const { eta, stop } = trackEta(vehicle, LINES, FIXTURE_STOPS, pointAt(4));
    expect(stop).toBeNull();
    expect(etaDistanceKm(eta)).toBeCloseTo(3.5, 1);
  });

  it('the tracker in the multicab is Here, with no stop to aim at', () => {
    const vehicle = vehicleAt(pointAt(2), 'T1-OUT', EAST);
    expect(trackEta(vehicle, LINES, FIXTURE_STOPS, pointAt(2))).toEqual({ eta: expect.objectContaining({ here: true }), stop: null });
    const loop = vehicleAt(pointAt(3, 500), 'L9', WEST);
    expect(trackEta(loop, LOOP, LOOP_STOPS, pointAt(3, 500)).eta).toMatchObject({ here: true });
  });

  it('on a loop, the stop ahead on the far side of the loop, not the one behind', () => {
    // Eastbound at 2.5 km; L1 is behind (Passed), the loop top LN is ahead and nearest the rider
    const vehicle = vehicleAt(pointAt(2.5), 'L9', EAST);
    expect(stopAheadNearest(vehicle, LOOP, LOOP_STOPS, pointAt(3.1, 480))?.code).toBe('LN');
  });
});

describe('tracking ends when the multicab reaches or passes the tracker', () => {
  it('Here reads 0 km, so the next reading ends tracking', () => {
    expect(hasArrived(0.3, 0, TRACK_ARRIVED_M, TRACK_ARRIVED_PASS_M)).toBe(true);
  });

  it('Passed right after a close reading ends tracking; Passed after a far one does not', () => {
    expect(hasArrived(0.1, null, TRACK_ARRIVED_M, TRACK_ARRIVED_PASS_M, true)).toBe(true);
    expect(hasArrived(1, null, TRACK_ARRIVED_M, TRACK_ARRIVED_PASS_M, true)).toBe(false);
    expect(hasArrived(null, null, TRACK_ARRIVED_M, TRACK_ARRIVED_PASS_M, true)).toBe(false);
  });
});
