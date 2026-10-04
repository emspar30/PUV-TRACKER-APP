// Seat tiers by seats taken, of VEHICLE_CAPACITY_SEATS (PRD 7.3): 0 to 6 green "Seats available",
// 7 to 12 amber "Filling up", 13 or more red "Full".

import { OCCUPANCY_AMBER_MAX_TAKEN, OCCUPANCY_GREEN_MAX_TAKEN, VEHICLE_CAPACITY_SEATS } from '../config';

export type SeatTier = 'green' | 'amber' | 'red';

export function seatTier(seatsTaken: number): SeatTier {
  if (seatsTaken <= OCCUPANCY_GREEN_MAX_TAKEN) return 'green';
  if (seatsTaken <= OCCUPANCY_AMBER_MAX_TAKEN) return 'amber';
  return 'red';
}

// Seats taken, kept between 0 and the vehicle's capacity
export function clampSeats(seatsTaken: number): number {
  return Math.min(VEHICLE_CAPACITY_SEATS, Math.max(0, Math.round(seatsTaken)));
}
