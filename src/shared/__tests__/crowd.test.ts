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
  ENERGY_CHECKIN_ROUTE_COST,
  ENERGY_GPS_REPORT,
  ENERGY_NO_GPS_REPORT,
  ENERGY_PASSIVE_AMOUNT,
  ENERGY_PASSIVE_INTERVAL_H,
  ENERGY_TRACKING_COST,
  ENERGY_WALLET_CAP,
  ENERGY_WELCOME,
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

const REPORT: ReportInput = { routeCode: 'R4', phrase: 'few_seats', seatTier: 'amber', vehicleId: 'R4-01', stopCode: 'MCA', withGps: true };

describe('the demo loop (CA1.1): start full, spend on check-ins and tracking, earn by GPS relays and waiting', () => {
  const setup = (username: string | null = 'demo_me') => {
    let now = T0;
    const clock = () => now;
    // Energy switched on, as for a demonstration (it is off by default, D1)
    const energy = createDemoEnergy(clock, true);
    const crowd = createDemoCrowd(energy, () => username, 7, clock);
    // Tracking spends 1 each time, to bring the wallet down
    const spend = async (times: number) => {
      for (let i = 0; i < times; i += 1) await energy.startTracking(`track-spend-${i}`);
    };
    return { energy, crowd, spend, advance: (ms: number) => (now += ms), at: () => now };
  };
  const balanceOf = async (energy: ReturnType<typeof createDemoEnergy>) => (await energy.refresh())?.balance;

  it('a new wallet holds the welcome Energy', async () => {
    expect(await balanceOf(setup().energy)).toBe(ENERGY_WELCOME);
  });

  it('a check-in costs 0.3, counts the user at the station, and ends at once; the same request pays once', async () => {
    const { energy, crowd } = setup();
    const before = (await crowd.checkins.waitingCounts('R4', ['AAA']))?.get('AAA') ?? 0;
    expect(await crowd.checkins.checkIn(['R4'], 'AAA', 'checkin-aaaaaaaa')).toEqual({ ok: true, expiresAtMs: T0 + CHECKIN_LIFETIME_S * 1000 });
    expect((await crowd.checkins.waitingCounts('R4', ['AAA']))?.get('AAA')).toBe(before + 1);
    expect(await balanceOf(energy)).toBe(ENERGY_WELCOME - ENERGY_CHECKIN_ROUTE_COST);
    await crowd.checkins.checkIn(['R4'], 'AAA', 'checkin-aaaaaaaa');
    expect(await balanceOf(energy)).toBe(ENERGY_WELCOME - ENERGY_CHECKIN_ROUTE_COST);
    await crowd.checkins.end();
    expect((await crowd.checkins.waitingCounts('R4', ['AAA']))?.get('AAA') ?? 0).toBe(before);
  });

  it('a check-in at a shared stop counts on each route pinged, and pays for each', async () => {
    const { energy, crowd } = setup();
    const count = async (route: string) => (await crowd.checkins.waitingCounts(route, ['RCA']))?.get('RCA') ?? 0;
    const before = { R3: await count('R3'), R4: await count('R4'), R5: await count('R5') };
    await crowd.checkins.checkIn(['R4', 'R3'], 'RCA', 'checkin-aaaaaaaa');
    expect(await count('R4')).toBe(before.R4 + 1);
    expect(await count('R3')).toBe(before.R3 + 1);
    expect(await count('R5')).toBe(before.R5);
    expect(await balanceOf(energy)).toBeCloseTo(ENERGY_WELCOME - 2 * ENERGY_CHECKIN_ROUTE_COST, 9);
  });

  it('a check-in the wallet cannot pay is refused and counts nobody', async () => {
    const { energy, crowd, spend } = setup();
    await spend(4);
    const before = (await crowd.checkins.waitingCounts('R4', ['RCA']))?.get('RCA') ?? 0;
    expect(await crowd.checkins.checkIn(['R4', 'R3', 'R5', 'R6'], 'RCA', 'checkin-aaaaaaaa')).toEqual({ ok: false, reason: 'not_enough_energy' });
    expect((await crowd.checkins.waitingCounts('R4', ['RCA']))?.get('RCA') ?? 0).toBe(before);
    expect((await crowd.checkins.checkIn(['R4', 'R3', 'R5'], 'RCA', 'checkin-bbbbbbbb')).ok).toBe(true);
    expect(await balanceOf(energy)).toBeCloseTo(0.1, 9);
  });

  it('a relay with GPS earns 1.0 once a day, one without earns nothing; the next Manila day pays again', async () => {
    const { energy, crowd, spend, advance } = setup();
    await spend(3);
    expect(await crowd.reports.post(REPORT, 'report-aaaaaaaa')).toEqual({ ok: true, postId: 'report-aaaaaaaa' });
    await crowd.reports.post(REPORT, 'report-bbbbbbbb');
    await crowd.reports.post({ ...REPORT, withGps: false }, 'report-cccccccc');
    expect(ENERGY_NO_GPS_REPORT).toBe(0);
    expect(await balanceOf(energy)).toBe(ENERGY_WELCOME - 3 + ENERGY_GPS_REPORT);
    advance(DAY);
    await crowd.reports.post(REPORT, 'report-dddddddd');
    expect(await balanceOf(energy)).toBe(ENERGY_WALLET_CAP);
  });

  it('waiting refills: the first refill comes 12 hours after the welcome, not at the first spend', async () => {
    const { energy, spend, advance } = setup();
    await spend(2);
    expect(await balanceOf(energy)).toBe(ENERGY_WELCOME - 2);
    advance(ENERGY_PASSIVE_INTERVAL_H * 3600000);
    expect(await balanceOf(energy)).toBe(ENERGY_WELCOME - 2 + ENERGY_PASSIVE_AMOUNT);
  });

  it('tracking spends from the wallet, and a GPS relay pays for more', async () => {
    const { energy, crowd, spend } = setup();
    await spend(5);
    expect(await energy.startTracking('track-bbbbbbbb')).toEqual({ ok: false, reason: 'not_enough_energy' });
    await crowd.reports.post(REPORT, 'report-aaaaaaaa');
    expect((await energy.startTracking('track-cccccccc')).ok).toBe(true);
    expect(await balanceOf(energy)).toBe(ENERGY_WELCOME + ENERGY_GPS_REPORT - 6 * ENERGY_TRACKING_COST);
  });

  it('own demo reports show in the feed for an hour; no handle, no report', async () => {
    const { crowd, advance } = setup();
    await crowd.reports.post(REPORT, 'report-aaaaaaaa');
    const posts = await crowd.reports.recent();
    expect(posts).toHaveLength(1);
    expect(posts?.[0]).toMatchObject({ routeCode: 'R4', phrase: 'few_seats', seatTier: 'amber', vehicleId: 'R4-01', stopCode: 'MCA', username: 'demo_me', withGps: true, demo: true });
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
  postReport: async () => ({ postId: '41' }),
  feed: async () => [
    {
      id: 5,
      author_username: 'juan',
      route_id: 'R4',
      vehicle_id: 'R4-02',
      phrase: 'full',
      seat_tier: 'red',
      stop_code: 'IMA',
      author_trusted: true,
      with_gps: false,
      created_at: new Date(T0).toISOString(),
    },
  ],
  flagPost: async () => ({ hidden: false }),
  ...over,
});

describe('the live check-ins and reports', () => {
  it('signed out: no counts or feed, and both actions ask to sign in', async () => {
    const crowd = createLiveCrowd(port({ signedIn: async () => false }));
    expect(await crowd.checkins.waitingCounts('R4', [])).toBeNull();
    expect(await crowd.checkins.checkIn(['R4'], 'AAA', 'checkin-aaaaaaaa')).toEqual({ ok: false, reason: 'sign_in' });
    expect(await crowd.reports.post(REPORT, 'report-aaaaaaaa')).toEqual({ ok: false, reason: 'sign_in' });
    expect(await crowd.reports.recent()).toBeNull();
  });

  it('maps the server answers: expiry, counts sent as text, feed rows', async () => {
    const crowd = createLiveCrowd(port());
    expect(await crowd.checkins.checkIn(['R4'], 'AAA', 'checkin-aaaaaaaa')).toEqual({ ok: true, expiresAtMs: T0 + CHECKIN_LIFETIME_S * 1000 });
    expect(await crowd.checkins.waitingCounts('R4', [])).toEqual(new Map([['AAA', 2]]));
    expect(await crowd.reports.recent()).toEqual([
      {
        id: '5',
        routeCode: 'R4',
        phrase: 'full',
        seatTier: 'red',
        vehicleId: 'R4-02',
        stopCode: 'IMA',
        trusted: true,
        username: 'juan',
        withGps: false,
        postedMs: T0,
        demo: false,
      },
    ]);
  });

  it('returns the new post id, so the feed can mark the post as their own (EQ-7)', async () => {
    const crowd = createLiveCrowd(port({}));
    expect(await crowd.reports.post(REPORT, 'report-aaaaaaaa')).toEqual({ ok: true, postId: '41' });
  });

  it('maps the function errors; a failed end is ignored', async () => {
    const crowd = createLiveCrowd(
      port({
        checkIn: async () => ({ code: '28000', message: 'not signed in' }),
        postReport: async () => ({ code: 'P0001', message: 'set a username first' }),
        endCheckIn: async () => Promise.reject(new Error('offline')),
      }),
    );
    expect(await crowd.checkins.checkIn(['R4'], 'AAA', 'checkin-aaaaaaaa')).toEqual({ ok: false, reason: 'sign_in' });
    expect(await crowd.reports.post(REPORT, 'report-aaaaaaaa')).toEqual({ ok: false, reason: 'no_username' });
    await expect(crowd.checkins.end()).resolves.toBeUndefined();
    const failing = createLiveCrowd(port({ postReport: async () => ({ code: '42501', message: 'sign in to take part' }) }));
    expect(await failing.reports.post(REPORT, 'report-aaaaaaaa')).toEqual({ ok: false, reason: 'error', message: 'sign in to take part' });
  });

  it('CA1.1: a check-in the wallet cannot pay comes back as not_enough_energy', async () => {
    const crowd = createLiveCrowd(port({ checkIn: async () => ({ code: 'P0001', message: 'not enough energy' }) }));
    expect(await crowd.checkins.checkIn(['R4', 'R3'], 'RCA', 'checkin-aaaaaaaa')).toEqual({ ok: false, reason: 'not_enough_energy' });
    // P0001 is also any raise without a code: only the wallet's message reads as not enough Energy
    const other = createLiveCrowd(port({ checkIn: async () => ({ code: 'P0001', message: 'something else' }) }));
    expect(await other.checkins.checkIn(['R4'], 'RCA', 'checkin-aaaaaaaa')).toEqual({ ok: false, reason: 'error', message: 'something else' });
  });

  it('N1: flags by numeric id, reports when the post got hidden, and maps the errors', async () => {
    const sent: number[] = [];
    const crowd = createLiveCrowd(
      port({
        flagPost: async (id) => {
          sent.push(id);
          return { hidden: id === 9 };
        },
      }),
    );
    expect(await crowd.reports.flag('5')).toEqual({ ok: true, hidden: false });
    expect(await crowd.reports.flag('9')).toEqual({ ok: true, hidden: true });
    expect(sent).toEqual([5, 9]);
    // A demo id never reaches the server
    expect(await crowd.reports.flag('report-aaaaaaaa')).toEqual({ ok: false, reason: 'error' });
    expect(sent).toHaveLength(2);
    expect(await createLiveCrowd(port({ signedIn: async () => false })).reports.flag('5')).toEqual({ ok: false, reason: 'sign_in' });
    const failing = createLiveCrowd(port({ flagPost: async () => ({ code: '42501', message: 'sign in to take part' }) }));
    expect(await failing.reports.flag('5')).toEqual({ ok: false, reason: 'error', message: 'sign in to take part' });
  });

  it('drops a feed row with an unknown phrase and an unknown seat tier', () => {
    const row = {
      id: 1,
      author_username: 'a',
      route_id: 'R4',
      vehicle_id: null,
      phrase: 'full',
      seat_tier: 'purple',
      stop_code: null,
      author_trusted: false,
      with_gps: true,
      created_at: new Date(T0).toISOString(),
    };
    expect(feedPostOf(row)?.seatTier).toBeNull();
    expect(feedPostOf({ ...row, phrase: 'free text' })).toBeNull();
  });
});
