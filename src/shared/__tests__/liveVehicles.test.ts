// L1: telemetry_latest rows become the same snapshots the Live tab draws for demo vehicles, on the
// line that matches their heading, and the live repository keeps them current. Fixtures only.

import { createLiveVehicles, type LiveVehiclesPort } from '../../data/live/liveVehicles';
import { selectRepositories } from '../../data/repositories/select';
import type { DemoClock } from '../../data/demo/demoVehicles';
import { LIVE_RELOAD_INTERVAL_S, LIVE_SPEED_HISTORY_S, LIVE_UI_REFRESH_INTERVAL_S, STATIONARY_DURATION_S } from '../config';
import { headingGapDeg, matchLine, rowToSnapshot, type LiveRow } from '../telemetry/liveRow';
import { isStopped } from '../telemetry/stopped';
import type { VehicleSnapshot } from '../telemetry/vehicle';
import { FIXTURE_OUTBOUND, FIXTURE_RETURN, FIXTURE_STOPS, pointAt } from './fixtures/routeFixture';

const LINES = [FIXTURE_OUTBOUND, FIXTURE_RETURN];
const T0 = Date.UTC(2026, 9, 5, 2, 0, 0);
const EAST = 90;
const WEST = 270;
const S = 1000;

const row = (over: Partial<LiveRow> & { atMs?: number } = {}): LiveRow => {
  const { atMs = T0, ...rest } = over;
  return {
    vehicle_id: 'T1-TEST-01',
    ...pointAt(3),
    speed_kmh: 20,
    heading_deg: EAST,
    seats_taken: 4,
    packet_ts: new Date(atMs).toISOString(),
    ...rest,
  };
};

describe('matching a position to a route line', () => {
  it('measures the gap between two headings across north', () => {
    expect(headingGapDeg(350, 10)).toBe(20);
    expect(headingGapDeg(EAST, WEST)).toBe(WEST - EAST);
  });

  it('picks the direction the vehicle is heading on a shared two-way street', () => {
    expect(matchLine(LINES, 'T1', pointAt(3), EAST)?.id).toBe('T1-OUT');
    expect(matchLine(LINES, 'T1', pointAt(3), WEST)?.id).toBe('T1-RET');
  });

  it('has no line for a route with no stored lines', () => {
    expect(matchLine(LINES, 'R9', pointAt(3), EAST)).toBeNull();
  });
});

describe('a row as a snapshot', () => {
  it('copies the position, speed, seats and packet time; never demo', () => {
    const snapshot = rowToSnapshot(row(), 'T1', LINES)!;
    expect(snapshot).toMatchObject({ id: 'T1-TEST-01', routeCode: 'T1', lineId: 'T1-OUT', speedKmh: 20, seatsTaken: 4, lastPacketMs: T0, demo: false });
  });

  it('keeps earlier speeds for the stopped check, and drops those older than the history', () => {
    let snapshot: VehicleSnapshot | undefined;
    for (let s = 0; s <= STATIONARY_DURATION_S; s += 5) {
      snapshot = rowToSnapshot(row({ atMs: T0 + s * S, speed_kmh: 0 }), 'T1', LINES, snapshot)!;
    }
    expect(isStopped(snapshot!.recentSpeeds, T0 + STATIONARY_DURATION_S * S)).toBe(true);
    const later = rowToSnapshot(row({ atMs: T0 + (LIVE_SPEED_HISTORY_S + 1) * S * 2 }), 'T1', LINES, snapshot)!;
    expect(later.recentSpeeds).toHaveLength(1);
  });

  it('carries the server verified flag; a row without it counts as unverified (PRD 0.7)', () => {
    expect(rowToSnapshot(row(), 'T1', LINES)!.verified).toBe(false);
    expect(rowToSnapshot({ ...row(), verified: false }, 'T1', LINES)!.verified).toBe(false);
    expect(rowToSnapshot({ ...row(), verified: true }, 'T1', LINES)!.verified).toBe(true);
  });

  it('refuses a row with an unreadable time', () => {
    expect(rowToSnapshot({ ...row(), packet_ts: 'not a time' }, 'T1', LINES)).toBeNull();
  });
});

// A clock the test moves by hand
function manualClock(start: number) {
  let now = start;
  const timers: { callback: () => void; ms: number; next: number; id: number }[] = [];
  let nextId = 0;
  const clock: DemoClock = {
    now: () => now,
    setInterval: (callback, ms) => {
      nextId += 1;
      timers.push({ callback, ms, next: now + ms, id: nextId });
      return nextId;
    },
    clearInterval: (handle) => {
      const index = timers.findIndex((timer) => timer.id === handle);
      if (index >= 0) timers.splice(index, 1);
    },
  };
  const advance = (ms: number) => {
    now += ms;
    for (const timer of [...timers]) {
      while (timer.next <= now) {
        timer.next += timer.ms;
        timer.callback();
      }
    }
  };
  return { clock, advance, timers };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

function fakePort(rows: LiveRow[], vehicleIds = ['T1-TEST-01']) {
  const state = { rows, vehicleIds, loads: 0, fail: false, watchers: [] as ((row: LiveRow) => void)[], unwatched: 0 };
  const port: LiveVehiclesPort = {
    load: async () => {
      state.loads += 1;
      if (state.fail) throw new Error('offline');
      return { vehicleIds: state.vehicleIds, rows: state.rows };
    },
    watch: (_ids, onRow) => {
      state.watchers.push(onRow);
      return () => {
        state.unwatched += 1;
      };
    },
  };
  return { port, state };
}

describe('the live vehicles repository', () => {
  it('starts empty ("No data"), then shows the loaded rows', async () => {
    const { clock } = manualClock(T0);
    const { port } = fakePort([row()]);
    const seen: (readonly VehicleSnapshot[])[] = [];
    const stop = createLiveVehicles(port, LINES, clock).subscribe('T1', (vehicles) => seen.push(vehicles));
    expect(seen[0]).toEqual([]);
    await flush();
    expect(seen.at(-1)?.map((vehicle) => vehicle.id)).toEqual(['T1-TEST-01']);
    stop();
  });

  it('applies a Realtime change, and ignores an older position', async () => {
    const { clock } = manualClock(T0);
    const { port, state } = fakePort([row()]);
    const seen: (readonly VehicleSnapshot[])[] = [];
    const stop = createLiveVehicles(port, LINES, clock).subscribe('T1', (vehicles) => seen.push(vehicles));
    await flush();
    state.watchers[0](row({ atMs: T0 + 5 * S, ...pointAt(3.1) }));
    expect(seen.at(-1)?.[0].lastPacketMs).toBe(T0 + 5 * S);
    state.watchers[0](row({ atMs: T0 - 5 * S }));
    expect(seen.at(-1)?.[0].lastPacketMs).toBe(T0 + 5 * S);
    stop();
  });

  it('re-emits between packets so ages move on, and reloads in case a change was missed', async () => {
    const { clock, advance } = manualClock(T0);
    const { port, state } = fakePort([row()]);
    let calls = 0;
    const stop = createLiveVehicles(port, LINES, clock).subscribe('T1', () => (calls += 1));
    await flush();
    const before = calls;
    advance(LIVE_UI_REFRESH_INTERVAL_S * S);
    expect(calls).toBe(before + 1);
    advance(LIVE_RELOAD_INTERVAL_S * S);
    await flush();
    expect(state.loads).toBe(2);
    stop();
  });

  it('keeps the known vehicles when a reload fails, and drops a vehicle no longer active', async () => {
    const { clock, advance } = manualClock(T0);
    const { port, state } = fakePort([row(), row({ vehicle_id: 'T1-TEST-02' })], ['T1-TEST-01', 'T1-TEST-02']);
    const seen: (readonly VehicleSnapshot[])[] = [];
    const stop = createLiveVehicles(port, LINES, clock).subscribe('T1', (vehicles) => seen.push(vehicles));
    await flush();
    state.fail = true;
    advance(LIVE_RELOAD_INTERVAL_S * S);
    await flush();
    expect(seen.at(-1)).toHaveLength(2);
    state.fail = false;
    state.vehicleIds = ['T1-TEST-01'];
    state.rows = [row()];
    advance(LIVE_RELOAD_INTERVAL_S * S);
    await flush();
    expect(seen.at(-1)?.map((vehicle) => vehicle.id)).toEqual(['T1-TEST-01']);
    expect(state.watchers).toHaveLength(2);
    stop();
  });

  it('stops its timers and the Realtime channel when unsubscribed', async () => {
    const { clock, timers } = manualClock(T0);
    const { port, state } = fakePort([row()]);
    const stop = createLiveVehicles(port, LINES, clock).subscribe('T1', () => undefined);
    await flush();
    stop();
    expect(timers).toHaveLength(0);
    expect(state.unwatched).toBe(1);
  });
});

describe('choosing the repository', () => {
  const live = createLiveVehicles(fakePort([]).port, LINES, manualClock(T0).clock);
  const input = { seed: 1, lines: LINES, stops: FIXTURE_STOPS };

  it('uses the database with Demo data off, and Demo with it on', () => {
    expect(selectRepositories({ ...input, demo: false, live }).vehicles.source).toBe('live');
    expect(selectRepositories({ ...input, demo: true, live }).vehicles.source).toBe('demo');
  });

  it('falls back to "No data" with Demo off and no Supabase set up', () => {
    expect(selectRepositories({ ...input, demo: false, live: null }).vehicles.source).toBe('none');
  });
});
