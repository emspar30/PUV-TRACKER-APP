// Ranks the routes that serve a trip (restyle: "Best match"). What counts is what will reach the
// rider: multicabs still before the boarding point on the line ridden, and their free seats.
// Pure: no React Native or Expo imports.

import { VEHICLE_CAPACITY_SEATS } from '../config';
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

// Most free seats first, then most approaching multicabs, then the shorter walk, then the shorter trip
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
        etaTo(vehicle, lines, ride.from).kind !== 'passed',
    );
    return {
      itinerary,
      approaching: coming.length,
      freeSeats: coming.reduce((sum, vehicle) => sum + Math.max(0, VEHICLE_CAPACITY_SEATS - vehicle.seatsTaken), 0),
    };
  });
  return ranked.sort(
    (a, b) =>
      b.freeSeats - a.freeSeats ||
      b.approaching - a.approaching ||
      a.itinerary.walkM - b.itinerary.walkM ||
      totalMeters(a.itinerary) - totalMeters(b.itinerary),
  );
}
