// Ranks the routes that serve a trip (restyle: "Best match"). The quicker trip comes first (Emjay,
// 2026-10-26: a 4.7 km loop is not a better match than a 1 km ride because it has more seats); among
// trips about as quick, what will reach the rider: multicabs still before the boarding point on the
// line ridden, and their free seats. Pure: no React Native or Expo imports.

import { RANK_RIDE_SPEED_KMH, RANK_TIME_TIE_MIN, VEHICLE_CAPACITY_SEATS, WALK_SPEED_M_PER_MIN } from '../config';
import { coverageOf, ageSeconds } from '../telemetry/coverage';
import type { VehicleSnapshot } from '../telemetry/vehicle';
import { etaTo } from '../tracking/eta';
import { totalMeters, type Itinerary } from './plan';
import type { DirectedLine } from './types';

export type RankedOption = {
  itinerary: Itinerary;
  // Live or Stale vehicles on the ridden line that have not yet passed the boarding point
  approaching: number;
  freeSeats: number;
};

const MIN_PER_H = 60;

// Door-to-door minutes: the walks at walking speed, the ride at an average multicab speed
export function tripMinutes(itinerary: Itinerary): number {
  return itinerary.walkM / WALK_SPEED_M_PER_MIN + (itinerary.rideKm / RANK_RIDE_SPEED_KMH) * MIN_PER_H;
}

// Trips within RANK_TIME_TIE_MIN of the quickest count as equally quick and come first, by most
// free seats, then most approaching multicabs, then the shorter walk, then the shorter trip; slower
// trips follow, quickest first
export function rankRouteOptions(
  options: readonly Itinerary[],
  vehicles: readonly VehicleSnapshot[],
  lines: readonly DirectedLine[],
  nowMs: number,
): RankedOption[] {
  const ranked = options.map((itinerary) => {
    const ride = itinerary.legs[1];
    const coming = vehicles.filter(
      (vehicle) =>
        vehicle.lineId === ride.lineId &&
        !vehicle.hidden &&
        coverageOf(ageSeconds(vehicle.lastPacketMs, nowMs)) !== 'none' &&
        etaTo(vehicle, lines, ride.from, undefined, { round: false }).kind !== 'passed',
    );
    return {
      itinerary,
      approaching: coming.length,
      freeSeats: coming.reduce((sum, vehicle) => sum + Math.max(0, VEHICLE_CAPACITY_SEATS - vehicle.seatsTaken), 0),
    };
  });
  const quickest = Math.min(...options.map(tripMinutes));
  // 0 for the trips about as quick as the quickest, their own minutes for the slower ones
  const slowness = (option: RankedOption) => {
    const minutes = tripMinutes(option.itinerary);
    return minutes <= quickest + RANK_TIME_TIE_MIN ? 0 : minutes;
  };
  return ranked.sort(
    (a, b) =>
      slowness(a) - slowness(b) ||
      b.freeSeats - a.freeSeats ||
      b.approaching - a.approaching ||
      a.itinerary.walkM - b.itinerary.walkM ||
      totalMeters(a.itinerary) - totalMeters(b.itinerary),
  );
}
