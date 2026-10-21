// End-to-end flows run headless: each one chains the real modules a screen uses, from what the user
// (or the phone) does to what the app ends up showing or sending. No component is drawn; the screens
// call these same functions (the tabs gate, Ask Tunton and My Rides, the Map tab's nudge, the relay's
// buffer).
//   AU1  a signed-in phone, offline, with an expired access token, still opens the app
//   CA1  a Bisaya question to an answer, then "Open in My Rides" plans the same trip
//   CF1  a silent multicab drawn Estimated; R14 empty in the demo, so the nudge shows
//   T1   positions kept through a dead zone, then sent in order once the network is back
//   CA1.1 plain-English questions, partial names and typos answered at once; the conversation kept

import { DatabaseSync } from 'node:sqlite';

import { createDemoVehicles, type DemoClock } from '@/data/demo/demoVehicles';
import type { Db, SqlParam } from '@/data/db/migrate';
import { SCHEMA_SQL } from '@/data/db/schema';
import { countOutbox, drainOutbox, pushOutbox, readOutbox } from '@/data/db/telemetryOutbox';
import { getSeedRouteData } from '@/data/routeSource';
import { MAP_PLACES } from '@/data/seed/places';
import { replyOf } from '@/features/assistant/reply';
import { pointParam, tripParams } from '@/navigation/tripParams';
import { answer, routeStatus, type AssistantContext } from '@/shared/assistant/answer';
import { parseQuery } from '@/shared/assistant/intent';
import { entryRoute } from '@/shared/auth/gate';
import { COVERAGE_LIVE_MAX_AGE_S, DEMO_SEED, FARE_REGULAR_MULTIPLIER, OFFLINE_BUFFER_SIZE, TELEMETRY_RETRY_MIN_S } from '@/shared/config';
import { haversineMeters } from '@/shared/geo/haversine';
import type { SearchablePlace } from '@/shared/routing/placeSearch';
import { planOptions } from '@/shared/routing/plan';
import { withReturnLegs } from '@/shared/routing/loop';
import { ageSeconds, nudgeShown } from '@/shared/telemetry/coverage';
import { displayPosition, isGhostAge } from '@/shared/telemetry/deadReckoning';
import { retryDelayS } from '@/shared/telemetry/outbox';
import { encodeBatch, type TelemetryPacket } from '@/shared/telemetry/packet';
import { nextPacket, type BroadcastFix } from '@/shared/telemetry/sendRule';
import type { VehicleSnapshot } from '@/shared/telemetry/vehicle';

import { validateBatch } from '../../supabase/functions/_shared/packet';

// --- AU1: the auth library as the phone has it ---------------------------------------------------

type AuthCallback = (event: string, session: { user: { email?: string } } | null) => void;
let mockStored: { email: string | null } | null = null;
let mockGetSession: () => Promise<{ data: { session: { user: { email?: string } } | null } }>;
let mockListener: AuthCallback | null = null;

jest.mock('@/services/supabase', () => ({
  isSupabaseConfigured: () => true,
  readStoredSession: () => mockStored,
  getSupabase: () => ({
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: (callback: AuthCallback) => {
        mockListener = callback;
        return { data: { subscription: { unsubscribe: () => undefined } } };
      },
    },
    rpc: () => Promise.reject(new Error('Network request failed')),
  }),
}));
const mockSaved = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItemSync: (key: string) => mockSaved.get(key) ?? null,
    setItemSync: (key: string, value: string) => mockSaved.set(key, value),
    removeItemSync: (key: string) => mockSaved.delete(key),
  },
}));
jest.mock('@/state/usernameStore', () => ({ syncUsername: () => Promise.reject(new Error('Network request failed')) }));

const flush = () => new Promise((resolve) => setImmediate(resolve));

function bootApp() {
  let loaded: typeof import('@/state/sessionStore') | undefined;
  jest.isolateModules(() => {
    loaded = jest.requireActual('@/state/sessionStore') as typeof import('@/state/sessionStore');
  });
  if (!loaded) throw new Error('not loaded');
  loaded.startSessionTracking();
  return loaded.useSessionStore;
}

describe('AU1 flow: launch, offline, expired token', () => {
  beforeEach(() => {
    mockStored = null;
    mockListener = null;
  });

  it('a signed-in phone opens straight to the app, then sign-out sends it to sign-in', async () => {
    // Signed in yesterday; airplane mode; the access token expired an hour ago, so the library
    // cannot refresh it and reports no session on both paths, but keeps the saved one
    mockStored = { email: 'rider@example.com' };
    mockGetSession = () => Promise.resolve({ data: { session: null } });
    const session = bootApp();
    const route = () => entryRoute({ onboarded: true, status: session.getState().status, dev: false });
    // At once, before the library answers: no flash of sign-in
    expect(route()).toBe('app');
    await flush();
    mockListener?.('INITIAL_SESSION', null);
    await flush();
    expect(route()).toBe('app');
    expect(session.getState().email).toBe('rider@example.com');
    // Signing out from the Menu
    mockStored = null;
    mockListener?.('SIGNED_OUT', null);
    expect(route()).toBe('signIn');
  });

  it('a fresh install sees the introduction, then must sign in', async () => {
    mockGetSession = () => Promise.resolve({ data: { session: null } });
    const session = bootApp();
    await flush();
    expect(entryRoute({ onboarded: false, status: session.getState().status, dev: false })).toBe('onboarding');
    expect(entryRoute({ onboarded: true, status: session.getState().status, dev: false })).toBe('signIn');
    // Signs in on the welcome step
    mockListener?.('SIGNED_IN', { user: { email: 'new@example.com' } });
    expect(entryRoute({ onboarded: true, status: session.getState().status, dev: false })).toBe('app');
  });
});

// --- Shared data, as the phone has it -------------------------------------------------------------

const data = getSeedRouteData();
const LOOPED = withReturnLegs(data.lines);
const PLACES: SearchablePlace[] = [
  ...data.stops.map((stop) => ({ id: `stop-${stop.code}`, title: stop.name, code: stop.code, lat: stop.lat, lon: stop.lon, kind: 'stop' as const })),
  ...MAP_PLACES.map(([title, category, group, lat, lon, near], index) => ({ id: `map-${index}`, title, lat, lon, kind: group, category, near })),
];
const NOW = 1_790_000_000_000;
const MS = 1000;
const fixedClock = (now: () => number): DemoClock => ({ now, setInterval: () => 0, clearInterval: () => undefined });

function demoVehicles(routeCode: string, nowMs: number): readonly VehicleSnapshot[] {
  let seen: readonly VehicleSnapshot[] = [];
  createDemoVehicles(data.lines, data.stops, { seed: DEMO_SEED, clock: fixedClock(() => nowMs) }).subscribe(routeCode, (vehicles) => {
    seen = vehicles;
  });
  return seen;
}

const libertad = data.stops.find((stop) => stop.code === 'LIB');
const context = (overrides: Partial<AssistantContext> = {}): AssistantContext => ({
  lines: data.lines,
  stops: data.stops,
  places: PLACES,
  position: libertad ? { lat: libertad.lat, lon: libertad.lon, title: 'You' } : null,
  fareMultiplier: FARE_REGULAR_MULTIPLIER,
  live: { access: 'open', night: false, vehicles: [], nowMs: NOW },
  ...overrides,
});

// --- CA1 ---------------------------------------------------------------------------------------------

describe('CA1 flow: ask, answer, open in My Rides', () => {
  it('a Bisaya fare question becomes a trip that My Rides plans the same way', () => {
    const intent = parseQuery('Pila plete gikan Libertad paingon CSU?');
    const reply = answer(intent, context());
    if (reply.kind !== 'trip') throw new Error(`expected a trip, got ${reply.kind}`);
    const words = replyOf(reply, intent, 'regular');
    // Fare first, as asked
    expect(words.lines[0]).toContain(`₱`);
    const chip = words.chips.find((candidate) => candidate.action.kind === 'openTrip');
    if (!chip || chip.action.kind !== 'openTrip') throw new Error('no Open in My Rides chip');

    // The chip's navigation parameters, read back as My Rides reads them
    const params = tripParams(chip.action, NOW);
    const to = pointParam(params.toLat, params.toLon, params.toTitle);
    const from = pointParam(params.fromLat, params.fromLon, params.fromTitle);
    expect(to).toEqual({ lat: reply.to.lat, lon: reply.to.lon, label: reply.to.title });
    expect(from).toEqual({ lat: reply.from.lat, lon: reply.from.lon, label: reply.from.title });
    expect(params.route).toBe(reply.routeCode);
    if (!to || !from) throw new Error('points lost');

    // My Rides plans from those points and lands on the route the assistant named
    const options = planOptions(data.lines, from, to);
    expect(options.map((option) => option.legs[1].routeCode)).toContain(reply.routeCode);
    expect(options[0]?.legs[1].routeCode).toBe(reply.routeCode);
  });

  it('no start named: My Rides keeps the user position (no from parameters)', () => {
    const intent = parseQuery('pilay plete padung CSU');
    const reply = answer(intent, context());
    if (reply.kind !== 'trip') throw new Error(`expected a trip, got ${reply.kind}`);
    const chip = replyOf(reply, intent, 'regular').chips.find((candidate) => candidate.action.kind === 'openTrip');
    if (!chip || chip.action.kind !== 'openTrip') throw new Error('no chip');
    const params = tripParams(chip.action, NOW);
    expect(params.fromLat).toBeUndefined();
    expect(pointParam(params.toLat, params.toLon, params.toTitle)).not.toBeNull();
  });

  it('"naay R4 gadagan?" against the demo multicabs says how many are Live', () => {
    const vehicles = demoVehicles('R4', NOW);
    expect(vehicles.length).toBeGreaterThan(0);
    const intent = parseQuery('naay R4 gadagan?');
    const reply = answer(intent, context({ live: { access: 'open', night: false, vehicles, nowMs: NOW } }));
    expect(reply).toMatchObject({ kind: 'status', routeCode: 'R4' });
    if (reply.kind !== 'status') throw new Error('no status');
    // One demo multicab per route goes quiet on purpose (so Estimated can be seen); Live is by age
    const visible = vehicles.filter((vehicle) => !vehicle.hidden);
    expect(reply.live).toBe(visible.filter((vehicle) => ageSeconds(vehicle.lastPacketMs, NOW) < COVERAGE_LIVE_MAX_AGE_S).length);
    expect(reply.live + reply.estimated + reply.stale).toBeLessThanOrEqual(visible.length);
    expect(reply.live).toBeGreaterThan(0);
    expect(replyOf(reply, intent, 'regular').chips[0]?.action).toEqual({ kind: 'openMap', route: 'R4' });
  });

  it('CA1.1: a plain-English question with a partial name answers at once and says which place', () => {
    const intent = parseQuery('what route should I board for robinsons?');
    const reply = answer(intent, context());
    if (reply.kind !== 'trip') throw new Error(`expected a trip, got ${reply.kind}`);
    const words = replyOf(reply, intent, 'regular');
    expect(words.lines[0]).toBe(`Showing results for ${reply.to.title}:`);
    expect(words.lines[1]).toMatch(/^Ride R\d+/);
    expect(words.chips.some((chip) => chip.action.kind === 'openTrip')).toBe(true);
    // The other Robinsons places that fit as well, as "Did you mean" chips that ask again
    const runnerUp = words.chips.find((chip) => chip.label.startsWith('Did you mean'));
    if (!runnerUp || runnerUp.action.kind !== 'ask') throw new Error('no runner-up chip');
    const again = answer(runnerUp.action.intent, context());
    expect(['trip', 'tripFail']).toContain(again.kind);
    if (again.kind === 'trip' || again.kind === 'tripFail') {
      expect(again.to.title).toBe(runnerUp.action.question);
      expect(replyOf(again, runnerUp.action.intent, 'regular').lines[0]).not.toMatch(/^Showing results/);
    }
  });

  it('CA1.1: a typo is corrected and said so', () => {
    const intent = parseQuery('pila plete paingon ampayun');
    const reply = answer(intent, context());
    if (reply.kind !== 'trip') throw new Error(`expected a trip, got ${reply.kind}`);
    expect(replyOf(reply, intent, 'regular').lines[0]).toBe('Did you mean Ampayon? Showing results for it ("ampayun" not found):');
  });
});

// --- CA1.1: the conversation survives closing the screen and a restart -------------------------------

describe('CA1.1 flow: the conversation is kept for an hour', () => {
  it('kept across a restart, gone after an hour, gone after Reset app', () => {
    const load = () => {
      let store: typeof import('@/state/assistantStore').useAssistantStore | undefined;
      jest.isolateModules(() => {
        store = (jest.requireActual('@/state/assistantStore') as typeof import('@/state/assistantStore')).useAssistantStore;
      });
      if (!store) throw new Error('not loaded');
      return store;
    };
    const first = load();
    first.setState({ entries: [] });
    first.getState().ask('what route should I board for robinsons?', parseQuery('what route should I board for robinsons?'), NOW);
    // Closing the sheet, going to My Rides and back, or restarting the app: the same questions
    const again = load();
    expect(again.getState().entries.map((entry) => entry.question)).toEqual(['what route should I board for robinsons?']);
    expect(again.getState().entries[0].intent).toEqual(parseQuery('what route should I board for robinsons?'));
    // Still there 59 minutes later, gone after an hour
    again.getState().prune(NOW + 59 * 60_000);
    expect(again.getState().entries).toHaveLength(1);
    again.getState().prune(NOW + 61 * 60_000);
    expect(again.getState().entries).toEqual([]);
    expect(load().getState().entries).toEqual([]);
    // Reset app (and Delete account, which runs it) clears it too
    again.getState().ask('Is R4 running?', parseQuery('Is R4 running?'), NOW);
    again.setState(again.getInitialState(), true);
    expect(load().getState().entries).toEqual([]);
  });
});

// --- CF1 ---------------------------------------------------------------------------------------------

describe('CF1 flow: Estimated marker and the coverage nudge', () => {
  it('a multicab silent for 2 minutes is drawn Estimated, moved along its line, and counted so', () => {
    const moving = demoVehicles('R4', NOW).find((vehicle) => !vehicle.hidden && !vehicle.layover && vehicle.speedKmh > 5);
    if (!moving) throw new Error('no moving demo multicab');
    const later = moving.lastPacketMs + 120 * MS;
    expect(isGhostAge(ageSeconds(moving.lastPacketMs, later))).toBe(true);
    const line = LOOPED.find((candidate) => candidate.id === moving.lineId);
    const drawn = displayPosition(moving, line?.coordinates, later);
    expect(drawn.ghost).toBe(true);
    expect(haversineMeters(drawn, moving)).toBeGreaterThan(100);
    expect(routeStatus([moving], 'R4', later)).toMatchObject({ live: 0, estimated: 1, stale: 0 });
    const reply = answer(parseQuery('Is R4 running?'), context({ live: { access: 'open', night: false, vehicles: [moving], nowMs: later } }));
    expect(reply).toMatchObject({ kind: 'status', live: 0, estimated: 1 });
  });

  it('R14 has no demo multicab, so the nudge shows by day; a Live route has none', () => {
    const r14 = demoVehicles('R14', NOW);
    expect(r14).toEqual([]);
    const base = { routePicked: true, nowMs: NOW, night: false, offTeam: false };
    expect(nudgeShown({ ...base, lastPacketsMs: r14.map((vehicle) => vehicle.lastPacketMs) })).toBe(true);
    expect(nudgeShown({ ...base, lastPacketsMs: r14.map((vehicle) => vehicle.lastPacketMs), night: true })).toBe(false);
    expect(nudgeShown({ ...base, lastPacketsMs: r14.map((vehicle) => vehicle.lastPacketMs), offTeam: true })).toBe(false);
    expect(nudgeShown({ ...base, lastPacketsMs: [], nowMs: 0 })).toBe(false);
    const r4 = demoVehicles('R4', NOW).map((vehicle) => vehicle.lastPacketMs);
    expect(nudgeShown({ ...base, lastPacketsMs: r4 })).toBe(false);
    // The same multicabs gone quiet past the Live window bring it back
    expect(nudgeShown({ ...base, lastPacketsMs: r4, nowMs: NOW + (COVERAGE_LIVE_MAX_AGE_S + 1) * MS + Math.max(...r4.map((ms) => NOW - ms)) })).toBe(true);
  });
});

// --- T1 ----------------------------------------------------------------------------------------------

function openMemoryDb(): Db {
  const raw = new DatabaseSync(':memory:');
  return {
    execAsync: async (sql) => {
      raw.exec(sql);
    },
    runAsync: async (sql, params: SqlParam[]) => raw.prepare(sql).run(...params),
    getFirstAsync: async <T>(sql: string, params: SqlParam[]) => (raw.prepare(sql).get(...params) as T | undefined) ?? null,
    getAllAsync: async <T>(sql: string, params: SqlParam[]) => raw.prepare(sql).all(...params) as T[],
    withTransactionAsync: async (task) => task(),
  };
}

// A relay riding north, one fix every 35 s (the send rule's 30 s), 120 m apart
const ride = (count: number): BroadcastFix[] =>
  Array.from({ length: count }, (_v, i) => ({
    lat: 8.9474 + i * 0.00108,
    lon: 125.5414,
    accuracyM: 8,
    headingDeg: 0,
    speedMps: 4,
    timestampMs: NOW + i * 35 * MS,
    mocked: false,
  }));

describe('T1 flow: a dead zone, then the network comes back', () => {
  it('keeps every position, retries, then the server takes them in order in one batch', async () => {
    const db = openMemoryDb();
    await db.execAsync(SCHEMA_SQL);
    const target = { vehicleId: 'R4-TEST-01', seatTier: 'amber' as const };
    let last: TelemetryPacket | null = null;
    const offline = async () => null;

    for (const fix of ride(6)) {
      const packet = nextPacket(last, fix, target, fix.timestampMs);
      if (!packet) continue;
      last = packet;
      await pushOutbox(db, packet, fix.timestampMs);
      // Each new position tries to send at once; there is no network
      const tried = await drainOutbox(db, offline, () => fix.timestampMs);
      expect(tried).toMatchObject({ retry: true, progressed: false, sentAtMs: null });
    }
    expect(await countOutbox(db)).toBe(6);
    // The relay bar: "6 positions saved", next try in 5 s, then longer
    expect(retryDelayS(1)).toBe(TELEMETRY_RETRY_MIN_S);
    expect(retryDelayS(2)).toBeGreaterThan(retryDelayS(1));

    // Back online: the server checks the batch as the ingest function does
    const received: TelemetryPacket[] = [];
    const server = async (vehicleId: string, points: readonly TelemetryPacket[]) => {
      // The body the phone sends (services/telemetry), checked as the ingest function checks it
      const checked = validateBatch(JSON.parse(encodeBatch(vehicleId, points)), points[points.length - 1].ts + 1);
      if (!checked.ok) return 400;
      received.push(...points);
      return 200;
    };
    const back = await drainOutbox(db, server, () => NOW + 300 * MS);
    expect(back).toEqual({ progressed: true, sentAtMs: NOW + 300 * MS, retry: false, remaining: 0 });
    expect(received.map((p) => p.ts)).toEqual([...received.map((p) => p.ts)].sort((a, b) => a - b));
    expect(received).toHaveLength(6);
    expect(await readOutbox(db)).toEqual([]);
  });

  it('a batch the server will never take is dropped, not retried forever; a long dead zone keeps the newest', async () => {
    const db = openMemoryDb();
    await db.execAsync(SCHEMA_SQL);
    const target = { vehicleId: 'R4-TEST-01', seatTier: 'green' as const };
    let last: TelemetryPacket | null = null;
    for (const fix of ride(OFFLINE_BUFFER_SIZE + 5)) {
      const packet = nextPacket(last, fix, target, fix.timestampMs);
      if (!packet) continue;
      last = packet;
      await pushOutbox(db, packet, fix.timestampMs);
    }
    const kept = await readOutbox(db);
    expect(kept).toHaveLength(OFFLINE_BUFFER_SIZE);
    expect(kept[0].packet.ts).toBeGreaterThan(NOW / MS);
    const refused = await drainOutbox(db, async () => 400, () => NOW);
    expect(refused).toMatchObject({ progressed: true, retry: false, sentAtMs: null, remaining: 0 });
  });
});
