// RL2a (Emjay's D9 to D11, 2026-10-23): may the rider relay? The Relay form is greyed out, with the
// reason, until all three checks pass, in this order:
// - Location: the phone's location is allowed and on (a simulated position in Demo & simulation
//   counts), and a fix good enough for a relay has come (GPS_ACCURACY_GATE_RELAY_M, not mocked or
//   stale; the caller decides that).
// - Beacon: one multicab's beacon is heard and the server accepted its rotating code. Nothing
//   verified after RELAY_BEACON_WAIT_S means no registered multicab is near. Two beacons too close in
//   signal wait for the queue (RL2c). In demo data the nearest moving demo multicab within
//   DEMO_BEACON_RANGE_M counts as heard (demoBeacon).
// - Route: the rider is within ROUTE_SNAP_DISTANCE_M of that multicab's route line, or within
//   RELAY_STOP_AREA_M of one of its stops. A beacon code recorded and played back away from the
//   route does not pass.
// Pure: no React Native or Expo imports.

import { DEMO_BEACON_FOUND_AFTER_S, DEMO_BEACON_RANGE_M, RELAY_BEACON_WAIT_S, RELAY_STOP_AREA_M, ROUTE_SNAP_DISTANCE_M } from '../config';
import { haversineMeters, type LatLon } from '../geo/haversine';
import { projectOntoLine, type LineCoordinates } from '../geo/line';

const MS_PER_S = 1000;

// The multicab a verified beacon names (the plate is shown, never the beacon's id)
export type RelayVehicle = { routeCode: string; vehicleId: string; plate: string };

// What the location side knows: off (no consent or permission), the phone's setting off, or on
export type RelayLocation = 'needs_permission' | 'off' | 'on';

// What Bluetooth knows:
//   off          it cannot listen (Bluetooth or Nearby devices off, no scanner); the card says why
//   searching    listening, nothing verified yet (or the check could not be made)
//   unregistered a beacon was heard but the server does not know it
//   several      two or more beacons within the margin
//   found        one verified multicab
export type RelayBeacon =
  | { kind: 'off' | 'searching' | 'unregistered' | 'several' }
  | { kind: 'found'; vehicle: RelayVehicle };

export type RelayGateInput = {
  location: RelayLocation;
  // A fix good enough for a relay (or a simulated position)
  fixOk: boolean;
  position: LatLon | null;
  beacon: RelayBeacon;
  // When the Relay form opened, for RELAY_BEACON_WAIT_S
  openedMs: number;
  nowMs: number;
  // The route's lines (both directions) and stops
  routeOf: (routeCode: string) => { lines: readonly LineCoordinates[]; stops: readonly LatLon[] };
};

export type RelayGate =
  | { kind: 'needs_permission' | 'location_off' | 'waiting_fix' | 'no_bluetooth' | 'searching' | 'no_beacon' | 'several' }
  | { kind: 'off_route'; routeCode: string }
  | { kind: 'ok'; vehicle: RelayVehicle };

// Within ROUTE_SNAP_DISTANCE_M of one of the lines, or RELAY_STOP_AREA_M of one of the stops
export function onRoute(position: LatLon, lines: readonly LineCoordinates[], stops: readonly LatLon[]): boolean {
  if (lines.some((line) => line.length > 0 && projectOntoLine(line, position).offsetM <= ROUTE_SNAP_DISTANCE_M)) return true;
  return stops.some((stop) => haversineMeters(position, stop) <= RELAY_STOP_AREA_M);
}

export function relayGate(input: RelayGateInput): RelayGate {
  const { location, fixOk, position, beacon, openedMs, nowMs, routeOf } = input;
  if (location === 'needs_permission') return { kind: 'needs_permission' };
  if (location === 'off') return { kind: 'location_off' };
  if (!fixOk || !position) return { kind: 'waiting_fix' };
  switch (beacon.kind) {
    case 'off':
      return { kind: 'no_bluetooth' };
    case 'several':
      return { kind: 'several' };
    case 'unregistered':
      return { kind: 'no_beacon' };
    case 'searching':
      return nowMs - openedMs >= RELAY_BEACON_WAIT_S * MS_PER_S ? { kind: 'no_beacon' } : { kind: 'searching' };
    case 'found': {
      const { lines, stops } = routeOf(beacon.vehicle.routeCode);
      return onRoute(position, lines, stops) ? { kind: 'ok', vehicle: beacon.vehicle } : { kind: 'off_route', routeCode: beacon.vehicle.routeCode };
    }
  }
}

// A demo multicab where it is now (from the demo vehicles on the map)
export type DemoMulticab = { id: string; label: string; routeCode: string; lat: number; lon: number };

// RL2a polish (Emjay, 2026-10-25): demo data has no beacons, so the moving demo multicabs stand in
// for them, as in a real multicab: the form searches for DEMO_BEACON_FOUND_AFTER_S, then the nearest
// demo multicab within DEMO_BEACON_RANGE_M of the rider is heard. None that close keeps it searching
// (the gate says so after RELAY_BEACON_WAIT_S). The caller keeps the one found while the form is open.
export function demoBeacon(position: LatLon | null, multicabs: readonly DemoMulticab[], openedMs: number, nowMs: number): RelayBeacon {
  if (!position || nowMs - openedMs < DEMO_BEACON_FOUND_AFTER_S * MS_PER_S) return { kind: 'searching' };
  let nearest: DemoMulticab | null = null;
  let nearestM = DEMO_BEACON_RANGE_M;
  for (const multicab of multicabs) {
    const distanceM = haversineMeters(position, multicab);
    if (distanceM <= nearestM) {
      nearest = multicab;
      nearestM = distanceM;
    }
  }
  return nearest
    ? { kind: 'found', vehicle: { routeCode: nearest.routeCode, vehicleId: nearest.id, plate: nearest.label } }
    : { kind: 'searching' };
}
