import type { DriftStatus } from '@/shared/driver/drift';
import type { HeatmapView } from '@/shared/driver/heatmapView';
import { strings } from '@/strings';

// DR5: the heatmap's age and the clock in words, for the status strip and the home screen

export type Tone = 'ok' | 'warn' | 'bad';
export type Described = { tone: Tone; label: string };

const S_PER_MIN = 60;
const MIN_PER_HOUR = 60;
// Below this the clock offset is shown in seconds
const SECONDS_UP_TO = 120;

export function describeUpdate(view: Pick<HeatmapView, 'freshness' | 'ageMin'>): Described {
  const text = strings.driver.heatmap;
  if (view.freshness === 'never' || view.ageMin === null) return { tone: 'warn', label: text.never };
  if (view.freshness === 'stale') return { tone: 'bad', label: text.stale(Math.floor(view.ageMin / MIN_PER_HOUR), view.ageMin % MIN_PER_HOUR) };
  return { tone: 'ok', label: view.ageMin === 0 ? text.justNow : text.updated(view.ageMin) };
}

export function describeClock(status: DriftStatus): Described {
  const text = strings.driver.clock;
  if (status.kind === 'unknown') return { tone: 'warn', label: text.unknown };
  if (status.kind === 'ok') return { tone: 'ok', label: text.ok };
  const seconds = Math.abs(Math.round(status.driftS));
  return { tone: 'bad', label: seconds <= SECONDS_UP_TO ? text.offSeconds(seconds) : text.off(Math.round(seconds / S_PER_MIN)) };
}
