// NM1 with demo data: the stop passages the demo multicabs made, as the server would record them
// from live positions (supabase/functions/_shared/nodePassage.ts), so the Night Mode stop view can
// be seen without a live multicab. Positions are sampled every DEMO_PASSAGE_SAMPLE_S over the last
// NIGHT_STOP_WINDOW_MIN; passages younger than NIGHT_FEED_DELAY_MIN are held back, as on the server.
// Pure: no React Native or Expo imports.

import { newPassages, type PassStop } from '../telemetry/nodePassage';
import { DEMO_PASSAGE_SAMPLE_S, NIGHT_FEED_DELAY_MIN, NIGHT_STOP_WINDOW_MIN } from '../config';
import { positionAt, type DemoVehiclePlan } from './simulate';

const MS_PER_S = 1000;
const S_PER_MIN = 60;

export type NightPassage = { stopCode: string; passedAtMs: number };

// The newest passage per stop of these multicabs, newest first
export function demoNightPassages(plans: readonly DemoVehiclePlan[], stops: readonly PassStop[], nowMs: number): NightPassage[] {
  const nowS = Math.floor(nowMs / MS_PER_S);
  const fromS = nowS - NIGHT_STOP_WINDOW_MIN * S_PER_MIN;
  const toS = nowS - NIGHT_FEED_DELAY_MIN * S_PER_MIN;
  const newest = new Map<string, number>();
  for (const plan of plans) {
    const points: { lat: number; lon: number; atMs: number }[] = [];
    for (let s = fromS; s <= toS; s += DEMO_PASSAGE_SAMPLE_S) {
      const at = positionAt(plan, s);
      if (at.visible) points.push({ lat: at.lat, lon: at.lon, atMs: s * MS_PER_S });
    }
    for (const passage of newPassages(points, stops, {})) {
      newest.set(passage.stopCode, Math.max(newest.get(passage.stopCode) ?? 0, passage.atMs));
    }
  }
  return [...newest].map(([stopCode, passedAtMs]) => ({ stopCode, passedAtMs })).sort((a, b) => b.passedAtMs - a.passedAtMs);
}
