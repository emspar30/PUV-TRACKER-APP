// Turns a traced route (GeoJSON from Google My Maps) into directed seed lines (RR1).
// Pure: used by scripts/import-route.ts on the PC, never at app runtime. The app reads the
// generated seed module, so no parsing, simplification or chainage work happens on screen.

import { lineString, simplify } from '@turf/turf';
import type { Position } from 'geojson';

import {
  ROUTE_CLOSE_BACK_M,
  ROUTE_CLOSE_BACK_MIN_GAP_M,
  ROUTE_EXPECTED_LAT,
  ROUTE_EXPECTED_LON,
  ROUTE_EXPECTED_SPREAD_DEG,
  ROUTE_IMPORT_FAIL_OUTSIDE_M,
  ROUTE_IMPORT_WARN_OUTSIDE_M,
  ROUTE_LOOP_CLOSE_M,
  ROUTE_LOOP_CONFIRM_M,
  ROUTE_MAX_POINTS_PER_LINE,
  ROUTE_NEAR_RETURN_M,
  ROUTE_NEAR_RETURN_MIN_GAP_M,
  ROUTE_OVERLAP_M,
  ROUTE_OVERLAP_MIN_GAP_M,
  ROUTE_STOP_REPORT_M,
  ROUTE_SEGMENT_JOIN_M,
  ROUTE_SIMPLIFY_TOLERANCE_M,
  ROUTE_TRIM_MAX_OFFSET_M,
  ROUTE_TRIM_MIN_TAIL_M,
} from '../config';
import type { Bounds } from '../geo/bounds';
import { haversineMeters } from '../geo/haversine';
import { lineLengthKm, linePasses, projectOntoLine, sliceCoordinates } from '../geo/line';

const METERS_PER_DEGREE = 111320;
const METERS_PER_KM = 1000;
const DEGREES_PER_HALF_TURN = 180;
const KM_DECIMALS = 2;
// A line of two points cannot be simplified
const MIN_POINTS_TO_SIMPLIFY = 3;

export type ImportIssue = { level: 'warn' | 'fail'; message: string };

const ll = (p: Position) => ({ lon: p[0], lat: p[1] });

// Every LineString piece in a GeoJSON object, with altitude stripped; Point features are listed
export function extractPieces(geojson: unknown): { pieces: Position[][]; points: Position[] } {
  const pieces: Position[][] = [];
  const points: Position[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const g = node as { type?: string; features?: unknown[]; geometry?: unknown; geometries?: unknown[]; coordinates?: unknown };
    switch (g.type) {
      case 'FeatureCollection':
        (g.features ?? []).forEach(visit);
        break;
      case 'Feature':
        visit(g.geometry);
        break;
      case 'GeometryCollection':
        (g.geometries ?? []).forEach(visit);
        break;
      case 'LineString':
        pieces.push((g.coordinates as Position[]).map((p) => [p[0], p[1]]));
        break;
      case 'MultiLineString':
        (g.coordinates as Position[][]).forEach((piece) => pieces.push(piece.map((p) => [p[0], p[1]])));
        break;
      case 'Point': {
        const p = g.coordinates as Position;
        points.push([p[0], p[1]]);
        break;
      }
      default:
        break;
    }
  };
  visit(geojson);
  return { pieces, points };
}

// Joins pieces end to start when each gap is at most ROUTE_SEGMENT_JOIN_M; otherwise fails
export function mergePieces(pieces: Position[][]): { line: Position[]; issues: ImportIssue[] } {
  if (pieces.length === 0) return { line: [], issues: [{ level: 'fail', message: 'no line in the file' }] };
  const line = [...pieces[0]];
  const issues: ImportIssue[] = [];
  for (let i = 1; i < pieces.length; i += 1) {
    const gap = haversineMeters(ll(line[line.length - 1]), ll(pieces[i][0]));
    if (gap > ROUTE_SEGMENT_JOIN_M) {
      issues.push({ level: 'fail', message: `piece ${i + 1} starts ${Math.round(gap)} m from the end of piece ${i}; not joined` });
      return { line, issues };
    }
    line.push(...pieces[i].slice(gap === 0 ? 1 : 0));
  }
  return { line, issues };
}

// Longitude first and near Butuan; a swapped or foreign file fails
export function checkOrder(line: Position[]): ImportIssue[] {
  const bad = line.filter(
    (p) => Math.abs(p[0] - ROUTE_EXPECTED_LON) > ROUTE_EXPECTED_SPREAD_DEG || Math.abs(p[1] - ROUTE_EXPECTED_LAT) > ROUTE_EXPECTED_SPREAD_DEG,
  );
  return bad.length > 0 ? [{ level: 'fail', message: `${bad.length} points are not longitude-first near Butuan` }] : [];
}

// How far a point lies outside the box, in metres (0 inside)
export function metresOutside(p: Position, bounds: Bounds): number {
  const [west, south, east, north] = bounds;
  const dLon = p[0] < west ? west - p[0] : p[0] > east ? p[0] - east : 0;
  const dLat = p[1] < south ? south - p[1] : p[1] > north ? p[1] - north : 0;
  const cos = Math.cos((p[1] * Math.PI) / DEGREES_PER_HALF_TURN);
  return Math.hypot(dLon * METERS_PER_DEGREE * cos, dLat * METERS_PER_DEGREE);
}

export function checkBounds(line: Position[], bounds: Bounds): ImportIssue[] {
  const outside = line.map((p) => metresOutside(p, bounds)).filter((m) => m > 0);
  if (outside.length === 0) return [];
  const worst = Math.max(...outside);
  const level = worst > ROUTE_IMPORT_FAIL_OUTSIDE_M ? 'fail' : 'warn';
  const far = worst > ROUTE_IMPORT_WARN_OUTSIDE_M ? ' (far outside: drawn over blank map until larger tiles exist)' : '';
  return [{ level, message: `${outside.length} points outside the tile bounds, up to ${Math.round(worst)} m${far}` }];
}

// Douglas-Peucker through Turf, with the tolerance in metres; reports the largest deviation
export function simplifyLine(line: Position[], toleranceM = ROUTE_SIMPLIFY_TOLERANCE_M): { line: Position[]; maxDeviationM: number } {
  if (line.length < MIN_POINTS_TO_SIMPLIFY) return { line, maxDeviationM: 0 };
  const simplified = simplify(lineString(line), { tolerance: toleranceM / METERS_PER_DEGREE, highQuality: true }).geometry
    .coordinates as Position[];
  const maxDeviationM = Math.max(...line.map((p) => projectOntoLine(simplified, ll(p)).offsetM));
  return { line: simplified, maxDeviationM };
}

export function isClosed(line: Position[]): boolean {
  return line.length > 1 && haversineMeters(ll(line[0]), ll(line[line.length - 1])) <= ROUTE_LOOP_CLOSE_M;
}

// Cumulative distance along the line at each vertex, in km
export function chainages(line: Position[]): number[] {
  const out = [0];
  for (let i = 1; i < line.length; i += 1) out.push(out[i - 1] + haversineMeters(ll(line[i - 1]), ll(line[i])) / METERS_PER_KM);
  return out;
}

export type TrimResult = {
  line: Position[];
  applied: boolean;
  // Distance from the trim point to the line, and the length of the part beyond it
  offsetM: number;
  tailKm: number;
  reason: string;
};

// RR2: keep the line from its start to the position nearest the trim point (the terminal), but only
// when that point is on the line (within ROUTE_TRIM_MAX_OFFSET_M) and the tail beyond it is longer
// than ROUTE_TRIM_MIN_TAIL_M. The source file is never changed.
export function trimLine(line: Position[], at: Position): TrimResult {
  const nearest = projectOntoLine(line, ll(at));
  const totalKm = lineLengthKm(line);
  const tailKm = totalKm - nearest.chainageKm;
  const base = { offsetM: nearest.offsetM, tailKm };
  if (nearest.offsetM > ROUTE_TRIM_MAX_OFFSET_M) {
    return { ...base, line, applied: false, reason: `trim point is ${Math.round(nearest.offsetM)} m from the line (limit ${ROUTE_TRIM_MAX_OFFSET_M} m); not trimmed` };
  }
  if (tailKm * METERS_PER_KM <= ROUTE_TRIM_MIN_TAIL_M) {
    return { ...base, line, applied: false, reason: `only ${Math.round(tailKm * METERS_PER_KM)} m beyond the trim point; not trimmed` };
  }
  return {
    ...base,
    line: sliceCoordinates(line, 0, nearest.chainageKm),
    applied: true,
    reason: `trimmed ${tailKm.toFixed(KM_DECIMALS)} km beyond the trim point (${Math.round(nearest.offsetM)} m from the line)`,
  };
}

// What the traced line is, and how the other direction is obtained:
// - vice_versa: the traced line is the outbound leg; the return is its reverse (marked derived)
// - partial_return: the traced line is the first part of the return leg; the outbound leg is
//   not provided and the line does not reach the terminal (marked partial)
// - closes_back (R4): the traced line is the return, run on into the start of the next outbound
//   (the downtown loop), and it ends where it passed earlier. The rest of the outbound is the same
//   road back to the turnaround, so the outbound is derived: from the end, back along the line to
//   its start (marked derived and partial). Vehicles then go round with no U-turn mid-route.
// - outbound_only (R14, RR3): the traced line is the outbound, it stops short of the far terminal,
//   and the return is not provided (marked partial; the route is a draft)
export type ReturnRule = 'vice_versa' | 'partial_return' | 'closes_back' | 'outbound_only';

// closes_back: the distance along the line of the earliest pass by its own end point, at least
// ROUTE_CLOSE_BACK_MIN_GAP_M before the end; null when the line never comes back there
export function closesBackAtKm(line: Position[]): number | null {
  if (line.length <= 1) return null;
  const totalKm = lineLengthKm(line);
  const end = ll(line[line.length - 1]);
  const earlier = linePasses(line, end, ROUTE_CLOSE_BACK_M).passes.filter(
    (pass) => (totalKm - pass.chainageKm) * METERS_PER_KM >= ROUTE_CLOSE_BACK_MIN_GAP_M,
  );
  return earlier[0]?.chainageKm ?? null;
}

export type ImportedDirection = {
  direction: 'outbound' | 'return';
  coordinates: Position[];
  lengthKm: number;
  // True when the line was made by reversing the traced one ("vice versa" routes)
  derived: boolean;
  // True when the traced leg stops before the end of the route (it does not reach the terminal)
  partial: boolean;
  // True when this leg came from its own file or a cycle split (RR3); a route is a draft until
  // both of its legs did
  perDirection: boolean;
  // The RR2 trim at the terminal, when one was asked for
  trim?: Omit<TrimResult, 'line'>;
};

export type ImportOptions = {
  // RR2: cut a leg at this point (the terminal), per direction
  trimAt?: Partial<Record<'outbound' | 'return', Position>>;
};

export type ImportedRoute = {
  directionMode: 'one_way' | 'two_way' | 'loop';
  directions: ImportedDirection[];
  note:
    | 'traced loop'
    | 'outbound traced; return derived (reverse)'
    | 'return leg traced, partial; outbound not provided'
    | 'return traced; outbound derived (back along it to the turnaround)'
    | 'outbound traced, partial; return not provided';
  pointsBefore: number;
  pointsAfter: number;
  maxDeviationM: number;
  issues: ImportIssue[];
};

// The whole import for one file: parse, check, simplify, and decide the directions
export function importRoute(geojson: unknown, rule: ReturnRule, bounds: Bounds, options: ImportOptions = {}): ImportedRoute {
  const { pieces } = extractPieces(geojson);
  const merged = mergePieces(pieces);
  const issues = [...merged.issues];
  if (merged.line.length > 0) issues.push(...checkOrder(merged.line), ...checkBounds(merged.line, bounds));
  // The traced line is the outbound of a "vice versa" route and the return of a partial one
  const tracedDirection = rule === 'vice_versa' || rule === 'outbound_only' ? 'outbound' : 'return';
  const trimPoint = options.trimAt?.[tracedDirection];
  const trimmed = trimPoint && merged.line.length > 1 ? trimLine(merged.line, trimPoint) : null;
  const { line, maxDeviationM } = simplifyLine(trimmed ? trimmed.line : merged.line);
  if (line.length > ROUTE_MAX_POINTS_PER_LINE) {
    issues.push({ level: 'warn', message: `${line.length} points after simplification (limit ${ROUTE_MAX_POINTS_PER_LINE})` });
  }
  const base = { pointsBefore: merged.line.length, pointsAfter: line.length, maxDeviationM, issues };
  const lengthKm = lineLengthKm(line);
  const trim = trimmed ? { applied: trimmed.applied, offsetM: trimmed.offsetM, tailKm: trimmed.tailKm, reason: trimmed.reason } : undefined;
  const traced: ImportedDirection = { direction: 'outbound', coordinates: line, lengthKm, derived: false, partial: false, perDirection: false, trim };

  if (isClosed(merged.line)) return { ...base, directionMode: 'loop', directions: [traced], note: 'traced loop' };
  if (rule === 'vice_versa') {
    const reversed = [...line].reverse();
    return {
      ...base,
      directionMode: 'two_way',
      directions: [traced, { direction: 'return', coordinates: reversed, lengthKm, derived: true, partial: false, perDirection: false }],
      note: 'outbound traced; return derived (reverse)',
    };
  }
  if (rule === 'outbound_only') {
    return { ...base, directionMode: 'one_way', directions: [{ ...traced, partial: true }], note: 'outbound traced, partial; return not provided' };
  }
  if (rule === 'closes_back') {
    const atKm = closesBackAtKm(line);
    if (atKm !== null) {
      const back = [line[line.length - 1], ...sliceCoordinates(line, 0, atKm).reverse()];
      return {
        ...base,
        directionMode: 'two_way',
        directions: [
          { ...traced, direction: 'return', partial: true },
          { direction: 'outbound', coordinates: back, lengthKm: lineLengthKm(back), derived: true, partial: true, perDirection: false },
        ],
        note: 'return traced; outbound derived (back along it to the turnaround)',
      };
    }
    issues.push({ level: 'warn', message: 'the line never comes back to an earlier pass; outbound not derived' });
  }
  return {
    ...base,
    directionMode: 'one_way',
    directions: [{ ...traced, direction: 'return', partial: true }],
    note: 'return leg traced, partial; outbound not provided',
  };
}

// --- RR3: per-direction and cycle files

export type FileKind = 'outbound' | 'return' | 'primary' | 'cycle';
export type RouteFile = { routeNumber: number; kind: FileKind; updated: boolean; file: string };

// route_<n>_<outbound|return|primary|cycle>[_updated].geojson; the direction comes from the name,
// never from a guess. Other names (and the .txt notes) are ignored.
export function parseRouteFileName(file: string): RouteFile | null {
  const match = /^route_(\d+)_(outbound|return|primary|cycle)(_updated)?\.geojson$/.exec(file);
  if (!match) return null;
  return { routeNumber: Number(match[1]), kind: match[2] as FileKind, updated: match[3] !== undefined, file };
}

// One file per route and kind: an _updated file supersedes the plain one
export function pickRouteFiles(files: readonly string[]): RouteFile[] {
  const parsed = files.map(parseRouteFileName).filter((f): f is RouteFile => f !== null);
  const key = (f: RouteFile) => `${f.routeNumber}/${f.kind}`;
  const best = new Map<string, RouteFile>();
  for (const f of parsed) {
    const current = best.get(key(f));
    if (!current || (f.updated && !current.updated)) best.set(key(f), f);
  }
  return [...best.values()].sort((a, b) => a.routeNumber - b.routeNumber || a.kind.localeCompare(b.kind));
}

// The vertex farthest (straight line) from the start: the proposed turnaround of a cycle
export function farthestFromStart(line: Position[]): { point: Position; chainageKm: number; distanceM: number } {
  const ch = chainages(line);
  let best = 0;
  let bestM = 0;
  line.forEach((p, i) => {
    const d = haversineMeters(ll(line[0]), ll(p));
    if (d > bestM) {
      bestM = d;
      best = i;
    }
  });
  return { point: line[best], chainageKm: ch[best], distanceM: bestM };
}

// Splits a cycle at the position nearest `at`: outbound from the start to there, return from there to the end
export function splitLine(line: Position[], at: Position): { outbound: Position[]; ret: Position[]; atKm: number; offsetM: number } {
  const nearest = projectOntoLine(line, ll(at));
  const totalKm = lineLengthKm(line);
  return {
    outbound: sliceCoordinates(line, 0, nearest.chainageKm),
    ret: sliceCoordinates(line, nearest.chainageKm, totalKm),
    atKm: nearest.chainageKm,
    offsetM: nearest.offsetM,
  };
}

export type LoopReport = { kind: 'overlap' | 'near_return'; fromKm: number; toKm: number; earlierKm: number; lengthKm: number; nearestM: number; confirm: boolean };

const LOOP_STEP_M = 25;
// Hits closer together than this along the line are one loop
const LOOP_JOIN_M = 50;

// Where the line comes back near an earlier part of itself (see the ROUTE_OVERLAP and
// ROUTE_NEAR_RETURN settings). Reported for confirmation only; a loop never fails the import.
export function findLoops(line: Position[]): LoopReport[] {
  const dense: { p: Position; c: number }[] = [{ p: line[0], c: 0 }];
  let c = 0;
  for (let i = 1; i < line.length; i += 1) {
    const seg = haversineMeters(ll(line[i - 1]), ll(line[i]));
    const n = Math.max(1, Math.ceil(seg / LOOP_STEP_M));
    for (let k = 1; k <= n; k += 1) {
      const t = k / n;
      dense.push({ p: [line[i - 1][0] + t * (line[i][0] - line[i - 1][0]), line[i - 1][1] + t * (line[i][1] - line[i - 1][1])], c: c + seg * t });
    }
    c += seg;
  }
  const scan = (kind: LoopReport['kind'], nearM: number, minGapM: number): LoopReport[] => {
    const found: LoopReport[] = [];
    let open: LoopReport | null = null;
    for (let i = 0; i < dense.length; i += 1) {
      let bestM = Infinity;
      let bestC = 0;
      for (let j = 0; j < dense.length && dense[i].c - dense[j].c >= minGapM; j += 1) {
        const d = haversineMeters(ll(dense[i].p), ll(dense[j].p));
        if (d < bestM) {
          bestM = d;
          bestC = dense[j].c;
        }
      }
      const hit = bestM <= nearM;
      if (hit && open && dense[i].c - open.toKm * METERS_PER_KM <= LOOP_JOIN_M) {
        open.toKm = dense[i].c / METERS_PER_KM;
        if (bestM < open.nearestM) open.nearestM = bestM;
      } else if (hit) {
        if (open) found.push(open);
        const lengthKm = (dense[i].c - bestC) / METERS_PER_KM;
        open = { kind, fromKm: dense[i].c / METERS_PER_KM, toKm: dense[i].c / METERS_PER_KM, earlierKm: bestC / METERS_PER_KM, lengthKm, nearestM: bestM, confirm: lengthKm * METERS_PER_KM > ROUTE_LOOP_CONFIRM_M };
      }
    }
    if (open) found.push(open);
    return found;
  };
  return [...scan('overlap', ROUTE_OVERLAP_M, ROUTE_OVERLAP_MIN_GAP_M), ...scan('near_return', ROUTE_NEAR_RETURN_M, ROUTE_NEAR_RETURN_MIN_GAP_M)];
}

export type StopReport = { code: string; passes: { chainageKm: number; offsetM: number }[] };

// Every stop within ROUTE_STOP_REPORT_M of a leg, with each pass
export function stopDistances(line: Position[], stops: readonly { code: string; lat: number; lon: number }[]): StopReport[] {
  return stops
    .map((stop) => ({ code: stop.code, passes: linePasses(line, stop, ROUTE_STOP_REPORT_M).passes.map((p) => ({ chainageKm: p.chainageKm, offsetM: p.offsetM })) }))
    .filter((s) => s.passes.length > 0);
}

export type LegSource = { file: RouteFile; geojson: unknown };

export type ImportedLegs = {
  directions: ImportedDirection[];
  issues: ImportIssue[];
  // For a cycle: the proposed turnaround (farthest point from the start), for Emjay to confirm
  turnaround?: { point: Position; chainageKm: number; distanceM: number };
  split?: { atKm: number; offsetM: number };
};

function prepareLeg(geojson: unknown, bounds: Bounds): { line: Position[]; raw: Position[]; issues: ImportIssue[] } {
  const merged = mergePieces(extractPieces(geojson).pieces);
  const issues = [...merged.issues];
  if (merged.line.length > 0) issues.push(...checkOrder(merged.line), ...checkBounds(merged.line, bounds));
  return { line: merged.line, raw: merged.line, issues };
}

const asDirection = (direction: 'outbound' | 'return', line: Position[], perDirection: boolean): ImportedDirection => {
  const simplified = simplifyLine(line).line;
  return { direction, coordinates: simplified, lengthKm: lineLengthKm(simplified), derived: false, partial: false, perDirection };
};

// Legs from per-direction files, or from one cycle file split at `splitAt` (RR3). A leg that is
// missing is reversed from the other only when `reverseMissing` is set (R3, "vice versa"); never for
// R4 or R5.
export function importLegs(
  sources: readonly LegSource[],
  bounds: Bounds,
  options: { splitAt?: Position; reverseMissing?: boolean } = {},
): ImportedLegs {
  const issues: ImportIssue[] = [];
  const directions: ImportedDirection[] = [];
  const result: ImportedLegs = { directions, issues };

  const cycle = sources.find((s) => s.file.kind === 'cycle');
  if (cycle) {
    const leg = prepareLeg(cycle.geojson, bounds);
    issues.push(...leg.issues);
    result.turnaround = farthestFromStart(leg.line);
    if (!options.splitAt) {
      issues.push({ level: 'fail', message: 'cycle file needs a splitAt point (the turnaround); proposed point reported' });
      return result;
    }
    const split = splitLine(leg.line, options.splitAt);
    result.split = { atKm: split.atKm, offsetM: split.offsetM };
    if (split.offsetM > ROUTE_TRIM_MAX_OFFSET_M) {
      issues.push({ level: 'fail', message: `splitAt point is ${Math.round(split.offsetM)} m from the line (limit ${ROUTE_TRIM_MAX_OFFSET_M} m)` });
      return result;
    }
    directions.push(asDirection('outbound', split.outbound, true), asDirection('return', split.ret, true));
    return result;
  }

  for (const kind of ['outbound', 'return'] as const) {
    const source = sources.find((s) => s.file.kind === kind);
    if (!source) continue;
    const leg = prepareLeg(source.geojson, bounds);
    issues.push(...leg.issues);
    directions.push(asDirection(kind, leg.line, true));
  }
  if (directions.length === 1 && options.reverseMissing) {
    const only = directions[0];
    directions.push({ ...only, direction: only.direction === 'outbound' ? 'return' : 'outbound', coordinates: [...only.coordinates].reverse(), derived: true, perDirection: false });
  }
  return result;
}

// A route is a draft until both of its legs came from Emjay's per-direction files (RR2, RR3).
// A derived reverse (R3) or a single traced leg (R4, R5 today) keeps it a draft.
export function isDraftRoute(legs: readonly { direction: 'outbound' | 'return'; perDirection?: boolean }[]): boolean {
  const fromFiles = (direction: 'outbound' | 'return') => legs.some((leg) => leg.direction === direction && leg.perDirection === true);
  return !(fromFiles('outbound') && fromFiles('return'));
}
