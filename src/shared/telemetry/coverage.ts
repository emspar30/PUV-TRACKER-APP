// Coverage states by the age of the last position (PRD 7.3, 8.4): Live under 90 s, Stale up to
// 10 minutes, then No data. The app never says "no vehicles".

import { COVERAGE_LIVE_MAX_AGE_S, COVERAGE_STALE_MAX_AGE_S } from '../config';

export type Coverage = 'live' | 'stale' | 'none';

const MS_PER_S = 1000;

export function ageSeconds(lastPacketMs: number, nowMs: number): number {
  return Math.max(0, (nowMs - lastPacketMs) / MS_PER_S);
}

export function coverageOf(ageS: number): Coverage {
  if (ageS < COVERAGE_LIVE_MAX_AGE_S) return 'live';
  if (ageS < COVERAGE_STALE_MAX_AGE_S) return 'stale';
  return 'none';
}

export type RouteCoverage = { coverage: Coverage; youngestAgeS: number | null };

// The status pill for a route: Live if any vehicle is live, else Stale with the youngest age, else No data
export function routeCoverage(agesS: readonly number[]): RouteCoverage {
  if (agesS.length === 0) return { coverage: 'none', youngestAgeS: null };
  const youngest = Math.min(...agesS);
  return { coverage: coverageOf(youngest), youngestAgeS: youngest };
}

// CF1 coverage nudge: the picked route has no Live multicab, by day, for anyone who could see one.
// nowMs is 0 until the first vehicles have arrived.
export function nudgeShown(options: { routePicked: boolean; lastPacketsMs: readonly number[]; nowMs: number; night: boolean; offTeam: boolean }): boolean {
  const { routePicked, lastPacketsMs, nowMs, night, offTeam } = options;
  if (!routePicked || nowMs <= 0 || night || offTeam) return false;
  return routeCoverage(lastPacketsMs.map((lastMs) => ageSeconds(lastMs, nowMs))).coverage !== 'live';
}
