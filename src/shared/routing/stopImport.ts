// RR3: the real stop list (docs/real_route_stops.md) turned into stations for the route seed. Used
// by scripts/import-route.ts on the PC, never at app runtime. Pure: no React Native or Expo imports.
//
// A stop listed under several routes, or under several names at the same coordinates (Hotel Oazis
// and Hotel Oasis; BCSAT, Water District and BIR), is one station. Its position is checked against
// the lines of every route that lists it (Emjay, 2026-10-08):
// - within ROUTE_STOP_MAX_DISTANCE_M of the nearest line: kept as given
// - within ROUTE_STOP_SNAP_MAX_M: moved onto the nearest point of that line (marked moved)
// - farther: left out until its coordinates are corrected
// After that, a route keeps the station only if the station is within ROUTE_STOP_MAX_DISTANCE_M of
// one of its lines.

import type { Position } from 'geojson';

import { ROUTE_STOP_MAX_DISTANCE_M, ROUTE_STOP_SNAP_MAX_M } from '../config';
import { projectOntoLine } from '../geo/line';

export type ListedStop = { routeCode: string; name: string; lat: number; lon: number };

// "## Route 4 (R4)" headings, each followed by "* Name: lat, lon" lines
export function parseStopList(markdown: string): ListedStop[] {
  const stops: ListedStop[] = [];
  let routeCode: string | null = null;
  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^##\s+Route\s+(\d+)/.exec(line);
    if (heading) {
      routeCode = `R${heading[1]}`;
      continue;
    }
    // ST2-C2: the colon after the name may be missing ("Robinsons-Transport 8.94, 125.51")
    const item = /^\s*[*-]\s+(.+?)(?::\s*|\s+)(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(line);
    if (item && routeCode) stops.push({ routeCode, name: item[1].trim(), lat: Number(item[2]), lon: Number(item[3]) });
  }
  return stops;
}

export type ImportedStation = {
  code: string;
  name: string;
  lat: number;
  lon: number;
  routeCodes: string[];
  // Moved onto the line: the listed position, and how far it was from the line
  moved?: { lat: number; lon: number; offsetM: number };
};

export type StopIssue = { code: string; name: string; routeCodes: string[]; offsetM: number; reason: 'too_far' | 'not_on_route' };

export type StopAssignment = { stations: ImportedStation[]; issues: StopIssue[] };

// Positions are compared to about a metre
const KEY_DECIMALS = 5;
const key = (stop: { lat: number; lon: number }) => `${stop.lat.toFixed(KEY_DECIMALS)},${stop.lon.toFixed(KEY_DECIMALS)}`;

// codes: each listed name to its station code; names: the name shown for a code, where the listed
// names differ (otherwise its first listed name)
export function assignStops(
  listed: readonly ListedStop[],
  linesByRoute: Readonly<Record<string, readonly Position[][]>>,
  codes: Readonly<Record<string, string>>,
  names: Readonly<Record<string, string>>,
): StopAssignment {
  const groups = new Map<string, { code: string; name: string; lat: number; lon: number; routeCodes: string[] }>();
  for (const stop of listed) {
    const code = codes[stop.name];
    if (!code) throw new Error(`no station code for "${stop.name}"`);
    const group = groups.get(code);
    if (group && key(group) !== key(stop)) throw new Error(`"${stop.name}" (${code}) is listed at two positions`);
    const routeCodes = group?.routeCodes ?? [];
    if (!routeCodes.includes(stop.routeCode)) routeCodes.push(stop.routeCode);
    groups.set(code, { code, name: group?.name ?? stop.name, lat: stop.lat, lon: stop.lon, routeCodes });
  }
  // Two codes at one position would be one stop under two codes
  const positions = new Map<string, string>();
  for (const group of groups.values()) {
    const other = positions.get(key(group));
    if (other) throw new Error(`${other} and ${group.code} are at the same position; give them one code`);
    positions.set(key(group), group.code);
  }

  const stations: ImportedStation[] = [];
  const issues: StopIssue[] = [];
  for (const group of groups.values()) {
    const name = names[group.code] ?? group.name;
    const linesOf = (code: string) => linesByRoute[code] ?? [];
    const projections = group.routeCodes.flatMap((code) => linesOf(code).map((line) => projectOntoLine(line, group)));
    const nearest = projections.sort((a, b) => a.offsetM - b.offsetM)[0];
    if (!nearest || nearest.offsetM > ROUTE_STOP_SNAP_MAX_M) {
      issues.push({ code: group.code, name, routeCodes: group.routeCodes, offsetM: nearest?.offsetM ?? Infinity, reason: 'too_far' });
      continue;
    }
    const moved = nearest.offsetM > ROUTE_STOP_MAX_DISTANCE_M;
    const at = moved ? nearest.snapped : { lat: group.lat, lon: group.lon };
    const onRoute = group.routeCodes.filter((code) => linesOf(code).some((line) => projectOntoLine(line, at).offsetM <= ROUTE_STOP_MAX_DISTANCE_M));
    for (const code of group.routeCodes.filter((code) => !onRoute.includes(code))) {
      const offsetM = Math.min(...linesOf(code).map((line) => projectOntoLine(line, at).offsetM));
      issues.push({ code: group.code, name, routeCodes: [code], offsetM, reason: 'not_on_route' });
    }
    stations.push({
      code: group.code,
      name,
      lat: at.lat,
      lon: at.lon,
      routeCodes: onRoute,
      ...(moved ? { moved: { lat: group.lat, lon: group.lon, offsetM: nearest.offsetM } } : {}),
    });
  }
  return { stations, issues };
}
