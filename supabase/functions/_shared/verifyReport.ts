// The single place where a telemetry report is judged (PRD 0.7 plug-in point 1).
// In Prototype v0 verification is off, so every report is "unverified". The real checks
// (beacon code, motion, route snap, displacement) are added here later without touching callers.

import type { TelemetryPacket } from './packet.ts';
import { ENABLE_VERIFICATION } from './serverConfig.ts';

export type VerificationStatus = 'unverified' | 'verified';

export type VerificationResult = {
  status: VerificationStatus;
  reasons: string[];
};

export function verifyReport(_report: TelemetryPacket): VerificationResult {
  // This is the only read of ENABLE_VERIFICATION in the code base
  if (!ENABLE_VERIFICATION) return { status: 'unverified', reasons: ['verification_disabled'] };

  // Verification is switched on but its checks are not built yet: stay unverified, and say why
  return { status: 'unverified', reasons: ['verification_not_implemented'] };
}
