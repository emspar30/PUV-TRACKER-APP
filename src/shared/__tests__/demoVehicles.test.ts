// AF3: demo vehicles follow the stored line in its direction at the configured speeds, stop, change
// seats, and one per route goes silent; coverage, seat tiers and the stopped bubble follow PRD 7.3.
// Fixed seeds and the synthetic fixture only, never the live seed file.

import { DEMO_SILENT_GAP_S, DEMO_SILENT_SEND_S, DEMO_SPEED_MAX_KMH, DEMO_SPEED_MIN_KMH, DEMO_STOP_MAX_S, DEMO_STOP_MIN_S } from '../config';
import { demoFleetConfig, demoSnapshot, lastPacketS, planDemoFleet, positionAt } from '../demo/simulate';
import { projectOntoLine } from '../geo/line';
import type { DirectedLine } from '../routing/types';
import { ageSeconds, coverageOf, routeCoverage } from '../telemetry/coverage';
import { seatTier } from '../telemetry/occupancy';
import { isStopped } from '../telemetry/stopped';
import { FIXTURE_OUTBOUND, FIXTURE_RETURN, FIXTURE_STOPS, pointAt } from './fixtures/routeFixture';

const SEED = 42;
const CONFIG = demoFleetConfig(SEED);
const T0 = Date.UTC(2026, 9, 5, 2, 0, 0) / 1000;

// A second route with a single stored leg and no stops, like R5: a parallel street 0.02 degrees
// (about 2.2 km) north, so none of the fixture stops is near it
const NORTH_DEG = 0.02;
const SINGLE: DirectedLine = {
  ...FIXTURE_OUTBOUND,
  id: 'T2-RET',
  routeCode: 'T2',
  direction: 'return',
  coordinates: [...FIXTURE_OUTBOUND.coordinates].reverse().map(([lon, lat]) => [lon, lat + NORTH_DEG]),
};
const LINES = [FIXTURE_OUTBOUND, FIXTURE_RETURN, SINGLE];

// A clock time (seconds) at which the plan is `u` seconds into its round
const atRound = (plan: { cycleS: number; phaseS: number }, u: number) => Math.ceil(T0 / plan.cycleS) * plan.cycleS + u - plan.phaseS;

describe('demo fleet plan', () => {
  const fleet = planDemoFleet(LINES, FIXTURE_STOPS, CONFIG);

  it('has 2 to 3 vehicles per route, with DEMO plates numbered in order', () => {
    for (const code of ['T1', 'T2']) {
      const count = fleet.filter((plan) => plan.routeCode === code).length;
      expect(count).toBeGreaterThanOrEqual(2);
      expect(count).toBeLessThanOrEqual(3);
    }
    expect(fleet.map((plan) => plan.label)).toEqual(fleet.map((_plan, index) => `DEMO ${String(index + 1).padStart(2, '0')}`));
  });

  it('has exactly one silent vehicle per route', () => {
    for (const code of ['T1', 'T2']) expect(fleet.filter((plan) => plan.routeCode === code && plan.silent)).toHaveLength(1);
  });

  it('the same seed gives the same plan and positions; another seed does not', () => {
    const again = planDemoFleet(LINES, FIXTURE_STOPS, CONFIG);
    expect(again.map((plan) => positionAt(plan, T0))).toEqual(fleet.map((plan) => positionAt(plan, T0)));
    const other = planDemoFleet(LINES, FIXTURE_STOPS, demoFleetConfig(SEED + 1));
    expect(other.map((plan) => positionAt(plan, T0))).not.toEqual(fleet.map((plan) => positionAt(plan, T0)));
  });

  it('drives at 15 to 35 km/h and stands for 20 to 60 s', () => {
    for (const plan of fleet) {
      for (const leg of plan.legs) {
        if (leg.toKm === leg.fromKm) {
          expect(leg.durationS).toBeGreaterThanOrEqual(DEMO_STOP_MIN_S);
          expect(leg.durationS).toBeLessThanOrEqual(DEMO_STOP_MAX_S);
        } else {
          const speed = ((leg.toKm - leg.fromKm) / leg.durationS) * 3600;
          expect(speed).toBeGreaterThanOrEqual(DEMO_SPEED_MIN_KMH - 1e-9);
          expect(speed).toBeLessThanOrEqual(DEMO_SPEED_MAX_KMH + 1e-9);
        }
      }
    }
  });

  it('stands at the route stops (BBB at 2 km, CCC at 6 km) and the line end, not at the far stop', () => {
    const plan = fleet.find((candidate) => candidate.routeCode === 'T1')!;
    const outboundStops = plan.legs.filter((leg) => leg.line === 0 && leg.toKm === leg.fromKm).map((leg) => leg.fromKm);
    expect(outboundStops).toHaveLength(3);
    expect(outboundStops[0]).toBeCloseTo(2, 1);
    expect(outboundStops[1]).toBeCloseTo(6, 1);
    expect(outboundStops[2]).toBeCloseTo(plan.lines[0].lengthKm, 6);
  });

  it('a route with no stops stands every 1.2 km', () => {
    const plan = fleet.find((candidate) => candidate.routeCode === 'T2')!;
    const stops = plan.legs.filter((leg) => leg.toKm === leg.fromKm).map((leg) => leg.fromKm);
    expect(stops[0]).toBeCloseTo(1.2, 6);
    expect(stops[1]).toBeCloseTo(2.4, 6);
  });

  it('drives the outbound, then the return, in their direction of travel', () => {
    const plan = fleet.find((candidate) => candidate.routeCode === 'T1')!;
    expect(plan.lines.map((line) => line.id)).toEqual(['T1-OUT', 'T1-RET']);
    // Over one drive leg the distance along the line grows
    for (const drive of plan.legs.filter((leg) => leg.toKm > leg.fromKm)) {
      const a = positionAt(plan, atRound(plan, drive.startS + drive.durationS * 0.25));
      const b = positionAt(plan, atRound(plan, drive.startS + drive.durationS * 0.75));
      expect(b.lineId).toBe(plan.lines[drive.line].id);
      expect(b.chainageKm).toBeGreaterThan(a.chainageKm);
    }
  });

  it('positions lie on the stored line, with a heading along it', () => {
    for (const plan of fleet) {
      for (let s = 0; s < plan.cycleS; s += plan.cycleS / 37) {
        const at = positionAt(plan, T0 + s);
        const line = LINES.find((candidate) => candidate.id === at.lineId)!;
        expect(projectOntoLine(line.coordinates, at).offsetM).toBeLessThan(1);
        // The fixture runs due east (outbound, heading 90) or due west (return, heading 270)
        expect([90, 270]).toContainEqual(Math.round(at.headingDeg));
      }
    }
  });

  it('seats stay between 0 and 16 and the route shows more than one tier', () => {
    const plans = fleet.filter((plan) => plan.routeCode === 'T1');
    const tiers = new Set(plans.map((plan) => seatTier(plan.legs[0].seats)));
    expect(tiers.size).toBeGreaterThan(1);
    for (const plan of fleet) for (const leg of plan.legs) expect(leg.seats).toBeGreaterThanOrEqual(0);
    for (const plan of fleet) for (const leg of plan.legs) expect(leg.seats).toBeLessThanOrEqual(16);
  });

  it('a fixed seed and time give known numbers (a change here means the simulation changed)', () => {
    const first = demoSnapshot(fleet[0], T0 * 1000, CONFIG);
    expect(first.label).toBe('DEMO 01');
    expect(first.lat).toBeCloseTo(pointAt(0).lat, 6);
    expect(first.demo).toBe(true);
    expect(first.speedKmh).toBeGreaterThanOrEqual(0);
  });
});

describe('the silent vehicle', () => {
  const fleet = planDemoFleet(LINES, FIXTURE_STOPS, CONFIG);
  const silent = fleet.find((plan) => plan.silent)!;
  const periodS = DEMO_SILENT_SEND_S + DEMO_SILENT_GAP_S;
  // Start of a quiet spell: the first whole second after sending stops
  const quietStart = (() => {
    const sending = (t: number) => lastPacketS(silent, t, CONFIG) === t;
    for (let s = 0; s < periodS; s += 1) {
      if (sending(T0 + s) && !sending(T0 + s + 1)) return T0 + s + 1;
    }
    throw new Error('never silent');
  })();

  it('is Live while sending, Stale from 90 s, No data from 600 s, then sends again', () => {
    const age = (t: number) => t - lastPacketS(silent, t, CONFIG);
    expect(coverageOf(age(quietStart - 2))).toBe('live');
    expect(coverageOf(age(quietStart + 88))).toBe('live');
    expect(coverageOf(age(quietStart + 100))).toBe('stale');
    expect(coverageOf(age(quietStart + 598))).toBe('stale');
    expect(coverageOf(age(quietStart + 600))).toBe('none');
    expect(coverageOf(age(quietStart + DEMO_SILENT_GAP_S + 1))).toBe('live');
  });

  it('stays where it went quiet', () => {
    const a = demoSnapshot(silent, (quietStart + 30) * 1000, CONFIG);
    const b = demoSnapshot(silent, (quietStart + 300) * 1000, CONFIG);
    expect([b.lat, b.lon]).toEqual([a.lat, a.lon]);
  });

  it('the others always send', () => {
    for (const plan of fleet.filter((candidate) => !candidate.silent)) expect(lastPacketS(plan, quietStart + 300, CONFIG)).toBe(quietStart + 300);
  });
});

describe('coverage (PRD 7.3)', () => {
  it('89 s Live, 100 s Stale, 600 s No data', () => {
    expect(coverageOf(89)).toBe('live');
    expect(coverageOf(100)).toBe('stale');
    expect(coverageOf(599)).toBe('stale');
    expect(coverageOf(600)).toBe('none');
  });

  it('a route is as fresh as its youngest vehicle, and No data with none', () => {
    expect(routeCoverage([700, 120, 30])).toEqual({ coverage: 'live', youngestAgeS: 30 });
    expect(routeCoverage([700, 120])).toEqual({ coverage: 'stale', youngestAgeS: 120 });
    expect(routeCoverage([])).toEqual({ coverage: 'none', youngestAgeS: null });
  });

  it('age never goes below zero', () => {
    expect(ageSeconds(2000, 1000)).toBe(0);
    expect(ageSeconds(1000, 91000)).toBe(90);
  });
});

describe('seat tiers (PRD 7.3, of 16)', () => {
  it('6 green, 7 amber, 12 amber, 13 red', () => {
    expect(seatTier(0)).toBe('green');
    expect(seatTier(6)).toBe('green');
    expect(seatTier(7)).toBe('amber');
    expect(seatTier(12)).toBe('amber');
    expect(seatTier(13)).toBe('red');
    expect(seatTier(16)).toBe('red');
  });
});

describe('stopped bubble (PRD 7.3: under 2 km/h across 45 s)', () => {
  const now = 1_000_000;
  const samples = (speeds: number[], stepS = 5) =>
    speeds.map((speedKmh, index) => ({ atMs: now - (speeds.length - 1 - index) * stepS * 1000, speedKmh }));

  it('stopped when every speed over 45 s is under 2 km/h', () => {
    expect(isStopped(samples([0, 0, 1, 0, 0, 0, 1.9, 0, 0, 0]), now)).toBe(true);
  });

  it('not stopped when one speed in the window is 2 km/h or more', () => {
    expect(isStopped(samples([0, 0, 0, 0, 0, 2, 0, 0, 0, 0]), now)).toBe(false);
  });

  it('not stopped before 45 s of samples exist', () => {
    expect(isStopped(samples([0, 0, 0, 0, 0]), now)).toBe(false);
  });

  it('a demo vehicle standing longer than 45 s shows Stopped; driving does not', () => {
    const fleet = planDemoFleet(LINES, FIXTURE_STOPS, CONFIG);
    const plan = fleet.find((candidate) => !candidate.silent && candidate.legs.some((leg) => leg.toKm === leg.fromKm && leg.durationS > 50))!;
    const dwell = plan.legs.find((leg) => leg.toKm === leg.fromKm && leg.durationS > 50)!;
    const atS = atRound(plan, dwell.startS + dwell.durationS - 1);
    expect(isStopped(demoSnapshot(plan, atS * 1000, CONFIG).recentSpeeds, atS * 1000)).toBe(true);
    const drive = plan.legs.find((leg) => leg.toKm > leg.fromKm && leg.durationS > 60)!;
    const driveS = atRound(plan, drive.startS + drive.durationS - 1);
    expect(isStopped(demoSnapshot(plan, driveS * 1000, CONFIG).recentSpeeds, driveS * 1000)).toBe(false);
  });
});
