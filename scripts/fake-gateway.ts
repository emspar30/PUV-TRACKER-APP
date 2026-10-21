// DR6: a stand-in for the gateway phone, to test the SMS worker without phones (DR6-M1 to M4).
//   npx tsx scripts/fake-gateway.ts                    (worker at http://localhost:8787)
//   npx tsx scripts/fake-gateway.ts --worker http://localhost:8787 --fail 1
//   npx tsx scripts/fake-gateway.ts --retire           (switch the development gateway off, then exit)
// It registers a development gateway, GW-99, with a new random token that it keeps in memory only (the
// database stores its SHA-256), then every GATEWAY_PULL_S: a heartbeat, a pull, and for each message
// it prints the masked number and the text, checks the signature with that phone's key (read with the
// service role, as the worker does), and reports "sent" then "delivered" (or "failed" for the first
// --fail messages). It sends no SMS. Ctrl+C stops it and leaves GW-99 on, so the worker's heartbeat
// alert fires after 5 minutes (DR6-M3); --retire switches it off. Never run it beside the real gateway:
// both would take messages from the same queue.

import { createHash, randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';

import { GATEWAY_HEARTBEAT_S, GATEWAY_PULL_MAX, GATEWAY_PULL_S, WORKER_DEFAULT_PORT } from '../src/shared/config';
import { decodeHeatmapBinary } from '../src/shared/sms/binary';
import { manilaMinuteOfDay, validateHeatmap } from '../src/shared/sms/protocol';
import { maskPhone } from '../services/sms-worker/src/mask';

import { adminClient, fail } from './admin-common';

const GATEWAY = 'GW-99';
const MS_PER_S = 1000;

type Pulled = { id: number; to: string; encoding: 'text' | 'data'; text?: string; dataB64?: string; port?: number };

async function main() {
  const { values } = parseArgs({
    options: {
      worker: { type: 'string', default: `http://localhost:${WORKER_DEFAULT_PORT}` },
      fail: { type: 'string', default: '0' },
      retire: { type: 'boolean', default: false },
    },
  });
  const supabase = adminClient();

  if (values.retire) {
    const { error } = await supabase.from('gateways').update({ active: false }).eq('gateway_id', GATEWAY);
    if (error) fail(`Could not switch ${GATEWAY} off: ${error.message}`);
    console.log(`${GATEWAY} switched off.`);
    return;
  }

  const worker = (values.worker ?? '').replace(/\/$/, '');
  let failuresLeft = Number(values.fail);
  if (!/^https?:\/\/\S+$/.test(worker)) fail('--worker must be the worker URL, such as http://localhost:8787');
  if (!Number.isInteger(failuresLeft) || failuresLeft < 0) fail('--fail must be a whole number');

  const token = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(token).digest('hex');
  const registered = await supabase.rpc('admin_provision_gateway', { gateway: GATEWAY, hash, phone: null });
  if (registered.error) fail(`Could not register ${GATEWAY}: ${registered.error.message}`);
  console.log(`${GATEWAY} registered (development gateway). Pulling from ${worker} every ${GATEWAY_PULL_S} s. Ctrl+C to stop.\n`);

  const call = async (path: string, body: unknown) => {
    const response = await fetch(`${worker}${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: response.status === 204 ? null : ((await response.json()) as unknown) };
  };

  // Each phone's key, by number, to check the signatures (refreshed with each heartbeat)
  let keys = new Map<string, { deviceId: string; key: string }>();
  const loadKeys = async () => {
    const { data, error } = await supabase.rpc('worker_devices');
    if (error) throw new Error(`worker_devices: ${error.message}`);
    keys = new Map((data as { device_id: string; phone_e164: string; sms_key: string }[]).map((row) => [row.phone_e164, { deviceId: row.device_id, key: row.sms_key }]));
  };

  let lastHeartbeatMs = 0;
  const round = async () => {
    if (Date.now() - lastHeartbeatMs >= GATEWAY_HEARTBEAT_S * MS_PER_S) {
      await loadKeys();
      const beat = await call('/v1/heartbeat', { batteryPct: 100, charging: true, simReady: true, signalLevel: 4, queueLocal: 0, appVersion: 'fake-gateway' });
      if (beat.status !== 200) throw new Error(`heartbeat: HTTP ${beat.status}`);
      lastHeartbeatMs = Date.now();
    }
    const pulled = await call('/v1/pull', { max: GATEWAY_PULL_MAX });
    if (pulled.status !== 200) throw new Error(`pull: HTTP ${pulled.status}`);
    for (const message of (pulled.body as { messages: Pulled[] }).messages) {
      const text = message.encoding === 'data' ? decodeHeatmapBinary(Buffer.from(message.dataB64 ?? '', 'base64')) : (message.text ?? null);
      const phone = keys.get(message.to);
      const check = text && phone ? validateHeatmap(text, { key: phone.key, lastSeq: null, nowMinuteOfDay: manilaMinuteOfDay(new Date()) }) : null;
      const verdict = !text ? 'NOT A HEATMAP MESSAGE' : !phone ? 'no such phone' : check?.ok ? `valid for ${phone.deviceId}` : `INVALID (${check && !check.ok ? check.reason : '?'})`;
      console.log(`${new Date().toLocaleTimeString()}  #${message.id} ${message.encoding}${message.port ? `:${message.port}` : ''} to ${maskPhone(message.to)}  ${text ?? ''}  [${verdict}]`);

      if (failuresLeft > 0) {
        failuresLeft -= 1;
        await call('/v1/result', { id: message.id, status: 'failed', errorCode: 'fake', atMs: Date.now() });
        console.log(`           reported failed (it goes back to the queue)`);
        continue;
      }
      await call('/v1/result', { id: message.id, status: 'sent', atMs: Date.now() });
      await call('/v1/result', { id: message.id, status: 'delivered', atMs: Date.now() });
    }
  };

  const loop = async () => {
    try {
      await round();
    } catch (error) {
      console.error(`${new Date().toLocaleTimeString()}  ${error instanceof Error ? error.message : String(error)}`);
    }
    setTimeout(() => void loop(), GATEWAY_PULL_S * MS_PER_S);
  };
  await loop();
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
