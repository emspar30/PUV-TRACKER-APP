// Demo vehicles (AF3): simulated PUVs that drive the stored route lines in their direction of travel,
// stop at the route's stops (or every DEMO_STOP_SPACING_KM when it has none), change seats at each
// stop, and, one per route, go silent for a while. Everything is worked out from the seed and the
// clock, so the same seed and time always give the same positions. Pure: no React Native or Expo.

import {
  DEMO_SEAT_CHANGE_MAX,
  DEMO_SILENT_GAP_S,
  DEMO_SILENT_SEND_S,
  DEMO_SPEED_MAX_KMH,
  DEMO_SPEED_MIN_KMH,
  DEMO_SPEED_SAMPLE_S,
  DEMO_STOP_MAX_S,
  DEMO_STOP_MIN_S,
  DEMO_STOP_SPACING_KM,
  DEMO_VEHICLES_MAX_PER_ROUTE,
  DEMO_VEHICLES_MIN_PER_ROUTE,
  OCCUPANCY_AMBER_MAX_TAKEN,
  OCCUPANCY_GREEN_MAX_TAKEN,
  ROUTE_STOP_MAX_DISTANCE_M,
  STATIONARY_DURATION_S,
  VEHICLE_CAPACITY_SEATS,
} from '../config';
import { haversineMeters } from '../geo/haversine';
import { projectOntoLine } from '../geo/line';
import type { DirectedLine, RouteStop } from '../routing/types';
import { clampSeats } from '../telemetry/occupancy';
import type { SpeedSample, VehicleSnapshot } from '../telemetry/vehicle';
import { stopsForRoute } from '../ui/routeVisibility';
import { childSeed, seededRandom } from '../util/random';

export type DemoFleetConfig = {
  seed: number;
  minPerRoute: number;
  maxPerRoute: number;
  minSpeedKmh: number;
  maxSpeedKmh: number;
  minStopS: number;
  maxStopS: number;
  stopSpacingKm: number;
  seatChangeMax: number;
  silentSendS: number;
  silentGapS: number;
};

export function demoFleetConfig(seed: number): DemoFleetConfig {
  return {
    seed,
    minPerRoute: DEMO_VEHICLES_MIN_PER_ROUTE,
    maxPerRoute: DEMO_VEHICLES_MAX_PER_ROUTE,
    minSpeedKmh: DEMO_SPEED_MIN_KMH,
    maxSpeedKmh: DEMO_SPEED_MAX_KMH,
    minStopS: DEMO_STOP_MIN_S,
    maxStopS: DEMO_STOP_MAX_S,
    stopSpacingKm: DEMO_STOP_SPACING_KM,
    seatChangeMax: DEMO_SEAT_CHANGE_MAX,
    silentSendS: DEMO_SILENT_SEND_S,
    silentGapS: DEMO_SILENT_GAP_S,
  };
}

type PreparedLine = { id: string; coordinates: DirectedLine['coordinates']; cumKm: number[]; lengthKm: number };

// One part of a vehicle's round: driving from one distance to another on a line, or standing still
type Leg = { line: number; startS: number; durationS: number; fromKm: number; toKm: number; seats: number };

export type DemoVehiclePlan = {
  id: string;
  label: string;
  routeCode: string;
  lines: PreparedLine[];
  legs: Leg[];
  cycleS: number;
  phaseS: number;
  silent: boolean;
  silentPhaseS: number;
};

export type DemoPosition = { lineId: string; chainageKm: number; lat: number; lon: number; headingDeg: number; speedKmh: number; seats: number };

const METERS_PER_KM = 1000;
const S_PER_HOUR = 3600;
const MS_PER_S = 1000;
const FULL_TURN_DEG = 360;
const HALF_TURN_DEG = 180;
const DEG_TO_RAD = Math.PI / HALF_TURN_DEG;
const LABEL_DIGITS = 2;
// Stops this close to either end of a line are left to the terminal stop
const END_MARGIN_KM = 0.05;
// Starting seats cycle through the three tiers, so a route shows green, amber and red
const TIER_MARGIN = 2;
const START_SEATS = [OCCUPANCY_GREEN_MAX_TAKEN - TIER_MARGIN, OCCUPANCY_AMBER_MAX_TAKEN - TIER_MARGIN, VEHICLE_CAPACITY_SEATS - 1];
// Starting seats vary by up to this many either way
const SEAT_JITTER = 1;
const MIN_LINE_POINTS = 2;
// Outbound lines first in a round
const directionOrder = (line: DirectedLine) => (line.direction === 'outbound' ? 0 : 1);

function prepare(line: DirectedLine): PreparedLine {
  const cumKm = [0];
  for (let i = 1; i < line.coordinates.length; i += 1) {
    const [lonA, latA] = line.coordinates[i - 1];
    const [lonB, latB] = line.coordinates[i];
    cumKm.push(cumKm[i - 1] + haversineMeters({ lat: latA, lon: lonA }, { lat: latB, lon: lonB }) / METERS_PER_KM);
  }
  return { id: line.id, coordinates: line.coordinates, cumKm, lengthKm: cumKm[cumKm.length - 1] };
}

// Where the vehicle stands still on a line: the route's stops near it, in order, or evenly spaced
function stopChainages(line: PreparedLine, stops: readonly RouteStop[], spacingKm: number): number[] {
  const near = stops
    .map((stop) => projectOntoLine(line.coordinates, stop))
    .filter((p) => p.offsetM <= ROUTE_STOP_MAX_DISTANCE_M)
    .map((p) => p.chainageKm)
    .filter((km) => km > END_MARGIN_KM && km < line.lengthKm - END_MARGIN_KM)
    .sort((a, b) => a - b);
  if (near.length > 0) return near;
  const evenly: number[] = [];
  for (let km = spacingKm; km < line.lengthKm - END_MARGIN_KM; km += spacingKm) evenly.push(km);
  return evenly;
}

// The vehicles for every route: between the minimum and maximum per route (or exactly `perRoute`)
export function planDemoFleet(
  allLines: readonly DirectedLine[],
  allStops: readonly RouteStop[],
  config: DemoFleetConfig,
  options: { perRoute?: number; routeCodes?: readonly string[] } = {},
): DemoVehiclePlan[] {
  const routeCodes = options.routeCodes ?? [...new Set(allLines.map((line) => line.routeCode))];
  const plans: DemoVehiclePlan[] = [];
  let number = 0;

  for (const routeCode of routeCodes) {
    // A round drives the outbound, then the return; a single stored leg starts again from its beginning
    const ofRoute = allLines
      .filter((line) => line.routeCode === routeCode && line.coordinates.length >= MIN_LINE_POINTS)
      .sort((a, b) => directionOrder(a) - directionOrder(b));
    if (ofRoute.length === 0) continue;
    const lines = ofRoute.map(prepare);
    const stops = stopsForRoute(allLines, allStops, routeCode);
    const stopKm = lines.map((line) => stopChainages(line, stops, config.stopSpacingKm));
    const routeRandom = seededRandom(childSeed(config.seed, routeCode));
    const count = options.perRoute ?? routeRandom.int(config.minPerRoute, config.maxPerRoute);
    const silentIndex = routeRandom.int(0, count - 1);

    for (let index = 0; index < count; index += 1) {
      number += 1;
      const random = seededRandom(childSeed(config.seed, `${routeCode}/${index}`));
      const legs: Leg[] = [];
      let seats = clampSeats(START_SEATS[index % START_SEATS.length] + random.int(-SEAT_JITTER, SEAT_JITTER));
      let clockS = 0;
      lines.forEach((line, lineIndex) => {
        let atKm = 0;
        for (const km of [...stopKm[lineIndex], line.lengthKm]) {
          const speedKmh = random.between(config.minSpeedKmh, config.maxSpeedKmh);
          const driveS = ((km - atKm) / speedKmh) * S_PER_HOUR;
          legs.push({ line: lineIndex, startS: clockS, durationS: driveS, fromKm: atKm, toKm: km, seats });
          clockS += driveS;
          seats = clampSeats(seats + random.int(-config.seatChangeMax, config.seatChangeMax));
          const dwellS = random.between(config.minStopS, config.maxStopS);
          legs.push({ line: lineIndex, startS: clockS, durationS: dwellS, fromKm: km, toKm: km, seats });
          clockS += dwellS;
          atKm = km;
        }
      });
      plans.push({
        id: `demo-${routeCode}-${index + 1}`,
        label: `DEMO ${String(number).padStart(LABEL_DIGITS, '0')}`,
        routeCode,
        lines,
        legs,
        cycleS: clockS,
        phaseS: random.between(0, clockS),
        silent: options.perRoute === undefined && index === silentIndex,
        silentPhaseS: random.between(0, config.silentSendS + config.silentGapS),
      });
    }
  }
  return plans;
}

const mod = (value: number, size: number) => ((value % size) + size) % size;

function pointOnLine(line: PreparedLine, km: number): { lat: number; lon: number; headingDeg: number } {
  const target = Math.min(Math.max(km, 0), line.lengthKm);
  let low = 0;
  let high = line.cumKm.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (line.cumKm[middle] <= target) low = middle;
    else high = middle;
  }
  const [lonA, latA] = line.coordinates[low];
  const [lonB, latB] = line.coordinates[high];
  const span = line.cumKm[high] - line.cumKm[low];
  const t = span > 0 ? (target - line.cumKm[low]) / span : 0;
  const lat = latA + t * (latB - latA);
  const lon = lonA + t * (lonB - lonA);
  const headingDeg = mod(Math.atan2((lonB - lonA) * Math.cos(lat * DEG_TO_RAD), latB - latA) / DEG_TO_RAD, FULL_TURN_DEG);
  return { lat, lon, headingDeg };
}

// Where a vehicle is at a time (seconds since 1970)
export function positionAt(plan: DemoVehiclePlan, timeS: number): DemoPosition {
  const u = mod(timeS + plan.phaseS, plan.cycleS);
  let low = 0;
  let high = plan.legs.length - 1;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (plan.legs[middle].startS <= u) low = middle;
    else high = middle - 1;
  }
  const leg = plan.legs[low];
  const fraction = leg.durationS > 0 ? Math.min(1, (u - leg.startS) / leg.durationS) : 0;
  const chainageKm = leg.fromKm + fraction * (leg.toKm - leg.fromKm);
  const line = plan.lines[leg.line];
  const speedKmh = leg.durationS > 0 ? ((leg.toKm - leg.fromKm) / leg.durationS) * S_PER_HOUR : 0;
  return { lineId: line.id, chainageKm, ...pointOnLine(line, chainageKm), speedKmh, seats: leg.seats };
}

// When the vehicle last sent a position: now, unless it is the route's silent vehicle in its quiet spell
export function lastPacketS(plan: DemoVehiclePlan, timeS: number, config: Pick<DemoFleetConfig, 'silentSendS' | 'silentGapS'>): number {
  if (!plan.silent) return timeS;
  const inPeriod = mod(timeS + plan.silentPhaseS, config.silentSendS + config.silentGapS);
  return inPeriod < config.silentSendS ? timeS : timeS - (inPeriod - config.silentSendS);
}

export function demoSnapshot(
  plan: DemoVehiclePlan,
  nowMs: number,
  config: Pick<DemoFleetConfig, 'silentSendS' | 'silentGapS'>,
): VehicleSnapshot {
  const nowS = nowMs / MS_PER_S;
  const packetS = lastPacketS(plan, nowS, config);
  const at = positionAt(plan, packetS);
  // Speeds as of the last packet, far enough back for the stopped check
  const recentSpeeds: SpeedSample[] = [];
  for (let back = STATIONARY_DURATION_S + DEMO_SPEED_SAMPLE_S; back >= 0; back -= DEMO_SPEED_SAMPLE_S) {
    recentSpeeds.push({ atMs: (packetS - back) * MS_PER_S, speedKmh: positionAt(plan, packetS - back).speedKmh });
  }
  return {
    id: plan.id,
    label: plan.label,
    routeCode: plan.routeCode,
    lineId: at.lineId,
    lat: at.lat,
    lon: at.lon,
    headingDeg: at.headingDeg,
    speedKmh: at.speedKmh,
    seatsTaken: at.seats,
    lastPacketMs: packetS * MS_PER_S,
    recentSpeeds,
    demo: true,
  };
}
