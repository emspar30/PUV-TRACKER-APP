// CA1: the offline assistant's answers, worked out from what is already on the phone: the planner
// and fare for a trip (as My Rides), the coverage states and CF1's alternative for a route (as the
// Map tab), the nearest stop. The answer is data; the screen words it (strings) and adds the chips.
// Pure: no React Native or Expo imports.

import { ASSISTANT_SAME_PLACE_M } from '../config';
import { haversineMeters, type LatLon } from '../geo/haversine';
import { bestAlternative, type Alternative } from '../routing/alternatives';
import { nearestStop } from '../routing/describe';
import type { SearchablePlace } from '../routing/placeSearch';
import { fareForItinerary, planOptions, planTrip, type PlanFailure } from '../routing/plan';
import type { DirectedLine, RouteStop } from '../routing/types';
import { ageSeconds, coverageOf } from '../telemetry/coverage';
import { isGhostAge } from '../telemetry/deadReckoning';
import type { VehicleSnapshot } from '../telemetry/vehicle';

import type { Intent, PlaceSlot, TripIntent } from './intent';
import { resolvePlace } from './resolve';

// A point in an answer: a place by its name, or the user's own position
export type AnswerPoint = LatLon & { title: string; mine: boolean };

export type AssistantContext = {
  lines: DirectedLine[];
  stops: RouteStop[];
  places: readonly SearchablePlace[];
  // The GPS fix, the simulated stop or the map pin (G0); its title is how the screen names it
  position: (LatLon & { title: string }) | null;
  // The rider's fare type as a multiplier (discountMultiplier)
  fareMultiplier: number;
  live: {
    // teamOnly: live markers are for team accounts only (PRD 0.7), so nothing can be said
    access: 'open' | 'teamOnly';
    night: boolean;
    // The vehicles of the routes asked about and the routes overlapping them; nowMs 0 while loading
    vehicles: readonly VehicleSnapshot[];
    nowMs: number;
  };
};

export type RouteStatus = {
  live: number;
  estimated: number;
  stale: number;
  // Seconds since the newest position on the route, null with no vehicle at all
  youngestAgeS: number | null;
};

export type Answer =
  | {
      kind: 'trip';
      focus: TripIntent['focus'];
      from: AnswerPoint;
      to: AnswerPoint;
      routeCode: string;
      routeName: string;
      walkToM: number;
      walkFromM: number;
      rideKm: number;
      fare: number;
      // The other routes that serve the trip, best first
      others: string[];
    }
  | {
      kind: 'tripFail';
      reason: PlanFailure | 'same_place';
      from: AnswerPoint;
      to: AnswerPoint;
      originDistanceM: number | null;
      destinationDistanceM: number | null;
    }
  // A name fits several places: the intent to ask again with one of them in that slot
  | { kind: 'choose'; slot: 'from' | 'to' | 'near'; options: SearchablePlace[]; intent: Intent }
  | { kind: 'notFound'; text: string }
  | { kind: 'needPosition'; topic: 'trip' | 'nearest' }
  | { kind: 'needDestination' }
  | ({ kind: 'status'; routeCode: string; routeName: string; night: boolean; alternative: Alternative | null } & RouteStatus)
  | { kind: 'statusHidden'; routeCode: string }
  | { kind: 'statusLoading'; routeCode: string }
  | { kind: 'unknownRoute'; routeCode: string; routes: string[] }
  | { kind: 'whichRoute'; routes: string[] }
  | { kind: 'nearest'; from: AnswerPoint; stop: RouteStop; distanceM: number; routes: string[] }
  | { kind: 'help' };

export function routeCodes(lines: readonly DirectedLine[]): string[] {
  return [...new Set(lines.map((line) => line.routeCode))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export function routeName(lines: readonly DirectedLine[], code: string): string {
  const line = lines.find((candidate) => candidate.routeCode === code && candidate.direction === 'outbound') ?? lines.find((candidate) => candidate.routeCode === code);
  return line ? (line.name.split(',')[0] ?? line.name) : code;
}

// The counts by coverage state: Live under 90 s, Estimated (CF1) up to 5 minutes, then Stale; a
// vehicle with No data or hidden for a moment (demo restart) is not counted
export function routeStatus(vehicles: readonly VehicleSnapshot[], routeCode: string, nowMs: number): RouteStatus {
  const status: RouteStatus = { live: 0, estimated: 0, stale: 0, youngestAgeS: null };
  for (const vehicle of vehicles) {
    if (vehicle.routeCode !== routeCode || vehicle.hidden) continue;
    const ageS = ageSeconds(vehicle.lastPacketMs, nowMs);
    status.youngestAgeS = status.youngestAgeS === null ? ageS : Math.min(status.youngestAgeS, ageS);
    const coverage = coverageOf(ageS);
    if (coverage === 'live') status.live += 1;
    else if (isGhostAge(ageS)) status.estimated += 1;
    else if (coverage === 'stale') status.stale += 1;
  }
  return status;
}

type Point = { kind: 'point'; point: AnswerPoint } | { kind: 'answer'; answer: Answer };

function pointOf(slot: PlaceSlot | null, which: 'from' | 'to' | 'near', intent: Intent, context: AssistantContext): Point {
  if (!slot) {
    if (!context.position) return { kind: 'answer', answer: { kind: 'needPosition', topic: intent.kind === 'nearest' ? 'nearest' : 'trip' } };
    return { kind: 'point', point: { ...context.position, mine: true } };
  }
  const resolved = resolvePlace(slot, context.places);
  if (resolved.kind === 'none') return { kind: 'answer', answer: { kind: 'notFound', text: resolved.text } };
  if (resolved.kind === 'choose') return { kind: 'answer', answer: { kind: 'choose', slot: which, options: resolved.options, intent } };
  const { place } = resolved;
  return { kind: 'point', point: { lat: place.lat, lon: place.lon, title: place.title, mine: false } };
}

function tripAnswer(intent: TripIntent, context: AssistantContext): Answer {
  if (!intent.to) return { kind: 'needDestination' };
  // The destination first: "Did you mean" for it comes before asking for a position
  const to = pointOf(intent.to, 'to', intent, context);
  if (to.kind === 'answer') return to.answer;
  const from = pointOf(intent.from, 'from', intent, context);
  if (from.kind === 'answer') return from.answer;
  const ends = { from: from.point, to: to.point };
  if (haversineMeters(ends.from, ends.to) < ASSISTANT_SAME_PLACE_M) {
    return { kind: 'tripFail', reason: 'same_place', ...ends, originDistanceM: null, destinationDistanceM: null };
  }
  const options = planOptions(context.lines, ends.from, ends.to);
  const best = options[0];
  if (!best) {
    const plan = planTrip(context.lines, ends.from, ends.to);
    return plan.ok
      ? { kind: 'tripFail', reason: 'no_routes', ...ends, originDistanceM: null, destinationDistanceM: null }
      : { kind: 'tripFail', reason: plan.reason, ...ends, originDistanceM: plan.originDistanceM, destinationDistanceM: plan.destinationDistanceM };
  }
  const ride = best.legs[1];
  return {
    kind: 'trip',
    focus: intent.focus,
    ...ends,
    routeCode: ride.routeCode,
    routeName: routeName(context.lines, ride.routeCode),
    walkToM: Math.round(best.legs[0].distanceM),
    walkFromM: Math.round(best.legs[2].distanceM),
    rideKm: best.rideKm,
    fare: fareForItinerary(context.lines, best, context.fareMultiplier).rounded,
    others: options.slice(1).map((option) => option.legs[1].routeCode),
  };
}

function statusAnswer(routeCode: string | null, context: AssistantContext): Answer {
  const routes = routeCodes(context.lines);
  if (!routeCode) return { kind: 'whichRoute', routes };
  if (!routes.includes(routeCode)) return { kind: 'unknownRoute', routeCode, routes };
  const { live } = context;
  if (live.access === 'teamOnly') return { kind: 'statusHidden', routeCode };
  if (live.nowMs === 0) return { kind: 'statusLoading', routeCode };
  const status = routeStatus(live.vehicles, routeCode, live.nowMs);
  // As the Map tab's coverage nudge: an alternative only by day, when the route has no Live vehicle
  const alternative =
    status.live === 0 && !live.night
      ? bestAlternative({
          routeCode,
          lines: context.lines,
          stops: context.stops,
          vehicles: live.vehicles,
          nowMs: live.nowMs,
          anchor: context.position,
        })
      : null;
  return { kind: 'status', routeCode, routeName: routeName(context.lines, routeCode), night: live.night, alternative, ...status };
}

function nearestAnswer(near: PlaceSlot | null, intent: Intent, context: AssistantContext): Answer {
  const from = pointOf(near, 'near', intent, context);
  if (from.kind === 'answer') return from.answer;
  const found = nearestStop(context.stops, from.point);
  if (!found) return { kind: 'help' };
  return {
    kind: 'nearest',
    from: from.point,
    stop: found.stop,
    distanceM: Math.round(found.distanceM),
    routes: [...(found.stop.routeCodes ?? [])],
  };
}

export function answer(intent: Intent, context: AssistantContext): Answer {
  switch (intent.kind) {
    case 'trip':
      return tripAnswer(intent, context);
    case 'status':
      return statusAnswer(intent.routeCode, context);
    case 'nearest':
      return nearestAnswer(intent.near, intent, context);
    case 'help':
      return { kind: 'help' };
  }
}

// The intent asked again with a place picked from "Did you mean"
export function withChoice(intent: Intent, slot: 'from' | 'to' | 'near', place: SearchablePlace): Intent {
  const picked: PlaceSlot = { placeId: place.id, title: place.title };
  if (intent.kind === 'trip' && slot !== 'near') return { ...intent, [slot]: picked };
  if (intent.kind === 'nearest' && slot === 'near') return { ...intent, near: picked };
  return intent;
}

// The routes a set of intents needs live vehicles for: each route asked about and its overlapping
// routes (for the alternative), so the screen subscribes to nothing until a status is asked
export function routesToWatch(intents: readonly Intent[], stops: readonly RouteStop[]): string[] {
  const codes = new Set<string>();
  for (const intent of intents) {
    if (intent.kind !== 'status' || !intent.routeCode) continue;
    codes.add(intent.routeCode);
    for (const stop of stops) {
      if (stop.routeCodes?.includes(intent.routeCode)) for (const code of stop.routeCodes) codes.add(code);
    }
  }
  return [...codes].sort();
}
