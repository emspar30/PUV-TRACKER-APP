// 2026-11-24 field test: a relaying rider's app was force-stopped and the multicab stayed on other
// phones' live maps. A multicab with no new position is Live up to COVERAGE_LIVE_MAX_AGE_S, Estimated
// up to GHOST_MAX_AGE_S, Stale up to COVERAGE_STALE_MAX_AGE_S, then removed; the database hides the
// same row and closes the relay session after VEHICLE_GONE_S. Fixtures and migration text only.

import * as fs from 'node:fs';
import * as path from 'node:path';

import { createLiveVehicles, type LiveVehiclesPort } from '../../data/live/liveVehicles';
import type { DemoClock } from '../../data/demo/demoVehicles';
import { COVERAGE_LIVE_MAX_AGE_S, COVERAGE_STALE_MAX_AGE_S, GHOST_MAX_AGE_S, LIVE_UI_REFRESH_INTERVAL_S, POSITION_SEND_INTERVAL_S, VEHICLE_GONE_S } from '../config';
import { ageSeconds, coverageOf, isGone } from '../telemetry/coverage';
import { isGhostAge } from '../telemetry/deadReckoning';
import type { LiveRow } from '../telemetry/liveRow';
import type { VehicleSnapshot } from '../telemetry/vehicle';
import { FIXTURE_OUTBOUND, FIXTURE_RETURN, pointAt } from './fixtures/routeFixture';

const LINES = [FIXTURE_OUTBOUND, FIXTURE_RETURN];
const T0 = Date.UTC(2026, 10, 24, 2, 0, 0);
const S = 1000;

type MarkerState = 'live' | 'estimated' | 'stale' | 'removed';
const stateAt = (ageS: number): MarkerState =>
  isGone(0, ageS * S) ? 'removed' : coverageOf(ageS) === 'live' ? 'live' : isGhostAge(ageS) ? 'estimated' : 'stale';

describe('the constants', () => {
  it('Live 60 s, Estimated to 120 s, removed at 10 minutes, on the app and the server alike', () => {
    expect([COVERAGE_LIVE_MAX_AGE_S, GHOST_MAX_AGE_S, COVERAGE_STALE_MAX_AGE_S, VEHICLE_GONE_S]).toEqual([60, 120, 600, 600]);
    // Live lasts two send intervals, so one lost packet does not grey a marker
    expect(COVERAGE_LIVE_MAX_AGE_S).toBe(2 * POSITION_SEND_INTERVAL_S);
  });
});

describe('a multicab with no new position', () => {
  it.each([
    [0, 'live'],
    [COVERAGE_LIVE_MAX_AGE_S - 1, 'live'],
    [COVERAGE_LIVE_MAX_AGE_S, 'estimated'],
    [GHOST_MAX_AGE_S - 1, 'estimated'],
    [GHOST_MAX_AGE_S, 'stale'],
    [COVERAGE_STALE_MAX_AGE_S - 1, 'stale'],
    [COVERAGE_STALE_MAX_AGE_S, 'removed'],
    [3600, 'removed'],
  ] as const)('%i s silent: %s', (ageS, expected) => {
    expect(stateAt(ageS)).toBe(expected);
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
  return { clock, advance, now: () => now };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

const row = (atMs: number, km: number): LiveRow => ({
  vehicle_id: 'T1-RELAY',
  ...pointAt(km),
  speed_kmh: 20,
  heading_deg: 90,
  seats_taken: 4,
  packet_ts: new Date(atMs).toISOString(),
});

describe('the relaying app is killed mid-relay', () => {
  it('the multicab turns Estimated, then Stale, then leaves every other map, and a reload does not bring it back', async () => {
    const { clock, advance, now } = manualClock(T0);
    // The server still returns the last row on a reload (the RLS age filter is checked separately)
    const rows: LiveRow[] = [row(T0, 1)];
    const watchers: ((row: LiveRow) => void)[] = [];
    const port: LiveVehiclesPort = {
      load: async () => ({ vehicleIds: ['T1-RELAY'], rows }),
      watch: (_ids, onRow) => {
        watchers.push(onRow);
        return () => undefined;
      },
    };
    let seen: readonly VehicleSnapshot[] = [];
    const stop = createLiveVehicles(port, LINES, clock).subscribe('T1', (vehicles) => (seen = vehicles));
    await flush();

    // Relaying: a position every 5 s for a minute
    for (let s = 5; s <= 60; s += 5) {
      advance(5 * S);
      const next = row(now(), 1 + s / 180);
      rows[0] = next;
      watchers[0](next);
    }
    const lastMs = now();
    const state = () => (seen.length === 0 ? 'removed' : stateAt(ageSeconds(seen[0].lastPacketMs, now())));
    expect(state()).toBe('live');

    // Force-stopped: nothing more arrives. The map ticks every LIVE_UI_REFRESH_INTERVAL_S.
    const at = async (ageS: number) => {
      advance(lastMs + ageS * S - now());
      await flush();
      return state();
    };
    expect(await at(COVERAGE_LIVE_MAX_AGE_S - LIVE_UI_REFRESH_INTERVAL_S)).toBe('live');
    expect(await at(COVERAGE_LIVE_MAX_AGE_S + LIVE_UI_REFRESH_INTERVAL_S)).toBe('estimated');
    expect(await at(GHOST_MAX_AGE_S + LIVE_UI_REFRESH_INTERVAL_S)).toBe('stale');
    expect(await at(COVERAGE_STALE_MAX_AGE_S - LIVE_UI_REFRESH_INTERVAL_S)).toBe('stale');
    expect(await at(COVERAGE_STALE_MAX_AGE_S + LIVE_UI_REFRESH_INTERVAL_S)).toBe('removed');
    // Later reloads still return the old row: it stays removed
    expect(await at(COVERAGE_STALE_MAX_AGE_S + 300)).toBe('removed');

    // The relay starts again: the multicab is back, Live
    const back = row(now(), 2);
    watchers[0](back);
    expect(state()).toBe('live');
    stop();
  });
});

describe('the server closes the relay after the same timeout', () => {
  const ROOT = path.join(__dirname, '..', '..', '..');
  const migration = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '20261124000000_vehicle_gone.sql'), 'utf8').replace(/--.*$/gm, '').toLowerCase();
  const cron = fs.readFileSync(path.join(ROOT, 'supabase', 'cron', 'retention.sql'), 'utf8').toLowerCase();

  it('app_config.vehicle_gone_s defaults to VEHICLE_GONE_S', () => {
    expect(migration).toContain(`vehicle_gone_s smallint not null default ${VEHICLE_GONE_S}`);
  });

  it('the live map no longer reads a row older than vehicle_gone_s', () => {
    expect(migration).toContain('alter policy "telemetry_latest: live map users read active vehicles" on public.telemetry_latest');
    expect(migration).toContain('telemetry_latest.packet_ts > now() - make_interval(secs => (select c.vehicle_gone_s from public.app_config c))');
    // Night Mode and the active rule stay
    expect(migration).toContain('and not public.is_night(now())');
    expect(migration).toContain('(select public.may_use_live_map())');
  });

  it('relay sessions silent for vehicle_gone_s are closed, by a heartbeat and by the sweep job', () => {
    expect(migration).toContain('r.last_seen < now() - gone');
    expect(migration).not.toContain('liveness * 10');
    expect(migration).toContain('create function public.relay_sessions_sweep()');
    expect(migration).toContain('revoke execute on function public.relay_sessions_sweep() from public, anon, authenticated');
    expect(cron).toContain("cron.schedule('relay-sessions-sweep', '* * * * *'");
    expect(cron).toContain('select public.relay_sessions_sweep()');
  });

  it('the heartbeat keeps its checks and the Primary handoff', () => {
    expect(migration).toContain("pg_advisory_xact_lock(hashtext('relay_baton:' || relay_heartbeat.vehicle))");
    expect(migration).toContain('if not (public.may_participate() and public.may_use_live_map()) then');
    expect(migration).toContain("r.role = 'primary' and r.last_seen > now() - liveness");
    expect(migration).toContain('set search_path = \'\'');
  });
});
