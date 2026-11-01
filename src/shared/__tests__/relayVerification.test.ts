// V1a: a running relay's verification on the phone (shared/relay/verification.ts).

import { SEED_LINES } from '../../data/seed/routes';
import { MOTION_SPEED_FALLBACK_S, VERIFY_WINDOW_MAX_S } from '../config';
import { pointAtChainage } from '../geo/line';
import { relayVerification } from '../relay/verification';

const R4 = SEED_LINES.filter((line) => line.routeCode === 'R4').map((line) => line.coordinates);
const T0 = Date.UTC(2026, 10, 2, 2, 0, 0);
const MS_PER_S = 1000;

const ride = (kmh: number, seconds: number) =>
  Array.from({ length: seconds / 5 + 1 }, (_, i) => {
    const at = pointAtChainage(R4[0], (200 + (kmh / 3.6) * i * 5) / 1000);
    return { lat: at.lat, lon: at.lon, atMs: T0 + i * 5 * MS_PER_S, accuracyM: 8, speedKmh: kmh };
  });

describe('V1a relay verification on the phone', () => {
  it('a ride on its route is verified', () => {
    expect(relayVerification({ fixes: ride(30, 25), lines: R4, startedMs: T0, nowMs: T0 + 25 * MS_PER_S, demo: false }).status).toBe('verified');
  });

  it('a phone that stops sending fixes is decided once the longest window has passed', () => {
    const fixes = ride(0, 10);
    expect(relayVerification({ fixes, lines: R4, startedMs: T0, nowMs: T0 + 60 * MS_PER_S, demo: false }).status).toBe('pending');
    expect(relayVerification({ fixes, lines: R4, startedMs: T0, nowMs: T0 + VERIFY_WINDOW_MAX_S * MS_PER_S, demo: false })).toEqual({
      status: 'failed',
      reasons: ['no_motion', 'no_displacement'],
    });
  });

  it('fixes from before the relay was released are not counted', () => {
    const before = ride(30, 25).map((fix) => ({ ...fix, atMs: fix.atMs - 60 * MS_PER_S }));
    expect(relayVerification({ fixes: before, lines: R4, startedMs: T0, nowMs: T0 + 5 * MS_PER_S, demo: false }).status).toBe('pending');
  });

  it('a demo relay is verified after the motion time', () => {
    const start = { fixes: [], lines: R4, startedMs: T0, demo: true };
    expect(relayVerification({ ...start, nowMs: T0 + (MOTION_SPEED_FALLBACK_S - 1) * MS_PER_S }).status).toBe('pending');
    expect(relayVerification({ ...start, nowMs: T0 + MOTION_SPEED_FALLBACK_S * MS_PER_S }).status).toBe('verified');
  });
});
