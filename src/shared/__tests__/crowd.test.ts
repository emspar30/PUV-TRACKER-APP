// C1 and RP1: the geofence and GPS rules, the demo check-ins and reports paying into the demo wallet
// (the earn-and-spend loop), and the live repository mapping the SB1 functions' answers. Fake ports
// and fixed clocks, no network.

import { createDemoCrowd } from '../../data/demo/demoCrowd';
import { createDemoEnergy } from '../../data/demo/demoEnergy';
import { createLiveCrowd, feedPostOf, type CrowdPort } from '../../data/live/liveCrowd';
import type { ReportInput } from '../../data/repositories/types';
import { canReportWithGps, checkInGeofence, type Place } from '../checkin/geofence';
import {
  CHECKIN_LIFETIME_S,
  CHECKIN_RADIUS_M,
  ENERGY_CHECKIN,
  ENERGY_GPS_REPORT,
  ENERGY_NO_GPS_REPORT,
  ENERGY_PASSIVE_AMOUNT,
  ENERGY_TRACKING_COST,
  GPS_ACCURACY_GATE_CHECKIN_M,
  GPS_ACCURACY_GATE_RELAY_M,
} from '../config';

const T0 = Date.UTC(2026, 9, 5, 2, 0, 0);
const DAY = 24 * 3600000;
const STATION = { lat: 10.3157, lon: 123.8854 };
// About 11 m per 0.0001 degree of latitude
const near = (metres: number) => ({ lat: STATION.lat + metres / 111000, lon: STATION.lon });
const gps = (metres: number, accuracyM: number | null): Place => ({ ...near(metres), source: 'gps', accuracyM });

describe('the check-in geofence', () => {
  it('lets a precise fix within the radius check in', () => {
    const result = checkInGeofence(gps(20, 10), STATION);
    expect(result.ok).toBe(true);
  });

  it('refuses a fix outside the radius, and says how far', () => {
    const result = checkInGeofence(gps(CHECKIN_RADIUS_M + 40, 10), STATION);
    expect(result).toEqual({ ok: false, reason: 'too_far', distanceM: expect.any(Number) });
    if (!result.ok && result.reason === 'too_far') expect(result.distanceM).toBeGreaterThan(CHECKIN_RADIUS_M);
  });

  it('refuses an imprecise or unknown accuracy, a pin, and no position', () => {
    expect(checkInGeofence(gps(0, GPS_ACCURACY_GATE_CHECKIN_M + 1), STATION)).toEqual({ ok: false, reason: 'inaccurate' });
    expect(checkInGeofence(gps(0, null), STATION)).toEqual({ ok: false, reason: 'inaccurate' });
    expect(checkInGeofence({ ...STATION, source: 'pin', accuracyM: null }, STATION)).toEqual({ ok: false, reason: 'no_position' });
    expect(checkInGeofence(null, STATION)).toEqual({ ok: false, reason: 'no_position' });
  });

  it('trusts the simulated stop (no accuracy), but still checks the distance', () => {
    expect(checkInGeofence({ ...STATION, source: 'simulated', accuracyM: null }, STATION).ok).toBe(true);
    expect(checkInGeofence({ ...near(500), source: 'simulated', accuracyM: null }, STATION).ok).toBe(false);
  });
});

describe('reporting with GPS', () => {
  it('needs a fix at the relay accuracy or the simulated stop', () => {
    expect(canReportWithGps(gps(0, GPS_ACCURACY_GATE_RELAY_M))).toBe(true);
    expect(canReportWithGps(gps(0, GPS_ACCURACY_GATE_RELAY_M + 1))).toBe(false);
    expect(canReportWithGps({ ...STATION, source: 'simulated', accuracyM: null })).toBe(true);
    expect(canReportWithGps({ ...STATION, source: 'pin', accuracyM: null })).toBe(false);
    expect(canReportWithGps(null)).toBe(false);
  });
});

const REPORT: ReportInput = { routeCode: 'R4', phrase: 'few_seats', seatTier: 'amber', vehicleId: null, withGps: true };

describe('the demo loop: earn by checking in and reporting, spend by tracking', () => {
  const setup = (username: string | null = 'demo_me') => {
    let now = T0;
    const clock = () => now;
    const energy = createDemoEnergy(clock);
    const crowd = createDemoCrowd(energy, () => username, 7, clock);
    return { energy, crowd, advance: (ms: number) => (now += ms), at: () => now };
  };

  it('a check-in earns once a day, counts the user at the station, and ends at once', async () => {
    const { energy, crowd } = setup();
    await energy.refresh();
    const before = (await crowd.checkins.waitingCounts('R4', ['AAA']))?.get('AAA') ?? 0;
    expect(await crowd.checkins.checkIn('R4', 'AAA', 'checkin-aaaaaaaa')).toEqual({ ok: true, expiresAtMs: T0 + CHECKIN_LIFETIME_S * 1000 });
    expect((await crowd.checkins.waitingCounts('R4', ['AAA']))?.get('AAA')).toBe(before + 1);
    expect((await energy.refresh())?.balance).toBe(ENERGY_PASSIVE_AMOUNT + ENERGY_CHECKIN);
    await crowd.checkins.checkIn('R4', 'AAA', 'checkin-bbbbbbbb');
    expect((await energy.refresh())?.balance).toBe(ENERGY_PASSIVE_AMOUNT + ENERGY_CHECKIN);
    await crowd.checkins.end();
    expect((await crowd.checkins.waitingCounts('R4', ['AAA']))?.get('AAA') ?? 0).toBe(before);
  });

  it('reports earn 1.0 with GPS and 0.5 without, once a day each; the next Manila day pays again', async () => {
    const { energy, crowd, advance } = setup();
    await energy.refresh();
    expect(await crowd.reports.post(REPORT, 'report-aaaaaaaa')).toEqual({ ok: true });
    await crowd.reports.post(REPORT, 'report-bbbbbbbb');
    await crowd.reports.post({ ...REPORT, withGps: false }, 'report-cccccccc');
    const balance = ENERGY_PASSIVE_AMOUNT + ENERGY_GPS_REPORT + ENERGY_NO_GPS_REPORT;
    expect((await energy.refresh())?.balance).toBe(balance);
    advance(DAY);
    await crowd.reports.post(REPORT, 'report-dddddddd');
    expect((await energy.refresh())?.balance).toBeGreaterThan(balance);
  });

  it('the Energy earned pays for tracking', async () => {
    const { energy, crowd } = setup();
    await energy.refresh();
    expect((await energy.startTracking('track-aaaaaaaa')).ok).toBe(true);
    expect(await energy.startTracking('track-bbbbbbbb')).toEqual({ ok: false, reason: 'not_enough_energy' });
    await crowd.reports.post(REPORT, 'report-aaaaaaaa');
    expect((await energy.startTracking('track-cccccccc')).ok).toBe(true);
    expect((await energy.refresh())?.balance).toBe(ENERGY_PASSIVE_AMOUNT + ENERGY_GPS_REPORT - 2 * ENERGY_TRACKING_COST);
  });

  it('own demo reports show in the feed for an hour; no handle, no report', async () => {
    const { crowd, advance } = setup();
    await crowd.reports.post(REPORT, 'report-aaaaaaaa');
    const posts = await crowd.reports.recent();
    expect(posts).toHaveLength(1);
    expect(posts?.[0]).toMatchObject({ routeCode: 'R4', phrase: 'few_seats', seatTier: 'amber', username: 'demo_me', withGps: true, demo: true });
    advance(3600000);
    expect(await crowd.reports.recent()).toEqual([]);
    expect(await setup(null).crowd.reports.post(REPORT, 'report-bbbbbbbb')).toEqual({ ok: false, reason: 'no_username' });
  });
});

const port = (over: Partial<CrowdPort> = {}): CrowdPort => ({
  signedIn: async () => true,
  checkIn: async () => ({ expiresAt: new Date(T0 + CHECKIN_LIFETIME_S * 1000).toISOString() }),
  checkinCounts: async () => [{ station_code: 'AAA', waiting: '2' }],
  endCheckIn: async () => null,
  postReport: async () => null,
  feed: async () => [
    { id: 5, author_username: 'juan', route_id: 'R4', phrase: 'full', seat_tier: 'red', with_gps: false, created_at: new Date(T0).toISOString() },
  ],
  ...over,
});

describe('the live check-ins and reports', () => {
  it('signed out: no counts or feed, and both actions ask to sign in', async () => {
    const crowd = createLiveCrowd(port({ signedIn: async () => false }));
    expect(await crowd.checkins.waitingCounts('R4', [])).toBeNull();
    expect(await crowd.checkins.checkIn('R4', 'AAA', 'checkin-aaaaaaaa')).toEqual({ ok: false, reason: 'sign_in' });
    expect(await crowd.reports.post(REPORT, 'report-aaaaaaaa')).toEqual({ ok: false, reason: 'sign_in' });
    expect(await crowd.reports.recent()).toBeNull();
  });

  it('maps the server answers: expiry, counts sent as text, feed rows', async () => {
    const crowd = createLiveCrowd(port());
    expect(await crowd.checkins.checkIn('R4', 'AAA', 'checkin-aaaaaaaa')).toEqual({ ok: true, expiresAtMs: T0 + CHECKIN_LIFETIME_S * 1000 });
    expect(await crowd.checkins.waitingCounts('R4', [])).toEqual(new Map([['AAA', 2]]));
    expect(await crowd.reports.recent()).toEqual([
      { id: '5', routeCode: 'R4', phrase: 'full', seatTier: 'red', username: 'juan', withGps: false, postedMs: T0, demo: false },
    ]);
  });

  it('maps the function errors; a failed end is ignored', async () => {
    const crowd = createLiveCrowd(
      port({
        checkIn: async () => ({ code: '28000', message: 'not signed in' }),
        postReport: async () => ({ code: 'P0001', message: 'set a username first' }),
        endCheckIn: async () => Promise.reject(new Error('offline')),
      }),
    );
    expect(await crowd.checkins.checkIn('R4', 'AAA', 'checkin-aaaaaaaa')).toEqual({ ok: false, reason: 'sign_in' });
    expect(await crowd.reports.post(REPORT, 'report-aaaaaaaa')).toEqual({ ok: false, reason: 'no_username' });
    await expect(crowd.checkins.end()).resolves.toBeUndefined();
    const failing = createLiveCrowd(port({ postReport: async () => ({ code: '42501', message: 'sign in to take part' }) }));
    expect(await failing.reports.post(REPORT, 'report-aaaaaaaa')).toEqual({ ok: false, reason: 'error', message: 'sign in to take part' });
  });

  it('drops a feed row with an unknown phrase and an unknown seat tier', () => {
    const row = { id: 1, author_username: 'a', route_id: 'R4', phrase: 'full', seat_tier: 'purple', with_gps: true, created_at: new Date(T0).toISOString() };
    expect(feedPostOf(row)?.seatTier).toBeNull();
    expect(feedPostOf({ ...row, phrase: 'free text' })).toBeNull();
  });
});
