import { DATA_SMS_PORT, GATEWAY_PULL_MAX, GATEWAY_PULL_S, SMS_SEND_MAX_ATTEMPTS } from '../../../src/shared/config';
import { handleRequest, tokenHash, type WorkerRequest } from '../src/http';

import { fakeDeps, type Fake } from './fakeDeps';

// DR6: the gateway's HTTP API with fake deps (plan DR6 tests: http.test.ts)

const TOKEN = 'k9Qx3vT0bZ1mN2pL4sR6uW8yA0cE2gI4kM6oQ8sU0wY';
const NOW = Date.UTC(2026, 9, 13, 4, 0);

function setup(): Fake {
  const fake = fakeDeps(NOW);
  fake.tokens.set(tokenHash(TOKEN), 'GW-01');
  fake.deviceList = [{ deviceId: 'DRV-0001', vehicleId: 'R4-001', routeId: 'R4', phoneE164: '+639170000001', smsKey: 'a'.repeat(64) }];
  for (let i = 0; i < 12; i++) {
    fake.queue.push({
      id: i + 1,
      deviceId: 'DRV-0001',
      routeId: 'R4',
      seq: i,
      encoding: i === 0 ? 'data' : 'text',
      bodyText: `HM2|R4|${String(i).padStart(4, '0')}|1200|SMB:1|ABCDEF01`,
      bodyB64: i === 0 ? 'SAIE' : null,
      status: 'queued',
      attempts: 0,
      gatewayId: null,
    });
  }
  return fake;
}

const post = (path: string, body: unknown, token: string | null = TOKEN): WorkerRequest => ({
  method: 'POST',
  path,
  authorization: token === null ? undefined : `Bearer ${token}`,
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

describe('worker HTTP API (DR6)', () => {
  it('answers /healthz without a token and with no data', async () => {
    const reply = await handleRequest({ method: 'GET', path: '/healthz', authorization: undefined, body: '' }, setup());
    expect(reply).toEqual({ status: 200, body: 'ok' });
  });

  it('refuses a request without a token, or with a wrong one, with no detail', async () => {
    const fake = setup();
    expect(await handleRequest(post('/v1/pull', { max: 5 }, null), fake)).toEqual({ status: 401, body: { error: 'unauthorized' } });
    expect(await handleRequest(post('/v1/pull', { max: 5 }, 'x'.repeat(43)), fake)).toEqual({ status: 401, body: { error: 'unauthorized' } });
    expect(fake.queue.every((row) => row.status === 'queued')).toBe(true);
  });

  it(`pulls at most what was asked, and never more than ${GATEWAY_PULL_MAX}`, async () => {
    const fake = setup();
    const three = await handleRequest(post('/v1/pull', { max: 3 }), fake);
    expect((three.body as { messages: unknown[] }).messages).toHaveLength(3);
    const rest = await handleRequest(post('/v1/pull', { max: 50 }), fake);
    expect((rest.body as { messages: unknown[] }).messages).toHaveLength(Math.min(GATEWAY_PULL_MAX, 9));
  });

  it('gives a data message as base64 with the port, and a text message as text', async () => {
    const reply = await handleRequest(post('/v1/pull', { max: 2 }), setup());
    expect((reply.body as { messages: unknown[] }).messages).toEqual([
      { id: 1, to: '+639170000001', encoding: 'data', dataB64: 'SAIE', port: DATA_SMS_PORT },
      { id: 2, to: '+639170000001', encoding: 'text', text: 'HM2|R4|0001|1200|SMB:1|ABCDEF01' },
    ]);
  });

  it(`queues a failed message again until ${SMS_SEND_MAX_ATTEMPTS} attempts`, async () => {
    const fake = setup();
    const row = fake.queue[0];
    for (let attempt = 1; attempt <= SMS_SEND_MAX_ATTEMPTS; attempt++) {
      await handleRequest(post('/v1/pull', { max: 1 }), fake);
      expect(row.attempts).toBe(attempt);
      expect((await handleRequest(post('/v1/result', { id: 1, status: 'failed', errorCode: 1, atMs: NOW }), fake)).status).toBe(204);
    }
    expect(row.status).toBe('failed');
  });

  it('records sent, then delivered; a result for a message it did not take is refused', async () => {
    const fake = setup();
    await handleRequest(post('/v1/pull', { max: 1 }), fake);
    expect((await handleRequest(post('/v1/result', { id: 1, status: 'sent', atMs: NOW }), fake)).status).toBe(204);
    expect((await handleRequest(post('/v1/result', { id: 1, status: 'delivered', atMs: NOW }), fake)).status).toBe(204);
    expect(fake.queue[0].status).toBe('delivered');
    expect((await handleRequest(post('/v1/result', { id: 5, status: 'sent', atMs: NOW }), fake)).status).toBe(409);
    expect((await handleRequest(post('/v1/result', { id: 1, status: 'lost' }), fake)).status).toBe(400);
  });

  it('updates the heartbeat with known fields only, and tells the gateway how often to pull', async () => {
    const fake = setup();
    const reply = await handleRequest(post('/v1/heartbeat', { batteryPct: 81, charging: true, simReady: true, signalLevel: 3, queueLocal: 0, appVersion: '1.0.0', extra: 'x' }), fake);
    expect(reply).toEqual({ status: 200, body: { pullEveryS: GATEWAY_PULL_S } });
    expect(fake.heartbeats).toEqual([{ gatewayId: 'GW-01', status: { batteryPct: 81, charging: true, simReady: true, signalLevel: 3, queueLocal: 0, appVersion: '1.0.0' } }]);
  });

  it('refuses a 5 KB body, bad JSON, an unknown path and a wrong method', async () => {
    const fake = setup();
    expect((await handleRequest(post('/v1/heartbeat', JSON.stringify({ appVersion: 'x'.repeat(5000) })), fake)).status).toBe(413);
    expect((await handleRequest(post('/v1/pull', '{not json'), fake)).status).toBe(400);
    expect((await handleRequest(post('/v1/other', {}), fake)).status).toBe(404);
    expect((await handleRequest({ method: 'GET', path: '/v1/pull', authorization: `Bearer ${TOKEN}`, body: '' }, fake)).status).toBe(405);
  });
});
