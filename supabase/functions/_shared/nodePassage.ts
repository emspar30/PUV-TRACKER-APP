// NM1 (PRD 10.4): when a vehicle passes a stop of its route. At night the map shows "R4 passed CSU ·
// 3 min ago" chips instead of moving markers; this rule decides the passages from accepted
// positions. A position within NODE_PASS_RADIUS_M of a stop is a passage, unless the same vehicle
// passed that stop less than NODE_PASS_GAP_MIN before (a multicab waiting at a stop is one passage).
// Pure TypeScript with only the server config imported, so the Edge Function (Deno) and the app's
// tests use the same file.

import { NODE_PASS_GAP_MIN, NODE_PASS_RADIUS_M } from './serverConfig.ts';

const MS_PER_MIN = 60_000;
const EARTH_RADIUS_M = 6371008.8;
const DEG_TO_RAD = Math.PI / 180;

export type PassStop = { code: string; lat: number; lon: number };
export type PassPoint = { lat: number; lon: number; atMs: number };
export type Passage = { stopCode: string; atMs: number };

function metresBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = (b.lat - a.lat) * DEG_TO_RAD;
  const dLon = (b.lon - a.lon) * DEG_TO_RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * DEG_TO_RAD) * Math.cos(b.lat * DEG_TO_RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

// The passages these positions (oldest first) make, given when the vehicle last passed each stop
// (epoch ms by stop code, from the stored passages)
export function newPassages(points: readonly PassPoint[], stops: readonly PassStop[], lastPassedMs: Readonly<Record<string, number>>): Passage[] {
  const last: Record<string, number> = { ...lastPassedMs };
  const passages: Passage[] = [];
  for (const point of points) {
    for (const stop of stops) {
      if (metresBetween(point, stop) > NODE_PASS_RADIUS_M) continue;
      const before = last[stop.code];
      if (before !== undefined && point.atMs - before < NODE_PASS_GAP_MIN * MS_PER_MIN) continue;
      last[stop.code] = point.atMs;
      passages.push({ stopCode: stop.code, atMs: point.atMs });
    }
  }
  return passages;
}
