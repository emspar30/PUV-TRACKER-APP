// Turns a traced route (GeoJSON from Google My Maps) into directed seed lines (RR1).
// Pure: used by scripts/import-route.ts on the PC, never at app runtime. The app reads the
// generated seed module, so no parsing, simplification or chainage work happens on screen.

import { lineString, simplify } from '@turf/turf';
import type { Position } from 'geojson';

import {
  ROUTE_EXPECTED_LAT,
  ROUTE_EXPECTED_LON,
  ROUTE_EXPECTED_SPREAD_DEG,
  ROUTE_IMPORT_FAIL_OUTSIDE_M,
  ROUTE_IMPORT_WARN_OUTSIDE_M,
  ROUTE_LOOP_CLOSE_M,
  ROUTE_MAX_POINTS_PER_LINE,
  ROUTE_SEGMENT_JOIN_M,
  ROUTE_SIMPLIFY_TOLERANCE_M,
} from '../config';
import type { Bounds } from '../geo/bounds';
import { haversineMeters } from '../geo/haversine';
import { lineLengthKm, projectOntoLine } from '../geo/line';

const METERS_PER_DEGREE = 111320;
const METERS_PER_KM = 1000;
const DEGREES_PER_HALF_TURN = 180;
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

// What the traced line is, and how the other direction is obtained:
// - vice_versa: the traced line is the outbound leg; the return is its reverse (marked derived)
// - partial_return: the traced line is the first part of the return leg; the outbound leg is
//   not provided and the line does not reach the terminal (marked partial)
export type ReturnRule = 'vice_versa' | 'partial_return';

export type ImportedDirection = {
  direction: 'outbound' | 'return';
  coordinates: Position[];
  lengthKm: number;
  // True when the line was made by reversing the traced one ("vice versa" routes)
  derived: boolean;
  // True when the traced leg stops before the end of the route (it does not reach the terminal)
  partial: boolean;
};

export type ImportedRoute = {
  directionMode: 'one_way' | 'two_way' | 'loop';
  directions: ImportedDirection[];
  note: 'traced loop' | 'outbound traced; return derived (reverse)' | 'return leg traced, partial; outbound not provided';
  pointsBefore: number;
  pointsAfter: number;
  maxDeviationM: number;
  issues: ImportIssue[];
};

// The whole import for one file: parse, check, simplify, and decide the directions
export function importRoute(geojson: unknown, rule: ReturnRule, bounds: Bounds): ImportedRoute {
  const { pieces } = extractPieces(geojson);
  const merged = mergePieces(pieces);
  const issues = [...merged.issues];
  if (merged.line.length > 0) issues.push(...checkOrder(merged.line), ...checkBounds(merged.line, bounds));
  const { line, maxDeviationM } = simplifyLine(merged.line);
  if (line.length > ROUTE_MAX_POINTS_PER_LINE) {
    issues.push({ level: 'warn', message: `${line.length} points after simplification (limit ${ROUTE_MAX_POINTS_PER_LINE})` });
  }
  const base = { pointsBefore: merged.line.length, pointsAfter: line.length, maxDeviationM, issues };
  const lengthKm = lineLengthKm(line);
  const traced: ImportedDirection = { direction: 'outbound', coordinates: line, lengthKm, derived: false, partial: false };

  if (isClosed(merged.line)) return { ...base, directionMode: 'loop', directions: [traced], note: 'traced loop' };
  if (rule === 'vice_versa') {
    const reversed = [...line].reverse();
    return {
      ...base,
      directionMode: 'two_way',
      directions: [traced, { direction: 'return', coordinates: reversed, lengthKm, derived: true, partial: false }],
      note: 'outbound traced; return derived (reverse)',
    };
  }
  return {
    ...base,
    directionMode: 'one_way',
    directions: [{ direction: 'return', coordinates: line, lengthKm, derived: false, partial: true }],
    note: 'return leg traced, partial; outbound not provided',
  };
}
