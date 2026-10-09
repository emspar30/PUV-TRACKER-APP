// RR3: My Ride on the shipped lines and stops (R1, R2, R3, R4, R5, R14): trips snap to the real
// geometry, follow the direction of travel, and the fare follows the ride distance.

import { getSeedRouteData } from '../../data/routeSource';
import { ROUTE_DATA_VERSION } from '../../data/seed/routes';
import { FARE_BASE_KM, MAX_WALK_PER_LEG_M } from '../config';
import { computeFare } from '../fare/fare';
import { planTrip } from '../routing/plan';

const data = getSeedRouteData();
const stop = (code: string) => {
  const found = data.stops.find((s) => s.code === code);
  if (!found) throw new Error(`no stop ${code}`);
  return found;
};
const ride = (from: string, to: string) => {
  const plan = planTrip(data.lines, stop(from), stop(to));
  if (!plan.ok) return { ok: false as const, reason: plan.reason };
  const leg = plan.itinerary.legs[1];
  return { ok: true as const, leg, walks: [plan.itinerary.legs[0], plan.itinerary.legs[2]] };
};

describe('real route data (RR3)', () => {
  it('is data version 7, with both legs of R1 and R2, and R14 outbound only', () => {
    expect(ROUTE_DATA_VERSION).toBe(7);
    const legs = (code: string) => data.lines.filter((l) => l.routeCode === code).map((l) => l.direction).sort();
    expect(legs('R1')).toEqual(['outbound', 'return']);
    expect(legs('R2')).toEqual(['outbound', 'return']);
    expect(legs('R14')).toEqual(['outbound']);
  });

  it.each([
    ['NIS', 'LIB', 'R3'],
    ['TAL', 'FSU', 'R4'],
    ['LAN', 'LBT', 'R5'],
    ['ROB', 'TAL', 'R14'],
    ['GRC', 'LIB', null],
    ['BAN', 'SMB', null],
  ])('%s to %s is planned%s, walks within the limit, and the fare follows the ride', (from, to, routeCode) => {
    const result = ride(from, to);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    if (routeCode) expect(result.leg.routeCode).toBe(routeCode);
    for (const walk of result.walks) expect(walk.distanceM).toBeLessThanOrEqual(MAX_WALK_PER_LEG_M);
    const line = data.lines.find((l) => l.routeCode === result.leg.routeCode)!;
    const fare = computeFare(result.leg.distanceKm, line.fare, 1);
    expect(fare.rounded).toBeGreaterThanOrEqual(line.fare.baseFare);
    if (result.leg.distanceKm > FARE_BASE_KM) expect(fare.rounded).toBeGreaterThan(line.fare.baseFare);
  });

  it('R14 runs Robinsons to Taligaman only: the way back is refused until its return is traced', () => {
    expect(ride('ROB', 'TAL')).toMatchObject({ ok: true, leg: { routeCode: 'R14', direction: 'outbound' } });
    expect(ride('TAL', 'ROB')).toEqual({ ok: false, reason: 'destination_not_ahead' });
  });

  it('known R4 ride: Taligaman to FSUU along the return, about 11 km', () => {
    const result = ride('TAL', 'FSU');
    expect(result.ok && result.leg.distanceKm).toBeCloseTo(11.0, 0);
  });
});
