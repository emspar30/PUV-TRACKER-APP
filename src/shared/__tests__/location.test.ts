// G0: location consent, the accuracy gates (25 m check-in, 30 m relay), mock and stale fixes, and
// the development fake source. Pure: fixed clocks.

import { canReportWithGps, checkInGeofence, type Place } from '../checkin/geofence';
import {
  FAKE_FIX_STALE_AGE_S,
  GPS_ACCURACY_GATE_CHECKIN_M,
  GPS_ACCURACY_GATE_RELAY_M,
  LOCATION_CONSENT_VERSION,
  LOCATION_FIX_MAX_AGE_S,
} from '../config';
import { acceptFix, fakeFix, fixAgeS } from '../location/accuracyGate';
import { consentStatus, giveConsent, mayRequestPermission, mayUseLocation, NO_CONSENT, withdrawConsent } from '../location/consent';

const T0 = Date.UTC(2026, 9, 6, 2, 0, 0);
const FRESH = { mocked: false, ageS: 1 };
const STATION = { lat: 8.947459, lon: 125.541426 };
const at = (fix: Partial<Place>): Place => ({ ...STATION, source: 'gps', accuracyM: 10, mocked: false, ageS: 1, ...fix });

describe('consent', () => {
  it('no permission request before consent; none after withdrawal', () => {
    expect(mayRequestPermission(NO_CONSENT)).toBe(false);
    const given = giveConsent(T0);
    expect(mayRequestPermission(given)).toBe(true);
    const withdrawn = withdrawConsent(T0 + 1);
    expect(consentStatus(withdrawn)).toBe('withdrawn');
    expect(mayRequestPermission(withdrawn)).toBe(false);
  });

  it('asks again when the notice changes', () => {
    const old = giveConsent(T0, LOCATION_CONSENT_VERSION - 1);
    expect(consentStatus(old)).toBe('none');
    expect(mayRequestPermission(old)).toBe(false);
  });

  it('uses the position only with both consent and the Android permission', () => {
    expect(mayUseLocation(giveConsent(T0), 'granted')).toBe(true);
    expect(mayUseLocation(giveConsent(T0), 'denied')).toBe(false);
    expect(mayUseLocation(NO_CONSENT, 'granted')).toBe(false);
    expect(mayUseLocation(withdrawConsent(T0), 'granted')).toBe(false);
  });
});

describe('accuracy gate', () => {
  it('30.0 m accepted, 30.1 m rejected for relay', () => {
    expect(acceptFix({ ...FRESH, accuracyM: GPS_ACCURACY_GATE_RELAY_M }, GPS_ACCURACY_GATE_RELAY_M)).toEqual({ ok: true });
    expect(acceptFix({ ...FRESH, accuracyM: GPS_ACCURACY_GATE_RELAY_M + 0.1 }, GPS_ACCURACY_GATE_RELAY_M)).toEqual({ ok: false, reason: 'poor_accuracy' });
  });

  it('25.0 m accepted, 25.1 m rejected for check-in', () => {
    expect(acceptFix({ ...FRESH, accuracyM: GPS_ACCURACY_GATE_CHECKIN_M }, GPS_ACCURACY_GATE_CHECKIN_M)).toEqual({ ok: true });
    expect(acceptFix({ ...FRESH, accuracyM: GPS_ACCURACY_GATE_CHECKIN_M + 0.1 }, GPS_ACCURACY_GATE_CHECKIN_M)).toEqual({
      ok: false,
      reason: 'poor_accuracy',
    });
  });

  it('a fix without an accuracy is rejected', () => {
    expect(acceptFix({ ...FRESH, accuracyM: null }, GPS_ACCURACY_GATE_RELAY_M)).toEqual({ ok: false, reason: 'poor_accuracy' });
  });

  it('a fix with mocked true is rejected with reason mocked, however precise', () => {
    expect(acceptFix({ accuracyM: 3, mocked: true, ageS: 0 }, GPS_ACCURACY_GATE_RELAY_M)).toEqual({ ok: false, reason: 'mocked' });
  });

  it('a fix older than the limit, or of unknown age, is rejected as stale', () => {
    expect(acceptFix({ accuracyM: 5, mocked: false, ageS: LOCATION_FIX_MAX_AGE_S }, GPS_ACCURACY_GATE_RELAY_M)).toEqual({ ok: true });
    expect(acceptFix({ accuracyM: 5, mocked: false, ageS: LOCATION_FIX_MAX_AGE_S + 0.1 }, GPS_ACCURACY_GATE_RELAY_M)).toEqual({ ok: false, reason: 'stale' });
    expect(acceptFix({ accuracyM: 5, mocked: false, ageS: null }, GPS_ACCURACY_GATE_RELAY_M)).toEqual({ ok: false, reason: 'stale' });
  });

  it('measures age in seconds and never below zero', () => {
    expect(fixAgeS(T0, T0 + 4500)).toBe(4.5);
    expect(fixAgeS(T0 + 1000, T0)).toBe(0);
  });
});

describe('the gates on check-in and relay', () => {
  it('a 28 m fix may relay with GPS but not check in', () => {
    expect(canReportWithGps(at({ accuracyM: 28 }))).toBe(true);
    expect(checkInGeofence(at({ accuracyM: 28 }), STATION)).toEqual({ ok: false, reason: 'inaccurate' });
  });

  it('a mock or stale fix does neither', () => {
    expect(checkInGeofence(at({ mocked: true }), STATION)).toEqual({ ok: false, reason: 'mocked' });
    expect(checkInGeofence(at({ ageS: LOCATION_FIX_MAX_AGE_S + 1 }), STATION)).toEqual({ ok: false, reason: 'stale' });
    expect(canReportWithGps(at({ mocked: true }))).toBe(false);
    expect(canReportWithGps(at({ ageS: LOCATION_FIX_MAX_AGE_S + 1 }))).toBe(false);
  });

  it('a simulated stop is not judged by the gates', () => {
    expect(checkInGeofence({ ...STATION, source: 'simulated', accuracyM: null }, STATION).ok).toBe(true);
  });
});

describe('the development fake source', () => {
  it('makes a fix at the point with the chosen accuracy and mock flag', () => {
    const fix = fakeFix(STATION, { accuracyM: 28, mocked: true, stale: false }, T0);
    expect(fix).toMatchObject({ ...STATION, accuracyM: 28, mocked: true, timestampMs: T0 });
    expect(acceptFix({ ...fix, ageS: fixAgeS(fix.timestampMs, T0) }, GPS_ACCURACY_GATE_RELAY_M)).toEqual({ ok: false, reason: 'mocked' });
  });

  it('a stale fake fix is older than the limit, so the gates refuse it', () => {
    const fix = fakeFix(STATION, { accuracyM: 10, mocked: false, stale: true }, T0);
    expect(fixAgeS(fix.timestampMs, T0)).toBe(FAKE_FIX_STALE_AGE_S);
    expect(FAKE_FIX_STALE_AGE_S).toBeGreaterThan(LOCATION_FIX_MAX_AGE_S);
    expect(acceptFix({ ...fix, ageS: fixAgeS(fix.timestampMs, T0) }, GPS_ACCURACY_GATE_CHECKIN_M)).toEqual({ ok: false, reason: 'stale' });
  });
});
