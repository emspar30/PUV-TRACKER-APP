// V1a (PRD 10.2, 8.1 step 6): a running relay's verification on the phone. The rider's fixes since the
// relay was released go through the verification window (verifyWindow.ts) on the relay's route lines;
// the beacon passed already, since the relay is released only on one (RL2c). A phone that sends no
// new fix (it stands still) is still decided: once VERIFY_WINDOW_MAX_S has passed, a pending window
// fails. A demo relay rides a simulated multicab, so it is verified after MOTION_SPEED_FALLBACK_S.
// Pure: fixes and times are passed in.

import { MOTION_SPEED_FALLBACK_S, VERIFY_WINDOW_MAX_S } from '../config';
import type { LineCoordinates } from '../geo/line';
import { verifyWindow, type WindowFix, type WindowResult } from '../verification/verifyWindow';

const MS_PER_S = 1000;

export type RelayVerificationInput = {
  fixes: readonly WindowFix[];
  lines: readonly LineCoordinates[];
  startedMs: number;
  nowMs: number;
  demo: boolean;
};

export function relayVerification({ fixes, lines, startedMs, nowMs, demo }: RelayVerificationInput): WindowResult {
  const elapsedMs = nowMs - startedMs;
  if (demo) return elapsedMs >= MOTION_SPEED_FALLBACK_S * MS_PER_S ? { status: 'verified', reasons: [] } : { status: 'pending', reasons: [] };
  const windowLines = lines.map((line) => line.map(([lon, lat]) => [lon, lat] as const));
  const result = verifyWindow({ fixes: fixes.filter((fix) => fix.atMs >= startedMs), lines: windowLines, beaconOk: true });
  if (result.status === 'pending' && elapsedMs >= VERIFY_WINDOW_MAX_S * MS_PER_S) return { status: 'failed', reasons: result.reasons };
  return result;
}
