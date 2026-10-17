// The demo vehicles repository (AF3): simulated PUVs on the route that is asked for, refreshed every
// DEMO_TICK_MS. It imports no service and sends nothing; everything is computed on the phone.
// Pure: no React Native or Expo imports, so it runs in plain Node tests.

import { DEMO_EMPTY_ROUTES, DEMO_STRESS_MARKERS, DEMO_TICK_MS } from '../../shared/config';
import { demoFleetConfig, demoSnapshot, planDemoFleet, type DemoVehiclePlan } from '../../shared/demo/simulate';
import { withReturnLegs } from '../../shared/routing/loop';
import type { DirectedLine, RouteStop } from '../../shared/routing/types';
import type { VehiclesRepository } from '../repositories/types';

export type DemoClock = {
  now(): number;
  setInterval(callback: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
};

const systemClock: DemoClock = {
  now: () => Date.now(),
  setInterval: (callback, ms) => setInterval(callback, ms),
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
};

export type DemoVehiclesOptions = {
  seed: number;
  // Development stress setting: DEMO_STRESS_MARKERS vehicles on the asked-for route
  stress?: boolean;
  clock?: DemoClock;
};

export function createDemoVehicles(
  lines: readonly DirectedLine[],
  stops: readonly RouteStop[],
  { seed, stress = false, clock = systemClock }: DemoVehiclesOptions,
): VehiclesRepository {
  const config = demoFleetConfig(seed);
  // B2: a route with one stored leg drives it back the other way too, so vehicles go round without
  // laying over and jumping back to the start
  const looped = withReturnLegs(lines);
  // Each route's vehicles are planned once, when first asked for
  const plans = new Map<string, DemoVehiclePlan[]>();
  const plansFor = (routeCode: string) => {
    let planned = plans.get(routeCode);
    if (!planned) {
      // CF1: a route in DEMO_EMPTY_ROUTES has none, so the coverage nudge can be seen (not in the stress setting)
      planned =
        !stress && DEMO_EMPTY_ROUTES.includes(routeCode)
          ? []
          : planDemoFleet(looped, stops, config, { routeCodes: [routeCode], perRoute: stress ? DEMO_STRESS_MARKERS : undefined });
      plans.set(routeCode, planned);
    }
    return planned;
  };

  return {
    source: 'demo',
    subscribe: (routeCode, listener) => {
      const fleet = plansFor(routeCode);
      const emit = () => {
        const now = clock.now();
        listener(fleet.map((plan) => demoSnapshot(plan, now, config)));
      };
      emit();
      const handle = clock.setInterval(emit, DEMO_TICK_MS);
      return () => clock.clearInterval(handle);
    },
  };
}
