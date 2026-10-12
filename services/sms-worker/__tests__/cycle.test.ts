import { decodeHeatmapBinary } from '../../../src/shared/sms/binary';
import { manilaMinuteOfDay, validateHeatmap } from '../../../src/shared/sms/protocol';
import { runCycle } from '../src/cycle';
import { routeStopCodes } from '../src/routes';

import { fakeDeps, type Fake } from './fakeDeps';

// DR6: one worker cycle with fake deps (plan DR6 tests: cycle.test.ts)

const KEY_A = 'a'.repeat(64);
const KEY_B = 'b'.repeat(64);
// 12:00 Asia/Manila
const NOON_MS = Date.UTC(2026, 9, 13, 4, 0);
const MS_PER_MIN = 60_000;
const R4_STOPS = ['SMB', 'ZAM', 'LEM'];
const stopsOf = (routeId: string) => (routeId === 'R4' ? R4_STOPS : routeId === 'R3' ? ['AMP', 'CSU'] : []);

function withDevices(fake: Fake) {
  fake.deviceList = [
    { deviceId: 'DRV-0001', vehicleId: 'R4-001', routeId: 'R4', phoneE164: '+639170000001', smsKey: KEY_A },
    { deviceId: 'DRV-0002', vehicleId: 'R4-002', routeId: 'R4', phoneE164: '+639170000002', smsKey: KEY_B },
    { deviceId: 'DRV-0003', vehicleId: 'R3-001', routeId: 'R3', phoneE164: '+639170000003', smsKey: KEY_A },
  ];
  fake.lastSeq.set('DRV-0001', 41);
  return fake;
}

const validate = (text: string, key: string, lastSeq: number | null) => validateHeatmap(text, { key, lastSeq, nowMinuteOfDay: manilaMinuteOfDay(new Date(NOON_MS)) });

describe('worker cycle (DR6)', () => {
  it('queues nothing while nobody is waiting', async () => {
    const fake = withDevices(fakeDeps(NOON_MS));
    const results = await runCycle(fake, { encoding: 'text', stopsOf });
    expect(fake.queue).toHaveLength(0);
    expect(results.every((result) => !result.decision.send)).toBe(true);
  });

  it('texts each R4 phone its own signed message when 3 wait at SMB', async () => {
    const fake = withDevices(fakeDeps(NOON_MS));
    fake.snapshot = [{ routeId: 'R4', stationCode: 'SMB', waiting: 3 }];
    await runCycle(fake, { encoding: 'text', stopsOf });

    expect(fake.queue.map((row) => [row.deviceId, row.seq])).toEqual([
      ['DRV-0001', 42],
      ['DRV-0002', 0],
    ]);
    const [a, b] = fake.queue;
    // Every stop is listed, zeros included, in riding order
    expect(a.bodyText).toMatch(/^HM2\|R4\|0042\|1200\|SMB:3,ZAM:0,LEM:0\|[0-9A-F]{8}$/);
    expect(a.bodyText.slice(-8)).not.toBe(b.bodyText.slice(-8));
    expect(validate(a.bodyText, KEY_A, 41).ok).toBe(true);
    expect(validate(b.bodyText, KEY_B, null).ok).toBe(true);
    // Each phone's message is signed with its own key only
    expect(validate(a.bodyText, KEY_B, 41)).toEqual({ ok: false, reason: 'bad_signature' });
    expect(fake.state.get('R4')).toEqual({ counts: { SMB: 3, ZAM: 0, LEM: 0 }, sentAtMs: NOON_MS });
  });

  it('sends nothing to a phone on another route', async () => {
    const fake = withDevices(fakeDeps(NOON_MS));
    fake.snapshot = [{ routeId: 'R4', stationCode: 'SMB', waiting: 3 }];
    await runCycle(fake, { encoding: 'text', stopsOf });
    expect(fake.queue.some((row) => row.deviceId === 'DRV-0003')).toBe(false);
  });

  it('sends nothing for a change of 1, then again after the interval', async () => {
    const fake = withDevices(fakeDeps(NOON_MS));
    fake.state.set('R4', { counts: { SMB: 3, ZAM: 0, LEM: 0 }, sentAtMs: NOON_MS - MS_PER_MIN });
    fake.snapshot = [{ routeId: 'R4', stationCode: 'SMB', waiting: 4 }];
    await runCycle(fake, { encoding: 'text', stopsOf });
    expect(fake.queue).toHaveLength(0);

    fake.now = NOON_MS + 5 * MS_PER_MIN;
    const [r4] = await runCycle(fake, { encoding: 'text', stopsOf });
    expect(r4.decision).toEqual({ send: true, reason: 'interval' });
    expect(fake.queue).toHaveLength(2);
  });

  it('sends one "cleared" message when everyone has gone', async () => {
    const fake = withDevices(fakeDeps(NOON_MS));
    fake.state.set('R4', { counts: { SMB: 3, ZAM: 0, LEM: 0 }, sentAtMs: NOON_MS - MS_PER_MIN });
    const [r4] = await runCycle(fake, { encoding: 'text', stopsOf });
    expect(r4.decision).toEqual({ send: true, reason: 'cleared' });
    expect(fake.queue[0].bodyText).toContain('|SMB:0,ZAM:0,LEM:0|');
    fake.now += MS_PER_MIN;
    await runCycle(fake, { encoding: 'text', stopsOf });
    expect(fake.queue).toHaveLength(2);
  });

  it('splits a long route into consecutive sequence numbers for each phone', async () => {
    const fake = withDevices(fakeDeps(NOON_MS));
    const many = Array.from({ length: 30 }, (_, i) => `Q${String.fromCharCode(65 + Math.floor(i / 26))}${String.fromCharCode(65 + (i % 26))}`);
    fake.snapshot = [{ routeId: 'R4', stationCode: many[0], waiting: 12 }];
    await runCycle(fake, { encoding: 'text', stopsOf: (route) => (route === 'R4' ? many : []) });

    const first = fake.queue.filter((row) => row.deviceId === 'DRV-0001').map((row) => row.seq);
    const second = fake.queue.filter((row) => row.deviceId === 'DRV-0002').map((row) => row.seq);
    expect(first).toEqual([42, 43]);
    expect(second).toEqual([0, 1]);
    expect(fake.lastSeq.get('DRV-0001')).toBe(43);
  });

  it('sends nothing outside the operating hours', async () => {
    // 22:00 Asia/Manila
    const fake = withDevices(fakeDeps(Date.UTC(2026, 9, 13, 14, 0)));
    fake.snapshot = [{ routeId: 'R4', stationCode: 'SMB', waiting: 9 }];
    await runCycle(fake, { encoding: 'text', stopsOf });
    expect(fake.queue).toHaveLength(0);
  });

  it('encodes data SMS that decode back to the signed text', async () => {
    const fake = withDevices(fakeDeps(NOON_MS));
    fake.snapshot = [{ routeId: 'R4', stationCode: 'ZAM', waiting: 6 }];
    await runCycle(fake, { encoding: 'data', stopsOf });
    for (const row of fake.queue) {
      expect(row.encoding).toBe('data');
      expect(decodeHeatmapBinary(Buffer.from(row.bodyB64 as string, 'base64'))).toBe(row.bodyText);
    }
  });

  it('keeps going for the other phones when one fails', async () => {
    const fake = withDevices(fakeDeps(NOON_MS));
    fake.failSeqFor.add('DRV-0001');
    fake.snapshot = [{ routeId: 'R4', stationCode: 'SMB', waiting: 3 }];
    await runCycle(fake, { encoding: 'text', stopsOf });
    expect(fake.queue.map((row) => row.deviceId)).toEqual(['DRV-0002']);
    expect(fake.logs.some((log) => log.level === 'error' && log.fields?.deviceId === 'DRV-0001')).toBe(true);
    // No key or number in any log line
    expect(JSON.stringify(fake.logs)).not.toMatch(/aaaaaaaa|\+639\d{9}/);
  });

  it('ignores check-ins at a stop the route data does not list', async () => {
    const fake = withDevices(fakeDeps(NOON_MS));
    fake.snapshot = [{ routeId: 'R4', stationCode: 'XYZ', waiting: 5 }];
    await runCycle(fake, { encoding: 'text', stopsOf });
    expect(fake.queue).toHaveLength(0);
  });

  it('lists the real R4 stops in riding order, and they fit one text message', async () => {
    expect(routeStopCodes('R4')).toHaveLength(18);
    expect(routeStopCodes('R4').slice(0, 3)).toEqual(['TAL', 'ANT', 'SOL']);
    const fake = withDevices(fakeDeps(NOON_MS));
    fake.snapshot = routeStopCodes('R4').map((code) => ({ routeId: 'R4', stationCode: code, waiting: 99 }));
    await runCycle(fake, { encoding: 'text' });
    expect(fake.queue.filter((row) => row.deviceId === 'DRV-0001')).toHaveLength(1);
  });
});
