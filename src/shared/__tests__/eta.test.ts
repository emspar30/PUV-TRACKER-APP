// L2: the simple ETA (D9) and the stops around a tracked vehicle. Fixtures only.

import { COVERAGE_LIVE_MAX_AGE_S, ETA_MIN_SPEED_KMH, TRACK_ALERT_ETA_S, TRACK_ARRIVED_M, TRACK_ARRIVED_PASS_M, TRACK_DISTANCE_ALERTS_M } from '../config';
import { lineLengthKm } from '../geo/line';
import { crossedDistance, crossesAlert, etaNow, etaTo, hasArrived, trackProgress } from '../tracking/eta';
import { FIXTURE_OUTBOUND, FIXTURE_RETURN, FIXTURE_STOPS, pointAt } from './fixtures/routeFixture';

const LINES = [FIXTURE_OUTBOUND, FIXTURE_RETURN];
const NOW = Date.UTC(2026, 9, 5, 2, 0, 0);
const S = 1000;
const speeds = (kmh: number, count = 3) => Array.from({ length: count }, (_v, i) => ({ atMs: NOW - i * 5 * S, speedKmh: kmh }));
const at = (km: number, kmh = 20, lineId = 'T1-OUT', count = 3) => ({ ...pointAt(km), lineId, lastPacketMs: NOW, recentSpeeds: speeds(kmh, count) });

describe('ETA (D9)', () => {
  it('is the distance along the line over the recent speed', () => {
    const eta = etaTo(at(1, 20), LINES, pointAt(3));
    expect(eta.kind).toBe('approaching');
    if (eta.kind !== 'approaching') return;
    expect(eta.distanceKm).toBeCloseTo(2, 1);
    expect(eta.etaS).toBeCloseTo(360, -1);
  });

  it('counts a slow or stopped vehicle at the minimum speed', () => {
    const eta = etaTo(at(1, 0), LINES, pointAt(2));
    expect(eta.kind === 'approaching' && eta.speedKmh).toBe(ETA_MIN_SPEED_KMH);
  });

  it('says passed behind the vehicle on a lone leg, and unknown off the line, too far or with too few speeds', () => {
    expect(etaTo(at(4), [FIXTURE_OUTBOUND], pointAt(3)).kind).toBe('passed');
    expect(etaTo(at(4), LINES, pointAt(3), undefined, { round: false }).kind).toBe('passed');
    expect(etaTo(at(1), LINES, pointAt(3, 400))).toEqual({ kind: 'unknown', reason: 'off_line' });
    expect(etaTo(at(1, 20, 'T1-OUT', 1), LINES, pointAt(3))).toEqual({ kind: 'unknown', reason: 'few_samples' });
  });

  it('uses the direction the vehicle travels', () => {
    const coming = etaTo(at(5, 20, 'T1-RET'), LINES, pointAt(3));
    expect(coming.kind === 'approaching' && coming.distanceKm).toBeCloseTo(2, 1);
  });

  it('after passing the commuter, counts on round the route to them again (B2)', () => {
    const lengthKm = lineLengthKm(FIXTURE_OUTBOUND.coordinates);
    // Past 3 km on the outbound: to the east end, then back along the return to 3 km
    const outbound = etaTo(at(4), LINES, pointAt(3));
    expect(outbound.kind).toBe('approaching');
    if (outbound.kind === 'approaching') expect(outbound.distanceKm).toBeCloseTo(lengthKm - 4 + (lengthKm - 3), 1);
    // Past 3 km on the return: to the west end, then the outbound to 3 km
    const back = etaTo(at(1, 20, 'T1-RET'), LINES, pointAt(3));
    expect(back.kind === 'approaching' && back.distanceKm).toBeCloseTo(1 + 3, 1);
  });
});

// A line that uses one street twice, like R4's downtown loop: east 4 km, north 500 m, west 2 km,
// south 500 m back onto the street, then west on it to the start
const ll = (km: number, northM = 0) => [pointAt(km, northM).lon, pointAt(km, northM).lat];
const TWICE = { ...FIXTURE_OUTBOUND, id: 'T9', routeCode: 'T9', coordinates: [ll(0), ll(4), ll(4, 500), ll(2, 500), ll(2), ll(0)] };
const EAST = 90;
const WEST = 270;

describe('a line that uses a street twice (B2 fix)', () => {
  it('places the vehicle on the pass it is heading along, and measures forward to the next pass by the commuter', () => {
    // Westbound at 1.5 km, on the way back: the commuter at 1 km is 0.5 km ahead
    const back = etaTo({ ...at(1.5), lineId: 'T9', headingDeg: WEST }, [TWICE], pointAt(1));
    expect(back.kind === 'approaching' && back.distanceKm).toBeCloseTo(0.5, 1);
    // Eastbound at 1.5 km, on the way out: round the loop first, 2.5 + 0.5 + 2 + 0.5 + 1 = 6.5 km
    const out = etaTo({ ...at(1.5), lineId: 'T9', headingDeg: EAST }, [TWICE], pointAt(1));
    expect(out.kind === 'approaching' && out.distanceKm).toBeCloseTo(6.5, 1);
  });

  it('the next stop follows the pass the vehicle is on', () => {
    const stops = [{ ...FIXTURE_STOPS[0], code: 'ONE', ...pointAt(1) }, { ...FIXTURE_STOPS[0], code: 'THREE', ...pointAt(3) }];
    expect(trackProgress({ ...at(1.5), lineId: 'T9', headingDeg: EAST }, [TWICE], stops, null).next?.code).toBe('THREE');
    expect(trackProgress({ ...at(1.5), lineId: 'T9', headingDeg: WEST }, [TWICE], stops, null).next?.code).toBe('ONE');
  });
});

describe('tracking progress and alert', () => {
  it('names the stop passed and the next one', () => {
    const progress = trackProgress(at(3), LINES, FIXTURE_STOPS, FIXTURE_STOPS[2]);
    expect(progress.passed?.code).toBe('BBB');
    expect(progress.next?.code).toBe('CCC');
    expect(progress.mine?.code).toBe('CCC');
  });

  it('past the last stop of a leg, the next stop is the first on the next leg (B2)', () => {
    expect(trackProgress(at(7), LINES, FIXTURE_STOPS, null).next?.code).toBe('CCC');
  });

  it('distance alerts at 1 km, 500 m, 250 m and 100 m, once each, never on the first reading (B2)', () => {
    expect(TRACK_DISTANCE_ALERTS_M).toEqual([1000, 500, 250, 100]);
    expect(crossedDistance(null, 0.4, TRACK_DISTANCE_ALERTS_M)).toBeNull();
    expect(crossedDistance(1.2, 0.95, TRACK_DISTANCE_ALERTS_M)).toBe(1000);
    expect(crossedDistance(0.95, 0.9, TRACK_DISTANCE_ALERTS_M)).toBeNull();
    // A jump past two thresholds alerts the nearer one
    expect(crossedDistance(0.6, 0.2, TRACK_DISTANCE_ALERTS_M)).toBe(250);
    expect(crossedDistance(0.11, 0.1, TRACK_DISTANCE_ALERTS_M)).toBe(100);
    // Going round again starts far away: no alert
    expect(crossedDistance(0.05, 12, TRACK_DISTANCE_ALERTS_M)).toBeNull();
  });

  it('arrives within 50 m, or when it went by between readings, never on the first reading (B2)', () => {
    const arrived = (previous: number | null, km: number | null) => hasArrived(previous, km, TRACK_ARRIVED_M, TRACK_ARRIVED_PASS_M);
    expect(arrived(null, 0.01)).toBe(false);
    expect(arrived(0.12, 0.04)).toBe(true);
    expect(arrived(0.12, 0.08)).toBe(false);
    // 120 m away, then 18 km: it passed between readings and is counting to its next time round
    expect(arrived(0.12, 18)).toBe(true);
    // Far away and then farther (a slower reading): not an arrival
    expect(arrived(2, 2.1)).toBe(false);
    // GPS wobble while parked near the stop: not an arrival
    expect(arrived(0.12, 0.125)).toBe(false);
    expect(arrived(0.12, null)).toBe(false);
  });

  it('alerts once, when the ETA first reaches the threshold', () => {
    expect(crossesAlert(TRACK_ALERT_ETA_S + 10, TRACK_ALERT_ETA_S - 1, TRACK_ALERT_ETA_S)).toBe(true);
    expect(crossesAlert(TRACK_ALERT_ETA_S - 5, TRACK_ALERT_ETA_S - 9, TRACK_ALERT_ETA_S)).toBe(false);
    expect(crossesAlert(TRACK_ALERT_ETA_S + 10, null, TRACK_ALERT_ETA_S)).toBe(false);
  });
});

describe('the live ETA now (L2)', () => {
  const measured = etaTo(at(1, 20), LINES, pointAt(3));

  it('counts down by the age of the last packet: time and distance driven since', () => {
    if (measured.kind !== 'approaching') throw new Error('expected an ETA');
    const now = etaNow(measured, 18);
    if (now.kind !== 'approaching') throw new Error('expected an ETA');
    expect(now.etaS).toBeCloseTo(measured.etaS - 18, 6);
    // 20 km/h for 18 s is 100 m
    expect(now.distanceKm).toBeCloseTo(measured.distanceKm - 0.1, 6);
    expect(now.speedKmh).toBe(measured.speedKmh);
  });

  it('is unchanged for a fresh packet and never goes below zero', () => {
    expect(etaNow(measured, 0)).toEqual(measured);
    if (measured.kind !== 'approaching') throw new Error('expected an ETA');
    const late = etaNow({ ...measured, etaS: 10, distanceKm: 0.05 }, 30);
    expect(late).toMatchObject({ kind: 'approaching', etaS: 0, distanceKm: 0 });
  });

  it('is hidden once the vehicle is no longer Live', () => {
    expect(etaNow(measured, COVERAGE_LIVE_MAX_AGE_S - 1).kind).toBe('approaching');
    expect(etaNow(measured, COVERAGE_LIVE_MAX_AGE_S)).toEqual({ kind: 'unknown', reason: 'stale' });
  });

  it('leaves passed and unknown ETAs as they are', () => {
    expect(etaNow({ kind: 'passed' }, 200)).toEqual({ kind: 'passed' });
    expect(etaNow({ kind: 'unknown', reason: 'few_samples' }, 5)).toEqual({ kind: 'unknown', reason: 'few_samples' });
  });
});
