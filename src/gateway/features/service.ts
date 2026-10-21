import { useEffect, useState } from 'react';

import {
  GATEWAY_BACKOFF_S,
  GATEWAY_EVENTS_MAX,
  GATEWAY_HEARTBEAT_ALERT_MIN,
  GATEWAY_HEARTBEAT_S,
  GATEWAY_PULL_MAX,
  GATEWAY_PULL_S,
  GATEWAY_SEND_GAP_MS,
  GATEWAY_SENT_TIMEOUT_S,
} from '@/shared/config';
import { strings } from '@/strings';

import { addGatewayStatusListener, gatewayStatus, type GatewaySettings, type GatewayStatus } from '../../../modules/tunton-sms';

// DR7: the gateway app's side of the sending service. The settings come from shared/config, the one
// place for them; the native module stores them so the service can restart after a reboot without
// JavaScript. The status is live from the module's events, and polled in case one was missed.

const STATUS_POLL_MS = 5000;
const MS_PER_MIN = 60_000;

export function gatewaySettings(): GatewaySettings {
  return {
    pullS: GATEWAY_PULL_S,
    heartbeatS: GATEWAY_HEARTBEAT_S,
    sendGapMs: GATEWAY_SEND_GAP_MS,
    sentTimeoutS: GATEWAY_SENT_TIMEOUT_S,
    pullMax: GATEWAY_PULL_MAX,
    backoffS: [...GATEWAY_BACKOFF_S],
    eventsMax: GATEWAY_EVENTS_MAX,
    notificationTitle: strings.gateway.notification.title,
    notificationText: strings.gateway.notification.text,
  };
}

export function useGatewayStatus(): GatewayStatus {
  const [status, setStatus] = useState<GatewayStatus>(gatewayStatus);
  useEffect(() => {
    const subscription = addGatewayStatusListener(setStatus);
    const timer = setInterval(() => setStatus(gatewayStatus()), STATUS_POLL_MS);
    return () => {
      subscription?.remove();
      clearInterval(timer);
    };
  }, []);
  return status;
}

export type Tone = 'ok' | 'warn' | 'bad';

// The gateway's state in one line, for the top of its screen. Enabled but not running means the
// system killed the service; the home starts it again (shouldRestartGateway), and says so when it
// cannot.
export function describeGateway(status: GatewayStatus, nowMs: number, restartFailed = false): { tone: Tone; label: string } {
  const text = strings.gateway.status;
  if (!status.setUp) return { tone: 'bad', label: text.notSetUp };
  if (!status.enabled) return { tone: 'warn', label: text.stopped };
  if (!status.running) return restartFailed ? { tone: 'bad', label: text.restartFailed } : { tone: 'warn', label: text.restarting };
  if (status.lastError === 'unauthorized') return { tone: 'bad', label: text.unauthorized };
  if (status.workerReachable === false) return { tone: 'bad', label: text.unreachable };
  const quietMs = status.lastPullMs === null ? null : nowMs - status.lastPullMs;
  if (quietMs !== null && quietMs > GATEWAY_HEARTBEAT_ALERT_MIN * MS_PER_MIN) return { tone: 'bad', label: text.quiet(Math.floor(quietMs / MS_PER_MIN)) };
  if (status.workerReachable === null) return { tone: 'warn', label: text.connecting };
  return { tone: 'ok', label: text.running };
}

// Whether the service may start: set up, and allowed to send SMS (the module refuses otherwise)
export const canStartGateway = (status: Pick<GatewayStatus, 'setUp'>, canSend: boolean) => status.setUp && canSend;

// Backlog 119: the admin left it on but the service is not running (Android or the phone maker
// killed it). Start it again, only with the app in front: Android refuses to start a foreground
// service from the background. A second start while one is under way is ignored by the service.
export const shouldRestartGateway = (status: Pick<GatewayStatus, 'setUp' | 'enabled' | 'running'>, canSend: boolean, inFront: boolean) =>
  inFront && status.enabled && !status.running && canStartGateway(status, canSend);
