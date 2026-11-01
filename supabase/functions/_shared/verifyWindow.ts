// V1a verification window (PRD 10.2, 0.2 S8): whether a relay is a real ride on the multicab's route.
// Four tests over the positions since the relay started, oldest first:
//   1. Bluetooth: the multicab's beacon was verified (DR8). Unknown on the server (null: not tested).
//   2. Motion: MOTION_SPEED_FALLBACK_KMH held for MOTION_SPEED_FALLBACK_S (the speed fallback), or
//      the phone's activity recognition saying "in a vehicle" for MOTION_IN_VEHICLE_SHARE of its
//      reports (V1b, on the phone only).
//   3. Route: every usable fix within ROUTE_SNAP_DISTANCE_M of the route line. A fix is usable at
//      VERIFY_FIX_ACCURACY_M or better (an unknown accuracy, as on the server, counts as usable).
//   4. Displacement: MIN_DISPLACEMENT_M of progress along the line.
// DT1 (PRD 10.5): a ride off the route line that follows an active detour line instead passes the
// route test on that line, and the result says it is on a detour (Active Detour Mode).
// Verified once all pass. Off the route fails at once. Otherwise pending until VERIFY_WINDOW_S, and
// while the multicab is slow until VERIFY_WINDOW_MAX_S; then failed, with the tests that did not pass.
// Pure TypeScript with only the server config imported, so the Edge Function (Deno) and the app use
// the same file.

import {
  MIN_DISPLACEMENT_M,
  MOTION_IN_VEHICLE_SHARE,
  MOTION_MIN_ACTIVITY_SAMPLES,
  MOTION_SPEED_FALLBACK_KMH,
  MOTION_SPEED_FALLBACK_S,
  ROUTE_SNAP_DISTANCE_M,
  VERIFY_FIX_ACCURACY_M,
  VERIFY_WINDOW_MAX_S,
  VERIFY_WINDOW_S,
} from './serverConfig.ts';

const EARTH_RADIUS_M = 6371008.8;
const DEG_TO_RAD = Math.PI / 180;
const MS_PER_S = 1000;
const MPS_TO_KMH = 3.6;
const HALF = 0.5;

export type WindowFix = {
  lat: number;
  lon: number;
  atMs: number;
  // Metres; null when unknown
  accuracyM?: number | null;
  // The phone's own speed reading in km/h, used when present; else worked out from the positions
  speedKmh?: number | null;
};

// [lon, lat] pairs, as the route data stores them
export type WindowLine = readonly (readonly [number, number])[];

export type WindowReason = 'no_beacon' | 'off_route' | 'no_motion' | 'no_displacement' | 'too_few_fixes';

// onDetour (DT1): the ride follows an active detour line, not the route's own
export type WindowResult =
  | { status: 'verified'; reasons: []; onDetour?: boolean }
  | { status: 'pending'; reasons: WindowReason[]; onDetour?: boolean }
  | { status: 'failed'; reasons: WindowReason[]; onDetour?: boolean };

export type WindowInput = {
  fixes: readonly WindowFix[];
  lines: readonly WindowLine[];
  // true: beacon verified; false: not; null: not known here (not tested)
  beaconOk: boolean | null;
  // DT1: the route's active detour lines, tried when the ride is off its own lines
  detours?: readonly WindowLine[];
  // V1b: the phone's activity reports since the relay started (none on the server)
  activity?: readonly { atMs: number; inVehicle: boolean }[];
};

// V1b: enough activity reports, and enough of them "in a vehicle"
export function inVehicle(activity: readonly { inVehicle: boolean }[]): boolean {
  if (activity.length < MOTION_MIN_ACTIVITY_SAMPLES) return false;
  return activity.filter((sample) => sample.inVehicle).length / activity.length >= MOTION_IN_VEHICLE_SHARE;
}

type Point = { lat: number; lon: number };

function metresBetween(a: Point, b: Point): number {
  const dLat = (b.lat - a.lat) * DEG_TO_RAD;
  const dLon = (b.lon - a.lon) * DEG_TO_RAD;
  const h = Math.sin(dLat * HALF) ** 2 + Math.cos(a.lat * DEG_TO_RAD) * Math.cos(b.lat * DEG_TO_RAD) * Math.sin(dLon * HALF) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

// The point's distance from the line and how far along the line its nearest point is, in metres. A
// local flat projection is close enough at these distances.
function onLine(line: WindowLine, point: Point): { offsetM: number; alongM: number } {
  const cosLat = Math.cos(point.lat * DEG_TO_RAD);
  const toXY = (lon: number, lat: number) => ({ x: (lon - point.lon) * DEG_TO_RAD * EARTH_RADIUS_M * cosLat, y: (lat - point.lat) * DEG_TO_RAD * EARTH_RADIUS_M });
  let best = { offsetM: Number.POSITIVE_INFINITY, alongM: 0 };
  let walked = 0;
  for (let i = 0; i + 1 < line.length; i += 1) {
    const a = toXY(line[i][0], line[i][1]);
    const b = toXY(line[i + 1][0], line[i + 1][1]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length2 = dx * dx + dy * dy;
    const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / length2));
    const px = a.x + t * dx;
    const py = a.y + t * dy;
    const offset = Math.hypot(px, py);
    const length = Math.sqrt(length2);
    if (offset < best.offsetM) best = { offsetM: offset, alongM: walked + t * length };
    walked += length;
  }
  return best;
}

const usable = (fix: WindowFix) => fix.accuracyM === null || fix.accuracyM === undefined || fix.accuracyM <= VERIFY_FIX_ACCURACY_M;

// The speed of each fix: its own reading, else from the fix before it
function speedsKmh(fixes: readonly WindowFix[]): number[] {
  return fixes.map((fix, i) => {
    if (typeof fix.speedKmh === 'number') return fix.speedKmh;
    if (i === 0) return 0;
    const seconds = (fix.atMs - fixes[i - 1].atMs) / MS_PER_S;
    return seconds > 0 ? (metresBetween(fixes[i - 1], fix) / seconds) * MPS_TO_KMH : 0;
  });
}

// Whether the speed stayed at or above the fallback for long enough without a break
function heldSpeed(fixes: readonly WindowFix[], speeds: readonly number[]): boolean {
  let runStartMs: number | null = null;
  for (let i = 0; i < fixes.length; i += 1) {
    if (speeds[i] >= MOTION_SPEED_FALLBACK_KMH) {
      // A run starts at the fix before the first fast one, since that segment was fast too
      if (runStartMs === null) runStartMs = typeof fixes[i].speedKmh === 'number' || i === 0 ? fixes[i].atMs : fixes[i - 1].atMs;
      if (fixes[i].atMs - runStartMs >= MOTION_SPEED_FALLBACK_S * MS_PER_S) return true;
    } else {
      runStartMs = null;
    }
  }
  return false;
}

export function verifyWindow({ fixes, lines, beaconOk, detours = [], activity = [] }: WindowInput): WindowResult {
  if (beaconOk === false) return { status: 'failed', reasons: ['no_beacon'] };
  const good = [...fixes].filter(usable).sort((a, b) => a.atMs - b.atMs);
  const routeLines = lines.filter((line) => line.length > 1);
  if (good.length < 2 || routeLines.length === 0) {
    const elapsedS = good.length > 0 ? (good[good.length - 1].atMs - good[0].atMs) / MS_PER_S : 0;
    return elapsedS >= VERIFY_WINDOW_MAX_S ? { status: 'failed', reasons: ['too_few_fixes'] } : { status: 'pending', reasons: ['too_few_fixes'] };
  }

  // The line the ride follows: the one nearest the first fix; off it, an active detour the whole ride
  // stays on (DT1)
  const line = routeLines.reduce((best, candidate) => (onLine(candidate, good[0]).offsetM < onLine(best, good[0]).offsetM ? candidate : best));
  const along = (candidate: WindowLine) => good.map((fix) => onLine(candidate, fix));
  const within = (places: { offsetM: number }[]) => places.every((place) => place.offsetM <= ROUTE_SNAP_DISTANCE_M);
  let placed = along(line);
  let onDetour = false;
  if (!within(placed)) {
    const detour = detours.filter((candidate) => candidate.length > 1).map(along).find(within);
    if (!detour) return { status: 'failed', reasons: ['off_route'] };
    placed = detour;
    onDetour = true;
  }
  const tag = onDetour ? { onDetour: true } : {};

  const speeds = speedsKmh(good);
  const moving = heldSpeed(good, speeds) || inVehicle(activity);
  const progressM = Math.max(...placed.map((place) => Math.abs(place.alongM - placed[0].alongM)));
  const displaced = progressM >= MIN_DISPLACEMENT_M;
  if (moving && displaced) return { status: 'verified', reasons: [], ...tag };

  const reasons: WindowReason[] = [...(moving ? [] : ['no_motion' as const]), ...(displaced ? [] : ['no_displacement' as const])];
  const elapsedS = (good[good.length - 1].atMs - good[0].atMs) / MS_PER_S;
  const slowNow = speeds[speeds.length - 1] < MOTION_SPEED_FALLBACK_KMH;
  const limitS = slowNow ? VERIFY_WINDOW_MAX_S : VERIFY_WINDOW_S;
  return elapsedS < limitS ? { status: 'pending', reasons, ...tag } : { status: 'failed', reasons, ...tag };
}
