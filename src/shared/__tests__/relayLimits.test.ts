// RL1 (PRD 8.1, 8.4; Emjay's D1 to D3, 2026-10-22): how a relay with GPS ends by itself.

import {
  HIGH_TRAFFIC_ZONE_RADIUS_M,
  HIGH_TRAFFIC_ZONES,
  RELAY_ARRIVAL_COUNTDOWN_S,
  RELAY_ARRIVAL_RADIUS_M,
  RELAY_CAP_ANSWER_MIN,
  RELAY_CHECK_S,
  RELAY_IDLE_MIN,
  RELAY_IDLE_RADIUS_M,
  RELAY_IDLE_TERMINAL_MIN,
  RELAY_SESSION_CAP_H,
} from '../config';
import type { LatLon } from '../geo/haversine';
import type { RelayBroadcast } from '../relay/broadcast';
import {
  activeZone,
  arrivalLeftS,
  askedWatch,
  askInMin,
  capDue,
  relayEnd,
  renewedWatch,
  startWatch,
  watchRelay,
  type RelayEnd,
  type RelayWatch,
} from '../relay/limits';

const S = 1000;
const MIN = 60_000;
const HOUR = 3_600_000;
// 10:00 and 17:00 in Manila (UTC+8)
const DAY = Date.UTC(2026, 9, 22, 2, 0, 0);
const RUSH = Date.UTC(2026, 9, 22, 9, 0, 0);
// About 111 m per 0.001 degree of latitude
const DEG_PER_M = 0.001 / 111;
const north = (from: LatLon, m: number) => ({ lat: from.lat + m * DEG_PER_M, lon: from.lon });

const DEST = { code: 'DST', name: 'Destination', lat: 8.99, lon: 125.6 };
// A spot on no zone, no terminal and far from the destination
const ROAD = { lat: 8.93, lon: 125.5 };
// A zone's point (its first point for a stretch of road)
const spot = (id: string, index = 0): LatLon => {
  const found = HIGH_TRAFFIC_ZONES.find((candidate) => candidate.id === id);
  if (!found) throw new Error(id);
  return found.points[index];
};
const BRIDGE = 'RH2-RH3';
const bridgeMiddle = { lat: (spot(BRIDGE, 0).lat + spot(BRIDGE, 1).lat) / 2, lon: (spot(BRIDGE, 0).lon + spot(BRIDGE, 1).lon) / 2 };
const session = (startedMs: number, terminals: LatLon[] = []): RelayBroadcast => ({
  routeCode: 'R4',
  vehicleId: null,
  seatTier: 'green',
  destination: DEST,
  startedMs,
  startPoint: null,
  terminals,
});

// Looks at the position every RELAY_CHECK_S from fromMs to toMs, as the app's clock does; stops at the first end
function run(relay: RelayBroadcast, watch: RelayWatch, position: LatLon | null, fromMs: number, toMs: number) {
  let current = watch;
  for (let at = fromMs; at <= toMs; at += RELAY_CHECK_S * S) {
    current = watchRelay(current, relay, position, at);
    const end = relayEnd(relay, current, at);
    if (end) return { watch: current, end, atMs: at };
  }
  return { watch: current, end: null as RelayEnd | null, atMs: toMs };
}

describe('RL1 arrival countdown', () => {
  const relay = session(DAY);

  it('starts within the radius and ends the relay after the countdown', () => {
    const at = north(DEST, RELAY_ARRIVAL_RADIUS_M - 1);
    const watch = watchRelay(startWatch(DAY), relay, at, DAY);
    expect(watch.arrivingSinceMs).toBe(DAY);
    expect(arrivalLeftS(watch, DAY + 18 * S)).toBe(RELAY_ARRIVAL_COUNTDOWN_S - 18);
    expect(relayEnd(relay, watch, DAY + (RELAY_ARRIVAL_COUNTDOWN_S - 1) * S)).toBeNull();
    expect(relayEnd(relay, watch, DAY + RELAY_ARRIVAL_COUNTDOWN_S * S)).toBe('arrived');
  });

  it('keeps its start while the rider stays, and leaving the radius cancels it', () => {
    const inside = watchRelay(startWatch(DAY), relay, north(DEST, 10), DAY);
    const still = watchRelay(inside, relay, north(DEST, 20), DAY + 30 * S);
    expect(still.arrivingSinceMs).toBe(DAY);
    const left = watchRelay(still, relay, north(DEST, RELAY_ARRIVAL_RADIUS_M + 10), DAY + 40 * S);
    expect(left.arrivingSinceMs).toBeNull();
    expect(arrivalLeftS(left, DAY + 40 * S)).toBeNull();
    expect(relayEnd(relay, left, DAY + 2 * MIN)).toBeNull();
    // Back inside: a new countdown
    expect(watchRelay(left, relay, north(DEST, 10), DAY + 50 * S).arrivingSinceMs).toBe(DAY + 50 * S);
  });
});

describe('RL1 idle stop', () => {
  it(`ends after ${RELAY_IDLE_MIN} min within ${RELAY_IDLE_RADIUS_M} m of one spot`, () => {
    const relay = session(DAY);
    const result = run(relay, startWatch(DAY), ROAD, DAY, DAY + HOUR);
    expect(result.end).toBe('idle');
    expect(result.atMs).toBe(DAY + RELAY_IDLE_MIN * MIN);
  });

  it('starts again when the rider moves more than the radius', () => {
    const relay = session(DAY);
    const first = run(relay, startWatch(DAY), ROAD, DAY, DAY + 15 * MIN);
    expect(first.end).toBeNull();
    // Jitter within the radius does not count as moving
    const jitter = watchRelay(first.watch, relay, north(ROAD, RELAY_IDLE_RADIUS_M - 5), DAY + 15 * MIN);
    expect(jitter.idle?.sinceMs).toBe(DAY);
    const moved = watchRelay(first.watch, relay, north(ROAD, RELAY_IDLE_RADIUS_M + 10), DAY + 15 * MIN);
    expect(moved.idle?.sinceMs).toBe(DAY + 15 * MIN);
  });

  it(`waits ${RELAY_IDLE_TERMINAL_MIN} min at a terminal (D3)`, () => {
    const relay = session(DAY, [north(ROAD, 50)]);
    const result = run(relay, startWatch(DAY), ROAD, DAY, DAY + HOUR);
    expect(result.end).toBe('idle');
    expect(result.atMs).toBe(DAY + RELAY_IDLE_TERMINAL_MIN * MIN);
  });

  it('without a position nothing changes', () => {
    const watch = startWatch(DAY);
    expect(watchRelay(watch, session(DAY), null, DAY + MIN)).toBe(watch);
  });
});

describe('RL1 high-traffic zones (D1)', () => {
  it('an all-day zone holds the idle clock at any hour', () => {
    const relay = session(DAY);
    expect(run(relay, startWatch(DAY), spot('HT1'), DAY, DAY + 2 * HOUR).end).toBeNull();
    const night = Date.UTC(2026, 9, 22, 15, 0, 0);
    expect(run(session(night), startWatch(night), spot('HT2'), night, night + HOUR).end).toBeNull();
  });

  it('counts within its radius only', () => {
    expect(activeZone(north(spot('HT3'), HIGH_TRAFFIC_ZONE_RADIUS_M - 10), DAY)?.id).toBe('HT3');
    expect(activeZone(north(spot('HT3'), HIGH_TRAFFIC_ZONE_RADIUS_M + 10), DAY)).toBeNull();
  });

  it('a rush-hour zone holds the clock from 16:00 to 18:59 Manila only', () => {
    expect(activeZone(spot('RH1'), RUSH)?.id).toBe('RH1');
    expect(activeZone(spot('RH1'), DAY)).toBeNull();
    // 15:59 and 19:00 Manila
    expect(activeZone(spot('RH1'), Date.UTC(2026, 9, 22, 7, 59, 0))).toBeNull();
    expect(activeZone(spot('RH1'), Date.UTC(2026, 9, 22, 11, 0, 0))).toBeNull();
    expect(run(session(RUSH), startWatch(RUSH), spot('RH1'), RUSH, RUSH + HOUR + 59 * MIN).end).toBeNull();
    const morning = run(session(DAY), startWatch(DAY), spot('RH1'), DAY, DAY + HOUR);
    expect(morning.end).toBe('idle');
  });

  it('the Magsaysay Bridge counts along its whole length at rush hour, not only at its ends', () => {
    expect(activeZone(spot(BRIDGE, 0), RUSH)?.name).toBe('Magsaysay Bridge');
    expect(activeZone(spot(BRIDGE, 1), RUSH)?.id).toBe(BRIDGE);
    // The middle is about 550 m from either end
    expect(activeZone(bridgeMiddle, RUSH)?.id).toBe(BRIDGE);
    // The bridge runs about 27 degrees off east, so a step north is about 0.89 of it across the bridge
    expect(activeZone(north(bridgeMiddle, 120), RUSH)?.id).toBe(BRIDGE);
    expect(activeZone(north(bridgeMiddle, 250), RUSH)).toBeNull();
    expect(activeZone(bridgeMiddle, DAY)).toBeNull();
    expect(run(session(RUSH), startWatch(RUSH), bridgeMiddle, RUSH, RUSH + HOUR).end).toBeNull();
  });

  it('the clock starts when the rider leaves the zone', () => {
    const relay = session(DAY);
    const held = run(relay, startWatch(DAY), spot('HT1'), DAY, DAY + HOUR);
    const away = north(spot('HT1'), HIGH_TRAFFIC_ZONE_RADIUS_M + 100);
    const after = run(relay, held.watch, away, DAY + HOUR, DAY + 2 * HOUR);
    expect(after.end).toBe('idle');
    expect(after.atMs).toBe(DAY + HOUR + RELAY_IDLE_MIN * MIN);
  });
});

describe('RL1 3-hour cap', () => {
  const capMs = RELAY_SESSION_CAP_H * HOUR;

  it('asks "Still riding?" after the cap, and ends with no answer', () => {
    const watch = startWatch(DAY);
    expect(capDue(watch, DAY + capMs - 1)).toBe(false);
    expect(capDue(watch, DAY + capMs)).toBe(true);
    const asked = askedWatch(watch, DAY + capMs);
    expect(capDue(asked, DAY + capMs + MIN)).toBe(false);
    expect(relayEnd(session(DAY), asked, DAY + capMs + (RELAY_CAP_ANSWER_MIN * MIN - 1))).toBeNull();
    expect(relayEnd(session(DAY), asked, DAY + capMs + RELAY_CAP_ANSWER_MIN * MIN)).toBe('capped');
  });

  it('Keep sharing starts the hours again', () => {
    const renewed = renewedWatch(askedWatch(startWatch(DAY), DAY + capMs), DAY + capMs + MIN);
    expect(relayEnd(session(DAY), renewed, DAY + capMs + 10 * MIN)).toBeNull();
    expect(capDue(renewed, DAY + capMs + MIN + capMs - 1)).toBe(false);
    expect(capDue(renewed, DAY + capMs + MIN + capMs)).toBe(true);
    expect(askInMin(renewed.capFromMs, DAY + capMs + MIN)).toBe(RELAY_SESSION_CAP_H * 60);
  });
});
