// DR6: one worker cycle (PRD 9.6). Every WORKER_CYCLE_S:
//   1. the live waiting counts per route and stop (worker_demand_snapshot);
//   2. for each route with at least one active driver phone: the counts for every stop of the route,
//      in riding order, zeros included; then the dispatch rule (shared/sms/dispatch.ts) against what
//      the route was last sent;
//   3. when it says send: for each phone on the route, reserve its sequence numbers, sign the
//      messages with that phone's key (shared/sms/pack.ts), encode them as data or text SMS, and
//      queue the route's messages with its new state in one transaction (worker_enqueue).
// CA2-1: the messages are v3, listing only the stops with someone waiting (the first says every
// other stop is 0), so a route with its fill stops still fits one SMS; the driver app reads v2 too.
// One phone's failure (a retired phone, a database error) does not stop the others.
// CA2c: the gateways' daily cap (shared/sms/dispatch.ts capLevel) holds sends near and at it;
// at the cap an ops alert is recorded.

import { OPS_ALERT_QUIET_MIN, SMS_GATEWAY_DAILY_CAP, SMS_OUTBOX_TTL_MIN } from '../../../src/shared/config';
import { capLevel, dispatchDecision, manilaDayStartMs, type DispatchDecision } from '../../../src/shared/sms/dispatch';
import { buildHeatmapUpdate, heatmapUpdateSize, type HeatmapEncoding } from '../../../src/shared/sms/pack';
import { manilaMinuteOfDay } from '../../../src/shared/sms/protocol';

import type { QueuedMessage, WorkerDeps, WorkerDevice } from './deps';
import { routeStopCodes } from './routes';

export type RouteCycleResult = { routeId: string; decision: DispatchDecision; devices: number; queued: number };

export type CycleOptions = {
  encoding: HeatmapEncoding;
  // The route's stop codes in riding order (routes.ts; a fake in tests)
  stopsOf?: (routeId: string) => string[];
};

const toBase64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');

export async function runCycle(deps: WorkerDeps, options: CycleOptions): Promise<RouteCycleResult[]> {
  const stopsOf = options.stopsOf ?? routeStopCodes;
  const nowMs = deps.nowMs();
  const [snapshot, devices, state, usage] = await Promise.all([
    deps.demandSnapshot(),
    deps.devices(),
    deps.dispatchState(),
    deps.smsUsage(manilaDayStartMs(nowMs)),
  ]);
  // CA2c: today's messages so far, counted on as this cycle queues more
  let used = usage.used;

  const byRoute = new Map<string, WorkerDevice[]>();
  for (const device of devices) byRoute.set(device.routeId, [...(byRoute.get(device.routeId) ?? []), device]);

  const results: RouteCycleResult[] = [];
  for (const [routeId, routeDevices] of byRoute) {
    const stops = stopsOf(routeId);
    if (stops.length === 0) {
      deps.log('warn', 'route has no stops in the route data; skipped', { routeId });
      continue;
    }
    const counts: Record<string, number> = Object.fromEntries(stops.map((code) => [code, 0]));
    for (const row of snapshot) {
      if (row.routeId === routeId && row.stationCode in counts) counts[row.stationCode] = row.waiting;
    }

    const level = capLevel(used, usage.gateways);
    const decision = dispatchDecision(state.get(routeId) ?? null, counts, nowMs, level);
    if (level === 'full' && dispatchDecision(state.get(routeId) ?? null, counts, nowMs).send) {
      await deps.alert('sms_daily_cap', { used, cap: SMS_GATEWAY_DAILY_CAP, gateways: usage.gateways }, OPS_ALERT_QUIET_MIN);
    }
    if (!decision.send) {
      results.push({ routeId, decision, devices: routeDevices.length, queued: 0 });
      continue;
    }

    const nodes = stops.map((code) => ({ code, count: counts[code] }));
    const minuteOfDay = manilaMinuteOfDay(new Date(nowMs));
    const messages: QueuedMessage[] = [];
    for (const device of routeDevices) {
      try {
        const n = heatmapUpdateSize(routeId, nodes, options.encoding);
        const firstSeq = await deps.nextSeq(device.deviceId, n);
        for (const message of buildHeatmapUpdate({ route: routeId, firstSeq, minuteOfDay, nodes }, device.smsKey, options.encoding)) {
          messages.push({
            deviceId: device.deviceId,
            seq: message.seq,
            encoding: options.encoding,
            bodyText: message.text,
            bodyB64: message.data ? toBase64(message.data) : null,
          });
        }
      } catch (error) {
        deps.log('error', 'could not build messages for a phone', { routeId, deviceId: device.deviceId, error: errorText(error) });
      }
    }
    if (messages.length === 0) {
      results.push({ routeId, decision, devices: routeDevices.length, queued: 0 });
      continue;
    }
    const queued = await deps.enqueue(routeId, counts, messages, SMS_OUTBOX_TTL_MIN);
    used += queued;
    deps.log('info', 'queued', { routeId, reason: decision.reason, phones: routeDevices.length, messages: queued });
    results.push({ routeId, decision, devices: routeDevices.length, queued });
  }
  return results;
}

export const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));
