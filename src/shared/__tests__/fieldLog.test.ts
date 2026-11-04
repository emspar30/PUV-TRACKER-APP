// S10: the field test log's summary and export (shared/fieldtest/log.ts).

import { summarize, toCsv, type FieldEvent } from '../fieldtest/log';

const T0 = Date.UTC(2026, 10, 2, 0, 0, 0);
const MIN = 60_000;

describe('S10 field test log', () => {
  const events: FieldEvent[] = [
    { atMs: T0, kind: 'relay_start', note: 'R4 live' },
    { atMs: T0, kind: 'battery', value: 80 },
    { atMs: T0 + 1 * MIN, kind: 'sent', value: 1024 },
    { atMs: T0 + 2 * MIN, kind: 'secondary' },
    { atMs: T0 + 3 * MIN, kind: 'rssi', value: -70 },
    { atMs: T0 + 4 * MIN, kind: 'rssi', value: -60 },
    { atMs: T0 + 5 * MIN, kind: 'rssi', value: -65 },
    { atMs: T0 + 6 * MIN, kind: 'primary' },
    { atMs: T0 + 7 * MIN, kind: 'verified', value: 24 },
    { atMs: T0 + 10 * MIN, kind: 'gap', value: 3 },
    { atMs: T0 + 30 * MIN, kind: 'sent', value: 1024 },
    { atMs: T0 + 30 * MIN, kind: 'battery', value: 77 },
    { atMs: T0 + 30 * MIN, kind: 'relay_end' },
    // Outside any relay: not counted as relay data
    { atMs: T0 + 40 * MIN, kind: 'sent', value: 9999 },
  ];

  it('gives per-hour battery and data, gaps, Bluetooth signal, verification and handoffs', () => {
    const s = summarize(events);
    expect(s.relays).toBe(1);
    expect(s.relayHours).toBeCloseTo(0.5);
    expect(s.batteryPctPerHour).toBeCloseTo(6);
    expect(s.kbPerHour).toBeCloseTo(4);
    expect(s.gaps).toBe(1);
    expect(s.rssi).toEqual({ count: 3, median: -65, min: -70, max: -60 });
    expect(s.verifyPassRate).toBe(100);
    expect(s.medianVerifyS).toBe(24);
    expect(s.handoffs).toBe(1);
  });

  it('an empty log measures nothing', () => {
    expect(summarize([])).toEqual({
      relays: 0,
      relayHours: 0,
      batteryPctPerHour: null,
      kbPerHour: null,
      gaps: 0,
      rssi: null,
      verifyPassRate: null,
      medianVerifyS: null,
      handoffs: 0,
      delay: null,
      eta: null,
    });
  });

  it('gives the map delay in seconds, its 90th percentile and the share under the N1 target', () => {
    const delays = [1200, 2500, 3000, 4000, 9000].map((value, i): FieldEvent => ({ atMs: T0 + i * MIN, kind: 'delay', value }));
    expect(summarize(delays).delay).toEqual({ count: 5, medianS: 3, p90S: 9, underTargetPct: 80 });
  });

  it('compares each ETA with the arrival that ended its tracking session', () => {
    const s = summarize([
      // Stopped without an arrival: its ETA is dropped at the next track_start
      { atMs: T0, kind: 'track_start', note: 'R4' },
      { atMs: T0 + 1 * MIN, kind: 'eta', value: 600 },
      { atMs: T0 + 2 * MIN, kind: 'track_start', note: 'R4' },
      // Shown 5 min, came after 6 (60 s late); shown 3 min, came after 3.5 (30 s late)
      { atMs: T0 + 3 * MIN, kind: 'eta', value: 300 },
      { atMs: T0 + 5.5 * MIN, kind: 'eta', value: 180 },
      { atMs: T0 + 9 * MIN, kind: 'arrived', note: 'ABC 123' },
      // Shown 2 min, came after 1.5 (30 s early)
      { atMs: T0 + 20 * MIN, kind: 'track_start', note: 'R1' },
      { atMs: T0 + 21 * MIN, kind: 'eta', value: 120 },
      { atMs: T0 + 22.5 * MIN, kind: 'arrived' },
    ]);
    expect(s.eta).toEqual({ count: 3, medianAbsErrorS: 30, medianErrorS: -30 });
  });

  it('exports CSV with one line per event, quoting notes that need it', () => {
    const csv = toCsv([{ atMs: T0, kind: 'not_verified', value: 90, note: 'no_motion, "slow"' }]);
    expect(csv.split('\n')).toEqual(['time,kind,value,note', `${new Date(T0).toISOString()},not_verified,90,"no_motion, ""slow"""`]);
  });
});
