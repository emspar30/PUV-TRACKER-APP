// The single place where reports are judged (PRD 0.7 plug-in point 1): a telemetry packet, and from
// UX2 a station check-in. In Prototype v0 verification is off, so every report is "unverified".
// The real checks (beacon code, motion, route snap, displacement; for check-ins the geofence and
// GPS accuracy in G1) are added here later without touching callers.

import type { TelemetryPacket } from './packet.ts';
import { ENABLE_VERIFICATION } from './serverConfig.ts';

export type VerificationStatus = 'unverified' | 'verified';

export type VerificationResult = {
  status: VerificationStatus;
  reasons: string[];
};

// A station check-in as the phone describes it. In UX2 it is kept on the phone only.
export type CheckInReport = {
  routeCode: string;
  stationCode: string;
};

// The answer while verification is switched off, or null when it is on.
// This is the only read of ENABLE_VERIFICATION in the code base.
function disabledResult(): VerificationResult | null {
  return ENABLE_VERIFICATION ? null : { status: 'unverified', reasons: ['verification_disabled'] };
}

export function verifyReport(_report: TelemetryPacket): VerificationResult {
  const disabled = disabledResult();
  if (disabled) return disabled;
  // Verification is switched on but its checks are not built yet: stay unverified, and say why
  return { status: 'unverified', reasons: ['verification_not_implemented'] };
}

export function verifyCheckIn(_checkIn: CheckInReport): VerificationResult {
  const disabled = disabledResult();
  if (disabled) return disabled;
  // The geofence and accuracy checks arrive with the cloud check-in (G1)
  return { status: 'unverified', reasons: ['verification_not_implemented'] };
}
