import { PACKET_MAX_AGE_S, PACKET_MAX_BYTES, PACKET_MAX_FUTURE_S, VEHICLE_CAPACITY_SEATS } from '../config';
import { encodePacket, validatePacket, type TelemetryPacket } from '../telemetry/packet';
import { deviceIntegrity } from '../verification/deviceIntegrity';
import { verifyReport } from '../verification/verifyReport';

const NOW = 1_790_000_000;

const GOOD: TelemetryPacket = {
  vehicle_id: 'R4-TEST-01',
  lat: 8.947459,
  lon: 125.541426,
  speed: 23.5,
  heading: 101,
  seats: 8,
  ts: NOW - 3,
};

const check = (overrides: Record<string, unknown>) => validatePacket({ ...GOOD, ...overrides }, NOW);

describe('packet validator cases', () => {
  it('accepts a well-formed packet and returns only the seven fields', () => {
    const result = validatePacket(GOOD, NOW);
    expect(result).toEqual({ ok: true, packet: GOOD });
  });

  it.each([null, undefined, 'text', 42, [GOOD]])('rejects %p as not an object', (input) => {
    expect(validatePacket(input, NOW)).toEqual({ ok: false, error: 'not_an_object' });
  });

  it.each(['vehicle_id', 'lat', 'lon', 'speed', 'heading', 'seats', 'ts'])('rejects a packet missing %s', (field) => {
    const { [field as keyof TelemetryPacket]: _removed, ...rest } = GOOD;
    expect(validatePacket(rest, NOW)).toEqual({ ok: false, error: 'missing_field', field });
  });

  it('rejects an unknown extra field, so nothing about the rider can be smuggled in', () => {
    expect(check({ user_id: 'abc' })).toEqual({ ok: false, error: 'unknown_field', field: 'user_id' });
    expect(check({ avatar: 3 })).toEqual({ ok: false, error: 'unknown_field', field: 'avatar' });
    expect(check({ fare_class: 'student' })).toEqual({ ok: false, error: 'unknown_field', field: 'fare_class' });
  });

  it('rejects text where a number is expected', () => {
    expect(check({ lat: '8.94' })).toEqual({ ok: false, error: 'bad_lat' });
    expect(check({ speed: '20' })).toEqual({ ok: false, error: 'bad_speed' });
    expect(check({ ts: `${NOW}` })).toEqual({ ok: false, error: 'bad_ts' });
    expect(check({ lon: Number.NaN })).toEqual({ ok: false, error: 'bad_lon' });
  });

  it('rejects out-of-range values', () => {
    expect(check({ lat: 90.1 })).toEqual({ ok: false, error: 'bad_lat' });
    expect(check({ lon: -180.5 })).toEqual({ ok: false, error: 'bad_lon' });
    expect(check({ speed: -1 })).toEqual({ ok: false, error: 'bad_speed' });
    expect(check({ speed: 500 })).toEqual({ ok: false, error: 'bad_speed' });
    expect(check({ heading: 360 })).toEqual({ ok: false, error: 'bad_heading' });
    expect(check({ heading: -1 })).toEqual({ ok: false, error: 'bad_heading' });
  });

  it('accepts seats from 0 to the vehicle capacity and nothing else', () => {
    expect(check({ seats: 0 }).ok).toBe(true);
    expect(check({ seats: VEHICLE_CAPACITY_SEATS }).ok).toBe(true);
    expect(check({ seats: VEHICLE_CAPACITY_SEATS + 1 })).toEqual({ ok: false, error: 'bad_seats' });
    expect(check({ seats: -1 })).toEqual({ ok: false, error: 'bad_seats' });
    expect(check({ seats: 2.5 })).toEqual({ ok: false, error: 'bad_seats' });
  });

  it('rejects a malformed vehicle id', () => {
    expect(check({ vehicle_id: '' })).toEqual({ ok: false, error: 'bad_vehicle_id' });
    expect(check({ vehicle_id: 'r4 test' })).toEqual({ ok: false, error: 'bad_vehicle_id' });
    expect(check({ vehicle_id: 7 })).toEqual({ ok: false, error: 'bad_vehicle_id' });
    expect(check({ vehicle_id: "X'; DROP TABLE vehicles;--" })).toEqual({ ok: false, error: 'bad_vehicle_id' });
  });

  it('rejects a timestamp older than 120 s and accepts one at the limit', () => {
    expect(PACKET_MAX_AGE_S).toBe(120);
    expect(check({ ts: NOW - 120 }).ok).toBe(true);
    expect(check({ ts: NOW - 121 })).toEqual({ ok: false, error: 'too_old' });
  });

  it('rejects a timestamp more than 30 s in the future and accepts one at the limit', () => {
    expect(PACKET_MAX_FUTURE_S).toBe(30);
    expect(check({ ts: NOW + 30 }).ok).toBe(true);
    expect(check({ ts: NOW + 31 })).toEqual({ ok: false, error: 'in_future' });
  });
});

describe('packet encoding', () => {
  it('stays under the packet size limit', () => {
    const worst: TelemetryPacket = {
      vehicle_id: 'R4-TEST-01',
      lat: -89.123456789,
      lon: -179.123456789,
      speed: 199.96,
      heading: 359.4,
      seats: 16,
      ts: NOW + 0.4,
    };
    const encoded = encodePacket(worst);
    expect(new TextEncoder().encode(encoded).length).toBeLessThanOrEqual(PACKET_MAX_BYTES);
  });

  it('produces JSON the validator accepts', () => {
    expect(validatePacket(JSON.parse(encodePacket(GOOD)), NOW).ok).toBe(true);
  });

  it('rounds a heading of 359.6 to 0, not 360', () => {
    expect(JSON.parse(encodePacket({ ...GOOD, heading: 359.6 })).heading).toBe(0);
  });
});

describe('verification plug-in points', () => {
  it('verifyReport returns unverified with verification_disabled', () => {
    expect(verifyReport(GOOD)).toEqual({ status: 'unverified', reasons: ['verification_disabled'] });
  });

  it('deviceIntegrity returns a placeholder result', async () => {
    await expect(deviceIntegrity()).resolves.toEqual({
      status: 'not_checked',
      reasons: ['integrity_check_not_implemented'],
    });
  });
});
