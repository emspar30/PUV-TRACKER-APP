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

// The gateway's state in one line, for the top of its screen
export function describeGateway(status: GatewayStatus, nowMs: number): { tone: Tone; label: string } {
  const text = strings.gateway.status;
  if (!status.setUp) return { tone: 'bad', label: text.notSetUp };
  if (!status.enabled) return { tone: 'warn', label: text.stopped };
  if (!status.running) return { tone: 'warn', label: text.starting };
  if (status.lastError === 'unauthorized') return { tone: 'bad', label: text.unauthorized };
  if (status.workerReachable === false) return { tone: 'bad', label: text.unreachable };
  const quietMs = status.lastPullMs === null ? null : nowMs - status.lastPullMs;
  if (quietMs !== null && quietMs > GATEWAY_HEARTBEAT_ALERT_MIN * MS_PER_MIN) return { tone: 'bad', label: text.quiet(Math.floor(quietMs / MS_PER_MIN)) };
  if (status.workerReachable === null) return { tone: 'warn', label: text.connecting };
  return { tone: 'ok', label: text.running };
}

// Whether the service may start: set up, and allowed to send SMS (the module refuses otherwise)
export const canStartGateway = (status: Pick<GatewayStatus, 'setUp'>, canSend: boolean) => status.setUp && canSend;
