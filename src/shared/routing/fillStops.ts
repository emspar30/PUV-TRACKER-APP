// CA2-0 (Emjay, D6, 2026-10-29): fill stops. A commuter may check in anywhere near a route line and
// is counted at a stop of that route no farther than CHECKIN_STOP_MAX_M, so every stretch of line
// farther than that from a stop gets new stops, at most FILL_STOP_GAP_M apart, on the line itself.
// A fill stop is shared by every route whose line passes within CHECKIN_LINE_M of it, and a new one
// within FILL_STOP_MERGE_M of another stop is not made: that stop is used instead. Each is named
// after the nearest map place ("Near Alba") and has a four-letter code (real stops have three),
// worked out from its position, so a rerun on the same data gives the same codes. Run on the PC by
// scripts/fill-stops.ts, never at app runtime. Pure: no React Native or Expo imports.

import { CHECKIN_LINE_M, CHECKIN_STOP_MAX_M, FILL_STOP_GAP_M, FILL_STOP_MERGE_M } from '../config';
import { haversineMeters, type LatLon } from '../geo/haversine';
import { lineLengthKm, pointAtChainage, projectOntoLine, type LineCoordinates } from '../geo/line';

const M_PER_KM = 1000;
// The check-in limit less this, so a stop placed by the walk below is inside the limit with room to spare
const REACH_SLACK_M = 10;
// The walk along a line measures every this many metres
const SAMPLE_M = 10;
// Rounds of placing stops: each round fills what the stops of the round before left open
const MAX_ROUNDS = 5;
const CODE_LETTERS = 26;
const CHAR_A = 65;
const FILL_CODE_PREFIX = 'F';
// Letters after the F
const FILL_CODE_TAIL = 3;
const HALF = 0.5;
const FILL_CODE_RE = /^F[A-Z]{3}$/;
// FNV-1a, 32-bit
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const COORD_DECIMALS = 5;

export type FillLine = { routeCode: string; coordinates: LineCoordinates };
export type FillStation = LatLon & { code: string; name: string; routeCodes: readonly string[] };
export type FillPlace = LatLon & { name: string; group: 'poi' | 'area' | 'street' };
export type FillStop = LatLon & { code: string; name: string; routeCodes: string[] };

export type FillResult = {
  stops: FillStop[];
  // Real stops a route takes over because a fill stop would sit within FILL_STOP_MERGE_M of them
  extraRoutes: Record<string, string[]>;
};

// Fill stops have four-letter codes starting with F; the real stops have three letters
export function isFillStopCode(code: string): boolean {
  return FILL_CODE_RE.test(code);
}

function hash(text: string): number {
  let h = FNV_OFFSET;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, FNV_PRIME) >>> 0;
  }
  return h;
}

function codeFor(point: LatLon, taken: ReadonlySet<string>): string {
  for (let salt = 0; ; salt += 1) {
    let h = hash(`${point.lat.toFixed(COORD_DECIMALS)},${point.lon.toFixed(COORD_DECIMALS)},${salt}`);
    let code = FILL_CODE_PREFIX;
    for (let i = 0; i < FILL_CODE_TAIL; i += 1) {
      code += String.fromCharCode(CHAR_A + (h % CODE_LETTERS));
      h = Math.floor(h / CODE_LETTERS);
    }
    if (!taken.has(code)) return code;
  }
}

// "Near <place>": the nearest landmark or neighbourhood, else the nearest street, else the nearest stop
function nameFor(point: LatLon, places: readonly FillPlace[], stations: readonly FillStation[]): string {
  const nearest = (candidates: readonly (LatLon & { name: string })[]) => {
    let best: { name: string; m: number } | null = null;
    for (const candidate of candidates) {
      const m = haversineMeters(point, candidate);
      if (!best || m < best.m) best = { name: candidate.name, m };
    }
    return best;
  };
  const landmark = nearest(places.filter((place) => place.group !== 'street'));
  if (landmark && landmark.m <= CHECKIN_STOP_MAX_M) return `Near ${landmark.name}`;
  const street = nearest(places.filter((place) => place.group === 'street'));
  if (street && street.m <= CHECKIN_STOP_MAX_M) return `Near ${street.name}`;
  return `Near ${nearest(stations)?.name ?? 'the route'}`;
}

type Interval = [number, number];

// The stretches of the line farther than the check-in limit (less a little slack) from every stop
// given, found by walking the line in SAMPLE_M steps and measuring straight to each stop, which is
// how the check-in measures too. Exact on lines that pass a stop twice or end short of a terminal.
function gapsOf(coordinates: LineCoordinates, stops: readonly LatLon[]): Interval[] {
  const lengthM = lineLengthKm(coordinates) * M_PER_KM;
  const reachM = CHECKIN_STOP_MAX_M - REACH_SLACK_M;
  const gaps: Interval[] = [];
  let open: number | null = null;
  for (let at = 0; at <= lengthM + SAMPLE_M; at += SAMPLE_M) {
    const atM = Math.min(at, lengthM);
    const point = pointAtChainage(coordinates, atM / M_PER_KM);
    const covered = stops.some((stop) => haversineMeters(stop, point) <= reachM);
    if (!covered && open === null) open = Math.max(0, atM - SAMPLE_M * HALF);
    if ((covered || atM >= lengthM) && open !== null) {
      gaps.push([open, covered ? atM - SAMPLE_M * HALF : lengthM]);
      open = null;
    }
    if (atM >= lengthM) break;
  }
  return gaps;
}

export function fillStops(lines: readonly FillLine[], stations: readonly FillStation[], places: readonly FillPlace[]): FillResult {
  const fills: FillStop[] = [];
  const extraRoutes: Record<string, string[]> = {};
  const taken = new Set(stations.map((station) => station.code));
  const routesOfReal = (station: FillStation) => [...station.routeCodes, ...(extraRoutes[station.code] ?? [])];
  const join = (list: string[], routeCode: string) => {
    if (!list.includes(routeCode)) list.push(routeCode);
  };
  // The stops of a route as they stand now, fill stops and taken-over real stops included
  const ownStops = (routeCode: string): LatLon[] => [
    ...stations.filter((station) => routesOfReal(station).includes(routeCode)),
    ...fills.filter((fill) => fill.routeCodes.includes(routeCode)),
  ];

  const ordered = [...lines].sort((a, b) => a.routeCode.localeCompare(b.routeCode));
  for (const line of ordered) {
    // A fill stop made for another line that lies on this one serves it too
    for (const fill of fills) {
      if (projectOntoLine(line.coordinates, fill).offsetM <= CHECKIN_LINE_M) join(fill.routeCodes, line.routeCode);
    }
    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      const gaps = gapsOf(line.coordinates, ownStops(line.routeCode));
      if (gaps.length === 0) break;
      for (const [from, to] of gaps) {
        const count = Math.ceil((to - from) / (FILL_STOP_GAP_M - REACH_SLACK_M - REACH_SLACK_M));
        for (let i = 0; i < count; i += 1) {
          const point = pointAtChainage(line.coordinates, (from + ((i + HALF) * (to - from)) / count) / M_PER_KM);
          // A stop of this route already this close: no second one beside it
          if (ownStops(line.routeCode).some((stop) => haversineMeters(stop, point) <= FILL_STOP_MERGE_M)) continue;
          const nearFill = fills.find((fill) => haversineMeters(fill, point) <= FILL_STOP_MERGE_M && !fill.routeCodes.includes(line.routeCode));
          if (nearFill) {
            join(nearFill.routeCodes, line.routeCode);
            continue;
          }
          const nearReal = stations.find((station) => haversineMeters(station, point) <= FILL_STOP_MERGE_M && !routesOfReal(station).includes(line.routeCode));
          if (nearReal) {
            extraRoutes[nearReal.code] = [...(extraRoutes[nearReal.code] ?? []), line.routeCode];
            continue;
          }
          const code = codeFor(point, taken);
          taken.add(code);
          fills.push({ code, name: nameFor(point, places, stations), lat: point.lat, lon: point.lon, routeCodes: [line.routeCode] });
        }
      }
    }
  }
  for (const fill of fills) fill.routeCodes.sort();
  return { stops: fills, extraRoutes };
}
