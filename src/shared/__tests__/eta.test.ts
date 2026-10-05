// L2: the simple ETA (D9) and the stops around a tracked vehicle. Fixtures only.

import { ETA_MIN_SPEED_KMH, TRACK_ALERT_ETA_S } from '../config';
import { crossesAlert, etaTo, trackProgress } from '../tracking/eta';
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

  it('says passed behind the vehicle, and unknown off the line, too far or with too few speeds', () => {
    expect(etaTo(at(4), LINES, pointAt(3)).kind).toBe('passed');
    expect(etaTo(at(1), LINES, pointAt(3, 400))).toEqual({ kind: 'unknown', reason: 'off_line' });
    expect(etaTo(at(1, 20, 'T1-OUT', 1), LINES, pointAt(3))).toEqual({ kind: 'unknown', reason: 'few_samples' });
  });

  it('uses the direction the vehicle travels', () => {
    expect(etaTo(at(5, 20, 'T1-RET'), LINES, pointAt(3)).kind).toBe('approaching');
    expect(etaTo(at(1, 20, 'T1-RET'), LINES, pointAt(3)).kind).toBe('passed');
  });
});

describe('tracking progress and alert', () => {
  it('names the stop passed and the next one', () => {
    const progress = trackProgress(at(3), LINES, FIXTURE_STOPS, FIXTURE_STOPS[2]);
    expect(progress.passed?.code).toBe('BBB');
    expect(progress.next?.code).toBe('CCC');
    expect(progress.mine?.code).toBe('CCC');
  });

  it('alerts once, when the ETA first reaches the threshold', () => {
    expect(crossesAlert(TRACK_ALERT_ETA_S + 10, TRACK_ALERT_ETA_S - 1, TRACK_ALERT_ETA_S)).toBe(true);
    expect(crossesAlert(TRACK_ALERT_ETA_S - 5, TRACK_ALERT_ETA_S - 9, TRACK_ALERT_ETA_S)).toBe(false);
    expect(crossesAlert(TRACK_ALERT_ETA_S + 10, null, TRACK_ALERT_ETA_S)).toBe(false);
  });
});
