// DR6: is the SMS path healthy (PRD 13, 14; plan risks R1, R3)? Checked each cycle during the
// operating hours only (all day since 2026-10-18, owner; a narrower window would make a quiet gateway
// outside it normal). Each problem becomes an ops_alerts row,
// at most one per kind per OPS_ALERT_QUIET_MIN; Q9: they are read in the dashboard, nobody is notified.
//   gateway_heartbeat  an active gateway sent no heartbeat for GATEWAY_HEARTBEAT_ALERT_MIN (or never)
//   gateway_failures   over GATEWAY_FAIL_ALERT_RATIO of the last hour's messages failed
//   latency_p90        90 % of the last hour's messages took over SMS_LATENCY_P90_TARGET_S to be sent

import {
  GATEWAY_FAIL_ALERT_MIN_MESSAGES,
  GATEWAY_FAIL_ALERT_RATIO,
  GATEWAY_HEARTBEAT_ALERT_MIN,
  OPS_ALERT_QUIET_MIN,
  SMS_LATENCY_P90_TARGET_S,
} from '../../../src/shared/config';
import { inOperatingHours } from '../../../src/shared/sms/dispatch';

import type { HealthStats, WorkerDeps } from './deps';

export type HealthAlert = { kind: 'gateway_heartbeat' | 'gateway_failures' | 'latency_p90'; detail: Record<string, unknown> };

const MS_PER_MIN = 60_000;
const HOUR_MS = 60 * MS_PER_MIN;
const P90 = 0.9;

// The value 90 % of the samples are at or below (nearest rank)
export function percentile90(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(P90 * sorted.length) - 1];
}

export function evaluateHealth(stats: HealthStats, nowMs: number): HealthAlert[] {
  const alerts: HealthAlert[] = [];

  const silent = stats.gateways.filter(
    (gateway) => gateway.lastHeartbeatMs === null || nowMs - gateway.lastHeartbeatMs > GATEWAY_HEARTBEAT_ALERT_MIN * MS_PER_MIN,
  );
  if (silent.length > 0) {
    alerts.push({
      kind: 'gateway_heartbeat',
      detail: {
        gateways: silent.map((gateway) => ({
          gatewayId: gateway.gatewayId,
          lastHeartbeatAt: gateway.lastHeartbeatMs === null ? null : new Date(gateway.lastHeartbeatMs).toISOString(),
        })),
      },
    });
  }

  const tried = stats.sent + stats.failed;
  if (tried >= GATEWAY_FAIL_ALERT_MIN_MESSAGES && stats.failed / tried > GATEWAY_FAIL_ALERT_RATIO) {
    alerts.push({ kind: 'gateway_failures', detail: { failed: stats.failed, tried } });
  }

  const p90 = percentile90(stats.latenciesS);
  if (p90 !== null && p90 > SMS_LATENCY_P90_TARGET_S) {
    alerts.push({ kind: 'latency_p90', detail: { p90S: Math.round(p90), samples: stats.latenciesS.length } });
  }
  return alerts;
}

// The kinds recorded this time (an alert of a kind already open within the quiet window is skipped)
export async function runHealth(deps: WorkerDeps): Promise<string[]> {
  const nowMs = deps.nowMs();
  if (!inOperatingHours(nowMs)) return [];
  const recorded: string[] = [];
  for (const { kind, detail } of evaluateHealth(await deps.healthStats(nowMs - HOUR_MS), nowMs)) {
    if (await deps.alert(kind, detail, OPS_ALERT_QUIET_MIN)) {
      recorded.push(kind);
      deps.log('warn', 'alert recorded', { kind, ...detail });
    }
  }
  return recorded;
}
