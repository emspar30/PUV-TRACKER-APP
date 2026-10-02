import * as config from '../config';
import { SUPABASE_ENV_ERROR, readDevBroadcastFlag, readSupabaseEnv } from '../config/env';

describe('config exposes every PRD 0.3 default', () => {
  it.each([
    ['ENABLE_VERIFICATION', false],
    ['POSITION_SEND_DISTANCE_M', 100],
    ['POSITION_SEND_INTERVAL_S', 30],
    ['STATIONARY_SPEED_KMH', 2],
    ['STATIONARY_DURATION_S', 45],
    ['LIVENESS_TIMEOUT_S', 90],
    ['COVERAGE_LIVE_MAX_AGE_S', 90],
    ['COVERAGE_STALE_MAX_AGE_S', 600],
    ['PACKET_MAX_AGE_S', 120],
    ['PACKET_MAX_FUTURE_S', 30],
    ['OFFLINE_BUFFER_SIZE', 60],
    ['VEHICLE_CAPACITY_SEATS', 16],
    ['OCCUPANCY_GREEN_MAX_TAKEN', 6],
    ['OCCUPANCY_AMBER_MAX_TAKEN', 12],
    ['FARE_BASE_PHP', 15],
    ['FARE_BASE_KM', 4],
    ['FARE_PER_KM_PHP', 2],
    ['FARE_DISCOUNT_MULTIPLIER', 0.8],
    ['FARE_ROUNDING_STEP_PHP', 0.25],
    ['MAX_WALK_PER_LEG_M', 500],
    ['ROUTING_P95_BUDGET_MS', 250],
    ['ROUTE_SNAP_DISTANCE_M', 30],
    ['MIN_DISPLACEMENT_M', 50],
    ['GPS_ACCURACY_GATE_RELAY_M', 30],
    ['GPS_ACCURACY_GATE_CHECKIN_M', 25],
    ['CHECKIN_RADIUS_M', 60],
    ['NIGHT_MODE_START', '21:00'],
    ['NIGHT_MODE_END', '04:59'],
    ['NIGHT_MODE_TZ', 'Asia/Manila'],
    ['RSSI_SMOOTHING_ALPHA', 0.3],
    ['RSSI_PRESENCE_THRESHOLD_DBM', -65],
    ['SMS_MAX_AGE_MIN', 30],
    ['SMS_STALE_HEATMAP_MIN', 15],
    ['SMS_SEQ_MODULUS', 10000],
    ['SMS_SEQ_NEWER_WINDOW', 5000],
  ])('%s is %p', (name, expected) => {
    expect((config as Record<string, unknown>)[name]).toBe(expected);
  });

  it('discounts Student, Senior Citizen and PWD only', () => {
    expect([...config.FARE_DISCOUNTED_CLASSES].sort()).toEqual(['pwd', 'senior', 'student']);
    expect(config.CLASSIFICATIONS).toContain('regular');
  });
});

describe('supabase client requires env keys', () => {
  it('throws the documented error when a key is missing', () => {
    expect(() => readSupabaseEnv(undefined, undefined)).toThrow(SUPABASE_ENV_ERROR);
    expect(() => readSupabaseEnv('https://example.supabase.co', undefined)).toThrow(SUPABASE_ENV_ERROR);
    expect(() => readSupabaseEnv('', 'key')).toThrow(SUPABASE_ENV_ERROR);
  });

  it('returns the settings when both keys are present', () => {
    expect(readSupabaseEnv('https://example.supabase.co', 'dummy-key')).toEqual({
      url: 'https://example.supabase.co',
      publishableKey: 'dummy-key',
    });
  });
});

describe('dev broadcast flag', () => {
  it('is off unless the value is exactly "true"', () => {
    expect(readDevBroadcastFlag(undefined)).toBe(false);
    expect(readDevBroadcastFlag('1')).toBe(false);
    expect(readDevBroadcastFlag('true')).toBe(true);
  });
});
