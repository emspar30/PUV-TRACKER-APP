// Phase 2: what the tracked multicab is doing, shown only in the Track view. Fixtures only.

import { SHORT_DETOUR_MAX_MIN } from '../config';
import { stoppedMinutes, trackStatus } from '../tracking/status';

const NOW = Date.UTC(2026, 10, 22, 2, 0, 0);
const S = 1000;
const MIN = 60_000;
const speeds = (...pairs: [secondsAgo: number, kmh: number][]) => pairs.map(([ago, kmh]) => ({ atMs: NOW - ago * S, speedKmh: kmh }));

describe('the Track view status', () => {
  it('says Moving while the multicab drives', () => {
    expect(trackStatus({ recentSpeeds: speeds([60, 20], [30, 22], [0, 18]), lastPacketMs: NOW }, NOW)).toEqual({ kind: 'moving' });
  });

  it('says Stopped with the minutes since it last moved', () => {
    const vehicle = { recentSpeeds: speeds([200, 20], [150, 0], [60, 0], [0, 0]), lastPacketMs: NOW };
    expect(trackStatus(vehicle, NOW)).toEqual({ kind: 'stopped', minutes: 3 });
    expect(stoppedMinutes(vehicle, NOW + MIN)).toBe(4);
  });

  it('says Off route, temporary within the detour limit', () => {
    const base = { recentSpeeds: speeds([0, 20]), lastPacketMs: NOW };
    expect(trackStatus({ ...base, offRouteSinceMs: NOW - 2 * MIN }, NOW)).toEqual({ kind: 'off_route', temporary: true });
    expect(trackStatus({ ...base, offRouteSinceMs: NOW - SHORT_DETOUR_MAX_MIN * MIN }, NOW)).toEqual({ kind: 'off_route', temporary: false });
  });
});
