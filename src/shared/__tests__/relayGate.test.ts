// RL2a (Emjay's D9 to D11, 2026-10-23): the Relay form opens only with location, a verified beacon
// and the rider on that multicab's route.

import { RELAY_BEACON_WAIT_S, RELAY_STOP_AREA_M, ROUTE_SNAP_DISTANCE_M } from '../config';
import type { LatLon } from '../geo/haversine';
import type { LineCoordinates } from '../geo/line';
import { demoRelayVehicles, onRoute, relayGate, type RelayBeacon, type RelayGateInput, type RelayVehicle } from '../relay/gate';

const S = 1000;
// About 111 m per 0.001 degree of latitude
const DEG_PER_M = 0.001 / 111;
const north = (from: LatLon, m: number) => ({ lat: from.lat + m * DEG_PER_M, lon: from.lon });

// An east-west line about 1.1 km long, and one stop 200 m north of its west end (off the line)
const WEST: LatLon = { lat: 8.95, lon: 125.53 };
const LINE: LineCoordinates = [
  [WEST.lon, WEST.lat],
  [WEST.lon + 0.01, WEST.lat],
];
const MIDDLE: LatLon = { lat: WEST.lat, lon: WEST.lon + 0.005 };
const OFF_LINE_STOP = north(WEST, 200);
const VEHICLE: RelayVehicle = { routeCode: 'R4', vehicleId: 'R4-001', plate: 'MCB 123' };
const OPENED = Date.UTC(2026, 9, 23, 2, 0, 0);

function gate(overrides: Partial<RelayGateInput> = {}) {
  return relayGate({
    location: 'on',
    fixOk: true,
    position: MIDDLE,
    beacon: { kind: 'found', vehicle: VEHICLE },
    openedMs: OPENED,
    nowMs: OPENED + 2 * S,
    routeOf: () => ({ lines: [LINE], stops: [OFF_LINE_STOP] }),
    ...overrides,
  });
}

describe('relayGate', () => {
  it('passes with location, a verified beacon and the rider on the line', () => {
    expect(gate()).toEqual({ kind: 'ok', vehicle: VEHICLE });
  });

  it('asks for location first: permission, then the setting, then a good fix', () => {
    const noBeacon: RelayBeacon = { kind: 'off' };
    expect(gate({ location: 'needs_permission', beacon: noBeacon })).toEqual({ kind: 'needs_permission' });
    expect(gate({ location: 'off', beacon: noBeacon })).toEqual({ kind: 'location_off' });
    expect(gate({ fixOk: false })).toEqual({ kind: 'waiting_fix' });
    expect(gate({ position: null })).toEqual({ kind: 'waiting_fix' });
  });

  it('says no registered multicab only after RELAY_BEACON_WAIT_S, or at once for an unknown beacon', () => {
    const searching: RelayBeacon = { kind: 'searching' };
    expect(gate({ beacon: searching, nowMs: OPENED + (RELAY_BEACON_WAIT_S - 1) * S })).toEqual({ kind: 'searching' });
    expect(gate({ beacon: searching, nowMs: OPENED + RELAY_BEACON_WAIT_S * S })).toEqual({ kind: 'no_beacon' });
    expect(gate({ beacon: { kind: 'unregistered' } })).toEqual({ kind: 'no_beacon' });
  });

  it('passes on the Bluetooth problems, two beacons and the demo picker as their own states', () => {
    expect(gate({ beacon: { kind: 'off' } })).toEqual({ kind: 'no_bluetooth' });
    expect(gate({ beacon: { kind: 'several' } })).toEqual({ kind: 'several' });
    expect(gate({ beacon: { kind: 'pick' } })).toEqual({ kind: 'pick' });
  });

  it('refuses a verified beacon away from its route (a recorded code played back at home)', () => {
    expect(gate({ position: north(MIDDLE, 100) })).toEqual({ kind: 'off_route', routeCode: 'R4' });
  });

  it('counts the line within ROUTE_SNAP_DISTANCE_M and a stop within RELAY_STOP_AREA_M', () => {
    expect(onRoute(north(MIDDLE, ROUTE_SNAP_DISTANCE_M - 10), [LINE], [])).toBe(true);
    expect(onRoute(north(MIDDLE, ROUTE_SNAP_DISTANCE_M + 10), [LINE], [])).toBe(false);
    // A terminal's parking off the line
    expect(onRoute(north(OFF_LINE_STOP, RELAY_STOP_AREA_M - 10), [LINE], [OFF_LINE_STOP])).toBe(true);
    expect(onRoute(north(OFF_LINE_STOP, RELAY_STOP_AREA_M + 10), [LINE], [OFF_LINE_STOP])).toBe(false);
    // A route with no traced line yet still has its stops
    expect(onRoute(OFF_LINE_STOP, [[]], [OFF_LINE_STOP])).toBe(true);
  });

  it('checks the route of the multicab heard, not another', () => {
    const elsewhere: LineCoordinates = [
      [126, 9],
      [126.01, 9],
    ];
    const routeOf = (code: string) => (code === 'R4' ? { lines: [elsewhere], stops: [] } : { lines: [LINE], stops: [] });
    expect(gate({ routeOf })).toEqual({ kind: 'off_route', routeCode: 'R4' });
  });
});

describe('demoRelayVehicles', () => {
  it('makes up numbered multicabs for a route, with plates and no beacon ids', () => {
    expect(demoRelayVehicles('R14', 2)).toEqual([
      { routeCode: 'R14', vehicleId: 'R14-DEMO-1', plate: 'DEMO 1' },
      { routeCode: 'R14', vehicleId: 'R14-DEMO-2', plate: 'DEMO 2' },
    ]);
  });
});
