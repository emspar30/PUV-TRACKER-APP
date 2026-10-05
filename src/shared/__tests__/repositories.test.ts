// AF2: the Demo switch picks the implementation; the header shows one data chip; backlog 68's
// reopen closes the old database handle first. Fixed fixtures only, never the live seed.

import { noLiveCheckins, noLiveReports, noLiveVehicles } from '../../data/repositories/noLiveData';
import { selectCrowd, selectRepositories } from '../../data/repositories/select';
import type { VehicleSnapshot } from '../telemetry/vehicle';
import { headerDataChip } from '../ui/dataChip';
import { reopen, type Holder } from '../util/reopen';
import { FIXTURE_ROUTE_DATA } from './fixtures/routeFixture';

const { lines: LINES, stops: STOPS } = FIXTURE_ROUTE_DATA;

const fakeClock = (nowMs: number) => ({ now: () => nowMs, setInterval: () => 'timer', clearInterval: jest.fn() });

describe('the Demo switch', () => {
  it('off: the stand-ins with no data, so every screen says No data', () => {
    const repos = selectRepositories({ demo: false, seed: 1, lines: LINES, stops: STOPS });
    expect(repos.vehicles).toBe(noLiveVehicles);
    const seen: (readonly VehicleSnapshot[])[] = [];
    repos.vehicles.subscribe('T1', (vehicles) => seen.push(vehicles));
    expect(seen).toEqual([[]]);
  });

  it('on: demo vehicles, every one marked as demo, with a DEMO plate', () => {
    const clock = fakeClock(Date.UTC(2026, 9, 5, 2));
    const repos = selectRepositories({ demo: true, seed: 7, lines: LINES, stops: STOPS, clock });
    expect(repos.vehicles.source).toBe('demo');
    let latest: readonly VehicleSnapshot[] = [];
    const stop = repos.vehicles.subscribe('T1', (vehicles) => {
      latest = vehicles;
    });
    expect(latest.length).toBeGreaterThanOrEqual(2);
    expect(latest.length).toBeLessThanOrEqual(3);
    expect(latest.every((vehicle) => vehicle.demo && /^DEMO \d{2}$/.test(vehicle.label))).toBe(true);
    stop();
    expect(clock.clearInterval).toHaveBeenCalledWith('timer');
  });

  it('check-ins and reports: demo, live, or the stand-ins with no data', async () => {
    const demo = { checkins: noLiveCheckins, reports: noLiveReports };
    const live = { checkins: noLiveCheckins, reports: noLiveReports };
    expect(selectCrowd(true, demo, live)).toBe(demo);
    expect(selectCrowd(false, demo, live)).toBe(live);
    const none = selectCrowd(false, demo, null);
    expect(none.checkins.source).toBe('none');
    expect(await none.checkins.waitingCounts('T1', ['AAA'])).toBeNull();
    expect(await none.reports.recent()).toBeNull();
  });

  it('the stress setting puts 50 markers on the route', () => {
    let count = 0;
    const repos = selectRepositories({ demo: true, seed: 7, lines: LINES, stops: STOPS, stress: true, clock: fakeClock(0) });
    repos.vehicles.subscribe('T1', (vehicles) => {
      count = vehicles.length;
    });
    expect(count).toBe(50);
  });
});

describe('the header data chip', () => {
  it('"Demo" replaces "Sample data" while demo data shows', () => {
    expect(headerDataChip({ demoShowing: true, isPlaceholder: true })).toBe('demo');
    expect(headerDataChip({ demoShowing: false, isPlaceholder: true })).toBe('sample');
    expect(headerDataChip({ demoShowing: false, isPlaceholder: false })).toBeNull();
  });
});

describe('backlog 68: reopening the route database', () => {
  const handle = (log: string[], name: string, failClose = false) => ({
    name,
    closeAsync: async () => {
      log.push(`close ${name}`);
      if (failClose) throw new Error('already closed');
    },
  });

  it('closes the handle opened before, then opens the new one', async () => {
    const log: string[] = [];
    const holder: Holder<ReturnType<typeof handle>> = { current: handle(log, 'old') };
    const next = await reopen(holder, async () => {
      log.push('open new');
      return handle(log, 'new');
    });
    expect(log).toEqual(['close old', 'open new']);
    expect(holder.current).toBe(next);
  });

  it('still opens when the old handle cannot be closed', async () => {
    const log: string[] = [];
    const holder: Holder<ReturnType<typeof handle>> = { current: handle(log, 'broken', true) };
    await expect(reopen(holder, async () => handle(log, 'new'))).resolves.toMatchObject({ name: 'new' });
  });

  it('keeps no stale handle when opening fails', async () => {
    const log: string[] = [];
    const holder: Holder<ReturnType<typeof handle>> = { current: handle(log, 'old') };
    await expect(reopen(holder, async () => Promise.reject(new Error('locked')))).rejects.toThrow('locked');
    expect(holder.current).toBeNull();
  });
});
