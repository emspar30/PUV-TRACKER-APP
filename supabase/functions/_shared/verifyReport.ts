// The single place where reports are judged (PRD 0.7 plug-in point 1): a telemetry packet, and from
// UX2 a station check-in. V1a (2026-11-02): a packet is judged by the verification window
// (verifyWindow.ts) over the vehicle's recent positions on its route line. A vehicle once verified
// stays verified while its positions keep coming (a stop at a light does not undo it). Check-ins are
// judged on the phone (geofence, accuracy; G1) and stay unverified here.

import type { TelemetryPacket } from './packet.ts';
import { ENABLE_VERIFICATION } from './serverConfig.ts';
import { verifyWindow, type WindowFix, type WindowLine } from './verifyWindow.ts';

const MS_PER_S = 1000;

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

// What the window needs besides the packet: the vehicle's positions just before it (oldest first),
// its route's lines, and whether its marker is verified already and still current
export type ReportContext = {
  history: readonly WindowFix[];
  lines: readonly WindowLine[];
  stillVerified: boolean;
};

export function verifyReport(report: TelemetryPacket, context?: ReportContext): VerificationResult {
  const disabled = disabledResult();
  if (disabled) return disabled;
  if (!context) return { status: 'unverified', reasons: ['no_window'] };
  if (context.stillVerified) return { status: 'verified', reasons: [] };
  const fixes = [...context.history, { lat: report.lat, lon: report.lon, atMs: report.ts * MS_PER_S, speedKmh: report.speed }];
  // The beacon is checked on the phone before a relay is sent (DR8), not known here
  const result = verifyWindow({ fixes, lines: context.lines, beaconOk: null });
  return result.status === 'verified' ? { status: 'verified', reasons: [] } : { status: 'unverified', reasons: [result.status, ...result.reasons] };
}

export function verifyCheckIn(_checkIn: CheckInReport): VerificationResult {
  const disabled = disabledResult();
  if (disabled) return disabled;
  // The geofence and accuracy checks arrive with the cloud check-in (G1)
  return { status: 'unverified', reasons: ['verification_not_implemented'] };
}
