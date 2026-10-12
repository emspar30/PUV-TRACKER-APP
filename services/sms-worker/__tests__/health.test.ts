import { OPS_ALERT_QUIET_MIN } from '../../../src/shared/config';
import { evaluateHealth, percentile90, runHealth } from '../src/health';
import { maskPhone, maskPhonesIn } from '../src/mask';
import { EnvError, readWorkerEnv } from '../src/env';

import { fakeDeps } from './fakeDeps';

// DR6: gateway health alerts (health.test.ts), phone masking (mask.test.ts) and the settings

// 12:00 Asia/Manila
const NOON_MS = Date.UTC(2026, 9, 13, 4, 0);
const MS_PER_S = 1000;
const MIN = 60 * MS_PER_S;
const healthy = { gateways: [{ gatewayId: 'GW-01', lastHeartbeatMs: NOON_MS - MIN }], sent: 100, failed: 0, latenciesS: [5, 8, 12] };

describe('gateway health (DR6)', () => {
  it('raises nothing while all is well', () => {
    expect(evaluateHealth(healthy, NOON_MS)).toEqual([]);
  });

  it('alerts on a heartbeat gap of 5 min 1 s, and on a gateway never seen', () => {
    const gap = evaluateHealth({ ...healthy, gateways: [{ gatewayId: 'GW-01', lastHeartbeatMs: NOON_MS - 5 * MIN - MS_PER_S }] }, NOON_MS);
    expect(gap.map((alert) => alert.kind)).toEqual(['gateway_heartbeat']);
    const exactly = evaluateHealth({ ...healthy, gateways: [{ gatewayId: 'GW-01', lastHeartbeatMs: NOON_MS - 5 * MIN }] }, NOON_MS);
    expect(exactly).toEqual([]);
    expect(evaluateHealth({ ...healthy, gateways: [{ gatewayId: 'GW-01', lastHeartbeatMs: null }] }, NOON_MS)[0].detail).toEqual({
      gateways: [{ gatewayId: 'GW-01', lastHeartbeatAt: null }],
    });
  });

  it('alerts on a 6 % failure ratio, but not on 1 failure in 3', () => {
    expect(evaluateHealth({ ...healthy, sent: 94, failed: 6 }, NOON_MS).map((alert) => alert.kind)).toEqual(['gateway_failures']);
    expect(evaluateHealth({ ...healthy, sent: 2, failed: 1 }, NOON_MS)).toEqual([]);
  });

  it('alerts when the 90th percentile latency is 61 s', () => {
    const latencies = [...Array.from({ length: 9 }, () => 10), 61];
    expect(percentile90(latencies)).toBe(10);
    expect(evaluateHealth({ ...healthy, latenciesS: [...latencies, 61] }, NOON_MS).map((alert) => alert.kind)).toEqual(['latency_p90']);
  });

  it('records each kind once per quiet window, and nothing at night', async () => {
    const fake = fakeDeps(NOON_MS);
    fake.stats = { ...healthy, gateways: [{ gatewayId: 'GW-01', lastHeartbeatMs: null }] };
    expect(await runHealth(fake)).toEqual(['gateway_heartbeat']);
    expect(await runHealth(fake)).toEqual([]);
    expect(fake.alerts).toHaveLength(1);
    expect(fake.alerts[0].quietMin).toBe(OPS_ALERT_QUIET_MIN);

    const night = fakeDeps(Date.UTC(2026, 9, 13, 14, 0));
    night.stats = fake.stats;
    expect(await runHealth(night)).toEqual([]);
  });
});

describe('phone masking in logs (DR6)', () => {
  it('keeps the start and the last four digits', () => {
    expect(maskPhone('+639171234567')).toBe('+63917•••4567');
    expect(maskPhone('DRV-0001')).toBe('DRV-0001');
    expect(maskPhone('09171234567')).toBe('09171234567');
    expect(maskPhonesIn('to +639171234567 and +639998887777')).toBe('to +63917•••4567 and +63999•••7777');
  });
});

describe('worker settings (DR6)', () => {
  const full = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'secret', SMS_PRIMARY_ENCODING: 'data' };

  it('reads them, with the default port', () => {
    expect(readWorkerEnv([full])).toEqual({ supabaseUrl: 'https://example.supabase.co', serviceRoleKey: 'secret', encoding: 'data', port: 8787 });
  });

  it('takes the first source that has a value, and the app URL from the repository .env', () => {
    const env = readWorkerEnv([{ PORT: '9000' }, { SMS_PRIMARY_ENCODING: 'text' }, { EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' }]);
    expect(env).toMatchObject({ supabaseUrl: 'https://x.supabase.co', encoding: 'text', port: 9000 });
  });

  it('refuses to start without a value, naming it but never printing one', () => {
    expect(() => readWorkerEnv([{ SUPABASE_URL: full.SUPABASE_URL }])).toThrow(new EnvError('Missing: SUPABASE_SERVICE_ROLE_KEY, SMS_PRIMARY_ENCODING (see services/sms-worker/README.md)'));
    expect(() => readWorkerEnv([{ ...full, SMS_PRIMARY_ENCODING: 'both' }])).toThrow(/data or text/);
    expect(() => readWorkerEnv([{ ...full, SUPABASE_URL: 'http://x' }])).toThrow(/https/);
    try {
      readWorkerEnv([{ SUPABASE_SERVICE_ROLE_KEY: 'secret' }]);
    } catch (error) {
      expect(String(error)).not.toContain('secret');
    }
  });
});
