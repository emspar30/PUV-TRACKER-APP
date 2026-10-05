// L2: the simple ETA (D9) and the stops around a tracked vehicle. Fixtures only.

import { ETA_MIN_SPEED_KMH, TRACK_ALERT_ETA_S, TRACK_DISTANCE_ALERTS_M } from '../config';
import { lineLengthKm } from '../geo/line';
import { crossedDistance, crossesAlert, etaTo, trackProgress } from '../tracking/eta';
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

  it('alerts once, when the ETA first reaches the threshold', () => {
    expect(crossesAlert(TRACK_ALERT_ETA_S + 10, TRACK_ALERT_ETA_S - 1, TRACK_ALERT_ETA_S)).toBe(true);
    expect(crossesAlert(TRACK_ALERT_ETA_S - 5, TRACK_ALERT_ETA_S - 9, TRACK_ALERT_ETA_S)).toBe(false);
    expect(crossesAlert(TRACK_ALERT_ETA_S + 10, null, TRACK_ALERT_ETA_S)).toBe(false);
  });
});
